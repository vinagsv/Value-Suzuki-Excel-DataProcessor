import React, { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  Play,
  CheckCircle,
  AlertCircle,
  Download,
  Info,
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── helpers ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.replace(/^\uFEFF/, "").trim());
  const rows = lines.slice(1).map((line) => {
    const vals = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQ = !inQ;
      else if (line[i] === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
      else cur += line[i];
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (vals[i] || "").replace(/[\uFEFF\u00a0]/g, "").trim()));
    return obj;
  });
  return { headers, rows };
}

function formatDate(raw) {
  if (!raw) return "";
  let d;
  if (raw instanceof Date) d = raw;
  else if (typeof raw === "number") d = new Date((raw - 25569) * 86400 * 1000);
  else { d = new Date(raw); if (isNaN(d)) return String(raw); }
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function toCSVString(headers, rows) {
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    const vals = headers.map((h) => {
      let v = (row[h] || "").toString().replace(/[\uFEFF\u00a0]/g, "").trim();
      if (v.includes(",") || v.includes('"')) v = `"${v.replace(/"/g, '""')}"`;
      return v;
    });
    lines.push(vals.join(","));
  });
  return lines.join("\r\n");
}

// ─── main component ──────────────────────────────────────────────────────────

const HSRPVahanMerger = ({ theme }) => {
  const [hsrpFile, setHsrpFile]     = useState(null);
  const [vahanFile, setVahanFile]   = useState(null);
  const [outputName, setOutputName] = useState("HSRP_FILLED.csv");
  const [processing, setProcessing] = useState(false);
  const [result, setResult]         = useState(null);
  const [csvOutput, setCsvOutput]   = useState(null);

  const isDark = theme === "dark";

  const handleFile = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (type === "hsrp") setHsrpFile(file);
    else setVahanFile(file);
    setResult(null);
    setCsvOutput(null);
  };

  const processFiles = async () => {
    if (!hsrpFile || !vahanFile) {
      setResult({ type: "error", message: "Please upload both files." });
      return;
    }
    setProcessing(true);
    setResult(null);
    setCsvOutput(null);

    try {
      // 1. Read HSRP CSV
      const csvText = await hsrpFile.text();
      const { headers, rows } = parseCSV(csvText);

      // 2. Read VAHAN XLSX
      const vahanBuffer = await vahanFile.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(vahanBuffer), { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const vahanRows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

      // 3. Build VIN → vahan row lookup
      const vahanMap = {};
      vahanRows.forEach((r) => {
        const vin = (r["Chasis No"] || "").trim().toUpperCase();
        if (vin) vahanMap[vin] = r;
      });

      let missing = 0, filled = 0, unmatched = 0;
      const logs = [];

      const filledRows = rows.map((row) => {
        const regNum = (row["REG NUM"] || "").trim();
        if (regNum) return { ...row };

        missing++;
        const vin = (row["VIN"] || "").trim().toUpperCase();
        const vahanRow = vahanMap[vin];

        if (vahanRow) {
          const regNo = (vahanRow["Registration No"] || "").trim();
          const dtFmt = formatDate(vahanRow["Receipt Dt."] || vahanRow["Receipt Date"] || "");
          filled++;
          logs.push({ type: "ok", text: `${vin}  →  ${regNo}  |  ${dtFmt}` });
          return {
            ...row,
            "REG NUM": regNo,
            "DATE OF REG (DD-MON-YYYY)": dtFmt,
            "VEHICLE CLASS (P/C)": "",
          };
        } else {
          unmatched++;
          logs.push({ type: "warn", text: `${vin}  —  not found in VAHAN` });
          return { ...row };
        }
      });

      const csv = "\uFEFF" + toCSVString(headers, filledRows);
      setCsvOutput(csv);
      setResult({
        type: "success",
        message: `Successfully filled ${filled} registration number${filled !== 1 ? "s" : ""} out of ${missing} missing.`,
        details: { total: rows.length, missing, filled, unmatched },
        logs,
      });
    } catch (err) {
      setResult({ type: "error", message: `Error: ${err.message}` });
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = () => {
    if (!csvOutput) return;
    const name = outputName.endsWith(".csv") ? outputName : `${outputName}.csv`;
    const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className={`text-4xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
          HSRP ↔ VAHAN Merger
        </h1>
        <p className={isDark ? "text-gray-400" : "text-gray-600"}>
          Fill missing REG NUM and DATE OF REG in your HSRP file using VAHAN registration data.
        </p>
      </div>

      <div
        className={`rounded-2xl shadow-2xl p-8 ${
          isDark ? "bg-gray-800/50 backdrop-blur-sm" : "bg-white"
        }`}
      >
        {/* Info note */}
        <div
          className={`flex items-start gap-3 rounded-xl p-4 mb-6 ${
            isDark
              ? "bg-blue-900/30 border border-blue-700"
              : "bg-blue-50 border border-blue-200"
          }`}
        >
          <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className={`text-sm ${isDark ? "text-blue-300" : "text-blue-700"}`}>
            Matches <strong>VIN</strong> (HSRP) with <strong>Chasis No</strong> (VAHAN). Fills{" "}
            <strong>REG NUM</strong> from Registration No and{" "}
            <strong>DATE OF REG</strong> from Receipt Dt. Rows that already have a REG NUM are
            untouched. VEHICLE CLASS is left blank.
          </p>
        </div>

        {/* File uploads */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* HSRP CSV */}
          <div>
            <label
              className={`block text-sm font-semibold mb-3 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              HSRP File (Source - .csv)
            </label>
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
                hsrpFile
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
                accept=".csv"
                onChange={(e) => handleFile(e, "hsrp")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <FileText
                  size={32}
                  className={
                    hsrpFile
                      ? "text-green-500"
                      : isDark
                      ? "text-gray-400"
                      : "text-gray-500"
                  }
                />
                <p
                  className={`mt-2 text-sm text-center ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {hsrpFile ? hsrpFile.name : "Click to upload HSRP.csv"}
                </p>
              </div>
            </div>
          </div>

          {/* VAHAN XLSX */}
          <div>
            <label
              className={`block text-sm font-semibold mb-3 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              VAHAN File (Lookup - .xlsx)
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
                onChange={(e) => handleFile(e, "vahan")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <FileSpreadsheet
                  size={32}
                  className={
                    vahanFile
                      ? "text-green-500"
                      : isDark
                      ? "text-gray-400"
                      : "text-gray-500"
                  }
                />
                <p
                  className={`mt-2 text-sm text-center ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {vahanFile ? vahanFile.name : "Click to upload VAHAN.xlsx"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Output file name */}
        <div className="mb-6">
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
            className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none ${
              isDark
                ? "bg-gray-700 text-white border-gray-600"
                : "bg-gray-50 text-gray-900 border-gray-300"
            }`}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={processFiles}
            disabled={processing || !hsrpFile || !vahanFile}
            className={`flex-1 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg text-white bg-gradient-to-r ${
              isDark
                ? "from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                : "from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Processing…
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
            disabled={!csvOutput}
            className={`px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg text-white ${
              isDark ? "bg-green-600 hover:bg-green-700" : "bg-green-500 hover:bg-green-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <Download size={20} /> Download
            </div>
          </button>
        </div>

        {/* Result banner */}
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
                <CheckCircle size={24} className="text-green-500 flex-shrink-0" />
              ) : (
                <AlertCircle size={24} className="text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-semibold ${
                    result.type === "success" ? "text-green-700" : "text-red-700"
                  } ${isDark && "brightness-150"}`}
                >
                  {result.message}
                </p>

                {/* Stats grid */}
                {result.details && (
                  <div
                    className={`mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm ${
                      isDark ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {[
                      { label: "Total rows",   val: result.details.total },
                      { label: "Missing REG",  val: result.details.missing },
                      { label: "Filled",       val: result.details.filled },
                      { label: "Not matched",  val: result.details.unmatched },
                    ].map(({ label, val }) => (
                      <div
                        key={label}
                        className={`rounded-lg px-3 py-2 text-center ${
                          isDark ? "bg-gray-700" : "bg-white border border-gray-200"
                        }`}
                      >
                        <p className="text-lg font-bold">{val}</p>
                        <p className="text-xs opacity-70">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Processing log */}
                {result.logs && result.logs.length > 0 && (
                  <div
                    className={`mt-4 rounded-lg p-3 max-h-44 overflow-y-auto font-mono text-xs space-y-1 ${
                      isDark ? "bg-gray-900" : "bg-gray-100"
                    }`}
                  >
                    {result.logs.map((l, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 ${
                          l.type === "ok" ? "text-green-600" : "text-amber-600"
                        }`}
                      >
                        <span className="select-none">{l.type === "ok" ? "✓" : "⚠"}</span>
                        <span className="break-all">{l.text}</span>
                      </div>
                    ))}
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

export default HSRPVahanMerger;