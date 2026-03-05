import React, { useState, useEffect } from "react";
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
    .v-panel-header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border-dim); } .v-panel-header-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); color: var(--text-secondary); flex-shrink: 0; } .v-panel-title { font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: var(--text-secondary); text-transform: uppercase; } .v-panel-badge { margin-left: auto; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); border: 1px solid var(--border-dim); padding: 2px 8px; border-radius: 6px; }
    .v-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; } .v-info-cell { padding: 16px 20px; border-right: 1px solid var(--border-dim); border-bottom: 1px solid var(--border-dim); overflow:hidden;} .v-info-cell:nth-child(2n) { border-right: none; } .v-info-label { display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 5px; } .v-info-value { font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; color: var(--text-primary); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .v-info-value.mono { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 400; letter-spacing: 0.5px; color: var(--text-secondary); }
    .v-fin-panel { display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; border: 1px solid; position: relative; } .v-fin-panel.excess { background: linear-gradient(135deg, rgba(52,211,153,0.06) 0%, var(--bg-panel) 60%); border-color: rgba(52,211,153,0.2); } .v-fin-panel.shortage { background: linear-gradient(135deg, rgba(248,113,113,0.06) 0%, var(--bg-panel) 60%); border-color: rgba(248,113,113,0.2); } .v-fin-panel.neutral { background: var(--bg-panel); border-color: var(--border-mid); }
    .v-fin-header { padding: 12px 20px; border-bottom: 1px solid var(--border-dim); display: flex; align-items: center; gap: 8px; } .v-fin-label { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; } .v-fin-label.excess { color: var(--green); } .v-fin-label.shortage { color: var(--red); } .v-fin-label.neutral { color: var(--text-secondary); }
    .v-fin-body { flex: 1; padding: 20px; display: flex; flex-direction: column; justify-content: center; } .v-fin-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; } .v-fin-metric { flex: 1; text-align: center; } .v-fin-metric-label { font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; } .v-fin-metric-value { font-family: 'DM Mono', monospace; font-size: 20px; font-weight: 500; color: var(--text-primary); } .v-fin-operator { font-size: 24px; color: var(--text-muted); padding-bottom: 2px; flex-shrink: 0; } 
    .v-tables-row { flex: 1; min-height: 250px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .v-table-wrap { flex: 1; overflow: auto; max-height: 400px; } table.v-table { width: 100%; border-collapse: collapse; } table.v-table thead th { position: sticky; top: 0; z-index: 10; padding: 11px 16px; background: #f8f9fb; font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-dim); white-space: nowrap; text-align: left; } table.v-table tbody tr { transition: background 0.15s; border-bottom: 1px solid var(--border-dim); } table.v-table tbody tr:hover { background: var(--bg-hover); } table.v-table td { padding: 12px 16px; font-size: 13px; vertical-align: middle; }
    .v-table-empty { padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px; }
    @keyframes spin { to { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; }
  `}</style>
);

const Verify = ({ theme }) => {
  const isDark = theme === 'dark';
  const [fileNumber, setFileNumber] = useState("");
  const [searchCandidates, setSearchCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [reqData, setReqData] = useState(null);
  const [localHistory, setLocalHistory] = useState(null);
  const [reqToken, setReqToken] = useState(null);

  const REQ_API_URL = import.meta.env.VITE_REQ_API_URL;
  const LOCAL_API_URL = import.meta.env.VITE_API_URL;

  // Safe global toast caller
  const showToast = (msg, type) => {
      if(window.toast) window.toast(msg, type);
      else alert(msg);
  };

  // --- CONNECT LOGIC ---
  const handleConnect = async () => {
    setConnectionStatus("connecting");
    try {
        const credRes = await fetch(`${LOCAL_API_URL}/auth/portal-creds`, { credentials: 'include' });
        if(!credRes.ok) throw new Error("Could not fetch portal credentials");
        const creds = await credRes.json();
        
        if (!creds.portal_email || !creds.portal_password) {
            showToast("Portal credentials not configured in Admin Panel.", "error");
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
            showToast("RMS Login Failed: Check Admin Panel Creds", "error");
            setConnectionStatus("disconnected");
        }
    } catch (error) { 
        console.error(error);
        showToast("RMS Server Unreachable", "error");
        setConnectionStatus("disconnected"); 
    }
  };

  // Auto-connect on mount if no token exists, or load existing token
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

  // --- SEARCH LOGIC ---
  const executeSearch = async (targetFileNo) => {
      setLoading(true); 
      setReqData(null); 
      setLocalHistory(null);
      setSearchCandidates([]); 
      
      const safeFileNumber = encodeURIComponent(targetFileNo);
      
      // 1. Local Fetch
      const localFetchPromise = fetch(`${LOCAL_API_URL}/general-receipts/customer-history/${safeFileNumber}`, { credentials: 'include' }).then(res => res.json());

      // 2. RMS Fetch
      let rmsFetchPromise = Promise.reject("Not Connected");
      if (connectionStatus === "connected" && reqToken) {
          rmsFetchPromise = fetch(`${REQ_API_URL}/portal/fetch-details/${safeFileNumber}`, {
                method: "GET", headers: { "Authorization": `Bearer ${reqToken}`, "Content-Type": "application/json" }
          }).then(async (res) => {
              if (res.status === 401) {
                  setConnectionStatus("disconnected");
                  throw new Error("Unauthorized");
              }
              const data = await res.json();
              return data.success ? data.data : null;
          });
      }

      const results = await Promise.allSettled([localFetchPromise, rmsFetchPromise]);
      const localResult = results[0];
      const rmsResult = results[1];

      if (localResult.status === 'fulfilled' && localResult.value.history) {
          setLocalHistory(localResult.value);
      }
      if (rmsResult.status === 'fulfilled' && rmsResult.value) {
          setReqData(rmsResult.value);
      }
      
      setLoading(false);
  };

  const handleSearchInput = async (e) => {
      e.preventDefault();
      const input = fileNumber.trim();
      if (!input) return;

      setLoading(true);
      setSearchCandidates([]);

      // Auto-format 6 digit searches (YYXXXX) to match standard file format
      let queryTerm = input;
      if (/^\d{6}$/.test(input)) {
          const year = input.substring(0, 2);
          const serial = input.substring(2);
          queryTerm = `VMA20${year}/${serial}`;
      }

      try {
          // Fetch Local Matches
          const localRes = await fetch(`${LOCAL_API_URL}/general-receipts/list?search=${queryTerm}`, { credentials: 'include' });
          let localData = [];
          if (localRes.ok) localData = await localRes.json();

          // Fetch RMS Matches
          let rmsData = null;
          if (connectionStatus === "connected" && reqToken) {
              const rmsRes = await fetch(`${REQ_API_URL}/portal/fetch-details/${encodeURIComponent(queryTerm)}`, {
                  headers: { "Authorization": `Bearer ${reqToken}`, "Content-Type": "application/json" }
              });
              if (rmsRes.ok) {
                  const json = await rmsRes.json();
                  if (json.success) rmsData = json.data;
              }
          }

          // Merge & Deduplicate
          const candidatesMap = new Map();
          
          localData.forEach(item => {
              candidatesMap.set(item.file_no, { 
                  file_no: item.file_no, 
                  customer_name: item.customer_name, 
                  sources: ['local'] 
              });
          });

          if (rmsData && rmsData.header && rmsData.header.fileNumber) {
              const fNo = rmsData.header.fileNumber;
              if (candidatesMap.has(fNo)) {
                  candidatesMap.get(fNo).sources.push('rms');
              } else {
                  candidatesMap.set(fNo, { 
                      file_no: fNo, 
                      customer_name: rmsData.header.customerName, 
                      sources: ['rms'] 
                  });
              }
          }

          const candidates = Array.from(candidatesMap.values());

          // Rule 5 & 6: Auto-fill only if exactly 1 match exists in BOTH local and RMS
          if (candidates.length === 1 && candidates[0].sources.includes('local') && candidates[0].sources.includes('rms')) {
              setFileNumber(candidates[0].file_no);
              executeSearch(candidates[0].file_no);
          } else if (candidates.length > 0) {
              setSearchCandidates(candidates);
          } else {
              showToast("No records found for that search.", "error");
              executeSearch(queryTerm); // Trigger empty states
          }
      } catch (err) {
          console.error(err);
          showToast("Error searching. Check connection.", "error");
      } finally {
          setLoading(false);
      }
  };

  const totalCost = reqData ? Number(reqData.totalAmount) : 0;
  const totalPaid = localHistory ? Number(localHistory.totalPaid) : 0;
  const netDiff = (reqData && localHistory) ? totalPaid - totalCost : 0;
  const isExcess = netDiff >= 0;
  const missingRMS = !reqData;

  // Use inline style logic for dark mode applying over custom vars to keep the component functional
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
            <form onSubmit={handleSearchInput} className="v-search-wrap">
              <input 
                value={fileNumber} 
                onChange={(e) => { setFileNumber(e.target.value); setSearchCandidates([]); }} 
                className="v-search-input" 
                placeholder="Search file no (e.g. 251244)..." 
              />
              <button type="submit" className="v-search-btn">{loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}</button>
              
              {searchCandidates.length > 0 && (
                  <div className="v-search-results">
                      {searchCandidates.map((c, i) => (
                          <div key={i} className="v-search-item" onClick={() => { setFileNumber(c.file_no); executeSearch(c.file_no); }}>
                              <div className="v-search-item-header">
                                  <span className="v-search-item-fno">{c.file_no}</span>
                                  <div className="v-badge-row">
                                      {c.sources.includes('local') && <span className="v-badge local"><Database size={10}/> Local</span>}
                                      {c.sources.includes('rms') && <span className="v-badge rms"><Globe size={10}/> RMS</span>}
                                  </div>
                              </div>
                              <span className="v-search-item-name">{c.customer_name}</span>
                          </div>
                      ))}
                  </div>
              )}
            </form>
            
            {/* Status Indicator / Manual Retry Button */}
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
            {(reqData || localHistory) ? (
              <>
                <div className="v-top-row">
                  <div className="v-panel">
                    <div className="v-panel-header">
                        <div className="v-panel-header-icon"><User size={15}/></div><span className="v-panel-title">Customer Details</span>
                    </div>
                    <div className="v-info-grid">
                        <div className="v-info-cell" title={reqData?.header?.customerName || localHistory?.history?.[0]?.customer_name}><div className="v-info-label">Name</div><div className="v-info-value">{reqData?.header?.customerName || localHistory?.history?.[0]?.customer_name || 'N/A'}</div></div>
                        <div className="v-info-cell" title={reqData?.header?.fileNumber || fileNumber}><div className="v-info-label">File No</div><div className="v-info-value mono">{reqData?.header?.fileNumber || fileNumber || 'N/A'}</div></div>
                        <div className="v-info-cell" title={reqData?.header?.model || localHistory?.history?.[0]?.model}><div className="v-info-label">Model</div><div className="v-info-value">{reqData?.header?.model || localHistory?.history?.[0]?.model || 'N/A'}</div></div>
                        <div className="v-info-cell" title={reqData?.header?.chassisNumber || "—"}><div className="v-info-label">Chassis</div><div className="v-info-value mono">{reqData?.header?.chassisNumber || "—"}</div></div>
                    </div>
                  </div>

                  <div className={`v-fin-panel ${missingRMS ? 'neutral' : isExcess ? 'excess' : 'shortage'}`}>
                    <div className="v-fin-header">
                        <span className={`v-fin-label ${missingRMS ? 'neutral' : isExcess ? 'excess' : 'shortage'}`}>{missingRMS ? 'RMS Offline / No Data' : isExcess ? 'Excess Amount' : 'Amount Shortage'}</span>
                    </div>
                    <div className="v-fin-body">
                        <div className="v-fin-row">
                            <div className="v-fin-metric"><div className="v-fin-metric-label">Paid Locally</div><div className="v-fin-metric-value">₹{totalPaid.toLocaleString()}</div></div>
                            <div className="v-fin-operator">-</div>
                            <div className="v-fin-metric"><div className="v-fin-metric-label">RMS Cost</div><div className="v-fin-metric-value">₹{totalCost.toLocaleString()}</div></div>
                            <div className="v-fin-operator">=</div>
                            <div className="v-fin-metric"><div className="v-fin-metric-label">Balance</div><div className="v-fin-metric-value" style={{color: missingRMS ? 'inherit' : isExcess?'var(--green)':'var(--red)'}}>{missingRMS ? '—' : `₹${Math.abs(netDiff).toLocaleString()}`}</div></div>
                        </div>
                    </div>
                  </div>
                </div>

                <div className="v-tables-row">
                    <div className="v-panel">
                        <div className="v-panel-header"><span className="v-panel-title">RMS Particulars (Charges)</span></div>
                        <div className="v-table-wrap">
                            {reqData && reqData.particulars && reqData.particulars.length > 0 ? (
                                <table className="v-table">
                                    <thead><tr><th>Item</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
                                    <tbody>{reqData.particulars.map((p,i)=><tr key={i}><td>{p.particularName}</td><td style={{textAlign:'right'}}>₹{p.amount}</td></tr>)}</tbody>
                                </table>
                            ) : <div className="v-table-empty">No RMS Charges Found</div>}
                        </div>
                    </div>

                    <div className="v-panel">
                        <div className="v-panel-header"><span className="v-panel-title">Local Payments (Receipts)</span></div>
                        <div className="v-table-wrap">
                            {localHistory && localHistory.history && localHistory.history.length > 0 ? (
                                <table className="v-table">
                                    <thead><tr><th>Date</th><th>Receipt #</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
                                    <tbody>{localHistory.history.map((h,i)=><tr key={i}><td>{new Date(h.date).toLocaleDateString()}</td><td>{h.receipt_no}</td><td style={{textAlign:'right', fontWeight: 'bold'}}>₹{h.amount}</td></tr>)}</tbody>
                                </table>
                            ) : <div className="v-table-empty">No Local Payments Found</div>}
                        </div>
                    </div>
                </div>
              </>
            ) : <div className="v-empty"><div className="v-empty-icon-wrap"><Search size={34}/></div><h2>Enter a File Number to Begin</h2></div>}
          </main>
        </div>
      </div>
    </>
  );
};

export default Verify;