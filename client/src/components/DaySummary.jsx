import React, { useState, useEffect } from 'react';
import { RefreshCw, Calendar, X, TrendingUp, Banknote, CreditCard, Smartphone, Building2, FileCheck } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const DaySummary = ({ isOpen, onClose, theme }) => {
    const isDark = theme === 'dark';
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchSummary();
        }
    }, [isOpen, date]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/general-receipts/day-summary?date=${date}`);
            if (res.ok) setData(await res.json());
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    if (!isOpen) return null;

    const paymentRows = [
        { label: 'Cash',          icon: Banknote,   value: data?.cash_total,   color: isDark ? 'text-green-400'  : 'text-green-700'  },
        { label: 'Card',          icon: CreditCard, value: data?.card_total,   color: isDark ? 'text-blue-400'   : 'text-blue-700'   },
        { label: 'UPI / Online',  icon: Smartphone, value: data?.upi_total,    color: isDark ? 'text-purple-400' : 'text-purple-700' },
        { label: 'Bank Transfer', icon: Building2,  value: data?.bank_total,   color: isDark ? 'text-orange-400' : 'text-orange-700' },
        { label: 'Cheque',        icon: FileCheck,  value: data?.cheque_total, color: isDark ? 'text-yellow-400' : 'text-yellow-700' },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md transition-opacity">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal — same style on both mobile and desktop */}
            <div
                className={`relative w-full max-w-md rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] border animate-fadeIn max-h-[90dvh] overflow-y-auto ${
                    isDark
                        ? 'bg-gray-900/70 border-white/10 text-white'
                        : 'bg-white/70 border-white/60 text-gray-800'
                }`}
                style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-6 pt-6 pb-4">
                    <h3 className="text-2xl font-bold flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl shadow-inner ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500 text-white'}`}>
                            <Calendar size={24} />
                        </div>
                        Daily Collection
                    </h3>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-black'}`}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 pb-7 space-y-5">

                    {/* Date picker */}
                    <div>
                        <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Select Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={`w-full p-3.5 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm border ${
                                isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-white/80 border-gray-200 text-gray-800'
                            }`}
                            style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        />
                    </div>

                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 text-blue-500">
                            <RefreshCw className="animate-spin" size={32} />
                            <span className="font-semibold tracking-wide animate-pulse">Syncing Records...</span>
                        </div>
                    ) : data ? (
                        <div className="space-y-5">

                            {/* Count pills */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className={`p-4 rounded-2xl border shadow-sm backdrop-blur-md ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                                    <div className={`text-3xl font-black ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{data.booking_count}</div>
                                    <div className={`text-[10px] uppercase font-bold tracking-wider mt-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>Bookings</div>
                                </div>
                                <div className={`p-4 rounded-2xl border shadow-sm backdrop-blur-md ${isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200'}`}>
                                    <div className={`text-3xl font-black ${isDark ? 'text-green-400' : 'text-green-700'}`}>{data.dp_bal_count}</div>
                                    <div className={`text-[10px] uppercase font-bold tracking-wider mt-1 ${isDark ? 'text-green-300' : 'text-green-600'}`}>DP + Bal</div>
                                </div>
                                <div className={`p-4 rounded-2xl border shadow-sm backdrop-blur-md ${isDark ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50 border-purple-200'}`}>
                                    <div className={`text-3xl font-black ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>{data.other_count}</div>
                                    <div className={`text-[10px] uppercase font-bold tracking-wider mt-1 ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>Others</div>
                                </div>
                            </div>

                            {/* Payment breakdown */}
                            <div className={`p-6 rounded-2xl border shadow-sm space-y-4 backdrop-blur-md ${isDark ? 'bg-black/20 border-white/10' : 'bg-white/60 border-white/80'}`}>
                                {paymentRows.map(({ label, icon: Icon, value, color }) => (
                                    <div key={label} className="flex justify-between text-sm items-center">
                                        <div className="flex items-center gap-2.5">
                                            <Icon size={15} className={`${color} flex-shrink-0`} />
                                            <span className={`font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
                                        </div>
                                        <span className="font-bold text-lg tabular-nums">
                                            ₹{(value || 0).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                ))}

                                {/* Total — stacked layout + fluid font so it never overflows */}
                                <div className={`border-t pt-4 mt-2 flex flex-col gap-1 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <TrendingUp size={16} className={isDark ? 'text-green-400' : 'text-green-600'} />
                                        <span className="font-bold uppercase text-xs tracking-widest">Total Collected</span>
                                    </div>
                                    <span
                                        className={`font-black tabular-nums leading-none ${isDark ? 'text-green-400' : 'text-green-600'}`}
                                        style={{ fontSize: 'clamp(1.5rem, 9vw, 2.25rem)' }}
                                    >
                                        ₹{(data.total_amount || 0).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className={`text-center py-8 font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            No data found for this date.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DaySummary;