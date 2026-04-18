import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ToWords } from 'to-words';
import { Printer, RefreshCw, Edit3, WifiOff, Calendar, Ban, Search, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import DaySummary from './DaySummary';
import tailwindStyles from '../index.css?inline';

const API_URL = import.meta.env.VITE_API_URL;

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: { currency: false, ignoreDecimal: false, ignoreZeroCurrency: false, doNotAddOnly: true },
});

const toTitleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ─── Extract the seq part (digits after last / or - or after leading letters) ──
const extractSeqFromFileNo = (fileNo) => {
  if (!fileNo) return '';
  const clean = fileNo.replace(/\s/g, '');
  if (clean.includes('/')) return clean.split('/').pop();
  if (clean.includes('-')) return clean.split('-').pop();
  return clean.replace(/^[A-Za-z]+/, '');
};

// ─── Extract prefix part ──────────────────────────────────────────────────────
const extractPrefixFromFileNo = (fileNo, seq) => {
  if (!fileNo || !seq) return '';
  const clean = fileNo.replace(/\s/g, '');
  return clean.slice(0, clean.length - seq.length);
};

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

  // ─── File number autofill state ───────────────────────────────────────────
  const [fileNoOlderMatches, setFileNoOlderMatches] = useState([]); // all but the latest
  const [showOlderEntries, setShowOlderEntries] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const ITEMS_PER_PAGE = 50;

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        if (history.length > 0) {
          e.preventDefault();
          let currentIndex = history.findIndex(item => String(item.receipt_no) === String(formData.receiptNo));
          if (currentIndex === -1 && e.key === 'PageDown') currentIndex = -1;
          let newIndex = e.key === 'PageUp' ? currentIndex - 1 : currentIndex + 1;
          if (newIndex >= 0 && newIndex < history.length) handleEdit(history[newIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData.receiptNo, history]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const resetForm = () => {
    setFormData({ ...initialForm, date: new Date().toISOString().split('T')[0], receiptNo: formData.receiptNo, fileNoSeq: '' });
    setIsEditing(false);
    setSearchTerm('');
    setSearchResults([]);
    setFileNoOlderMatches([]);
    setShowOlderEntries(false);
    fetchNextReceiptNo();
  };

  const doPostSaveReset = async () => {
    if (isEditing) {
      resetForm();
    } else {
      setFormData(prev => ({ ...initialForm, date: prev.date, receiptNo: prev.receiptNo, fileNoSeq: '' }));
      await fetchNextReceiptNo();
    }
  };

  // ─── Apply a matched history record to the form ───────────────────────────
  const applyFileNoMatch = (match, typedSeq) => {
    const fileNo = (match.file_no || '').replace(/\s/g, '');
    const cleanSeq = typedSeq.replace(/\s/g, '');
    const detectedPrefix = extractPrefixFromFileNo(fileNo, extractSeqFromFileNo(fileNo));
    setCurrentFilePrefix(detectedPrefix);
    setFormData(prev => ({
      ...prev,
      fileNoSeq: extractSeqFromFileNo(fileNo), // use the canonical seq from the record
      customerName: match.customer_name,
      mobile: match.mobile || '',
      model: match.model || '',
      hp: match.hp_financier || ''
    }));
  };

  // ─── Smart file number change handler ────────────────────────────────────
  const handleFileChange = (e) => {
    const rawInput = e.target.value;
    setFormData(prev => ({ ...prev, fileNoSeq: rawInput }));
    setFileNoOlderMatches([]);
    setShowOlderEntries(false);

    if (!Array.isArray(history) || rawInput.trim().length < 3) return;

    const cleanInput = rawInput.replace(/\s/g, '');

    // ── 6-digit shorthand: first 2 = year YY, last 4 = seq ──────────────────
    if (/^\d{6}$/.test(cleanInput)) {
      const yearHint = cleanInput.substring(0, 2);
      const seqHint  = cleanInput.substring(2);

      const yearMatch = history.find(item => {
        const fileNo = (item.file_no || '').replace(/\s/g, '');
        const seq = extractSeqFromFileNo(fileNo);
        const prefix = extractPrefixFromFileNo(fileNo, seq);
        return seq === seqHint && (prefix.includes('20' + yearHint) || prefix.includes(yearHint));
      });

      if (yearMatch) {
        applyFileNoMatch(yearMatch, seqHint);
        return;
      }
    }

    // ── Normal seq search: collect ALL records matching the typed seq ────────
    const allMatches = history.filter(item => {
      const fileNo = (item.file_no || '').replace(/\s/g, '');
      if (!fileNo) return false;
      const seq = extractSeqFromFileNo(fileNo);
      return seq === cleanInput;
    });

    if (allMatches.length === 0) return;

    // Sort by prefix descending so latest year is first
    const sorted = [...allMatches].sort((a, b) => {
      const pa = (a.file_no || '').replace(/\s/g, '');
      const pb = (b.file_no || '').replace(/\s/g, '');
      return pb.localeCompare(pa);
    });

    const latest = sorted[0];
    const older  = sorted.slice(1);

    applyFileNoMatch(latest, cleanInput);

    if (older.length > 0) {
      setFileNoOlderMatches(older);
    }
  };

  // ─── Prefix editable directly ─────────────────────────────────────────────
  const handlePrefixChange = (e) => {
    setCurrentFilePrefix(e.target.value);
  };

  // ─── Pick an older entry from the dropdown ────────────────────────────────
  const selectOlderEntry = (match) => {
    applyFileNoMatch(match, formData.fileNoSeq);
    setShowOlderEntries(false);
    setFileNoOlderMatches([]);
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
        const seq = extractSeqFromFileNo(loadedSeq);
        loadedPrefix = extractPrefixFromFileNo(loadedSeq, seq);
        loadedSeq = seq;
      }
    }
    setCurrentFilePrefix(loadedPrefix);
    setFileNoOlderMatches([]);
    setShowOlderEntries(false);
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

  const saveToDb = async (dataOverride = null, skipReset = false) => {
    if (serverError) { if (window.toast) window.toast("System Offline: Cannot save data.", "error"); return false; }
    const dataToSave = dataOverride || formData;
    const finalFileNo = currentFilePrefix + dataToSave.fileNoSeq.trim();
    const method = isEditing ? 'PUT' : 'POST';
    const finalPaymentType = dataToSave.paymentType === 'Other' ? dataToSave.customPaymentType : dataToSave.paymentType;
    const url = isEditing ? `${API_URL}/general-receipts/${dataToSave.receiptNo}` : `${API_URL}/general-receipts`;
    const titleCasedName = toTitleCase(dataToSave.customerName);

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_no: dataToSave.receiptNo, date: dataToSave.date,
          customer_name: titleCasedName, mobile: dataToSave.mobile,
          file_no: finalFileNo, hp_financier: dataToSave.hp,
          model: dataToSave.model, amount: dataToSave.amount, payment_type: finalPaymentType,
          payment_mode: dataToSave.paymentMode, payment_date: dataToSave.dated || null,
          cheque_no: dataToSave.chequeNo || null, remarks: dataToSave.remarks || null,
          status: dataToSave.status || 'ACTIVE'
        })
      });
      if (!res.ok) throw new Error("Database Save Failed");
      if (window.toast) window.toast("Receipt Saved Successfully", "success");
      setFormData(prev => ({ ...prev, customerName: titleCasedName }));
      fetchHistory(); fetchAvailableMonths();
      
      if (!skipReset) {
        await doPostSaveReset();
      }
      
      return true;
    } catch { if (window.toast) window.toast("Error saving receipt. Please check connection.", "error"); return false; }
  };

  const buildReceiptHtmlString = (copy) => {
    const fd = formData;
    const hasValue = (val) => val && String(val).trim().length > 0;
    const fullFileNo = currentFilePrefix + fd.fileNoSeq;
    const amountWords = fd.amount && !isNaN(fd.amount)
      ? toWords.convert(fd.amount).toUpperCase() + " ONLY"
      : 'ZERO ONLY';
    const finalPaymentType = fd.paymentType === 'Other' ? fd.customPaymentType : fd.paymentType;
    const amountFormatted = Number(fd.amount).toLocaleString('en-IN');

    const cancelledOverlay = fd.status === 'CANCELLED' ? `
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:50;pointer-events:none;">
        <div style="border:4px solid rgba(239,68,68,0.3);color:rgba(239,68,68,0.3);font-size:64px;font-weight:900;transform:rotate(-45deg);padding:16px;border-radius:12px;letter-spacing:0.1em;user-select:none;line-height:1;">CANCELLED</div>
      </div>` : '';

    const fileNoHtml = hasValue(fullFileNo) ? `
      <div style="font-size:13px;font-weight:bold;color:#1f2937;">File Number: <span style="margin-left:4px;">${fullFileNo}</span></div>` : '';

    const modelHtml = hasValue(fd.model) ? `
      <div style="display:flex;align-items:flex-end;">
        <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">MODEL:</span>
        <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:14px;text-transform:uppercase;min-width:120px;text-align:center;">${fd.model}</span>
      </div>` : '';

    const hpHtml = hasValue(fd.hp) ? `
      <div style="display:flex;align-items:flex-end;">
        <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">H.P. TO:</span>
        <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:13px;text-transform:uppercase;min-width:150px;text-align:center;">${fd.hp}</span>
      </div>` : '';

    const mobileHtml = hasValue(fd.mobile) ? `
      <div style="display:flex;align-items:flex-end;">
        <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">MOBILE NO:</span>
        <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:14px;min-width:150px;text-align:center;">${fd.mobile}</span>
      </div>` : '';

    const datedHtml = hasValue(fd.dated) ? `
      <div style="font-weight:bold;font-size:12px;">DATED: <span style="margin-left:4px;">${formatDate(fd.dated)}</span></div>` : '';

    const chequeHtml = hasValue(fd.chequeNo) ? `
      <div style="font-style:italic;">Cheque/Ref No: <span style="font-weight:bold;">${fd.chequeNo}</span></div>` : '';

    const remarksHtml = hasValue(fd.remarks) ? `
      <div style="word-break:break-word;white-space:pre-wrap;line-height:1.2;">REMARKS: <span style="font-weight:bold;">${fd.remarks}</span></div>` : '';

    const extraFinanceHtml = (hasValue(fd.chequeNo) || hasValue(fd.remarks)) ? `
      <div style="display:flex;flex-direction:column;font-size:12px;font-weight:600;gap:2px;margin-top:4px;">
        ${chequeHtml}${remarksHtml}
      </div>` : '';

    const logoSrc = `${window.location.origin}/suzuki-logo.png`;

    return `
      <div style="position:relative;width:100%;height:100%;box-sizing:border-box;padding:4mm;display:flex;flex-direction:column;overflow:hidden;font-family:sans-serif;color:black;">
        ${cancelledOverlay}
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.07;z-index:0;">
          <img src="${logoSrc}" alt="" style="width:66%;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;position:relative;z-index:10;">
          <div style="width:45%;">
            <img src="${logoSrc}" alt="Suzuki" style="width:180px;max-width:100%;" />
            <div style="font-weight:bold;margin-top:2px;font-size:12px;">GST NO: 29AACCV2521J1ZA</div>
          </div>
          <div style="width:55%;text-align:right;">
            <h1 style="font-size:19px;font-weight:900;text-transform:uppercase;line-height:1.2;margin:0;">VALUE MOTOR AGENCY PVT LTD</h1>
            <p style="font-size:9px;font-weight:bold;margin-top:2px;letter-spacing:0.04em;margin:2px 0 0;">#16/A, MILLERS ROAD, VASANTH NAGAR, BANGALORE - 52</p>
            <p style="font-size:9px;font-weight:bold;letter-spacing:0.04em;margin:1px 0 0;">Mob: 9845906084 | Email: millers_road_suzuki@yahoo.com</p>
          </div>
        </div>
        <div style="border-bottom:2px solid black;text-align:center;margin-bottom:3px;padding-bottom:1px;">
          <span style="font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:0.2em;">RECEIPT</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:13px;font-weight:bold;position:relative;z-index:10;">
          <div>NO: <span style="color:#dc2626;font-size:18px;margin-left:8px;">${fd.receiptNo}</span></div>
          <div style="display:flex;align-items:center;gap:20px;">
            ${fileNoHtml}
            <div>DATE: <span style="margin-left:8px;font-size:15px;">${formatDate(fd.date)}</span></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;position:relative;z-index:10;margin-top:2px;">
          <div style="display:flex;align-items:flex-end;">
            <span style="font-weight:bold;margin-right:8px;white-space:nowrap;font-size:13px;">RECEIVED WITH THANKS FROM:</span>
            <span style="border-bottom:1px dotted black;flex-grow:1;padding:0 8px;font-weight:900;font-size:18px;text-transform:uppercase;line-height:1.2;color:#1e3a8a;">${fd.customerName}</span>
          </div>
          <div style="display:flex;flex-direction:column;">
            <span style="font-weight:bold;font-size:12px;margin-bottom:1px;letter-spacing:0.04em;">THE SUM OF RUPEES:</span>
            <div style="width:100%;padding:0 8px;font-weight:bold;font-size:17px;font-style:italic;text-transform:uppercase;line-height:28px;min-height:28px;word-break:break-word;background-image:radial-gradient(circle at 1px 26px,black 1px,transparent 1px);background-size:4px 28px;background-repeat:repeat;">
              ${amountWords}
            </div>
          </div>
          <div style="display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap;">
            ${modelHtml}
            <div style="display:flex;align-items:flex-end;">
              <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">ON ACCOUNT OF:</span>
              <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:14px;text-transform:uppercase;min-width:120px;text-align:center;">${finalPaymentType}</span>
            </div>
            <div style="display:flex;align-items:flex-end;">
              <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">BY WAY OF:</span>
              <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:14px;text-transform:uppercase;min-width:120px;text-align:center;">${fd.paymentMode}</span>
            </div>
          </div>
          ${hpHtml}
          ${mobileHtml}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;position:relative;z-index:10;">
            <div style="display:flex;flex-direction:column;gap:3px;flex:1;padding-right:16px;">
              <div style="display:flex;align-items:center;gap:16px;">
                <div style="border:2px solid black;padding:4px 14px;font-size:21px;font-weight:900;background-color:#f9fafb;white-space:nowrap;letter-spacing:0.05em;line-height:1;">
                  ₹ ${amountFormatted}/-
                </div>
                ${datedHtml}
              </div>
              ${extraFinanceHtml}
            </div>
            <div style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;flex-shrink:0;">
              <div style="font-size:11px;margin-bottom:2px;letter-spacing:0.04em;">
                <span style="font-weight:500;">For</span>
                <span style="font-weight:bold;text-transform:uppercase;font-size:11px;"> VALUE MOTOR AGENCY PVT LTD</span>
              </div>
              <div style="height:12mm;width:100%;"></div>
              <div style="font-size:11px;border-top:2px solid black;display:inline-block;padding:2px 28px 0;font-weight:bold;letter-spacing:0.04em;">
                Authorised Signatory
              </div>
            </div>
          </div>
        </div>
        <div style="margin-top:4px;padding-top:3px;border-top:1px solid #9ca3af;position:relative;z-index:10;">
          <div style="font-size:9px;font-weight:900;color:#1f2937;text-transform:uppercase;line-height:1.3;letter-spacing:0.04em;">
            WE BANK WITH STATE BANK OF INDIA | A/C NO: 32744599339 | IFSC: SBIN0021882 | BRANCH: VASANTHNAGAR
          </div>
          <div style="font-size:8.5px;font-weight:900;color:black;text-transform:uppercase;margin-top:2px;letter-spacing:0.04em;line-height:1.2;">
            <div>CHEQUES SUBJECT TO REALISATION. ANY CANCELLATION SUBJECT TO 10% DEDUCTION.</div>
            <div>PRICES PREVAILING AT THE TIME OF DELIVERY APPLICABLE.</div>
          </div>
        </div>
      </div>`;
  };

  const handleMobilePrint = async () => {
    if (serverError) { if (window.toast) window.toast("System Offline: Cannot print.", "error"); setIsPrinting(false); return; }
    if (!formData.amount || isNaN(formData.amount)) { if (window.toast) window.toast("Please enter a valid amount.", "error"); setIsPrinting(false); return; }

    const saved = await saveToDb(null, true);
    if (!saved) { setIsPrinting(false); return; }

    const receiptBody1 = buildReceiptHtmlString('customer');
    const receiptBody2 = buildReceiptHtmlString('office');

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt_${formData.receiptNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 210mm;
      background: white;
      font-family: sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-wrap {
      width: 210mm;
      min-height: 297mm;
      padding: 5mm;
      display: flex;
      flex-direction: column;
      gap: 12mm;
      background: white;
    }
    .receipt-block { display: flex; flex-direction: column; }
    .copy-label {
      text-align: right;
      font-weight: bold;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 1mm;
      letter-spacing: 0.15em;
      color: #6b7280;
      font-family: sans-serif;
    }
    .receipt-outer {
      border: 3px solid black;
      border-radius: 8px;
      background: white;
      color: black;
      position: relative;
      overflow: hidden;
    }
    .customer-copy { width: 200mm; height: 120mm; }
    .office-copy   { width: 185mm; height: 120mm; margin-left: 15mm; }
    @media print {
      @page { size: A4 portrait; margin: 0mm !important; }
      html, body { margin: 0 !important; padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="page-wrap">
    <div class="receipt-block">
      <div class="copy-label">CUSTOMER COPY</div>
      <div class="receipt-outer customer-copy">${receiptBody1}</div>
    </div>
    <div class="receipt-block">
      <div class="copy-label">OFFICE COPY</div>
      <div class="receipt-outer office-copy">${receiptBody2}</div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (window.toast) window.toast("Pop-ups blocked. Please allow pop-ups for this site.", "error");
      setIsPrinting(false);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();

    let printTriggered = false;
    const doPrintAndReset = () => {
      if (printTriggered) return;
      printTriggered = true;
      if (printWindow && !printWindow.closed) {
        printWindow.focus();
        printWindow.print();
      }
      setIsPrinting(false);
      doPostSaveReset();
    };

    printWindow.onload = () => {
      setTimeout(doPrintAndReset, 600);
    };

    setTimeout(doPrintAndReset, 2500);
  };

  const triggerPrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Receipt_${formData.receiptNo}`,
    onAfterPrint: () => {
      setIsPrinting(false);
      doPostSaveReset();
    },
  });

  const handlePrint = async () => {
    if (serverError) { if (window.toast) window.toast("System Offline: Cannot print.", "error"); return; }
    if (!formData.amount || isNaN(formData.amount)) { if (window.toast) window.toast("Please enter a valid amount.", "error"); return; }

    setIsPrinting(true);

    if (isMobile()) {
      await handleMobilePrint();
    } else {
      const saved = await saveToDb(null, true);
      if (!saved) { setIsPrinting(false); return; }
      triggerPrint();
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
      const customer = toTitleCase(item.customer_name || '');
      const fileNo = item.file_no || '';
      const rawReceiptNo = String(item.receipt_no);
      const shortReceiptNo = rawReceiptNo.length >= 6 ? rawReceiptNo.slice(2) : rawReceiptNo;
      return {
        "Date": formatDate(item.date),
        "Complete Reciept Number": rawReceiptNo,
        "Receipt No": shortReceiptNo,
        "File Number-Customer Name": fileNo && customer ? `${fileNo}-${customer}` : `${fileNo}${customer}`,
        "Amount": item.amount, "Mode": item.payment_mode, "Type": item.payment_type,
        "File No": item.file_no, "Customer Name": customer, "Mobile": item.mobile,
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

  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
  const paginatedHistory = history.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
        <div style={{ fontSize: '8.5px', fontWeight: 900, color: 'black', textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.04em', lineHeight: 1.2 }}>
          <div>CHEQUES SUBJECT TO REALISATION. ANY CANCELLATION SUBJECT TO 10% DEDUCTION.</div>
          <div>PRICES PREVAILING AT THE TIME OF DELIVERY APPLICABLE.</div>
        </div>
      </div>
    </div>
  );

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

                  {/* ── File No field with editable prefix + smart seq input ── */}
                  <div>
                    <label className={labelClass}>
                      File No
                      <span className={`ml-1 font-normal normal-case ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(or YYseq)</span>
                    </label>
                    <div className="relative">
                      <div className="flex shadow-sm rounded border overflow-hidden">
                        {/* Editable prefix */}
                        <input
                          value={currentFilePrefix}
                          onChange={handlePrefixChange}
                          className={`w-16 p-1.5 text-xs font-mono font-bold text-center border-r focus:outline-none focus:bg-yellow-50 dark:focus:bg-yellow-900/20 ${isDark ? 'bg-gray-600 text-gray-300 border-gray-500' : 'bg-gray-100 text-gray-600 border-gray-300'}`}
                          placeholder="PFX"
                          title="Prefix — edit if needed"
                        />
                        {/* Seq input */}
                        <input
                          name="fileNoSeq"
                          value={formData.fileNoSeq}
                          onChange={handleFileChange}
                          autoComplete="off"
                          className={`w-full p-1.5 text-sm font-mono tracking-wide font-bold text-blue-600 focus:outline-none ${isDark ? 'bg-gray-700 text-red-400' : 'bg-white'}`}
                          placeholder="XXXX"
                        />
                        {/* "older entries" toggle */}
                        {fileNoOlderMatches.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowOlderEntries(v => !v)}
                            title={`${fileNoOlderMatches.length} older record${fileNoOlderMatches.length > 1 ? 's' : ''} with same number`}
                            className={`px-2 flex items-center border-l transition-colors ${
                              showOlderEntries
                                ? (isDark ? 'bg-blue-700 border-blue-600 text-white' : 'bg-blue-100 border-blue-300 text-blue-700')
                                : (isDark ? 'bg-gray-600 border-gray-500 text-gray-400 hover:text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-400 hover:text-gray-600')
                            }`}
                          >
                            <ChevronDown size={13} className={`transition-transform ${showOlderEntries ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>

                      {/* Older entries dropdown */}
                      {showOlderEntries && fileNoOlderMatches.length > 0 && (
                        <div className={`absolute top-full left-0 right-0 z-20 mt-1 border rounded-lg shadow-lg overflow-hidden ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                          <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                            Older records — same file seq
                          </div>
                          {fileNoOlderMatches.map(match => (
                            <div
                              key={match.receipt_no}
                              onClick={() => selectOlderEntry(match)}
                              className={`px-3 py-2 cursor-pointer flex justify-between items-center text-sm border-t transition-colors ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-blue-50'}`}
                            >
                              <div>
                                <span className={`font-bold text-xs font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{match.file_no}</span>
                                <span className={`ml-2 font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{match.customer_name}</span>
                              </div>
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{match.mobile || '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
                onClick={handlePrint}
                disabled={serverError || isPrinting}
                className={`w-full mt-3 font-bold py-2.5 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all ${
                  serverError || isPrinting
                    ? "bg-gray-400 cursor-not-allowed text-gray-200"
                    : formData.status === 'CANCELLED'
                    ? "bg-red-500 text-white cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {serverError ? (
                  <WifiOff size={18} />
                ) : isPrinting ? (
                  <svg className="animate-spin" width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <Printer size={18} />
                )}
                {serverError ? "Offline" : isPrinting ? "Saving..." : isEditing ? "Update & Print" : "Save & Print"}
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
                {paginatedHistory.map(item => (
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, history.length)}</span> of <span className="font-medium">{history.length}</span> results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} ${isDark ? 'text-gray-300 bg-gray-800 border border-gray-600' : 'text-gray-700 bg-white border border-gray-300'}`}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} ${isDark ? 'text-gray-300 bg-gray-800 border border-gray-600' : 'text-gray-700 bg-white border border-gray-300'}`}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden print target — desktop only */}
      <div className="print-only" style={{ position: 'absolute', overflow: 'hidden', height: 0, width: 0, top: '-9999px', left: '-9999px' }}>
        {renderPrintLayout()}
      </div>
    </div>
  );
};

export default Receipt;