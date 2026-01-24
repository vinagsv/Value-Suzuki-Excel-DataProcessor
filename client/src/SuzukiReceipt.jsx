import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ToWords } from 'to-words';
import { Printer, RefreshCw, FileSpreadsheet, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL;

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: {
    currency: false,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: true,
  },
});

const SuzukiReceipt = ({ theme }) => {
  const isDark = theme === 'dark';
  const componentRef = useRef(null);
  
  const LAYOUT = {
    pagePadding: '20mm',
    logoHeight: '200',
    logoWidth: 'auto',
    logoMarginBottom: '2',
    logoVerticalOffset: '-73',
    headerMarginBottom: '8',
    companyNameSize: '2xl',
    addressTextSize: 'base',
    titleMarginBottom: '8',
    titleTextSize: 'xl',
    bodySpacing: '6',
    bodyTextSize: 'base',
    footerMarginTop: '32',
    disclaimerMarginTop: '12',
    amountBoxPaddingX: '6',
    amountBoxPaddingY: '3',
    amountBoxMarginLeft: '8',
  };

  const [formData, setFormData] = useState({
    receiptNo: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    hp: 'IDFC FIRST BANK LTD',
    model: 'ACCESS 125 RC (BT)',
    amount: '',
    paymentMode: 'Cash'
  });

  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Export States
  const [availableMonths, setAvailableMonths] = useState([]);
  const [exportMonth, setExportMonth] = useState('');

  // --- API Calls ---

  const fetchNextReceiptNo = async () => {
    try {
      const res = await fetch(`${API_URL}/receipts/next`);
      const data = await res.json();
      setFormData(prev => ({ ...prev, receiptNo: String(data.nextNo) }));
    } catch (err) {
      console.error("Error fetching receipt number", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/receipts/list`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Error fetching history", err);
    }
  };

  const fetchAvailableMonths = async () => {
    try {
      const res = await fetch(`${API_URL}/receipts/months`);
      if (res.ok) {
        const data = await res.json();
        setAvailableMonths(data);
      }
    } catch (err) {
      console.error("Error fetching months", err);
    }
  };

  useEffect(() => {
    fetchNextReceiptNo();
    fetchHistory();
    fetchAvailableMonths();
  }, []);

  // --- Handlers ---

  const handleChange = (e) => {
    const { name, value } = e.target;
    const finalValue = name === 'hp' ? value.toUpperCase() : value;

    setFormData({ ...formData, [name]: finalValue });
  };

  const saveToDb = async () => {
    try {
      await fetch(`${API_URL}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          customer_name: formData.customerName,
          amount: formData.amount,
          payment_mode: formData.paymentMode, 
          hp_financier: formData.hp,
          model: formData.model
        })
      });
      
      setFormData(prev => ({
        ...prev,
        amount: '',
        customerName: ''
      }));

      await fetchNextReceiptNo();
      await fetchHistory();
      await fetchAvailableMonths();
    } catch (err) {
      console.error("Failed to save receipt", err);
      alert("Error saving receipt to database.");
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Receipt_${formData.receiptNo}`,
    onBeforeGetContent: () => {
        if (!formData.amount || isNaN(formData.amount)) {
            alert("Please enter a valid amount before printing.");
            return Promise.reject("Invalid Amount");
        }
    },
    removeAfterPrint: true,
    onAfterPrint: saveToDb
  });

  // --- Helper Logic ---

  const amountInWords = formData.amount && !isNaN(formData.amount)
    ? toWords.convert(formData.amount).toUpperCase() + " ONLY"
    : 'ZERO ONLY';

  // --- Export & Filter Logic ---

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return history;
    const lowerSearch = searchTerm.toLowerCase();
    return history.filter(item => 
      item.customer_name?.toLowerCase().includes(lowerSearch) ||
      String(item.receipt_no).includes(lowerSearch)
    );
  }, [history, searchTerm]);

  const processExport = (data, filename) => {
    if (!data || data.length === 0) return alert("No data to export");
    const dataToExport = data.map(item => ({
      "Receipt No": item.receipt_no,
      "Date": new Date(item.date).toLocaleDateString(),
      "Customer Name": item.customer_name,
      "Model": item.model,
      "Financier": item.hp_financier,
      "Amount": item.amount,
      "Mode": item.payment_mode
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receipts");
    XLSX.writeFile(workbook, filename);
  };

  const handleExport = async () => {
    if (exportMonth) {
        try {
            const res = await fetch(`${API_URL}/receipts/list?month=${exportMonth}`);
            const data = await res.json();
            processExport(data, `Receipts_Export_${exportMonth}.xlsx`);
        } catch (err) {
            alert("Failed to fetch monthly data");
            console.error(err);
        }
    } else {
        processExport(filteredHistory, "Receipts_Export_Recent.xlsx");
    }
  };

  // --- Styles ---
  const inputClass = `w-full p-2 rounded border text-sm ${
    isDark 
      ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500" 
      : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
  } focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors`;

  const labelClass = `block text-xs font-bold uppercase mb-1 ${
    isDark ? "text-gray-400" : "text-gray-600"
  }`;

  const tableHeaderClass = `px-4 py-2 text-left text-xs font-semibold ${
    isDark ? "text-gray-300 bg-gray-700" : "text-gray-600 bg-gray-100"
  }`;
  
  const tableRowClass = `border-b ${
    isDark ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"
  } transition-colors`;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        
        {/* --- LEFT: INPUT FORM --- */}
        <div className={`w-full lg:w-1/3 p-6 rounded-xl shadow-lg h-fit ${isDark ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Receipt Details</h2>
            <button onClick={fetchNextReceiptNo} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition" title="Refresh Number">
              <RefreshCw size={16} />
            </button>
          </div>
          
          <div className="space-y-3">
            <div><label className={labelClass}>Customer Name</label><input name="customerName" value={formData.customerName} onChange={handleChange} className={inputClass} placeholder="Ex: Vinag S V" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>Amount (₹)</label><input type="number" name="amount" value={formData.amount} onChange={handleChange} className={inputClass} /></div>
              <div><label className={labelClass}>Date</label><input type="date" name="date" value={formData.date} onChange={handleChange} className={inputClass} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3"><div><label className={labelClass}>Receipt No</label><input type="number" name="receiptNo" value={formData.receiptNo} readOnly className={`${inputClass} opacity-70 cursor-not-allowed`} /></div></div>
            <div><label className={labelClass}>HP (Financier)</label><input name="hp" value={formData.hp} onChange={handleChange} className={inputClass} /></div>
            <div><label className={labelClass}>Model</label><input name="model" value={formData.model} onChange={handleChange} className={inputClass} /></div>
            <button onClick={handlePrint} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all">
              <Printer size={20} /> Save & Print Receipt
            </button>
          </div>
        </div>

        {/* --- RIGHT: PREVIEW AREA --- */}
        <div className={`w-full lg:w-2/3 rounded-xl p-1 overflow-auto flex justify-center ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
           <div className="transform scale-[0.6] md:scale-[0.75] lg:scale-90 origin-top p-4">
            <style type="text/css" media="print">
              {` @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white; } .print-container { width: 100% !important; height: 100% !important; margin: 0 !important; padding: ${LAYOUT.pagePadding} !important; box-shadow: none !important; border: none !important; position: absolute; top: 0; left: 0; } `}
            </style>

            <div ref={componentRef} className="print-container bg-white shadow-2xl text-black font-sans leading-snug mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: LAYOUT.pagePadding, boxSizing: 'border-box' }}>
              {/* HEADER */}
              <div className={`flex justify-between items-start mb-${LAYOUT.headerMarginBottom}`}>
                <div className="flex flex-col items-center w-1/3"><img src="/suzuki-logo.png" alt="Suzuki Logo" className={`mb-${LAYOUT.logoMarginBottom} z-10`} style={{ height: `${LAYOUT.logoHeight}px`, width: LAYOUT.logoWidth, objectFit: 'contain', position: 'relative', top: `${LAYOUT.logoVerticalOffset}px` }} onError={(e) => { e.target.style.display='none' }}/></div>
                <div className="w-2/3 text-right">
                  <h1 className={`text-${LAYOUT.companyNameSize} font-bold uppercase tracking-wide`}>VALUE MOTOR AGENCY PVT LTD</h1>
                  <p className={`text-${LAYOUT.addressTextSize} font-semibold mt-1`}>#16/A, MILLERS ROAD VASANTH NAGAR</p>
                  <p className={`text-${LAYOUT.addressTextSize} font-semibold`}>BANGALORE - 560052</p>
                </div>
              </div>

              {/* TITLE */}
              <div className={`text-center mb-${LAYOUT.titleMarginBottom}`}>
                <h2 className={`text-${LAYOUT.titleTextSize} font-bold underline decoration-2 underline-offset-4`}>RECEIPT</h2>
              </div>

              {/* DETAILS ROW */}
              <div className="flex justify-between mb-6 text-base font-medium">
                <div><span className="font-bold mr-2">NO:</span> <span className="text-xl text-red-600 font-bold">{formData.receiptNo}</span></div>
                <div><span className="font-bold mr-2">Date:</span> <span className="text-lg">{new Date(formData.date).toLocaleDateString('en-GB')}</span></div>
              </div>

              {/* BODY */}
              <div className={`space-y-${LAYOUT.bodySpacing} text-${LAYOUT.bodyTextSize}`}>
                <div className="flex items-end">
                  <span className="font-bold whitespace-nowrap mr-2">RECEIVED WITH THANKS FROM:</span>
                  <span className="border-b border-dotted border-black flex-grow px-2 uppercase font-bold text-xl leading-none">{formData.customerName}</span>
                </div>

                <div className="flex items-end gap-4">
                  <div className="flex items-end flex-1"><span className="font-bold whitespace-nowrap mr-2">HP:</span><span className="border-b border-dotted border-black flex-grow px-2 font-medium text-lg">{formData.hp}</span></div>
                  <div className="flex items-end flex-1"><span className="font-bold whitespace-nowrap mr-2">MODEL:</span><span className="border-b border-dotted border-black flex-grow px-2 uppercase font-medium text-lg">{formData.model}</span></div>
                </div>

                <div className="block leading-loose">
                  <span className="font-bold mr-2 align-baseline">RUPEES:</span>
                  <span className="font-medium uppercase text-lg underline decoration-dotted decoration-2 underline-offset-8 decoration-gray-400">
                    {amountInWords}
                  </span>
                </div>

                <div className="flex items-end">
                  <span className="font-bold whitespace-nowrap mr-2">ON ACCOUNT OF:</span>
                  <span className="border-b border-dotted border-black w-48"></span>
                </div>

                <div className="flex items-center mt-8">
                  <div className="border-2 border-black font-bold text-2xl" style={{ paddingLeft: `${LAYOUT.amountBoxPaddingX * 4}px`, paddingRight: `${LAYOUT.amountBoxPaddingX * 4}px`, paddingTop: `${LAYOUT.amountBoxPaddingY * 4}px`, paddingBottom: `${LAYOUT.amountBoxPaddingY * 4}px` }}>
                    RS. {Number(formData.amount).toLocaleString('en-IN')}/-
                  </div>
                  <div className="italic text-lg font-medium" style={{ marginLeft: `${LAYOUT.amountBoxMarginLeft * 4}px` }}>by way of Cash/Cheque/Card/Online</div>
                </div>

                <div className="flex flex-nowrap gap-4 mt-6 pt-6">
                   <div className="flex items-end whitespace-nowrap"><span className="font-bold mr-1 text-base">NO-</span><span className="border-b border-dotted border-black w-32"></span></div>
                   <div className="flex items-end whitespace-nowrap"><span className="font-bold mr-1 text-base">-DATED-</span><span className="border-b border-dotted border-black w-32"></span></div>
                   <div className="flex items-end whitespace-nowrap"><span className="font-bold mr-1 text-base">-DRAWN ON-</span><span className="border-b border-dotted border-black w-40"></span></div>
                </div>
              </div>

              {/* FOOTER */}
              <div> <br /> <br /> <br /> <br /></div>
              <div className={`mt-${LAYOUT.footerMarginTop} flex justify-end`}>
                <div className="text-center">
                  <div className="font-bold mb-12 text-lg">For Value Motor Agency Pvt Ltd</div>
                  <div className="border-t border-black pt-1 px-4 inline-block text-base font-semibold">Authorised Signatory</div>
                </div>
              </div>

              <div className={`mt-${LAYOUT.disclaimerMarginTop} border-t border-gray-300 pt-4 text-xs font-extrabold text-black uppercase tracking-tight`}>
                Note: Prices prevailing at the time of Delivery applicable. Any cancellation subject to 10% deduction.... (for finance DP purpose only)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- HISTORY SECTION --- */}
      <div className={`rounded-xl shadow-lg p-6 ${isDark ? "bg-gray-800" : "bg-white"}`}>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Receipt History</h2>
          
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
             <div className="relative flex-1 w-full md:w-64">
               <input placeholder="Search displayed..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
               <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
             </div>
             
             {/* NEW EXPORT CONTROLS */}
             <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg border border-gray-300 w-full md:w-auto">
                 <select 
                     className="bg-transparent text-sm p-1 outline-none text-gray-700 font-medium w-full md:w-auto"
                     value={exportMonth}
                     onChange={(e) => setExportMonth(e.target.value)}
                 >
                     <option value="">Current View (Last 500)</option>
                     {availableMonths.map(m => (
                         <option key={m} value={m}>{m} (Full Month)</option>
                     ))}
                 </select>
                 <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-bold whitespace-nowrap transition-colors">
                     <FileSpreadsheet size={16} /> Export
                 </button>
             </div>
          </div>

        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr><th className={tableHeaderClass}>Receipt No</th><th className={tableHeaderClass}>Date</th><th className={tableHeaderClass}>Customer</th><th className={tableHeaderClass}>Amount</th><th className={tableHeaderClass}>Model</th></tr>
            </thead>
            <tbody>
              {filteredHistory.map((item) => (
                <tr key={item.receipt_no} className={tableRowClass}>
                  <td className={`px-4 py-3 font-medium ${isDark ? "text-gray-300" : "text-gray-800"}`}>{item.receipt_no}</td>
                  <td className={`px-4 py-3 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{new Date(item.date).toLocaleDateString()}</td>
                  <td className={`px-4 py-3 ${isDark ? "text-gray-300" : "text-gray-800"}`}>{item.customer_name}</td>
                  <td className="px-4 py-3 text-green-600 font-bold">₹{item.amount}</td>
                  <td className={`px-4 py-3 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{item.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuzukiReceipt;