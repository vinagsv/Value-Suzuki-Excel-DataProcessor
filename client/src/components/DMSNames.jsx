import React, { useState } from "react";
import {
  FileSpreadsheet,
  Play,
  Download,
  CheckCircle,
  AlertCircle,
  UploadCloud,
  FileText
} from "lucide-react";
import * as XLSX from "xlsx";

const DMSNames = ({ theme }) => {
  const [inputFile, setInputFile] = useState(null);
  const [form22File, setForm22File] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [processedData, setProcessedData] = useState(null);

  const isDark = theme === "dark";

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === "main") setInputFile(file);
      if (type === "form22") setForm22File(file);
      setResult(null);
      setProcessedData(null);
    }
  };

  const readExcel = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          resolve(workbook);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const processFile = async () => {
    if (!inputFile) {
      setResult({ type: "error", message: "Please upload the main DMS Excel file." });
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      // ─────────────────────────────────────────────
      // PARSE FORM 22 FILE (IF PROVIDED)
      // ─────────────────────────────────────────────
      let chassisMap = new Map();
      if (form22File) {
        const f22Wb = await readExcel(form22File);
        const f22Sheet = f22Wb.Sheets[f22Wb.SheetNames[0]];
        const f22Data = XLSX.utils.sheet_to_json(f22Sheet, { header: 1 });

        let f22HeaderIdx = -1;
        for (let i = 0; i < f22Data.length; i++) {
          const rowStr = (f22Data[i] || []).join(" ").toLowerCase();
          // Relaxed header matching to handle variations like "CHASSIS NO", "CHASSIS NUMBER", etc.
          if (rowStr.includes("chassis") && rowStr.includes("customer")) {
            f22HeaderIdx = i;
            break;
          }
        }

        if (f22HeaderIdx !== -1) {
          const f22Headers = f22Data[f22HeaderIdx].map((h) =>
            (h || "").toString().toLowerCase().trim()
          );
          const chasCol = f22Headers.findIndex((h) => h.includes("chassis"));
          const custCol = f22Headers.findIndex((h) => h.includes("customer"));

          if (chasCol !== -1 && custCol !== -1) {
            for (let i = f22HeaderIdx + 1; i < f22Data.length; i++) {
              const row = f22Data[i];
              if (!row) continue;
              const cNo = (row[chasCol] || "").toString().trim().toUpperCase();
              const cName = (row[custCol] || "").toString().trim();
              
              if (cNo) {
                chassisMap.set(cNo, cName);
                // Commonly, chassis numbers might just match the last 7 alphanumeric characters
                if (cNo.length > 7) {
                  chassisMap.set(cNo.slice(-7), cName);
                }
              }
            }
          }
        }
      }

      // ─────────────────────────────────────────────
      // PARSE MAIN INPUT FILE
      // ─────────────────────────────────────────────
      const inWb = await readExcel(inputFile);
      const sheetName = inWb.SheetNames[0];
      const sheet = inWb.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error("Excel sheet is empty or invalid.");
      }

      // FIND REAL HEADER ROW (skip junk rows)
      let headerRowIndex = -1;
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row) continue;

        const rowString = row.join(" ").toLowerCase();

        if (
          rowString.includes("date") &&
          rowString.includes("particular") &&
          rowString.includes("debit")
        ) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error("Could not find header row (Date / Particulars / Debit).");
      }

      const header = jsonData[headerRowIndex];
      const dateCol = header.findIndex((h) => /date/i.test(h));
      const nameCol = header.findIndex((h) => /particular/i.test(h));
      const debitCol = header.findIndex((h) => /debit/i.test(h));

      if (dateCol === -1 || nameCol === -1 || debitCol === -1) {
        throw new Error(
          "Found header row but could not detect Date / Particulars / Debit columns."
        );
      }

      // Excel serial date → YYYY-MM-DD
      const excelDateToString = (serial) => {
        if (!serial || isNaN(serial)) return serial;
        const utcDays = Math.floor(serial - 25569);
        const utcValue = utcDays * 86400;
        const dateInfo = new Date(utcValue * 1000);
        const year = dateInfo.getUTCFullYear();
        const month = String(dateInfo.getUTCMonth() + 1).padStart(2, "0");
        const day = String(dateInfo.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const outHeaders = ["Date", "Name", "Debit"];
      if (form22File) outHeaders.push("Form 22 Name");

      const cleanedData = [outHeaders];
      let cleanedCount = 0;
      let currentRow = null;
      let lastDate = null;

      const pushCurrentRow = () => {
        if (!currentRow) return;

        // Insert a completely empty row when the date changes
        if (lastDate !== null && lastDate !== currentRow.date) {
          cleanedData.push([]);
        }
        lastDate = currentRow.date;

        const rowToPush = [currentRow.date, currentRow.name, currentRow.debit];
        if (form22File) {
          rowToPush.push(currentRow.form22Name || "");
        }
        cleanedData.push(rowToPush);
      };

      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const rawDate = row[dateCol];
        const rawName = row[nameCol];
        const rawDebit = row[debitCol];

        if (rawDate) {
          // Push previous row if exists
          pushCurrentRow();

          // Convert date if needed
          const finalDate =
            typeof rawDate === "number"
              ? excelDateToString(rawDate)
              : String(rawDate).trim();

          const originalName = String(rawName || "");
          const cleanedName = originalName.replace(/\(\d+\)/g, "").trim();

          if (cleanedName !== originalName) cleanedCount++;

          currentRow = {
            date: finalDate,
            name: cleanedName,
            debit: rawDebit !== undefined ? rawDebit : "",
            form22Name: "",
          };
        } else if (currentRow && rawName && typeof rawName === "string") {
          // This row might contain the chassis string for the current transaction
          if (form22File) {
            let matchedName = "";
            const searchStr = rawName.toUpperCase();
            
            // Fast lookup by splitting the rawName string by commas or spaces
            const parts = searchStr.split(/[\s,]+/);
            for (const part of parts) {
               const cleanPart = part.trim();
               if (cleanPart.length > 5 && chassisMap.has(cleanPart)) {
                  matchedName = chassisMap.get(cleanPart);
                  break;
               }
            }

            // Fallback to searching inside the entire string if parts didn't strictly match
            if (!matchedName) {
                for (let [chassis, f22Name] of chassisMap.entries()) {
                if (chassis.length > 5 && searchStr.includes(chassis)) {
                    matchedName = f22Name;
                    break;
                }
                }
            }

            if (matchedName) {
              currentRow.form22Name = matchedName;
            }
          }
        }
      }

      // Push the very last row
      pushCurrentRow();

      const newSheet = XLSX.utils.aoa_to_sheet(cleanedData);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Cleaned");

      setProcessedData(newWorkbook);
      setResult({
        type: "success",
        message: `Successfully processed ${cleanedCount} name entries`,
        details: { cleanedCount, totalRows: cleanedData.length - 1 }, // subtract header
      });
    } catch (error) {
      setResult({
        type: "error",
        message: `Error processing file: ${error.message}`,
      });
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = () => {
    if (!processedData) return;
    const fileName = "cleaned_date_name_debit.xlsx";
    XLSX.writeFile(processedData, fileName);
  };

  return (
    <div className={`min-h-screen py-12 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="mb-10 text-Left">
           <h1 className={`text-4xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
              DMS Names Cleaner & Form 22 Matcher
        </h1>
          <p className={`text-lg  mx-auto ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Extract valid Dates, clean Names, Debit amounts, and automatically match Form 22 names using Chassis Numbers.
          </p>
        </div>

        <div
          className={`rounded-3xl shadow-xl p-6 md:p-10 border ${
            isDark 
              ? "bg-gray-800 border-gray-700" 
              : "bg-white border-gray-100"
          }`}
        >
          {/* File Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            {/* Main DMS File */}
            <div className="flex flex-col">
              <label
                className={`flex items-center gap-2 text-sm font-bold mb-3 ${
                  isDark ? "text-gray-200" : "text-gray-800"
                }`}
              >
                <FileText size={18} className="text-blue-500"/>
                Upload DMS Excel File <span className="text-red-500">*</span>
              </label>

              <div
                className={`relative flex-1 border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ease-in-out ${
                  inputFile
                    ? isDark
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-blue-500 bg-blue-50"
                    : isDark
                    ? "border-gray-600 hover:border-gray-500 hover:bg-gray-700/50"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleFileUpload(e, "main")}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <UploadCloud
                    className={`mb-4 transition-transform duration-300 ${
                      inputFile
                        ? "text-blue-500 scale-110"
                        : isDark
                        ? "text-gray-400"
                        : "text-gray-400"
                    }`}
                    size={48}
                  />
                  <p
                    className={`text-lg font-semibold px-2 ${
                      isDark ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    {inputFile ? inputFile.name : "Choose Main File"}
                  </p>
                  <p
                    className={`mt-2 text-sm ${
                      isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Contains transactions & names
                  </p>
                </div>
              </div>
            </div>

            {/* Form 22 File */}
            <div className="flex flex-col">
              <label
                className={`flex items-center gap-2 text-sm font-bold mb-3 ${
                  isDark ? "text-gray-200" : "text-gray-800"
                }`}
              >
                <FileSpreadsheet size={18} className="text-purple-500"/>
                Upload Form 22 Excel File <span className="text-gray-400 font-normal">(Optional)</span>
              </label>

              <div
                className={`relative flex-1 border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ease-in-out ${
                  form22File
                    ? isDark
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-purple-500 bg-purple-50"
                    : isDark
                    ? "border-gray-600 hover:border-gray-500 hover:bg-gray-700/50"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleFileUpload(e, "form22")}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <UploadCloud
                    className={`mb-4 transition-transform duration-300 ${
                      form22File
                        ? "text-purple-500 scale-110"
                        : isDark
                        ? "text-gray-400"
                        : "text-gray-400"
                    }`}
                    size={48}
                  />
                  <p
                    className={`text-lg font-semibold px-2 ${
                      isDark ? "text-gray-200" : "text-gray-800"
                    }`}
                  >
                    {form22File ? form22File.name : "Choose Form 22 File"}
                  </p>
                  <p
                    className={`mt-2 text-sm ${
                      isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    For fetching names via chassis #
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <button
              onClick={processFile}
              disabled={processing || !inputFile}
              className={`flex-1 py-4 px-6 rounded-2xl font-bold text-lg transition-all transform active:scale-95 disabled:opacity-60 disabled:transform-none disabled:cursor-not-allowed ${
                isDark
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20"
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    Processing Files...
                  </>
                ) : (
                  <>
                    <Play size={24} />
                    Process & Clean Data
                  </>
                )}
              </div>
            </button>

            <button
              onClick={downloadFile}
              disabled={!processedData}
              className={`sm:w-1/3 py-4 px-6 rounded-2xl font-bold text-lg transition-all transform active:scale-95 disabled:opacity-60 disabled:transform-none disabled:cursor-not-allowed ${
                isDark
                  ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
                  : "bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20"
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <Download size={24} />
                Download Result
              </div>
            </button>
          </div>

          {/* Result Display */}
          {result && (
            <div
              className={`p-6 rounded-2xl animate-fade-in ${
                result.type === "success"
                  ? isDark
                    ? "bg-green-900/20 border border-green-800/50"
                    : "bg-green-50 border border-green-200"
                  : isDark
                  ? "bg-red-900/20 border border-red-800/50"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-start gap-4">
                {result.type === "success" ? (
                  <CheckCircle className="text-green-500 flex-shrink-0 mt-1" size={28} />
                ) : (
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={28} />
                )}

                <div>
                  <h3
                    className={`text-lg font-bold mb-1 ${
                      result.type === "success"
                        ? isDark ? "text-green-400" : "text-green-800"
                        : isDark ? "text-red-400" : "text-red-800"
                    }`}
                  >
                    {result.type === "success" ? "Processing Complete!" : "Processing Error"}
                  </h3>
                  <p
                    className={`${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {result.message}
                  </p>

                  {result.details && (
                    <div className={`mt-3 pt-3 border-t ${isDark ? "border-green-800/50" : "border-green-200"}`}>
                      <ul className={`text-sm space-y-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        <li className="flex justify-between w-48">
                          <span>Total rows exported:</span>
                          <span className="font-semibold">{result.details.totalRows}</span>
                        </li>
                        <li className="flex justify-between w-48">
                          <span>Names cleaned:</span>
                          <span className="font-semibold">{result.details.cleanedCount}</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DMSNames;