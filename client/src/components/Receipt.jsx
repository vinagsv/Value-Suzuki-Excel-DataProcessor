import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ToWords } from 'to-words';
import { Printer, RefreshCw, WifiOff, Calendar, Ban, Search, ChevronLeft, ChevronRight, ChevronDown, Edit3, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { buildEncryptedQrDataUrl } from '../utils/qrCrypto';
import { logCreated, logEdited, logCancelled, fetchQrEnabled } from '../utils/auditLog';
import DaySummary from './DaySummary';
import ReceiptDocument, {
  buildReceiptHtmlString,
  formatDate,
  A4_W_PX,
  PREVIEW_NATURAL_H,
} from './ReceiptDocument';

const API_URL            = import.meta.env.VITE_API_URL;
const PREFIX_STORAGE_KEY = 'vma_last_known_prefix';

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: { currency: false, ignoreDecimal: false, ignoreZeroCurrency: false, doNotAddOnly: true },
});

const toTitleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const extractSeqFromFileNo = (fileNo) => {
  if (!fileNo) return '';
  const clean = fileNo.replace(/\s/g, '');
  if (clean.includes('/')) return clean.split('/').pop();
  if (clean.includes('-')) return clean.split('-').pop();
  return clean.replace(/^[A-Za-z]+/, '');
};

const extractPrefixFromFileNo = (fileNo, seq) => {
  if (!fileNo || !seq) return '';
  const clean = fileNo.replace(/\s/g, '');
  return clean.slice(0, clean.length - seq.length);
};

// Returns true if the prefix year looks older than the current financial year.
// Financial year in India: April (month index 3) starts the new year.
const detectPrefixYearMismatch = (prefix) => {
  if (!prefix) return false;
  const match = prefix.match(/20(\d{2})/);
  if (!match) return false;
  const prefixYear  = parseInt(match[1], 10);
  const now         = new Date();
  const currentFY   = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const currentFYShort = currentFY % 100;
  return prefixYear < currentFYShort;
};

const Receipt = ({ theme }) => {
  const isDark = theme === 'dark';

  // ── Refs ───────────────────────────────────────────────────────────────────
  const componentRef    = useRef(null);
  const previewPanelRef = useRef(null);
  const qrGenTimerRef   = useRef(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [previewScale, setPreviewScale] = useState(1);
  const [qrDataUrl,    setQrDataUrl]    = useState(null);
  const [qrEnabled,    setQrEnabled]    = useState(true);

  const initialForm = {
    receiptNo: '', date: new Date().toISOString().split('T')[0],
    customerName: '', mobile: '', fileNoSeq: '', hp: '', model: '',
    amount: '', paymentType: 'Booking', customPaymentType: '',
    paymentMode: 'Cash', dated: '', chequeNo: '', remarks: '', status: 'ACTIVE',
  };

  const [formData,           setFormData]          = useState(initialForm);
  // filePrefix  = server's canonical prefix (from last successful /next fetch)
  // currentFilePrefix = what is shown and editable on screen (may differ for old-year records)
  // Both are persisted in localStorage so a failed fetch never blanks them.
  const [filePrefix,         setFilePrefix]         = useState(() => localStorage.getItem(PREFIX_STORAGE_KEY) || '');
  const [currentFilePrefix,  setCurrentFilePrefix]  = useState(() => localStorage.getItem(PREFIX_STORAGE_KEY) || '');
  const [prefixWarning,      setPrefixWarning]      = useState(false);
  const [isEditing,          setIsEditing]          = useState(false);
  const [editSnapshot,       setEditSnapshot]       = useState(null);
  const [history,            setHistory]            = useState([]);
  const [availableMonths,    setAvailableMonths]    = useState([]);
  const [exportRange,        setExportRange]        = useState({ from: '', to: '' });
  const [serverError,        setServerError]        = useState(false);
  const [showSummary,        setShowSummary]        = useState(false);
  const [searchTerm,         setSearchTerm]         = useState('');
  const [searchResults,      setSearchResults]      = useState([]);
  const [fileNoOlderMatches, setFileNoOlderMatches] = useState([]);
  const [showOlderEntries,   setShowOlderEntries]   = useState(false);
  const [currentPage,        setCurrentPage]        = useState(1);
  const [isPrinting,         setIsPrinting]         = useState(false);
  const ITEMS_PER_PAGE = 50;

  // ── Derived ────────────────────────────────────────────────────────────────
  const amountInWords = formData.amount && !isNaN(formData.amount)
    ? toWords.convert(formData.amount).toUpperCase() + ' ONLY'
    : 'ZERO ONLY';

  // ── QR generation ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (qrGenTimerRef.current) clearTimeout(qrGenTimerRef.current);
    if (!qrEnabled) { setQrDataUrl(null); return; }
    qrGenTimerRef.current = setTimeout(async () => {
      const fullFileNo = currentFilePrefix + formData.fileNoSeq;
      const url = await buildEncryptedQrDataUrl(formData.receiptNo, formData.date, formData.amount, fullFileNo);
      setQrDataUrl(url);
    }, 300);
    return () => clearTimeout(qrGenTimerRef.current);
  }, [formData.receiptNo, formData.date, formData.amount, formData.fileNoSeq, currentFilePrefix, qrEnabled]);

  // ── Preview scale ──────────────────────────────────────────────────────────
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

  // ── Safe prefix updater — only stores non-empty values to localStorage ─────
  const safeSetFilePrefix = (newPrefix) => {
    if (newPrefix) localStorage.setItem(PREFIX_STORAGE_KEY, newPrefix);
    setFilePrefix(newPrefix);
    setPrefixWarning(detectPrefixYearMismatch(newPrefix));
  };

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchNextReceiptNo = async () => {
    try {
      const res = await fetch(`${API_URL}/general-receipts/next`);
      if (!res.ok) throw new Error('Server Error');
      const data   = await res.json();
      const prefix = data.prefix || '';

      if (prefix) {
        safeSetFilePrefix(prefix);
        setCurrentFilePrefix(prefix);
      } else {
        // Server returned empty prefix — keep last known value
        const kept = localStorage.getItem(PREFIX_STORAGE_KEY) || '';
        setCurrentFilePrefix(kept);
        setPrefixWarning(detectPrefixYearMismatch(kept));
      }

      setFormData(prev => ({ ...prev, receiptNo: String(data.nextReceiptNo || '---'), fileNoSeq: '' }));
      setServerError(false);
    } catch {
      // On failure — restore from localStorage, never blank the prefix
      const saved = localStorage.getItem(PREFIX_STORAGE_KEY) || '';
      setFilePrefix(saved);
      setCurrentFilePrefix(saved);
      setPrefixWarning(detectPrefixYearMismatch(saved));
      setFormData(prev => ({ ...prev, receiptNo: 'OFFLINE' }));
      setServerError(true);
    }
  };

  // fetchHistory: uses /list/all — returns EVERY receipt, no 100-row cap.
  // This populates the archive table, the file-no autocomplete, and the export.
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/general-receipts/list/all`);
      if (!res.ok) throw new Error('Fetch failed');
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
    fetchQrEnabled().then(enabled => setQrEnabled(enabled));
  }, []);

  // ── Keyboard navigation (PageUp/PageDown through history) ──────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'PageUp' || e.key === 'PageDown') && history.length > 0) {
        e.preventDefault();
        let currentIndex = history.findIndex(item => String(item.receipt_no) === String(formData.receiptNo));
        if (currentIndex === -1 && e.key === 'PageDown') currentIndex = -1;
        const newIndex = e.key === 'PageUp' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex >= 0 && newIndex < history.length) handleEdit(history[newIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData.receiptNo, history]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const resetForm = () => {
    // Capture best available prefix BEFORE any state changes
    const prefixToKeep = currentFilePrefix || filePrefix || localStorage.getItem(PREFIX_STORAGE_KEY) || '';
    setFormData({ ...initialForm, date: new Date().toISOString().split('T')[0], receiptNo: formData.receiptNo, fileNoSeq: '' });
    setIsEditing(false);
    setEditSnapshot(null);
    setSearchTerm('');
    setSearchResults([]);
    setFileNoOlderMatches([]);
    setShowOlderEntries(false);
    // Restore prefix explicitly before fetch so a failed fetch never blanks it
    setCurrentFilePrefix(prefixToKeep);
    setFilePrefix(prefixToKeep);
    fetchNextReceiptNo();
  };

  const doPostSaveReset = async () => {
    if (isEditing) {
      resetForm();
    } else {
      const prefixToKeep = currentFilePrefix || filePrefix || localStorage.getItem(PREFIX_STORAGE_KEY) || '';
      setFormData(prev => ({ ...initialForm, date: prev.date, receiptNo: prev.receiptNo, fileNoSeq: '' }));
      setCurrentFilePrefix(prefixToKeep);
      await fetchNextReceiptNo();
    }
  };

  // ── File-number autocomplete ───────────────────────────────────────────────
  const applyFileNoMatch = (match) => {
    const fileNo         = (match.file_no || '').replace(/\s/g, '');
    const detectedPrefix = extractPrefixFromFileNo(fileNo, extractSeqFromFileNo(fileNo));
    setCurrentFilePrefix(detectedPrefix);
    setFormData(prev => ({
      ...prev,
      fileNoSeq:    extractSeqFromFileNo(fileNo),
      customerName: isEditing && prev.customerName ? prev.customerName : match.customer_name,
      mobile:       isEditing && prev.mobile       ? prev.mobile       : (match.mobile || ''),
      model:        isEditing && prev.model        ? prev.model        : (match.model || ''),
      hp:           isEditing && prev.hp           ? prev.hp           : (match.hp_financier || ''),
    }));
  };

  const handleFileChange = (e) => {
    const rawInput = e.target.value;
    setFormData(prev => ({ ...prev, fileNoSeq: rawInput }));
    setFileNoOlderMatches([]);
    setShowOlderEntries(false);

    if (!Array.isArray(history) || rawInput.trim().length < 3) {
      setFormData(prev => ({
        ...prev,
        fileNoSeq: rawInput,
        ...(isEditing ? {} : { customerName: '', mobile: '', model: '', hp: '' }),
      }));
      if (!isEditing) {
        // Never reset to potentially empty filePrefix — use localStorage fallback
        const safeFallback = filePrefix || localStorage.getItem(PREFIX_STORAGE_KEY) || '';
        setCurrentFilePrefix(prev => prev || safeFallback);
      }
      return;
    }

    const cleanInput = rawInput.replace(/\s/g, '');

    // 6-digit shorthand: YY + seq (e.g. 250963)
    if (/^\d{6}$/.test(cleanInput)) {
      const yearHint  = cleanInput.substring(0, 2);
      const seqHint   = cleanInput.substring(2);
      const yearMatch = history.find(item => {
        const fileNo = (item.file_no || '').replace(/\s/g, '');
        const seq    = extractSeqFromFileNo(fileNo);
        const prefix = extractPrefixFromFileNo(fileNo, seq);
        return seq === seqHint && (prefix.includes('20' + yearHint) || prefix.includes(yearHint));
      });
      if (yearMatch) { applyFileNoMatch(yearMatch); return; }
      // No match — build year-specific prefix from the typed year hint
      const basePfx         = filePrefix || localStorage.getItem(PREFIX_STORAGE_KEY) || '';
      const correctedPrefix = basePfx.replace(/20\d{2}/, '20' + yearHint) || basePfx;
      setCurrentFilePrefix(correctedPrefix);
      setFormData(prev => ({
        ...prev,
        fileNoSeq: seqHint,
        ...(isEditing ? {} : { customerName: '', mobile: '', model: '', hp: '' }),
      }));
      return;
    }

    // Normal seq search — find all records matching this sequence number
    const allMatches = history.filter(item => {
      const fileNo = (item.file_no || '').replace(/\s/g, '');
      return fileNo && extractSeqFromFileNo(fileNo) === cleanInput;
    });

    if (allMatches.length === 0) {
      setFormData(prev => ({
        ...prev,
        fileNoSeq: rawInput,
        ...(isEditing ? {} : { customerName: '', mobile: '', model: '', hp: '' }),
      }));
      if (!isEditing) {
        const safeFallback = filePrefix || localStorage.getItem(PREFIX_STORAGE_KEY) || '';
        setCurrentFilePrefix(prev => prev || safeFallback);
      }
      return;
    }

    // Sort descending by prefix so latest financial year is first
    const sorted = [...allMatches].sort((a, b) =>
      (b.file_no || '').replace(/\s/g, '').localeCompare((a.file_no || '').replace(/\s/g, ''))
    );
    applyFileNoMatch(sorted[0]);
    if (sorted.length > 1) setFileNoOlderMatches(sorted.slice(1));
  };

  const handlePrefixChange = (e) => setCurrentFilePrefix(e.target.value);

  const selectOlderEntry = (match) => {
    applyFileNoMatch(match);
    setShowOlderEntries(false);
    setFileNoOlderMatches([]);
  };

  // ── Search input — filters in-memory history (complete dataset) ────────────
  // Because history contains every record, this works for all FYs instantly.
  const handleSearchInput = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (term.length < 2) { setSearchResults([]); return; }

    // Filter the full in-memory dataset — instant and complete across all FYs
    if (history.length > 0) {
      const lower   = term.toLowerCase();
      const results = history
        .filter(r =>
          String(r.receipt_no).includes(lower) ||
          (r.customer_name || '').toLowerCase().includes(lower) ||
          (r.file_no       || '').toLowerCase().includes(lower) ||
          (r.mobile        || '').toLowerCase().includes(lower)
        )
        .slice(0, 20);
      setSearchResults(results);
      return;
    }

    // Fallback: history not yet loaded — hit server
    try {
      const res = await fetch(
        `${API_URL}/general-receipts/list?search=${encodeURIComponent(term)}&page=1`
      );
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data.rows || []);
        setSearchResults(rows.slice(0, 20));
      }
    } catch (err) { console.error(err); }
  };

  const selectSearchResult = (item) => { handleEdit(item); setSearchResults([]); setSearchTerm(''); };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = (item) => {
    if (serverError) return alert('System is offline. Cannot edit receipts.');
    let loadedSeq    = item.file_no || '';
    let loadedPrefix = filePrefix || localStorage.getItem(PREFIX_STORAGE_KEY) || '';
    if (loadedSeq) {
      if (filePrefix && loadedSeq.startsWith(filePrefix)) {
        loadedPrefix = filePrefix;
        loadedSeq    = loadedSeq.substring(filePrefix.length);
      } else {
        const seq    = extractSeqFromFileNo(loadedSeq);
        loadedPrefix = extractPrefixFromFileNo(loadedSeq, seq);
        loadedSeq    = seq;
      }
    }
    setCurrentFilePrefix(loadedPrefix);
    setFileNoOlderMatches([]);
    setShowOlderEntries(false);
    const loaded = {
      receiptNo:         item.receipt_no,
      date:              item.date ? item.date.substring(0, 10) : new Date().toISOString().split('T')[0],
      customerName:      item.customer_name,
      mobile:            item.mobile || '',
      fileNoSeq:         loadedSeq,
      hp:                item.hp_financier || '',
      model:             item.model || '',
      amount:            item.amount,
      paymentType:       ['Booking', 'Down Payment', 'Balance Payment'].includes(item.payment_type) ? item.payment_type : 'Other',
      customPaymentType: !['Booking', 'Down Payment', 'Balance Payment'].includes(item.payment_type) ? item.payment_type : '',
      paymentMode:       item.payment_mode || 'Cash',
      dated:             item.payment_date ? item.payment_date.substring(0, 10) : '',
      chequeNo:          item.cheque_no || '',
      remarks:           item.remarks || '',
      status:            item.status || 'ACTIVE',
    };
    setFormData(loaded);
    setEditSnapshot({ ...loaded, file_no: item.file_no || '' });
    setIsEditing(true);
    setSearchTerm('');
    setSearchResults([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Cancel receipt ─────────────────────────────────────────────────────────
  const handleCancelReceipt = async () => {
    if (!isEditing) return;
    if (!window.confirm('Are you sure you want to CANCEL this receipt? This will be watermarked.')) return;
    const updatedForm = { ...formData, status: 'CANCELLED' };
    setFormData(updatedForm);
    await saveToDb(updatedForm);
  };

  // ── Save to DB + audit log ─────────────────────────────────────────────────
  const saveToDb = async (dataOverride = null, skipReset = false) => {
    if (serverError) { if (window.toast) window.toast('System Offline: Cannot save data.', 'error'); return false; }
    const dataToSave       = dataOverride || formData;
    const finalFileNo      = currentFilePrefix + dataToSave.fileNoSeq.trim();
    const method           = isEditing ? 'PUT' : 'POST';
    const finalPaymentType = dataToSave.paymentType === 'Other' ? dataToSave.customPaymentType : dataToSave.paymentType;
    const url              = isEditing ? `${API_URL}/general-receipts/${dataToSave.receiptNo}` : `${API_URL}/general-receipts`;
    const titleCasedName   = toTitleCase(dataToSave.customerName);

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_no:    dataToSave.receiptNo,
          date:          dataToSave.date,
          customer_name: titleCasedName,
          mobile:        dataToSave.mobile,
          file_no:       finalFileNo,
          hp_financier:  dataToSave.hp,
          model:         dataToSave.model,
          amount:        dataToSave.amount,
          payment_type:  finalPaymentType,
          payment_mode:  dataToSave.paymentMode,
          payment_date:  dataToSave.dated || null,
          cheque_no:     dataToSave.chequeNo || null,
          remarks:       dataToSave.remarks || null,
          status:        dataToSave.status || 'ACTIVE',
        }),
      });
      if (!res.ok) {
        // Surface the specific server error (e.g. duplicate receipt 409) instead
        // of a generic message, so the user understands what went wrong.
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Database Save Failed');
      }
      if (window.toast) window.toast('Receipt Saved Successfully', 'success');
      setFormData(prev => ({ ...prev, customerName: titleCasedName }));

      // ── Audit log ────────────────────────────────────────────────────────
      const afterSnapshot = {
        date:          dataToSave.date,
        customer_name: titleCasedName,
        mobile:        dataToSave.mobile || '',
        file_no:       finalFileNo,
        hp_financier:  dataToSave.hp || '',
        model:         dataToSave.model || '',
        amount:        String(dataToSave.amount),
        payment_type:  finalPaymentType,
        payment_mode:  dataToSave.paymentMode,
        payment_date:  dataToSave.dated || '',
        cheque_no:     dataToSave.chequeNo || '',
        remarks:       dataToSave.remarks || '',
        status:        dataToSave.status || 'ACTIVE',
      };

      if (!isEditing) {
        await logCreated(dataToSave.receiptNo, afterSnapshot);
      } else if (dataToSave.status === 'CANCELLED' && editSnapshot?.status !== 'CANCELLED') {
        await logCancelled(dataToSave.receiptNo);
      } else if (editSnapshot) {
        const beforeSnapshot = {
          date:          editSnapshot.date,
          customer_name: editSnapshot.customerName,
          mobile:        editSnapshot.mobile || '',
          file_no:       editSnapshot.file_no,
          hp_financier:  editSnapshot.hp || '',
          model:         editSnapshot.model || '',
          amount:        String(editSnapshot.amount),
          payment_type:  editSnapshot.paymentType === 'Other' ? editSnapshot.customPaymentType : editSnapshot.paymentType,
          payment_mode:  editSnapshot.paymentMode,
          payment_date:  editSnapshot.dated || '',
          cheque_no:     editSnapshot.chequeNo || '',
          remarks:       editSnapshot.remarks || '',
          status:        editSnapshot.status || 'ACTIVE',
        };
        await logEdited(dataToSave.receiptNo, beforeSnapshot, afterSnapshot);
      }

      // Refresh the snapshot to the stored (title-cased) values so a second
      // consecutive edit (without re-selecting) diffs against what is actually
      // in the DB, not the pre-edit raw values. Prevents phantom diffs.
      setEditSnapshot({
        ...dataToSave,
        customerName: titleCasedName,
        file_no:      finalFileNo,
      });

      fetchHistory();
      fetchAvailableMonths();
      if (!skipReset) await doPostSaveReset();
      return true;
    } catch (err) {
      if (window.toast) window.toast(err.message || 'Error saving receipt. Please check connection.', 'error');
      return false;
    }
  };

  // ── Mobile print ───────────────────────────────────────────────────────────
  const handleMobilePrint = async () => {
    if (serverError) { if (window.toast) window.toast('System Offline: Cannot print.', 'error'); setIsPrinting(false); return; }
    if (!formData.amount || isNaN(formData.amount)) { if (window.toast) window.toast('Please enter a valid amount.', 'error'); setIsPrinting(false); return; }

    const saved = await saveToDb(null, true);
    if (!saved) { setIsPrinting(false); return; }

    const fullFileNo = currentFilePrefix + formData.fileNoSeq;
    const qrUrl      = qrEnabled
      ? await buildEncryptedQrDataUrl(formData.receiptNo, formData.date, formData.amount, fullFileNo)
      : null;

    const sharedArgs   = { formData, currentFilePrefix, qrDataUrl: qrUrl, qrEnabled, amountInWords };
    const receiptBody1 = buildReceiptHtmlString(sharedArgs);
    const receiptBody2 = buildReceiptHtmlString(sharedArgs);

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt_${formData.receiptNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 210mm; background: white; font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-wrap { width: 210mm; min-height: 297mm; padding: 5mm; display: flex; flex-direction: column; gap: 12mm; background: white; }
    .receipt-block { display: flex; flex-direction: column; }
    .copy-label { text-align: right; font-weight: bold; font-size: 10px; text-transform: uppercase; margin-bottom: 1mm; letter-spacing: 0.15em; color: #6b7280; font-family: sans-serif; }
    .receipt-outer { border: 3px solid black; border-radius: 8px; background: white; color: black; position: relative; overflow: hidden; }
    .customer-copy { width: 200mm; height: 120mm; }
    .office-copy   { width: 185mm; height: 120mm; margin-left: 15mm; }
    @media print { @page { size: A4 portrait; margin: 0mm !important; } html, body { margin: 0 !important; padding: 0 !important; } }
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
      if (window.toast) window.toast('Pop-ups blocked. Please allow pop-ups for this site.', 'error');
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
      if (printWindow && !printWindow.closed) { printWindow.focus(); printWindow.print(); }
      setIsPrinting(false);
      doPostSaveReset();
    };
    printWindow.onload = () => setTimeout(doPrintAndReset, 600);
    setTimeout(doPrintAndReset, 2500);
  };

  const triggerPrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Receipt_${formData.receiptNo}`,
    onAfterPrint: () => { setIsPrinting(false); doPostSaveReset(); },
  });

  const handlePrint = async () => {
    if (serverError) { if (window.toast) window.toast('System Offline: Cannot print.', 'error'); return; }
    if (!formData.amount || isNaN(formData.amount)) { if (window.toast) window.toast('Please enter a valid amount.', 'error'); return; }
    setIsPrinting(true);
    if (isMobile()) {
      await handleMobilePrint();
    } else {
      const saved = await saveToDb(null, true);
      if (!saved) { setIsPrinting(false); return; }
      triggerPrint();
    }
  };

  // ── Export — always fetches /list/all fresh for a complete dataset ──────────
  const handleExport = async () => {
    let data = [];
    try {
      const res = await fetch(`${API_URL}/general-receipts/list/all`);
      if (!res.ok) throw new Error('Failed');
      const raw = await res.json();
      data = Array.isArray(raw) ? raw : [];
    } catch {
      // Graceful degradation — use whatever is already in state
      data = history;
      if (window.toast) window.toast('Using cached data — some old records may be missing.', 'info');
    }

    // Apply date-range filter if set
    if (exportRange.from && exportRange.to) {
      data = data.filter(item => {
        const d = item.date.substring(0, 10);
        return d >= exportRange.from && d <= exportRange.to;
      });
    }

    const sortedData = [...data].sort((a, b) => {
      const dA = new Date(a.date).getTime(), dB = new Date(b.date).getTime();
      return dA !== dB ? dA - dB : parseInt(a.receipt_no) - parseInt(b.receipt_no);
    });

    const dataToExport = sortedData.map(item => {
      const customer       = toTitleCase(item.customer_name || '');
      const fileNo         = item.file_no || '';
      const rawReceiptNo   = String(item.receipt_no);
      const shortReceiptNo = rawReceiptNo.length >= 6 ? rawReceiptNo.slice(2) : rawReceiptNo;
      return {
        'Date':                      formatDate(item.date),
        'Complete Reciept Number':   rawReceiptNo,
        'Receipt No':                shortReceiptNo,
        'File Number-Customer Name': fileNo && customer ? `${fileNo}-${customer}` : `${fileNo}${customer}`,
        'Amount':                    item.amount,
        'Mode':                      item.payment_mode,
        'Type':                      item.payment_type,
        'File No':                   fileNo,
        'Customer Name':             customer,
        'Mobile':                    item.mobile,
        'Model':                     item.model,
        'HP To':                     item.hp_financier,
        'Status':                    item.status || 'ACTIVE',
        'Cheque No':                 item.cheque_no,
        'Dated':                     item.payment_date ? formatDate(item.payment_date) : '',
        'Remarks':                   item.remarks,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Receipts');
    XLSX.writeFile(workbook, 'Receipts_Report.xlsx');
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputClass       = `w-full p-1.5 rounded border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`;
  const labelClass       = `block text-[10px] font-bold uppercase mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`;
  const tableHeaderClass = `px-4 py-2 text-left text-xs font-semibold ${isDark ? 'text-gray-300 bg-gray-700' : 'text-gray-600 bg-gray-100'}`;
  const tableRowClass    = `border-b ${isDark ? 'border-gray-700 hover:bg-gray-700/50 text-gray-200' : 'border-gray-100 hover:bg-gray-50 text-gray-800'} transition-colors`;

  const totalPages       = Math.ceil(history.length / ITEMS_PER_PAGE);
  const paginatedHistory = history.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const receiptDocProps = {
    formData,
    currentFilePrefix,
    qrDataUrl,
    qrEnabled,
    amountInWords,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-2 md:p-4 max-w-7xl">
      <div className="no-print">
        <DaySummary isOpen={showSummary} onClose={() => setShowSummary(false)} theme={theme} />

        {/* Top bar */}
        <div className={`mb-4 flex flex-col sm:flex-row justify-between items-center p-4 rounded-2xl shadow-lg gap-4 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-200'}`}>
          <div className="w-full sm:w-[400px] relative z-30">
            <input
              type="text" value={searchTerm} onChange={handleSearchInput}
              placeholder="Search by File No, Name, Receipt #, Mobile..."
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
                      <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        File: {r.file_no || '--'} · Date: {formatDate(r.date)} · Mob: {r.mobile || '--'}
                      </div>
                    </div>
                    <div className={`font-bold text-lg ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>₹{r.amount}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            type="button" onClick={() => setShowSummary(true)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all border shadow-sm whitespace-nowrap w-full sm:w-auto justify-center backdrop-blur-md ${isDark ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white' : 'bg-white/40 hover:bg-white/60 border-white/50 text-gray-800'}`}
          >
            <Calendar size={18} /> Daily Summary
          </button>
        </div>

        {/* Financial year prefix warning */}
        {prefixWarning && (
          <div className={`mb-4 flex items-start gap-3 p-4 rounded-xl border-l-4 border-amber-500 ${isDark ? 'bg-amber-900/20 text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <div className="font-bold text-sm">New financial year — check your file prefix</div>
              <div className="text-xs mt-1 opacity-80">
                Current prefix is <span className="font-mono font-bold">{currentFilePrefix || filePrefix}</span>. If the new financial year has started, update the prefix in Admin → Settings. For receipts belonging to the previous year, edit the prefix field directly in the form below — it won't affect other receipts.
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          {/* ── Form ── */}
          <div className={`w-full lg:w-[380px] lg:flex-shrink-0 p-4 rounded-xl shadow-lg h-fit ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'} border`}>
            {serverError && (
              <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-2 rounded shadow-md animate-pulse">
                <div className="flex items-center gap-2"><WifiOff size={16} /><p className="font-bold text-xs">System Offline</p></div>
              </div>
            )}

            {/* Cancelled receipt notice */}
            {formData.status === 'CANCELLED' && isEditing && (
              <div className={`mb-3 flex items-center gap-2 p-2 rounded-lg text-xs font-bold ${isDark ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                <Ban size={14} /> This receipt is CANCELLED. You can reprint it with the watermark.
              </div>
            )}

            <div className="flex items-start justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{isEditing ? 'Edit Receipt' : 'New Receipt'}</h2>
                <div className="text-sm font-bold text-red-600 mt-0.5">#{formData.receiptNo}</div>
              </div>
              <div className="flex gap-2">
                {isEditing && formData.status !== 'CANCELLED' && (
                  <button type="button" onClick={handleCancelReceipt} className="bg-red-100 text-red-600 hover:bg-red-200 p-1.5 rounded transition" title="Cancel Receipt">
                    <Ban size={16} />
                  </button>
                )}
                <button type="button" onClick={resetForm} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1">
                  <RefreshCw size={14} /> Clear & Reset
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <fieldset disabled={serverError} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelClass}>Date</label><input type="date" name="date" value={formData.date} onChange={handleChange} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>
                      File No
                      <span className={`ml-1 font-normal normal-case ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(or YYseq)</span>
                    </label>
                    <div className="relative">
                      <div className="flex shadow-sm rounded border overflow-hidden">
                        <input
                          value={currentFilePrefix} onChange={handlePrefixChange}
                          className={`w-16 p-1.5 text-xs font-mono font-bold text-center border-r focus:outline-none focus:bg-yellow-50 dark:focus:bg-yellow-900/20 ${isDark ? 'bg-gray-600 text-gray-300 border-gray-500' : 'bg-gray-100 text-gray-600 border-gray-300'}`}
                          placeholder="PFX" title="Prefix — edit for previous year receipts"
                        />
                        <input
                          name="fileNoSeq" value={formData.fileNoSeq} onChange={handleFileChange} autoComplete="off"
                          className={`w-full p-1.5 text-sm font-mono tracking-wide font-bold text-blue-600 focus:outline-none ${isDark ? 'bg-gray-700 text-red-400' : 'bg-white'}`}
                          placeholder="XXXX"
                        />
                        {fileNoOlderMatches.length > 0 && (
                          <button
                            type="button" onClick={() => setShowOlderEntries(v => !v)}
                            title={`${fileNoOlderMatches.length} older record${fileNoOlderMatches.length > 1 ? 's' : ''} with same number`}
                            className={`px-2 flex items-center border-l transition-colors ${showOlderEntries ? (isDark ? 'bg-blue-700 border-blue-600 text-white' : 'bg-blue-100 border-blue-300 text-blue-700') : (isDark ? 'bg-gray-600 border-gray-500 text-gray-400 hover:text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-400 hover:text-gray-600')}`}
                          >
                            <ChevronDown size={13} className={`transition-transform ${showOlderEntries ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      {showOlderEntries && fileNoOlderMatches.length > 0 && (
                        <div className={`absolute top-full left-0 right-0 z-20 mt-1 border rounded-lg shadow-lg overflow-hidden ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                          <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                            Older records — same file seq
                          </div>
                          {fileNoOlderMatches.map(match => (
                            <div key={match.receipt_no} onClick={() => selectOlderEntry(match)}
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
                type="button" onClick={handlePrint}
                disabled={serverError || isPrinting}
                className={`w-full mt-3 font-bold py-2.5 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all ${
                  serverError || isPrinting
                    ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                    : formData.status === 'CANCELLED'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
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
                {serverError ? 'Offline' : isPrinting ? 'Saving...' : formData.status === 'CANCELLED' ? 'Print Cancelled Copy' : isEditing ? 'Update & Print' : 'Save & Print'}
              </button>
            </div>
          </div>

          {/* ── Preview ── */}
          <ReceiptDocument
            {...receiptDocProps}
            componentRef={componentRef}
            previewPanelRef={previewPanelRef}
            previewScale={previewScale}
            isDark={isDark}
          />
        </div>

        {/* ── Archives table ── */}
        <div className={`rounded-xl shadow-lg p-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              Archives
              <span className={`ml-2 text-sm font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                ({history.length} receipts)
              </span>
            </h2>
            <div className="flex gap-2 items-center flex-wrap">
              <div className={`flex items-center gap-1 p-1 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                <input type="date" value={exportRange.from} onChange={(e) => setExportRange({ ...exportRange, from: e.target.value })} className={`bg-transparent text-xs ${isDark ? 'text-white outline-none' : 'outline-none'}`} />
                <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>TO</span>
                <input type="date" value={exportRange.to} onChange={(e) => setExportRange({ ...exportRange, to: e.target.value })} className={`bg-transparent text-xs ${isDark ? 'text-white outline-none' : 'outline-none'}`} />
                <button type="button" onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-[10px] font-bold">EXPORT</button>
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
                  Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, history.length)}</span> of{' '}
                  <span className="font-medium">{history.length}</span> results
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} ${isDark ? 'text-gray-300 bg-gray-800 border border-gray-600' : 'text-gray-700 bg-white border border-gray-300'}`}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
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
    </div>
  );
};

export default Receipt;