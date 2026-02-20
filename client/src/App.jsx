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
import PriceList from "./components/PriceList";
import UserProfile from "./components/UserProfile";
import AdminPanel from "./components/AdminPanel"; 

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  config = config || {};
  config.credentials = 'include';
  
  try {
    const response = await originalFetch(resource, config);
    if (response.status === 401) {
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

  const [loginMessage, setLoginMessage] = useState("");
  const isDark = theme === "dark";

  // --- GLOBAL TOAST SYSTEM ---
  const [toasts, setToasts] = useState([]);
  
  useEffect(() => {
    window.toast = (msg, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("activePage", activePage);
  }, [activePage]);

  useEffect(() => {
    const handleSessionExpiry = () => {
      if (localStorage.getItem("isLoggedIn") === "true") {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userRole");
        setUserRole("user");
        setLoginMessage("Your session has expired. Please log in again.");
        setIsAuthenticated(false);
      }
    };
    window.addEventListener('auth:session-expired', handleSessionExpiry);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpiry);
  }, []);

  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const handleLogin = (role, email) => {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userRole", role);
    if(email) localStorage.setItem("userEmail", email);
    
    setUserRole(role);
    setLoginMessage("");
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
      setLoginMessage("");
      setIsAuthenticated(false);
      setUserRole("user");
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} initialError={loginMessage} />;
  }

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col transition-colors duration-300 ${isDark ? "bg-gray-900" : "bg-blue-50"}`}>
      
      {/* GLOBAL TOAST CONTAINER */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
          {toasts.map(t => (
              <div key={t.id} className={`px-5 py-3 rounded-xl shadow-2xl text-sm font-bold text-white transition-all transform animate-fadeIn flex items-center gap-2 pointer-events-auto
                  ${t.type === 'error' ? 'bg-red-600' : t.type === 'success' ? 'bg-green-600' : 'bg-blue-600'}`}>
                  {t.msg}
              </div>
          ))}
      </div>

      <div className="flex-none relative h-16 w-full z-50">
        <Navbar 
          activePage={activePage} 
          setActivePage={setActivePage} 
          theme={theme} 
          toggleTheme={toggleTheme}
          onLogout={handleLogout}
          userRole={userRole}
        />
      </div>

      <div className="flex-1 w-full relative overflow-hidden">
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "receipt" ? "block" : "hidden"}`}>
          <Receipt theme={theme} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "verify" ? "block" : "hidden"}`}>
          <Verify theme={theme} />
        </div>
        <div className={`absolute inset-0 overflow-hidden ${activePage === "pricelist" ? "block" : "hidden"}`}>
          <PriceList theme={theme} isActive={activePage === "pricelist"} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "gatepass" ? "block" : "hidden"}`}>
          <SuzukiGatePass theme={theme} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "dp_receipt" ? "block" : "hidden"}`}>
          <DpReceipt theme={theme} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "vahan" ? "block" : "hidden"}`}>
          <VahanConverter theme={theme} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "dms" ? "block" : "hidden"}`}>
          <DMSNames theme={theme} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "attendance" ? "block" : "hidden"}`}>
          <AttendanceApp theme={theme} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "info" ? "block" : "hidden"}`}>
          <InfoPage theme={theme} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "profile" ? "block" : "hidden"}`}>
          <UserProfile theme={theme} />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${activePage === "admin" ? "block" : "hidden"}`}>
          {userRole === 'admin' && <AdminPanel theme={theme} />}
        </div>
      </div>
    </div>
  );
}

export default App;