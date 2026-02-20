import React, { useState } from 'react';
import { Calculator as CalcIcon, Trash2 } from 'lucide-react';

const Calculator = ({ theme }) => {
    const isDark = theme === 'dark';
    const [calcInput, setCalcInput] = useState("");
    const [calcResult, setCalcResult] = useState("");
    const [calcHistory, setCalcHistory] = useState([]);

    const solveCalc = () => {
        try {
            // Strip out everything except numbers and math operators for safety
            const sanitized = calcInput.replace(/[^0-9+\-*/().]/g, '');
            if(!sanitized) return;
            
            // eslint-disable-next-line no-new-func
            const res = new Function('return ' + sanitized)();
            
            if(res !== undefined && !isNaN(res)) {
                // Update Result and History
                setCalcResult(res.toString());
                setCalcHistory(prev => [{ input: sanitized, result: res.toString() }, ...prev]);
                setCalcInput("");
            }
        } catch {
            setCalcResult("Error");
        }
    };

    const clearCalc = () => {
        setCalcInput("");
        setCalcResult("");
        setCalcHistory([]);
    };

    return (
        <div className={`w-full h-full flex flex-col ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'}`}>
            <div className={`flex-none p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className="font-bold flex items-center gap-2 uppercase tracking-wider text-xs">
                    <CalcIcon size={16}/> Calculator
                </span>
                <button onClick={clearCalc} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors">
                    <Trash2 size={12}/> Clear All
                </button>
            </div>

            <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
                {/* Input Field */}
                <input
                    type="text"
                    value={calcInput}
                    onChange={(e) => setCalcInput(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter') solveCalc(); }}
                    placeholder="E.g. 1500 + 350 - 50"
                    className={`flex-none w-full h-14 px-4 rounded-xl font-mono text-lg border-2 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all ${
                        isDark ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                />
                
                {/* Result Field (Same size as input) */}
                <div className={`flex-none w-full h-14 px-4 rounded-xl font-mono text-2xl font-bold flex items-center justify-end border-2 transition-all overflow-hidden ${
                    isDark ? 'bg-gray-800 border-gray-700 text-green-400' : 'bg-gray-50 border-gray-200 text-green-600'
                }`}>
                    {calcResult || "0"}
                </div>

                {/* History Section (Fills remaining space) */}
                <div className={`flex-1 mt-2 overflow-y-auto rounded-xl p-3 border-2 ${
                    isDark ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-50/50 border-gray-100'
                }`}>
                    {calcHistory.length === 0 ? (
                        <div className={`h-full flex items-center justify-center text-sm font-medium ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                            History is empty
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {calcHistory.map((item, idx) => (
                                <div key={idx} className={`text-right border-b pb-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <div className={`text-xs font-mono mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.input} =</div>
                                    <div className={`text-base font-bold font-mono ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{item.result}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Calculator;