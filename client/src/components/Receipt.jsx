import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ToWords } from 'to-words';
import { Printer, RefreshCw, Edit3, XCircle, WifiOff, Calendar, X, Ban } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL;

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: { currency: false, ignoreDecimal: false, ignoreZeroCurrency: false, doNotAddOnly: true },
});

// --- Day Summary Modal ---
const DaySummaryModal = ({ isOpen, onClose }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/general-receipts/day-summary?date=${date}`);
            if(res.ok) setData(await res.json());
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { if(isOpen) fetchSummary(); }, [isOpen, date]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fadeIn">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <Calendar className="text-blue-600"/> Day Summary
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition">
                        <X size={24} className="text-gray-400 hover:text-gray-600"/>
                    </button>
                </div>
                
                <div className="mb-6">
                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Select Date</label>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={(e)=>setDate(e.target.value)} 
                        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                        <RefreshCw className="animate-spin mb-2" /> Loading data...
                    </div>
                ) : data ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                <div className="text-2xl font-bold text-blue-700">{data.booking_count}</div>
                                <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Bookings</div>
                            </div>
                            <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                                <div className="text-2xl font-bold text-green-700">{data.dp_bal_count}</div>
                                <div className="text-[10px] uppercase font-bold text-green-400 tracking-wider">DP + Balance</div>
                            </div>
                             <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                <div className="text-2xl font-bold text-purple-700">{data.other_count}</div>
                                <div className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Others</div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                             <div className="flex justify-between text-sm items-center">
                                <span className="text-gray-500 font-medium">Cash Collected</span>
                                <span className="font-bold text-gray-800">₹{(data.cash_total || 0).toLocaleString('en-IN')}</span>
                             </div>
                             <div className="flex justify-between text-sm items-center">
                                <span className="text-gray-500 font-medium">Card</span>
                                <span className="font-bold text-gray-800">₹{(data.card_total || 0).toLocaleString('en-IN')}</span>
                             </div>
                             <div className="flex justify-between text-sm items-center">
                                <span className="text-gray-500 font-medium">UPI / Online</span>
                                <span className="font-bold text-gray-800">₹{(data.upi_total || 0).toLocaleString('en-IN')}</span>
                             </div>
                             <div className="flex justify-between text-sm items-center">
                                <span className="text-gray-500 font-medium">Bank Transfer</span>
                                <span className="font-bold text-gray-800">₹{(data.bank_total || 0).toLocaleString('en-IN')}</span>
                             </div>
                             <div className="flex justify-between text-sm items-center">
                                <span className="text-gray-500 font-medium">Cheque</span>
                                <span className="font-bold text-gray-800">₹{(data.cheque_total || 0).toLocaleString('en-IN')}</span>
                             </div>
                             <div className="border-t border-gray-300 pt-3 mt-2 flex justify-between items-center">
                                 <span className="font-bold text-gray-800 uppercase text-xs tracking-widest">Total Collected</span>
                                 <span className="font-extrabold text-green-600 text-xl">₹{(data.total_amount || 0).toLocaleString('en-IN')}</span>
                             </div>
                        </div>
                    </div>
                ) : <div className="text-center py-8 text-gray-400">No data found for this date.</div>}
            </div>
        </div>
    );
};

const Receipt = ({ theme }) => {
  const isDark = theme === 'dark';
  const componentRef = useRef(null);

  const initialForm = {
    receiptNo: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    mobile: '',
    gstNo: '',
    fileNo: '',
    hp: '',
    model: '',
    amount: '',
    paymentType: 'Booking',
    customPaymentType: '',
    paymentMode: 'Cash',
    dated: '', 
    paymentDate: '',
    chequeNo: '',
    status: 'ACTIVE'
  };

  const [formData, setFormData] = useState(initialForm);
  const [isEditing, setIsEditing] = useState(false);
  const [history, setHistory] = useState([]); 
  const [availableMonths, setAvailableMonths] = useState([]);
  const [exportRange, setExportRange] = useState({ from: '', to: '' });
  const [serverError, setServerError] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const getFyPrefix = () => {
      const now = new Date();
      return String(now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear()).slice(-2);
  };

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
      setFormData(prev => ({ ...prev, receiptNo: String(data.nextNo || '---') }));
      setServerError(false); 
    } catch (err) { 
      setFormData(prev => ({ ...prev, receiptNo: 'OFFLINE' })); 
      setServerError(true); 
    }
  };

  const fetchHistory = async (query = '') => {
    try {
      let url = `${API_URL}/general-receipts/list`;
      if (query) url += `?search=${query}`;

      const res = await fetch(url);
      if (!res.ok) {
        setHistory([]); 
        setServerError(true); 
        return;
      }
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
          receiptNo: formData.receiptNo 
      });
      setIsEditing(false);
      fetchNextReceiptNo();
  };

  const cancelEdit = () => {
    resetForm();
  };

  // Helper: Convert raw 252253 to VMA2025/2253
  const formatFileNumber = (raw) => {
      const clean = raw.replace(/[^0-9]/g, '');
      if (clean.length === 6) {
          const prefix = clean.substring(0, 2); // e.g. 25
          const suffix = clean.substring(2);    // e.g. 2253
          return `VMA20${prefix}/${suffix}`;
      }
      return raw;
  };

  const handleFileChange = (e) => {
    let rawInput = e.target.value;
    
    // Just allow typing, no spaces forced in UI if user wants tight input
    setFormData(prev => ({ ...prev, fileNo: rawInput }));

    const cleanVal = rawInput.replace(/\s/g, '');
    
    // Search Logic
    if (Array.isArray(history) && cleanVal.length >= 6) {
      const formattedSearch = formatFileNumber(cleanVal);
      
      // Search for exact match on VMA format OR raw input match
      const match = history.find(item => 
          item.file_no === formattedSearch || 
          item.file_no === cleanVal
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

  const handleEdit = (item) => {
    if (serverError) return alert("System is offline. Cannot edit receipts.");

    setFormData({
        receiptNo: item.receipt_no,
        date: item.date ? item.date.substring(0, 10) : new Date().toISOString().split('T')[0],
        customerName: item.customer_name,
        mobile: item.mobile || '',
        gstNo: item.gst_no || '',
        fileNo: item.file_no || '', 
        hp: item.hp_financier || '',
        model: item.model || '',
        amount: item.amount,
        paymentType: ['Booking', 'Down Payment', 'Balance Payment'].includes(item.payment_type) ? item.payment_type : 'Other',
        customPaymentType: !['Booking', 'Down Payment', 'Balance Payment'].includes(item.payment_type) ? item.payment_type : '',
        paymentMode: item.payment_mode || 'Cash',
        dated: item.dated ? item.dated.substring(0, 10) : '',
        paymentDate: item.payment_date ? item.payment_date.substring(0, 10) : '',
        chequeNo: item.cheque_no || '',
        status: item.status || 'ACTIVE'
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelReceipt = async () => {
      if(!window.confirm("Are you sure you want to CANCEL this receipt? This will be watermarked.")) return;
      const updatedForm = { ...formData, status: 'CANCELLED' };
      setFormData(updatedForm);
      await saveToDb(updatedForm);
  };

  const saveToDb = async (dataOverride = null) => {
    if (serverError) return alert("System Offline: Cannot save data.");

    const dataToSave = dataOverride || formData;
    
    // Auto-Format File No before save (252253 -> VMA2025/2253)
    let finalFileNo = dataToSave.fileNo.trim();
    if(finalFileNo.length === 6 && !isNaN(finalFileNo)) {
        finalFileNo = formatFileNumber(finalFileNo);
    }

    const method = isEditing ? 'PUT' : 'POST';
    const finalPaymentType = dataToSave.paymentType === 'Other' ? dataToSave.customPaymentType : dataToSave.paymentType;
    const url = isEditing ? `${API_URL}/general-receipts/${dataToSave.receiptNo}` : `${API_URL}/general-receipts`;
    
    try {
      await fetch(url, {
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
          dated: dataToSave.dated || null,
          payment_date: dataToSave.paymentDate || null,
          cheque_no: dataToSave.chequeNo || null,
          status: dataToSave.status || 'ACTIVE'
        })
      });
      
      fetchHistory();
      fetchAvailableMonths();

      if (isEditing) {
        if(dataOverride?.status === 'CANCELLED') resetForm();
        else resetForm();
      } else {
        setFormData(prev => ({ ...initialForm, date: prev.date, receiptNo: prev.receiptNo }));
        await fetchNextReceiptNo();
      }
    } catch (err) { 
      alert("Error saving receipt. Please check connection."); 
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Receipt_${formData.receiptNo}`,
    onBeforeGetContent: () => {
        if (serverError) {
          alert("System Offline: Cannot print.");
          return Promise.reject();
        }
        if (!formData.amount || isNaN(formData.amount)) {
            alert("Please enter a valid amount.");
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

    const dataToExport = data.map(item => ({
        "Receipt No": item.receipt_no,
        "Status": item.status || 'ACTIVE',
        "Date": formatDate(item.date),
        "Customer": item.customer_name,
        "Mobile": item.mobile,
        "GST": item.gst_no,
        "File No": item.file_no,
        "Amount": item.amount,
        "Type": item.payment_type,
        "Mode": item.payment_mode,
        "Cheque No": item.cheque_no
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receipts");
    XLSX.writeFile(workbook, `Receipts_Report.xlsx`);
  };

  const amountInWords = formData.amount && !isNaN(formData.amount) 
    ? toWords.convert(formData.amount).toUpperCase() + " ONLY" 
    : 'ZERO ONLY';

  const hasValue = (val) => val && val.trim().length > 0;

  // COMPACT STYLING
  const inputClass = `w-full p-1.5 rounded border text-sm ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`;
  const labelClass = `block text-[10px] font-bold uppercase mb-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const tableHeaderClass = `px-4 py-2 text-left text-xs font-semibold ${isDark ? "text-gray-300 bg-gray-700" : "text-gray-600 bg-gray-100"}`;
  const tableRowClass = `border-b ${isDark ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"} transition-colors`;

  const renderReceiptContent = (copyTitle) => (
    <div className="flex flex-col h-full relative">
        <div className="text-right font-bold text-xs uppercase mb-1 tracking-widest text-gray-500 pr-1">
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

          <div className="flex justify-between items-start mb-1 relative z-10">
              <div className="w-[45%]">
                <img src="/suzuki-logo.png" alt="Suzuki" style={{width:'200px'}} />
                <div className="text-sm font-bold mt-1">GST NO: 29AACCV2521J1ZA</div>
              </div>
              <div className="w-[55%] text-right">
                    <h1 className="text-2xl font-bold uppercase leading-tight">VALUE MOTOR AGENCY PVT LTD</h1>
                    <p className="text-xs font-bold mt-1">#16/A, MILLERS ROAD, VASANTH NAGAR, BANGALORE - 52</p>
                    <p className="text-xs font-bold">Mob: 9845906084 | Email: millers_road_suzuki@yahoo.com</p>
              </div> 
          </div>

          <div className="flex justify-center mb-2">
            <div className="border-b-2 border-black w-full text-center py-1">
              <span className="text-3xl font-bold uppercase tracking-[0.2em]">RECEIPT</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-3 text-base font-bold relative z-10">
            <div>NO: <span className="text-red-600 text-2xl ml-2">{formData.receiptNo}</span></div>
            
            <div className="flex items-center gap-8">
                {hasValue(formData.fileNo) && (
                    <div className="text-base font-bold text-gray-800">
                        {/* Auto-format display on receipt too if it's raw number */}
                        File Number: <span className="ml-1">{
                            !isNaN(formData.fileNo) && formData.fileNo.length === 6 
                            ? formatFileNumber(formData.fileNo) 
                            : formData.fileNo
                        }</span>
                    </div>
                )}
                <div>DATE: <span className="ml-2 text-xl">{formatDate(formData.date)}</span></div>
            </div>
          </div>

          <div className="flex flex-col flex-grow justify-between text-sm leading-snug relative z-10 px-1">
              
              <div className="flex items-end mb-1">
                <span className="font-bold mr-2 whitespace-nowrap text-sm">RECEIVED WITH THANKS FROM:</span>
                <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-xl uppercase">{formData.customerName}</span>
              </div>

              {(hasValue(formData.mobile) || hasValue(formData.model)) && (
                <div className="flex items-end mb-1 w-full gap-4">
                    {hasValue(formData.mobile) && (
                      <div className="flex items-end w-1/2">
                        <span className="font-bold mr-2 whitespace-nowrap text-sm">MOBILE NO:</span>
                        <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-xl">{formData.mobile}</span>
                      </div>
                    )}
                    {hasValue(formData.model) && (
                      <div className="flex items-end w-1/2">
                        <span className="font-bold mr-2 whitespace-nowrap text-sm">MODEL:</span>
                        <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-xl uppercase">{formData.model}</span>
                      </div>
                    )}
                </div>
              )}

              {(hasValue(formData.hp) || hasValue(formData.gstNo)) && (
                <div className="flex items-end mb-1 w-full gap-4">
                  {hasValue(formData.hp) && (
                    <div className="flex items-end w-1/2">
                        <span className="font-bold mr-2 whitespace-nowrap text-sm">H.P. TO:</span>
                        <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-lg uppercase">{formData.hp}</span>
                    </div>
                  )}
                  {hasValue(formData.gstNo) && (
                    <div className="flex items-end w-1/2">
                        <span className="font-bold mr-2 whitespace-nowrap text-sm">GST NO:</span>
                        <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-lg uppercase">{formData.gstNo}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col mb-1">
                <span className="font-bold whitespace-nowrap text-xs mb-1">THE SUM OF RUPEES:</span>
                <div className="border-b border-dotted border-black px-2 font-bold text-xl italic uppercase break-words leading-tight min-h-[2rem] flex items-end">
                    {amountInWords}
                </div>
              </div>

              <div className="flex items-end mb-1">
                    <span className="font-bold mr-2 whitespace-nowrap text-sm">ON ACCOUNT OF:</span>
                    <span className="border-b border-dotted border-black px-4 font-bold text-xl uppercase">
                      {formData.paymentType === 'Other' ? formData.customPaymentType : formData.paymentType}
                    </span>
              </div>
          </div>

          <div className="mt-2 flex items-end justify-between relative z-10">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <div className="border-2 border-black px-4 py-2 text-2xl font-bold bg-gray-50 whitespace-nowrap">
                    ₹ {Number(formData.amount).toLocaleString('en-IN')}/-
                </div>
                <div className="italic font-bold text-sm mt-2 whitespace-nowrap">
                    by way of {formData.paymentMode}
                </div>
              </div>

              {(hasValue(formData.chequeNo) || hasValue(formData.dated)) && (
                <div className="flex flex-col text-xs font-semibold gap-0.5 mt-1">
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
                <div className="text-xs mb-8"> 
                    <span className="font-medium">For</span> <span className="font-bold uppercase text-sm">VALUE MOTOR AGENCY PVT LTD</span>
                </div>
                <div className="text-xs border-t border-black inline-block px-6 pt-1 font-bold">Authorised Signatory</div>
            </div>
          </div>

          <div className="mt-2 pt-1 border-t-2 border-gray-400">
            <div className="text-[10px] font-bold text-gray-800 uppercase leading-tight">
                WE BANK WITH STATE BANK OF INDIA | A/C NO: 32744599339 | IFSC: SBIN0021882 |  BRANCH: VASANTHNAGAR
            </div>
            <div className="text-[9px] font-extrabold text-black uppercase mt-1">
                NOTE: CHEQUES SUBJECT TO REALISATION. PRICES PREVAILING AT THE TIME OF DELIVERY APPLICABLE. ANY CANCELLATION SUBJECT TO 10% DEDUCTION.
            </div>
          </div>

        </div>
    </div>
  );

  return (
    <div className="container mx-auto p-2 md:p-4 max-w-7xl">
      <DaySummaryModal isOpen={showSummary} onClose={() => setShowSummary(false)} />

      {/* Main Layout */}
      <div className="flex flex-col xl:flex-row gap-4 mb-8">
        
        {/* LEFT PANEL: Form */}
        <div className={`w-full xl:w-1/3 p-4 rounded-xl shadow-lg h-fit ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"}`}>
          
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
                {isEditing ? "Edit Receipt" : "Receipt Details"}
            </h2>
            <div className="flex gap-2">
                {/* Day Summary Button moved here for compactness */}
                <button onClick={() => setShowSummary(true)} className="p-1.5 rounded hover:bg-purple-100 text-purple-600 transition" title="View Day Summary">
                    <Calendar size={16} />
                </button>

                {isEditing && (
                    <>
                        <button onClick={handleCancelReceipt} className="bg-red-100 text-red-600 hover:bg-red-200 p-1.5 rounded transition" title="Cancel Receipt">
                            <Ban size={16} />
                        </button>
                        <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 p-1.5 rounded transition" title="Close Edit"><XCircle size={16} /></button>
                    </>
                )}
                <button onClick={resetForm} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition" title="Clear & Reset"><RefreshCw size={16} /></button>
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
                     <input 
                        name="fileNo" 
                        value={formData.fileNo} 
                        onChange={handleFileChange} 
                        className={`${inputClass} font-mono tracking-wide`} 
                        placeholder="252253" 
                     />
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

        {/* RIGHT PANEL: Preview */}
        <div className={`w-full xl:w-2/3 rounded-xl p-6 overflow-x-auto flex justify-center items-start ${isDark ? "bg-gray-700/50" : "bg-gray-200"}`}>

          {/* ── Print Styles ── */}
          <style type="text/css" media="print">
            {`
              @page {
                size: A4 portrait;
                margin: 0;
              }
              html, body {
                margin: 0;
                padding: 0;
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
              body > *:not(.print-container) { display: none !important; }
            `}
          </style>

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
              <div
                className="receipt-half"
                style={{ flex: 1, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: 0 }}
              >
                {renderReceiptContent('CUSTOMER COPY')}
              </div>
              <div
                className="office-copy"
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
              >
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
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700 p-1 rounded border border-gray-300">
                  <input type="date" value={exportRange.from} onChange={(e)=>setExportRange({...exportRange, from: e.target.value})} className="bg-transparent text-xs" />
                  <span className="text-[10px]">TO</span>
                  <input type="date" value={exportRange.to} onChange={(e)=>setExportRange({...exportRange, to: e.target.value})} className="bg-transparent text-xs" />
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
                        <tr key={item.receipt_no} className={`${tableRowClass} group cursor-pointer ${item.status === 'CANCELLED' ? 'bg-red-50 hover:bg-red-100' : ''}`} onClick={() => handleEdit(item)}>
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