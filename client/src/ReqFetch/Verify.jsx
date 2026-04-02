import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, RefreshCw, FileText, User, Database, Calendar } from "lucide-react";

const FontStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500&family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    :root { --bg-base:#f4f5f7; --bg-surface:#ffffff; --bg-panel:#ffffff; --bg-elevated:#f0f1f4; --bg-hover:#eef0f5; --border-dim:rgba(0,0,0,0.07); --border-mid:rgba(0,0,0,0.11); --border-bright:rgba(0,0,0,0.18); --text-primary:#111827; --text-secondary:#4b5563; --text-muted:#9ca3af; --accent:#4f63f0; --accent-dim:rgba(79,99,240,0.10); --accent-glow:rgba(79,99,240,0.20); --green:#059669; --green-dim:rgba(5,150,105,0.09); --red:#dc2626; --red-dim:rgba(220,38,38,0.08); --amber:#d97706; }
    .verify-root { height: 100%; width: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-base); color: var(--text-primary); font-family: 'DM Sans', sans-serif; }
    .v-header { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 64px; border-bottom: 1px solid var(--border-dim); background: var(--bg-surface); position: relative; z-index: 50; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .v-header::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--accent), transparent); opacity: 0.5; }
    .v-logo { display: flex; align-items: center; gap: 12px; }
    .v-logo-icon { width: 34px; height: 34px; background: linear-gradient(135deg, var(--accent), #8b5cf6); border-radius: 9px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px var(--accent-glow); }
    .v-logo-text { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: var(--text-primary); } .v-logo-text span { color: var(--accent); }
    .v-header-right { display: flex; align-items: center; gap: 12px; }
    .v-search-wrap { position: relative; width: 380px; }
    .v-search-input { width: 100%; padding: 9px 40px 9px 16px; background: var(--bg-elevated); border: 1px solid var(--border-mid); border-radius: 10px; color: var(--text-primary); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
    .v-search-input::placeholder { color: var(--text-muted); }
    .v-search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
    .v-search-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 4px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; transition: color 0.2s; } .v-search-btn:hover { color: var(--accent); }
    .v-clear-btn { display: flex; align-items: center; justify-content: center; padding: 8px 12px; gap: 6px; border-radius: 10px; border: 1px solid var(--border-mid); background: var(--bg-elevated); color: var(--text-secondary); font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .v-clear-btn:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-bright); }
    .v-rms-pill { display: flex; align-items: center; justify-content: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85; transition: opacity 0.2s; cursor: pointer; border: 1px solid transparent; font-family: 'Syne', sans-serif;}
    .v-rms-pill:hover { opacity: 1; }
    .v-rms-pill.connected { background: var(--green-dim); color: var(--green); border-color: rgba(52,211,153,0.3); }
    .v-rms-pill.connecting { background: var(--accent-dim); color: var(--accent); border-color: rgba(108,126,248,0.3); }
    .v-rms-pill.disconnected { background: var(--red-dim); color: var(--red); border-color: rgba(248,113,113,0.3); }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px currentColor; } .status-dot.pulse { animation: pulse-ring 1.2s ease-out infinite; } @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 currentColor; } 70% { box-shadow: 0 0 0 5px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
    .v-body { flex: 1; display: flex; overflow: hidden; }
    .v-main { flex: 1; display: flex; flex-direction: column; padding: 20px; gap: 16px; overflow-y: auto; min-width: 0; }
    .v-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--text-muted); }
    .v-summary-container { flex: 1; display: flex; flex-direction: column; background: var(--bg-panel); border: 1px solid var(--border-dim); border-radius: 14px; padding: 20px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); width: 100%; max-width: 1600px; margin: 0 auto; outline: none; }
    .summary-header-wrap { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 16px; flex-wrap: wrap; }
    .date-filter-group { display: flex; align-items: center; gap: 12px; }
    .date-input-wrap { display: flex; align-items: center; gap: 8px; background: var(--bg-elevated); border: 1px solid var(--border-mid); border-radius: 8px; padding: 4px 12px; transition: border-color 0.2s; }
    .date-input-wrap:focus-within { border-color: var(--accent); }
    .date-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .date-input { background: transparent; border: none; outline: none; color: var(--text-primary); font-family: 'DM Mono', monospace; font-size: 13px; padding: 4px 0; cursor: pointer; }
    .date-input::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.5; transition: 0.2s; }
    .date-input::-webkit-calendar-picker-indicator:hover { opacity: 1; }
    .pagination-wrap { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--border-dim); margin-top: 16px; font-size: 13px; color: var(--text-muted); }
    .page-btn { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border-mid); background: var(--bg-surface); cursor: pointer; color: var(--text-primary); font-family: 'DM Sans', sans-serif; font-weight: 500; transition: background 0.2s; }
    .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .page-btn:hover:not(:disabled) { background: var(--bg-hover); }
    .v-top-row { flex: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .v-panel { background: var(--bg-panel); border: 1px solid var(--border-dim); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .v-panel-header { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-bottom: 1px solid var(--border-dim); } .v-panel-header-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); color: var(--text-secondary); flex-shrink: 0; } .v-panel-title { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; color: var(--text-secondary); text-transform: uppercase; } .v-panel-badge { margin-left: auto; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); border: 1px solid var(--border-dim); padding: 2px 8px; border-radius: 6px; }
    .v-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; } .v-info-cell { padding: 13px 18px; border-right: 1px solid var(--border-dim); border-bottom: 1px solid var(--border-dim); overflow:hidden;} .v-info-cell:nth-child(2n) { border-right: none; } .v-info-label { display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; } .v-info-value { font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; color: var(--text-primary); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .v-info-value.mono { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 400; letter-spacing: 0.5px; color: var(--text-secondary); }
    .v-fin-panel { display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; border: 1px solid; position: relative; box-shadow: 0 1px 4px rgba(0,0,0,0.06); } .v-fin-panel.excess { background: linear-gradient(135deg, rgba(52,211,153,0.06) 0%, var(--bg-panel) 60%); border-color: rgba(52,211,153,0.2); } .v-fin-panel.shortage { background: linear-gradient(135deg, rgba(248,113,113,0.06) 0%, var(--bg-panel) 60%); border-color: rgba(248,113,113,0.2); } .v-fin-panel.neutral { background: var(--bg-panel); border-color: var(--border-mid); }
    .v-fin-header { padding: 12px 18px; border-bottom: 1px solid var(--border-dim); display: flex; align-items: center; justify-content: space-between; } .v-fin-label { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; } .v-fin-label.excess { color: var(--green); } .v-fin-label.shortage { color: var(--red); } .v-fin-label.neutral { color: var(--text-secondary); }
    .v-fin-body { flex: 1; padding: 16px 20px; display: flex; flex-direction: column; justify-content: center; }
    .v-fin-row { display: flex; align-items: stretch; gap: 0; }
    .v-fin-metric { flex: 1; text-align: center; padding: 8px 12px; }
    .v-fin-metric.balance { background: var(--bg-elevated); border-radius: 10px; }
    .v-fin-metric-label { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 5px; }
    .v-fin-metric-value { font-family: 'DM Mono', monospace; font-size: 19px; font-weight: 500; color: var(--text-primary); }
    .v-fin-metric-value.highlight { font-size: 22px; font-weight: 600; }
    .v-fin-operator { font-size: 22px; color: var(--text-muted); display: flex; align-items: center; padding: 0 4px; flex-shrink: 0; opacity: 0.5; }
    .v-tables-row { flex: 1; min-height: 250px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .v-table-wrap { flex: 1; overflow: auto; max-height: 100%; } table.v-table { width: 100%; border-collapse: collapse; } table.v-table thead th { position: sticky; top: 0; z-index: 10; padding: 10px 16px; background: #f8f9fb; font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-dim); white-space: nowrap; text-align: left; } table.v-table tbody tr { transition: background 0.15s; border-bottom: 1px solid var(--border-dim); } table.v-table tbody tr:hover { background: var(--bg-hover); } table.v-table td { padding: 10px 16px; font-size: 13px; vertical-align: middle; }
    .v-table-total-row { border-top: 2px solid var(--border-mid) !important; background: var(--bg-elevated) !important; }
    .v-table-total-row td { padding: 11px 16px !important; font-size: 13px !important; font-weight: 700 !important; color: var(--text-primary) !important; }
    .v-table-total-row .total-amount { font-family: 'DM Mono', monospace; font-size: 14px !important; color: var(--accent) !important; }
    .v-table-empty { padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px; }
    table.v-table tbody tr.selected-row { background: var(--accent-dim); box-shadow: inset 3px 0 0 var(--accent); }
    @keyframes spin { to { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; }
  `}</style>
);

const expandFileNumber = (input) => {
  const trimmed = input.trim();
  if (/^\d{6}$/.test(trimmed)) {
    const year = trimmed.substring(0, 2);
    const serial = trimmed.substring(2);
    return `VMA20${year}/${serial}`;
  }
  return trimmed;
};

const Verify = ({ theme }) => {
  const isDark = theme === 'dark';
  const [fileNumber, setFileNumber] = useState("");
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingRMS, setLoadingRMS] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [reqData, setReqData] = useState(null);
  const [localHistory, setLocalHistory] = useState(null);
  const [reqToken, setReqToken] = useState(null);
  
  // State for the empty screen summary table
  const [allReceiptsSummary, setAllReceiptsSummary] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);

  // Pagination & Filtering state
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const entriesPerPage = 20;
  const tableWrapRef = useRef(null);

  const REQ_API_URL = import.meta.env.VITE_REQ_API_URL;
  const LOCAL_API_URL = import.meta.env.VITE_API_URL;

  const showToast = (msg, type) => {
    if (window.toast) window.toast(msg, type);
    else console.warn(msg);
  };

  const handleConnect = async () => {
    setConnectionStatus("connecting");
    try {
      const credRes = await fetch(`${LOCAL_API_URL}/auth/portal-creds`, { credentials: 'include' });
      if (!credRes.ok) throw new Error("Could not fetch portal credentials");
      const creds = await credRes.json();
      if (!creds.portal_email || !creds.portal_password) {
        setConnectionStatus("disconnected");
        return;
      }
      const response = await fetch(`${REQ_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: creds.portal_email, password: creds.portal_password })
      });
      const resData = await response.json();
      if (resData.success) {
        const token = resData.data?.accessToken || resData.token;
        setReqToken(token);
        sessionStorage.setItem("rmsToken", token);
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("disconnected");
      }
    } catch (error) {
      setConnectionStatus("disconnected");
    }
  };

  // Fetch all receipts for the summary view
  const fetchAllReceipts = async () => {
    setLoadingAll(true);
    try {
      const res = await fetch(`${LOCAL_API_URL}/general-receipts/list`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const grouped = {};
        
        data.forEach(item => {
          if (!item.file_no) return;
          if (!grouped[item.file_no]) {
            grouped[item.file_no] = {
              file_no: item.file_no,
              customer_name: item.customer_name,
              latest_date: item.date,
              latest_receipt: item.receipt_no,
              total_amount: Number(item.amount) || 0
            };
          } else {
            grouped[item.file_no].total_amount += Number(item.amount) || 0;
            // Determine latest based on date
            if (new Date(item.date) > new Date(grouped[item.file_no].latest_date)) {
              grouped[item.file_no].latest_date = item.date;
              grouped[item.file_no].latest_receipt = item.receipt_no;
            } else if (new Date(item.date).getTime() === new Date(grouped[item.file_no].latest_date).getTime()) {
              // If same date, fallback to higher receipt number
              if (parseInt(item.receipt_no) > parseInt(grouped[item.file_no].latest_receipt)) {
                grouped[item.file_no].latest_receipt = item.receipt_no;
              }
            }
          }
        });
        
        // Convert to array and sort by latest_date descending
        const summaryArray = Object.values(grouped).sort((a, b) => new Date(b.latest_date) - new Date(a.latest_date));
        setAllReceiptsSummary(summaryArray);
      }
    } catch (e) {
      console.error("Failed to fetch receipt summary", e);
    }
    setLoadingAll(false);
  };

  useEffect(() => {
    const savedToken = sessionStorage.getItem("rmsToken");
    if (savedToken) {
      setReqToken(savedToken);
      setConnectionStatus("connected");
    } else {
      handleConnect();
    }
    fetchAllReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeSearch = async (targetFileNo) => {
    setReqData(null);
    setLocalHistory(null);
    setLoadingLocal(true);
    setLoadingRMS(false);

    const safeFileNumber = encodeURIComponent(targetFileNo);

    try {
      const localRes = await fetch(`${LOCAL_API_URL}/general-receipts/customer-history/${safeFileNumber}`, { credentials: 'include' });
      const localData = await localRes.json();
      if (localData.history) setLocalHistory(localData);
    } catch (e) {}
    setLoadingLocal(false);

    if (connectionStatus === "connected" && reqToken) {
      setLoadingRMS(true);
      try {
        const rmsRes = await fetch(`${REQ_API_URL}/portal/fetch-details/${safeFileNumber}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${reqToken}`, "Content-Type": "application/json" }
        });
        if (rmsRes.status === 401) {
          setConnectionStatus("disconnected");
        } else {
          const data = await rmsRes.json();
          if (data.success && data.data) setReqData(data.data);
        }
      } catch (e) {}
      setLoadingRMS(false);
    }
  };

  const handleSearchInput = async (e) => {
    e.preventDefault();
    const input = fileNumber.trim();
    if (!input) return;

    if (/^\d{6}$/.test(input)) {
      const fullFileNo = expandFileNumber(input);
      setFileNumber(fullFileNo);
      executeSearch(fullFileNo);
      return;
    }

    if (/^VMA\d{4}\/\d+$/i.test(input)) {
      executeSearch(input);
      return;
    }

    if (/^\d{4}$/.test(input) || input.length > 0) {
      setLoadingLocal(true);
      try {
        const localRes = await fetch(`${LOCAL_API_URL}/general-receipts/list?search=${encodeURIComponent(input)}`, { credentials: 'include' });
        let localData = [];
        if (localRes.ok) localData = await localRes.json();

        if (localData.length > 0) {
          // Sort descending so newer years automatically take priority
          localData.sort((a, b) => (b.file_no || '').localeCompare(a.file_no || ''));
          const bestMatch = localData[0].file_no;
          setFileNumber(bestMatch);
          executeSearch(bestMatch);
        } else {
          showToast("No records found.", "error");
        }
      } catch (err) {
        showToast("Error searching. Check connection.", "error");
      } finally {
        setLoadingLocal(false);
      }
    }
  };

  const handleClear = () => {
    setFileNumber("");
    setReqData(null);
    setLocalHistory(null);
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
    setSelectedIndex(-1);
    fetchAllReceipts(); // Refresh the summary view just in case
  };

  // Pagination & Filtering Logic
  const filteredSummary = useMemo(() => {
    let result = allReceiptsSummary;

    // Filter by single main search bar (fileNumber state)
    if (fileNumber.trim()) {
      const term = fileNumber.toLowerCase().trim();
      result = result.filter(item => {
        const fileStr = (item.file_no || '').toLowerCase();
        
        // Create a 6-digit shorthand for filtering (e.g., "vma2025/0006" -> "250006")
        // This ensures typing "250006" in the search instantly matches "VMA2025/0006"
        const shortFileStr = fileStr.replace('vma20', '').replace('/', '');
        
        const nameStr = (item.customer_name || '').toLowerCase();
        const receiptStr = (item.latest_receipt || '').toLowerCase();
        
        return fileStr.includes(term) || shortFileStr.includes(term) || nameStr.includes(term) || receiptStr.includes(term);
      });
    }

    // Filter by Date Range
    if (fromDate || toDate) {
      const fromTs = fromDate ? new Date(fromDate).setHours(0,0,0,0) : 0;
      const toTs = toDate ? new Date(toDate).setHours(23,59,59,999) : Infinity;

      result = result.filter(item => {
        if (!item.latest_date) return false;
        const itemTs = new Date(item.latest_date).getTime();
        return itemTs >= fromTs && itemTs <= toTs;
      });
    }

    return result;
  }, [allReceiptsSummary, fileNumber, fromDate, toDate]);

  const totalPages = Math.ceil(filteredSummary.length / entriesPerPage);
  const paginatedSummary = filteredSummary.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIndex(-1);
  }, [fileNumber, fromDate, toDate]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [currentPage]);

  // Handle Keyboard Navigation for the summary table
  const handleSummaryKeyDown = (e) => {
    if (!paginatedSummary.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < paginatedSummary.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
      const selectedItem = paginatedSummary[targetIndex];
      if (selectedItem) {
        e.preventDefault();
        setFileNumber(selectedItem.file_no);
        executeSearch(selectedItem.file_no);
      }
    }
  };

  // Auto-scroll to selected item when navigating with keys
  useEffect(() => {
    if (selectedIndex >= 0 && tableWrapRef.current) {
      const row = tableWrapRef.current.querySelector(`tr[data-index="${selectedIndex}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const totalCost = reqData ? Number(reqData.totalAmount) : 0;
  const totalPaid = localHistory ? Number(localHistory.totalPaid) : 0;
  const netDiff = (reqData && localHistory) ? totalPaid - totalCost : 0;
  const isExcess = netDiff >= 0;
  const hasData = !!(reqData || localHistory);
  const hasLocal = !!localHistory;
  const hasRMS = !!reqData;

  const localTotal = hasLocal && localHistory.history
    ? localHistory.history.reduce((sum, h) => sum + Number(h.amount), 0)
    : 0;
  const rmsTotal = hasRMS && reqData.particulars
    ? reqData.particulars.reduce((sum, p) => sum + Number(p.amount), 0)
    : 0;

  const themeStyle = isDark ? {
    '--bg-base': '#111827', '--bg-surface': '#1f2937', '--bg-panel': '#1f2937',
    '--bg-elevated': '#374151', '--bg-hover': '#374151', '--border-dim': '#374151',
    '--border-mid': '#4b5563', '--text-primary': '#f9fafb', '--text-secondary': '#d1d5db',
    '--text-muted': '#9ca3af'
  } : {};

  return (
    <>
      <FontStyle />
      <div className="verify-root" style={themeStyle}>
        <header className="v-header">
          <div className="v-logo">
            <div className="v-logo-icon"><FileText size={16} color="white" /></div>
            <div className="v-logo-text">Statement<span>Check</span></div>
          </div>
          <div className="v-header-right">
            <button type="button" onClick={handleClear} className="v-clear-btn" title="Clear Search">
              <RefreshCw size={14} /> Reset
            </button>
            
            <form onSubmit={handleSearchInput} className="v-search-wrap">
              <input
                value={fileNumber}
                onChange={(e) => setFileNumber(e.target.value)}
                className="v-search-input"
                placeholder="Search file, name, receipt (press Enter to deep search)..."
              />
              <button type="submit" className="v-search-btn">
                {loadingLocal ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </form>

            <div
              onClick={() => connectionStatus === 'disconnected' && handleConnect()}
              className={`v-rms-pill ${connectionStatus}`}
              title={connectionStatus === 'connected' ? 'RMS Online' : connectionStatus === 'connecting' ? 'Connecting to RMS' : 'RMS Offline'}
            >
              <div className={`status-dot ${connectionStatus === 'connecting' ? 'pulse' : ''}`} />
              RMS
            </div>
          </div>
        </header>

        <div className="v-body">
          <main className="v-main">
            {hasData ? (
              <>
                <div className="v-top-row">
                  {/* Customer Details */}
                  <div className="v-panel">
                    <div className="v-panel-header">
                      <div className="v-panel-header-icon"><User size={14} /></div>
                      <span className="v-panel-title">Customer Details</span>
                    </div>
                    <div className="v-info-grid">
                      <div className="v-info-cell" title={reqData?.header?.customerName || localHistory?.history?.[0]?.customer_name}>
                        <div className="v-info-label">Name</div>
                        <div className="v-info-value">{reqData?.header?.customerName || localHistory?.history?.[0]?.customer_name || 'N/A'}</div>
                      </div>
                      <div className="v-info-cell">
                        <div className="v-info-label">File No</div>
                        <div className="v-info-value mono">{reqData?.header?.fileNumber || fileNumber || 'N/A'}</div>
                      </div>
                      <div className="v-info-cell">
                        <div className="v-info-label">Model</div>
                        <div className="v-info-value">{reqData?.header?.model || localHistory?.history?.[0]?.model || 'N/A'}</div>
                      </div>
                      {hasRMS && !loadingRMS && (
                        <div className="v-info-cell">
                          <div className="v-info-label">Chassis</div>
                          <div className="v-info-value mono">{reqData?.header?.chassisNumber || '—'}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Summary - Only visible once RMS has fully loaded */}
                  {hasRMS && !loadingRMS && (
                    <div className={`v-fin-panel ${isExcess ? 'excess' : 'shortage'}`}>
                      <div className="v-fin-header">
                        <span className={`v-fin-label ${isExcess ? 'excess' : 'shortage'}`}>
                          {isExcess ? 'Excess Amount' : 'Amount Shortage'}
                        </span>
                        <span style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 12,
                          padding: '2px 10px',
                          borderRadius: 6,
                          background: isExcess ? 'var(--green-dim)' : 'var(--red-dim)',
                          color: isExcess ? 'var(--green)' : 'var(--red)',
                          fontWeight: 600,
                          letterSpacing: '0.3px'
                        }}>
                          {isExcess ? '+' : '−'}₹{Math.abs(netDiff).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="v-fin-body">
                        <div className="v-fin-row">
                          <div className="v-fin-metric">
                            <div className="v-fin-metric-label">Paid</div>
                            <div className="v-fin-metric-value">₹{totalPaid.toLocaleString('en-IN')}</div>
                          </div>
                          <div className="v-fin-operator">−</div>
                          <div className="v-fin-metric">
                            <div className="v-fin-metric-label">RMS Cost</div>
                            <div className="v-fin-metric-value">₹{totalCost.toLocaleString('en-IN')}</div>
                          </div>
                          <div className="v-fin-operator">=</div>
                          <div className="v-fin-metric balance">
                            <div className="v-fin-metric-label">Balance</div>
                            <div className="v-fin-metric-value highlight" style={{ color: isExcess ? 'var(--green)' : 'var(--red)' }}>
                              ₹{Math.abs(netDiff).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="v-tables-row">
                  {/* Receipt Payment Details */}
                  <div className="v-panel">
                    <div className="v-panel-header">
                      <span className="v-panel-title">Receipt Payment Details</span>
                      {hasLocal && localHistory.history?.length > 0 && (
                        <span className="v-panel-badge">{localHistory.history.length} entries</span>
                      )}
                    </div>
                    <div className="v-table-wrap">
                      {hasLocal && localHistory.history && localHistory.history.length > 0 ? (
                        <table className="v-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Receipt #</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {localHistory.history.map((h, i) => (
                              <tr key={i}>
                                <td style={{ color: 'var(--text-secondary)' }}>{new Date(h.date).toLocaleDateString()}</td>
                                <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{h.receipt_no}</td>
                                <td style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>₹{Number(h.amount).toLocaleString('en-IN')}</td>
                              </tr>
                            ))}
                            <tr className="v-table-total-row">
                              <td colSpan={2}>Total Paid</td>
                              <td style={{ textAlign: 'right' }} className="total-amount">₹{localTotal.toLocaleString('en-IN')}</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <div className="v-table-empty">No Payments Found</div>
                      )}
                    </div>
                  </div>

                  {/* RMS Particulars - Only visible once RMS has fully loaded */}
                  {hasRMS && !loadingRMS && (
                    <div className="v-panel">
                      <div className="v-panel-header">
                        <span className="v-panel-title">RMS Particulars</span>
                        {reqData.particulars?.length > 0 && (
                          <span className="v-panel-badge">{reqData.particulars.length} items</span>
                        )}
                      </div>
                      <div className="v-table-wrap">
                        {reqData.particulars && reqData.particulars.length > 0 ? (
                          <table className="v-table">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reqData.particulars.map((p, i) => (
                                <tr key={i}>
                                  <td>{p.particularName}</td>
                                  <td style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                                </tr>
                              ))}
                              <tr className="v-table-total-row">
                                <td>Total Cost</td>
                                <td style={{ textAlign: 'right' }} className="total-amount">₹{rmsTotal.toLocaleString('en-IN')}</td>
                              </tr>
                            </tbody>
                          </table>
                        ) : (
                          <div className="v-table-empty">No RMS Charges Found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div 
                className="v-summary-container" 
                tabIndex="0" 
                onKeyDown={handleSummaryKeyDown}
              >
                <div className="summary-header-wrap">
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={18} color="var(--accent)" /> Receipt Archives Summary
                  </h3>
                  
                  <div className="date-filter-group">
                    <div className="date-input-wrap">
                      <span className="date-label">From</span>
                      <input 
                        type="date" 
                        className="date-input" 
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </div>
                    <div className="date-input-wrap">
                      <span className="date-label">To</span>
                      <input 
                        type="date" 
                        className="date-input" 
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="v-table-wrap" style={{ flex: 1 }} ref={tableWrapRef}>
                  {paginatedSummary.length > 0 ? (
                    <table className="v-table">
                      <thead>
                        <tr>
                          <th>Latest Date</th>
                          <th>Last Receipt #</th>
                          <th>File Number</th>
                          <th>Customer Name</th>
                          <th style={{ textAlign: 'right' }}>Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSummary.map((item, i) => (
                          <tr 
                            key={i} 
                            data-index={i}
                            className={selectedIndex === i ? 'selected-row' : ''}
                            onClick={() => { 
                              setSelectedIndex(i);
                              setFileNumber(item.file_no); 
                              executeSearch(item.file_no); 
                            }} 
                            style={{ cursor: 'pointer' }}
                            title="Click or press Enter to view details"
                          >
                            <td style={{ color: 'var(--text-secondary)' }}>{new Date(item.latest_date).toLocaleDateString()}</td>
                            <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{item.latest_receipt}</td>
                            <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 'bold', color: 'var(--accent)' }}>{item.file_no}</td>
                            <td style={{ fontWeight: 500 }}>{item.customer_name}</td>
                            <td style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 600, color: 'var(--green)' }}>₹{item.total_amount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : loadingAll ? (
                    <div className="v-empty">
                      <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                      <div style={{ color: 'var(--text-muted)' }}>Fetching summary...</div>
                    </div>
                  ) : (
                    <div className="v-empty" style={{ padding: 40 }}>
                      <div style={{ color: 'var(--text-muted)' }}>No receipts found matching your criteria.</div>
                    </div>
                  )}
                </div>

                <div className="pagination-wrap">
                  <span>
                    Showing {paginatedSummary.length > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0} - {Math.min(currentPage * entriesPerPage, filteredSummary.length)} of {filteredSummary.length}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      className="page-btn" 
                      disabled={currentPage === 1} 
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      Prev
                    </button>
                    <button 
                      className="page-btn" 
                      disabled={currentPage === totalPages || totalPages === 0} 
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default Verify;