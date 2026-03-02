import React, { useState, useEffect, useRef } from 'react';
import { Loader2, FileText, Printer, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const PriceList = ({ theme, isActive }) => {
    const isDark = theme === 'dark';
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const iframeRef = useRef(null);

    useEffect(() => {
        if (isActive && !pdfBlobUrl && !error) {
            fetchPriceList();
        }
        return () => {
            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        };
    }, [isActive]);

    const fetchPriceList = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/pricelist`, { credentials: 'include' });
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || "Failed to fetch price list");
            }
            
            if (data.pdfBase64) {
                const binaryString = window.atob(data.pdfBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                setPdfBlobUrl(blobUrl);
            } else {
                setPdfBlobUrl(null);
            }
        } catch(e) { 
            console.error(e); 
            setError(e.message);
        }
        finally { setLoading(false); }
    };

    const handlePrint = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.print();
        }
    };

    return (
        <div className={`h-full w-full flex overflow-hidden ${isDark ? 'bg-[#111827]' : 'bg-[#f4f5f7]'}`}>
            
            <main className="flex-1 p-2 md:p-4 flex flex-col min-w-0 h-full overflow-hidden">
                <div className="flex items-center justify-between mb-2 flex-none">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Price List</h1>
                            
                        </div>
                    </div>

                    {pdfBlobUrl && (
                        <button 
                            onClick={handlePrint} 
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-transform transform active:scale-95 ${
                                isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                            } shadow-md`}
                        >
                            <Printer size={16} />
                            Print Price List
                        </button>
                    )}
                </div>

                <div className={`flex-1 flex flex-col overflow-hidden rounded-xl border shadow-inner ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-white'}`}>
                    {loading ? (
                        <div className="flex-1 flex justify-center items-center flex-col gap-3">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                            <span className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading pdf...</span>
                        </div>
                    ) : error ? (
                        <div className={`flex-1 flex justify-center items-center text-center p-8 flex-col gap-2 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                            <AlertTriangle size={32} />
                            <span className="font-bold">Error loading pdf</span>
                            <span className="text-sm">{error}</span>
                        </div>
                    ) : !pdfBlobUrl ? (
                        <div className={`flex-1 flex justify-center items-center text-center p-8 flex-col gap-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <FileText size={48} className="opacity-50" />
                            <span>No price list pdf available.<br/>Please "Save as PDF" in Excel and upload it from the Admin Panel.</span>
                        </div>
                    ) : (
                        <div className="flex-1 w-full h-full overflow-hidden bg-gray-500/10 flex items-center justify-center">
                            <iframe 
                                ref={iframeRef}
                                src={`${pdfBlobUrl}#toolbar=0&navpanes=0&view=FitH`} 
                                className="w-full h-full border-0 rounded-b-xl"
                                title="Price List PDF"
                            />
                        </div>
                    )}
                </div>
            </main>
            
        </div>
    );
};

export default PriceList;