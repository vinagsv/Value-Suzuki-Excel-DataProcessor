import { useState, useMemo, useEffect, createContext, useContext } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import * as XLSX from "xlsx";

const AttendanceContext = createContext();
const API_URL = import.meta.env.VITE_API_URL;

const AttendanceProvider = ({ children }) => {
  const [employees, setEmployees] = useState([]);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [availableMonths, setAvailableMonths] = useState([]); 
  const [fileUploaded, setFileUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isLoadingDefault, setIsLoadingDefault] = useState(false);

  // --- Helper Functions (Time & Date Calculations) ---

  const convertTo12Hour = (time24) => {
    if (!time24 || time24 === "-" || time24 === "nan") return "-";
    // Handle Excel decimal time
    if (typeof time24 === 'number') {
        const totalMins = Math.round(time24 * 24 * 60);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
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
      return { status: "HLF", label: "Half Day" };
    }
    const [inHour, inMin] = String(inTime).split(":").map(Number);
    const [outHour, outMin] = String(outTime).split(":").map(Number);

    const inMinutes = inHour * 60 + inMin;
    const outMinutes = outHour * 60 + outMin;

    const lateThreshold = 9 * 60 + 20; // 9:20 AM
    const earlyThreshold = 18 * 60 + 50; // 6:50 PM

    if (inMinutes > lateThreshold || outMinutes < earlyThreshold) {
      return { status: "HLF", label: "Half Day" };
    }

    const workedMinutes = outMinutes - inMinutes;
    const workedHours = workedMinutes / 60;

    if (workedHours < 4) {
      return { status: "HLF", label: "Half Day" };
    }

    return { status: "P", label: "Present" };
  };

  const getTimeStatus = (inTime, outTime) => {
    if (!inTime || inTime === "-" || inTime === "nan") return null;

    const [inHour, inMin] = String(inTime).split(":").map(Number);
    const inMinutes = inHour * 60 + inMin;

    const lateThreshold = 9 * 60 + 20;

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
      const earlyThreshold = 18 * 60 + 50;

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
    if (!inTime || inTime === "-" || !outTime || outTime === "-" || inTime === "nan" || outTime === "nan") {
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

  // --- NEW: Prioritize "Period" Row for Correct Month ---
  const detectMonthsAndYear = (rows) => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    let detectedMonth = "";
    let detectedYear = "";

    // 1. Search for 'Period' row (Correct date)
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i];
        if(!Array.isArray(row)) continue;
        const rowStr = row.join(" ");
        
        // Only look if row has "Period" word
        if (rowStr.includes("Period")) {
            const periodMatch = rowStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
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

    // 2. Fallback: Take ANY date if Period not found (e.g. Run Date)
    if (!detectedMonth) {
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i];
            if(!Array.isArray(row)) continue;
            const rowStr = row.join(" ");
            const dateMatch = rowStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
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
        
        // Robust Employee ID Detection
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
            // Excel index matches day index (Col 1 = Day 1)
            const inTime = excelTimeToString(inRow[day]);
            const outTime = excelTimeToString(outRow[day]);
            const dayOfWeek = getDayOfWeek(day, selectedMonth, detectedYear);
            const weekOfMonth = getWeekOfMonth(day, selectedMonth, detectedYear);
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
        if(res.ok) {
            const data = await res.json();
            const formatted = data.map(f => `${f.month}-${f.year}`);
            setAvailableMonths(formatted);
            
            // Auto load first if available and no data
            if(data.length > 0 && employees.length === 0) {
                 loadMonthData(data[0].month, data[0].year);
            }
        }
    } catch (err) { console.error("Error fetching months", err); }
  };

  const loadMonthData = async (m, y) => {
    setIsLoadingDefault(true);
    try {
        const res = await fetch(`${API_URL}/attendance/get-data?month=${m}&year=${y}`);
        if(!res.ok) throw new Error("Data not found");
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

    // 1. Parse Locally
    const reader = new FileReader();
    reader.onload = async (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname], { header: 1 });
        
        const { selectedMonth, detectedYear } = detectMonthsAndYear(data);
        
        setMonth(selectedMonth);
        setYear(detectedYear);
        const result = parseFile(data, file.name, selectedMonth, detectedYear);

        // 2. Upload to Server
        if (result.success && result.count > 0) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('month', selectedMonth);
            formData.append('year', detectedYear);

            try {
                const res = await fetch(`${API_URL}/attendance/upload`, { method: 'POST', body: formData });
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
    if(!val) return;
    const [m, y] = val.split("-");
    loadMonthData(m, y);
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
    getStatusColor: (status) => {
      switch (status) {
        case "P": return "bg-green-100 text-green-800 border-green-300";
        case "A": return "bg-red-100 text-red-800 border-red-300";
        case "HLF": return "bg-yellow-100 text-yellow-800 border-yellow-300";
        default: return "bg-gray-100 text-gray-600 border-gray-300";
      }
    },
    getEmployeeStats: (employee) => {
      const stats = {
        totalPresent: 0,
        onTime: 0,
        halfDay: 0,
        absent: 0,
        late: 0,
        earlyLeave: 0,
        totalDays: month && year ? getDaysInMonth(month, year) : 0,
      };
      employee.attendance.forEach((record) => {
        switch (record.status) {
          case "P":
            stats.totalPresent++;
            if (!record.timeStatus?.late) stats.onTime++;
            break;
          case "A":
            stats.absent++;
            break;
          case "HLF":
            stats.halfDay++;
            stats.totalPresent++;
            break;
        }
        if (record.timeStatus) {
          if (record.timeStatus.late) stats.late++;
          if (record.timeStatus.early) stats.earlyLeave++;
        }
      });
      return stats;
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8 flex items-center justify-center">
        <div className="bg-white shadow-xl rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Loading Attendance Data...
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-xl rounded-2xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📅 Attendance Dashboard
          </h1>
          <p className="text-gray-600">
            Track employee attendance • Office: 9:00 AM - 7:00 PM • Late after
            9:20 AM • Early before 6:50 PM
          </p>
          {month && year && (
            <p className="text-sm text-blue-600 mt-2">
              Viewing: {month} {year}
            </p>
          )}
        </div>

        <div className="bg-white shadow-xl rounded-2xl p-6 mb-6 flex justify-between items-center">
          <label className="flex items-center cursor-pointer">
            <span className="text-sm text-gray-500 mr-2">
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
          <div className="bg-white shadow-xl rounded-2xl p-6 mb-6">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">
                  👥 Employees ({filteredEmployees.length})
                </h2>
                <input
                  type="text"
                  placeholder="Search employees by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {month && year && (
                <div className="text-sm text-gray-500">
                  Total Working Days: {getDaysInMonth(month, year)}
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Employee Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Total Present
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      On Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Half Day
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Absent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Late Arrivals
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Early Leaves
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentEmployees.map((emp) => {
                    const { getEmployeeStats } = useContext(AttendanceContext);
                    const stats = getEmployeeStats(emp);
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => handleEmployeeClick(emp)}
                        className="cursor-pointer hover:bg-gray-50 transition"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {emp.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {emp.id}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-600 font-semibold">
                          {stats.totalPresent}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600 font-semibold">
                          {stats.onTime}
                        </td>
                        <td className="px-4 py-3 text-sm text-yellow-600 font-semibold">
                          {stats.halfDay}
                        </td>
                        <td className="px-4 py-3 text-sm text-red-600 font-semibold">
                          {stats.absent}
                        </td>
                        <td className="px-4 py-3 text-sm text-orange-600 font-semibold">
                          {stats.late}
                        </td>
                        <td className="px-4 py-3 text-sm text-purple-600 font-semibold">
                          {stats.earlyLeave}
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
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white shadow-xl rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Data Yet
            </h3>
            <p className="text-gray-500">
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
    return <div>Employee not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white shadow-xl rounded-2xl p-4 h-[80vh] overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  👥 Select Employee
                </h3>
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="space-y-2">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`p-3 rounded-lg cursor-pointer transition ${
                      selectedEmployee?.id === emp.id
                        ? "bg-blue-100 border-2 border-blue-500"
                        : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                    }`}
                  >
                    <div className="font-semibold text-gray-800">
                      {emp.name}
                    </div>
                    <div className="text-xs text-gray-600">ID: {emp.id}</div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white shadow-xl rounded-2xl p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  Detailed Attendance
                </h2>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {selectedEmployee.name}
                </h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>
                    <span className="font-semibold">Employee ID:</span>{" "}
                    {selectedEmployee.id}
                  </div>
                  <div>
                    <span className="font-semibold">Designation:</span>{" "}
                    {selectedEmployee.designation}
                  </div>
                  <div>
                    <span className="font-semibold">Department:</span>{" "}
                    {selectedEmployee.department}
                  </div>
                  <div>
                    <span className="font-semibold">Month:</span> {month} {year}
                  </div>
                </div>
              </div>

              {(() => {
                const stats = getEmployeeStats(selectedEmployee);
                return (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                      Monthly Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="text-xs text-gray-600 mb-1">
                          Total Days Present (Full + Half)
                        </div>
                        <div className="text-xl font-bold text-green-600">
                          {stats.totalPresent} / {stats.totalDays}
                        </div>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-xs text-gray-600 mb-1">
                          On Time (Full Present)
                        </div>
                        <div className="text-xl font-bold text-blue-600">
                          {stats.onTime}
                        </div>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="text-xs text-gray-600 mb-1">
                          Half Days
                        </div>
                        <div className="text-xl font-bold text-yellow-600">
                          {stats.halfDay}
                        </div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <div className="text-xs text-gray-600 mb-1">Absent</div>
                        <div className="text-xl font-bold text-red-600">
                          {stats.absent}
                        </div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <div className="text-xs text-gray-600 mb-1">
                          Late Arrivals
                        </div>
                        <div className="text-xl font-bold text-orange-600">
                          {stats.late}
                        </div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-xs text-gray-600 mb-1">
                          Early Leaves
                        </div>
                        <div className="text-xl font-bold text-purple-600">
                          {stats.earlyLeave}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="mb-4 flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Present (on time & worked 4+ hrs)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Absent (no in-time)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Half Day (late/early/no out-time)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-semibold">
                    LATE
                  </div>
                  <span>After 9:20 AM</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                    EARLY
                  </div>
                  <span>Before 6:50 PM</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-3 bg-yellow-200 border border-yellow-400"></div>
                  <span>Sunday</span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                        Day
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                        In Time
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                        Out Time
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                        Hours
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedEmployee.attendance.map((record, idx) => (
                      <tr
                        key={idx}
                        className={`${
                          record.isSunday
                            ? "bg-yellow-50 hover:bg-yellow-50"
                            : "hover:bg-gray-50"
                        } transition`}
                      >
                        <td className="px-3 py-3 text-sm text-gray-800 font-medium">
                          {record.date}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              record.isSunday
                                ? "bg-yellow-200 text-yellow-800"
                                : "bg-blue-100 text-blue-700"
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
                                  ? "text-blue-600"
                                  : "text-gray-400"
                              }`}
                            >
                              {convertTo12Hour(record.inTime)}
                            </span>
                            {record.timeStatus?.late && (
                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-semibold w-fit">
                                Late by {record.timeStatus.late}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`font-semibold ${
                                record.outTime !== "-" && record.outTime !== "nan"
                                  ? "text-purple-600"
                                  : "text-gray-400"
                              }`}
                            >
                              {convertTo12Hour(record.outTime)}
                            </span>
                            {record.timeStatus?.early && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold w-fit">
                                Early by {record.timeStatus.early}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700 font-medium">
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

export default function AttendanceApp() {
  return (
    <AttendanceProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employee/:id" element={<Detail />} />
        </Routes>
      </Router>
    </AttendanceProvider>
  );
}
