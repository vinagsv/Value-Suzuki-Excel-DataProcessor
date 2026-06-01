import React, { useState } from 'react';
import { Database, FileText, Shield, Users, ChevronRight } from 'lucide-react';
import VahanConverter from './VahanConverter';
import HSRPVahanMerger from './HSRPVahanMerger';
import InsuranceProcessor from './InsuranceProcessor';
import DMSNames from './DMSNames';

const TOOLS = [
  {
    id: 'vahan',
    label: 'VAHAN Processor',
    icon: Database,
    color: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-100 text-blue-600',
    iconBgDark: 'bg-blue-900/30 text-blue-400',
    description: 'Match & update VAHAN data with FORM22 records. Fill missing customer names using chassis numbers.',
  },
  {
    id: 'hsrp',
    label: 'HSRP ↔ VAHAN',
    icon: Shield,
    color: 'from-purple-500 to-purple-600',
    iconBg: 'bg-purple-100 text-purple-600',
    iconBgDark: 'bg-purple-900/30 text-purple-400',
    description: 'Fill missing REG NUM and DATE OF REG in HSRP files using VAHAN registration data.',
  },
  {
    id: 'insurance',
    label: 'Insurance Processor',
    icon: FileText,
    color: 'from-green-500 to-green-600',
    iconBg: 'bg-green-100 text-green-600',
    iconBgDark: 'bg-green-900/30 text-green-400',
    description: 'Match Insurance exports with FORM22 to fetch exact customer names via chassis number.',
  },
  {
    id: 'dms',
    label: 'DMS Name Cleaner',
    icon: Users,
    color: 'from-orange-500 to-orange-600',
    iconBg: 'bg-orange-100 text-orange-600',
    iconBgDark: 'bg-orange-900/30 text-orange-400',
    description: 'Clean DMS exports — strip employee IDs from names and align Date, Name, Debit columns.',
  },
];

const ToolsPage = ({ theme }) => {
  const isDark = theme === 'dark';
  const [activeTool, setActiveTool] = useState(null);

  const bg   = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const card = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const tpri = isDark ? 'text-white' : 'text-gray-900';
  const tmut = isDark ? 'text-gray-400' : 'text-gray-500';

  const currentTool = TOOLS.find(t => t.id === activeTool);

  return (
    <div className={`min-h-full ${bg}`}>
      {/* ── Breadcrumb header ── */}
      <div className={`sticky top-0 z-10 border-b px-6 py-3 flex items-center gap-2 text-sm ${card}`}>
        <button
          onClick={() => setActiveTool(null)}
          className={`font-semibold transition-colors hover:text-blue-500 ${activeTool ? tmut : tpri}`}
        >
          Tools
        </button>
        {activeTool && (
          <>
            <ChevronRight size={14} className={tmut} />
            <span className={`font-bold ${tpri}`}>{currentTool?.label}</span>
          </>
        )}
      </div>

      {/* ── Tool grid (home) ── */}
      {!activeTool && (
        <div className="p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className={`text-2xl font-bold mb-1 ${tpri}`}>Data Processing Tools</h1>
              <p className={`text-sm ${tmut}`}>
                Utilities for processing and matching vehicle, insurance, and DMS data.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={`text-left p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all group ${card}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${isDark ? tool.iconBgDark : tool.iconBg}`}>
                        <Icon size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className={`font-bold text-base ${tpri}`}>{tool.label}</h3>
                          <ChevronRight size={16} className={`${tmut} group-hover:text-blue-500 transition-colors flex-shrink-0`} />
                        </div>
                        <p className={`text-sm mt-1 leading-relaxed ${tmut}`}>{tool.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Active tool view ── */}
      {activeTool === 'vahan'     && <VahanConverter     theme={theme} />}
      {activeTool === 'hsrp'      && <HSRPVahanMerger    theme={theme} />}
      {activeTool === 'insurance' && <InsuranceProcessor  theme={theme} />}
      {activeTool === 'dms'       && <DMSNames            theme={theme} />}
    </div>
  );
};

export default ToolsPage;