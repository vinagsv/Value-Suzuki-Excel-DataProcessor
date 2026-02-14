import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Login from "./Login";
import VahanConverter from "./VahanConverter";
import DMSNames from "./DMSNames";
import InfoPage from "./InfoPage";
import AttendanceApp from "./AttendanceApp";
import SuzukiGatePass from "./SuzukiGatePass";
import DpReceipt from "./DpReceipt";
import Receipt from "./components/Receipt"; // Back to the placeholder

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  config = config || {};
  config.credentials = 'include';
  return originalFetch(resource, config);
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });

  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem("userRole") || "user";
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem("activePage") || "gatepass";
  });

  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("activePage", activePage);
  }, [activePage]);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const handleLogin = (role) => {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userRole", role);
    setUserRole(role);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/auth/logout`, { method: 'POST' });
    } catch (err) {
      console.error("Logout request failed", err);
    } finally {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userRole");
      setIsAuthenticated(false);
      setUserRole("user");
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-blue-50 via-white to-purple-50"
      }`}
    >
      <Navbar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        theme={theme} 
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
        userRole={userRole}
      />

      <div className="pt-20 pb-10">
        {activePage === "gatepass" && <SuzukiGatePass theme={theme} />}
        {activePage === "dp_receipt" && <DpReceipt theme={theme} />}
        {activePage === "receipt" && <Receipt theme={theme} />} 
        {activePage === "vahan" && <VahanConverter theme={theme} />}
        {activePage === "dms" && <DMSNames theme={theme} />}
        {activePage === "attendance" && <AttendanceApp theme={theme} />}
        {activePage === "info" && <InfoPage theme={theme} />}
      </div>
    </div>
  );
}

export default App;