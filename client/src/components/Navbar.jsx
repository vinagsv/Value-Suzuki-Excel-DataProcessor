import React from "react";
import { Moon, Sun, LogOut } from "lucide-react";

const Navbar = ({ activePage, setActivePage, theme, toggleTheme, onLogout }) => {
  const isDark = theme === "dark";

  const pages = [
    { id: "receipt", name: "Receipt" },
    { id: "gatepass", name: "Gate Pass" },
    { id: "dp_receipt", name: "DP Receipt" },
    { id: "vahan", name: "VAHAN" },
    { id: "dms", name: "DMS Names" },
    { id: "attendance", name: "Attendance" },
    { id: "info", name: "Info" },
  ];

  return (
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

      {/* Right Side Actions */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-all duration-300 ${
            isDark
              ? "bg-gray-700 hover:bg-gray-600 text-yellow-400"
              : "bg-gray-100 hover:bg-gray-200 text-gray-900"
          }`}
          title="Toggle Theme"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Logout Button */}
        <button
            onClick={onLogout}
            className={`p-2 rounded-lg transition-all duration-300 ${
            isDark
                ? "bg-red-900/50 hover:bg-red-800 text-red-200"
                : "bg-red-100 hover:bg-red-200 text-red-700"
            }`}
            title="Logout"
        >
            <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;