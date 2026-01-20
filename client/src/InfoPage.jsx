import React from "react";
import { 
  FileSpreadsheet, 
  Users, 
  Zap, 
  CheckCircle, 
  Printer, 
  CalendarDays, 
  Receipt, 
  Database,
  Clock,
  ShieldAlert
} from "lucide-react";

const InfoPage = ({ theme }) => {
  const isDark = theme === "dark";

  const modules = [
    {
      icon: Printer,
      title: "Gate Pass System",
      description: "Generate professional vehicle gate passes with automated numbering and vehicle search.",
      features: [
        "Search vehicle details by Chassis No (last 4 digits) or Name.",
        "Auto-fills Model, Color, and Name from Form 22 database.",
        "Generates sequential Pass Numbers automatically.",
        "Standardized A5 print layout with 'Authorized Signatory'.",
        "Exports history to Excel for record-keeping.",
      ],
      policy: "Data Policy: Gate pass records older than 45 days are automatically deleted to save storage.",
      howToUse: [
        "Go to the 'Gate Pass' tab.",
        "Type the last 4 digits of a chassis number in the search box.",
        "Select the correct vehicle from the dropdown.",
        "Fill in any missing bill numbers.",
        "Click 'Save & Print' to generate the pass."
      ],
    },
    {
      icon: Receipt,
      title: "Receipt Generator",
      description: "Create official cash/cheque receipts with automatic amount-to-words conversion.",
      features: [
        "Auto-converts amounts (e.g., 1200 → 'One Thousand Two Hundred Only').",
        "Handles long text gracefully with multi-line support.",
        "Tracks history of all generated receipts.",
        "Supports searching receipts by Customer Name.",
        "Print-ready format with company branding.",
      ],
      policy: "Data Policy: Receipt records older than 45 days are automatically deleted.",
      howToUse: [
        "Navigate to 'Receipts'.",
        "Enter Customer Name, Amount, and Payment Mode.",
        "The system auto-calculates the amount in words.",
        "Click 'Save & Print' to finalize.",
        "Use the History section to reprint or export logs."
      ],
    },
    {
      icon: CalendarDays,
      title: "Attendance Dashboard",
      description: "Analyze monthly employee attendance from biometric Excel exports.",
      features: [
        "Visual Dashboard: View Present, Absent, Half-Day, and Late stats.",
        "Smart Parsing: Detects 'Period' row to identify Month & Year automatically.",
        "Database Storage: Uploads are saved to the server for quick access later.",
        "Replacement Logic: Re-uploading a file for the same month updates the existing record.",
        "Detailed View: Click any employee to see day-wise breakdown.",
      ],
      policy: "Data Policy: Attendance data is retained for 1 year (e.g., Feb 2025 to Feb 2026). Older files are removed.",
      howToUse: [
        "Go to 'Attendance'.",
        "Click 'Upload Excel' and select your 'Monthly_Performance_Register.xlsx'.",
        "The system processes the file and displays the dashboard.",
        "Use the dropdown to switch between previously uploaded months.",
      ],
    },
    {
      icon: Database,
      title: "VAHAN Data Processor",
      description: "Bridge the gap between Form 22 and VAHAN entries.",
      features: [
        "Upload Form 22 to populate the Master Database (used by Gate Pass search).",
        "Upload VAHAN Excel to auto-fill missing Customer Names.",
        "Matches data using Chassis Numbers.",
        "Supports date filtering for specific batches.",
      ],
      howToUse: [
        "Go to 'VAHAN'.",
        "Upload your 'Form 22' Excel file.",
        "Click 'Upload to Search DB' to update the vehicle master list.",
        "Upload a 'VAHAN' Excel file and click 'Process Files' to fill missing names.",
      ],
    },
    {
      icon: Users,
      title: "DMS Name Cleaner",
      description: "Utility tool for Tally data entry integration.",
      features: [
        "Removes trailing IDs from names (e.g., 'Rahul (12345)' → 'Rahul').",
        "Extracts valid Date, Name, and Debit amounts.",
        "Produces a clean Excel file ready for Tally import.",
      ],
      howToUse: [
        "Go to 'DMS Names'.",
        "Upload the raw DMS export file.",
        "Click 'Process' to clean the data.",
        "Download the cleaned file."
      ],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero Section */}
      <div className="mb-16 text-center">
        <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6 shadow-lg">
          <Zap className="text-white" size={48} />
        </div>
        <h1 className={`text-5xl font-extrabold mb-4 tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
          System Documentation
        </h1>
        <p className={`text-xl ${isDark ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto`}>
          A comprehensive guide to all modules, features, and data retention policies for the Value Motor Agency management system.
        </p>
      </div>

      {/* Modules Grid */}
      <div className="grid gap-10">
        {modules.map((mod, index) => {
          const Icon = mod.icon;
          return (
            <div 
              key={index}
              className={`rounded-2xl shadow-xl overflow-hidden transition-all hover:shadow-2xl ${
                isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"
              }`}
            >
              <div className="p-8 md:p-10 flex flex-col md:flex-row gap-8">
                {/* Icon Column */}
                <div className="flex-shrink-0">
                  <div className={`p-4 rounded-2xl inline-flex items-center justify-center ${
                    isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"
                  }`}>
                    <Icon size={40} />
                  </div>
                </div>

                {/* Content Column */}
                <div className="flex-grow space-y-6">
                  <div>
                    <h2 className={`text-3xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-800"}`}>
                      {mod.title}
                    </h2>
                    <p className={`text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {mod.description}
                    </p>
                  </div>

                  {/* Features List */}
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      Key Features
                    </h3>
                    <ul className="grid md:grid-cols-2 gap-3">
                      {mod.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className={`mt-1 flex-shrink-0 ${isDark ? "text-green-400" : "text-green-500"}`} size={18} />
                          <span className={`${isDark ? "text-gray-300" : "text-gray-700"}`}>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Policy Alert */}
                  {mod.policy && (
                    <div className={`p-4 rounded-xl flex gap-3 items-start ${
                      isDark ? "bg-amber-900/20 border border-amber-800" : "bg-amber-50 border border-amber-100"
                    }`}>
                      <ShieldAlert className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                      <div className="text-sm">
                        <span className={`font-bold block mb-1 ${isDark ? "text-amber-400" : "text-amber-700"}`}>
                          Retention Policy
                        </span>
                        <span className={isDark ? "text-amber-200/70" : "text-amber-800/80"}>
                          {mod.policy}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* How To Use */}
                  <div className={`p-6 rounded-xl ${isDark ? "bg-gray-700/50" : "bg-gray-50"}`}>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      How to Use
                    </h3>
                    <ol className="space-y-3">
                      {mod.howToUse.map((step, i) => (
                        <li key={i} className="flex gap-4">
                          <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDark ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-600"
                          }`}>
                            {i + 1}
                          </span>
                          <span className={`${isDark ? "text-gray-300" : "text-gray-700"}`}>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className={`mt-16 text-center pt-8 border-t ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          © {new Date().getFullYear()} Value Motor Agency Pvt Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default InfoPage;
