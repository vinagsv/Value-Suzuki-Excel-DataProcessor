import React, { useState } from "react";
import {
  FileSpreadsheet,
  Play,
  CheckCircle,
  AlertCircle,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";

const InsuranceProcessor = ({ theme }) => {
  const [form22File, setForm22File] = useState(null);
  const [insuranceFile, setInsuranceFile] = useState(null);
  const [outputName, setOutputName] = useState("INSURANCE_UPDATED.xlsx");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [processedData, setProcessedData] = useState(null);

  const isDark = theme === "dark";

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === "form22") {
        setForm22File(file);
      } else {
        setInsuranceFile(file);
      }
      setResult(null);
      setProcessedData(null);
    }
  };

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          // Use header: 1 to get an array of arrays, preserving columns exactly
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const processFiles = async () => {
    if (!form22File || !insuranceFile) {
      setResult({ type: "error", message: "Please upload both files" });
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      // 1. Parse Form 22 and create a lookup array
      const form22Data = await readExcelFile(form22File);
      const form22List = [];
      const headers22 = form22Data[0] || [];
      
      const chassisCol22 = headers22.findIndex(h => h && h.toString().toUpperCase().includes('CHASSIS'));
      const nameCol22 = headers22.findIndex(h => h && h.toString().toUpperCase().includes('CUSTOMER NAME'));

      if (chassisCol22 !== -1 && nameCol22 !== -1) {
        for (let i = 1; i < form22Data.length; i++) {
          const row = form22Data[i];
          if (row && row[chassisCol22]) {
            form22List.push({
              chassis: row[chassisCol22].toString().replace(/\s+/g, '').toUpperCase(),
              name: row[nameCol22] ? row[nameCol22].toString().trim() : ''
            });
          }
        }
      } else {
        throw new Error("Could not find 'CHASSIS NO' or 'CUSTOMER NAME' in Form 22 header.");
      }

      // 2. Parse Insurance File
      const insuranceData = await readExcelFile(insuranceFile);
      const outputData = [];

      // Add a clean header row at the top
      outputData.push([
        "Serial Number",
        "Date",
        "Chassis Number",
        "Name (From Form 22)",
        "Amount",
        "Insurance Name (Original)",
        "Remarks / Extra Fields"
      ]);

      let currentDate = null;
      let updatedRows = 0;
      let totalValidRows = 0;

      for (let i = 0; i < insuranceData.length; i++) {
        const row = insuranceData[i];
        if (!row || row.length === 0) continue;

        // Based on structure: 0:Serial, 1:Date, 2:Chassis, 3:Name, 4:Amount
        const serial = row[0];
        const rawDate = row[1];
        const chassis = row[2];
        const originalName = row[3];
        const amount = row[4];

        // Format Date string
        let dateStr = "";
        if (rawDate !== undefined && rawDate !== null) {
          if (typeof rawDate === 'number') {
            const parsedDate = XLSX.SSF.parse_date_code(rawDate);
            dateStr = `${parsedDate.y}-${String(parsedDate.m).padStart(2, '0')}-${String(parsedDate.d).padStart(2, '0')}`;
          } else {
            dateStr = rawDate.toString().trim();
          }
        }

        // Determine if it's a valid data row (has serial number, date, and chassis)
        const isDataRow = chassis && dateStr && !isNaN(parseInt(serial));

        if (isDataRow) {
          totalValidRows++;
          
          // Insert empty row if date changes
          if (currentDate !== null && currentDate !== dateStr) {
            outputData.push([]);
          }
          currentDate = dateStr;

          const cleanChassis = chassis.toString().replace(/\s+/g, '').toUpperCase();
          
          // Find matching chassis in Form 22 (using endsWith to catch last 5-7 digits)
          const match = form22List.find(f => f.chassis.endsWith(cleanChassis));
          const fetchedName = match ? match.name : "";
          if (match) updatedRows++;

          // Construct new organized row
          const outRow = [
            serial,
            dateStr,
            chassis,
            fetchedName,
            amount,
            originalName
          ];

          // Append any extra fields from column 5 onwards
          for (let c = 5; c < row.length; c++) {
            outRow.push(row[c] !== undefined ? row[c] : "");
          }
          outputData.push(outRow);

        } else {
          // Invalid entry / Header / Blank - Keep exactly as is
          const newRow = [];
          for (let c = 0; c < row.length; c++) {
            newRow.push(row[c] !== undefined ? row[c] : "");
          }
          outputData.push(newRow);
        }
      }

      // 3. Create new workbook and sheet
      const newSheet = XLSX.utils.aoa_to_sheet(outputData);
      
      // Auto-size columns slightly for better visibility
      newSheet['!cols'] = [
        { wch: 15 }, // Serial
        { wch: 15 }, // Date
        { wch: 20 }, // Chassis
        { wch: 30 }, // Form 22 Name
        { wch: 15 }, // Amount
        { wch: 30 }, // Original Name
        { wch: 40 }, // Extra
      ];

      const outputWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(outputWorkbook, newSheet, "Insurance Data");

      setProcessedData(outputWorkbook);
      setResult({
        type: "success",
        message: `Successfully mapped ${updatedRows} names out of ${totalValidRows} valid entries.`,
        details: { totalValidRows, updatedRows },
      });
    } catch (error) {
      setResult({ type: "error", message: `Error: ${error.message}` });
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = () => {
    if (!processedData) return;
    const fileName = outputName.endsWith(".xlsx") ? outputName : `${outputName}.xlsx`;
    XLSX.writeFile(processedData, fileName);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className={`text-4xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
          Insurance Data Processor
        </h1>
        <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Match Insurance exports with FORM22 to fetch exact customer names.
        </p>
      </div>

      <div className={`rounded-2xl shadow-2xl p-8 ${isDark ? "bg-gray-800/50 backdrop-blur-sm" : "bg-white"}`}>
        
        {/* File Uploads */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* FORM 22 SECTION */}
          <div>
            <label className={`block text-sm font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              FORM22 File (Source of Names)
            </label>
            <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
                form22File ? (isDark ? "border-green-500 bg-green-500/10" : "border-green-500 bg-green-50") : (isDark ? "border-gray-600 hover:border-gray-500" : "border-gray-300 hover:border-gray-400")
              }`}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileUpload(e, "form22")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <FileSpreadsheet className={form22File ? "text-green-500" : (isDark ? "text-gray-400" : "text-gray-500")} size={32} />
                <p className={`mt-2 text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  {form22File ? form22File.name : "Click to upload Form22"}
                </p>
              </div>
            </div>
          </div>

          {/* INSURANCE SECTION */}
          <div>
            <label className={`block text-sm font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Insurance File (Data to Update)
            </label>
            <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
                insuranceFile ? (isDark ? "border-green-500 bg-green-500/10" : "border-green-500 bg-green-50") : (isDark ? "border-gray-600 hover:border-gray-500" : "border-gray-300 hover:border-gray-400")
              }`}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileUpload(e, "insurance")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <FileSpreadsheet className={insuranceFile ? "text-green-500" : (isDark ? "text-gray-400" : "text-gray-500")} size={32} />
                <p className={`mt-2 text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  {insuranceFile ? insuranceFile.name : "Click to upload Insurance"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Output File Name */}
        <div className="mb-6">
          <label className={`block text-sm font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Output File Name
          </label>
          <input
            type="text"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl transition-all ${isDark ? "bg-gray-700 text-white border-gray-600" : "bg-gray-50 text-gray-900 border-gray-300"} border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={processFiles}
            disabled={processing || !form22File || !insuranceFile}
            className={`flex-1 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              isDark ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white" : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            } shadow-lg`}
          >
            <div className="flex items-center justify-center gap-2">
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Play size={20} /> Process Files
                </>
              )}
            </div>
          </button>

          <button
            onClick={downloadFile}
            disabled={!processedData}
            className={`px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              isDark ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-500 hover:bg-green-600 text-white"
            } shadow-lg`}
          >
            <div className="flex items-center gap-2">
              <Download size={20} /> Download
            </div>
          </button>
        </div>

        {/* Result Display */}
        {result && (
          <div className={`p-6 rounded-xl ${result.type === "success" ? (isDark ? "bg-green-900/30 border border-green-700" : "bg-green-50 border border-green-200") : (isDark ? "bg-red-900/30 border border-red-700" : "bg-red-50 border border-red-200")}`}>
            <div className="flex items-start gap-3">
              {result.type === "success" ? (
                <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
              ) : (
                <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
              )}
              <div>
                <p className={`font-semibold ${result.type === "success" ? "text-green-700" : "text-red-700"} ${isDark && "brightness-150"}`}>
                  {result.message}
                </p>
                {result.details && (
                  <div className={`mt-2 text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    <p>Total valid data rows: {result.details.totalValidRows}</p>
                    <p>Rows successfully mapped with names: {result.details.updatedRows}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsuranceProcessor;