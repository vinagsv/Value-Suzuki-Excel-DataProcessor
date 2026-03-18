import React, { useState } from 'react';
import { Calculator as CalcIcon, Trash2 } from 'lucide-react';

const Calculator = ({ theme }) => {
    const isDark = theme === 'dark';
    const [calcInput, setCalcInput] = useState("");
    const [calcResult, setCalcResult] = useState("");
    const [calcHistory, setCalcHistory] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const solveCalc = () => {
        try {
            // 1. Remove '=' signs entirely, then strip everything except numbers, math operators, braces, and percentage
            let sanitized = calcInput.replace(/=/g, '').replace(/[^0-9+\-*/().%]/g, '');
            
            // 2. Remove leading invalid operators like *, /, or . that would break JS evaluation
            sanitized = sanitized.replace(/^[*/.]+/, '');

            if(!sanitized) return;

            // Safeguard: Do not evaluate if the string is just operators/brackets (e.g. "++" or "()")
            if (/^[+\-*/().]+$/.test(sanitized)) return;
            
            // Additional safety: limit length to prevent DoS
            if (sanitized.length > 100) return;
            
            // Prevent prototype access attempts
            if (/__|prototype|constructor/i.test(sanitized)) return;
            
            // Replace % with /100 so the JS evaluator can process it logically
            const evalStr = sanitized.replace(/%/g, '/100');
            
            // eslint-disable-next-line no-new-func
            const res = new Function('return ' + evalStr)();
            
            if (res !== undefined && !isNaN(res)) {
                // Safeguard: Check for Infinity (e.g., division by zero)
                if (!isFinite(res)) {
                    setCalcResult("Undefined");
                    return;
                }

                // Round to max 8 decimal places, removing unnecessary trailing zeros
                const roundedRes = parseFloat(Number(res).toFixed(8));
                
                // Update Result and History
                setCalcResult(roundedRes.toString());
                setCalcHistory(prev => [{ input: sanitized, result: roundedRes.toString() }, ...prev]);
                setCalcInput("");
                setSelectedIndex(-1); // Reset selection
            }
        } catch {
            setCalcResult("Error");
        }
    };

    const clearCalc = () => {
        setCalcInput("");
        setCalcResult("");
        setCalcHistory([]);
        setSelectedIndex(-1);
    };

    const commitSelection = () => {
        if (selectedIndex > -1 && calcHistory.length > 0) {
            const histIdx = Math.floor(selectedIndex / 2);
            if (histIdx >= calcHistory.length) return false;
            
            const isResult = selectedIndex % 2 === 1;
            const valueToInsert = isResult ? calcHistory[histIdx].result : calcHistory[histIdx].input;
            
            setCalcInput(valueToInsert);
            setSelectedIndex(-1); // Reset selection after picking
            return true;
        }
        return false;
    };

    const handleKeyDown = (e) => {
        const totalItems = calcHistory.length * 2; // Each history entry has an input and a result

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // If an item is selected, commit it. Otherwise, solve the equation.
            if (!commitSelection()) {
                solveCalc();
            }
        } else if (e.key === 'Escape') {
            setSelectedIndex(-1);
        }
    };

    const handleWheel = (e) => {
        const totalItems = calcHistory.length * 2;
        if (totalItems === 0) return;

        // Scroll down acts like ArrowDown (moves selection down the list)
        if (e.deltaY > 0) {
            setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
        } 
        // Scroll up acts like ArrowUp (moves selection up the list)
        else if (e.deltaY < 0) {
            setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1));
        }
    };

    // Handle Left Click on the input field when an item is highlighted
    const handleInputClick = (e) => {
        if (selectedIndex > -1) {
            e.preventDefault();
            commitSelection();
        }
    };

    // Handle Right Click on the input field when an item is highlighted
    const handleInputContextMenu = (e) => {
        if (selectedIndex > -1) {
            e.preventDefault(); // Prevent standard browser right-click menu
            commitSelection();
        }
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
                    onChange={(e) => {
                        setCalcInput(e.target.value);
                        setSelectedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    onWheel={handleWheel}
                    onClick={handleInputClick}
                    onContextMenu={handleInputContextMenu}
                    maxLength={200}
                    placeholder="E.g. (1500 + 350) * 10%"
                    className={`flex-none w-full h-14 px-4 rounded-xl font-mono text-lg border-2 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all ${
                        isDark ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
                    } ${selectedIndex > -1 ? 'cursor-pointer' : 'cursor-text'}`}
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
                            {calcHistory.map((item, idx) => {
                                const inputIdx = idx * 2;
                                const resultIdx = idx * 2 + 1;

                                return (
                                    <div key={idx} className={`text-right border-b pb-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                        <div className="mb-1">
                                            <div 
                                                onClick={() => { setCalcInput(item.input); setSelectedIndex(-1); }}
                                                className={`text-xs font-mono cursor-pointer inline-block rounded px-2 py-0.5 transition-colors ${
                                                    isDark ? 'text-gray-400' : 'text-gray-500'
                                                } ${selectedIndex === inputIdx ? (isDark ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-500/50' : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300') : 'hover:opacity-70'}`}
                                            >
                                                {item.input} =
                                            </div>
                                        </div>
                                        <div>
                                            <div 
                                                onClick={() => { setCalcInput(item.result); setSelectedIndex(-1); }}
                                                className={`text-base font-bold font-mono cursor-pointer inline-block rounded px-2 py-0.5 transition-colors ${
                                                    isDark ? 'text-gray-200' : 'text-gray-700'
                                                } ${selectedIndex === resultIdx ? (isDark ? 'bg-blue-500/40 text-blue-200 ring-1 ring-blue-500/50' : 'bg-blue-200 text-blue-800 ring-1 ring-blue-400') : 'hover:opacity-70'}`}
                                            >
                                                {item.result}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Calculator;