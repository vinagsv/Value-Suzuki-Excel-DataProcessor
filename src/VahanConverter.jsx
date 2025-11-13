import React, { useState } from "react";
import {
  FileSpreadsheet,
  Play,
  CheckCircle,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import * as XLSX from "xlsx";

const VahanConverter = ({ theme }) => {
  const [form22File, setForm22File] = useState(null);
  const [vahanFile, setVahanFile] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [outputName, setOutputName] = useState("VAHAN_UPDATED.xlsx");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vahanSheetName, setVahanSheetName] = useState("");
  const [form22SheetName, setForm22SheetName] = useState("");

  const isDark = theme === "dark";

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === "form22") setForm22File(file);
      else setVahanFile(file);
    }
  };

  const processFiles = async () => {
    if (!form22File || !vahanFile) {
      setResult({ type: "error", message: "Please upload both files" });
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const form22Data = await readExcelFile(form22File, form22SheetName);
      const chassisToName = {};

      for (const row of form22Data) {
        if (row["CHASSIS NO"]) {
          const chassis = row["CHASSIS NO"]
            .toString()
            .replace(/\s+/g, "")
            .toUpperCase()
            .trim();
          const name = (row["CUSTOMER NAME"] || "").toString().trim();
          if (chassis && name) {
            chassisToName[chassis] = name;
          }
        }
      }

      const vahanWorkbook = await readExcelFileRaw(vahanFile);
      const targetSheetName = vahanSheetName || vahanWorkbook.SheetNames[0];

      if (!vahanWorkbook.Sheets[targetSheetName]) {
        throw new Error(`Sheet "${targetSheetName}" not found in VAHAN file`);
      }

      const vahanSheet = vahanWorkbook.Sheets[targetSheetName];
      const vahanData = XLSX.utils.sheet_to_json(vahanSheet, {
        header: 1,
        raw: false,
        dateNF: "yyyy-mm-dd",
      });

      let filteredData = vahanData;
      let dateFilterApplied = false;

      if (startDate || endDate) {
        const filterResult = filterByDate(vahanData, startDate, endDate);
        filteredData = filterResult.data;
        dateFilterApplied = filterResult.filtered;
      }

      let totalRows = 0;
      let updatedRows = 0;

      for (let i = 1; i < filteredData.length; i++) {
        const row = filteredData[i];
        if (!row || !row[6]) continue;

        const chassis = row[6]
          .toString()
          .replace(/\s+/g, "")
          .toUpperCase()
          .trim();
        if (chassis) {
          totalRows++;
          if (chassisToName[chassis]) {
            row[12] = chassisToName[chassis];
            updatedRows++;
          }
        }
      }

      const updatedSheet = XLSX.utils.aoa_to_sheet(filteredData);
      const outputWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        outputWorkbook,
        updatedSheet,
        targetSheetName
      );

      setProcessedData(outputWorkbook);
      setResult({
        type: "success",
        message: `Successfully updated ${updatedRows} out of ${totalRows} entries${
          dateFilterApplied ? " (date filter applied)" : ""
        }`,
        details: { totalRows, updatedRows, dateFilterApplied },
      });
    } catch (error) {
      setResult({ type: "error", message: `Error: ${error.message}` });
    } finally {
      setProcessing(false);
    }
  };

  const readExcelFile = (file, sheetName = "") => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const targetSheet = sheetName || workbook.SheetNames[0];

          if (!workbook.Sheets[targetSheet]) {
            reject(new Error(`Sheet "${targetSheet}" not found in file`));
            return;
          }

          const sheet = workbook.Sheets[targetSheet];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const readExcelFileRaw = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          resolve(workbook);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const filterByDate = (data, start, end) => {
    if (!start && !end) return { data, filtered: false };

    const headerRow = data[0];
    let dateColIndex = -1;

    // Find date column (common names: Date, DATE, Reg Date, Registration Date, etc.)
    for (let i = 0; i < headerRow.length; i++) {
      const header = (headerRow[i] || "").toString().toLowerCase();
      if (header.includes("date") || header.includes("dt")) {
        dateColIndex = i;
        break;
      }
    }

    if (dateColIndex === -1) {
      console.warn("No date column found, skipping date filter");
      return { data, filtered: false };
    }

    const startTime = start ? new Date(start).getTime() : 0;
    const endTime = end ? new Date(end).getTime() : Infinity;

    const filteredData = [headerRow]; // Keep header

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[dateColIndex]) {
        filteredData.push(row);
        continue;
      }

      const dateStr = row[dateColIndex].toString();
      const rowDate = parseDate(dateStr);

      if (rowDate && rowDate >= startTime && rowDate <= endTime) {
        filteredData.push(row);
      }
    }

    return { data: filteredData, filtered: true };
  };

  const parseDate = (dateStr) => {
    // Try multiple date formats
    const formats = [
      // ISO format
      /^(\d{4})-(\d{2})-(\d{2})/,
      // DD/MM/YYYY or DD-MM-YYYY
      /^(\d{2})[/-](\d{2})[/-](\d{4})/,
      // MM/DD/YYYY or MM-DD-YYYY
      /^(\d{2})[/-](\d{2})[/-](\d{4})/,
    ];

    // Try direct parsing first
    const direct = new Date(dateStr);
    if (!isNaN(direct.getTime())) {
      return direct.getTime();
    }

    // Try DD/MM/YYYY format (common in India)
    const match = dateStr.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }

    return null;
  };

  const downloadFile = () => {
    if (!processedData) return;
    const fileName = outputName.endsWith(".xlsx")
      ? outputName
      : `${outputName}.xlsx`;
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
          VAHAN Data Processor
        </h1>
        <p className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Match and update VAHAN data with FORM22 records
        </p>
      </div>

      <div
        className={`rounded-2xl shadow-2xl p-8 ${
          isDark ? "bg-gray-800/50 backdrop-blur-sm" : "bg-white"
        }`}
      >
        {/* File Uploads */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label
              className={`block text-sm font-semibold mb-3 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              FORM22 File
            </label>
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
                form22File
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
                onChange={(e) => handleFileUpload(e, "form22")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <FileSpreadsheet
                  className={
                    form22File
                      ? "text-green-500"
                      : isDark
                      ? "text-gray-400"
                      : "text-gray-500"
                  }
                  size={32}
                />
                <p
                  className={`mt-2 text-sm ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {form22File ? form22File.name : "Click to upload"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label
              className={`block text-sm font-semibold mb-3 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              VAHAN File
            </label>
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
                vahanFile
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
                onChange={(e) => handleFileUpload(e, "vahan")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <FileSpreadsheet
                  className={
                    vahanFile
                      ? "text-green-500"
                      : isDark
                      ? "text-gray-400"
                      : "text-gray-500"
                  }
                  size={32}
                />
                <p
                  className={`mt-2 text-sm ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {vahanFile ? vahanFile.name : "Click to upload"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`w-full mb-4 py-3 px-4 rounded-xl flex items-center justify-between transition-all ${
            isDark
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <span className="font-semibold">Advanced Settings</span>
          {showAdvanced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>

        {/* Advanced Settings Content */}
        {showAdvanced && (
          <div className="mb-6 space-y-6">
            {/* Sheet Names */}
            <div>
              <label
                className={`block text-sm font-semibold mb-3 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Sheet Names (Optional - leave empty for first sheet)
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    value={form22SheetName}
                    onChange={(e) => setForm22SheetName(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl transition-all ${
                      isDark
                        ? "bg-gray-700 text-white border-gray-600"
                        : "bg-gray-50 text-gray-900 border-gray-300"
                    } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                    placeholder="FORM22 Sheet Name"
                  />
                  <p
                    className={`text-xs mt-1 ${
                      isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    e.g., "Sheet1" or "Form22Data"
                  </p>
                </div>
                <div>
                  <input
                    type="text"
                    value={vahanSheetName}
                    onChange={(e) => setVahanSheetName(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl transition-all ${
                      isDark
                        ? "bg-gray-700 text-white border-gray-600"
                        : "bg-gray-50 text-gray-900 border-gray-300"
                    } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                    placeholder="VAHAN Sheet Name"
                  />
                  <p
                    className={`text-xs mt-1 ${
                      isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    e.g., "Sheet1" or "VahanData"
                  </p>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label
                className={`block text-sm font-semibold mb-3 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Date Range (Optional - leave empty to process all)
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`px-4 py-3 rounded-xl transition-all ${
                    isDark
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-gray-50 text-gray-900 border-gray-300"
                  } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                  placeholder="Start Date"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`px-4 py-3 rounded-xl transition-all ${
                    isDark
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-gray-50 text-gray-900 border-gray-300"
                  } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                  placeholder="End Date"
                />
              </div>
            </div>

            {/* Output File Name */}
            <div>
              <label
                className={`block text-sm font-semibold mb-3 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Output File Name
              </label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl transition-all ${
                  isDark
                    ? "bg-gray-700 text-white border-gray-600"
                    : "bg-gray-50 text-gray-900 border-gray-300"
                } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={processFiles}
            disabled={processing || !form22File || !vahanFile}
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
                  Process Files
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
                    <p>Total rows processed: {result.details.totalRows}</p>
                    <p>Rows updated: {result.details.updatedRows}</p>
                    {result.details.dateFilterApplied && (
                      <p className="mt-1 text-blue-500">
                        ✓ Date filter applied
                      </p>
                    )}
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

export default VahanConverter;
