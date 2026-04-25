import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Search, FileSpreadsheet, Edit3, XCircle, WifiOff, Trash2, ChevronLeft, ChevronRight, Database, Loader2, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import tailwindStyles from '../index.css?inline';

const API_URL = import.meta.env.VITE_API_URL;

const SuzukiGatePass = ({ theme }) => {
  const isDark = theme === 'dark';
  const componentRef = useRef(null);

  const LAYOUT = {
    height: '148.5mm',
    paddingX: '12mm',
    paddingY: '6mm',
  };

  const initialForm = {
    passNo: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    salesBillNo: '',
    sparesBillNo: '',
    serviceBillNo: '',
    regnNo: '',
    chassisNo: '',
    model: '',
    color: '',
    narration: ''
  };

  const [formData, setFormData] = useState(initialForm);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState([]);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [exportMonth, setExportMonth] = useState('');
  const [serverError, setServerError] = useState(false);
  
  // Database Update State
  const [form22File, setForm22File] = useState(null);
  const [dbUploading, setDbUploading] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // --- SAFE API CALLS ---

  const fetchNextPassNo = async () => {
    try {
      const res = await fetch(`${API_URL}/gatepass/next`);
      if (!res.ok) throw new Error("Server Error");
      const data = await res.json();
      setFormData(prev => ({ ...prev, passNo: String(data.nextNo || '---') }));
      setServerError(false);
    } catch (err) {
      console.error("Failed to fetch next pass no:", err);
      setFormData(prev => ({ ...prev, passNo: 'OFFLINE' }));
      setServerError(true);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/gatepass/list`);
      if (!res.ok) {
        setHistory([]);
        setServerError(true);
        return;
      }
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
      setServerError(false);
    } catch (err) {
      console.error("History fetch error:", err);
      setHistory([]);
      setServerError(true);
    }
  };

  const fetchAvailableMonths = async () => {
    try {
      const res = await fetch(`${API_URL}/gatepass/months`);
      if (res.ok) {
        const data = await res.json();
        setAvailableMonths(Array.isArray(data) ? data : []);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchNextPassNo();
    fetchHistory();
    fetchAvailableMonths();
  }, []);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [historySearchTerm, exportMonth]);

  const handleSearchInput = (e) => setSearchQuery(e.target.value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const searchDb = async () => {
      if (debouncedQuery.length >= 3) {
        setIsSearching(true);
        try {
          const res = await fetch(`${API_URL}/form22/search?q=${debouncedQuery}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(Array.isArray(data) ? data : []);
          } else {
            setSearchResults([]);
          }
        } catch (err) { console.error(err); setSearchResults([]); } finally { setIsSearching(false); }
      } else { setSearchResults([]); }
    };
    searchDb();
  }, [debouncedQuery]);

  const selectVehicle = (vehicle) => {
    setFormData(prev => ({
      ...prev,
      customerName: vehicle.customer_name || '',
      chassisNo: vehicle.chassis_no || '',
      model: vehicle.model || '',
      color: vehicle.color || ''
    }));
    setSearchResults([]); 
    setSearchQuery('');
  };

  const handleEdit = (item) => {
    if (serverError) return alert("System Offline. Cannot edit.");
    setFormData({
      passNo: item.pass_no,
      date: new Date(item.date).toISOString().split('T')[0],
      customerName: item.customer_name,
      salesBillNo: item.sales_bill_no || '',
      sparesBillNo: item.spares_bill_no || '',
      serviceBillNo: item.service_bill_no || '',
      regnNo: item.regn_no || '',
      chassisNo: item.chassis_no || '',
      model: item.model || '',
      color: item.color || '',
      narration: item.narration || ''
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setFormData(initialForm);
    fetchNextPassNo();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to completely delete Gate Pass No: ${formData.passNo}? This action cannot be undone.`)) {
        return;
    }
    
    try {
      const res = await fetch(`${API_URL}/gatepass/${formData.passNo}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        await fetchHistory();
        await fetchAvailableMonths();
        cancelEdit();
      } else {
        alert("Failed to delete gate pass from the database.");
      }
    } catch (err) {
      alert("Error deleting gate pass.");
      console.error(err);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const saveToDb = async () => {
    if (serverError) return alert("System Offline.");

    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_URL}/gatepass/${formData.passNo}` : `${API_URL}/gatepass`;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passNo: formData.passNo,
          date: formData.date,
          customer_name: formData.customerName,
          model: formData.model,
          color: formData.color,
          regn_no: formData.regnNo,
          chassis_no: formData.chassisNo,
          sales_bill_no: formData.salesBillNo,
          spares_bill_no: formData.sparesBillNo,
          service_bill_no: formData.serviceBillNo,
          narration: formData.narration
        })
      });

      if (!res.ok) throw new Error("Save Failed");

      await fetchHistory();
      await fetchAvailableMonths();

      if (isEditing) {
        setIsEditing(false);
        setFormData(initialForm);
        fetchNextPassNo();
      } else {
        setFormData(prev => ({ ...prev, customerName: '', regnNo: '', chassisNo: '', salesBillNo: '', sparesBillNo: '', serviceBillNo: '', narration: '' }));
        await fetchNextPassNo();
      }
    } catch (err) { alert("Failed to save to database."); }
  };
  
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm22File(file);
      setDbStatus(null);
    }
  };

  const uploadToDatabase = async () => {
    if (!form22File) return;
    setDbUploading(true);
    setDbStatus(null);

    const formPayload = new FormData();
    formPayload.append('file', form22File);

    try {
      const response = await fetch(`${API_URL}/form22/upload`, {
        method: 'POST',
        body: formPayload,
      });
      const data = await response.json();
      if (response.ok) {
        setDbStatus({ type: 'success', message: data.message });
        setForm22File(null);
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("DB Upload Error:", error);
      setDbStatus({ type: 'error', message: "Upload failed. Check server logs." });
    } finally {
      setDbUploading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `GatePass_${formData.passNo}`,
    onBeforeGetContent: () => {
      if (serverError) {
        alert("System Offline. Cannot print.");
        return Promise.reject();
      }
    },
    onAfterPrint: saveToDb
  });

  const filteredHistory = useMemo(() => {
    if (!Array.isArray(history)) return [];
    const lower = historySearchTerm.toLowerCase();
    return history.filter(item =>
      (item.customer_name?.toLowerCase() || '').includes(lower) ||
      (item.chassis_no?.toLowerCase() || '').includes(lower) ||
      (item.regn_no?.toLowerCase() || '').includes(lower) ||
      String(item.pass_no || '').includes(lower)
    );
  }, [history, historySearchTerm]);

  // Apply Pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, currentPage]);

  const processExport = (data, filename) => {
    const dataToExport = data.map(item => ({ "Pass No": item.pass_no, "Date": new Date(item.date).toLocaleDateString(), "Customer": item.customer_name, "Model": item.model, "Chassis No": item.chassis_no, "Regn No": item.regn_no, "Sales Bill": item.sales_bill_no, "Spares Bill": item.spares_bill_no, "Service Bill": item.service_bill_no, "Narration": item.narration }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GatePasses");
    XLSX.writeFile(workbook, filename);
  };

  const handleExport = async () => {
    if (exportMonth) {
      try {
        const res = await fetch(`${API_URL}/gatepass/list?month=${exportMonth}`);
        if (res.ok) {
          const data = await res.json();
          processExport(Array.isArray(data) ? data : [], `GatePass_Export_${exportMonth}.xlsx`);
        }
      } catch(e) { console.error(e); }
    } else processExport(filteredHistory, "GatePass_Export_Recent.xlsx");
  };

  const hasValue = (val) => val && val.trim().length > 0;

  const inputClass = `w-full p-1.5 rounded border text-sm ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`;
  const labelClass = `block text-[10px] font-bold uppercase mb-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const tableHeaderClass = `px-4 py-2 text-left text-xs font-semibold ${isDark ? "text-gray-300 bg-gray-700" : "text-gray-600 bg-gray-100"}`;
  const tableRowClass = `border-b ${isDark ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"} transition-colors`;

  const renderGatePassBody = () => (
    <>
      <div className="flex justify-between items-start mb-1">
        <div className="w-[45%]"><img src="/suzuki-logo.png" alt="Suzuki" style={{width:'220px'}} onError={(e)=>{e.target.style.display='none'}}/></div>
        <div className="w-[55%] text-right pt-2">
          <h1 className="text-lg font-extrabold uppercase">VALUE MOTOR AGENCY PVT LTD</h1>
          <p className="text-[11px] font-bold">#16/A, MILLERS ROAD VASANTH NAGAR, BANGALORE - 52</p>
        </div>
      </div>
      <div className="flex justify-center mb-4"><div className="border-b-2 border-black w-full text-center py-1"><span className="text-xl font-black uppercase tracking-[0.2em]">GATE PASS</span></div></div>

      <div className="flex justify-between items-center mb-3 text-sm font-bold"><div>NO: <span className="text-red-600 text-lg ml-1">{formData.passNo}</span></div><div>DATE: <span className="ml-1 text-base">{new Date(formData.date).toLocaleDateString('en-GB')}</span></div></div>
      <div className="flex flex-col gap-y-2 text-sm">
        {hasValue(formData.customerName) && <div className="flex items-end"><span className="font-bold mr-2 uppercase w-36 shrink-0">Customer Name:</span><span className="border-b border-dotted border-black min-w-[50%] px-2 font-bold text-base uppercase">{formData.customerName}</span></div>}
        <div className="flex items-end gap-4">
          {hasValue(formData.model) && <div className="flex items-end flex-1"><span className="font-bold mr-2 uppercase w-16 shrink-0">Model:</span><span className="border-b border-dotted border-black flex-grow px-2 font-bold text-sm uppercase">{formData.model}</span></div>}
          {hasValue(formData.color) && <div className="flex items-end flex-1"><span className="font-bold mr-2 uppercase w-16 shrink-0">Color:</span><span className="border-b border-dotted border-black flex-grow px-2 font-bold text-sm uppercase">{formData.color}</span></div>}
        </div>
        <div className="flex items-end gap-4">
          {hasValue(formData.regnNo) && <div className="flex items-end flex-1"><span className="font-bold mr-2 uppercase w-24 shrink-0">Veh Reg No:</span><span className="border-b border-dotted border-black flex-grow px-2 font-bold text-sm uppercase">{formData.regnNo}</span></div>}
          {hasValue(formData.chassisNo) && <div className="flex items-end flex-1"><span className="font-bold mr-2 uppercase w-24 shrink-0">Chassis No:</span><span className="border-b border-dotted border-black flex-grow px-2 font-bold text-sm uppercase">{formData.chassisNo}</span></div>}
        </div>
        {hasValue(formData.salesBillNo) && <div className="flex items-end w-3/4"><span className="font-bold mr-2 uppercase w-32 shrink-0">Sales Bill No:</span><span className="border-b border-dotted border-black flex-grow px-2 font-medium text-sm uppercase">{formData.salesBillNo}</span></div>}
        {hasValue(formData.sparesBillNo) && <div className="flex items-end w-3/4"><span className="font-bold mr-2 uppercase w-32 shrink-0">Spares Bill No:</span><span className="border-b border-dotted border-black flex-grow px-2 font-medium text-sm uppercase">{formData.sparesBillNo}</span></div>}
        {hasValue(formData.serviceBillNo) && <div className="flex items-end w-3/4"><span className="font-bold mr-2 uppercase w-32 shrink-0">Service Bill No:</span><span className="border-b border-dotted border-black flex-grow px-2 font-medium text-sm uppercase">{formData.serviceBillNo}</span></div>}
        {hasValue(formData.narration) && <div className="flex items-end w-full mt-2"><span className="font-bold mr-2 uppercase w-32 shrink-0">Narration:</span><span className="border-b border-dotted border-black flex-grow px-2 font-medium text-sm uppercase">{formData.narration}</span></div>}
      </div>

      <div className="mt-8 flex justify-end">
        <div className="text-center">
          <div className="text-[10px] font-bold mb-8">For VALUE MOTOR AGENCY PVT LTD</div>
          <div className="border-t border-black px-6 pt-1 text-[10px] font-bold">Authorised Signatory</div>
        </div>
      </div>
    </>
  );

  const renderPrintLayout = () => (
    <div
      ref={componentRef}
      style={{
        width: '210mm',
        height: LAYOUT.height,
        paddingLeft: LAYOUT.paddingX,
        paddingRight: LAYOUT.paddingX,
        paddingTop: LAYOUT.paddingY,
        backgroundColor: 'white',
        boxSizing: 'border-box'
      }}
    >
      <style type="text/css" media="print">
        {tailwindStyles}
        {`@page { size: auto; margin: 0mm !important; } html, body { margin: 0 !important; padding: 0 !important; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
      </style>
      {renderGatePassBody()}
    </div>
  );

  return (
    <div className="container mx-auto p-2 md:p-4 max-w-7xl">
      <div className="no-print">
        <div className="flex flex-col lg:flex-row gap-4 mb-8">

          {/* COMPACT FORM PANEL */}
          <div className={`w-full lg:w-1/3 p-4 rounded-xl shadow-lg h-fit ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>

            {serverError && (
              <div className="mb-3 bg-red-100 border-l-4 border-red-500 text-red-700 p-2 rounded shadow-sm animate-pulse">
                <div className="flex items-center gap-2">
                  <WifiOff size={16} />
                  <p className="font-bold text-xs">System Offline</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3 border-b pb-2">
              <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
                {isEditing ? "Edit Gate Pass" : "Gate Pass Details"}
              </h2>
              <div className="flex gap-2">
                {isEditing && (
                  <button onClick={handleDelete} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-[10px] font-bold uppercase transition" title="Delete Gate Pass">
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                {!serverError && (
                  <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-[10px] font-bold uppercase transition" title={isEditing ? "Cancel Edit" : "Clear Form"}>
                    <XCircle size={14} /> {isEditing ? "Cancel" : "Clear"}
                  </button>
                )}
              </div>
            </div>

            <fieldset disabled={serverError} className="space-y-2">
              {/* Database Update Section */}
              <div className={`p-3 rounded-lg border mb-4 ${isDark ? 'bg-blue-900/10 border-blue-800/50' : 'bg-blue-50 border-blue-200'}`}>
                <label className={labelClass}>Update Search Database (Form22)</label>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className={`text-xs flex-1 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:cursor-pointer transition-colors ${
                      isDark 
                        ? 'text-gray-300 file:bg-blue-900/40 file:text-blue-400 hover:file:bg-blue-900/60' 
                        : 'text-gray-600 file:bg-white file:text-blue-600 hover:file:bg-blue-50 border-gray-300'
                    }`}
                  />
                  <button
                    onClick={uploadToDatabase}
                    disabled={!form22File || dbUploading}
                    className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      isDark 
                        ? "bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-700" 
                        : "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {dbUploading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                    Upload
                  </button>
                </div>
                {dbStatus && (
                  <div className={`mt-2 text-[10px] p-2 rounded border flex items-center gap-1.5 ${
                    dbStatus.type === 'success' 
                      ? (isDark ? "bg-green-900/30 text-green-400 border-green-800" : "bg-green-50 text-green-700 border-green-200") 
                      : (isDark ? "bg-red-900/30 text-red-400 border-red-800" : "bg-red-50 text-red-700 border-red-200")
                  }`}>
                    {dbStatus.type === 'success' && <CheckCircle size={12} />}
                    {dbStatus.message}
                  </div>
                )}
              </div>

              {/* Vehicle Search */}
              <div className="mb-3 relative z-30">
                <label className={labelClass}>Vehicle Search (Chassis/Name)</label>
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={handleSearchInput}
                    className={`${inputClass} pl-8`}
                    placeholder="Enter last 4 digits..."
                  />
                  <Search className="absolute left-2.5 top-2 text-gray-400" size={14} />
                  {isSearching && <div className="absolute right-2.5 top-2 animate-spin h-3 w-3 border-2 border-blue-500 rounded-full border-t-transparent"></div>}
                </div>

                {searchResults.length > 0 && (
                  <div className={`absolute z-50 w-full border shadow-xl rounded-lg mt-1 max-h-48 overflow-y-auto ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}>
                    {searchResults.map((vh, idx) => (
                      <div
                        key={vh.id || idx}
                        onClick={() => selectVehicle(vh)}
                        className={`p-2 cursor-pointer border-b last:border-0 transition-colors ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-blue-50'}`}
                      >
                        <div className={`font-bold text-xs ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{vh.chassis_no}</div>
                        <div className={`text-[10px] flex justify-between mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span>{vh.customer_name}</span>
                          <span className="text-blue-600 font-semibold">{vh.model}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelClass}>Pass No (Editable)</label><input name="passNo" value={formData.passNo} onChange={handleChange} className={inputClass} /></div>
                <div><label className={labelClass}>Date</label><input type="date" name="date" value={formData.date} onChange={handleChange} className={inputClass} /></div>
              </div>
              <div><label className={labelClass}>Customer Name</label><input name="customerName" value={formData.customerName} onChange={handleChange} className={inputClass} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelClass}>Model</label><input name="model" value={formData.model} onChange={handleChange} className={inputClass} /></div>
                <div><label className={labelClass}>Color</label><input name="color" value={formData.color} onChange={handleChange} className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelClass}>Regn No</label><input name="regnNo" value={formData.regnNo} onChange={handleChange} className={inputClass} /></div>
                <div><label className={labelClass}>Chassis No</label><input name="chassisNo" value={formData.chassisNo} onChange={handleChange} className={inputClass} /></div>
              </div>
              <hr className="my-1 border-gray-200" />
              <div className="grid grid-cols-3 gap-2">
                <div><label className={labelClass}>Sales Bill</label><input name="salesBillNo" value={formData.salesBillNo} onChange={handleChange} className={inputClass} /></div>
                <div><label className={labelClass}>Spares Bill</label><input name="sparesBillNo" value={formData.sparesBillNo} onChange={handleChange} className={inputClass} /></div>
                <div><label className={labelClass}>Service Bill</label><input name="serviceBillNo" value={formData.serviceBillNo} onChange={handleChange} className={inputClass} /></div>
              </div>
              <div>
                <label className={labelClass}>Narration / Remarks</label>
                <input name="narration" value={formData.narration} onChange={handleChange} className={inputClass} placeholder="Enter remarks..." />
              </div>

              <button
                onClick={handlePrint}
                disabled={serverError}
                className={`w-full mt-2 font-bold py-2 px-4 rounded-lg shadow-md flex items-center justify-center gap-2 transition-all ${
                  serverError
                    ? "bg-gray-400 cursor-not-allowed text-gray-200"
                    : (isEditing ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-green-600 hover:bg-green-700 text-white")
                }`}
              >
                {serverError ? <WifiOff size={18} /> : <Printer size={18} />}
                {serverError ? "Offline" : (isEditing ? "Update & Print" : "Save & Print")}
              </button>
            </fieldset>
          </div>

          {/* PRINT PREVIEW PANEL */}
          <div className={`w-full lg:w-2/3 rounded-xl p-4 overflow-auto flex justify-center items-start ${isDark ? "bg-gray-700/50" : "bg-gray-200"}`}>
            <div className="transform scale-[0.7] lg:scale-90 origin-top bg-white shadow-2xl">
              <div className="text-black font-sans relative flex flex-col" style={{ width: '210mm', height: LAYOUT.height, paddingLeft: LAYOUT.paddingX, paddingRight: LAYOUT.paddingX, paddingTop: LAYOUT.paddingY, backgroundColor: 'white', boxSizing: 'border-box' }}>
                {renderGatePassBody()}
              </div>
            </div>
          </div>
        </div>

        {/* History table */}
        <div className={`rounded-xl shadow-lg p-6 ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"}`}>
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>History</h2>
            <div className="flex gap-2 items-center flex-wrap">
              {/* Search is now inside the gray background grouping next to export options */}
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg border border-gray-300">
                <select className="bg-transparent text-sm p-1 outline-none text-gray-700 font-medium" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)}>
                  <option value="">Current View (Last 500)</option>
                  {availableMonths.map(m => <option key={m} value={m}>{m} (Full Month)</option>)}
                </select>
                <input value={historySearchTerm} onChange={(e) => setHistorySearchTerm(e.target.value)} className={`${inputClass} w-48`} placeholder="Search displayed..." />
                <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-bold flex gap-2 items-center transition-colors"><FileSpreadsheet size={16} /> Export</button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr><th className={tableHeaderClass}>Pass No</th><th className={tableHeaderClass}>Date</th><th className={tableHeaderClass}>Customer</th><th className={tableHeaderClass}>Chassis</th><th className={tableHeaderClass}>Action</th></tr>
              </thead>
              <tbody>
                {paginatedHistory.map(item => (
                  <tr key={item.pass_no} className={`${tableRowClass} group cursor-pointer`} onClick={() => handleEdit(item)}>
                    <td className="px-4 py-3">{item.pass_no}</td>
                    <td className="px-4 py-3">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-semibold">{item.customer_name}</td>
                    <td className="px-4 py-3">{item.chassis_no}</td>
                    <td className="px-4 py-3">
                      <button className="flex items-center gap-1 text-blue-500 font-bold text-xs uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 size={14} /> Edit / Reprint
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className={`flex items-center justify-between mt-4 px-4 py-3 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1} 
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${isDark ? 'bg-gray-800 border-gray-600 text-white hover:bg-gray-600' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Page <span className="font-bold">{currentPage}</span> of {totalPages}
              </span>
              
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages} 
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${isDark ? 'bg-gray-800 border-gray-600 text-white hover:bg-gray-600' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Hidden print target */}
      <div className="print-only" style={{ position: 'absolute', overflow: 'hidden', height: 0, width: 0, top: '-9999px', left: '-9999px' }}>
        {renderPrintLayout()}
      </div>
    </div>
  );
};

export default SuzukiGatePass;