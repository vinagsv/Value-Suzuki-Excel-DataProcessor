import { useState, useMemo, useEffect, createContext, useContext } from "react";
import {
  MemoryRouter as Router,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import * as XLSX from "xlsx";

const AttendanceContext = createContext();
const API_URL = import.meta.env.VITE_API_URL;

const AttendanceProvider = ({ children, theme }) => {
  const [employees, setEmployees] = useState([]);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [availableMonths, setAvailableMonths] = useState([]);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isLoadingDefault, setIsLoadingDefault] = useState(false);
  
  const isDark = theme === "dark";

  // --- Helper Functions (Time & Date Calculations) ---

  const convertTo12Hour = (time24) => {
    if (!time24 || time24 === "-" || time24 === "nan") return "-";
    // Handle Excel decimal time
    if (typeof time24 === "number") {
      const totalMins = Math.round(time24 * 24 * 60);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${
        h >= 12 ? "PM" : "AM"
      }`;
    }
    const [hours, minutes] = String(time24).split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return time24;

    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")} ${period}`;
  };

  const excelTimeToString = (value) => {
    if (value === undefined || value === null || value === "") return "-";
    if (typeof value === "number") {
      const totalMinutes = Math.round(value * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
    }
    return String(value).trim();
  };

  const getDaysInMonth = (month, year) => {
    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
    };
    return new Date(year, months[month] + 1, 0).getDate();
  };

  const getDayOfWeek = (day, month, year) => {
    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
    };
    const date = new Date(year, months[month], day);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  };

  const getWeekOfMonth = (day, month, year) => {
    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
    };
    const date = new Date(year, months[month], day);
    const firstDayOfMonth = new Date(year, months[month], 1);
    const pastDaysOfMonth = (date - firstDayOfMonth) / (1000 * 60 * 60 * 24);
    return Math.ceil((pastDaysOfMonth + firstDayOfMonth.getDay() + 1) / 7);
  };

  const calculateStatus = (inTime, outTime) => {
    if (!inTime || inTime === "-" || inTime === "nan") {
      return { status: "A", label: "Absent" };
    }
    if (!outTime || outTime === "-" || outTime === "nan") {
      return { status: "HLF", label: "Half Day (No Out Time)" };
    }
    const [inHour, inMin] = String(inTime).split(":").map(Number);
    const [outHour, outMin] = String(outTime).split(":").map(Number);

    const inMinutes = inHour * 60 + inMin;
    const outMinutes = outHour * 60 + outMin;

    let workedMinutes = outMinutes - inMinutes;
    if (workedMinutes < 0) workedMinutes += 24 * 60;

    // 9 hours 40 minutes = 580 minutes
    const fullDayThreshold = 580; 

    if (workedMinutes >= fullDayThreshold) {
      return { status: "P", label: "Present" };
    } else {
      return { status: "HLF", label: "Half Day" };
    }
  };

  const getTimeStatus = (inTime, outTime) => {
    if (!inTime || inTime === "-" || inTime === "nan") return null;

    const [inHour, inMin] = String(inTime).split(":").map(Number);
    const inMinutes = inHour * 60 + inMin;

    const lateThreshold = 9 * 60 + 20; // 9:20 AM

    let status = {};

    if (inMinutes > lateThreshold) {
      const lateBy = inMinutes - 9 * 60; 
      const lateHours = Math.floor(lateBy / 60);
      const lateMins = lateBy % 60;
      status.late = `${lateHours}h ${lateMins}m`;
    }

    if (outTime && outTime !== "-" && outTime !== "nan") {
      const [outHour, outMin] = String(outTime).split(":").map(Number);
      const outMinutes = outHour * 60 + outMin;
      const earlyThreshold = 18 * 60 + 50; // 6:50 PM

      if (outMinutes < earlyThreshold) {
        const earlyBy = 19 * 60 - outMinutes; 
        const earlyHours = Math.floor(earlyBy / 60);
        const earlyMins = earlyBy % 60;
        status.early = `${earlyHours}h ${earlyMins}m`;
      }
    }

    return Object.keys(status).length > 0 ? status : null;
  };

  const calculateWorkingHours = (inTime, outTime) => {
    if (
      !inTime ||
      inTime === "-" ||
      !outTime ||
      outTime === "-" ||
      inTime === "nan" ||
      outTime === "nan"
    ) {
      return "-";
    }
    const [inHour, inMin] = String(inTime).split(":").map(Number);
    const [outHour, outMin] = String(outTime).split(":").map(Number);

    let totalMinutes = outHour * 60 + outMin - (inHour * 60 + inMin);

    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  };

  // --- Detect Month Logic ---
  const detectMonthsAndYear = (rows) => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    let detectedMonth = "";
    let detectedYear = "";

    // 1. Search for 'Period' row
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const rowStr = row.join(" ");

      if (rowStr.includes("Period")) {
        const periodMatch = rowStr.match(
          /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
        );
        if (periodMatch) {
          const m = parseInt(periodMatch[2]);
          if (m >= 1 && m <= 12) {
            detectedMonth = months[m - 1];
            detectedYear = periodMatch[3];
            return { selectedMonth: detectedMonth, detectedYear };
          }
        }
      }
    }

    // 2. Fallback
    if (!detectedMonth) {
      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;
        const rowStr = row.join(" ");
        const dateMatch = rowStr.match(
          /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
        );
        if (dateMatch) {
          const m = parseInt(dateMatch[2]);
          if (m >= 1 && m <= 12) {
            detectedMonth = months[m - 1];
            detectedYear = dateMatch[3];
            break;
          }
        }
      }
    }

    // 3. Default to today
    if (!detectedMonth) {
      const today = new Date();
      detectedMonth = months[today.getMonth()];
      detectedYear = today.getFullYear().toString();
    }

    return { selectedMonth: detectedMonth, detectedYear };
  };

  const parseFile = (rows, fileName, selectedMonth, detectedYear) => {
    try {
      const employeeData = [];
      let currentEmployee = null;
      const daysInMonth = getDaysInMonth(selectedMonth, detectedYear);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row) || row.length === 0) continue;

        const firstCell = String(row[0]).trim();

        if (firstCell.includes("Employee ID")) {
          const idMatch = firstCell.match(/Employee ID\s*[:|-]\s*([^;]+)/i);
          const nameMatch = firstCell.match(/Employee Name\s*[:|-]\s*([^;]+)/i);
          const desigMatch = firstCell.match(/Designation\s*[:|-]\s*([^;]+)/i);
          const deptMatch = firstCell.match(/Department\s*[:|-]\s*([^;]+)/i);

          currentEmployee = {
            id: idMatch ? idMatch[1].trim() : "Unknown",
            name: nameMatch ? nameMatch[1].trim() : "Unknown",
            designation: desigMatch ? desigMatch[1].trim() : "",
            department: deptMatch ? deptMatch[1].trim() : "",
            attendance: [],
          };
          continue;
        }

        if (currentEmployee && firstCell.toLowerCase().includes("in_time")) {
          const inRow = row;
          const outRow = rows[i + 1] ? rows[i + 1] : [];

          for (let day = 1; day <= daysInMonth; day++) {
            const inTime = excelTimeToString(inRow[day]);
            const outTime = excelTimeToString(outRow[day]);
            const dayOfWeek = getDayOfWeek(day, selectedMonth, detectedYear);
            const weekOfMonth = getWeekOfMonth(
              day,
              selectedMonth,
              detectedYear
            );
            const workingHours = calculateWorkingHours(inTime, outTime);
            const statusInfo = calculateStatus(inTime, outTime);
            const timeStatus = getTimeStatus(inTime, outTime);

            currentEmployee.attendance.push({
              day,
              date: `${day}/${selectedMonth.substring(0, 3)}/${detectedYear}`,
              dayOfWeek,
              weekOfMonth,
              inTime: inTime || "-",
              outTime: outTime || "-",
              workingHours,
              status: statusInfo.status,
              statusLabel: statusInfo.label,
              timeStatus,
              isSunday: dayOfWeek === "Sun",
            });
          }
          employeeData.push(currentEmployee);
          currentEmployee = null;
        }
      }
      setEmployees(employeeData);
      setUploadedFileName(fileName);
      setFileUploaded(true);
      return { success: true, count: employeeData.length };
    } catch (err) {
      alert("Excel parsing error: " + err.message);
      return { success: false };
    }
  };

  // --- Backend Integration ---

  const fetchAvailableMonths = async () => {
    try {
      const res = await fetch(`${API_URL}/attendance/list-months`);
      if (res.ok) {
        const data = await res.json();
        const monthMap = {
          January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
          July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
        };

        const sortedData = data.sort((a, b) => {
          if (parseInt(b.year) !== parseInt(a.year)) {
            return parseInt(b.year) - parseInt(a.year); 
          }
          return monthMap[b.month] - monthMap[a.month]; 
        });

        const formatted = sortedData.map((f) => `${f.month}-${f.year}`);
        setAvailableMonths(formatted);

        if (sortedData.length > 0 && employees.length === 0) {
          loadMonthData(sortedData[0].month, sortedData[0].year);
        }
      }
    } catch (err) {
      console.error("Error fetching months", err);
    }
  };

  const loadMonthData = async (m, y) => {
    setIsLoadingDefault(true);
    try {
      const res = await fetch(
        `${API_URL}/attendance/get-data?month=${m}&year=${y}`
      );
      if (!res.ok) throw new Error("Data not found");
      const { data, fileName } = await res.json();

      setMonth(m);
      setYear(y);
      parseFile(data, fileName, m, y);
    } catch (error) {
      console.error("Error loading file: ", error);
    } finally {
      setIsLoadingDefault(false);
    }
  };

  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname], {
        header: 1,
      });

      const { selectedMonth, detectedYear } = detectMonthsAndYear(data);

      setMonth(selectedMonth);
      setYear(detectedYear);
      const result = parseFile(data, file.name, selectedMonth, detectedYear);

      if (result.success && result.count > 0) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("month", selectedMonth);
        formData.append("year", detectedYear);

        try {
          const res = await fetch(`${API_URL}/attendance/upload`, {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            await fetchAvailableMonths();
          }
        } catch (err) {
          console.error("Background upload failed", err);
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleMonthChange = (val) => {
    if (!val) return;
    const [m, y] = val.split("-");
    loadMonthData(m, y);
  };

  const getEmployeeStats = (employee) => {
    const stats = {
      totalPresent: 0,
      onTime: 0,
      halfDay: 0,
      absent: 0,
      late: 0,
      earlyLeave: 0,
      totalDays: month && year ? getDaysInMonth(month, year) : 0,
      sundaysInMonth: 0,
      salaryDays: 0,
      totalLeaves: 0,
      unpaidLeaves: 0,
    };

    if (month && year) {
        const daysInMonth = getDaysInMonth(month, year);
        for (let d = 1; d <= daysInMonth; d++) {
            if (getDayOfWeek(d, month, year) === "Sun") {
                stats.sundaysInMonth++;
            }
        }
    }

    let sundaysWorked = 0;

    employee.attendance.forEach((record) => {
      switch (record.status) {
        case "P":
          stats.totalPresent++;
          if (!record.timeStatus?.late) stats.onTime++;
          if (record.isSunday) sundaysWorked++;
          break;
        case "A":
          if (!record.isSunday) {
              stats.absent++;
          }
          break;
        case "HLF":
          stats.halfDay++;
          if (record.isSunday) sundaysWorked++;
          break;
      }

      if (record.timeStatus) {
        if (record.timeStatus.late) stats.late++;
        if (record.timeStatus.early) stats.earlyLeave++;
      }
    });

    stats.absent = Math.max(0, stats.absent - sundaysWorked);

    const paidLeaves = stats.sundaysInMonth + 1; 
    const workedDays = stats.totalPresent + stats.halfDay; 
    const calculatedSalaryDays = workedDays + paidLeaves;

    stats.totalLeaves = stats.totalDays - workedDays;
    
    // Check if employee is absent for more than 25 days in total
    if (stats.totalLeaves > 25) {
      stats.salaryDays = 0;
    } else {
      stats.salaryDays = Math.min(calculatedSalaryDays, stats.totalDays);
    }
    
    stats.unpaidLeaves = Math.max(0, stats.totalDays - stats.salaryDays);

    return stats;
  };

  // Detailed report for individual employees
  const printReports = (employeesToPrint) => {
    if (!employeesToPrint || employeesToPrint.length === 0) return;

    const printWindow = window.open("", "_blank");
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance Report - ${month} ${year}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
          .page-break { page-break-after: always; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
          h1 { margin: 0 0 5px 0; font-size: 24px; color: #2c3e50; }
          .emp-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
          .emp-info div { flex: 1; }
          .stats-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
          .stat-box { border: 1px solid #e2e8f0; padding: 10px 15px; border-radius: 6px; background: #f8fafc; font-size: 13px; flex: 1; min-width: 100px; text-align: center; }
          .stat-box strong { display: block; font-size: 16px; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: 600; }
          .sunday { background-color: #fef9c3; }
          .status-p { color: #166534; font-weight: bold; }
          .status-a { color: #991b1b; font-weight: bold; }
          .status-hlf { color: #854d0e; font-weight: bold; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
    `;

    employeesToPrint.forEach((emp, index) => {
      const stats = getEmployeeStats(emp);
      
      html += `
        <div class="header">
          <h1>Attendance Report</h1>
          <div>${month} ${year}</div>
        </div>
        
        <div class="emp-info">
          <div>
            <strong>Name:</strong> ${emp.name}<br/>
            <strong>ID:</strong> ${emp.id}
          </div>
          <div>
            <strong>Designation:</strong> ${emp.designation || 'N/A'}<br/>
            <strong>Department:</strong> ${emp.department || 'N/A'}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-box">Salary Days <strong>${stats.salaryDays}</strong></div>
          <div class="stat-box">Present <strong>${stats.totalPresent}</strong></div>
          <div class="stat-box">Half Days <strong>${stats.halfDay}</strong></div>
          <div class="stat-box">Absent <strong>${stats.unpaidLeaves} / ${stats.totalLeaves}</strong></div>
          <div class="stat-box">Late <strong>${stats.late}</strong></div>
          <div class="stat-box">Early Leave <strong>${stats.earlyLeave}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>In Time</th>
              <th>Out Time</th>
              <th>Working Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${emp.attendance.map(record => {
              let statusClass = '';
              if(record.status === 'P') statusClass = 'status-p';
              if(record.status === 'A') statusClass = 'status-a';
              if(record.status === 'HLF') statusClass = 'status-hlf';

              let inTimeExt = record.timeStatus?.late ? ' <i>(Late)</i>' : '';
              let outTimeExt = record.timeStatus?.early ? ' <i>(Early)</i>' : '';

              return `
                <tr class="${record.isSunday ? 'sunday' : ''}">
                  <td>${record.date}</td>
                  <td>${record.dayOfWeek}</td>
                  <td>${convertTo12Hour(record.inTime)}${inTimeExt}</td>
                  <td>${convertTo12Hour(record.outTime)}${outTimeExt}</td>
                  <td>${record.workingHours}</td>
                  <td class="${statusClass}">${record.statusLabel}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ${index < employeesToPrint.length - 1 ? '<div class="page-break"></div>' : ''}
      `;
    });

    html += `
      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
            window.close();
          }, 250);
        }
      </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Brief summary report for all employees
  const printSummaryReport = (employeesToPrint) => {
    if (!employeesToPrint || employeesToPrint.length === 0) return;

    const printWindow = window.open("", "_blank");
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance Summary - ${month} ${year}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
          h1 { margin: 0 0 5px 0; font-size: 24px; color: #2c3e50; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: 600; color: #334155; }
          tr:nth-child(even) { background-color: #f8fafc; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Attendance Summary Report</h1>
          <div style="font-size: 16px; font-weight: bold;">${month} ${year}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>ID</th>
              <th>Salary Days</th>
              <th>Total Present</th>
              <th>Half Day</th>
              <th>Absent (Unpaid/Total)</th>
              <th>Late Arrivals</th>
            </tr>
          </thead>
          <tbody>
    `;

    employeesToPrint.forEach(emp => {
      const stats = getEmployeeStats(emp);
      html += `
        <tr>
          <td style="font-weight: 600;">${emp.name}</td>
          <td>${emp.id}</td>
          <td style="font-weight: bold; color: #4338ca;">${stats.salaryDays}</td>
          <td style="color: #16a34a; font-weight: 600;">${stats.totalPresent}</td>
          <td style="color: #ca8a04; font-weight: 600;">${stats.halfDay}</td>
          <td style="color: #dc2626; font-weight: 600;">${stats.unpaidLeaves} / ${stats.totalLeaves}</td>
          <td style="color: #ea580c; font-weight: 600;">${stats.late}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              window.close();
            }, 250);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const value = {
    employees,
    setEmployees,
    month,
    year,
    availableMonths,
    fileUploaded,
    uploadedFileName,
    handleFileUpload,
    handleMonthChange,
    getDaysInMonth,
    excelTimeToString,
    getDayOfWeek,
    getWeekOfMonth,
    calculateStatus,
    getTimeStatus,
    calculateWorkingHours,
    convertTo12Hour,
    isLoadingDefault,
    theme,
    isDark,
    getEmployeeStats,
    printReports,
    printSummaryReport,
    getStatusColor: (status) => {
      switch (status) {
        case "P":
          return isDark ? "bg-green-900/40 text-green-400 border-green-800" : "bg-green-100 text-green-800 border-green-300";
        case "A":
          return isDark ? "bg-red-900/40 text-red-400 border-red-800" : "bg-red-100 text-red-800 border-red-300";
        case "HLF":
          return isDark ? "bg-yellow-900/40 text-yellow-400 border-yellow-800" : "bg-yellow-100 text-yellow-800 border-yellow-300";
        default:
          return isDark ? "bg-gray-800 text-gray-400 border-gray-700" : "bg-gray-100 text-gray-600 border-gray-300";
      }
    },
  };

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
};

const Dashboard = () => {
  const {
    employees,
    month,
    year,
    availableMonths,
    fileUploaded,
    uploadedFileName,
    handleFileUpload,
    handleMonthChange,
    getDaysInMonth,
    isLoadingDefault,
    getEmployeeStats,
    printSummaryReport,
    isDark
  } = useContext(AttendanceContext);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const employeesPerPage = 10;

  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const search = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name?.toLowerCase().includes(search) ||
        emp.id?.toLowerCase().includes(search)
    );
  }, [employees, searchTerm]);

  const indexOfLastEmployee = currentPage * employeesPerPage;
  const indexOfFirstEmployee = indexOfLastEmployee - employeesPerPage;
  const currentEmployees = filteredEmployees.slice(
    indexOfFirstEmployee,
    indexOfLastEmployee
  );
  const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const navigate = useNavigate();

  const handleEmployeeClick = (emp) => {
    navigate(`/employee/${emp.id}`);
  };

  if (isLoadingDefault) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} p-4 md:p-8 flex items-center justify-center transition-colors duration-300`}>
        <div className={`${isDark ? 'bg-gray-800 border-gray-700 shadow-2xl' : 'bg-white shadow-xl'} border rounded-2xl p-12 text-center`}>
          <div className="text-6xl mb-4">⏳</div>
          <h3 className={`text-xl font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
            Loading Attendance Data...
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} p-4 md:p-8 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto">
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} border shadow-xl rounded-2xl p-6 mb-6 transition-colors duration-300`}>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-2`}>
            📅 Attendance Dashboard
          </h1>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Full Day: &ge; 9h 40m • Half Day: &lt; 9h 40m (Paid Full) • Paid Sundays • +1 Extra Leave
          </p>
          {month && year && (
            <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'} mt-2`}>
              Viewing: {month} {year}
            </p>
          )}
        </div>

        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} border shadow-xl rounded-2xl p-6 mb-6 flex justify-between items-center transition-colors duration-300`}>
          <label className="flex items-center cursor-pointer">
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mr-2`}>
              Upload Custom File:
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition cursor-pointer"
            >
              {fileUploaded
                ? `Change File (${uploadedFileName})`
                : "Choose File"}
            </label>
          </label>
          {availableMonths.length > 0 && (
            <select
              value={month && year ? `${month}-${year}` : ""}
              onChange={(e) => handleMonthChange(e.target.value)}
              className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="">Select a Month...</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>

        {employees.length > 0 ? (
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} border shadow-xl rounded-2xl p-6 mb-6 transition-colors duration-300`}>
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-1`}>
                  👥 Employees ({filteredEmployees.length})
                </h2>
                <input
                  type="text"
                  placeholder="Search employees by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <div className="flex flex-col items-end gap-2">
                {month && year && (
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Total Working Days: {getDaysInMonth(month, year)}
                  </div>
                )}
                <button
                  onClick={() => printSummaryReport(filteredEmployees)}
                  className={`px-4 py-2 text-sm rounded-lg text-white font-semibold shadow transition ${isDark ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                >
                  🖨️ Print All Reports
                </button>
              </div>

            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Employee Name
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      ID
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                       Salary Days
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Total Present
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Half Day
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Absent (Unpaid/Total)
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Late Arrivals
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {currentEmployees.map((emp) => {
                    const stats = getEmployeeStats(emp);
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => handleEmployeeClick(emp)}
                        className={`cursor-pointer transition ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}
                      >
                        <td className={`px-4 py-3 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                          {emp.name}
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {emp.id}
                        </td>
                         <td className={`px-4 py-3 text-sm font-bold ${isDark ? 'text-indigo-400 bg-indigo-900/30' : 'text-indigo-700 bg-indigo-50'}`}>
                          {stats.salaryDays}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          {stats.totalPresent}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          {stats.halfDay}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                          {stats.unpaidLeaves} / {stats.totalLeaves}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                          {stats.late}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-4 mt-4">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg disabled:opacity-50 ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`}
                >
                  Previous
                </button>
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-lg disabled:opacity-50 ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} border shadow-xl rounded-2xl p-12 text-center transition-colors duration-300`}>
            <div className="text-6xl mb-4">📊</div>
            <h3 className={`text-xl font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
              No Data Yet
            </h3>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Upload a CSV or Excel file to view employee attendance records
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const Detail = () => {
  const { id: paramId } = useParams();
  const {
    employees,
    month,
    year,
    getEmployeeStats,
    getStatusColor,
    convertTo12Hour,
    printReports,
    isDark
  } = useContext(AttendanceContext);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const search = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name?.toLowerCase().includes(search) ||
        emp.id?.toLowerCase().includes(search)
    );
  }, [employees, searchTerm]);

  useEffect(() => {
    if (employees.length > 0) {
      let emp = employees.find((emp) => emp.id === paramId);
      if (!emp) {
        emp = employees[0];
      }
      setSelectedEmployee(emp);
    }
  }, [employees, paramId]);

  if (!selectedEmployee) {
    return <div className={`min-h-screen p-8 ${isDark ? 'bg-gray-900 text-white' : 'bg-blue-50 text-gray-900'}`}>Employee not found</div>;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} p-4 md:p-8 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} border shadow-xl rounded-2xl p-4 h-[80vh] flex flex-col transition-colors duration-300`}>
              <button
                onClick={() => navigate("/")}
                className={`w-full mb-4 px-4 py-2 rounded-lg transition flex items-center justify-center gap-2 ${
                  isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <span>⬅</span> Back to Dashboard
              </button>

              <div className="mb-4">
                <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-2`}>
                  👥 Select Employee
                </h3>
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300'
                  }`}
                />
              </div>
              <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`p-3 rounded-lg cursor-pointer transition ${
                      selectedEmployee?.id === emp.id
                        ? (isDark ? 'bg-blue-900/40 border-2 border-blue-400' : 'bg-blue-100 border-2 border-blue-500')
                        : (isDark ? 'bg-gray-800 hover:bg-gray-700 border-2 border-transparent' : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent')
                    }`}
                  >
                    <div className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {emp.name}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>ID: {emp.id}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} border shadow-xl rounded-2xl p-6 transition-colors duration-300`}>
              
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h2 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-1`}>
                    Detailed Attendance
                  </h2>
                  <h3 className={`text-xl font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'} mb-2`}>
                    {selectedEmployee.name}
                  </h3>
                  <div className={`space-y-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <div>
                      <span className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>Employee ID:</span>{" "}
                      {selectedEmployee.id}
                    </div>
                    <div>
                      <span className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>Designation:</span>{" "}
                      {selectedEmployee.designation}
                    </div>
                    <div>
                      <span className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>Department:</span>{" "}
                      {selectedEmployee.department}
                    </div>
                    <div>
                      <span className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>Month:</span> {month} {year}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => printReports([selectedEmployee])}
                  className={`px-4 py-2 text-sm rounded-lg text-white font-semibold shadow transition ${isDark ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                >
                  🖨️ Print Report
                </button>
              </div>

              {(() => {
                const stats = getEmployeeStats(selectedEmployee);

                return (
                  <div className="mb-6">
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'} mb-3`}>
                      Monthly Summary
                    </h3>
                    
                    <div className={`${isDark ? 'bg-indigo-900/20 border-indigo-800' : 'bg-indigo-50 border-indigo-200'} p-4 rounded-xl border mb-4 flex flex-col justify-center items-start`}>
                        <div className="w-full">
                            <div className={`text-sm font-bold uppercase tracking-wide ${isDark ? 'text-indigo-400' : 'text-indigo-800'}`}> Salary Days</div>
                            <div className={`text-4xl font-extrabold mt-1 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                              {stats.salaryDays} <span className={`text-xl font-normal ${isDark ? 'text-indigo-500' : 'text-indigo-600'}`}>days</span>
                            </div>
                            <div className={`text-sm mt-2 font-medium inline-block px-3 py-1 rounded-lg ${isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
                                Month Total: <span className="font-bold">{stats.totalDays} Days</span> 
                                <span className={`mx-2 ${isDark ? 'text-indigo-600' : 'text-indigo-400'}`}>|</span> 
                                Actual Absent (Unpaid): <span className={`font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>{stats.unpaidLeaves} Days</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className={`p-4 rounded-lg border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'}`}>
                        <div className={`text-xs mb-1 ${isDark ? 'text-green-500' : 'text-gray-600'}`}>
                          Total Present Count
                        </div>
                        <div className={`text-xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          {stats.totalPresent}
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                        <div className={`text-xs mb-1 ${isDark ? 'text-blue-500' : 'text-gray-600'}`}>
                          Full Days (On Time)
                        </div>
                        <div className={`text-xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                          {stats.onTime}
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className={`text-xs mb-1 ${isDark ? 'text-yellow-500' : 'text-gray-600'}`}>
                          Half Days
                        </div>
                        <div className={`text-xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          {stats.halfDay}
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
                        <div className={`text-xs mb-1 ${isDark ? 'text-red-500' : 'text-gray-600'}`}>Absent (Unpaid/Total)</div>
                        <div className={`text-xl font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                          {stats.unpaidLeaves} / {stats.totalLeaves}
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${isDark ? 'bg-orange-900/20 border-orange-800' : 'bg-orange-50 border-orange-200'}`}>
                        <div className={`text-xs mb-1 ${isDark ? 'text-orange-500' : 'text-gray-600'}`}>
                          Late Arrivals
                        </div>
                        <div className={`text-xl font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                          {stats.late}
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${isDark ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-50 border-purple-200'}`}>
                        <div className={`text-xs mb-1 ${isDark ? 'text-purple-500' : 'text-gray-600'}`}>
                          Early Leaves
                        </div>
                        <div className={`text-xl font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                          {stats.earlyLeave}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className={`mb-4 flex flex-wrap gap-3 p-3 rounded-lg text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-800'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Present (Work &ge; 9h 40m)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Half Day (Work &lt; 9h 40m)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-3 border ${isDark ? 'bg-yellow-900/40 border-yellow-600' : 'bg-yellow-200 border-yellow-400'}`}></div>
                  <span>Sunday (Paid)</span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full">
                  <thead className={`sticky top-0 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <tr>
                      <th className={`px-3 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Date
                      </th>
                      <th className={`px-3 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Day
                      </th>
                      <th className={`px-3 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        In Time
                      </th>
                      <th className={`px-3 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Out Time
                      </th>
                      <th className={`px-3 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Hours
                      </th>
                      <th className={`px-3 py-3 text-left text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    {selectedEmployee.attendance.map((record, idx) => (
                      <tr
                        key={idx}
                        className={`${
                          record.isSunday
                            ? (isDark ? "bg-yellow-900/20 hover:bg-yellow-900/30" : "bg-yellow-50 hover:bg-yellow-100")
                            : (isDark ? "hover:bg-gray-700/50" : "hover:bg-gray-50")
                        } transition`}
                      >
                        <td className={`px-3 py-3 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          {record.date}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              record.isSunday
                                ? (isDark ? "bg-yellow-900/40 text-yellow-400" : "bg-yellow-200 text-yellow-800")
                                : (isDark ? "bg-blue-900/40 text-blue-400" : "bg-blue-100 text-blue-700")
                            }`}
                          >
                            {record.dayOfWeek}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`font-semibold ${
                                record.inTime !== "-" && record.inTime !== "nan"
                                  ? (isDark ? "text-blue-400" : "text-blue-600")
                                  : (isDark ? "text-gray-600" : "text-gray-400")
                              }`}
                            >
                              {convertTo12Hour(record.inTime)}
                            </span>
                            {record.timeStatus?.late && (
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold w-fit ${isDark ? 'bg-orange-900/40 text-orange-400' : 'bg-orange-100 text-orange-700'}`}>
                                Late {record.timeStatus.late}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`font-semibold ${
                                record.outTime !== "-" &&
                                record.outTime !== "nan"
                                  ? (isDark ? "text-purple-400" : "text-purple-600")
                                  : (isDark ? "text-gray-600" : "text-gray-400")
                              }`}
                            >
                              {convertTo12Hour(record.outTime)}
                            </span>
                            {record.timeStatus?.early && (
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold w-fit ${isDark ? 'bg-purple-900/40 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                                Early {record.timeStatus.early}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`px-3 py-3 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {record.workingHours}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                              record.status
                            )}`}
                          >
                            {record.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AttendanceApp({ theme }) {
  return (
    <AttendanceProvider theme={theme}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employee/:id" element={<Detail />} />
        </Routes>
      </Router>
    </AttendanceProvider>
  );
}