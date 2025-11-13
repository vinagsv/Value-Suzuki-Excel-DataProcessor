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

          let cleanedCount = 0;
          const cleanedData = jsonData.map((row) => {
            return row.map((cell) => {
              if (cell && typeof cell === "string") {
                const cleaned = cell.replace(/\(\d+\)/g, "").trim();
                if (cleaned !== cell) cleanedCount++;
                return cleaned;
              }
              return cell;
            });
          });

          const newSheet = XLSX.utils.aoa_to_sheet(cleanedData);
          const newWorkbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);

          setProcessedData(newWorkbook);
          setResult({
            type: "success",
            message: `Successfully cleaned ${cleanedCount} name entries`,
            details: { cleanedCount, totalRows: jsonData.length - 1 },
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
    const fileName = "names_without_numbers.xlsx";
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
          DMS Names Cleaner
        </h1>
        <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Remove numbers from customer names for Tally entry
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
            Excel File with Names
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
              <p
                className={`mt-1 text-sm ${
                  isDark ? "text-gray-500" : "text-gray-500"
                }`}
              >
                Names like "HARISH K(123456)" will become "HARISH K"
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={processFile}
            disabled={processing || !inputFile}
            className={`flex-1 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              isDark
                ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
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
            className={`px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
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
                <CheckCircle
                  className="text-green-500 flex-shrink-0"
                  size={24}
                />
              ) : (
                <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
              )}
              <div>
                <p
                  className={`font-semibold ${
                    result.type === "success"
                      ? "text-green-700"
                      : "text-red-700"
                  } ${isDark && "brightness-150"}`}
                >
                  {result.message}
                </p>
                {result.details && (
                  <div
                    className={`mt-2 text-sm ${
                      isDark ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    <p>Total rows: {result.details.totalRows}</p>
                    <p>Names cleaned: {result.details.cleanedCount}</p>
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

export default DMSNames;
