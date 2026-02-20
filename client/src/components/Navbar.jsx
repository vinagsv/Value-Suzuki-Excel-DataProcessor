import React from "react";
import { Moon, Sun, LogOut, UserCircle, Shield } from "lucide-react";

const Navbar = ({ activePage, setActivePage, theme, toggleTheme, onLogout, userRole }) => {
  const isDark = theme === "dark";

  const pages = [
    { id: "receipt", name: "Receipt" },
    { id: "verify", name: "Verify" },
    { id: "pricelist", name: "Price List" },
    { id: "gatepass", name: "Gate Pass" },
    { id: "dp_receipt", name: "DP Receipt" },
    { id: "vahan", name: "VAHAN" },
    { id: "dms", name: "DMS Names" },
    { id: "attendance", name: "Attendance" },
    { id: "info", name: "Info" },
  ];

  return (
    <nav className={`absolute top-0 left-0 right-0 h-16 ${isDark ? "bg-gray-800/80 border-gray-700" : "bg-white/80 border-gray-200"} border-b backdrop-blur-sm shadow-lg z-50 flex items-center justify-between px-6`}>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {pages.map((page) => {
          const isActive = activePage === page.id;
          return (
            <button
              key={page.id}
              onClick={() => setActivePage(page.id)}
              className={`px-4 py-2 rounded-lg transition-all duration-300 font-medium whitespace-nowrap ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg"
                  : isDark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              {page.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 ml-4">
        {userRole === 'admin' && (
            <button 
                onClick={() => setActivePage("admin")}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg font-bold transition-all ${activePage === "admin" ? "bg-purple-600 text-white" : "text-purple-600 hover:bg-purple-50"}`}
            >
                <Shield size={18} /> Admin
            </button>
        )}

        <button onClick={() => setActivePage("profile")} className={`p-2 rounded-lg ${activePage === "profile" ? "bg-blue-100 text-blue-600" : isDark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}>
          <UserCircle size={20} />
        </button>

        <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-700 text-yellow-400" : "hover:bg-gray-100 text-gray-900"}`}>
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button onClick={onLogout} className={`p-2 rounded-lg ${isDark ? "hover:bg-red-900/50 text-red-200" : "hover:bg-red-100 text-red-700"}`}>
            <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;