import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ToWords } from 'to-words';
import { Printer, RefreshCw, Search, Edit3, XCircle, AlertTriangle, WifiOff } from 'lucide-react';
import * as XLSX from 'xlsx';

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
    fileNo: '',
    hp: '',
    model: '',
    amount: '',
    paymentType: 'Booking',
    customPaymentType: '',
    paymentMode: 'Cash',
    paymentDate: ''
  };

  const [formData, setFormData] = useState(initialForm);
  const [isEditing, setIsEditing] = useState(false);
  const [history, setHistory] = useState([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [exportRange, setExportRange] = useState({ from: '', to: '' });
  const [authError, setAuthError] = useState(false);
  const [serverError, setServerError] = useState(false);

  // --- SAFE API CALLS ---
  
  const fetchNextReceiptNo = async () => {
    try {
      const res = await fetch(`${API_URL}/general-receipts/next`);
      if (res.status === 401) return setAuthError(true);
      if (!res.ok) throw new Error("Server Error");
      
      const data = await res.json();
      setFormData(prev => ({ ...prev, receiptNo: String(data.nextNo || '---') }));
      setServerError(false); 
    } catch (err) { 
      console.error("Failed to fetch next receipt no:", err);
      setFormData(prev => ({ ...prev, receiptNo: 'OFFLINE' })); 
      setServerError(true); 
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/general-receipts/list`);
      if (res.status === 401) return setAuthError(true);
      if (!res.ok) {
        console.error("History fetch failed:", res.status);
        setHistory([]); 
        setServerError(true); 
        return;
      }
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
      setServerError(false);
    } catch (err) { 
      console.error("History network error:", err);
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
      console.error("Months fetch error:", err);
      setAvailableMonths([]);
    }
  };

  useEffect(() => {
    fetchNextReceiptNo();
    fetchHistory();
    fetchAvailableMonths();
  }, []);

  // --- HANDLERS ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileSearch = (e) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, fileNo: val }));
    if (Array.isArray(history)) {
      const match = history.find(item => item.file_no && item.file_no.toLowerCase() === val.toLowerCase());
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
        date: new Date(item.date).toISOString().split('T')[0],
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
        paymentDate: item.payment_date ? new Date(item.payment_date).toISOString().split('T')[0] : ''
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setFormData(initialForm);
    fetchNextReceiptNo();
  };

  const saveToDb = async () => {
    if (serverError) return alert("System Offline: Cannot save data.");

    const method = isEditing ? 'PUT' : 'POST';
    const finalPaymentType = formData.paymentType === 'Other' ? formData.customPaymentType : formData.paymentType;
    const url = isEditing ? `${API_URL}/general-receipts/${formData.receiptNo}` : `${API_URL}/general-receipts`;
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_no: formData.receiptNo,
          date: formData.date,
          customer_name: formData.customerName,
          mobile: formData.mobile,
          gst_no: formData.gstNo,
          file_no: formData.fileNo,
          hp_financier: formData.hp,
          model: formData.model,
          amount: formData.amount,
          payment_type: finalPaymentType,
          payment_mode: formData.paymentMode,
          payment_date: formData.paymentDate || null
        })
      });
      
      if (res.status === 401) return setAuthError(true);
      if (!res.ok) throw new Error("Save failed");

      await fetchHistory();
      await fetchAvailableMonths();

      if (isEditing) {
        setIsEditing(false);
        setFormData(initialForm);
        fetchNextReceiptNo();
      } else {
        setFormData(prev => ({ ...initialForm, date: prev.date }));
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
    onAfterPrint: saveToDb
  });

  const handleExport = () => {
    let data = history;
    if (exportRange.from && exportRange.to) {
      data = history.filter(item => {
        const d = new Date(item.date).getTime();
        return d >= new Date(exportRange.from).getTime() && d <= new Date(exportRange.to).getTime();
      });
    }

    const dataToExport = data.map(item => ({
        "Receipt No": item.receipt_no,
        "Date": new Date(item.date).toLocaleDateString(),
        "Customer": item.customer_name,
        "Mobile": item.mobile,
        "GST": item.gst_no,
        "File No": item.file_no,
        "Amount": item.amount,
        "Type": item.payment_type,
        "Mode": item.payment_mode
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receipts");
    XLSX.writeFile(workbook, `Receipts_Report.xlsx`);
  };

  const amountInWords = formData.amount && !isNaN(formData.amount) 
    ? toWords.convert(formData.amount).toUpperCase() + " ONLY" 
    : 'ZERO ONLY';

  const filteredHistory = useMemo(() => {
    if (!Array.isArray(history)) return [];
    
    const lower = searchTerm.toLowerCase();
    return history.filter(item => 
        (item.customer_name?.toLowerCase() || '').includes(lower) || 
        String(item.receipt_no || '').includes(lower) ||
        String(item.file_no || '').toLowerCase().includes(lower)
    );
  }, [history, searchTerm]);

  const hasValue = (val) => val && val.trim().length > 0;

  const inputClass = `w-full p-2 rounded border text-sm ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`;
  const labelClass = `block text-xs font-bold uppercase mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const tableHeaderClass = `px-4 py-2 text-left text-xs font-semibold ${isDark ? "text-gray-300 bg-gray-700" : "text-gray-600 bg-gray-100"}`;
  const tableRowClass = `border-b ${isDark ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"} transition-colors`;

  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-800"}`}>Session Expired</h2>
        <p className="text-gray-500 mb-6">Your session has timed out. Please sign in again.</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Reload Page</button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        {/* FORM SIDE */}
        <div className={`w-full lg:w-1/3 p-6 rounded-xl shadow-lg h-fit ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"}`}>
          
          {serverError && (
            <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md animate-pulse">
              <div className="flex items-center gap-2">
                <WifiOff size={20} />
                <p className="font-bold">System Offline</p>
              </div>
              <p className="text-xs mt-1">Server connection failed. Data entry is disabled.</p>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>{isEditing ? "📝 Edit Receipt" : "Receipt Details"}</h2>
            <div className="flex gap-2">
                {isEditing && <button onClick={cancelEdit} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs font-bold uppercase"><XCircle size={16} /> Cancel</button>}
                <button onClick={fetchNextReceiptNo} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition"><RefreshCw size={16} /></button>
            </div>
          </div>
          
          <div className="space-y-3">
            <fieldset disabled={serverError} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelClass}>Receipt No</label><input name="receiptNo" value={formData.receiptNo} readOnly className={`${inputClass} opacity-70`} /></div>
                  <div><label className={labelClass}>Date</label><input type="date" name="date" value={formData.date} onChange={handleChange} className={inputClass} /></div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 <div><label className={labelClass}>File No (Search)</label><input name="fileNo" value={formData.fileNo} onChange={handleFileSearch} className={inputClass} /></div>
                 <div><label className={labelClass}>Amount (₹)</label><input type="number" name="amount" value={formData.amount} onChange={handleChange} className={inputClass} /></div>
              </div>

              <div><label className={labelClass}>Customer Name</label><input name="customerName" value={formData.customerName} onChange={handleChange} className={inputClass} /></div>
              
              {/* Changed order: Mobile & Model first, then HP, then GST last */}
              <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelClass}>Mobile Number</label><input name="mobile" value={formData.mobile} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>Model</label><input name="model" value={formData.model} onChange={handleChange} className={inputClass} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelClass}>HP To</label><input name="hp" value={formData.hp} onChange={handleChange} className={inputClass} /></div>
                  <div><label className={labelClass}>Customer GST</label><input name="gstNo" value={formData.gstNo} onChange={handleChange} className={inputClass} /></div>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 mb-2 font-semibold">Payment Details</p>
                  <div className="grid grid-cols-2 gap-3">
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
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Card">Card</option>
                          </select>
                      </div>
                  </div>
                  {formData.paymentType === 'Other' && (
                    <input name="customPaymentType" value={formData.customPaymentType} onChange={handleChange} className={`${inputClass} mt-2`} placeholder="Enter custom account description..." />
                  )}
              </div>
            </fieldset>

            <button 
              onClick={handlePrint} 
              disabled={serverError}
              className={`w-full mt-4 font-bold py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all ${
                serverError 
                  ? "bg-gray-400 cursor-not-allowed text-gray-200" 
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {serverError ? <WifiOff size={20} /> : <Printer size={20} />} 
              {serverError ? "System Offline" : (isEditing ? "Update & Print" : "Save & Print")}
            </button>
          </div>
        </div>

        {/* PRINT PREVIEW */}
        <div className={`w-full lg:w-2/3 rounded-xl p-4 overflow-auto flex justify-center items-start ${isDark ? "bg-gray-700/50" : "bg-gray-200"}`}>
           <style type="text/css" media="print">
               {` 
                  @page { 
                    size: A5 landscape; 
                    margin: 0; 
                  } 
                  html, body { 
                    margin: 0; 
                    padding: 0; 
                    background: white; 
                  } 
                  .print-container { 
                    width: 210mm !important; 
                    height: 148.5mm !important; 
                    padding: 5mm !important; 
                    box-sizing: border-box !important;
                    page-break-after: avoid;
                  } 
                  .receipt-border {
                    border: 2px solid black !important;
                    border-radius: 8px !important;
                    height: 98% !important;
                    padding: 8mm !important;
                    position: relative !important;
                    box-sizing: border-box !important;
                  }
               `}
           </style>
           
           <div className="transform scale-[0.8] lg:scale-100 origin-top bg-white shadow-2xl print-container" style={{ width: '210mm', height: '148.5mm', padding: '5mm' }}>
              <div ref={componentRef} className="receipt-border text-black font-sans relative flex flex-col h-full" style={{ border: '2px solid black', borderRadius: '8px', padding: '8mm' }}>
                  
                  {/* Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05]">
                    <img src="/suzuki-logo.png" alt="" className="w-1/2" />
                  </div>

                  {/* Header */}
                  <div className="flex justify-between items-start mb-2 relative z-10">
                      <div className="w-[45%]">
                        <img src="/suzuki-logo.png" alt="Suzuki" style={{width:'180px'}} />
                        <div className="text-[11px] font-bold mt-1">GST NO: 29AACCV2521J1ZA</div>
                      </div>
                      <div className="w-[55%] text-right">
                           <h1 className="text-lg font-extrabold uppercase">VALUE MOTOR AGENCY PVT LTD</h1>
                           <p className="text-[10px] font-bold">#16/A, MILLERS ROAD, VASANTH NAGAR, BANGALORE - 52</p>
                           <p className="text-[10px] font-bold">Mob No: 9845906084 | Email: millers_road_suzuki@yahoo.com</p>
                      </div> 
                  </div>

                  <div className="flex justify-center mb-3">
                    <div className="border-b border-black w-full text-center py-1">
                      <span className="text-3xl font-bold uppercase tracking-[0.2em]">RECEIPT</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-4 text-sm font-bold relative z-10">
                    <div>NO: <span className="text-red-600 text-lg ml-1">{formData.receiptNo}</span></div>
                    
                    {/* File Number (No Box) and Date */}
                    <div className="flex items-center gap-6">
                        {hasValue(formData.fileNo) && (
                            <div className="text-sm font-bold text-gray-800">
                                File Number: <span className="ml-1">VMA{formData.fileNo}</span>
                            </div>
                        )}
                        <div>DATE: <span className="ml-1 text-base">{new Date(formData.date).toLocaleDateString('en-GB')}</span></div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-y-2 text-sm leading-relaxed relative z-10 flex-grow">
                      
                      {/* Row 1: Name */}
                      <div className="flex items-end">
                        <span className="font-bold mr-2 whitespace-nowrap">RECEIVED WITH THANKS FROM:</span>
                        <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-base uppercase">{formData.customerName}</span>
                      </div>

                      {/* Row 2: Mobile + Model */}
                      <div className="flex items-end gap-6">
                        {hasValue(formData.mobile) && (
                          <div className="flex items-end flex-1">
                              <span className="font-bold mr-2 whitespace-nowrap">MOBILE NO:</span>
                              <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-base">{formData.mobile}</span>
                          </div>
                        )}
                        {hasValue(formData.model) && (
                            <div className="flex items-end flex-1">
                                <span className="font-bold mr-2 whitespace-nowrap">MODEL:</span>
                                <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-sm uppercase">{formData.model}</span>
                            </div>
                        )}
                      </div>

                      {/* Row 3: HP + GST */}
                      <div className="flex items-end gap-6">
                        {hasValue(formData.hp) && (
                          <div className="flex items-end flex-1">
                            <span className="font-bold mr-2 whitespace-nowrap">H.P. TO:</span>
                            <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-sm uppercase">{formData.hp}</span>
                          </div>
                        )}
                        {hasValue(formData.gstNo) && (
                          <div className="flex items-end flex-1">
                              <span className="font-bold mr-2 whitespace-nowrap">GST NO:</span>
                              <span className="border-b border-dotted border-black flex-grow px-2 font-bold text-sm uppercase">{formData.gstNo}</span>
                          </div>
                        )}
                      </div>

                      <br className="hidden print:block" />
                      
                      <div className="flex flex-col">
                        <span className="font-bold whitespace-nowrap text-xs mb-1">THE SUM OF RUPEES:</span>
                        <div className="border-b border-dotted border-black px-2 font-bold text-lg italic uppercase break-words leading-tight">
                            {amountInWords}
                        </div>
                      </div>

                      <div className="flex items-end mt-2">
                            <span className="font-bold mr-2 whitespace-nowrap">ON ACCOUNT OF:</span>
                            <span className="border-b border-dotted border-black px-8 font-bold text-sm uppercase">
                              {formData.paymentType === 'Other' ? formData.customPaymentType : formData.paymentType}
                            </span>
                      </div>
                  </div>

                  {/* Amount Box & Signatory */}
                  <div className="mt-2 flex items-end justify-between relative z-10">
                    <div className="flex items-center">
                      <div className="border border-black px-4 py-2 text-xl font-bold">
                          ₹ {Number(formData.amount).toLocaleString('en-IN')}/-
                      </div>
                      <div className="ml-4 italic font-bold text-sm">by way of {formData.paymentMode}</div>
                    </div>

                    {/* QR Code Placeholder */}
                    <div className="w-14 h-14 border border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-300 text-center leading-tight">
                      RESERVED<br/>DIGITAL
                    </div>
                    
                    <div className="text-center">
                        <div className="text-[12px] mb-8">
                            <span className="font-medium">For</span> <span className="font-bold uppercase text-sm">VALUE MOTOR AGENCY PVT LTD</span>
                        </div>
                        <div className="text-[12px] border-t border-black inline-block px-4 pt-1 text-xs font-bold">Authorised Signatory</div>
                    </div>
                  </div>

                  {/* Footer Disclaimer */}
                  <div className="mt-4 pt-2 border-t border-gray-800">
                    <div className="text-[9px] font-bold text-gray-800 uppercase leading-tight mb-1">
                        WE BANK WITH STATE BANK OF INDIA | A/C: 121236276 | IFSC: SBIN1289812 | VASANTHNAGAR
                    </div>
                    <div className="text-[8px] font-extrabold text-black uppercase">
                        NOTE: PRICES PREVAILING AT THE TIME OF DELIVERY APPLICABLE. ANY CANCELLATION SUBJECT TO 10% DEDUCTION.
                    </div>
                  </div>

              </div>
           </div>
        </div>
      </div>

      {/* HISTORY Archives */}
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
                <div className="relative">
                  <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${inputClass} w-48 pl-8`} placeholder="Search..." />
                  <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
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
                    {filteredHistory.map(item => (
                        <tr key={item.receipt_no} className={`${tableRowClass} group cursor-pointer`} onClick={() => handleEdit(item)}>
                            <td className="px-4 py-3">{item.receipt_no}</td>
                            <td className="px-4 py-3">{new Date(item.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-semibold">{item.customer_name}</td>
                            <td className="px-4 py-3">{item.file_no || '--'}</td>
                            <td className="px-4 py-3 text-green-600 font-bold">₹{item.amount}</td>
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