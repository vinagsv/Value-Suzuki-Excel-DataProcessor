import React, { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, FileText, User, Database, Globe } from "lucide-react";

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
    .v-search-wrap { position: relative; width: 340px; }
    .v-search-input { width: 100%; padding: 9px 40px 9px 16px; background: var(--bg-elevated); border: 1px solid var(--border-mid); border-radius: 10px; color: var(--text-primary); font-family: 'DM Mono', monospace; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
    .v-search-input::placeholder { color: var(--text-muted); font-family: 'DM Sans', sans-serif; }
    .v-search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
    .v-search-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 4px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; transition: color 0.2s; } .v-search-btn:hover { color: var(--accent); }
    .v-search-results { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-surface); border: 1px solid var(--border-mid); border-radius: 10px; margin-top: 4px; max-height: 300px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display:flex; flex-direction:column; }
    .v-search-item { padding: 12px; cursor: pointer; border-bottom: 1px solid var(--border-dim); display:flex; flex-direction:column; gap:4px; transition: background 0.1s;} .v-search-item:hover { background: var(--bg-hover); }
    .v-search-item-header { display: flex; justify-content: space-between; align-items: center;}
    .v-search-item-fno { font-size: 13px; font-family: 'DM Mono', monospace; font-weight: bold; color: var(--accent); }
    .v-search-item-name { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
    .v-badge-row { display: flex; gap: 4px; }
    .v-badge { font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; display:flex; align-items:center; gap: 3px; }
    .v-badge.local { background: var(--accent-dim); color: var(--accent); }
    .v-badge.rms { background: var(--green-dim); color: var(--green); }
    .v-connect-btn { display: flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 10px; border: 1px solid; font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; transition: all 0.2s; }
    .v-connect-btn.connected { background: var(--green-dim); border-color: rgba(52,211,153,0.3); color: var(--green); }
    .v-connect-btn.connecting { background: var(--accent-dim); border-color: rgba(108,126,248,0.3); color: var(--accent); }
    .v-connect-btn.disconnected { background: var(--red-dim); border-color: rgba(248,113,113,0.3); color: var(--red); }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px currentColor; } .status-dot.pulse { animation: pulse-ring 1.2s ease-out infinite; } @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 currentColor; } 70% { box-shadow: 0 0 0 5px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
    .v-body { flex: 1; display: flex; overflow: hidden; }
    .v-main { flex: 1; display: flex; flex-direction: column; padding: 20px; gap: 16px; overflow-y: auto; min-width: 0; }
    .v-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--text-muted); } .v-empty-icon-wrap { width: 80px; height: 80px; border-radius: 24px; background: var(--bg-elevated); border: 1px solid var(--border-dim); display: flex; align-items: center; justify-content: center; color: var(--text-muted); }
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
    .v-rms-loading { display: flex; align-items: center; gap: 8px; padding: 10px 16px; font-size: 12px; color: var(--text-muted); background: var(--bg-elevated); border-radius: 8px; margin: 8px 16px 12px; }
    .v-tables-row { flex: 1; min-height: 250px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .v-table-wrap { flex: 1; overflow: auto; max-height: 400px; } table.v-table { width: 100%; border-collapse: collapse; } table.v-table thead th { position: sticky; top: 0; z-index: 10; padding: 10px 16px; background: #f8f9fb; font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-dim); white-space: nowrap; text-align: left; } table.v-table tbody tr { transition: background 0.15s; border-bottom: 1px solid var(--border-dim); } table.v-table tbody tr:hover { background: var(--bg-hover); } table.v-table td { padding: 10px 16px; font-size: 13px; vertical-align: middle; }
    .v-table-total-row { border-top: 2px solid var(--border-mid) !important; background: var(--bg-elevated) !important; }
    .v-table-total-row td { padding: 11px 16px !important; font-size: 13px !important; font-weight: 700 !important; color: var(--text-primary) !important; }
    .v-table-total-row .total-amount { font-family: 'DM Mono', monospace; font-size: 14px !important; color: var(--accent) !important; }
    .v-table-empty { padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px; }
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
  const [searchCandidates, setSearchCandidates] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingRMS, setLoadingRMS] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [reqData, setReqData] = useState(null);
  const [localHistory, setLocalHistory] = useState(null);
  const [reqToken, setReqToken] = useState(null);
  const dropdownRef = useRef(null);

  const REQ_API_URL = import.meta.env.VITE_REQ_API_URL;
  const LOCAL_API_URL = import.meta.env.VITE_API_URL;

  const showToast = (msg, type) => {
    if (window.toast) window.toast(msg, type);
    else console.warn(msg);
  };

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSearchCandidates([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        showToast("Connected to RMS Successfully", "success");
      } else {
        setConnectionStatus("disconnected");
      }
    } catch (error) {
      setConnectionStatus("disconnected");
    }
  };

  useEffect(() => {
    const savedToken = sessionStorage.getItem("rmsToken");
    if (savedToken) {
      setReqToken(savedToken);
      setConnectionStatus("connected");
    } else {
      handleConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeSearch = async (targetFileNo) => {
    setReqData(null);
    setLocalHistory(null);
    setSearchCandidates([]);
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
    setSearchCandidates([]);

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

        const candidatesMap = new Map();
        localData.forEach(item => {
          candidatesMap.set(item.file_no, {
            file_no: item.file_no,
            customer_name: item.customer_name,
            sources: ['local']
          });
        });

        const candidates = Array.from(candidatesMap.values());
        if (candidates.length === 1) {
          setFileNumber(candidates[0].file_no);
          executeSearch(candidates[0].file_no);
        } else if (candidates.length > 1) {
          setSearchCandidates(candidates);
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

  const isLoading = loadingLocal;

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
            <form onSubmit={handleSearchInput} className="v-search-wrap" ref={dropdownRef}>
              <input
                value={fileNumber}
                onChange={(e) => { setFileNumber(e.target.value); setSearchCandidates([]); }}
                className="v-search-input"
                placeholder="Search file no (e.g. 251234 or 1234)..."
              />
              <button type="submit" className="v-search-btn">
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              </button>

              {searchCandidates.length > 0 && (
                <div className="v-search-results">
                  {searchCandidates.map((c, i) => (
                    <div key={i} className="v-search-item" onClick={() => { setFileNumber(c.file_no); setSearchCandidates([]); executeSearch(c.file_no); }}>
                      <div className="v-search-item-header">
                        <span className="v-search-item-fno">{c.file_no}</span>
                        <div className="v-badge-row">
                          {c.sources.includes('local') && <span className="v-badge local"><Database size={10} /> Local</span>}
                          {c.sources.includes('rms') && <span className="v-badge rms"><Globe size={10} /> RMS</span>}
                        </div>
                      </div>
                      <span className="v-search-item-name">{c.customer_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </form>

            <div
              onClick={() => connectionStatus === 'disconnected' && handleConnect()}
              className={`v-connect-btn ${connectionStatus}`}
              style={{ cursor: connectionStatus === 'disconnected' ? 'pointer' : 'default' }}
            >
              <div className={`status-dot ${connectionStatus === 'connecting' ? 'pulse' : ''}`} />
              {connectionStatus === 'connected' ? 'RMS Online' : connectionStatus === 'connecting' ? 'Connecting…' : 'RMS Offline'}
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
                      {loadingRMS && (
                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                          <RefreshCw size={11} className="animate-spin" /> Syncing RMS…
                        </span>
                      )}
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
                      {hasRMS && (
                        <div className="v-info-cell">
                          <div className="v-info-label">Chassis</div>
                          <div className="v-info-value mono">{reqData?.header?.chassisNumber || '—'}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  {hasRMS ? (
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
                  ) : loadingRMS ? (
                    <div className="v-fin-panel neutral">
                      <div className="v-fin-header">
                        <span className="v-fin-label neutral">Fetching RMS Data…</span>
                      </div>
                      <div className="v-fin-body" style={{ alignItems: 'center', flexDirection: 'row', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                        <RefreshCw size={14} className="animate-spin" /> Contacting RMS server…
                      </div>
                    </div>
                  ) : null}
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

                  {/* RMS Particulars */}
                  {hasRMS && (
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

                  {!hasRMS && loadingRMS && (
                    <div className="v-panel" style={{ opacity: 0.6 }}>
                      <div className="v-panel-header">
                        <span className="v-panel-title">RMS Particulars</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                          <RefreshCw size={11} className="animate-spin" /> Loading…
                        </span>
                      </div>
                      <div className="v-table-empty" style={{ paddingTop: 40 }}>Waiting for RMS…</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="v-empty">
                <div className="v-empty-icon-wrap"><Search size={34} /></div>
                <h2>{isLoading ? 'Searching…' : 'Enter a File Number to Begin'}</h2>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default Verify;