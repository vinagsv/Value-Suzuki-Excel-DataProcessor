// import React, { useState } from 'react';
// import { FileCode, Play, CheckCircle, AlertCircle, Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
// import { processFileClientSide as processCSI } from '../TallyImport/CSIBills';
// import { processBCFileClientSide as processBC } from '../TallyImport/BcBills';
// import { processVMAFileClientSide as processVMA } from '../TallyImport/VmaBills';

// const TAB_CONFIG = {
//   CSI: { label: 'CSI', color: '#3b82f6', glow: 'rgba(59,130,246,0.3)' },
//   BC:  { label: 'BC',  color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
//   VMA: { label: 'VMA', color: '#10b981', glow: 'rgba(16,185,129,0.3)' },
// };

// const XmlGenerator = ({ theme }) => {
//   const isDark = theme === 'dark';
//   const [inputFile, setInputFile] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [activeTab, setActiveTab] = useState('CSI');
//   const [dragOver, setDragOver] = useState(false);

//   const [tabData, setTabData] = useState({
//     CSI: { fromDate: '', toDate: '', result: null, xmlData: null, error: null },
//     BC:  { fromDate: '', toDate: '', result: null, xmlData: null, error: null },
//     VMA: { fromDate: '', toDate: '', result: null, xmlData: null, error: null }
//   });

//   const handleFileUpload = (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       setInputFile(file);
//       setTabData(prev => {
//         const newState = { ...prev };
//         Object.keys(newState).forEach(key => {
//           newState[key] = { ...newState[key], result: null, xmlData: null, error: null };
//         });
//         return newState;
//       });
//     }
//   };

//   const handleDrop = (e) => {
//     e.preventDefault();
//     setDragOver(false);
//     const file = e.dataTransfer.files[0];
//     if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
//       setInputFile(file);
//       setTabData(prev => {
//         const newState = { ...prev };
//         Object.keys(newState).forEach(key => {
//           newState[key] = { ...newState[key], result: null, xmlData: null, error: null };
//         });
//         return newState;
//       });
//     }
//   };

//   const updateActiveTab = (field, value) => {
//     setTabData(prev => ({
//       ...prev,
//       [activeTab]: { ...prev[activeTab], [field]: value }
//     }));
//   };

//   const handleGenerate = async () => {
//     if (!inputFile) {
//       updateActiveTab('error', 'Please upload an Excel file first.');
//       return;
//     }
//     setLoading(true);
//     updateActiveTab('error', null);
//     updateActiveTab('result', null);
//     updateActiveTab('xmlData', null);

//     const currentData = tabData[activeTab];
//     const formattedFromDate = currentData.fromDate ? currentData.fromDate.replace(/-/g, '') : null;
//     const formattedToDate = currentData.toDate ? currentData.toDate.replace(/-/g, '') : null;

//     try {
//       let data;
//       if (activeTab === 'CSI') data = await processCSI(inputFile, formattedFromDate, formattedToDate);
//       else if (activeTab === 'BC') data = await processBC(inputFile, formattedFromDate, formattedToDate);
//       else if (activeTab === 'VMA') data = await processVMA(inputFile, formattedFromDate, formattedToDate);

//       updateActiveTab('result', {
//         createdCount: data.createdCount,
//         cancelledCount: data.cancelledCount,
//         skippedCount: data.skippedCount
//       });
//       updateActiveTab('xmlData', data.xmlData);
//     } catch (err) {
//       updateActiveTab('error', err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDownload = () => {
//     const xmlData = tabData[activeTab].xmlData;
//     if (!xmlData) return;
//     const blob = new Blob([xmlData], { type: 'application/xml' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `${activeTab}-Bills_Import.xml`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
//   };

//   const currentData = tabData[activeTab];
//   const activeColor = TAB_CONFIG[activeTab].color;
//   const activeGlow = TAB_CONFIG[activeTab].glow;

//   const bg = isDark ? '#0f1117' : '#f5f7fa';
//   const card = isDark ? '#1a1d27' : '#ffffff';
//   const border = isDark ? '#2a2d3e' : '#e2e8f0';
//   const text = isDark ? '#e2e8f0' : '#1a202c';
//   const muted = isDark ? '#6b7280' : '#64748b';
//   const inputBg = isDark ? '#111318' : '#f8fafc';

//   return (
//     <div style={{ minHeight: '100vh', background: bg, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: '40px 16px' }}>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        
//         .tab-btn { transition: all 0.2s ease; position: relative; }
//         .tab-btn::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 0; height: 2px; border-radius: 2px; transition: all 0.25s ease; }
//         .tab-btn.active::after { width: 40px; }
        
//         .date-input::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; filter: ${isDark ? 'invert(1)' : 'none'}; }
        
//         .stat-card { transition: transform 0.15s ease; }
//         .stat-card:hover { transform: translateY(-2px); }

//         .process-btn { transition: all 0.2s ease; }
//         .process-btn:hover:not(:disabled) { transform: translateY(-1px); }
//         .process-btn:active:not(:disabled) { transform: translateY(0); }

//         .upload-zone { transition: all 0.2s ease; }
        
//         @keyframes spin { to { transform: rotate(360deg); } }
//         @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
//         .fade-in { animation: fadeIn 0.3s ease forwards; }
        
//         .pulse-dot { width: 8px; height: 8px; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; }
//         @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
//       `}</style>

//       <div style={{ maxWidth: 760, margin: '0 auto' }}>

//         {/* ── Header ── */}
//         <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
//           <div style={{
//             width: 52, height: 52, borderRadius: 14,
//             background: `linear-gradient(135deg, ${activeColor}, ${activeColor}99)`,
//             display: 'flex', alignItems: 'center', justifyContent: 'center',
//             boxShadow: `0 4px 20px ${activeGlow}`,
//             transition: 'all 0.3s ease',
//           }}>
//             <FileCode size={26} color="#fff" />
//           </div>
//           <div>
//             <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: text, letterSpacing: '-0.5px', fontFamily: "'DM Sans', sans-serif" }}>
//               Tally XML Generator
//             </h1>
//             <p style={{ margin: '3px 0 0', fontSize: 14, color: muted, fontWeight: 400 }}>
//               Upload your Daybook file · Extract CSI, BC & VMA bills
//             </p>
//           </div>
//         </div>

//         {/* ── File Upload ── */}
//         <label
//           className="upload-zone"
//           onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
//           onDragLeave={() => setDragOver(false)}
//           onDrop={handleDrop}
//           style={{
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'space-between',
//             gap: 16,
//             padding: '20px 24px',
//             borderRadius: 16,
//             border: `2px dashed ${inputFile ? activeColor : dragOver ? activeColor : border}`,
//             background: inputFile
//               ? `${activeColor}0d`
//               : dragOver
//                 ? `${activeColor}08`
//                 : card,
//             marginBottom: 28,
//             cursor: 'pointer',
//             boxShadow: inputFile ? `0 0 0 4px ${activeGlow}` : '0 1px 4px rgba(0,0,0,0.06)',
//           }}
//         >
//           <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
//             <div style={{
//               width: 44, height: 44, borderRadius: 12,
//               background: inputFile ? `${activeColor}20` : isDark ? '#2a2d3e' : '#f1f5f9',
//               display: 'flex', alignItems: 'center', justifyContent: 'center',
//             }}>
//               <FileSpreadsheet size={22} color={inputFile ? activeColor : muted} />
//             </div>
//             <div>
//               <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: text }}>
//                 {inputFile ? inputFile.name : 'Upload Daybook Excel File'}
//               </p>
//               <p style={{ margin: '2px 0 0', fontSize: 12.5, color: muted }}>
//                 {inputFile ? 'File ready · Click to replace' : 'Drag & drop or click to browse · .xlsx, .xls'}
//               </p>
//             </div>
//           </div>
//           <div style={{
//             display: 'flex', alignItems: 'center', gap: 7,
//             padding: '9px 18px', borderRadius: 10, flexShrink: 0,
//             background: inputFile ? `${activeColor}18` : isDark ? '#2a2d3e' : '#f1f5f9',
//             color: inputFile ? activeColor : muted,
//             fontWeight: 600, fontSize: 13,
//           }}>
//             <UploadCloud size={15} />
//             {inputFile ? 'Replace' : 'Browse'}
//           </div>
//           <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
//         </label>

//         {/* ── Tabs ── */}
//         <div style={{ display: 'flex', gap: 6, marginBottom: -1, position: 'relative', zIndex: 1 }}>
//           {['CSI', 'BC', 'VMA'].map((type) => {
//             const cfg = TAB_CONFIG[type];
//             const isActive = activeTab === type;
//             const done = tabData[type].result;
//             return (
//               <button
//                 key={type}
//                 className={`tab-btn${isActive ? ' active' : ''}`}
//                 onClick={() => setActiveTab(type)}
//                 style={{
//                   flex: 1, padding: '13px 10px',
//                   borderRadius: '12px 12px 0 0',
//                   border: `1.5px solid ${isActive ? border : 'transparent'}`,
//                   borderBottom: isActive ? `1.5px solid ${card}` : `1.5px solid ${border}`,
//                   background: isActive ? card : 'transparent',
//                   color: isActive ? cfg.color : muted,
//                   fontWeight: isActive ? 700 : 500,
//                   fontSize: 14.5,
//                   cursor: 'pointer',
//                   fontFamily: "'DM Sans', sans-serif",
//                   display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
//                 }}
//               >
//                 <span style={{
//                   width: 6, height: 6, borderRadius: '50%',
//                   background: isActive ? cfg.color : 'transparent',
//                   border: `2px solid ${isActive ? cfg.color : muted}`,
//                   flexShrink: 0, transition: 'all 0.2s',
//                 }} />
//                 {type} Bills
//                 {done && (
//                   <span style={{
//                     fontSize: 10, padding: '2px 7px', borderRadius: 20,
//                     background: `${cfg.color}20`, color: cfg.color,
//                     fontWeight: 700, letterSpacing: '0.3px',
//                   }}>✓</span>
//                 )}
//               </button>
//             );
//           })}
//         </div>

//         {/* ── Tab Panel ── */}
//         <div style={{
//           background: card,
//           border: `1.5px solid ${border}`,
//           borderRadius: `0 12px 16px 16px`,
//           padding: '28px 28px 28px',
//           boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.07)',
//         }}>

//           {/* Date Row */}
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
//             {[['fromDate', 'From Date'], ['toDate', 'To Date']].map(([field, label]) => (
//               <div key={field}>
//                 <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
//                   {label}
//                 </label>
//                 <input
//                   type="date"
//                   value={currentData[field]}
//                   onChange={(e) => updateActiveTab(field, e.target.value)}
//                   className="date-input"
//                   style={{
//                     width: '100%', boxSizing: 'border-box',
//                     padding: '11px 14px', borderRadius: 10,
//                     border: `1.5px solid ${border}`,
//                     background: inputBg, color: text,
//                     fontSize: 14.5, fontFamily: "'DM Mono', monospace",
//                     outline: 'none', transition: 'border 0.2s',
//                   }}
//                   onFocus={(e) => e.target.style.borderColor = activeColor}
//                   onBlur={(e) => e.target.style.borderColor = border}
//                 />
//               </div>
//             ))}
//           </div>

//           {/* Process Button */}
//           <button
//             className="process-btn"
//             onClick={handleGenerate}
//             disabled={loading || !inputFile}
//             style={{
//               width: '100%', padding: '14px',
//               borderRadius: 12, border: 'none',
//               background: (!loading && inputFile)
//                 ? `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`
//                 : isDark ? '#2a2d3e' : '#e2e8f0',
//               color: (!loading && inputFile) ? '#fff' : muted,
//               fontWeight: 700, fontSize: 15.5,
//               cursor: (!loading && inputFile) ? 'pointer' : 'not-allowed',
//               display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
//               boxShadow: (!loading && inputFile) ? `0 4px 18px ${activeGlow}` : 'none',
//               fontFamily: "'DM Sans', sans-serif",
//             }}
//           >
//             {loading ? (
//               <>
//                 <div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
//                 Processing {activeTab} Bills…
//               </>
//             ) : (
//               <>
//                 <Play size={18} fill="currentColor" />
//                 Process {activeTab} Bills
//               </>
//             )}
//           </button>

//           {/* Result */}
//           {currentData.result && (
//             <div className="fade-in" style={{
//               marginTop: 22,
//               borderRadius: 14,
//               border: `1.5px solid ${activeColor}40`,
//               background: `${activeColor}0a`,
//               overflow: 'hidden',
//             }}>
//               {/* Top strip */}
//               <div style={{
//                 padding: '14px 20px',
//                 display: 'flex', alignItems: 'center', justifyContent: 'space-between',
//                 borderBottom: `1px solid ${activeColor}20`,
//               }}>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
//                   <CheckCircle size={18} color={activeColor} />
//                   <span style={{ fontWeight: 700, fontSize: 14.5, color: activeColor }}>
//                     {activeTab} Processing Complete
//                   </span>
//                 </div>
//                 <button
//                   onClick={handleDownload}
//                   style={{
//                     display: 'flex', alignItems: 'center', gap: 7,
//                     padding: '8px 18px', borderRadius: 9, border: 'none',
//                     background: activeColor, color: '#fff',
//                     fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
//                     fontFamily: "'DM Sans', sans-serif",
//                     boxShadow: `0 2px 10px ${activeGlow}`,
//                     transition: 'opacity 0.15s',
//                   }}
//                   onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
//                   onMouseOut={e => e.currentTarget.style.opacity = '1'}
//                 >
//                   <Download size={15} /> Download XML
//                 </button>
//               </div>

//               {/* Stats */}
//               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
//                 {[
//                   { emoji: '✅', label: 'Valid', value: currentData.result.createdCount, accent: '#10b981' },
//                   { emoji: '❌', label: 'Cancelled', value: currentData.result.cancelledCount, accent: '#ef4444' },
//                   { emoji: '⏭️', label: 'Skipped', value: currentData.result.skippedCount, accent: '#f59e0b' },
//                 ].map((s, i) => (
//                   <div key={i} className="stat-card" style={{
//                     padding: '16px 20px',
//                     borderRight: i < 2 ? `1px solid ${activeColor}20` : 'none',
//                     textAlign: 'center',
//                   }}>
//                     <div style={{ fontSize: 22, fontWeight: 800, color: s.accent, fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>
//                       {s.value}
//                     </div>
//                     <div style={{ fontSize: 11.5, color: muted, fontWeight: 500, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
//                       {s.label}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Error */}
//           {currentData.error && (
//             <div className="fade-in" style={{
//               marginTop: 22, padding: '14px 18px',
//               borderRadius: 12,
//               border: '1.5px solid #ef444440',
//               background: isDark ? '#ef444410' : '#fef2f2',
//               display: 'flex', alignItems: 'flex-start', gap: 12,
//             }}>
//               <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
//               <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: isDark ? '#fca5a5' : '#b91c1c', lineHeight: 1.5 }}>
//                 {currentData.error}
//               </p>
//             </div>
//           )}
//         </div>

//         {/* Footer note */}
//         <p style={{ textAlign: 'center', marginTop: 24, fontSize: 18, color:"#ef4444" }}>
//           ⚠️ This tool must be used with high caution. Always review generated data files before importing into Tally.All Ledgers and entries must be exact. make sure to take Tally data backup before importing.
//         </p>
//       </div>
//     </div>
//   );
// };

// export default XmlGenerator;

import React, { useState } from 'react';
import { FileCode, Play, CheckCircle, AlertCircle, Download, FileSpreadsheet, UploadCloud, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { processFileClientSide as processCSI } from '../TallyImport/CSIBills';
import { processBCFileClientSide as processBC } from '../TallyImport/BcBills';
import { processVMAFileClientSide as processVMA } from '../TallyImport/VmaBills';
import { processJournalClientSide as processJournal } from '../TallyImport/JournalEntries';

const TAB_CONFIG = {
  CSI:     { label: 'CSI',     color: '#3b82f6', glow: 'rgba(59,130,246,0.3)' },
  BC:      { label: 'BC',      color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
  VMA:     { label: 'VMA',     color: '#10b981', glow: 'rgba(16,185,129,0.3)' },
  JOURNAL: { label: 'JOURNAL', color: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
};

const XmlGenerator = ({ theme }) => {
  const isDark = theme === 'dark';
  const [inputFile, setInputFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('CSI');
  const [dragOver, setDragOver] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  const [tabData, setTabData] = useState({
    CSI:     { fromDate: '', toDate: '', result: null, xmlData: null, error: null },
    BC:      { fromDate: '', toDate: '', result: null, xmlData: null, error: null },
    VMA:     { fromDate: '', toDate: '', result: null, xmlData: null, error: null },
    JOURNAL: { date: new Date().toISOString().split('T')[0], batchSize: '10', creditLedger: '', result: null, xmlData: null, error: null }
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setInputFile(file);
      setTabData(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(key => {
          newState[key] = { ...newState[key], result: null, xmlData: null, error: null };
        });
        return newState;
      });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setInputFile(file);
      setTabData(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(key => {
          newState[key] = { ...newState[key], result: null, xmlData: null, error: null };
        });
        return newState;
      });
    }
  };

  const updateActiveTab = (field, value) => {
    setTabData(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: value }
    }));
  };

  const handleDownloadTemplate = (type) => {
    let headers = [];
    let sheetName = "Sheet1";

    switch (type) {
      case 'CSI':
        headers = ['DATE', 'CSI BILLS NUMBER', 'MODE OF PAYMENT', 'TOTAL', 'NARRATION'];
        sheetName = "CSI BILLS";
        break;
      case 'BC':
        headers = ['DATE', 'BC BILLS NO', 'MODE OF PAYMENT', 'TAX AMT', 'LABOUR CHRGS', 'TOTAL', 'NARRATION'];
        sheetName = "BC AND VMA BILLS";
        break;
      case 'VMA':
        headers = ['DATE', 'VMA BILL', 'VMA PAYMENT', 'VMA AMOUNT', 'VMA NARRATION'];
        sheetName = "BC AND VMA BILLS";
        break;
      case 'JOURNAL':
        headers = ['LEDGER', 'AMOUNT'];
        sheetName = "JOURNAL";
        break;
      default:
        return;
    }

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    
    // Auto-size columns slightly for better visibility
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 15) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${type}_Template.xlsx`);
    setTemplateDropdownOpen(false);
  };

  const handleGenerate = async () => {
    if (!inputFile) {
      updateActiveTab('error', 'Please upload an Excel file first.');
      return;
    }
    setLoading(true);
    updateActiveTab('error', null);
    updateActiveTab('result', null);
    updateActiveTab('xmlData', null);

    const currentData = tabData[activeTab];

    try {
      let data;
      
      if (activeTab === 'JOURNAL') {
        data = await processJournal(
          inputFile, 
          currentData.date, 
          currentData.batchSize, 
          currentData.creditLedger
        );
        updateActiveTab('result', {
          batchCount: data.createdCount,
          entryCount: data.entryCount,
          skippedCount: data.skippedCount,
          batchTotals: data.batchTotals // Store totals from API
        });
      } else {
        const formattedFromDate = currentData.fromDate ? currentData.fromDate.replace(/-/g, '') : null;
        const formattedToDate = currentData.toDate ? currentData.toDate.replace(/-/g, '') : null;

        if (activeTab === 'CSI') data = await processCSI(inputFile, formattedFromDate, formattedToDate);
        else if (activeTab === 'BC') data = await processBC(inputFile, formattedFromDate, formattedToDate);
        else if (activeTab === 'VMA') data = await processVMA(inputFile, formattedFromDate, formattedToDate);

        updateActiveTab('result', {
          createdCount: data.createdCount,
          cancelledCount: data.cancelledCount,
          skippedCount: data.skippedCount
        });
      }

      updateActiveTab('xmlData', data.xmlData);
    } catch (err) {
      updateActiveTab('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const xmlData = tabData[activeTab].xmlData;
    if (!xmlData) return;
    const blob = new Blob([xmlData], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab === 'JOURNAL' 
        ? `Tally_Import_Journal_${tabData.JOURNAL.date.replace(/-/g, '')}.xml` 
        : `${activeTab}-Bills_Import.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentData = tabData[activeTab];
  const activeColor = TAB_CONFIG[activeTab].color;
  const activeGlow = TAB_CONFIG[activeTab].glow;

  const bg = isDark ? '#0f1117' : '#f5f7fa';
  const card = isDark ? '#1a1d27' : '#ffffff';
  const border = isDark ? '#2a2d3e' : '#e2e8f0';
  const text = isDark ? '#e2e8f0' : '#1a202c';
  const muted = isDark ? '#6b7280' : '#64748b';
  const inputBg = isDark ? '#111318' : '#f8fafc';

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: '40px 16px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        
        .tab-btn { transition: all 0.2s ease; position: relative; }
        .tab-btn::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 0; height: 2px; border-radius: 2px; transition: all 0.25s ease; }
        .tab-btn.active::after { width: 40px; }
        
        .custom-input::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; filter: ${isDark ? 'invert(1)' : 'none'}; }
        
        .stat-card { transition: transform 0.15s ease; }
        .stat-card:hover { transform: translateY(-2px); }

        .process-btn { transition: all 0.2s ease; }
        .process-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .process-btn:active:not(:disabled) { transform: translateY(0); }

        .upload-zone { transition: all 0.2s ease; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.2s ease forwards; }
        
        .pulse-dot { width: 8px; height: 8px; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
      `}</style>

      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: `linear-gradient(135deg, ${activeColor}, ${activeColor}99)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 20px ${activeGlow}`,
              transition: 'all 0.3s ease',
            }}>
              <FileCode size={26} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: text, letterSpacing: '-0.5px', fontFamily: "'DM Sans', sans-serif" }}>
                Tally XML Generator
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: 14, color: muted, fontWeight: 400 }}>
                Upload your Daybook file · Extract CSI, BC, VMA & Journal Entries
              </p>
            </div>
          </div>

          {/* ── Templates Dropdown ── */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 10,
                background: templateDropdownOpen ? (isDark ? '#374151' : '#cbd5e1') : (isDark ? '#2a2d3e' : '#e2e8f0'),
                color: text, border: 'none', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.2s'
              }}
            >
              <Download size={16} />
              Sample Formats
              <ChevronDown size={16} style={{ transition: 'transform 0.2s', transform: templateDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
            </button>
            
            {templateDropdownOpen && (
              <div className="fade-in" style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 220, background: card, border: `1px solid ${border}`,
                borderRadius: 12, padding: 6, zIndex: 50,
                boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.1)'
              }}>
                {['CSI', 'BC', 'VMA', 'JOURNAL'].map(type => (
                  <button
                    key={type}
                    onClick={() => handleDownloadTemplate(type)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      border: 'none', background: activeTab === type ? `${TAB_CONFIG[type].color}15` : 'transparent',
                      color: activeTab === type ? TAB_CONFIG[type].color : text,
                      fontWeight: 600, fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
                      fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s'
                    }}
                    onMouseOver={e => { if (activeTab !== type) e.currentTarget.style.background = isDark ? '#2a2d3e' : '#f1f5f9'; }}
                    onMouseOut={e => { if (activeTab !== type) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span>{type} Template</span>
                    {activeTab === type && <CheckCircle size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── File Upload ── */}
        <label
          className="upload-zone"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '20px 24px',
            borderRadius: 16,
            border: `2px dashed ${inputFile ? activeColor : dragOver ? activeColor : border}`,
            background: inputFile
              ? `${activeColor}0d`
              : dragOver
                ? `${activeColor}08`
                : card,
            marginBottom: 28,
            cursor: 'pointer',
            boxShadow: inputFile ? `0 0 0 4px ${activeGlow}` : '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: inputFile ? `${activeColor}20` : isDark ? '#2a2d3e' : '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileSpreadsheet size={22} color={inputFile ? activeColor : muted} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: text }}>
                {inputFile ? inputFile.name : `Upload ${activeTab === 'JOURNAL' ? 'Journal' : 'Daybook'} Excel File`}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: muted }}>
                {inputFile ? 'File ready · Click to replace' : 'Drag & drop or click to browse · .xlsx, .xls'}
              </p>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 10, flexShrink: 0,
            background: inputFile ? `${activeColor}18` : isDark ? '#2a2d3e' : '#f1f5f9',
            color: inputFile ? activeColor : muted,
            fontWeight: 600, fontSize: 13,
          }}>
            <UploadCloud size={15} />
            {inputFile ? 'Replace' : 'Browse'}
          </div>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: -1, position: 'relative', zIndex: 1 }}>
          {['CSI', 'BC', 'VMA', 'JOURNAL'].map((type) => {
            const cfg = TAB_CONFIG[type];
            const isActive = activeTab === type;
            const done = tabData[type].result;
            return (
              <button
                key={type}
                className={`tab-btn${isActive ? ' active' : ''}`}
                onClick={() => setActiveTab(type)}
                style={{
                  flex: 1, padding: '13px 10px',
                  borderRadius: '12px 12px 0 0',
                  border: `1.5px solid ${isActive ? border : 'transparent'}`,
                  borderBottom: isActive ? `1.5px solid ${card}` : `1.5px solid ${border}`,
                  background: isActive ? card : 'transparent',
                  color: isActive ? cfg.color : muted,
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14.5,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isActive ? cfg.color : 'transparent',
                  border: `2px solid ${isActive ? cfg.color : muted}`,
                  flexShrink: 0, transition: 'all 0.2s',
                }} />
                {type} {type !== 'JOURNAL' && 'Bills'}
                {done && (
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 20,
                    background: `${cfg.color}20`, color: cfg.color,
                    fontWeight: 700, letterSpacing: '0.3px',
                  }}>✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Panel ── */}
        <div style={{
          background: card,
          border: `1.5px solid ${border}`,
          borderRadius: `0 12px 16px 16px`,
          padding: '28px 28px 28px',
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.07)',
        }}>

          {/* Conditional Inputs */}
          {activeTab === 'JOURNAL' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Entry Date <span style={{color: '#ef4444'}}>*</span>
                  </label>
                  <input
                    type="date"
                    value={currentData.date}
                    onChange={(e) => updateActiveTab('date', e.target.value)}
                    className="custom-input"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '11px 14px', borderRadius: 10,
                      border: `1.5px solid ${border}`,
                      background: inputBg, color: text,
                      fontSize: 14.5, fontFamily: "'DM Mono', monospace",
                      outline: 'none', transition: 'border 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = activeColor}
                    onBlur={(e) => e.target.style.borderColor = border}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Batch Size <span style={{color: '#ef4444'}}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={currentData.batchSize}
                    onChange={(e) => updateActiveTab('batchSize', e.target.value)}
                    className="custom-input"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '11px 14px', borderRadius: 10,
                      border: `1.5px solid ${border}`,
                      background: inputBg, color: text,
                      fontSize: 14.5, fontFamily: "'DM Mono', monospace",
                      outline: 'none', transition: 'border 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = activeColor}
                    onBlur={(e) => e.target.style.borderColor = border}
                    placeholder="e.g. 10"
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Credit Ledger Name <span style={{color: '#ef4444'}}>*</span>
                </label>
                <input
                  type="text"
                  value={currentData.creditLedger}
                  onChange={(e) => updateActiveTab('creditLedger', e.target.value)}
                  className="custom-input"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 14px', borderRadius: 10,
                    border: `1.5px solid ${border}`,
                    background: inputBg, color: text,
                    fontSize: 14.5, fontFamily: "'DM Sans', sans-serif",
                    outline: 'none', transition: 'border 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = activeColor}
                  onBlur={(e) => e.target.style.borderColor = border}
                  placeholder="e.g. SYED KABIR AHMED  LOAN"
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
              {[['fromDate', 'From Date'], ['toDate', 'To Date']].map(([field, label]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {label}
                  </label>
                  <input
                    type="date"
                    value={currentData[field]}
                    onChange={(e) => updateActiveTab(field, e.target.value)}
                    className="custom-input"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '11px 14px', borderRadius: 10,
                      border: `1.5px solid ${border}`,
                      background: inputBg, color: text,
                      fontSize: 14.5, fontFamily: "'DM Mono', monospace",
                      outline: 'none', transition: 'border 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = activeColor}
                    onBlur={(e) => e.target.style.borderColor = border}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Process Button */}
          <button
            className="process-btn"
            onClick={handleGenerate}
            disabled={loading || !inputFile}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 12, border: 'none',
              background: (!loading && inputFile)
                ? `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`
                : isDark ? '#2a2d3e' : '#e2e8f0',
              color: (!loading && inputFile) ? '#fff' : muted,
              fontWeight: 700, fontSize: 15.5,
              cursor: (!loading && inputFile) ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: (!loading && inputFile) ? `0 4px 18px ${activeGlow}` : 'none',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
                Processing {activeTab} Data…
              </>
            ) : (
              <>
                <Play size={18} fill="currentColor" />
                Generate {activeTab} XML
              </>
            )}
          </button>

          {/* Result Block */}
          {currentData.result && (
            <div className="fade-in" style={{
              marginTop: 22,
              borderRadius: 14,
              border: `1.5px solid ${activeColor}40`,
              background: `${activeColor}0a`,
              overflow: 'hidden',
            }}>
              {/* Top strip */}
              <div style={{
                padding: '14px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `1px solid ${activeColor}20`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <CheckCircle size={18} color={activeColor} />
                  <span style={{ fontWeight: 700, fontSize: 14.5, color: activeColor }}>
                    {activeTab} Processing Complete
                  </span>
                </div>
                <button
                  onClick={handleDownload}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 18px', borderRadius: 9, border: 'none',
                    background: activeColor, color: '#fff',
                    fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: `0 2px 10px ${activeGlow}`,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
                  onMouseOut={e => e.currentTarget.style.opacity = '1'}
                >
                  <Download size={15} /> Download XML
                </button>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                {activeTab === 'JOURNAL' ? (
                  <>
                    <div className="stat-card" style={{ padding: '16px 20px', borderRight: `1px solid ${activeColor}20`, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>{currentData.result.batchCount}</div>
                      <div style={{ fontSize: 11.5, color: muted, fontWeight: 500, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Batches Created</div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px 20px', borderRight: `1px solid ${activeColor}20`, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>{currentData.result.entryCount}</div>
                      <div style={{ fontSize: 11.5, color: muted, fontWeight: 500, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valid Entries</div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>{currentData.result.skippedCount}</div>
                      <div style={{ fontSize: 11.5, color: muted, fontWeight: 500, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rows Skipped</div>
                    </div>
                  </>
                ) : (
                  [
                    { emoji: '✅', label: 'Valid', value: currentData.result.createdCount, accent: '#10b981' },
                    { emoji: '❌', label: 'Cancelled', value: currentData.result.cancelledCount, accent: '#ef4444' },
                    { emoji: '⏭️', label: 'Skipped', value: currentData.result.skippedCount, accent: '#f59e0b' },
                  ].map((s, i) => (
                    <div key={i} className="stat-card" style={{
                      padding: '16px 20px',
                      borderRight: i < 2 ? `1px solid ${activeColor}20` : 'none',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.accent, fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>
                        {s.value}
                      </div>
                      <div style={{ fontSize: 11.5, color: muted, fontWeight: 500, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {s.label}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dynamic Batch Information Display specifically for Journal */}
              {activeTab === 'JOURNAL' && currentData.result.batchTotals && currentData.result.batchTotals.length > 0 && (
                <div style={{ padding: '16px 20px', borderTop: `1px solid ${activeColor}20`, background: isDark ? '#1a1d27' : '#ffffff' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Batch Credit Totals
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                    {currentData.result.batchTotals.map((total, idx) => (
                      <div key={idx} style={{ 
                        padding: '8px 12px', 
                        background: `${activeColor}15`, 
                        borderRadius: 8, 
                        border: `1px solid ${activeColor}30`, 
                        display: 'flex', 
                        flexDirection: 'column' 
                      }}>
                        <span style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Batch {idx + 1}</span>
                        <span style={{ fontSize: 14, color: text, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {currentData.error && (
            <div className="fade-in" style={{
              marginTop: 22, padding: '14px 18px',
              borderRadius: 12,
              border: '1.5px solid #ef444440',
              background: isDark ? '#ef444410' : '#fef2f2',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: isDark ? '#fca5a5' : '#b91c1c', lineHeight: 1.5 }}>
                {currentData.error}
              </p>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, fontWeight: 600, color: "#ef4444" }}>
          ⚠️ This tool must be used with high caution. Always review generated data files before importing into Tally. All Ledgers and entries must be exact. Make sure to take a Tally data backup before importing.
        </p>
      </div>
    </div>
  );
};

export default XmlGenerator;