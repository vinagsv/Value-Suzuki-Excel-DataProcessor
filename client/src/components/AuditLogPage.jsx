import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  History, Search, RefreshCw, ChevronDown, ChevronUp,
  ShieldCheck, AlertTriangle, PlusCircle, XCircle,
  Filter, Download, Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL;

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (ist) => {
  if (!ist) return '—';
  const [d, t] = ist.split(' ');
  if (!d) return ist;
  const [y, m, dd] = d.split('-');
  return `${dd}-${m}-${y}  ${t || ''}`;
};

const ACTION_META = {
  CREATED:   { label: 'Created',   icon: PlusCircle,     cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  EDITED:    { label: 'Edited',    icon: ShieldCheck,    cls: 'text-blue-600 bg-blue-50 border-blue-200' },
  CANCELLED: { label: 'Cancelled', icon: XCircle,        cls: 'text-red-600 bg-red-50 border-red-200' },
};

const ActionBadge = ({ action }) => {
  const meta = ACTION_META[action] || { label: action, icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50 border-amber-200' };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${meta.cls}`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
};

// ── single log row (expandable) ───────────────────────────────────────────────
const LogRow = ({ log, isDark }) => {
  const [open, setOpen] = useState(false);

  let fields = {};
  try { fields = typeof log.changed_fields === 'string' ? JSON.parse(log.changed_fields) : (log.changed_fields || {}); } catch {}

  const isCreated  = log.action === 'CREATED';
  const fieldEntries = isCreated ? [] : Object.entries(fields);
  const hasChanges   = fieldEntries.length > 0;

  const border  = isDark ? 'border-gray-700' : 'border-gray-100';
  const bg      = isDark ? 'bg-gray-800' : 'bg-white';
  const bgHover = isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50';
  const textPri = isDark ? 'text-gray-100' : 'text-gray-900';
  const textMut = isDark ? 'text-gray-400' : 'text-gray-500';
  const expandBg = isDark ? 'bg-gray-900/60' : 'bg-gray-50';

  return (
    <div className={`border-b ${border} ${bg} transition-colors`}>
      {/* Main row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${bgHover} transition-colors`}
        onClick={() => (isCreated || hasChanges) && setOpen(v => !v)}
      >
        {/* Receipt No */}
        <div className="w-24 flex-shrink-0">
          <span className={`font-mono text-xs font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            #{log.receipt_no}
          </span>
        </div>

        {/* Action badge */}
        <div className="w-24 flex-shrink-0">
          <ActionBadge action={log.action} />
        </div>

        {/* Changed by */}
        <div className={`flex-1 min-w-0 text-xs ${textMut} truncate`}>
          {log.changed_by_email || 'unknown'}
        </div>

        {/* Timestamp */}
        <div className={`w-40 flex-shrink-0 text-xs font-mono ${textMut}`}>
          {fmtTime(log.changed_at_ist)}
        </div>

        {/* Changed fields count */}
        <div className={`w-20 flex-shrink-0 text-xs text-right ${textMut}`}>
          {isCreated ? (
            <span className="italic">initial</span>
          ) : hasChanges ? (
            <span className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              {fieldEntries.length} field{fieldEntries.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="italic">no diff</span>
          )}
        </div>

        {/* Expand toggle */}
        <div className="w-6 flex-shrink-0 flex justify-end">
          {(isCreated || hasChanges) ? (
            open ? <ChevronUp size={14} className={textMut} /> : <ChevronDown size={14} className={textMut} />
          ) : null}
        </div>
      </div>

      {/* Expanded diff */}
      {open && (
        <div className={`px-6 pb-4 pt-2 ${expandBg}`}>
          {isCreated ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(fields).map(([k, v]) => (
                <div key={k} className={`rounded-lg p-2 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${textMut}`}>{k.replace(/_/g, ' ')}</div>
                  <div className={`text-xs font-medium truncate ${textPri}`} title={v != null ? String(v) : '—'}>
                    {v != null && String(v) !== '' ? String(v) : <span className="italic opacity-40">empty</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {fieldEntries.map(([field, diff]) => (
                <div key={field} className={`flex items-start gap-3 rounded-lg p-2 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`w-28 flex-shrink-0 text-[10px] font-bold uppercase tracking-wide pt-0.5 ${textMut}`}>
                    {field.replace(/_/g, ' ')}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-mono line-through ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
                      {diff.from != null && diff.from !== '' ? diff.from : <em className="not-italic opacity-50">empty</em>}
                    </span>
                    <span className={`text-xs ${textMut}`}>→</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}`}>
                      {diff.to != null && diff.to !== '' ? diff.to : <em className="not-italic opacity-50">empty</em>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const AuditLogPage = ({ theme }) => {
  const isDark = theme === 'dark';

  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [searchReceipt, setSearchReceipt] = useState('');
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [page, setPage]               = useState(1);
  const PER_PAGE = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 500 });
      if (fromDate)      params.set('from', fromDate);
      if (toDate)        params.set('to',   toDate + 'T23:59:59');
      if (searchReceipt) params.set('receipt_no', searchReceipt.trim());

      const res  = await fetch(`${API_URL}/audit-log?${params}`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (e) {
      console.error('Audit fetch error', e);
    }
    setLoading(false);
  }, [fromDate, toDate, searchReceipt]);

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter(l => actionFilter === 'ALL' || l.action === actionFilter);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Export to Excel
  const handleExport = () => {
    const rows = filtered.map(l => {
      let fields = {};
      try { fields = typeof l.changed_fields === 'string' ? JSON.parse(l.changed_fields) : (l.changed_fields || {}); } catch {}
      return {
        'Receipt No':  l.receipt_no,
        'Action':      l.action,
        'Changed By':  l.changed_by_email || 'unknown',
        'Timestamp (IST)': fmtTime(l.changed_at_ist),
        'Changed Fields': Object.keys(fields).join(', '),
        'Details':     JSON.stringify(fields)
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AuditLog');
    XLSX.writeFile(wb, `Receipt_AuditLog_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── theme tokens ──────────────────────────────────────────────────────────
  const pageBg   = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg   = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
    ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`;
  const textPri  = isDark ? 'text-white' : 'text-gray-900';
  const textMut  = isDark ? 'text-gray-400' : 'text-gray-500';
  const thCls    = `px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400 bg-gray-900/50' : 'text-gray-500 bg-gray-50'}`;

  return (
    <div className={`min-h-full ${pageBg} p-4 md:p-6`}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <History size={18} color="white" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${textPri}`}>Receipt Audit Log</h1>
            <p className={`text-xs mt-0.5 ${textMut}`}>All edits, cancellations and creations • Paused 19:00–19:20 IST</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={fetchLogs}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-colors
              ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
          >
            <Download size={13} /> Export XLSX
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-xl border p-4 mb-4 ${cardBg}`}>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className={textMut} />
          <span className={`text-xs font-bold uppercase tracking-wide ${textMut}`}>Filters</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Receipt No search */}
          <div className="relative">
            <input
              value={searchReceipt}
              onChange={e => setSearchReceipt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogs()}
              placeholder="Receipt #..."
              className={`${inputCls} w-36 pl-8`}
            />
            <Search size={13} className={`absolute left-2.5 top-2.5 ${textMut}`} />
          </div>

          {/* Date range */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
            <Clock size={12} className={textMut} />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className={`bg-transparent text-xs border-none outline-none ${isDark ? 'text-white' : 'text-gray-900'}`} />
            <span className={`text-[10px] ${textMut}`}>→</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className={`bg-transparent text-xs border-none outline-none ${isDark ? 'text-white' : 'text-gray-900'}`} />
          </div>

          {/* Action filter buttons */}
          <div className={`flex rounded-lg border overflow-hidden ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
            {['ALL', 'CREATED', 'EDITED', 'CANCELLED'].map(a => (
              <button key={a}
                onClick={() => { setActionFilter(a); setPage(1); }}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors border-r last:border-r-0
                  ${isDark ? 'border-gray-600' : 'border-gray-300'}
                  ${actionFilter === a
                    ? (isDark ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white')
                    : (isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-50')
                  }`}
              >
                {a}
              </button>
            ))}
          </div>

          <button
            onClick={fetchLogs}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className={`rounded-xl border p-3 mb-4 flex flex-wrap gap-4 ${cardBg}`}>
        {[
          { label: 'Total Entries', value: filtered.length, color: 'text-blue-600' },
          { label: 'Created',    value: filtered.filter(l => l.action === 'CREATED').length,   color: 'text-emerald-600' },
          { label: 'Edited',     value: filtered.filter(l => l.action === 'EDITED').length,    color: 'text-blue-600' },
          { label: 'Cancelled',  value: filtered.filter(l => l.action === 'CANCELLED').length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</span>
            <span className={`text-xs ${textMut}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
        {/* Column headers */}
        <div className={`flex items-center gap-3 px-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`${thCls} w-24 flex-shrink-0`}>Receipt #</div>
          <div className={`${thCls} w-24 flex-shrink-0`}>Action</div>
          <div className={`${thCls} flex-1`}>Changed By</div>
          <div className={`${thCls} w-40 flex-shrink-0`}>Timestamp (IST)</div>
          <div className={`${thCls} w-20 flex-shrink-0 text-right`}>Fields</div>
          <div className={`${thCls} w-6 flex-shrink-0`}></div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={20} className="animate-spin text-blue-500" />
            <span className={`text-sm ${textMut}`}>Loading audit entries…</span>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <History size={32} className={textMut} />
            <span className={`text-sm ${textMut}`}>No audit entries found for these filters.</span>
          </div>
        ) : (
          paginated.map(log => (
            <LogRow key={log.id} log={log} isDark={isDark} />
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <span className={`text-xs ${textMut}`}>
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                  ${page === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                  ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                ← Prev
              </button>
              <span className={`px-3 py-1.5 text-xs font-mono ${textMut}`}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                  ${page === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                  ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;