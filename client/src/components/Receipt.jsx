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

const isMobile = () => window.innerWidth < 1024;

const Receipt = ({ theme }) => {
  const isDark = theme === 'dark';
  const componentRef = useRef(null);
  const previewPanelRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);

  const initialForm = {
    receiptNo: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    mobile: '',
    fileNoSeq: '',
    hp: '',
    model: '',
    amount: '',
    paymentType: 'Booking',
    customPaymentType: '',
    paymentMode: 'Cash',
    dated: '',
    chequeNo: '',
    remarks: '',
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
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const A4_W_PX = 794;
  const PAGE_PAD_PX = Math.round((5 / 210) * A4_W_PX);
  const RECEIPT_W_PX = A4_W_PX - PAGE_PAD_PX * 2;
  const RECEIPT_H_PX = Math.round((120 / 297) * 1123);
  const LABEL_H_PX = 20;
  const PREVIEW_NATURAL_H = RECEIPT_H_PX + LABEL_H_PX + 8;

  useEffect(() => {
    const computeScale = () => {
      if (previewPanelRef.current) {
        const panelW = previewPanelRef.current.clientWidth - 32;
        setPreviewScale(Math.min(panelW / A4_W_PX, 1.0));
      }
    };
    computeScale();
    const ro = new ResizeObserver(computeScale);
    if (previewPanelRef.current) ro.observe(previewPanelRef.current);
    return () => ro.disconnect();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.substring(0, 10).split('-');
    return `${day}-${month}-${year}`;
  };

  const fetchNextReceiptNo = async () => {
    try {
      const res = await fetch(`${API_URL}/general-receipts/next`);
      if (!res.ok) throw new Error("Server Error");
      const data = await res.json();
      setFilePrefix(data.prefix || '');
      setCurrentFilePrefix(data.prefix || '');
      setFormData(prev => ({ ...prev, receiptNo: String(data.nextReceiptNo || '---'), fileNoSeq: '' }));
      setServerError(false);
    } catch {
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
    } catch {
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
      } else { setAvailableMonths([]); }
    } catch { setAvailableMonths([]); }
  };

  useEffect(() => {
    fetchNextReceiptNo();
    fetchHistory();
    fetchAvailableMonths();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const resetForm = () => {
    setFormData({ ...initialForm, date: new Date().toISOString().split('T')[0], receiptNo: formData.receiptNo, fileNoSeq: '' });
    setIsEditing(false);
    setSearchTerm('');
    setSearchResults([]);
    fetchNextReceiptNo();
  };

  const handleFileChange = (e) => {
    const rawInput = e.target.value;
    setFormData(prev => ({ ...prev, fileNoSeq: rawInput }));
    const cleanCombined = (currentFilePrefix + rawInput).replace(/\s/g, '');
    if (Array.isArray(history) && rawInput.length >= 3) {
      const match = history.find(item => (item.file_no || '').replace(/\s/g, '') === cleanCombined);
      if (match) {
        setFormData(prev => ({
          ...prev,
          customerName: match.customer_name,
          mobile: match.mobile || '',
          model: match.model || '',
          hp: match.hp_financier || ''
        }));
      }
    }
  };

  const handleSearchInput = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length > 2) {
      const queryTerm = /^\d{6}$/.test(term) ? term.substring(2) : term;
      try {
        const res = await fetch(`${API_URL}/general-receipts/list?search=${queryTerm}`);
        if (res.ok) setSearchResults(await res.json());
      } catch(e) { console.error(e); }
    } else { setSearchResults([]); }
  };

  const selectSearchResult = (item) => { handleEdit(item); setSearchResults([]); setSearchTerm(''); };

  const handleEdit = (item) => {
    if (serverError) return alert("System is offline. Cannot edit receipts.");
    let loadedSeq = item.file_no || '';
    let loadedPrefix = filePrefix;
    if (loadedSeq) {
      if (filePrefix && loadedSeq.startsWith(filePrefix)) {
        loadedPrefix = filePrefix; loadedSeq = loadedSeq.substring(filePrefix.length);
      } else {
        const match = loadedSeq.match(/^(.*?)(\d+)$/);
        if (match) { loadedPrefix = match[1]; loadedSeq = match[2]; } else { loadedPrefix = ''; }
      }
    }
    setCurrentFilePrefix(loadedPrefix);
    setFormData({
      receiptNo: item.receipt_no,
      date: item.date ? item.date.substring(0, 10) : new Date().toISOString().split('T')[0],
      customerName: item.customer_name,
      mobile: item.mobile || '',
      fileNoSeq: loadedSeq,
      hp: item.hp_financier || '',
      model: item.model || '',
      amount: item.amount,
      paymentType: ['Booking', 'Down Payment', 'Balance Payment'].includes(item.payment_type) ? item.payment_type : 'Other',
      customPaymentType: !['Booking', 'Down Payment', 'Balance Payment'].includes(item.payment_type) ? item.payment_type : '',
      paymentMode: item.payment_mode || 'Cash',
      dated: item.payment_date ? item.payment_date.substring(0, 10) : '',
      chequeNo: item.cheque_no || '',
      remarks: item.remarks || '',
      status: item.status || 'ACTIVE'
    });
    setIsEditing(true); setSearchTerm(''); setSearchResults([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelReceipt = async () => {
    if (!window.confirm("Are you sure you want to CANCEL this receipt? This will be watermarked.")) return;
    const updatedForm = { ...formData, status: 'CANCELLED' };
    setFormData(updatedForm);
    await saveToDb(updatedForm);
  };

  const saveToDb = async (dataOverride = null) => {
    if (serverError) { if (window.toast) window.toast("System Offline: Cannot save data.", "error"); return; }
    const dataToSave = dataOverride || formData;
    const finalFileNo = currentFilePrefix + dataToSave.fileNoSeq.trim();
    const method = isEditing ? 'PUT' : 'POST';
    const finalPaymentType = dataToSave.paymentType === 'Other' ? dataToSave.customPaymentType : dataToSave.paymentType;
    const url = isEditing ? `${API_URL}/general-receipts/${dataToSave.receiptNo}` : `${API_URL}/general-receipts`;
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_no: dataToSave.receiptNo, date: dataToSave.date,
          customer_name: dataToSave.customerName, mobile: dataToSave.mobile,
          file_no: finalFileNo, hp_financier: dataToSave.hp,
          model: dataToSave.model, amount: dataToSave.amount, payment_type: finalPaymentType,
          payment_mode: dataToSave.paymentMode, payment_date: dataToSave.dated || null,
          cheque_no: dataToSave.chequeNo || null, remarks: dataToSave.remarks || null,
          status: dataToSave.status || 'ACTIVE'
        })
      });
      if (!res.ok) throw new Error("Database Save Failed");
      if (window.toast) window.toast("Receipt Saved Successfully", "success");
      fetchHistory(); fetchAvailableMonths();
      if (isEditing) { resetForm(); }
      else {
        setFormData(prev => ({ ...initialForm, date: prev.date, receiptNo: prev.receiptNo, fileNoSeq: '' }));
        await fetchNextReceiptNo();
      }
    } catch { if (window.toast) window.toast("Error saving receipt. Please check connection.", "error"); }
  };

  // ─── DESKTOP PRINT (react-to-print) ──────────────────────────────────────
  const handlePrintDesktop = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Receipt_${formData.receiptNo}`,
    onBeforeGetContent: () => {
      if (serverError) { if (window.toast) window.toast("System Offline: Cannot print.", "error"); return Promise.reject(); }
      if (!formData.amount || isNaN(formData.amount)) { if (window.toast) window.toast("Please enter a valid amount.", "error"); return Promise.reject(); }
    },
    onAfterPrint: () => saveToDb()
  });

  // ─── MOBILE PRINT (new window) ────────────────────────────────────────────
  const handleMobilePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (window.toast) window.toast("Please allow popups to print.", "error");
      return;
    }

    const fullFileNo = currentFilePrefix + formData.fileNoSeq;
    const amtWords = formData.amount && !isNaN(formData.amount)
      ? toWords.convert(formData.amount).toUpperCase() + " ONLY"
      : 'ZERO ONLY';
    const payType = formData.paymentType === 'Other' ? formData.customPaymentType : formData.paymentType;
    const isCancelled = formData.status === 'CANCELLED';

    const receiptBlock = (label, marginLeft) => `
      <div class="page" style="margin-left:${marginLeft}">
        <div class="copy-label">${label}</div>
        <div class="receipt-box">
          ${isCancelled ? `<div class="cancelled-stamp"><div class="cancelled-inner">CANCELLED</div></div>` : ''}
          <div class="watermark"><img src="/suzuki-logo.png" alt=""/></div>
          <div class="content">
            <div class="hdr">
              <div class="hdr-left">
                <img src="/suzuki-logo.png" alt="Suzuki" style="width:150px;max-width:100%;"/>
                <div class="gst">GST NO: 29AACCV2521J1ZA</div>
              </div>
              <div class="hdr-right">
                <div class="co-name">VALUE MOTOR AGENCY PVT LTD</div>
                <div class="co-addr">#16/A, MILLERS ROAD, VASANTH NAGAR, BANGALORE - 52</div>
                <div class="co-addr">Mob: 9845906084 | Email: millers_road_suzuki@yahoo.com</div>
              </div>
            </div>
            <div class="title-bar"><span>RECEIPT</span></div>
            <div class="meta-row">
              <div>NO:<span class="rno">${formData.receiptNo}</span></div>
              <div class="meta-right">
                ${fullFileNo.trim() ? `<span>File Number: <strong>${fullFileNo}</strong></span>` : ''}
                <span>DATE: <strong>${formatDate(formData.date)}</strong></span>
              </div>
            </div>
            <div class="fields">
              <div class="field-row">
                <span class="flabel">RECEIVED WITH THANKS FROM:</span>
                <span class="fval name">${formData.customerName}</span>
              </div>
              <div>
                <div class="flabel" style="font-size:11px;margin-bottom:1px;">THE SUM OF RUPEES:</div>
                <div class="amt-words">${amtWords}</div>
              </div>
              <div class="flex-row">
                ${formData.model ? `<div class="field-row f1"><span class="flabel">MODEL:</span><span class="fval">${formData.model}</span></div>` : ''}
                <div class="field-row f1"><span class="flabel">ON ACCOUNT OF:</span><span class="fval">${payType}</span></div>
                <div class="field-row f1"><span class="flabel">BY WAY OF:</span><span class="fval">${formData.paymentMode}</span></div>
              </div>
              ${formData.hp ? `<div class="field-row"><span class="flabel">H.P. TO:</span><span class="fval">${formData.hp}</span></div>` : ''}
              ${formData.mobile ? `<div class="field-row"><span class="flabel">MOBILE NO:</span><span class="fval">${formData.mobile}</span></div>` : ''}
            </div>
            <div class="bottom">
              <div class="amt-sig-row">
                <div class="amt-left">
                  <div class="flex-row" style="align-items:center;gap:12px;">
                    <div class="amt-box">₹ ${Number(formData.amount).toLocaleString('en-IN')}/-</div>
                    ${formData.dated ? `<span style="font-weight:bold;font-size:11px;">DATED: ${formatDate(formData.dated)}</span>` : ''}
                  </div>
                  ${formData.chequeNo ? `<div style="font-size:11px;font-style:italic;margin-top:3px;">Cheque/Ref No: <strong>${formData.chequeNo}</strong></div>` : ''}
                  ${formData.remarks ? `<div style="font-size:11px;margin-top:2px;word-break:break-word;">REMARKS: <strong>${formData.remarks}</strong></div>` : ''}
                </div>
                <div class="sig">
                  <div class="sig-for">For <strong>VALUE MOTOR AGENCY PVT LTD</strong></div>
                  <div class="sig-line">Authorised Signatory</div>
                </div>
              </div>
            </div>
            <div class="footer">
              <div class="f-bank">WE BANK WITH STATE BANK OF INDIA | A/C NO: 32744599339 | IFSC: SBIN0021882 | BRANCH: VASANTHNAGAR</div>
              <div class="f-note">NOTE: CHEQUES SUBJECT TO REALISATION. PRICES PREVAILING AT THE TIME OF DELIVERY APPLICABLE. ANY CANCELLATION SUBJECT TO 10% DEDUCTION.</div>
            </div>
          </div>
        </div>
      </div>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Receipt_${formData.receiptNo}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:sans-serif;background:white;}
    @page{size:A4 portrait;margin:5mm;}
    .page{width:200mm;}
    .copy-label{text-align:right;font-weight:bold;font-size:10px;text-transform:uppercase;padding:4px 0 2px;letter-spacing:.15em;color:#6b7280;}
    .receipt-box{width:200mm;height:120mm;border:3px solid black;border-radius:8px;box-sizing:border-box;background:white;color:black;position:relative;overflow:hidden;padding:4mm;display:flex;flex-direction:column;}
    .page+.page{margin-top:12mm;}
    .watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:.07;z-index:0;}
    .watermark img{width:66%;}
    .cancelled-stamp{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:50;pointer-events:none;}
    .cancelled-inner{border:4px solid rgba(239,68,68,.3);color:rgba(239,68,68,.3);font-size:48px;font-weight:900;transform:rotate(-45deg);padding:12px;border-radius:12px;letter-spacing:.1em;line-height:1;}
    .content{position:relative;z-index:10;display:flex;flex-direction:column;height:100%;}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;}
    .hdr-left{width:45%;}
    .gst{font-weight:bold;margin-top:2px;font-size:11px;}
    .hdr-right{width:55%;text-align:right;}
    .co-name{font-size:16px;font-weight:900;text-transform:uppercase;line-height:1.2;}
    .co-addr{font-size:8px;font-weight:bold;margin-top:2px;letter-spacing:.04em;}
    .title-bar{border-bottom:2px solid black;text-align:center;margin-bottom:3px;padding-bottom:1px;}
    .title-bar span{font-size:18px;font-weight:bold;text-transform:uppercase;letter-spacing:.2em;}
    .meta-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:12px;font-weight:bold;}
    .meta-right{display:flex;align-items:center;gap:16px;}
    .rno{color:#dc2626;font-size:16px;margin-left:6px;}
    .fields{display:flex;flex-direction:column;gap:3px;}
    .field-row{display:flex;align-items:flex-end;}
    .f1{flex:1;}
    .flabel{font-weight:bold;margin-right:6px;white-space:nowrap;font-size:10px;}
    .fval{border-bottom:1px dotted black;flex-grow:1;padding:0 6px;font-size:12px;text-transform:uppercase;}
    .fval.name{font-weight:900;font-size:15px;color:#1e3a8a;line-height:1.2;}
    .amt-words{font-weight:bold;font-size:14px;font-style:italic;text-transform:uppercase;word-break:break-word;padding:0 6px;}
    .flex-row{display:flex;gap:10px;flex-wrap:wrap;}
    .bottom{flex:1;display:flex;flex-direction:column;justify-content:center;}
    .amt-sig-row{display:flex;align-items:flex-end;justify-content:space-between;}
    .amt-left{display:flex;flex-direction:column;flex:1;padding-right:12px;}
    .amt-box{border:2px solid black;padding:4px 12px;font-size:18px;font-weight:900;background:#f9fafb;white-space:nowrap;letter-spacing:.05em;line-height:1;display:inline-block;}
    .sig{text-align:center;display:flex;flex-direction:column;align-items:center;flex-shrink:0;}
    .sig-for{font-size:10px;margin-bottom:2px;}
    .sig-line{border-top:2px solid black;padding:2px 20px 0;display:inline-block;font-size:10px;font-weight:bold;margin-top:10mm;}
    .footer{margin-top:3px;padding-top:2px;border-top:1px solid #9ca3af;}
    .f-bank{font-size:8px;font-weight:900;color:#1f2937;text-transform:uppercase;line-height:1.3;letter-spacing:.04em;}
    .f-note{font-size:7px;font-weight:900;color:black;text-transform:uppercase;margin-top:1px;letter-spacing:.06em;}
  </style>
</head>
<body>
  ${receiptBlock('CUSTOMER COPY', '0')}
  ${receiptBlock('OFFICE COPY', '15mm')}
  <script>
    window.onload=function(){setTimeout(function(){window.print();},500);};
  </script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    saveToDb();
  };

  // ─── UNIFIED handlePrint ──────────────────────────────────────────────────
  const handlePrint = () => {
    if (serverError) { if (window.toast) window.toast("System Offline: Cannot print.", "error"); return; }
    if (!formData.amount || isNaN(formData.amount)) { if (window.toast) window.toast("Please enter a valid amount.", "error"); return; }
    if (isMobile()) {
      handleMobilePrint();
    } else {
      handlePrintDesktop();
    }
  };

  const amountInWords = formData.amount && !isNaN(formData.amount)
    ? toWords.convert(formData.amount).toUpperCase() + " ONLY"
    : 'ZERO ONLY';

  const hasValue = (val) => val && String(val).trim().length > 0;
  const fullFileNo = currentFilePrefix + formData.fileNoSeq;

  const handleExport = () => {
    let data = history;
    if (exportRange.from && exportRange.to) {
      data = history.filter(item => { const d = item.date.substring(0,10); return d >= exportRange.from && d <= exportRange.to; });
    }
    const sortedData = [...data].sort((a, b) => {
      const dA = new Date(a.date).getTime(), dB = new Date(b.date).getTime();
      return dA !== dB ? dA - dB : parseInt(a.receipt_no) - parseInt(b.receipt_no);
    });
    const dataToExport = sortedData.map(item => {
      const fileNo = item.file_no || '', customer = item.customer_name || '';
      return {
        "Date": formatDate(item.date), "Receipt No": item.receipt_no,
        "File Number-Customer Name": fileNo && customer ? `${fileNo}-${customer}` : `${fileNo}${customer}`,
        "Amount": item.amount, "Mode": item.payment_mode, "Type": item.payment_type,
        "File No": item.file_no, "Customer Name": item.customer_name, "Mobile": item.mobile,
        "Model": item.model, "HP To": item.hp_financier, "Status": item.status || 'ACTIVE',
        "Cheque No": item.cheque_no, "Dated": item.payment_date ? formatDate(item.payment_date) : '',
        "Remarks": item.remarks
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Receipts");
    XLSX.writeFile(workbook, `Receipts_Report.xlsx`);
  };

  const inputClass = `w-full p-1.5 rounded border text-sm ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`;
  const labelClass = `block text-[10px] font-bold uppercase mb-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`;
  const tableHeaderClass = `px-4 py-2 text-left text-xs font-semibold ${isDark ? "text-gray-300 bg-gray-700" : "text-gray-600 bg-gray-100"}`;
  const tableRowClass = `border-b ${isDark ? "border-gray-700 hover:bg-gray-700/50 text-gray-200" : "border-gray-100 hover:bg-gray-50 text-gray-800"} transition-colors`;

  // ─── RECEIPT INNER BODY ───────────────────────────────────────────────────
  const renderReceiptBody = () => (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      boxSizing: 'border-box', padding: '4mm',
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {formData.status === 'CANCELLED' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, pointerEvents: 'none' }}>
          <div style={{ border: '4px solid rgba(239,68,68,0.3)', color: 'rgba(239,68,68,0.3)', fontSize: '64px', fontWeight: 900, transform: 'rotate(-45deg)', padding: '16px', borderRadius: '12px', letterSpacing: '0.1em', userSelect: 'none', lineHeight: 1 }}>
            CANCELLED
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.07, zIndex: 0 }}>
        <img src="/suzuki-logo.png" alt="" style={{ width: '66%' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px', position: 'relative', zIndex: 10 }}>
        <div style={{ width: '45%' }}>
          <img src="/suzuki-logo.png" alt="Suzuki" style={{ width: '180px', maxWidth: '100%' }} />
          <div style={{ fontWeight: 'bold', marginTop: '2px', fontSize: '12px' }}>GST NO: 29AACCV2521J1ZA</div>
        </div>
        <div style={{ width: '55%', textAlign: 'right' }}>
          <h1 style={{ fontSize: '19px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2, margin: 0 }}>VALUE MOTOR AGENCY PVT LTD</h1>
          <p style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '2px', letterSpacing: '0.04em', margin: '2px 0 0' }}>#16/A, MILLERS ROAD, VASANTH NAGAR, BANGALORE - 52</p>
          <p style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.04em', margin: '1px 0 0' }}>Mob: 9845906084 | Email: millers_road_suzuki@yahoo.com</p>
        </div>
      </div>

      <div style={{ borderBottom: '2px solid black', textAlign: 'center', marginBottom: '3px', paddingBottom: '1px' }}>
        <span style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em' }}>RECEIPT</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold', position: 'relative', zIndex: 10 }}>
        <div>NO: <span style={{ color: '#dc2626', fontSize: '18px', marginLeft: '8px' }}>{formData.receiptNo}</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {hasValue(fullFileNo) && (
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937' }}>
              File Number: <span style={{ marginLeft: '4px' }}>{fullFileNo}</span>
            </div>
          )}
          <div>DATE: <span style={{ marginLeft: '8px', fontSize: '15px' }}>{formatDate(formData.date)}</span></div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', zIndex: 10, marginTop: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontWeight: 'bold', marginRight: '8px', whiteSpace: 'nowrap', fontSize: '13px' }}>RECEIVED WITH THANKS FROM:</span>
          <span style={{ borderBottom: '1px dotted black', flexGrow: 1, padding: '0 8px', fontWeight: 900, fontSize: '18px', textTransform: 'uppercase', lineHeight: 1.2, color: '#1e3a8a' }}>{formData.customerName}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '1px', letterSpacing: '0.04em' }}>THE SUM OF RUPEES:</span>
          <div style={{ width: '100%', padding: '0 8px', fontWeight: 'bold', fontSize: '17px', fontStyle: 'italic', textTransform: 'uppercase', lineHeight: '28px', minHeight: '28px', wordBreak: 'break-word', backgroundImage: 'radial-gradient(circle at 1px 26px, black 1px, transparent 1px)', backgroundSize: '4px 28px', backgroundRepeat: 'repeat' }}>
            {amountInWords}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
          {hasValue(formData.model) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>MODEL:</span>
              <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', minWidth: '120px', textAlign: 'center' }}>{formData.model}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>ON ACCOUNT OF:</span>
            <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', minWidth: '120px', textAlign: 'center' }}>
              {formData.paymentType === 'Other' ? formData.customPaymentType : formData.paymentType}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>BY WAY OF:</span>
            <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', minWidth: '120px', textAlign: 'center' }}>{formData.paymentMode}</span>
          </div>
        </div>
        {hasValue(formData.hp) && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>H.P. TO:</span>
            <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', minWidth: '150px', textAlign: 'center' }}>{formData.hp}</span>
          </div>
        )}
        {hasValue(formData.mobile) && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>MOBILE NO:</span>
            <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '14px', minWidth: '150px', textAlign: 'center' }}>{formData.mobile}</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, paddingRight: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ border: '2px solid black', padding: '4px 14px', fontSize: '21px', fontWeight: 900, backgroundColor: '#f9fafb', whiteSpace: 'nowrap', letterSpacing: '0.05em', lineHeight: 1 }}>
                ₹ {Number(formData.amount).toLocaleString('en-IN')}/-
              </div>
              {hasValue(formData.dated) && (
                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                  DATED: <span style={{ marginLeft: '4px' }}>{formatDate(formData.dated)}</span>
                </div>
              )}
            </div>
            {(hasValue(formData.chequeNo) || hasValue(formData.remarks)) && (
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', fontWeight: 600, gap: '2px', marginTop: '4px' }}>
                {hasValue(formData.chequeNo) && (
                  <div style={{ fontStyle: 'italic' }}>Cheque/Ref No: <span style={{ fontWeight: 'bold' }}>{formData.chequeNo}</span></div>
                )}
                {hasValue(formData.remarks) && (
                  <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.2 }}>REMARKS: <span style={{ fontWeight: 'bold' }}>{formData.remarks}</span></div>
                )}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', marginBottom: '2px', letterSpacing: '0.04em' }}>
              <span style={{ fontWeight: 500 }}>For</span>{' '}
              <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px' }}>VALUE MOTOR AGENCY PVT LTD</span>
            </div>
            <div style={{ height: '12mm', width: '100%' }} aria-hidden="true" />
            <div style={{ fontSize: '11px', borderTop: '2px solid black', display: 'inline-block', padding: '2px 28px 0', fontWeight: 'bold', letterSpacing: '0.04em' }}>
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '4px', paddingTop: '3px', borderTop: '1px solid #9ca3af', position: 'relative', zIndex: 10 }}>
        <div style={{ fontSize: '9px', fontWeight: 900, color: '#1f2937', textTransform: 'uppercase', lineHeight: 1.3, letterSpacing: '0.04em' }}>
          WE BANK WITH STATE BANK OF INDIA | A/C NO: 32744599339 | IFSC: SBIN0021882 | BRANCH: VASANTHNAGAR
        </div>
        <div style={{ fontSize: '8px', fontWeight: 900, color: 'black', textTransform: 'uppercase', marginTop: '1px', letterSpacing: '0.06em' }}>
          NOTE: CHEQUES SUBJECT TO REALISATION. PRICES PREVAILING AT THE TIME OF DELIVERY APPLICABLE. ANY CANCELLATION SUBJECT TO 10% DEDUCTION.
        </div>
      </div>
    </div>
  );

  // ─── PRINT LAYOUT ─────────────────────────────────────────────────────────
  const renderPrintLayout = () => (
    <div
      ref={componentRef}
      style={{ width: '210mm', minHeight: '297mm', padding: '5mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12mm', backgroundColor: 'white', fontFamily: 'sans-serif' }}
    >
      <style type="text/css" media="print">
        {tailwindStyles}
        {`@page { size: A4 portrait; margin: 0mm !important; } html, body { margin: 0 !important; padding: 0 !important; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print-root { width: 210mm !important; min-height: 297mm !important; padding: 5mm !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important; gap: 12mm !important; background: white !important; }`}
      </style>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '1mm', letterSpacing: '0.15em', color: '#6b7280' }}>CUSTOMER COPY</div>
        <div style={{ width: '200mm', height: '120mm', border: '3px solid black', borderRadius: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: 'black', position: 'relative', overflow: 'hidden' }}>
          {renderReceiptBody()}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '15mm' }}>
        <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '1mm', letterSpacing: '0.15em', color: '#6b7280' }}>OFFICE COPY</div>
        <div style={{ width: '185mm', height: '120mm', border: '3px solid black', borderRadius: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: 'black', position: 'relative', overflow: 'hidden' }}>
          {renderReceiptBody()}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-2 md:p-4 max-w-7xl">
      <div className="no-print">
        <DaySummary isOpen={showSummary} onClose={() => setShowSummary(false)} theme={theme} />

        {/* Top bar */}
        <div className={`mb-8 flex flex-col sm:flex-row justify-between items-center p-4 rounded-2xl shadow-lg gap-4 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-200'}`}>
          <div className="w-full sm:w-[400px] relative z-30">
            <input
              type="text" value={searchTerm} onChange={handleSearchInput}
              placeholder="Search by File No, Name..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm shadow-inner focus:ring-2 outline-none transition-all border backdrop-blur-md ${isDark ? 'bg-white/10 border-white/20 text-white focus:ring-white/50 placeholder-gray-300' : 'bg-white/50 border-white/60 text-gray-800 focus:ring-blue-500 placeholder-gray-600'}`}
            />
            <Search className={`absolute left-3 top-3 ${isDark ? 'text-gray-300' : 'text-gray-500'}`} size={18} />
            {searchResults.length > 0 && (
              <div className={`absolute top-12 left-0 right-0 border shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] rounded-2xl max-h-80 overflow-y-auto z-50 backdrop-blur-xl ${isDark ? 'bg-gray-900/95 border-white/10' : 'bg-white/95 border-white/60'}`}>
                {searchResults.map(r => (
                  <div key={r.receipt_no} onClick={() => selectSearchResult(r)} className={`p-4 border-b cursor-pointer flex justify-between items-center transition-colors ${isDark ? 'border-white/5 hover:bg-white/10' : 'border-gray-200/50 hover:bg-white/50'}`}>
                    <div>
                      <div className={`font-bold text-sm ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>Receipt #{r.receipt_no}</div>
                      <div className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{r.customer_name}</div>
                      <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>File: {r.file_no || '--'} • Mob: {r.mobile || '--'}</div>
                    </div>
                    <div className={`font-bold text-lg ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>₹{r.amount}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowSummary(true)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all border shadow-sm whitespace-nowrap w-full sm:w-auto justify-center backdrop-blur-md ${isDark ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white' : 'bg-white/40 hover:bg-white/60 border-white/50 text-gray-800'}`}
          >
            <Calendar size={18} /> Daily Summary
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          {/* ── LEFT: FORM ── */}
          <div className={`w-full lg:w-[380px] lg:flex-shrink-0 p-4 rounded-xl shadow-lg h-fit ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} border`}>
            {serverError && (
              <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-2 rounded shadow-md animate-pulse">
                <div className="flex items-center gap-2"><WifiOff size={16} /><p className="font-bold text-xs">System Offline</p></div>
              </div>
            )}
            <div className="flex items-start justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-800"}`}>{isEditing ? "Edit Receipt" : "New Receipt"}</h2>
                <div className="text-sm font-bold text-red-600 mt-0.5">#{formData.receiptNo}</div>
              </div>
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
                  <div><label className={labelClass}>Date</label><input type="date" name="date" value={formData.date} onChange={handleChange} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>File No</label>
                    <div className="flex shadow-sm rounded border overflow-hidden">
                      <span className={`px-2 py-1.5 text-xs font-mono font-bold flex items-center justify-center select-none ${isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>{currentFilePrefix}</span>
                      <input name="fileNoSeq" value={formData.fileNoSeq} onChange={handleFileChange} autoComplete="off"
                        className={`w-full p-1.5 text-sm font-mono tracking-wide font-bold text-blue-600 focus:outline-none ${isDark ? 'bg-gray-700 text-red-400' : 'bg-white'}`} placeholder="XXXX" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelClass}>Amount (₹)</label><input type="number" name="amount" value={formData.amount} onChange={handleChange} autoComplete="off" className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>By Way Of</label>
                    <select name="paymentMode" value={formData.paymentMode} onChange={handleChange} className={inputClass}>
                      <option>Cash</option><option>UPI</option><option>Cheque</option><option>Bank Transfer</option><option>Card</option>
                    </select>
                  </div>
                </div>
                <div><label className={labelClass}>Customer Name</label><input name="customerName" value={formData.customerName} onChange={handleChange} autoComplete="off" className={inputClass} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>On Account Of</label>
                    <select name="paymentType" value={formData.paymentType} onChange={handleChange} className={inputClass}>
                      <option>Booking</option><option>Down Payment</option><option>Balance Payment</option><option value="Other">Other (Custom)</option>
                    </select>
                    {formData.paymentType === 'Other' && (
                      <input name="customPaymentType" value={formData.customPaymentType} onChange={handleChange} autoComplete="off" className={`mt-2 ${inputClass}`} placeholder="Enter custom account..." />
                    )}
                  </div>
                  <div><label className={labelClass}>Model</label><input name="model" value={formData.model} onChange={handleChange} autoComplete="on" className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelClass}>Mobile Number</label><input name="mobile" value={formData.mobile} onChange={handleChange} autoComplete="off" className={inputClass} /></div>
                  <div><label className={labelClass}>HP To</label><input name="hp" value={formData.hp} onChange={handleChange} autoComplete="on" className={inputClass} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div><label className={labelClass}>Cheque / Ref No</label><input name="chequeNo" value={formData.chequeNo} onChange={handleChange} autoComplete="off" className={inputClass} placeholder="Optional" /></div>
                  <div><label className={labelClass}>Dated (Optional)</label><input type="date" name="dated" value={formData.dated} onChange={handleChange} className={inputClass} /></div>
                </div>
                <div>
                  <label className={labelClass}>Remarks</label>
                  <input name="remarks" value={formData.remarks} onChange={handleChange} autoComplete="off" className={inputClass} placeholder="Any additional notes..." />
                </div>
              </fieldset>

              <button
                onClick={handlePrint} disabled={serverError}
                className={`w-full mt-3 font-bold py-2.5 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all ${
                  serverError ? "bg-gray-400 cursor-not-allowed text-gray-200"
                    : formData.status === 'CANCELLED' ? "bg-red-500 text-white cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {serverError ? <WifiOff size={18} /> : <Printer size={18} />}
                {serverError ? "Offline" : isEditing ? "Update & Print" : "Save & Print"}
              </button>
            </div>
          </div>

          {/* ── RIGHT: PREVIEW (desktop only) ── */}
          <div
            ref={previewPanelRef}
            className={`hidden lg:flex w-full lg:flex-1 rounded-xl p-4 overflow-hidden items-start justify-center ${isDark ? "bg-gray-700/50" : "bg-gray-200"}`}
          >
            <div style={{ width: '100%', height: `${PREVIEW_NATURAL_H * previewScale}px`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: `translateX(-${(A4_W_PX * previewScale) / 2}px) scale(${previewScale})`, transformOrigin: 'top left', width: `${A4_W_PX}px` }}>
                <div style={{ backgroundColor: 'white', borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', padding: `0 ${PAGE_PAD_PX}px`, boxSizing: 'border-box', width: `${A4_W_PX}px` }}>
                  <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', padding: '6px 4px 2px', letterSpacing: '0.15em', color: '#6b7280' }}>
                    CUSTOMER COPY — PREVIEW
                  </div>
                  <div style={{ width: `${RECEIPT_W_PX}px`, height: `${RECEIPT_H_PX}px`, border: '3px solid black', borderRadius: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: 'black', position: 'relative', overflow: 'hidden', marginBottom: '6px' }}>
                    {renderReceiptBody()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Archives table */}
        <div className={`rounded-xl shadow-lg p-6 ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"}`}>
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>Archives</h2>
            <div className="flex gap-2 items-center flex-wrap">
              <div className={`flex items-center gap-1 p-1 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                <input type="date" value={exportRange.from} onChange={(e) => setExportRange({ ...exportRange, from: e.target.value })} className={`bg-transparent text-xs ${isDark ? 'text-white outline-none' : 'outline-none'}`} />
                <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>TO</span>
                <input type="date" value={exportRange.to} onChange={(e) => setExportRange({ ...exportRange, to: e.target.value })} className={`bg-transparent text-xs ${isDark ? 'text-white outline-none' : 'outline-none'}`} />
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
                  <tr
                    key={item.receipt_no}
                    className={`${tableRowClass} group cursor-pointer ${item.status === 'CANCELLED' ? (isDark ? 'bg-red-900/20 hover:bg-red-900/40' : 'bg-red-50 hover:bg-red-100') : ''}`}
                    onClick={() => handleEdit(item)}
                  >
                    <td className="px-4 py-3">{item.receipt_no}</td>
                    <td className="px-4 py-3">{formatDate(item.date)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {item.customer_name}
                      {item.status === 'CANCELLED' && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">CANCELLED</span>}
                    </td>
                    <td className="px-4 py-3">{item.file_no || '--'}</td>
                    <td className={`px-4 py-3 font-bold ${item.status === 'CANCELLED' ? 'text-gray-400 line-through' : 'text-green-600'}`}>₹{item.amount}</td>
                    <td className="px-4 py-3"><Edit3 size={14} className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Hidden print target for desktop react-to-print */}
      <div className="print-only" style={{ position: 'absolute', overflow: 'hidden', height: 0, width: 0, top: '-9999px', left: '-9999px' }}>
        {renderPrintLayout()}
      </div>
    </div>
  );
};

export default Receipt;