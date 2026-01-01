import React, { useState } from "react";
import {
  FileSpreadsheet,
  Play,
  Download,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

const DMSNames = ({ theme }) => {
  const [inputFile, setInputFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [processedData, setProcessedData] = useState(null);

  const isDark = theme === "dark";

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setInputFile(file);
      setResult(null);
      setProcessedData(null);
    }
  };

  const processFile = async () => {
    if (!inputFile) {
      setResult({ type: "error", message: "Please upload an Excel file" });
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          if (jsonData.length < 2) {
            throw new Error("Excel sheet is empty or invalid.");
          }

          // ─────────────────────────────────────────────
          // FIND REAL HEADER ROW (skip junk rows)
          // ─────────────────────────────────────────────
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
            throw new Error(
              "Could not find header row (Date / Particulars / Debit)."
            );
          }

          const header = jsonData[headerRowIndex];

          // Detect columns
          const dateCol = header.findIndex((h) => /date/i.test(h));
          const nameCol = header.findIndex((h) => /particular/i.test(h));
          const debitCol = header.findIndex((h) => /debit/i.test(h));

          if (dateCol === -1 || nameCol === -1 || debitCol === -1) {
            throw new Error(
              "Found header row but could not detect Date / Particulars / Debit columns."
            );
          }

          // ─────────────────────────────────────────────
          // Excel serial date → YYYY-MM-DD
          // ─────────────────────────────────────────────
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

          let cleanedCount = 0;
          const cleanedData = [["Date", "Name", "Debit"]];

          jsonData.slice(headerRowIndex + 1).forEach((row) => {
            if (!row || row.length === 0) return;

            const rawDate = row[dateCol];
            const rawName = row[nameCol] || "";
            const rawDebit = row[debitCol] || "";

            if (!rawName) return;

            // Convert date if needed
            const finalDate =
              typeof rawDate === "number"
                ? excelDateToString(rawDate)
                : rawDate;

            // Clean name: remove (12345)
            const cleanedName = rawName
              .toString()
              .replace(/\(\d+\)/g, "")
              .trim();

            if (cleanedName !== rawName) cleanedCount++;

            cleanedData.push([finalDate, cleanedName, rawDebit]);
          });

          const newSheet = XLSX.utils.aoa_to_sheet(cleanedData);
          const newWorkbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Cleaned");

          setProcessedData(newWorkbook);
          setResult({
            type: "success",
            message: `Successfully processed ${cleanedCount} name entries`,
            details: { cleanedCount, totalRows: cleanedData.length - 1 },
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

      reader.onerror = () => {
        setResult({ type: "error", message: "Error reading file" });
        setProcessing(false);
      };

      reader.readAsArrayBuffer(inputFile);
    } catch (error) {
      setResult({ type: "error", message: `Error: ${error.message}` });
      setProcessing(false);
    }
  };

  const downloadFile = () => {
    if (!processedData) return;
    const fileName = "cleaned_date_name_debit.xlsx";
    XLSX.writeFile(processedData, fileName);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1
          className={`text-4xl font-bold mb-2 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          DMS Date + Name + Debit Extractor
        </h1>
        <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Extract valid Date, cleaned Name (without numbers), and Debit amount.
        </p>
      </div>

      <div
        className={`rounded-2xl shadow-2xl p-8 ${
          isDark ? "bg-gray-800/50 backdrop-blur-sm" : "bg-white"
        }`}
      >
        {/* File Upload */}
        <div className="mb-6">
          <label
            className={`block text-sm font-semibold mb-3 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Upload Excel File
          </label>

          <div
            className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
              inputFile
                ? isDark
                  ? "border-green-500 bg-green-500/10"
                  : "border-green-500 bg-green-50"
                : isDark
                ? "border-gray-600 hover:border-gray-500"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="flex flex-col items-center">
              <FileSpreadsheet
                className={
                  inputFile
                    ? "text-green-500"
                    : isDark
                    ? "text-gray-400"
                    : "text-gray-500"
                }
                size={48}
              />

              <p
                className={`mt-3 text-lg font-medium ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                {inputFile ? inputFile.name : "Click to upload Excel file"}
              </p>

              {/* Example text */}
              <p
                className={`mt-1 text-sm ${
                  isDark ? "text-gray-500" : "text-gray-600"
                }`}
              >
                Example: "HARISH K(1651651)" will become "HARISH K"
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={processFile}
            disabled={processing || !inputFile}
            className={`flex-1 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 ${
              isDark
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
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
                  <Play size={20} />
                  Process File
                </>
              )}
            </div>
          </button>

          <button
            onClick={downloadFile}
            disabled={!processedData}
            className={`px-8 py-4 rounded-xl font-semibold transition-all hover:scale-105 disabled:opacity-50 ${
              isDark
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            } shadow-lg`}
          >
            <div className="flex items-center gap-2">
              <Download size={20} />
              Download
            </div>
          </button>
        </div>

        {/* Result Display */}
        {result && (
          <div
            className={`p-6 rounded-xl ${
              result.type === "success"
                ? isDark
                  ? "bg-green-900/30 border border-green-700"
                  : "bg-green-50 border border-green-200"
                : isDark
                ? "bg-red-900/30 border border-red-700"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {result.type === "success" ? (
                <CheckCircle className="text-green-500" size={24} />
              ) : (
                <AlertCircle className="text-red-500" size={24} />
              )}

              <div>
                <p
                  className={`font-semibold ${
                    result.type === "success"
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {result.message}
                </p>

                {result.details && (
                  <>
                    <p className="text-sm mt-1">
                      Total rows: {result.details.totalRows}
                    </p>
                    <p className="text-sm">
                      Names cleaned: {result.details.cleanedCount}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DMSNames;
