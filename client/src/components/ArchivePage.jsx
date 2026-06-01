import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ToWords } from 'to-words';
import {
  Search, RefreshCw, Camera, ShieldCheck, AlertTriangle,
  Eye, Edit3, Ban, Printer, X, History, ChevronLeft,
  ChevronRight, Copy, Check, ArrowLeft, Clock, User,
  FileText, CreditCard
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { buildEncryptedQrDataUrl, buildEncryptedQrString, decryptAndVerifyQr } from '../utils/qrCrypto';
import { logEdited, logCancelled, fetchQrEnabled } from '../utils/auditLog';
import {
  ReceiptPreview,
  ReceiptPrintLayout,
  OfficeCopyPrintLayout,
  formatDate,
  A4_W_PX,
} from './ReceiptDocument';

const API_URL = import.meta.env.VITE_API_URL;

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: { currency: false, ignoreDecimal: false, ignoreZeroCurrency: false, doNotAddOnly: true },
});

const toTitleCase  = s => s ? s.toLowerCase().split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') : '';
const extractSeq   = fn => { if (!fn) return ''; const c = fn.replace(/\s/g,''); if (c.includes('/')) return c.split('/').pop(); if (c.includes('-')) return c.split('-').pop(); return c.replace(/^[A-Za-z]+/,''); };
const extractPfx   = (fn, seq) => { if (!fn||!seq) return ''; return fn.replace(/\s/g,'').slice(0, fn.replace(/\s/g,'').length - seq.length); };
const fmtAuditTime = ist => { if (!ist) return ''; const [d,t] = ist.split(' '); if (!d) return ist; const [y,m,dd] = d.split('-'); return `${dd}-${m}-${y} ${t||''}`; };
const isMobileDevice = () => window.innerWidth < 1024;

// ── QR Camera Scanner ─────────────────────────────────────────────────────────
const QrScanner = ({ onResult, onClose }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const [status, setStatus]     = useState('Initialising camera…');
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); setStatus('Point at the receipt QR code'); setScanning(true); }
      })
      .catch(() => setStatus('Camera access denied.'));
    return () => { cancelled = true; stopCamera(); };
  }, [stopCamera]);

  useEffect(() => {
    if (!scanning) return;
    let active = true;
    let detector = null;
    if ('BarcodeDetector' in window) try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch {}
    const tick = async () => {
      if (!active || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current; const canvas = canvasRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0);
        try {
          if (detector) {
            const codes = await detector.detect(canvas);
            if (codes.length > 0 && codes[0].rawValue) { active = false; stopCamera(); onResult(codes[0].rawValue); return; }
          } else {
            try {
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const jsQR = (await import('jsqr')).default;
              const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
              if (code?.data) { active = false; stopCamera(); onResult(code.data); return; }
            } catch { setStatus('Install jsqr (npm i jsqr) or use Chrome for scanning.'); }
          }
        } catch {}
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(rafRef.current); };
  }, [scanning, stopCamera, onResult]);

  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16 }}>
      <div style={{ position:'relative',borderRadius:16,overflow:'hidden',width:'min(90vw,340px)',aspectRatio:'1',background:'black' }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width:'100%',height:'100%',objectFit:'cover',display:'block' }} />
        <canvas ref={canvasRef} style={{ display:'none' }} />
        {['tl','tr','bl','br'].map(p => (
          <div key={p} style={{ position:'absolute',width:36,height:36,borderColor:'#4f63f0',borderStyle:'solid',borderWidth:0,
            ...(p==='tl'?{top:10,left:10,borderTopWidth:3,borderLeftWidth:3,borderRadius:'4px 0 0 0'}:
               p==='tr'?{top:10,right:10,borderTopWidth:3,borderRightWidth:3,borderRadius:'0 4px 0 0'}:
               p==='bl'?{bottom:10,left:10,borderBottomWidth:3,borderLeftWidth:3,borderRadius:'0 0 0 4px'}:
               {bottom:10,right:10,borderBottomWidth:3,borderRightWidth:3,borderRadius:'0 0 4px 0'}) }} />
        ))}
        {scanning && <div style={{ position:'absolute',left:10,right:10,height:2,background:'linear-gradient(90deg,transparent,#4f63f0,transparent)',animation:'scan 2s ease-in-out infinite',top:'20%' }} />}
        <style>{`@keyframes scan{0%,100%{top:10%}50%{top:85%}}`}</style>
      </div>
      <p style={{ color:'white',fontSize:13,textAlign:'center',maxWidth:280,padding:'0 16px' }}>{status}</p>
      <button onClick={onClose} style={{ display:'flex',alignItems:'center',gap:6,padding:'10px 24px',borderRadius:10,border:'none',background:'rgba(255,255,255,0.15)',color:'white',cursor:'pointer',fontSize:14,fontWeight:700 }}>
        <X size={15}/> Close
      </button>
    </div>
  );
};

// ── Inline Audit Log Panel ────────────────────────────────────────────────────
const AuditPanel = ({ receiptNo, isDark }) => {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);

  useEffect(() => {
    if (!open || !receiptNo) return;
    setLoading(true);
    fetch(`${API_URL}/audit-log/${receiptNo}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open, receiptNo]);

  const mu = isDark ? 'text-gray-400' : 'text-gray-500';
  const rb = isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200';
  const tpri = isDark ? 'text-white' : 'text-gray-900';

  return (
    <div className={`rounded-xl border mt-3 overflow-hidden ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
      >
        <div className="flex items-center gap-2">
          <History size={15} className="text-blue-500"/>
          <span className={`text-xs font-bold uppercase tracking-wide ${mu}`}>Audit Log</span>
          {!open && logs.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold">{logs.length}</span>
          )}
        </div>
        <ChevronRight size={14} className={`${mu} transition-transform ${open ? 'rotate-90' : ''}`}/>
      </button>

      {open && (
        <div className={`border-t px-3 py-3 space-y-2 max-h-72 overflow-y-auto ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw size={16} className="animate-spin text-blue-500"/>
            </div>
          ) : logs.length === 0 ? (
            <div className={`text-center py-4 text-xs ${mu}`}>No audit entries found.</div>
          ) : logs.map((log, i) => {
            let fields = {};
            try { fields = typeof log.changed_fields === 'string' ? JSON.parse(log.changed_fields) : (log.changed_fields || {}); } catch {}
            const isCreated = log.action === 'CREATED';
            const entries   = isCreated ? [] : Object.entries(fields);
            const actionColor = log.action === 'CREATED' ? 'text-green-600 bg-green-50 border-green-200'
              : log.action === 'CANCELLED' || log.action === 'DELETED' || log.action === 'BULK_DELETED' ? 'text-red-600 bg-red-50 border-red-200'
              : 'text-blue-600 bg-blue-50 border-blue-200';

            return (
              <div key={log.id || i} className={`rounded-lg border p-2.5 text-xs ${rb}`}>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${actionColor}`}>{log.action}</span>
                  <span className={`text-[10px] font-mono ${mu}`}>{fmtAuditTime(log.changed_at_ist)}</span>
                </div>
                <div className={`text-[10px] mb-1 ${mu}`}>by <span className="font-semibold">{log.changed_by_email || 'unknown'}</span></div>
                {!isCreated && entries.length > 0 && entries.map(([f, d]) => (
                  <div key={f} className="mt-1">
                    <span className={`font-bold uppercase text-[9px] tracking-wide ${mu}`}>{f.replace(/_/g,' ')}: </span>
                    <span className="line-through text-red-400 text-[10px]">{d.from || '—'}</span>
                    <span className={`${mu} text-[10px]`}> → </span>
                    <span className="text-green-600 font-medium text-[10px]">{d.to || '—'}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Receipt Detail Card (mobile) ──────────────────────────────────────────────
const MobileReceiptDetail = ({ item, formData, currentFilePrefix, isDark, onBack, onEdit, onSave, onCancel, onPrint, isPrinting, serverError, setFormData, setCurrentFilePrefix, printRef, receiptProps }) => {
  const [mode, setMode] = useState('view'); // 'view' | 'edit'
  const mu   = isDark ? 'text-gray-400' : 'text-gray-500';
  const tpri = isDark ? 'text-white' : 'text-gray-900';
  const card = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inp  = `w-full p-2 rounded border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-1 focus:ring-blue-500`;
  const lbl  = `block text-[10px] font-bold uppercase mb-0.5 ${mu}`;

  if (!item || !formData) return null;

  const isCancelled = item.status === 'CANCELLED';

  return (
    <div className={`flex flex-col h-full overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`flex-none flex items-center gap-3 px-4 py-3 border-b shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <button onClick={onBack} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
          <ArrowLeft size={18} className={mu}/>
        </button>
        <div className="flex-1 min-w-0">
          <div className={`font-bold text-sm truncate ${tpri}`}>{item.customer_name}</div>
          <div className={`text-[11px] font-mono ${mu}`}>#{item.receipt_no} · {formatDate(item.date)}</div>
        </div>
        {isCancelled && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex-shrink-0">CANCELLED</span>}
      </div>

      {/* Mode toggle */}
      <div className={`flex-none flex border-b ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-white'}`}>
        <button onClick={() => setMode('view')} className={`flex-1 py-2.5 text-xs font-bold transition-colors ${mode === 'view' ? 'text-blue-600 border-b-2 border-blue-600' : mu}`}>
          <Eye size={13} className="inline mr-1"/>View
        </button>
        <button onClick={() => setMode('edit')} className={`flex-1 py-2.5 text-xs font-bold transition-colors ${mode === 'edit' ? 'text-blue-600 border-b-2 border-blue-600' : mu}`}>
          <Edit3 size={13} className="inline mr-1"/>Edit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mode === 'view' ? (
          <div className="p-4 space-y-3">
            {/* Info cards */}
            <div className={`rounded-xl border p-4 ${card}`}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Receipt No', `#${item.receipt_no}`],
                  ['Date', formatDate(item.date)],
                  ['Amount', `₹${Number(item.amount).toLocaleString('en-IN')}`],
                  ['Payment Mode', item.payment_mode || '—'],
                  ['Payment Type', item.payment_type || '—'],
                  ['File No', item.file_no || '—'],
                  ['Model', item.model || '—'],
                  ['HP To', item.hp_financier || '—'],
                  ['Mobile', item.mobile || '—'],
                ].map(([label, value]) => (
                  <div key={label} className={`${label === 'Receipt No' || label === 'Amount' ? 'col-span-1' : ''}`}>
                    <div className={`text-[10px] font-bold uppercase mb-0.5 ${mu}`}>{label}</div>
                    <div className={`text-sm font-semibold ${tpri} break-words`}>{value}</div>
                  </div>
                ))}
                {item.remarks && (
                  <div className="col-span-2">
                    <div className={`text-[10px] font-bold uppercase mb-0.5 ${mu}`}>Remarks</div>
                    <div className={`text-sm ${tpri}`}>{item.remarks}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Audit log */}
            <AuditPanel receiptNo={item.receipt_no} isDark={isDark}/>

            {/* Print button */}
            <button
              onClick={onPrint}
              disabled={isPrinting || isCancelled}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                ${isCancelled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              <Printer size={16}/> {isPrinting ? 'Preparing…' : 'Print Receipt'}
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData(p => ({...p, date: e.target.value}))} className={inp}/>
                </div>
                <div>
                  <label className={lbl}>Amount (₹)</label>
                  <input type="number" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: e.target.value}))} className={inp}/>
                </div>
              </div>
              <div>
                <label className={lbl}>Customer Name</label>
                <input value={formData.customerName} onChange={e => setFormData(p => ({...p, customerName: e.target.value}))} className={inp}/>
              </div>
              <div>
                <label className={lbl}>File No</label>
                <div className="flex rounded border overflow-hidden">
                  <input value={currentFilePrefix} onChange={e => setCurrentFilePrefix(e.target.value)}
                    className={`w-16 p-2 text-xs font-mono font-bold text-center border-r focus:outline-none ${isDark ? 'bg-gray-600 text-gray-300 border-gray-500' : 'bg-gray-100 text-gray-600 border-gray-300'}`}/>
                  <input value={formData.fileNoSeq} onChange={e => setFormData(p => ({...p, fileNoSeq: e.target.value}))}
                    className={`flex-1 p-2 text-sm font-mono font-bold text-blue-600 focus:outline-none ${isDark ? 'bg-gray-700' : 'bg-white'}`} placeholder="XXXX"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Payment Mode</label>
                  <select value={formData.paymentMode} onChange={e => setFormData(p => ({...p, paymentMode: e.target.value}))} className={inp}>
                    <option>Cash</option><option>UPI</option><option>Cheque</option><option>Bank Transfer</option><option>Card</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>On Account Of</label>
                  <select value={formData.paymentType} onChange={e => setFormData(p => ({...p, paymentType: e.target.value}))} className={inp}>
                    <option>Booking</option><option>Down Payment</option><option>Balance Payment</option><option value="Other">Other</option>
                  </select>
                </div>
              </div>
              {formData.paymentType === 'Other' && (
                <div>
                  <label className={lbl}>Custom Type</label>
                  <input value={formData.customPaymentType} onChange={e => setFormData(p => ({...p, customPaymentType: e.target.value}))} className={inp} placeholder="Custom…"/>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Model</label>
                  <input value={formData.model} onChange={e => setFormData(p => ({...p, model: e.target.value}))} className={inp}/>
                </div>
                <div>
                  <label className={lbl}>Mobile</label>
                  <input value={formData.mobile} onChange={e => setFormData(p => ({...p, mobile: e.target.value}))} className={inp}/>
                </div>
              </div>
              <div>
                <label className={lbl}>HP To</label>
                <input value={formData.hp} onChange={e => setFormData(p => ({...p, hp: e.target.value}))} className={inp}/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Cheque / Ref No</label>
                  <input value={formData.chequeNo} onChange={e => setFormData(p => ({...p, chequeNo: e.target.value}))} className={inp} placeholder="Optional"/>
                </div>
                <div>
                  <label className={lbl}>Dated</label>
                  <input type="date" value={formData.dated} onChange={e => setFormData(p => ({...p, dated: e.target.value}))} className={inp}/>
                </div>
              </div>
              <div>
                <label className={lbl}>Remarks</label>
                <input value={formData.remarks} onChange={e => setFormData(p => ({...p, remarks: e.target.value}))} className={inp} placeholder="Notes…"/>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => { onSave(); setMode('view'); }} disabled={serverError}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${serverError ? 'bg-gray-400 text-gray-200' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                  Save Changes
                </button>
                {!isCancelled && (
                  <button onClick={onCancel}
                    className="px-4 py-2.5 rounded-xl font-bold text-sm bg-red-100 hover:bg-red-200 text-red-600 border border-red-200 transition-colors">
                    Cancel Receipt
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden print target */}
      <div className="print-only" style={{ position:'absolute',overflow:'hidden',height:0,width:0,top:'-9999px',left:'-9999px' }}>
        <ReceiptPrintLayout {...receiptProps} printRef={printRef}/>
      </div>
    </div>
  );
};

// ── Main ArchivePage ──────────────────────────────────────────────────────────
const ArchivePage = ({ theme, initialScanTarget, onScanTargetConsumed }) => {
  const isDark   = theme === 'dark';
  const printRef = useRef(null);
  const officePrintRef = useRef(null);
  const isMobile = isMobileDevice();

  // ── State ──────────────────────────────────────────────────────────────────
  const [receipts, setReceipts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [selected, setSelected]       = useState(null);
  const [rightMode, setRightMode]     = useState('preview');   // desktop only
  const [mobileView, setMobileView]   = useState('list');      // 'list' | 'detail'
  const [qrDataUrl, setQrDataUrl]     = useState(null);
  const [ruid, setRuid]               = useState(null);
  const [ruidCopied, setRuidCopied]   = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult]   = useState(null);
  const [serverError, setServerError] = useState(false);
  const [isPrinting, setIsPrinting]   = useState(false);
  const [exportRange, setExportRange] = useState({ from: '', to: '' });
  const [qrEnabled, setQrEnabled]     = useState(true);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalCount, setTotalCount]   = useState(0);

  // Pending scan target — when a scanned receipt is not in the current list we
  // store its number here, trigger a search, then auto-open it once results load.
  const [pendingScanNo, setPendingScanNo] = useState(null);

  // ── Edit form state ────────────────────────────────────────────────────────
  const [filePrefix, setFilePrefix]               = useState('');
  const [currentFilePrefix, setCurrentFilePrefix] = useState('');
  const [formData, setFormData]                   = useState(null);
  const [editSnapshot, setEditSnapshot]           = useState(null);

  const amountInWords = useMemo(() => {
    if (!formData?.amount || isNaN(formData.amount)) return 'ZERO ONLY';
    return toWords.convert(formData.amount).toUpperCase() + ' ONLY';
  }, [formData?.amount]);

  const previewPanelRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    if (isMobile) return; // no preview on mobile
    const compute = () => {
      if (previewPanelRef.current)
        setPreviewScale(Math.min((previewPanelRef.current.clientWidth - 32) / A4_W_PX, 1));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (previewPanelRef.current) ro.observe(previewPanelRef.current);
    return () => ro.disconnect();
  }, [isMobile]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (term, pg) => {
    setLoading(true);
    try {
      const url = term && term.trim().length >= 2
        ? `${API_URL}/general-receipts/list?search=${encodeURIComponent(term.trim())}&page=${pg}`
        : `${API_URL}/general-receipts/list?page=${pg}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (Array.isArray(data)) {
        setReceipts(data); setTotalCount(data.length); setTotalPages(1);
      } else {
        setReceipts(data.rows || []); setTotalCount(data.total || 0); setTotalPages(data.totalPages || 1);
      }
      setServerError(false);
    } catch { setServerError(true); }
    setLoading(false);
  }, []);

  const fetchPrefix = async () => {
    try {
      const res = await fetch(`${API_URL}/general-receipts/next`);
      if (res.ok) { const d = await res.json(); setFilePrefix(d.prefix || ''); setCurrentFilePrefix(d.prefix || ''); }
    } catch {}
  };

  useEffect(() => {
    fetchPage('', 1);
    fetchPrefix();
    fetchQrEnabled().then(enabled => setQrEnabled(enabled));
  }, [fetchPage]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchPage(searchTerm, 1); }, 350);
    return () => clearTimeout(t);
  }, [searchTerm, fetchPage]);

  // ── Select receipt ─────────────────────────────────────────────────────────
  const selectReceipt = useCallback(async (item) => {
    setSelected(item);
    setRightMode('preview');
    setQrDataUrl(null); setRuid(null); setRuidCopied(false);

    const dateStr = item.date ? item.date.substring(0, 10) : '';

    if (qrEnabled && !isMobile) {
      const [qrImg, ruidStr] = await Promise.all([
        buildEncryptedQrDataUrl(item.receipt_no, dateStr, item.amount, item.file_no || ''),
        buildEncryptedQrString(item.receipt_no, dateStr, item.amount, item.file_no || ''),
      ]);
      setQrDataUrl(qrImg); setRuid(ruidStr);
    }

    const seq = extractSeq(item.file_no || '');
    const pfx = item.file_no ? extractPfx(item.file_no, seq) : filePrefix;
    setCurrentFilePrefix(pfx);

    const fd = {
      receiptNo:         item.receipt_no,
      date:              item.date ? item.date.substring(0, 10) : new Date().toISOString().split('T')[0],
      customerName:      item.customer_name,
      mobile:            item.mobile || '',
      fileNoSeq:         seq,
      hp:                item.hp_financier || '',
      model:             item.model || '',
      amount:            item.amount,
      paymentType:       ['Booking','Down Payment','Balance Payment'].includes(item.payment_type) ? item.payment_type : 'Other',
      customPaymentType: !['Booking','Down Payment','Balance Payment'].includes(item.payment_type) ? item.payment_type : '',
      paymentMode:       item.payment_mode || 'Cash',
      dated:             item.payment_date ? item.payment_date.substring(0, 10) : '',
      chequeNo:          item.cheque_no || '',
      remarks:           item.remarks || '',
      status:            item.status || 'ACTIVE',
    };
    setFormData(fd);
    setEditSnapshot({ ...fd, file_no: item.file_no || '' });
  }, [filePrefix, qrEnabled, isMobile]);

  // ── QR deep-link from App.jsx (mobile scan on Receipt page) ───────────────
  useEffect(() => {
    if (!initialScanTarget) return;
    const target = String(initialScanTarget);
    const found = receipts.find(r => String(r.receipt_no) === target);
    if (found) {
      selectReceipt(found);
      if (isMobile) setMobileView('detail');
    } else {
      // Not in current list — defer to the pending-scan resolver
      setPendingScanNo(target);
      setSearchTerm(target);
    }
    onScanTargetConsumed?.();
  }, [initialScanTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resolve any pending scan target once the search results arrive ─────────
  // Covers BOTH the deep-link (initialScanTarget) and the on-page QR scan when
  // the receipt was not present on the current page.
  useEffect(() => {
    if (!pendingScanNo || receipts.length === 0) return;
    const found = receipts.find(r => String(r.receipt_no) === String(pendingScanNo));
    if (found) {
      selectReceipt(found);
      if (isMobile) setMobileView('detail');
      setPendingScanNo(null);
    }
  }, [receipts, pendingScanNo, selectReceipt, isMobile]);

  // ── QR scan (from archive page itself) ────────────────────────────────────
  const handleScan = useCallback(async (raw) => {
    setShowScanner(false);
    const result = await decryptAndVerifyQr(raw);
    setScanResult(result);
    if (result.ok) {
      const target = String(result.receiptNo);
      const found = receipts.find(r => String(r.receipt_no) === target);
      if (found) {
        selectReceipt(found);
        if (isMobile) setMobileView('detail');
      } else {
        // Not on the current page — search for it and auto-open when it loads
        setPendingScanNo(target);
        setSearchTerm(target);
      }
    }
  }, [receipts, selectReceipt, isMobile]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData || serverError) return;
    const finalFileNo = currentFilePrefix + formData.fileNoSeq.trim();
    const finalType   = formData.paymentType === 'Other' ? formData.customPaymentType : formData.paymentType;
    const titleCasedName = toTitleCase(formData.customerName);
    try {
      const res = await fetch(`${API_URL}/general-receipts/${formData.receiptNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date, customer_name: titleCasedName,
          mobile: formData.mobile, remarks: formData.remarks, file_no: finalFileNo,
          hp_financier: formData.hp, model: formData.model, amount: formData.amount,
          payment_type: finalType, payment_mode: formData.paymentMode,
          payment_date: formData.dated || null, cheque_no: formData.chequeNo || null,
          status: formData.status,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({error:'Save failed'})); if (window.toast) window.toast(e.error||'Save failed','error'); return; }

      if (editSnapshot) {
        if (formData.status === 'CANCELLED' && editSnapshot.status !== 'CANCELLED') {
          await logCancelled(formData.receiptNo);
        } else {
          const before = { date:editSnapshot.date, customer_name:editSnapshot.customerName, mobile:editSnapshot.mobile||'', file_no:editSnapshot.file_no, hp_financier:editSnapshot.hp||'', model:editSnapshot.model||'', amount:String(editSnapshot.amount), payment_type:editSnapshot.paymentType==='Other'?editSnapshot.customPaymentType:editSnapshot.paymentType, payment_mode:editSnapshot.paymentMode, payment_date:editSnapshot.dated||'', cheque_no:editSnapshot.chequeNo||'', remarks:editSnapshot.remarks||'', status:editSnapshot.status||'ACTIVE' };
          const after  = { date:formData.date, customer_name:titleCasedName, mobile:formData.mobile||'', file_no:finalFileNo, hp_financier:formData.hp||'', model:formData.model||'', amount:String(formData.amount), payment_type:finalType, payment_mode:formData.paymentMode, payment_date:formData.dated||'', cheque_no:formData.chequeNo||'', remarks:formData.remarks||'', status:formData.status||'ACTIVE' };
          await logEdited(formData.receiptNo, before, after);
        }
        // Snapshot must reflect what was actually stored (title-cased name) so the
        // next edit's diff doesn't show a phantom customer_name change.
        setEditSnapshot({ ...formData, customerName: titleCasedName, file_no: finalFileNo });
      }

      // Keep local selection in sync with the stored (title-cased) name.
      setFormData(prev => prev ? { ...prev, customerName: titleCasedName } : prev);

      if (window.toast) window.toast('Receipt updated','success');
      fetchPage(searchTerm, page);
      if (!isMobile) setRightMode('preview');
    } catch { if (window.toast) window.toast('Error saving. Check connection.','error'); }
  };

  // ── Cancel receipt ─────────────────────────────────────────────────────────
  const handleCancelReceipt = async () => {
    if (!formData) return;
    if (!window.confirm('Cancel this receipt? It will be watermarked.')) return;
    const finalFileNo = currentFilePrefix + formData.fileNoSeq.trim();
    const finalType   = formData.paymentType === 'Other' ? formData.customPaymentType : formData.paymentType;
    const titleCasedName = toTitleCase(formData.customerName);
    setFormData(prev => ({...prev, status:'CANCELLED'}));
    try {
      await fetch(`${API_URL}/general-receipts/${formData.receiptNo}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ date:formData.date, customer_name:titleCasedName, mobile:formData.mobile, remarks:formData.remarks, file_no:finalFileNo, hp_financier:formData.hp, model:formData.model, amount:formData.amount, payment_type:finalType, payment_mode:formData.paymentMode, payment_date:formData.dated||null, cheque_no:formData.chequeNo||null, status:'CANCELLED' }),
      });
      await logCancelled(formData.receiptNo);
      // Keep the snapshot status in sync so a subsequent save isn't mis-logged.
      setEditSnapshot(prev => prev ? { ...prev, status: 'CANCELLED', customerName: titleCasedName } : prev);
      if (window.toast) window.toast('Receipt cancelled','success');
      fetchPage(searchTerm, page);
    } catch {}
  };

  // ── Print ──────────────────────────────────────────────────────────────────
  const triggerPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Archive_Receipt_${selected?.receipt_no||''}`,
    onAfterPrint: () => setIsPrinting(false),
  });
  const handlePrint = () => { setIsPrinting(true); setTimeout(() => triggerPrint(), 100); };

  // ── Office-copy-only print ─────────────────────────────────────────────────
  const triggerOfficePrint = useReactToPrint({
    contentRef: officePrintRef,
    documentTitle: `Archive_OfficeCopy_${selected?.receipt_no||''}`,
    onAfterPrint: () => setIsPrinting(false),
  });
  const handleOfficePrint = () => { setIsPrinting(true); setTimeout(() => triggerOfficePrint(), 100); };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = () => {
    let data = receipts;
    if (exportRange.from && exportRange.to)
      data = data.filter(r => { const d = r.date.substring(0,10); return d >= exportRange.from && d <= exportRange.to; });
    const rows = [...data].sort((a,b) => new Date(a.date)-new Date(b.date)).map(r => ({
      'Date':formatDate(r.date),'Receipt No':r.receipt_no,'File No':r.file_no||'','Customer':toTitleCase(r.customer_name||''),'Amount':r.amount,'Mode':r.payment_mode,'Type':r.payment_type,'Status':r.status||'ACTIVE',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Receipts');
    XLSX.writeFile(wb, 'Archive_Receipts.xlsx');
  };

  const handlePageChange = (newPage) => { setPage(newPage); fetchPage(searchTerm, newPage); };

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const tpri   = isDark ? 'text-white' : 'text-gray-900';
  const tmut   = isDark ? 'text-gray-400' : 'text-gray-500';
  const card   = isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100';
  const pageBg = isDark ? 'bg-gray-900' : 'bg-gray-50';

  const receiptProps = { formData, currentFilePrefix, qrDataUrl, qrEnabled, amountInWords };

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className={`h-full flex flex-col overflow-hidden ${pageBg}`}>
        {showScanner && <QrScanner onResult={handleScan} onClose={() => setShowScanner(false)}/>}

        {mobileView === 'list' ? (
          <>
            {/* Mobile top bar */}
            <div className={`flex-none flex items-center gap-2 px-3 py-3 border-b ${isDark?'bg-gray-800 border-gray-700':'bg-white border-gray-200'}`}>
              <div className="relative flex-1">
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search receipts…"
                  className={`w-full pl-8 pr-8 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all
                    ${isDark?'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500':'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-blue-400'}`}/>
                <Search size={14} className={`absolute left-2.5 top-2.5 ${tmut}`}/>
                {searchTerm && <button onClick={() => setSearchTerm('')} className={`absolute right-2 top-2 ${tmut}`}><X size={14}/></button>}
              </div>
              <button onClick={() => { setScanResult(null); setShowScanner(true); }}
                className="flex items-center gap-1 px-3 py-2 rounded-xl font-bold text-xs bg-blue-600 text-white flex-shrink-0">
                <Camera size={14}/> Scan
              </button>
              <button onClick={() => fetchPage(searchTerm, page)}
                className={`p-2 rounded-xl border ${isDark?'bg-gray-700 border-gray-600 text-gray-300':'bg-white border-gray-200 text-gray-600'}`}>
                <RefreshCw size={14} className={loading?'animate-spin':''}/>
              </button>
            </div>

            {/* Scan result banner */}
            {scanResult && (
              <div className={`flex-none mx-3 mt-2 p-3 rounded-xl border flex items-start gap-2 ${scanResult.ok ? (isDark?'bg-green-900/30 border-green-700':'bg-green-50 border-green-200') : (isDark?'bg-red-900/30 border-red-700':'bg-red-50 border-red-200')}`}>
                {scanResult.ok ? <ShieldCheck size={16} className="text-green-500 flex-shrink-0 mt-0.5"/> : <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5"/>}
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-xs ${scanResult.ok?'text-green-600':'text-red-600'}`}>{scanResult.ok?'Receipt Verified':'Verification Failed'}</div>
                  {scanResult.ok && <div className={`text-[11px] mt-0.5 ${tmut}`}>Receipt #{scanResult.receiptNo} · ₹{Number(scanResult.amount).toLocaleString('en-IN')}</div>}
                  {!scanResult.ok && <div className={`text-[11px] mt-0.5 ${tmut}`}>{scanResult.error}</div>}
                </div>
                <button onClick={() => setScanResult(null)}><X size={13} className={tmut}/></button>
              </div>
            )}

            {/* Receipt count */}
            <div className={`flex-none px-3 py-1.5 flex items-center justify-between ${tmut}`}>
              <span className="text-[11px] font-medium">{totalCount} receipt{totalCount !== 1 ? 's' : ''}</span>
              <span className="text-[11px]">Page {page} of {totalPages}</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32"><RefreshCw size={20} className="animate-spin text-blue-500"/></div>
              ) : receipts.length === 0 ? (
                <div className={`text-center py-16 text-sm ${tmut}`}>No receipts found</div>
              ) : receipts.map(item => {
                const isCan = item.status === 'CANCELLED';
                return (
                  <div key={item.receipt_no}
                    onClick={() => { selectReceipt(item); setMobileView('detail'); }}
                    className={`px-4 py-3.5 border-b active:bg-blue-50 cursor-pointer transition-colors
                      ${isDark?'border-gray-800 hover:bg-gray-800':'border-gray-100 hover:bg-gray-50'}
                      ${isCan?'opacity-60':''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm truncate ${tpri}`}>{item.customer_name}</div>
                        <div className={`text-xs mt-0.5 ${tmut}`}>
                          <span className={`font-mono font-bold ${isDark?'text-blue-400':'text-blue-600'}`}>#{item.receipt_no}</span>
                          {' · '}{formatDate(item.date)}
                          {item.file_no && <span className="ml-1 opacity-70">· {item.file_no}</span>}
                        </div>
                        {isCan && <span className="text-[9px] font-bold text-red-500 uppercase mt-0.5 inline-block">Cancelled</span>}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className={`font-bold text-sm ${isCan?'line-through text-gray-400':'text-green-600'}`}>
                          ₹{Number(item.amount).toLocaleString('en-IN')}
                        </div>
                        <div className={`text-[10px] mt-0.5 ${tmut}`}>{item.payment_mode}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile pagination */}
            {totalPages > 1 && (
              <div className={`flex-none flex items-center justify-between px-4 py-3 border-t ${isDark?'border-gray-700 bg-gray-800':'border-gray-200 bg-white'}`}>
                <button onClick={() => handlePageChange(Math.max(1,page-1))} disabled={page===1}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40
                    ${isDark?'bg-gray-700 border-gray-600 text-gray-300':'bg-white border-gray-300 text-gray-700'}`}>
                  <ChevronLeft size={15}/> Prev
                </button>
                <span className={`text-xs font-medium ${tmut}`}>{page} / {totalPages}</span>
                <button onClick={() => handlePageChange(Math.min(totalPages,page+1))} disabled={page===totalPages}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40
                    ${isDark?'bg-gray-700 border-gray-600 text-gray-300':'bg-white border-gray-300 text-gray-700'}`}>
                  Next <ChevronRight size={15}/>
                </button>
              </div>
            )}
          </>
        ) : (
          // Mobile detail view
          <MobileReceiptDetail
            item={selected}
            formData={formData}
            currentFilePrefix={currentFilePrefix}
            isDark={isDark}
            onBack={() => setMobileView('list')}
            onSave={handleSave}
            onCancel={handleCancelReceipt}
            onPrint={handlePrint}
            isPrinting={isPrinting}
            serverError={serverError}
            setFormData={setFormData}
            setCurrentFilePrefix={setCurrentFilePrefix}
            printRef={printRef}
            receiptProps={receiptProps}
          />
        )}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col overflow-hidden ${pageBg}`}>

      {showScanner && <QrScanner onResult={handleScan} onClose={() => setShowScanner(false)}/>}

      {/* Scan result */}
      {scanResult && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[280px] max-w-[90vw] rounded-2xl border shadow-2xl p-4 ${isDark?'bg-gray-800 border-gray-700':'bg-white border-gray-100'}`}>
          <div className="flex items-start gap-3">
            {scanResult.ok ? <ShieldCheck size={20} className="text-green-500 flex-shrink-0 mt-0.5"/> : <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5"/>}
            <div className="flex-1">
              <div className={`font-bold text-sm ${scanResult.ok?'text-green-600':'text-red-600'}`}>{scanResult.ok?'Receipt Verified':'Verification Failed'}</div>
              {scanResult.ok ? (
                <div className={`text-xs mt-1 space-y-0.5 ${tmut}`}>
                  <div>Receipt <span className={`font-mono font-bold ${tpri}`}>#{scanResult.receiptNo}</span></div>
                  <div>Amount <span className="font-mono font-bold text-green-600">₹{Number(scanResult.amount).toLocaleString('en-IN')}</span></div>
                  <div className="text-[10px] text-green-500 font-semibold">✓ HMAC signature valid</div>
                </div>
              ) : <div className={`text-xs mt-1 ${tmut}`}>{scanResult.error}</div>}
            </div>
            <button onClick={() => setScanResult(null)} className={`p-1 rounded ${isDark?'hover:bg-gray-700':'hover:bg-gray-100'}`}><X size={13} className={tmut}/></button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className={`flex-none flex items-center justify-between px-4 py-3 gap-3 flex-wrap shadow-lg
        ${isDark?'bg-gray-800 border-b border-gray-700':'bg-gradient-to-r from-blue-100 to-indigo-100 border-b border-blue-200'}`}>
        <div className="flex items-center gap-3">
          <h1 className={`font-bold text-base ${tpri}`}>Archives</h1>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${isDark?'bg-white/10 text-gray-300 border border-white/10':'bg-white/40 text-gray-700 border border-white/50'}`}>
            {totalCount} receipts
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-xs shadow-sm backdrop-blur-md ${isDark?'bg-white/10 border-white/20':'bg-white/40 border-white/60'}`}>
            <input type="date" value={exportRange.from} onChange={e => setExportRange(p=>({...p,from:e.target.value}))} className={`bg-transparent text-xs outline-none ${isDark?'text-white':'text-gray-800'}`}/>
            <span className={tmut}>–</span>
            <input type="date" value={exportRange.to} onChange={e => setExportRange(p=>({...p,to:e.target.value}))} className={`bg-transparent text-xs outline-none ${isDark?'text-white':'text-gray-800'}`}/>
            <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold ml-1 transition-colors">EXPORT</button>
          </div>
          <button onClick={() => { setScanResult(null); setShowScanner(true); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all border shadow-sm backdrop-blur-md ${isDark?'bg-white/10 hover:bg-white/20 border-white/20 text-white':'bg-white/40 hover:bg-white/60 border-white/50 text-gray-800'}`}>
            <Camera size={14}/> Scan QR
          </button>
          <button onClick={() => { fetchPage(searchTerm,1); setPage(1); }}
            className={`p-2 rounded-xl border transition-all shadow-sm backdrop-blur-md ${isDark?'bg-white/10 hover:bg-white/20 border-white/20 text-white':'bg-white/40 hover:bg-white/60 border-white/50 text-gray-700'}`}>
            <RefreshCw size={14} className={loading?'animate-spin':''}/>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        {/* Left sidebar */}
        <div className={`w-96 flex-shrink-0 flex flex-col border-r overflow-hidden shadow-lg ${card} rounded-none`}>
          <div className={`p-3 border-b ${isDark?'border-gray-700':'border-gray-200'}`}>
            <div className="relative">
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Receipt #, name, file…"
                className={`w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all backdrop-blur-md
                  ${isDark?'bg-white/10 border-white/20 text-white placeholder-gray-400 focus:ring-white/30':'bg-white/50 border-white/60 text-gray-800 placeholder-gray-500 focus:ring-blue-400 shadow-inner'}`}/>
              <Search size={15} className={`absolute left-2.5 top-3 ${tmut}`}/>
              {searchTerm && <button onClick={() => setSearchTerm('')} className={`absolute right-2 top-2.5 ${tmut} hover:text-gray-700`}><X size={15}/></button>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-24"><RefreshCw size={18} className="animate-spin text-blue-500"/></div>
            ) : receipts.length === 0 ? (
              <div className={`text-center py-10 text-sm ${tmut}`}>No receipts found</div>
            ) : receipts.map(item => {
              const isSel = selected?.receipt_no === item.receipt_no;
              const isCan = item.status === 'CANCELLED';
              return (
                <div key={item.receipt_no} onClick={() => selectReceipt(item)}
                  className={`px-3.5 py-3 border-b cursor-pointer transition-colors
                    ${isDark?'border-gray-700':'border-gray-100'}
                    ${isSel?(isDark?'bg-blue-900/50 border-l-2 border-l-blue-400':'bg-blue-50 border-l-2 border-l-blue-500'):(isDark?'hover:bg-gray-700/60':'hover:bg-gray-50')}
                    ${isCan?'opacity-60':''}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-mono font-bold ${isDark?'text-blue-400':'text-blue-700'}`}>#{item.receipt_no}</span>
                    <span className={`text-xs ${tmut}`}>{formatDate(item.date)}</span>
                  </div>
                  <div className={`text-sm font-semibold mt-1 truncate ${tpri}`}>{item.customer_name}</div>
                  <div className={`text-xs mt-1 flex items-center justify-between ${tmut}`}>
                    <span className="truncate max-w-[150px]">{item.file_no||'—'}</span>
                    <span className={`font-bold ${isCan?'line-through text-gray-400':'text-green-600'}`}>₹{Number(item.amount).toLocaleString('en-IN')}</span>
                  </div>
                  {isCan && <span className="text-[10px] font-bold text-red-500 uppercase">Cancelled</span>}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={`flex items-center justify-between px-3 py-2 border-t text-xs ${tmut} ${isDark?'border-gray-700 bg-gray-800':'border-gray-200 bg-gray-50'}`}>
              <span className="font-medium">Page {page} of {totalPages} · {totalCount} total</span>
              <div className="flex gap-1">
                <button onClick={() => handlePageChange(Math.max(1,page-1))} disabled={page===1}
                  className={`p-1 rounded transition-colors disabled:opacity-40 ${isDark?'hover:bg-gray-700':'hover:bg-gray-200'}`}><ChevronLeft size={14}/></button>
                <button onClick={() => handlePageChange(Math.min(totalPages,page+1))} disabled={page===totalPages}
                  className={`p-1 rounded transition-colors disabled:opacity-40 ${isDark?'hover:bg-gray-700':'hover:bg-gray-200'}`}><ChevronRight size={14}/></button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${isDark?'text-gray-500':'text-gray-400'}`}>
              <Eye size={40} className="opacity-30"/>
              <span className="text-sm font-medium">Select a receipt from the list</span>
            </div>
          ) : (
            <>
              {/* Toggle bar */}
              <div className={`flex-none flex items-center justify-between px-4 py-3 border-b gap-3 shadow-sm ${card}`}>
                <div className="flex items-center gap-2">
                  <div className={`flex rounded-xl border overflow-hidden text-xs font-bold shadow-sm ${isDark?'border-gray-600':'border-gray-200'}`}>
                    <button onClick={() => setRightMode('preview')} className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${rightMode==='preview'?'bg-blue-600 text-white':(isDark?'bg-gray-700 text-gray-400 hover:bg-gray-600':'bg-white text-gray-600 hover:bg-gray-50')}`}>
                      <Eye size={12}/> Preview
                    </button>
                    <button onClick={() => setRightMode('edit')} className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors border-l ${isDark?'border-gray-600':'border-gray-200'} ${rightMode==='edit'?'bg-blue-600 text-white':(isDark?'bg-gray-700 text-gray-400 hover:bg-gray-600':'bg-white text-gray-600 hover:bg-gray-50')}`}>
                      <Edit3 size={12}/> Edit
                    </button>
                  </div>
                  <span className={`text-xs font-mono font-bold ${isDark?'text-blue-400':'text-blue-700'}`}>#{selected.receipt_no}</span>
                  {selected.status==='CANCELLED' && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">CANCELLED</span>}
                </div>
                <div className="flex items-center gap-2">
                  {rightMode==='preview' && (
                    <>
                      <button onClick={handlePrint} disabled={isPrinting} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50">
                        <Printer size={13}/> Print
                      </button>
                      <button onClick={handleOfficePrint} disabled={isPrinting} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50">
                        <Printer size={13}/> Office Only
                      </button>
                    </>
                  )}
                  {rightMode==='edit' && (
                    <button onClick={handleCancelReceipt} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold transition-colors border border-red-200">
                      <Ban size={12}/> Cancel Receipt
                    </button>
                  )}
                </div>
              </div>

              {rightMode==='preview' && formData && (
                <>
                  <ReceiptPreview {...receiptProps} previewPanelRef={previewPanelRef} previewScale={previewScale} isDark={isDark}
                    className={`flex flex-1 w-full overflow-y-auto rounded-none p-6 items-start justify-center ${isDark?'bg-gray-700/50':'bg-gray-200'}`}/>
                  {/* RUID + inline audit log */}
                  <div className={`flex-none border-t px-4 py-3 space-y-2 ${isDark?'border-gray-700':'border-gray-200'}`}>
                    {qrEnabled && ruid && (
                      <div className={`rounded-xl border shadow-sm p-3 ${card}`}>
                        <div className={`text-[10px] font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${tmut}`}>
                          <ShieldCheck size={11} className="text-green-500"/> RUID
                        </div>
                        <div className="flex items-center gap-2">
                          <code className={`flex-1 text-[11px] font-mono break-all leading-relaxed ${isDark?'text-blue-300':'text-blue-700'}`}>{ruid}</code>
                          <button onClick={() => { navigator.clipboard.writeText(ruid); setRuidCopied(true); setTimeout(()=>setRuidCopied(false),2000); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-colors border ${ruidCopied?(isDark?'bg-green-800 border-green-700 text-green-300':'bg-green-50 border-green-300 text-green-700'):(isDark?'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600':'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}`}>
                            {ruidCopied ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy</>}
                          </button>
                        </div>
                      </div>
                    )}
                    <AuditPanel receiptNo={selected.receipt_no} isDark={isDark}/>
                  </div>
                </>
              )}

              {rightMode==='edit' && formData && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className={`max-w-lg rounded-xl border shadow-lg p-4 ${card}`}>
                    <div className={`flex items-start justify-between mb-4 pb-2 border-b ${isDark?'border-gray-700':'border-gray-200'}`}>
                      <div>
                        <h2 className={`text-base font-bold ${tpri}`}>Edit Receipt</h2>
                        <div className="text-sm font-bold text-red-600 mt-0.5">#{formData.receiptNo}</div>
                      </div>
                      {formData.status==='CANCELLED' && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">CANCELLED</span>}
                    </div>
                    <div className="space-y-2">
                      {/* Edit fields — same as before */}
                      {[
                        [{label:'Date',type:'date',field:'date'},{label:'File No',type:'fileno'}],
                        [{label:'Amount (₹)',type:'number',field:'amount'},{label:'By Way Of',type:'select',field:'paymentMode',options:['Cash','UPI','Cheque','Bank Transfer','Card']}],
                      ].map((row, ri) => (
                        <div key={ri} className="grid grid-cols-2 gap-2">
                          {row.map(f => (
                            <div key={f.label}>
                              <label className={`block text-[10px] font-bold uppercase mb-0.5 ${tmut}`}>{f.label}</label>
                              {f.type === 'fileno' ? (
                                <div className="flex rounded border overflow-hidden shadow-sm">
                                  <input value={currentFilePrefix} onChange={e => setCurrentFilePrefix(e.target.value)} className={`w-16 p-1.5 text-xs font-mono font-bold text-center border-r focus:outline-none ${isDark?'bg-gray-600 text-gray-300 border-gray-500':'bg-gray-100 text-gray-600 border-gray-300'}`}/>
                                  <input value={formData.fileNoSeq} onChange={e => setFormData(p=>({...p,fileNoSeq:e.target.value}))} className={`flex-1 p-1.5 text-sm font-mono font-bold text-blue-600 focus:outline-none ${isDark?'bg-gray-700':'bg-white'}`} placeholder="XXXX"/>
                                </div>
                              ) : f.type === 'select' ? (
                                <select value={formData[f.field]} onChange={e => setFormData(p=>({...p,[f.field]:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-1 focus:ring-blue-500`}>
                                  {f.options.map(o => <option key={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input type={f.type||'text'} value={formData[f.field]} onChange={e => setFormData(p=>({...p,[f.field]:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:ring-1 focus:ring-blue-500`}/>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                      <div><label className={`block text-[10px] font-bold uppercase mb-0.5 ${tmut}`}>Customer Name</label><input value={formData.customerName} onChange={e=>setFormData(p=>({...p,customerName:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300'} focus:outline-none focus:ring-1 focus:ring-blue-500`}/></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={`block text-[10px] font-bold uppercase mb-0.5 ${tmut}`}>On Account Of</label>
                          <select value={formData.paymentType} onChange={e=>setFormData(p=>({...p,paymentType:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300'} focus:outline-none`}>
                            <option>Booking</option><option>Down Payment</option><option>Balance Payment</option><option value="Other">Other</option>
                          </select>
                          {formData.paymentType==='Other' && <input value={formData.customPaymentType} onChange={e=>setFormData(p=>({...p,customPaymentType:e.target.value}))} className={`mt-1 w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300'} focus:outline-none`} placeholder="Custom type…"/>}
                        </div>
                        <div><label className={`block text-[10px] font-bold uppercase mb-0.5 ${tmut}`}>Model</label><input value={formData.model} onChange={e=>setFormData(p=>({...p,model:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300'} focus:outline-none`}/></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={`block text-[10px] font-bold uppercase mb-0.5 ${tmut}`}>Mobile</label><input value={formData.mobile} onChange={e=>setFormData(p=>({...p,mobile:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300'} focus:outline-none`}/></div>
                        <div><label className={`block text-[10px] font-bold uppercase mb-0.5 ${tmut}`}>HP To</label><input value={formData.hp} onChange={e=>setFormData(p=>({...p,hp:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300'} focus:outline-none`}/></div>
                      </div>
                      <div className={`grid grid-cols-2 gap-2 pt-2 border-t ${isDark?'border-gray-700':'border-gray-200'}`}>
                        <div><label className={`block text-[10px] font-bold uppercase mb-0.5 ${tmut}`}>Cheque / Ref No</label><input value={formData.chequeNo} onChange={e=>setFormData(p=>({...p,chequeNo:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300'} focus:outline-none`} placeholder="Optional"/></div>
                        <div><label className={`block text-[10px] font-bold uppercase mb-0.5 ${tmut}`}>Dated</label><input type="date" value={formData.dated} onChange={e=>setFormData(p=>({...p,dated:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300'} focus:outline-none`}/></div>
                      </div>
                      <div><label className={`block text-[10px] font-bold uppercase mb-0.5 ${tmut}`}>Remarks</label><input value={formData.remarks} onChange={e=>setFormData(p=>({...p,remarks:e.target.value}))} className={`w-full p-1.5 rounded border text-sm ${isDark?'bg-gray-700 border-gray-600 text-white':'bg-white border-gray-300'} focus:outline-none`} placeholder="Any additional notes…"/></div>
                      <button onClick={handleSave} disabled={serverError} className={`w-full mt-3 font-bold py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all ${serverError?'bg-gray-400 cursor-not-allowed text-gray-200':'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                        <Edit3 size={15}/> Save Changes
                      </button>
                    </div>
                  </div>
                  {/* Audit log in edit mode too */}
                  <div className="max-w-lg mt-3">
                    <AuditPanel receiptNo={selected.receipt_no} isDark={isDark}/>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden print target — both copies */}
      <div className="print-only" style={{ position:'absolute',overflow:'hidden',height:0,width:0,top:'-9999px',left:'-9999px' }}>
        {selected && formData && <ReceiptPrintLayout {...receiptProps} printRef={printRef}/>}
      </div>

      {/* Hidden print target — office copy only */}
      <div className="print-only" style={{ position:'absolute',overflow:'hidden',height:0,width:0,top:'-9999px',left:'-9999px' }}>
        {selected && formData && <OfficeCopyPrintLayout {...receiptProps} printRef={officePrintRef}/>}
      </div>
    </div>
  );
};

export default ArchivePage;