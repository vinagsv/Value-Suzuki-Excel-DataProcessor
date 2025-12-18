// import React, { useState, useEffect } from "react";
// import { Moon, Sun, FileSpreadsheet, Users, Info } from "lucide-react";
// import VahanConverter from "./VahanConverter";
// import DMSNames from "./DMSNames";
// import InfoPage from "./InfoPage";

// function App() {
//   const [theme, setTheme] = useState(() => {
//     return localStorage.getItem("theme") || "light";
//   });
//   const [activePage, setActivePage] = useState("vahan");

//   const isDark = theme === "dark";

//   useEffect(() => {
//     localStorage.setItem("theme", theme);
//   }, [theme]);

//   const toggleTheme = () => {
//     setTheme(isDark ? "light" : "dark");
//   };

//   const pages = [
//     { id: "vahan", name: "VAHAN", icon: FileSpreadsheet },
//     { id: "dms", name: "DMS Names", icon: Users },
//     { id: "info", name: "Info", icon: Info },
//   ];

//   return (
//     <div
//       className={`min-h-screen transition-colors duration-300 ${
//         isDark
//           ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
//           : "bg-gradient-to-br from-blue-50 via-white to-purple-50"
//       }`}
//     >
//       {/* Sidebar Navigation */}
//       <div
//         className={`fixed right-0 top-0 h-full w-20 ${
//           isDark
//             ? "bg-gray-800/80 backdrop-blur-sm border-l border-gray-700"
//             : "bg-white/80 backdrop-blur-sm border-l border-gray-200"
//         } shadow-2xl z-50 flex flex-col items-center py-8 gap-6`}
//       >
//         {/* Theme Toggle */}
//         <button
//           onClick={toggleTheme}
//           className={`p-3 rounded-xl transition-all duration-300 ${
//             isDark
//               ? "bg-gray-700 hover:bg-gray-600 text-yellow-400"
//               : "bg-gray-100 hover:bg-gray-200 text-gray-900"
//           }`}
//           title="Toggle Theme"
//         >
//           {isDark ? <Sun size={24} /> : <Moon size={24} />}
//         </button>

//         {/* Divider */}
//         <div
//           className={`w-12 h-px ${isDark ? "bg-gray-700" : "bg-gray-300"}`}
//         ></div>

//         {/* Navigation Items */}
//         {pages.map((page) => {
//           const Icon = page.icon;
//           const isActive = activePage === page.id;
//           return (
//             <button
//               key={page.id}
//               onClick={() => setActivePage(page.id)}
//               className={`p-3 rounded-xl transition-all duration-300 relative group ${
//                 isActive
//                   ? isDark
//                     ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50"
//                     : "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
//                   : isDark
//                   ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
//                   : "bg-gray-100 hover:bg-gray-200 text-gray-700"
//               }`}
//               title={page.name}
//             >
//               <Icon size={24} />

//               {/* Tooltip */}
//               <span
//                 className={`absolute right-full mr-3 px-3 py-1 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
//                   isDark ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
//                 }`}
//               >
//                 {page.name}
//               </span>
//             </button>
//           );
//         })}
//       </div>

//       {/* Main Content */}
//       <div className="pr-20">
//         {activePage === "vahan" && <VahanConverter theme={theme} />}
//         {activePage === "dms" && <DMSNames theme={theme} />}
//         {activePage === "info" && <InfoPage theme={theme} />}
//       </div>
//     </div>
//   );
// }

// export default App;

import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import VahanConverter from "./VahanConverter";
import DMSNames from "./DMSNames";
import InfoPage from "./InfoPage";
import AttendanceApp from "./AttendanceApp";

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });
  const [activePage, setActivePage] = useState("vahan");

  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const pages = [
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
        <div className="flex items-center gap-2">
          {pages.map((page) => {
            const isActive = activePage === page.id;
            return (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
                className={`px-4 py-2 rounded-lg transition-all duration-300 font-medium ${
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
          className={`p-2 rounded-lg transition-all duration-300 ${
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
      <div className="pt-16">
        {activePage === "vahan" && <VahanConverter theme={theme} />}
        {activePage === "dms" && <DMSNames theme={theme} />}
        {activePage === "attendance" && <AttendanceApp theme={theme} />}
        {activePage === "info" && <InfoPage theme={theme} />}
      </div>
    </div>
  );
}

export default App;
