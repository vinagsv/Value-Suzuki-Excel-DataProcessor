import React from "react";
import { 
  FileSpreadsheet, 
  Users, 
  Zap, 
  Printer, 
  CalendarDays, 
  Receipt, 
  Database,
  ShieldAlert,
  FileCode,
  ShieldCheck,
  SearchCheck,
  FileText
} from "lucide-react";

const InfoPage = ({ theme }) => {
  const isDark = theme === "dark";

  const contentSections = [
    {
      id: "receipts",
      icon: Receipt,
      title: "Receipts & DP Receipts",
      description: "The receipt modules are designed to generate official cash, cheque, and online payment receipts with automatic amount-to-words conversion. They handle long texts gracefully and provide a clean, print-ready A4 format containing both a Customer Copy and an Office Copy.",
      features: [
        "Auto-converts numeric amounts to words (e.g., 1200 → 'One Thousand Two Hundred Only').",
        "Dedicated forms for General Receipts (Booking, Balance) and DP Receipts (Down Payments for Finance).",
        "Maintains a searchable history archive for re-printing and tracking.",
        "Export capabilities to generate Excel reports based on selected date ranges.",
      ],
      instructions: [
        "Navigate to 'Receipt' or 'DP Receipt' from the top menu.",
        "Enter the Customer Name, Amount, and Payment Mode.",
        "Click 'Save & Print' to record the entry and generate the printable layout.",
        "Click any row in the History table to edit or reprint an older receipt."
      ],
      policy: "General Receipt records are retained for 7 years. DP Receipt records are retained for 2 years. Older records are automatically pruned."
    },
    {
      id: "gatepass",
      icon: Printer,
      title: "Gate Pass System",
      description: "A streamlined utility for generating professional vehicle gate passes. It integrates directly with the Form 22 database to auto-complete vehicle specifications, saving time during the dispatch process.",
      features: [
        "Live search by Chassis Number (last 4 digits) or Customer Name.",
        "Auto-fills Model, Color, and Name directly from Form 22 data.",
        "Generates sequential Pass Numbers automatically.",
        "Standardized A5 print layout featuring authorized signatory sections.",
      ],
      instructions: [
        "Go to the 'Gate Pass' tab.",
        "Type the last 4 digits of a chassis number in the search box to fetch details.",
        "Select the correct vehicle from the dropdown suggestions.",
        "Fill in any missing bill numbers (Sales, Spares, Service).",
        "Click 'Save & Print' to generate the pass."
      ],
      policy: "Gate pass records are retained for 2 years before being automatically deleted to preserve database performance."
    },
    {
      id: "vahan",
      icon: Database,
      title: "VAHAN Data Processor",
      description: "This module bridges the gap between Form 22 and VAHAN entries by allowing you to cross-reference and update missing customer names in your VAHAN Excel exports based on chassis numbers.",
      features: [
        "Upload Form 22 to populate the central Master Database.",
        "Upload a VAHAN Excel file to automatically fill in missing Customer Names.",
        "Accurate chassis number matching algorithm.",
        "Date filtering to process specific batches of entries.",
      ],
      instructions: [
        "Navigate to 'VAHAN'.",
        "Upload your 'Form 22' Excel file and click 'Upload to Search DB' (This also updates the Gate Pass search).",
        "Upload your raw 'VAHAN' Excel file.",
        "Click 'Process Files' to match records and fill missing names, then download the updated file."
      ]
    },
    {
      id: "verify",
      icon: SearchCheck,
      title: "RMS Verification Module",
      description: "The Verify module is a powerful auditing tool that connects your local database with the external Requisition Management System (RMS) portal. It allows you to instantly compare local payments against generated RMS costs.",
      features: [
        "Direct API integration with the RMS Portal.",
        "Fetches total costs, particulars, and charges from the RMS.",
        "Aggregates all local receipts for a specific File Number.",
        "Automatically calculates excess amounts or payment shortages.",
      ],
      instructions: [
        "Go to the 'Verify' tab.",
        "Ensure the system is connected to the RMS (indicator should say 'RMS Online').",
        "Search for a File Number (e.g., VMA2025/1234 or just 251234).",
        "Review the side-by-side comparison of Local Payments vs. RMS Costs."
      ]
    },
    {
      id: "tally",
      icon: FileCode,
      title: "Tally XML Generator",
      description: "An essential accounting tool that transforms standard Excel daybook exports (CSI, BC, VMA) into complex, schema-compliant XML files ready for direct import into Tally ERP.",
      features: [
        "Supports processing of CSI Bills, BC Bills, and VMA Bills.",
        "Automatically calculates CGST, SGST, IGST, and Round Off values.",
        "Generates multi-ledger accounting vouchers.",
        "Identifies and isolates missing sequences to generate cancelled voucher entries.",
      ],
      instructions: [
        "Navigate to the 'TALLY' tab.",
        "Select the appropriate sub-tab (CSI, BC, or VMA).",
        "Upload the Daybook Excel file.",
        "Optionally select a From and To date.",
        "Click 'Process' and download the generated XML."
      ],
      alert: "In Tally, import the generated XML by navigating to: Import > Transactions > XML Format > Select Downloaded file."
    },
    {
      id: "attendance",
      icon: CalendarDays,
      title: "Attendance Dashboard",
      description: "A visual analytics tool for parsing raw biometric Excel exports into an easy-to-read monthly attendance dashboard. It calculates complex metrics like late arrivals, early leaves, and exact salary days.",
      features: [
        "Visual Dashboard showing Present, Absent, Half-Day, and Late statistics.",
        "Smart Parsing that automatically detects the 'Period' row to identify the Month & Year.",
        "Day-wise detailed breakdown for individual employees.",
        "Printable summary and detailed reports.",
      ],
      instructions: [
        "Go to the 'Attendance' tab.",
        "Click 'Upload Excel' and select your 'Monthly_Performance_Register.xlsx'.",
        "The system processes the file and updates the dashboard.",
        "Click on any employee row to see their specific in/out times and tardiness data."
      ],
      policy: "Attendance biometric data is retained for 1 year. Older files are automatically purged."
    },
    {
      id: "dms",
      icon: Users,
      title: "DMS Name Cleaner",
      description: "A quick utility tool designed to clean up messy exports from the Dealer Management System (DMS) prior to accounting integration.",
      features: [
        "Strips trailing employee/customer IDs from names (e.g., 'Rahul (12345)' becomes 'Rahul').",
        "Extracts and aligns valid Date, Name, and Debit amounts into a clean structure.",
      ],
      instructions: [
        "Navigate to 'DMS Names'.",
        "Upload the raw DMS export file.",
        "Click 'Process' to execute the cleaning script.",
        "Download the resulting clean Excel file."
      ]
    },
    {
      id: "admin",
      icon: ShieldCheck,
      title: "Admin Panel & System Settings",
      description: "A restricted area available only to users with 'Admin' privileges. It allows for the management of the system's core parameters, user base, and dangerous data operations.",
      features: [
        "User Management: Create, edit, and delete employee accounts.",
        "System Configuration: Update the global File Prefix and RMS Portal credentials.",
        "Sequence Management: Force-reset database sequence numbers for receipts and gate passes.",
        "Price List Upload: Upload a new PDF to be displayed in the Price List module.",
        "Bulk Deletion: Permanently delete receipt records across a specific date range."
      ]
    },
    {
      id: "pricelist",
      icon: FileText,
      title: "Price List Viewer",
      description: "A centralized, read-only viewer for the current dealership price list.",
      features: [
        "Displays the latest pricing PDF uploaded by the administrator.",
        "Built-in print functionality for easy physical distribution.",
      ],
      instructions: [
        "To view, simply click the 'Price List' tab.",
        "Click 'Print Price List' to send the document directly to your local printer."
      ]
    }
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0f1117] text-gray-300" : "bg-[#f9fafb] text-gray-700"} font-sans selection:bg-blue-200 selection:text-blue-900`}>
      
      {/* Header Banner */}
      <header className={`pt-20 pb-16 px-6 text-center border-b ${isDark ? "border-gray-800 bg-[#161922]" : "border-gray-200 bg-white"}`}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/30 mb-8">
            <Zap className="text-white" size={32} />
          </div>
          <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
            System Documentation
          </h1>
          <p className="text-lg md:text-xl leading-relaxed text-gray-500 dark:text-gray-400">
            A comprehensive guide to understanding the modules, operational workflows, and data retention policies driving the Value Motor Agency management system.
          </p>
        </div>
      </header>

      {/* Main Content (Blog Style) */}
      <main className="max-w-3xl mx-auto px-6 py-12 md:py-20">
        <div className="space-y-24">
          {contentSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <article key={section.id} className="scroll-mt-24" id={section.id}>
                
                {/* Chapter Heading */}
                <div className="flex items-center gap-4 mb-6">
                  <div className={`p-2.5 rounded-xl ${isDark ? "bg-gray-800 text-blue-400" : "bg-blue-100 text-blue-600"}`}>
                    <Icon size={24} />
                  </div>
                  <h2 className={`text-2xl md:text-3xl font-bold ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                    {index + 1}. {section.title}
                  </h2>
                </div>

                {/* Description */}
                <p className="text-[17px] leading-relaxed mb-8">
                  {section.description}
                </p>

                {/* Features */}
                <div className="mb-8">
                  <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    Core Features
                  </h3>
                  <ul className="space-y-3">
                    {section.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed">
                        <span className="text-blue-500 mt-1.5 flex-shrink-0">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                {section.instructions && (
                  <div className={`p-6 rounded-2xl mb-8 ${isDark ? "bg-[#161922] border border-gray-800" : "bg-white border border-gray-200 shadow-sm"}`}>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      How to Use
                    </h3>
                    <ol className="space-y-4">
                      {section.instructions.map((step, i) => (
                        <li key={i} className="flex gap-4 text-[15px]">
                          <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDark ? "bg-gray-800 text-blue-400" : "bg-blue-50 text-blue-600"
                          }`}>
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Alerts / Specific Notes (e.g., Tally) */}
                {section.alert && (
                  <div className={`p-5 rounded-xl border-l-4 mb-8 ${
                    isDark ? "bg-blue-900/20 border-blue-500 text-blue-200" : "bg-blue-50 border-blue-500 text-blue-800"
                  }`}>
                    <p className="text-[15px] leading-relaxed font-medium">
                      <strong className="font-bold">Tip:</strong> {section.alert}
                    </p>
                  </div>
                )}

                {/* Retention Policy */}
                {section.policy && (
                  <div className={`flex gap-4 p-5 rounded-xl ${
                    isDark ? "bg-amber-900/10 border border-amber-900/30" : "bg-amber-50/50 border border-amber-100"
                  }`}>
                    <ShieldAlert className={`flex-shrink-0 ${isDark ? "text-amber-500" : "text-amber-600"}`} size={22} />
                    <div>
                      <h4 className={`text-sm font-bold mb-1 ${isDark ? "text-amber-500" : "text-amber-800"}`}>
                        Retention Policy
                      </h4>
                      <p className={`text-[14px] leading-relaxed ${isDark ? "text-amber-200/70" : "text-amber-700/80"}`}>
                        {section.policy}
                      </p>
                    </div>
                  </div>
                )}

                {/* Section Divider (except last) */}
                {index !== contentSections.length - 1 && (
                  <hr className={`mt-16 border-t ${isDark ? "border-gray-800" : "border-gray-200"}`} />
                )}
              </article>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className={`py-10 text-center border-t ${isDark ? "border-gray-800 bg-[#161922]" : "border-gray-200 bg-white"}`}>
        <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          © {new Date().getFullYear()} Value Motor Agency Pvt Ltd. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default InfoPage;