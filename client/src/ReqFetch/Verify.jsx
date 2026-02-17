import React, { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, FileText, Wallet, Calculator, ArrowRightLeft, Trash2, FileCheck, Wifi, WifiOff, User, Truck, Hash, CreditCard, TrendingUp, TrendingDown, Zap } from "lucide-react";

// ─── FONT IMPORT ───────────────────────────────────────────────────────────────
const FontStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500&family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');
    
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --bg-base:      #f4f5f7;
      --bg-surface:   #ffffff;
      --bg-panel:     #ffffff;
      --bg-elevated:  #f0f1f4;
      --bg-hover:     #eef0f5;
      --border-dim:   rgba(0,0,0,0.07);
      --border-mid:   rgba(0,0,0,0.11);
      --border-bright:rgba(0,0,0,0.18);
      --text-primary: #111827;
      --text-secondary:#4b5563;
      --text-muted:   #9ca3af;
      --accent:       #4f63f0;
      --accent-dim:   rgba(79,99,240,0.10);
      --accent-glow:  rgba(79,99,240,0.20);
      --green:        #059669;
      --green-dim:    rgba(5,150,105,0.09);
      --red:          #dc2626;
      --red-dim:      rgba(220,38,38,0.08);
      --amber:        #d97706;
    }

    body { margin: 0; background: var(--bg-base); }

    .verify-root {
      height: 100vh; width: 100%; display: flex; flex-direction: column;
      overflow: hidden;
      background: var(--bg-base);
      color: var(--text-primary);
      font-family: 'DM Sans', sans-serif;
    }

    /* ── SCROLLBARS ── */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border-mid); border-radius: 99px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--border-bright); }

    /* ── HEADER ── */
    .v-header {
      flex: none;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 28px;
      height: 64px;
      border-bottom: 1px solid var(--border-dim);
      background: var(--bg-surface);
      position: relative; z-index: 50;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .v-header::after {
      content: '';
      position: absolute; bottom: -1px; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      opacity: 0.5;
    }

    .v-logo {
      display: flex; align-items: center; gap: 12px;
    }
    .v-logo-icon {
      width: 34px; height: 34px;
      background: linear-gradient(135deg, var(--accent), #8b5cf6);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 20px var(--accent-glow);
    }
    .v-logo-text {
      font-family: 'Syne', sans-serif;
      font-size: 18px; font-weight: 800;
      letter-spacing: -0.5px;
      color: var(--text-primary);
    }
    .v-logo-text span { color: var(--accent); }

    .v-header-right {
      display: flex; align-items: center; gap: 12px;
    }

    /* ── SEARCH ── */
    .v-search-wrap {
      position: relative; width: 340px;
    }
    .v-search-input {
      width: 100%; padding: 9px 40px 9px 16px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-mid);
      border-radius: 10px;
      color: var(--text-primary);
      font-family: 'DM Mono', monospace;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .v-search-input::placeholder { color: var(--text-muted); }
    .v-search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-dim);
    }
    .v-search-btn {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none; padding: 4px;
      color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center;
      transition: color 0.2s;
    }
    .v-search-btn:hover { color: var(--accent); }

    /* ── CONNECT BUTTON ── */
    .v-connect-btn {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 18px;
      border-radius: 10px;
      border: 1px solid;
      font-family: 'Syne', sans-serif;
      font-size: 12px; font-weight: 700;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .v-connect-btn.connected {
      background: var(--green-dim);
      border-color: rgba(52,211,153,0.3);
      color: var(--green);
    }
    .v-connect-btn.connecting {
      background: var(--accent-dim);
      border-color: rgba(108,126,248,0.3);
      color: var(--accent);
      cursor: wait;
    }
    .v-connect-btn.disconnected {
      background: var(--red-dim);
      border-color: rgba(248,113,113,0.3);
      color: var(--red);
    }
    .v-connect-btn.disconnected:hover {
      background: rgba(248,113,113,0.18);
    }

    /* ── STATUS DOT ── */
    .status-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 6px currentColor;
    }
    .status-dot.pulse {
      animation: pulse-ring 1.2s ease-out infinite;
    }
    @keyframes pulse-ring {
      0% { box-shadow: 0 0 0 0 currentColor; }
      70% { box-shadow: 0 0 0 5px transparent; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }

    /* ── LAYOUT ── */
    .v-body {
      flex: 1; display: flex; overflow: hidden;
    }
    .v-main {
      flex: 1; display: flex; flex-direction: column;
      padding: 20px; gap: 16px; overflow: hidden; min-width: 0;
    }

    /* ── EMPTY STATE ── */
    .v-empty {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 16px;
    }
    .v-empty-icon-wrap {
      width: 80px; height: 80px; border-radius: 24px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-dim);
      display: flex; align-items: center; justify-content: center;
      color: var(--text-muted);
    }
    .v-empty h2 {
      font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700;
      color: var(--text-secondary); margin: 0;
    }
    .v-empty p { color: var(--text-muted); margin: 0; font-size: 14px; }

    /* ── TOP ROW ── */
    .v-top-row {
      flex: none;
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    }

    /* ── PANEL ── */
    .v-panel {
      background: var(--bg-panel);
      border: 1px solid var(--border-dim);
      border-radius: 14px;
      overflow: hidden;
      display: flex; flex-direction: column;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .v-panel-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-dim);
    }
    .v-panel-header-icon {
      width: 30px; height: 30px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-elevated);
      color: var(--text-secondary);
      flex-shrink: 0;
    }
    .v-panel-title {
      font-family: 'Syne', sans-serif; font-size: 12px;
      font-weight: 700; letter-spacing: 0.8px;
      color: var(--text-secondary); text-transform: uppercase;
    }
    .v-panel-badge {
      margin-left: auto;
      font-family: 'DM Mono', monospace;
      font-size: 11px; color: var(--text-muted);
      background: var(--bg-elevated);
      border: 1px solid var(--border-dim);
      padding: 2px 8px; border-radius: 6px;
    }

    /* ── CUSTOMER INFO ── */
    .v-info-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    .v-info-cell {
      padding: 16px 20px;
      border-right: 1px solid var(--border-dim);
      border-bottom: 1px solid var(--border-dim);
    }
    .v-info-cell:nth-child(2n) { border-right: none; }
    .v-info-cell:nth-last-child(-n+2) { border-bottom: none; }
    .v-info-label {
      display: flex; align-items: center; gap: 5px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.8px;
      text-transform: uppercase; color: var(--text-muted);
      margin-bottom: 5px;
    }
    .v-info-value {
      font-family: 'DM Sans', sans-serif;
      font-size: 15px; font-weight: 600;
      color: var(--text-primary);
      line-height: 1.3;
    }
    .v-info-value.mono {
      font-family: 'DM Mono', monospace;
      font-size: 13px; font-weight: 400;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
    }
    .v-info-sub {
      font-size: 11px; color: var(--text-muted); margin-top: 2px;
    }

    /* ── FINANCIAL SUMMARY ── */
    .v-fin-panel {
      display: flex; flex-direction: column;
      border-radius: 14px; overflow: hidden;
      border: 1px solid;
      position: relative;
    }
    .v-fin-panel.excess {
      background: linear-gradient(135deg, rgba(52,211,153,0.06) 0%, var(--bg-panel) 60%);
      border-color: rgba(52,211,153,0.2);
    }
    .v-fin-panel.shortage {
      background: linear-gradient(135deg, rgba(248,113,113,0.06) 0%, var(--bg-panel) 60%);
      border-color: rgba(248,113,113,0.2);
    }
    .v-fin-panel.neutral {
      background: var(--bg-panel);
      border-color: var(--border-mid);
    }

    .v-fin-header {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-dim);
      display: flex; align-items: center; gap: 8px;
    }
    .v-fin-label {
      font-family: 'Syne', sans-serif; font-size: 11px;
      font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
    }
    .v-fin-label.excess { color: var(--green); }
    .v-fin-label.shortage { color: var(--red); }
    .v-fin-label.neutral { color: var(--text-secondary); }

    .v-fin-body {
      flex: 1; padding: 20px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .v-fin-row {
      display: flex; align-items: flex-end; justify-content: space-between;
      gap: 8px;
    }
    .v-fin-metric {
      flex: 1; text-align: center;
    }
    .v-fin-metric-label {
      font-size: 10px; font-weight: 600; letter-spacing: 0.8px;
      text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;
    }
    .v-fin-metric-value {
      font-family: 'DM Mono', monospace;
      font-size: 20px; font-weight: 500;
      color: var(--text-primary);
    }
    .v-fin-operator {
      font-size: 24px; color: var(--text-muted);
      padding-bottom: 2px; flex-shrink: 0;
    }

    .v-fin-divider {
      height: 1px; background: var(--border-dim);
      margin: 16px 0;
    }

    .v-fin-result {
      text-align: center;
    }
    .v-fin-result-label {
      font-size: 11px; font-weight: 600; letter-spacing: 0.6px;
      text-transform: uppercase; margin-bottom: 8px;
    }
    .v-fin-result-label.excess { color: var(--green); }
    .v-fin-result-label.shortage { color: var(--red); }
    .v-fin-result-amount {
      font-family: 'Syne', sans-serif;
      font-size: 40px; font-weight: 800;
      letter-spacing: -1px; line-height: 1;
    }
    .v-fin-result-amount.excess { color: var(--green); }
    .v-fin-result-amount.shortage { color: var(--red); }

    /* ── TABLES ROW ── */
    .v-tables-row {
      flex: 1; min-height: 0;
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    }

    /* ── TABLE ── */
    .v-table-wrap {
      flex: 1; overflow: auto;
    }
    table.v-table {
      width: 100%; border-collapse: collapse;
    }
    table.v-table thead th {
      position: sticky; top: 0; z-index: 10;
      padding: 11px 16px;
      background: #f8f9fb;
      font-family: 'Syne', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
      text-transform: uppercase; color: var(--text-muted);
      border-bottom: 1px solid var(--border-dim);
      white-space: nowrap;
    }
    table.v-table tbody tr {
      transition: background 0.15s;
      border-bottom: 1px solid var(--border-dim);
    }
    table.v-table tbody tr:last-child { border-bottom: none; }
    table.v-table tbody tr:hover { background: var(--bg-hover); }
    table.v-table td {
      padding: 12px 16px;
      font-size: 13px;
      vertical-align: middle;
    }
    .v-table-name { font-weight: 500; color: var(--text-primary); }
    .v-table-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 9px; font-weight: 700; letter-spacing: 0.6px;
      text-transform: uppercase;
      padding: 2px 6px; border-radius: 4px;
      margin-left: 6px;
      background: rgba(52,211,153,0.1);
      color: var(--green);
      border: 1px solid rgba(52,211,153,0.25);
    }
    .v-table-qty {
      font-family: 'DM Mono', monospace;
      font-size: 13px; color: var(--text-muted);
      text-align: center;
    }
    .v-table-amount {
      font-family: 'DM Mono', monospace;
      font-size: 13px; font-weight: 500;
      text-align: right;
    }
    .v-table-amount.blue { color: #818cf8; }
    .v-table-amount.green { color: var(--green); }

    .v-table-date { color: var(--text-secondary); font-size: 12px; }
    .v-table-receipt {
      font-family: 'DM Mono', monospace;
      font-size: 12px; color: var(--accent);
      background: var(--accent-dim);
      border: 1px solid rgba(79,99,240,0.18);
      padding: 2px 7px; border-radius: 5px;
      letter-spacing: 0.3px;
    }
    .v-table-mode-primary { font-weight: 600; color: var(--text-primary); font-size: 13px; }
    .v-table-mode-sub {
      display: inline-block; margin-top: 3px;
      font-size: 9px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
      padding: 1px 6px; border-radius: 4px;
      background: var(--bg-elevated);
      color: var(--text-muted);
      border: 1px solid var(--border-dim);
    }

    table.v-table tfoot td {
      padding: 10px 16px;
      background: #f8f9fb;
      border-top: 1px solid var(--border-mid);
      font-family: 'DM Mono', monospace;
      font-size: 13px;
    }
    .tfoot-label {
      font-family: 'Syne', sans-serif; font-size: 10px;
      font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
      color: var(--text-muted); text-align: right;
    }

    /* ── EMPTY TABLE ── */
    .v-table-empty {
      height: 100%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 12px;
      color: var(--text-muted); padding: 40px;
    }
    .v-table-empty-icon {
      width: 56px; height: 56px; border-radius: 16px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-dim);
      display: flex; align-items: center; justify-content: center;
    }

    /* ── SIDEBAR ── */
    .v-sidebar {
      width: 280px; flex: none;
      display: flex; flex-direction: column;
      border-left: 1px solid var(--border-dim);
      background: var(--bg-surface);
      box-shadow: -1px 0 4px rgba(0,0,0,0.04);
    }
    .v-sidebar-header {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-dim);
      display: flex; align-items: center; justify-content: space-between;
    }
    .v-sidebar-title {
      font-family: 'Syne', sans-serif; font-size: 12px;
      font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
      color: var(--text-secondary);
      display: flex; align-items: center; gap: 8px;
    }
    .v-sidebar-title svg { color: var(--accent); }

    .v-clear-btn {
      display: flex; align-items: center; gap: 5px;
      background: none; border: 1px solid var(--border-dim);
      border-radius: 6px; padding: 5px 10px;
      color: var(--text-muted); cursor: pointer;
      font-family: 'Syne', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
      text-transform: uppercase; transition: all 0.2s;
    }
    .v-clear-btn:hover {
      border-color: var(--red);
      color: var(--red);
      background: var(--red-dim);
    }

    .v-calc-body {
      flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 12px;
      overflow: hidden;
    }

    .v-calc-label {
      font-family: 'Syne', sans-serif; font-size: 10px;
      font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
      color: var(--text-muted); margin-bottom: 6px;
    }

    .v-calc-input {
      width: 100%; padding: 12px 14px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-mid);
      border-radius: 10px;
      color: var(--text-primary);
      font-family: 'DM Mono', monospace;
      font-size: 18px; resize: none;
      outline: none; transition: border-color 0.2s, box-shadow 0.2s;
      min-height: 70px;
    }
    .v-calc-input::placeholder { color: var(--text-muted); font-size: 14px; }
    .v-calc-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-dim);
    }
    .v-calc-hint {
      font-size: 11px; color: var(--text-muted); text-align: right;
    }
    .v-calc-hint b { color: var(--text-secondary); }

    .v-calc-result-box {
      background: var(--bg-elevated);
      border: 1px solid var(--border-mid);
      border-radius: 10px; padding: 16px;
      display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    .v-calc-result-box::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--accent), #8b5cf6);
    }
    .v-calc-history {
      font-family: 'DM Mono', monospace;
      font-size: 11px; color: var(--text-muted);
      margin-bottom: 8px; text-align: right;
    }
    .v-calc-value {
      font-family: 'Syne', sans-serif;
      font-size: 34px; font-weight: 800;
      color: var(--accent); text-align: right;
      letter-spacing: -1px; word-break: break-all;
    }

    /* Spin animation */
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin { animation: spin 1s linear infinite; }

    /* Fade-in for data */
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    .v-top-row, .v-tables-row { animation: fadeIn 0.3s ease; }
  `}</style>
);

const Verify = ({ theme }) => {
  const [fileNumber, setFileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  
  const [reqData, setReqData] = useState(null);
  const [localHistory, setLocalHistory] = useState(null);
  const [reqToken, setReqToken] = useState(null);

  const [calcInput, setCalcInput] = useState("");
  const [calcResult, setCalcResult] = useState("0");
  const [calcHistory, setCalcHistory] = useState("");
  const calcInputRef = useRef(null);

  const REQ_API_URL = import.meta.env.VITE_REQ_API_URL || "http://localhost:5000/api";
  const LOCAL_API_URL = import.meta.env.VITE_API_URL;

  // On mount, check if we have a saved token, but don't assume connection is valid forever
  useEffect(() => {
    const savedToken = sessionStorage.getItem("rmsToken");
    if (savedToken) { 
        setReqToken(savedToken); 
        setConnectionStatus("connected"); // Optimistically set connected
    }
  }, []);

  const handleConnect = async () => {
    setConnectionStatus("connecting");
    const email = sessionStorage.getItem("userEmail");
    const password = sessionStorage.getItem("userPassword");
    
    if (!email || !password) { 
        setConnectionStatus("error"); 
        return; 
    }

    try {
      const response = await fetch(`${REQ_API_URL}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) throw new Error("Auth failed");

      const resData = await response.json();
      if (resData.success) {
        const token = resData.data?.accessToken || resData.token;
        if (token) { 
            setReqToken(token); 
            sessionStorage.setItem("rmsToken", token); 
            setConnectionStatus("connected"); 
        } else {
            setConnectionStatus("error");
        }
      } else {
          setConnectionStatus("error");
      }
    } catch { 
        setConnectionStatus("error"); 
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!fileNumber.trim()) return;
    
    setLoading(true); 
    setReqData(null); 
    setLocalHistory(null);
    
    const safeFileNumber = encodeURIComponent(fileNumber.trim());
    
    // --- 1. LOCAL SERVER FETCH ---
    const localFetchPromise = fetch(`${LOCAL_API_URL}/general-receipts/customer-history/${safeFileNumber}`)
        .then(res => {
            if(!res.ok) throw new Error("Local fetch failed");
            return res.json();
        });

    // --- 2. RMS SERVER FETCH ---
    let rmsFetchPromise = Promise.reject("Not Connected");
    
    if (connectionStatus === "connected" && reqToken) {
        rmsFetchPromise = fetch(`${REQ_API_URL}/portal/fetch-details/${safeFileNumber}`, {
             method: "GET", headers: { "Authorization": `Bearer ${reqToken}`, "Content-Type": "application/json" }
        }).then(async (res) => {
            if (res.status === 401 || res.status === 403) {
                // Token invalid - force disconnect
                setConnectionStatus("disconnected");
                sessionStorage.removeItem("rmsToken");
                setReqToken(null);
                throw new Error("Unauthorized");
            }
            if (!res.ok) throw new Error("RMS Error");
            const data = await res.json();
            return data.success ? data.data : null;
        });
    }

    // --- 3. EXECUTE IN PARALLEL ---
    const results = await Promise.allSettled([localFetchPromise, rmsFetchPromise]);

    const localResult = results[0];
    const rmsResult = results[1];

    if (localResult.status === 'fulfilled') {
        setLocalHistory(localResult.value);
    }

    if (rmsResult.status === 'fulfilled' && rmsResult.value) {
        setReqData(rmsResult.value);
    } else if (rmsResult.status === 'fulfilled' && !rmsResult.value) {
        setConnectionStatus("disconnected");
        sessionStorage.removeItem("rmsToken");
        setReqToken(null);
    } else if (rmsResult.status === 'rejected') {
        if (connectionStatus === 'connected' && rmsResult.reason !== "Unauthorized") {
            setConnectionStatus("disconnected");
            sessionStorage.removeItem("rmsToken");
            setReqToken(null);
        }
    }
    
    setLoading(false);
  };

  // Calculator
  const solveCalc = () => {
    try {
      // eslint-disable-next-line no-new-func
      const res = new Function('return ' + calcInput)();
      if (res !== undefined && !isNaN(res)) {
        setCalcHistory(calcInput); setCalcResult(res.toString()); setCalcInput("");
      }
    } catch { setCalcResult("Error"); }
  };
  const handleCalcChange = (e) => {
    if (/^[0-9+\-*/().\s]*$/.test(e.target.value)) setCalcInput(e.target.value);
  };
  const handleCalcKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); solveCalc(); }
  };
  const clearCalc = () => { setCalcInput(""); setCalcResult("0"); setCalcHistory(""); calcInputRef.current?.focus(); };

  // Financial Logic
  const totalCost = reqData ? Number(reqData.totalAmount) : 0;
  const totalPaid = localHistory ? Number(localHistory.totalPaid) : 0;
  
  // Only calculate difference if we have both, otherwise it's just N/A
  const netDiff = (reqData && localHistory) ? totalPaid - totalCost : 0;
  const isExcess = netDiff >= 0;
  const missingRMS = !reqData;

  return (
    <>
      <FontStyle />
      <div className="verify-root">

        {/* HEADER */}
        <header className="v-header">
          <div className="v-logo">
            <div className="v-logo-icon">
              <FileText size={16} color="white" />
            </div>
            <div className="v-logo-text">Statement<span>Check</span></div>
          </div>

          <div className="v-header-right">
            <form onSubmit={handleSearch} className="v-search-wrap">
              <input
                value={fileNumber}
                onChange={(e) => setFileNumber(e.target.value)}
                className="v-search-input"
                placeholder="Enter file number…"
              />
              <button type="submit" className="v-search-btn">
                {loading
                  ? <RefreshCw size={16} className="animate-spin" />
                  : <Search size={16} />}
              </button>
            </form>

            <button
              onClick={handleConnect}
              disabled={connectionStatus === 'connected' || connectionStatus === 'connecting'}
              className={`v-connect-btn ${connectionStatus === 'connected' ? 'connected' : connectionStatus === 'connecting' ? 'connecting' : 'disconnected'}`}
            >
              <div className={`status-dot ${connectionStatus === 'connecting' ? 'pulse' : ''}`} />
              {connectionStatus === 'connected' ? 'RMS Online'
                : connectionStatus === 'connecting' ? 'Connecting…'
                : 'Connect RMS'}
            </button>
          </div>
        </header>

        {/* BODY */}
        <div className="v-body">
          <main className="v-main">
            {/* Show content if EITHER source returned data */}
            {(reqData || localHistory) ? (
              <>
                {/* ROW 1 */}
                <div className="v-top-row">

                  {/* Customer Panel */}
                  <div className="v-panel">
                    <div className="v-panel-header">
                      <div className="v-panel-header-icon"><User size={15} /></div>
                      <span className="v-panel-title">Customer Information</span>
                      {!reqData && <span className="v-panel-badge text-red-500">Local Only</span>}
                    </div>
                    <div className="v-info-grid">
                      <div className="v-info-cell">
                        <div className="v-info-label"><User size={10} /> Name</div>
                        <div className="v-info-value">
                            {reqData?.header?.customerName || localHistory?.history?.[0]?.customer_name || "—"}
                        </div>
                      </div>
                      <div className="v-info-cell">
                        <div className="v-info-label"><Hash size={10} /> File No.</div>
                        <div className="v-info-value mono">
                            {reqData?.header?.fileNumber || fileNumber || "—"}
                        </div>
                      </div>
                      <div className="v-info-cell">
                        <div className="v-info-label"><Truck size={10} /> Vehicle</div>
                        <div className="v-info-value">
                            {reqData?.header?.model || localHistory?.history?.[0]?.model || "—"}
                        </div>
                        <div className="v-info-sub">{reqData?.header?.color || "—"}</div>
                      </div>
                      <div className="v-info-cell">
                        <div className="v-info-label"><Hash size={10} /> Chassis</div>
                        <div className="v-info-value mono">{reqData?.header?.chassisNumber || "—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className={`v-fin-panel ${missingRMS ? 'neutral' : isExcess ? 'excess' : 'shortage'}`}>
                    <div className="v-fin-header">
                      {missingRMS ? <WifiOff size={15} className="text-gray-400"/> : isExcess
                        ? <TrendingUp size={15} color="var(--green)" />
                        : <TrendingDown size={15} color="var(--red)" />}
                      
                      <span className={`v-fin-label ${missingRMS ? 'neutral' : isExcess ? 'excess' : 'shortage'}`}>
                        {missingRMS ? 'Partial Data (RMS Offline)' : `Financial Verification — ${isExcess ? 'Cleared' : 'Deficit'}`}
                      </span>
                    </div>
                    <div className="v-fin-body">
                      <div className="v-fin-row">
                        <div className="v-fin-metric">
                          <div className="v-fin-metric-label">Total Paid</div>
                          <div className="v-fin-metric-value">₹{totalPaid.toLocaleString()}</div>
                        </div>
                        <div className="v-fin-operator">−</div>
                        <div className="v-fin-metric">
                          <div className="v-fin-metric-label">Particulars (RMS)</div>
                          <div className="v-fin-metric-value">
                              {missingRMS ? <span className="text-gray-400">Offline</span> : `₹${totalCost.toLocaleString()}`}
                          </div>
                        </div>
                        <div className="v-fin-operator">=</div>
                        <div className="v-fin-metric">
                          <div className="v-fin-metric-label">Balance</div>
                          <div className="v-fin-metric-value" style={{ color: missingRMS ? 'var(--text-muted)' : isExcess ? 'var(--green)' : 'var(--red)' }}>
                            {missingRMS ? '—' : (isExcess ? '+' : '−') + `₹${Math.abs(netDiff).toLocaleString()}`}
                          </div>
                        </div>
                      </div>

                      <div className="v-fin-divider" />

                      <div className="v-fin-result">
                        <div className={`v-fin-result-label ${missingRMS ? 'neutral' : isExcess ? 'excess' : 'shortage'}`}>
                          {missingRMS ? 'Cannot Verify - Server Offline' : isExcess ? '✓ Excess Amount Leftover' : '⚠ Shortage — To Collect'}
                        </div>
                        <div className={`v-fin-result-amount ${missingRMS ? 'neutral' : isExcess ? 'excess' : 'shortage'}`}>
                          {missingRMS ? 'N/A' : (isExcess ? '+' : '−') + `₹${Math.abs(netDiff).toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROW 2: TABLES */}
                <div className="v-tables-row">

                  {/* Particulars */}
                  <div className="v-panel">
                    <div className="v-panel-header">
                      <div className="v-panel-header-icon"><FileCheck size={15} /></div>
                      <span className="v-panel-title">Particulars (RMS)</span>
                      {reqData && <span className="v-panel-badge">{reqData.particulars.length} items</span>}
                    </div>
                    <div className="v-table-wrap">
                      {reqData ? (
                          <table className="v-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Item Name</th>
                                <th style={{ textAlign: 'center', width: '60px' }}>Qty</th>
                                <th style={{ textAlign: 'right', width: '120px' }}>Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reqData.particulars.map((p, i) => (
                                <tr key={i}>
                                  <td>
                                    <span className="v-table-name">{p.particularName}</span>
                                    {p.isIssued && <span className="v-table-badge"><Zap size={8} />Issued</span>}
                                  </td>
                                  <td className="v-table-qty">{p.quantity}</td>
                                  <td className="v-table-amount blue">₹{p.amount.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={2} className="tfoot-label">Total Particulars</td>
                                <td className="v-table-amount blue" style={{ textAlign: 'right' }}>₹{totalCost.toLocaleString()}</td>
                              </tr>
                            </tfoot>
                          </table>
                      ) : (
                          <div className="v-table-empty">
                              <div className="v-table-empty-icon"><WifiOff size={24} /></div>
                              <span style={{ fontSize: '13px', fontWeight: 500 }}>RMS Server Offline</span>
                          </div>
                      )}
                    </div>
                  </div>

                  {/* Payments */}
                  <div className="v-panel">
                    <div className="v-panel-header">
                      <div className="v-panel-header-icon"><Wallet size={15} /></div>
                      <span className="v-panel-title">Payments (Local)</span>
                      <span className="v-panel-badge">{localHistory?.history.length || 0} records</span>
                    </div>
                    <div className="v-table-wrap">
                      {localHistory && localHistory.history.length > 0 ? (
                        <table className="v-table">
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', width: '100px' }}>Date</th>
                              <th style={{ textAlign: 'left', width: '110px' }}>Receipt No.</th>
                              <th style={{ textAlign: 'left' }}>Mode</th>
                              <th style={{ textAlign: 'right', width: '120px' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {localHistory.history.map((h, i) => (
                              <tr key={i}>
                                <td className="v-table-date">{new Date(h.date).toLocaleDateString()}</td>
                                <td>
                                  <span className="v-table-receipt">{h.receipt_no || '—'}</span>
                                </td>
                                <td>
                                  <div className="v-table-mode-primary">{h.payment_type}</div>
                                  <span className="v-table-mode-sub">{h.payment_mode}</span>
                                </td>
                                <td className="v-table-amount green">₹{Number(h.amount).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={3} className="tfoot-label">Total Received</td>
                              <td className="v-table-amount green" style={{ textAlign: 'right' }}>₹{totalPaid.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      ) : (
                        <div className="v-table-empty">
                          <div className="v-table-empty-icon"><CreditCard size={24} /></div>
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>No Payment Records Found</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="v-empty">
                <div className="v-empty-icon-wrap"><ArrowRightLeft size={34} /></div>
                <h2>Ready to Verify</h2>
                <p>Connect to the server, then search for a file number.</p>
              </div>
            )}
          </main>

          {/* SIDEBAR CALCULATOR */}
          <aside className="v-sidebar">
            <div className="v-sidebar-header">
              <span className="v-sidebar-title"><Calculator size={16} /> Quick Calc</span>
              <button onClick={clearCalc} className="v-clear-btn">
                <Trash2 size={11} /> Clear
              </button>
            </div>

            <div className="v-calc-body">
              <div>
                <div className="v-calc-label">Expression</div>
                <textarea
                  ref={calcInputRef}
                  value={calcInput}
                  onChange={handleCalcChange}
                  onKeyDown={handleCalcKeyDown}
                  placeholder="e.g. 45000 + 12500…"
                  rows={2}
                  className="v-calc-input"
                />
                <div className="v-calc-hint">Press <b>Enter</b> to evaluate</div>
              </div>

              <div>
                <div className="v-calc-label">Result</div>
                <div className="v-calc-result-box">
                  {calcHistory && <div className="v-calc-history">{calcHistory} =</div>}
                  <div className="v-calc-value">
                    {isNaN(Number(calcResult)) ? calcResult : Number(calcResult).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};

export default Verify;