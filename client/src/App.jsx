import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Login from "./Login";
import VahanConverter from "./VahanConverter";
import DMSNames from "./DMSNames";
import InfoPage from "./InfoPage";
import AttendanceApp from "./AttendanceApp";
import SuzukiGatePass from "./SuzukiGatePass";
import DpReceipt from "./DpReceipt";
import Receipt from "./components/Receipt"; 
import Verify from "./ReqFetch/Verify";
import UserProfile from "./components/UserProfile"

// --- GLOBAL FETCH INTERCEPTOR ---
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  config = config || {};
  config.credentials = 'include';
  
  try {
    const response = await originalFetch(resource, config);
    
    // Check for Session Expiry (401 Unauthorized)
    if (response.status === 401) {
      // Dispatch a custom event that App component listens to
      window.dispatchEvent(new Event('auth:session-expired'));
    }
    
    return response;
  } catch (error) {
    throw error;
  }
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

  // State to pass message to Login screen
  const [loginMessage, setLoginMessage] = useState("");

  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("activePage", activePage);
  }, [activePage]);

  // --- LISTENER FOR SESSION EXPIRY ---
  useEffect(() => {
    const handleSessionExpiry = () => {
      // Only trigger if we are currently logged in to avoid loops
      if (localStorage.getItem("isLoggedIn") === "true") {
        console.warn("Session expired. Logging out...");
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userRole");
        setUserRole("user");
        setLoginMessage("Your session has expired. Please log in again.");
        setIsAuthenticated(false);
      }
    };

    window.addEventListener('auth:session-expired', handleSessionExpiry);

    // Cleanup listener
    return () => window.removeEventListener('auth:session-expired', handleSessionExpiry);
  }, []);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const handleLogin = (role, email) => {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userRole", role);
    if(email) localStorage.setItem("userEmail", email);
    
    setUserRole(role);
    setLoginMessage(""); // Clear any previous error messages
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
      setLoginMessage(""); // No error message for voluntary logout
      setIsAuthenticated(false);
      setUserRole("user");
    }
  };

  if (!isAuthenticated) {
    // Pass the session expired message to Login component
    return <Login onLogin={handleLogin} initialError={loginMessage} />;
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
        {activePage === "receipt" && <Receipt theme={theme} />} 
        {activePage === "verify" && <Verify theme={theme} />}
        {activePage === "gatepass" && <SuzukiGatePass theme={theme} />}
        {activePage === "dp_receipt" && <DpReceipt theme={theme} />}
        {activePage === "vahan" && <VahanConverter theme={theme} />}
        {activePage === "dms" && <DMSNames theme={theme} />}
        {activePage === "attendance" && <AttendanceApp theme={theme} />}
        {activePage === "info" && <InfoPage theme={theme} />}
        {activePage === "profile" && <UserProfile theme={theme} />}
      </div>
    </div>
  );
}

export default App;