import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ToWords } from 'to-words';
import { Printer, RefreshCw, Edit3, WifiOff, Calendar, Ban, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import DaySummary from './DaySummary';
import tailwindStyles from '../index.css?inline'; 

const API_URL = import.meta.env.VITE_API_URL;

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: { currency: false, ignoreDecimal: false, ignoreZeroCurrency: false, doNotAddOnly: true },
});

const Receipt = ({ theme }) => {
  const isDark = theme === 'dark';
  const componentRef = useRef(null);

  const initialForm = {
    receiptNo: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    mobile: '',
    gstNo: '',
    fileNoSeq: '', 
    hp: '',
    model: '',
    amount: '',
    paymentType: 'Booking',
    customPaymentType: '',
    paymentMode: 'Cash',
    dated: '', 
    chequeNo: '',
    status: 'ACTIVE'
  };

  const [formData, setFormData] = useState(initialForm);
  const [filePrefix, setFilePrefix] = useState('');
  const [currentFilePrefix, setCurrentFilePrefix] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [history, setHistory] = useState([]); 
  const [availableMonths, setAvailableMonths] = useState([]);
  const [exportRange, setExportRange] = useState({ from: '', to: '' });
  const [serverError, setServerError] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const cleanDate = dateString.substring(0, 10);
    const [year, month, day] = cleanDate.split('-');
    return `${day}-${month}-${year}`;
  };

  const fetchNextReceiptNo = async () => {
    try {
      const res = await fetch(`${API_URL}/general-receipts/next`);
      if (!res.ok) throw new Error("Server Error");
      
      const data = await res.json();
      setFilePrefix(data.prefix || '');
      setCurrentFilePrefix(data.prefix || '');
      setFormData(prev => ({ 
          ...prev, 
          receiptNo: String(data.nextReceiptNo || '---'),
          fileNoSeq: '' 
      }));
      setServerError(false); 
    } catch (err) { 
      setFormData(prev => ({ ...prev, receiptNo: 'OFFLINE' })); 
      setServerError(true); 
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/general-receipts/list`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
      setServerError(false);
    } catch (err) { 
      setHistory([]); 
      setServerError(true); 
    }
  };

  const fetchAvailableMonths = async () => {
    try {
      const res = await fetch(`${API_URL}/general-receipts/months`);
      if (res.ok) {
        const data = await res.json();
        setAvailableMonths(Array.isArray(data) ? data : []);
      } else {
        setAvailableMonths([]);
      }
    } catch (err) { 
      setAvailableMonths([]);
    }
  };

  useEffect(() => {
    fetchNextReceiptNo();
    fetchHistory();
    fetchAvailableMonths();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
      setFormData({
          ...initialForm, 
          date: new Date().toISOString().split('T')[0],
          receiptNo: formData.receiptNo,
          fileNoSeq: '' 
      });
      setIsEditing(false);
      setSearchTerm('');
      setSearchResults([]);
      fetchNextReceiptNo();
  };

  const handleFileChange = (e) => {
    let rawInput = e.target.value;
    setFormData(prev => ({ ...prev, fileNoSeq: rawInput }));

    const cleanCombined = (currentFilePrefix + rawInput).replace(/\s/g, '');
    
    if (Array.isArray(history) && rawInput.length >= 3) {
      const match = history.find(item => 
          (item.file_no || '').replace(/\s/g, '') === cleanCombined
      );

      if (match) {
        setFormData(prev => ({ 
          ...prev, 
          customerName: match.customer_name, 
          mobile: match.mobile || '', 
          gstNo: match.gst_no || '',
          model: match.model || '',
          hp: match.hp_financier || ''
        }));
      }
    }
  };

  const handleSearchInput = async (e) => {
      const term = e.target.value;
      setSearchTerm(term);
      
      if(term.length > 2) {
          let queryTerm = term;
          if (/^\d{6}$/.test(term)) {
              queryTerm = term.substring(2);
          }
          
          try {
              const res = await fetch(`${API_URL}/general-receipts/list?search=${queryTerm}`);
              if(res.ok) {
                  const data = await res.json();
                  setSearchResults(data);
              }
          } catch(e) { console.error(e); }
      } else {
          setSearchResults([]);
      }
  };

  const selectSearchResult = (item) => {
      handleEdit(item);
      setSearchResults([]);
      setSearchTerm('');
  };

  const handleEdit = (item) => {
    if (serverError) return alert("System is offline. Cannot edit receipts.");

    let loadedSeq = item.file_no || '';
    let loadedPrefix = filePrefix; // Default to global

    if (loadedSeq) {
        if (filePrefix && loadedSeq.startsWith(filePrefix)) {
            loadedPrefix = filePrefix;
            loadedSeq = loadedSeq.substring(filePrefix.length);
        } else {
            // Intelligently split unknown/old prefixes
            const match = loadedSeq.match(/^(.*?)(\d+)$/);
            if (match) {
                loadedPrefix = match[1];
                loadedSeq = match[2];
            } else {
                loadedPrefix = '';
            }
        }
    }

    setCurrentFilePrefix(loadedPrefix);

    setFormData({
        receiptNo: item.receipt_no,
        date: item.date ? item.date.substring(0, 10) : new Date().toISOString().split('T')[0],
        customerName: item.customer_name,
        mobile: item.mobile || '',
        gstNo: item.gst_no || '',
        fileNoSeq: loadedSeq, 
        hp: item.hp_financier || '',
        model: item.model || '',
        amount: item.amount,
        paymentType: ['Booking', 'Down Payment', 'Balance Payment'].includes(item.payment_type) ? item.payment_type : 'Other',
        customPaymentType: !['Booking', 'Down Payment', 'Balance Payment'].includes(item.payment_type) ? item.payment_type : '',
        paymentMode: item.payment_mode || 'Cash',
        dated: item.payment_date ? item.payment_date.substring(0, 10) : '',
        chequeNo: item.cheque_no || '',
        status: item.status || 'ACTIVE'
    });
    setIsEditing(true);
    setSearchTerm('');
    setSearchResults([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelReceipt = async () => {
      if(!window.confirm("Are you sure you want to CANCEL this receipt? This will be watermarked.")) return;
      const updatedForm = { ...formData, status: 'CANCELLED' };
      setFormData(updatedForm);
      await saveToDb(updatedForm);
  };

  const saveToDb = async (dataOverride = null) => {
    if (serverError) {
        if(window.toast) window.toast("System Offline: Cannot save data.", "error");
        return;
    }

    const dataToSave = dataOverride || formData;
    let finalFileNo = currentFilePrefix + dataToSave.fileNoSeq.trim();

    const method = isEditing ? 'PUT' : 'POST';
    const finalPaymentType = dataToSave.paymentType === 'Other' ? dataToSave.customPaymentType : dataToSave.paymentType;
    const url = isEditing ? `${API_URL}/general-receipts/${dataToSave.receiptNo}` : `${API_URL}/general-receipts`;
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_no: dataToSave.receiptNo,
          date: dataToSave.date,
          customer_name: dataToSave.customerName,
          mobile: dataToSave.mobile,
          gst_no: dataToSave.gstNo,
          file_no: finalFileNo, 
          hp_financier: dataToSave.hp,
          model: dataToSave.model,
          amount: dataToSave.amount,
          payment_type: finalPaymentType,
          payment_mode: dataToSave.paymentMode,
          payment_date: dataToSave.dated || null,
          cheque_no: dataToSave.chequeNo || null,
          status: dataToSave.status || 'ACTIVE'
        })
      });

      if (!res.ok) throw new Error("Database Save Failed");
      
      if(window.toast) window.toast("Receipt Saved Successfully", "success");
      
      fetchHistory();
      fetchAvailableMonths();

      if (isEditing) {
        if(dataOverride?.status === 'CANCELLED') resetForm();
        else resetForm();
      } else {
        setFormData(prev => ({ ...initialForm, date: prev.date, receiptNo: prev.receiptNo, fileNoSeq: '' }));
        await fetchNextReceiptNo();
      }
    } catch (err) { 
      if(window.toast) window.toast("Error saving receipt. Please check connection.", "error");
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Receipt_${formData.receiptNo}`,
    onBeforeGetContent: () => {
        if (serverError) {
          if(window.toast) window.toast("System Offline: Cannot print.", "error");
          return Promise.reject();
        }
        if (!formData.amount || isNaN(formData.amount)) {
            if(window.toast) window.toast("Please enter a valid amount.", "error");
            return Promise.reject();
        }
    },
    onAfterPrint: () => saveToDb()
  });

  const handleExport = () => {
    let data = history;
    if (exportRange.from && exportRange.to) {
      data = history.filter(item => {
        const itemDate = item.date.substring(0, 10);
        return itemDate >= exportRange.from && itemDate <= exportRange.to;
      });
    }

    // Sort data in ascending order (Date ASC, Receipt No ASC)
    const sortedData = [...data].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      return parseInt(a.receipt_no) - parseInt(b.receipt_no);
    });

    const dataToExport = sortedData.map(item => {
      const fileNo = item.file_no || '';
      const customer = item.customer_name || '';
      const fileCustomerCombined = fileNo && customer ? `${fileNo}-${customer}` : `${fileNo}${customer}`;

      return {
        "Date": formatDate(item.date),
        "Receipt No": item.receipt_no,
        "File Number-Customer Name": fileCustomerCombined,
        "Amount": item.amount,
        "Mode": item.payment_mode,
        "Type": item.payment_type,
        "File No": item.file_no,
        "Customer Name": item.customer_name,
        "Mobile": item.mobile,
        "Model": item.model,
        "HP To": item.hp_financier,
        "Status": item.status || 'ACTIVE',
        "Cheque No": item.cheque_no,
        "Dated": item.payment_date ? formatDate(item.payment_date) : '',
        "GST": item.gst_no
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receipts");
    XLSX.writeFile(workbook, `Receipts_Report.xlsx`);
  };

  const amountInWords = formData.amount && !isNaN(formData.amount) 
    ? toWords.convert(formData.amount).toUpperCase() + " ONLY" 
    : 'ZERO ONLY';

  const hasValue = (val) => val && val.trim().length > 0;
  const fullFileNo = currentFilePrefix + formData.fileNoSeq;

  const inputClass = `w-full p-1.5 rounded border text-sm ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`;
  const labelClass = `block text-[10px] font-bold uppercase mb-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const tableHeaderClass = `px-4 py-2 text-left text-xs font-semibold ${isDark ? "text-gray-300 bg-gray-700" : "text-gray-600 bg-gray-100"}`;
  const tableRowClass = `border-b ${isDark ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"} transition-colors`;

  const renderReceiptContent = (copyTitle) => (
    <div className="flex flex-col h-full relative">
        <div className="text-right font-bold text-[10px] uppercase mb-0.5 tracking-widest text-gray-500 pr-1">
          {copyTitle}
        </div>

        <div className="receipt-border flex flex-col flex-grow bg-white text-black" style={{ border: '3px solid black', borderRadius: '8px', padding: '3mm', position: 'relative', overflow: 'hidden' }}>

          {formData.status === 'CANCELLED' && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="border-4 border-red-500/30 text-red-500/30 text-6xl md:text-8xl font-black -rotate-45 p-4 rounded-xl tracking-widest select-none">
                      CANCELLED
                  </div>
              </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07]">
            <img src="/suzuki-logo.png" alt="" className="w-2/3" />
          </div>

          <div className="flex justify-between items-start mb-0.5 relative z-10">
              <div className="w-[45%]">
                <img src="/suzuki-logo.png" alt="Suzuki" style={{width:'180px'}} />
                <div className="text-xs font-bold mt-0.5">GST NO: 29AACCV2521J1ZA</div>
              </div>
              <div className="w-[55%] text-right">
                    <h1 className="text-xl font-bold uppercase leading-tight">VALUE MOTOR AGENCY PVT LTD</h1>
                    <p className="text-[10px] font-bold mt-0.5">#16/A, MILLERS ROAD, VASANTH NAGAR, BANGALORE - 52</p>
                    <p className="text-[10px] font-bold">Mob: 9845906084 | Email: millers_road_suzuki@yahoo.com</p>
              </div> 
          </div>

          <div className="flex justify-center mb-1">
            <div className="border-b-2 border-black w-full text-center pb-0.5">
              <span className="text-2xl font-bold uppercase tracking-[0.2em]">RECEIPT</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-1.5 text-sm font-bold relative z-10">
            <div>NO: <span className="text-red-600 text-xl ml-2">{formData.receiptNo}</span></div>
            
            <div className="flex items-center gap-6">
                {hasValue(fullFileNo) && (
                    <div className="text-sm font-bold text-gray-800">
                        File Number: <span className="ml-1">{fullFileNo}</span>
                    </div>
                )}
                <div>DATE: <span className="ml-2 text-lg">{formatDate(formData.date)}</span></div>
            </div>
          </div>

          <div className="flex flex-col flex-grow justify-between text-xs leading-snug relative z-10 px-1 py-1">
              
              <div className="flex items-end mb-1">
                <span className="font-bold mr-2 whitespace-nowrap">RECEIVED WITH THANKS FROM:</span>
                <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-lg uppercase">{formData.customerName}</span>
              </div>

              {(hasValue(formData.mobile) || hasValue(formData.model)) && (
                <div className="flex items-end mb-1 w-full gap-4">
                    {hasValue(formData.mobile) && (
                      <div className="flex items-end w-1/2">
                        <span className="font-bold mr-2 whitespace-nowrap">MOBILE NO:</span>
                        <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-base">{formData.mobile}</span>
                      </div>
                    )}
                    {hasValue(formData.model) && (
                      <div className="flex items-end w-1/2">
                        <span className="font-bold mr-2 whitespace-nowrap">MODEL:</span>
                        <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-base uppercase">{formData.model}</span>
                      </div>
                    )}
                </div>
              )}

              {(hasValue(formData.hp) || hasValue(formData.gstNo)) && (
                <div className="flex items-end mb-1 w-full gap-4">
                  {hasValue(formData.hp) && (
                    <div className="flex items-end w-1/2">
                        <span className="font-bold mr-2 whitespace-nowrap">H.P. TO:</span>
                        <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-sm uppercase">{formData.hp}</span>
                    </div>
                  )}
                  {hasValue(formData.gstNo) && (
                    <div className="flex items-end w-1/2">
                        <span className="font-bold mr-2 whitespace-nowrap">GST NO:</span>
                        <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-sm uppercase">{formData.gstNo}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col mb-1">
                <span className="font-bold whitespace-nowrap text-[10px] mb-0.5">THE SUM OF RUPEES:</span>
                <div className="border-b border-dotted border-black px-2 font-bold text-base italic uppercase break-words leading-tight min-h-[1.5rem] flex items-end">
                    {amountInWords}
                </div>
              </div>

              <div className="flex items-end mb-1">
                    <span className="font-bold mr-2 whitespace-nowrap">ON ACCOUNT OF:</span>
                    <span className="border-b border-dotted border-black px-4 font-bold text-base uppercase">
                      {formData.paymentType === 'Other' ? formData.customPaymentType : formData.paymentType}
                    </span>
              </div>
          </div>

          <div className="mt-1 flex items-end justify-between relative z-10">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-3">
                <div className="border-2 border-black px-3 py-1.5 text-xl font-bold bg-gray-50 whitespace-nowrap">
                    ₹ {Number(formData.amount).toLocaleString('en-IN')}/-
                </div>
                <div className="italic font-bold text-xs mt-1 whitespace-nowrap">
                    by way of {formData.paymentMode}
                </div>
              </div>

              {(hasValue(formData.chequeNo) || hasValue(formData.dated)) && (
                <div className="flex flex-col text-[11px] font-semibold gap-0 mt-0.5">
                  {hasValue(formData.chequeNo) && (
                    <div className="italic">
                      Cheque/Ref No: <span className="font-bold">{formData.chequeNo}</span>
                    </div>
                  )}
                  {hasValue(formData.dated) && (
                    <div className="italic">
                      Dated: <span className="font-bold">{formatDate(formData.dated)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-center">
                <div className="text-[10px] mb-5"> 
                    <span className="font-medium">For</span> <span className="font-bold uppercase text-xs">VALUE MOTOR AGENCY PVT LTD</span>
                </div>
                <div className="text-[10px] border-t border-black inline-block px-6 pt-1 font-bold">Authorised Signatory</div>
            </div>
          </div>

          <div className="mt-1 pt-1 border-t-2 border-gray-400">
            <div className="text-[9px] font-bold text-gray-800 uppercase leading-tight">
                WE BANK WITH STATE BANK OF INDIA | A/C NO: 32744599339 | IFSC: SBIN0021882 |  BRANCH: VASANTHNAGAR
            </div>
            <div className="text-[8px] font-extrabold text-black uppercase mt-0.5">
                NOTE: CHEQUES SUBJECT TO REALISATION. PRICES PREVAILING AT THE TIME OF DELIVERY APPLICABLE. ANY CANCELLATION SUBJECT TO 10% DEDUCTION.
            </div>
          </div>

        </div>
    </div>
  );

  return (
    <div className="container mx-auto p-2 md:p-4 max-w-7xl">
      <DaySummary isOpen={showSummary} onClose={() => setShowSummary(false)} theme={theme} />

      <div className={`mb-8 flex flex-col sm:flex-row justify-between items-center p-4 rounded-2xl shadow-lg gap-4 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-200'}`}>
          <div className="w-full sm:w-[400px] relative z-50">
              <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={handleSearchInput}
                  placeholder="Search by File No, Name..." 
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm shadow-inner focus:ring-2 outline-none transition-all border backdrop-blur-md ${isDark ? 'bg-white/10 border-white/20 text-white focus:ring-white/50 placeholder-gray-300' : 'bg-white/50 border-white/60 text-gray-800 focus:ring-blue-500 placeholder-gray-600'}`}
              />
              <Search className={`absolute left-3 top-3 ${isDark ? 'text-gray-300' : 'text-gray-500'}`} size={18}/>
              
              {searchResults.length > 0 && (
                  <div className={`absolute top-12 left-0 right-0 border shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] rounded-2xl max-h-80 overflow-y-auto z-50 backdrop-blur-xl animate-fadeIn ${isDark ? 'bg-gray-900/95 border-white/10' : 'bg-white/95 border-white/60'}`}>
                      {searchResults.map(r => (
                          <div key={r.receipt_no} onClick={() => selectSearchResult(r)} className={`p-4 border-b cursor-pointer flex justify-between items-center transition-colors ${isDark ? 'border-white/5 hover:bg-white/10' : 'border-gray-200/50 hover:bg-white/50'}`}>
                              <div>
                                  <div className={`font-bold text-sm ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>Receipt #{r.receipt_no}</div>
                                  <div className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{r.customer_name}</div>
                                  <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>File: {r.file_no || '--'} • Mob: {r.mobile || '--'}</div>
                              </div>
                              <div className={`font-bold text-lg ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                  ₹{r.amount}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          <button 
              onClick={() => setShowSummary(true)} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all border shadow-sm whitespace-nowrap w-full sm:w-auto justify-center backdrop-blur-md ${isDark ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white' : 'bg-white/40 hover:bg-white/60 border-white/50 text-gray-800'}`}
          >
              <Calendar size={18} />
              Daily Summary
          </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        
        <div className={`w-full lg:w-[380px] lg:flex-shrink-0 p-4 rounded-xl shadow-lg h-fit ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} border`}>
          
          {serverError && (
            <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-2 rounded shadow-md animate-pulse">
              <div className="flex items-center gap-2">
                <WifiOff size={16} />
                <p className="font-bold text-xs">System Offline</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
            <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
                {isEditing ? "Edit Receipt" : "New Receipt"}
            </h2>
            <div className="flex gap-2">
                {isEditing && (
                    <button onClick={handleCancelReceipt} className="bg-red-100 text-red-600 hover:bg-red-200 p-1.5 rounded transition" title="Cancel Receipt">
                        <Ban size={16} />
                    </button>
                )}
                <button onClick={resetForm} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1">
                    <RefreshCw size={14} /> Clear & Reset
                </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <fieldset disabled={serverError} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelClass}>Receipt No</label><input name="receiptNo" value={formData.receiptNo} readOnly className={`${inputClass} opacity-70 cursor-not-allowed`} /></div>
                  <div><label className={labelClass}>Date</label><input type="date" name="date" value={formData.date} onChange={handleChange} className={inputClass} /></div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                 <div>
                     <label className={labelClass}>File No</label>
                     <div className="flex shadow-sm rounded border overflow-hidden">
                        <span className={`px-2 py-1.5 text-xs font-mono font-bold flex items-center justify-center ${isDark ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-500'} select-none`}>
                            {currentFilePrefix}
                        </span>
                        <input 
                           name="fileNoSeq" 
                           value={formData.fileNoSeq} 
                           onChange={handleFileChange} 
                           className={`w-full p-1.5 text-sm font-mono tracking-wide font-bold text-blue-600 focus:outline-none ${isDark ? 'bg-gray-700 text-red-400' : 'bg-white'}`} 
                           placeholder="XXXX" 
                        />
                     </div>
                 </div>
                 <div><label className={labelClass}>Amount (₹)</label><input type="number" name="amount" value={formData.amount} onChange={handleChange} className={inputClass} /></div>
              </div>

              <div><label className={labelClass}>Customer Name</label><input name="customerName" value={formData.customerName} onChange={handleChange} className={inputClass} /></div>
              
              <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelClass}>Mobile Number</label><input name="mobile" value={formData.mobile} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>Model</label><input name="model" value={formData.model} onChange={handleChange} className={inputClass} /></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelClass}>HP To</label><input name="hp" value={formData.hp} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>Customer GST</label><input name="gstNo" value={formData.gstNo} onChange={handleChange} className={inputClass} /></div>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] text-gray-500 mb-1 font-semibold uppercase">Payment Details</p>
                  <div className="grid grid-cols-2 gap-2">
                      <div>
                          <label className={labelClass}>On Account Of</label>
                          <select name="paymentType" value={formData.paymentType} onChange={handleChange} className={inputClass}>
                              <option value="Booking">Booking</option>
                              <option value="Down Payment">Down Payment</option>
                              <option value="Balance Payment">Balance Payment</option>
                              <option value="Other">Other (Custom)</option>
                          </select>
                      </div>
                      <div>
                          <label className={labelClass}>By Way Of</label>
                          <select name="paymentMode" value={formData.paymentMode} onChange={handleChange} className={inputClass}>
                              <option value="Cash">Cash</option>
                              <option value="UPI">UPI</option>
                              <option value="Cheque">Cheque</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Card">Card</option>
                          </select>
                      </div>
                  </div>
                  
                  {formData.paymentType === 'Other' && (
                    <input name="customPaymentType" value={formData.customPaymentType} onChange={handleChange} className={`${inputClass} mt-2`} placeholder="Enter custom account description..." />
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className={labelClass}>Cheque / Ref No</label>
                        <input name="chequeNo" value={formData.chequeNo} onChange={handleChange} className={inputClass} placeholder="Optional" />
                      </div>
                      <div>
                        <label className={labelClass}>Dated (Optional)</label>
                        <input type="date" name="dated" value={formData.dated} onChange={handleChange} className={inputClass} />
                      </div>
                  </div>
              </div>
            </fieldset>

            <button 
              onClick={handlePrint} 
              disabled={serverError}
              className={`w-full mt-2 font-bold py-2.5 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all ${
                serverError 
                  ? "bg-gray-400 cursor-not-allowed text-gray-200" 
                  : (formData.status === 'CANCELLED' ? "bg-red-500 text-white cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white")
              }`}
            >
              {serverError ? <WifiOff size={18} /> : <Printer size={18} />} 
              {serverError ? "Offline" : (isEditing ? "Update & Print" : "Save & Print")}
            </button>
          </div>
        </div>

        <div className={`w-full lg:flex-1 rounded-xl p-6 overflow-x-auto flex justify-center items-start ${isDark ? "bg-gray-700/50" : "bg-gray-200"}`}>
          <div className="shadow-2xl" style={{ width: '754px', height: '533px', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: '794px', height: '561px', transform: 'scale(0.95)', transformOrigin: 'top left' }}>
              <div className="bg-white overflow-hidden" style={{ width: '794px', height: '561px' }}>
                <div
                  ref={componentRef}
                  className="print-container text-black font-sans bg-white"
                  style={{
                    width: '210mm',
                    height: '297mm',
                    padding: '5mm',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10mm'
                  }}
                >
                  <style type="text/css" media="print">
                    {tailwindStyles}
                    {`
                      @page {
                        size: A4 portrait;
                        margin: 0mm !important;
                      }
                      html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100%;
                        height: 100%;
                        background: white;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                      }
                      .print-container {
                        width: 100% !important;
                        height: 100% !important;
                        padding: 5mm !important;
                        box-sizing: border-box !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        background: white !important;
                      }
                      .receipt-half {
                        flex: 1 !important;
                        box-sizing: border-box !important;
                        display: flex !important;
                        flex-direction: column !important;
                        min-height: 0 !important;
                      }
                      .receipt-border {
                        border: 3px solid black !important;
                        border-radius: 8px !important;
                        flex: 1 !important;
                        padding: 3mm !important;
                        position: relative !important;
                        box-sizing: border-box !important;
                        overflow: hidden !important;
                        min-height: 0 !important;
                      }
                      .office-copy {
                        display: flex !important;
                        flex-direction: column !important;
                        flex: 1 !important;
                        min-height: 0 !important;
                      }
                    `}
                  </style>

                  <div className="receipt-half" style={{ flex: 1, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {renderReceiptContent('CUSTOMER COPY')}
                  </div>
                  <div className="office-copy" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      {renderReceiptContent('OFFICE COPY')}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`rounded-xl shadow-lg p-6 ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"}`}>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Archives</h2>
            <div className="flex gap-2 items-center flex-wrap">
                <div className={`flex items-center gap-1 p-1 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                  <input type="date" value={exportRange.from} onChange={(e)=>setExportRange({...exportRange, from: e.target.value})} className={`bg-transparent text-xs ${isDark ? 'text-white outline-none' : 'outline-none'}`} />
                  <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>TO</span>
                  <input type="date" value={exportRange.to} onChange={(e)=>setExportRange({...exportRange, to: e.target.value})} className={`bg-transparent text-xs ${isDark ? 'text-white outline-none' : 'outline-none'}`} />
                  <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-[10px] font-bold">EXPORT</button>
                </div>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr>
                        <th className={tableHeaderClass}>No</th>
                        <th className={tableHeaderClass}>Date</th>
                        <th className={tableHeaderClass}>Customer</th>
                        <th className={tableHeaderClass}>File No</th>
                        <th className={tableHeaderClass}>Amount</th>
                        <th className={tableHeaderClass}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map(item => (
                        <tr key={item.receipt_no} className={`${tableRowClass} group cursor-pointer ${item.status === 'CANCELLED' ? (isDark ? 'bg-red-900/20 hover:bg-red-900/40' : 'bg-red-50 hover:bg-red-100') : ''}`} onClick={() => handleEdit(item)}>
                            <td className="px-4 py-3">{item.receipt_no}</td>
                            <td className="px-4 py-3">{formatDate(item.date)}</td>
                            <td className="px-4 py-3 font-semibold">
                                {item.customer_name}
                                {item.status === 'CANCELLED' && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">CANCELLED</span>}
                            </td>
                            <td className="px-4 py-3">{item.file_no || '--'}</td>
                            <td className={`px-4 py-3 font-bold ${item.status === 'CANCELLED' ? 'text-gray-400 line-through' : 'text-green-600'}`}>₹{item.amount}</td>
                            <td className="px-4 py-3"><Edit3 size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );  
};

export default Receipt;