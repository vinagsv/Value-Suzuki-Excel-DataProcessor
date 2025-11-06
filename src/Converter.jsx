import React, { useState } from 'react';
import { Upload, FileSpreadsheet, FolderOpen, Play, Moon, Sun, CheckCircle, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const Converter = () => {
  const [theme, setTheme] = useState('dark');
  const [form22File, setForm22File] = useState(null);
  const [vahanFile, setVahanFile] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [outputName, setOutputName] = useState('VAHAN_UPDATED.xlsx');
  const [outputPath, setOutputPath] = useState('D:\\');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [processedData, setProcessedData] = useState(null);

  const isDark = theme === 'dark';

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === 'form22') setForm22File(file);
      else setVahanFile(file);
    }
  };

  const processFiles = async () => {
    if (!form22File || !vahanFile) {
      setResult({ type: 'error', message: 'Please upload both files' });
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      // Read FORM22
      const form22Data = await readExcelFile(form22File);
      const chassisToName = {};
      
      for (const row of form22Data) {
        if (row['CHASSIS NO']) {
          const chassis = row['CHASSIS NO'].toString().replace(/\s+/g, '').toUpperCase().trim();
          const name = (row['CUSTOMER NAME'] || '').toString().trim();
          if (chassis && name) {
            chassisToName[chassis] = name;
          }
        }
      }

      // Read VAHAN
      const vahanWorkbook = await readExcelFileRaw(vahanFile);
      const vahanSheetName = vahanWorkbook.SheetNames[0];
      const vahanSheet = vahanWorkbook.Sheets[vahanSheetName];
      const vahanData = XLSX.utils.sheet_to_json(vahanSheet, { header: 1 });

      // Filter by date if specified
      let filteredData = vahanData;
      if (startDate || endDate) {
        filteredData = filterByDate(vahanData, startDate, endDate);
      }

      // Process entries
      let totalRows = 0;
      let updatedRows = 0;

      for (let i = 1; i < filteredData.length; i++) {
        const row = filteredData[i];
        if (!row || !row[6]) continue;

        const chassis = row[6].toString().replace(/\s+/g, '').toUpperCase().trim();
        if (chassis) {
          totalRows++;
          if (chassisToName[chassis]) {
            row[12] = chassisToName[chassis];
            updatedRows++;
          }
        }
      }

      // Create output workbook
      const updatedSheet = XLSX.utils.aoa_to_sheet(filteredData);
      const outputWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(outputWorkbook, updatedSheet, vahanSheetName);

      setProcessedData(outputWorkbook);
      setResult({
        type: 'success',
        message: `Successfully updated ${updatedRows} out of ${totalRows} entries`,
        details: { totalRows, updatedRows }
      });
    } catch (error) {
      setResult({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setProcessing(false);
    }
  };

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
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
          const workbook = XLSX.read(data, { type: 'array' });
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
    // Implement date filtering logic based on your date column
    // This is a placeholder - adjust column index as needed
    return data;
  };

  const downloadFile = () => {
    if (!processedData) return;
    
    const fileName = outputName.endsWith('.xlsx') ? outputName : `${outputName}.xlsx`;
    XLSX.writeFile(processedData, fileName);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    }`}>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Excel Data Processor
            </h1>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Match and update VAHAN data with FORM22 records
            </p>
          </div>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-3 rounded-xl transition-all duration-300 ${
              isDark 
                ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400' 
                : 'bg-white hover:bg-gray-100 text-gray-900 shadow-lg'
            }`}
          >
            {isDark ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>

        {/* Main Card */}
        <div className={`rounded-2xl shadow-2xl p-8 ${
          isDark ? 'bg-gray-800/50 backdrop-blur-sm' : 'bg-white'
        }`}>
          {/* File Uploads */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={`block text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                FORM22 File
              </label>
              <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
                form22File 
                  ? isDark ? 'border-green-500 bg-green-500/10' : 'border-green-500 bg-green-50'
                  : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, 'form22')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center">
                  <FileSpreadsheet className={form22File ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-500'} size={32} />
                  <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {form22File ? form22File.name : 'Click to upload'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                VAHAN File
              </label>
              <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
                vahanFile 
                  ? isDark ? 'border-green-500 bg-green-500/10' : 'border-green-500 bg-green-50'
                  : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, 'vahan')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center">
                  <FileSpreadsheet className={vahanFile ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-500'} size={32} />
                  <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {vahanFile ? vahanFile.name : 'Click to upload'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="mb-6">
            <label className={`block text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Date Range (Optional - leave empty to process all)
            </label>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`px-4 py-3 rounded-xl transition-all ${
                  isDark 
                    ? 'bg-gray-700 text-white border-gray-600' 
                    : 'bg-gray-50 text-gray-900 border-gray-300'
                } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                placeholder="Start Date"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`px-4 py-3 rounded-xl transition-all ${
                  isDark 
                    ? 'bg-gray-700 text-white border-gray-600' 
                    : 'bg-gray-50 text-gray-900 border-gray-300'
                } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                placeholder="End Date"
              />
            </div>
          </div>

          {/* Output Settings */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={`block text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Output File Name
              </label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl transition-all ${
                  isDark 
                    ? 'bg-gray-700 text-white border-gray-600' 
                    : 'bg-gray-50 text-gray-900 border-gray-300'
                } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Output Location
              </label>
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="D:\"
                className={`w-full px-4 py-3 rounded-xl transition-all ${
                  isDark 
                    ? 'bg-gray-700 text-white border-gray-600' 
                    : 'bg-gray-50 text-gray-900 border-gray-300'
                } border focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={processFiles}
              disabled={processing || !form22File || !vahanFile}
              className={`flex-1 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                isDark
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
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
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
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
            <div className={`p-6 rounded-xl ${
              result.type === 'success' 
                ? isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                : isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {result.type === 'success' ? (
                  <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
                ) : (
                  <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
                )}
                <div>
                  <p className={`font-semibold ${
                    result.type === 'success' ? 'text-green-700' : 'text-red-700'
                  } ${isDark && 'brightness-150'}`}>
                    {result.message}
                  </p>
                  {result.details && (
                    <div className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      <p>Total rows processed: {result.details.totalRows}</p>
                      <p>Rows updated: {result.details.updatedRows}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`mt-8 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
          Built with React & SheetJS • Ready for future enhancements
        </div>
      </div>
    </div>
  );
};

export default Converter;