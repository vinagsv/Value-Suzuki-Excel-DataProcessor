import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import VahanConverter from "./VahanConverter";
import DMSNames from "./DMSNames";
import InfoPage from "./InfoPage";
import AttendanceApp from "./AttendanceApp";
import SuzukiReceipt from "./SuzukiReceipt";
import SuzukiGatePass from "./SuzukiGatePass";

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  // Default to 'gatepass', check localStorage
  const [activePage, setActivePage] = useState(() => {
    const savedPage = localStorage.getItem("activePage");
    return savedPage || "gatepass";
  });

  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Persist active page (Valid for sessions)
  useEffect(() => {
    localStorage.setItem("activePage", activePage);
  }, [activePage]);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const pages = [
    { id: "gatepass", name: "Gate Pass" },
    { id: "receipt", name: "Receipt" },
    { id: "vahan", name: "VAHAN" },
    { id: "dms", name: "DMS Names" },
    { id: "attendance", name: "Attendance" },
    { id: "info", name: "Info" },
  ];

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-blue-50 via-white to-purple-50"
      }`}
    >
      {/* Top Navigation Bar */}
      <nav
        className={`fixed top-0 left-0 right-0 h-16 ${
          isDark
            ? "bg-gray-800/80 backdrop-blur-sm border-b border-gray-700"
            : "bg-white/80 backdrop-blur-sm border-b border-gray-200"
        } shadow-lg z-50 flex items-center justify-between px-6`}
      >
        {/* Navigation Items */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {pages.map((page) => {
            const isActive = activePage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
                className={`px-4 py-2 rounded-lg transition-all duration-300 font-medium whitespace-nowrap ${
                  isActive
                    ? isDark
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50"
                      : "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                    : isDark
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {page.name}
              </button>
            );
          })}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-all duration-300 ml-4 ${
            isDark
              ? "bg-gray-700 hover:bg-gray-600 text-yellow-400"
              : "bg-gray-100 hover:bg-gray-200 text-gray-900"
          }`}
          title="Toggle Theme"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </nav>

      {/* Main Content */}
      <div className="pt-20 pb-10">
        {activePage === "gatepass" && <SuzukiGatePass theme={theme} />}
        {activePage === "receipt" && <SuzukiReceipt theme={theme} />}
        {activePage === "vahan" && <VahanConverter theme={theme} />}
        {activePage === "dms" && <DMSNames theme={theme} />}
        {activePage === "attendance" && <AttendanceApp theme={theme} />}
        {activePage === "info" && <InfoPage theme={theme} />}
      </div>
    </div>
  );
}

export default App;