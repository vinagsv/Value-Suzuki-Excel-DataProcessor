import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Login from "./Login";
import InfoPage from "./components/InfoPage";
import AttendanceApp from "./components/AttendanceApp";
import SuzukiGatePass from "./components/SuzukiGatePass";
import DpReceipt from "./components/DpReceipt";
import Receipt from "./components/Receipt";
import Verify from "./components/Verify";            
import PriceList from "./components/PriceList";
import UserProfile from "./components/UserProfile";
import AdminPanel from "./components/AdminPanel";
import XmlGenerator from "./components/XmlGenerator";
import Calculator from "./components/Calculator";
import ArchivePage from "./components/ArchivePage";
import AuditLogPage from "./components/AuditLogPage";
import ToolsPage from "./components/ToolsPage";

const API_BASE = import.meta.env.VITE_API_URL || '';
const isOwnApiRequest = (resource) => {
  if (!API_BASE) return false;
  try {
    const url = typeof resource === 'string'
      ? resource
      : (resource && resource.url) ? resource.url : '';
    return url.startsWith(API_BASE);
  } catch {
    return false;
  }
};

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  config = config || {};
  // Only attach credentials automatically for our own backend.
  if (isOwnApiRequest(resource) && config.credentials === undefined) {
    config.credentials = 'include';
  }
  try {
    const response = await originalFetch(resource, config);
    // Only treat 401s from our own API as a session expiry.
    if (response.status === 401 && isOwnApiRequest(resource)) {
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

  // Allowed public pages
  const publicPages = ['login', 'pricelist', 'dp_receipt', 'tools', 'attendance'];

  const [activePage, setActivePage] = useState(() => {
    const saved = localStorage.getItem("activePage") || "login";
    const isAuth = localStorage.getItem("isLoggedIn") === "true";
    
    if (!isAuth && !publicPages.includes(saved)) return 'login';
    if (isAuth && saved === 'login') return 'receipt';
    return saved;
  });

  const [isCalcOpen, setIsCalcOpen] = useState(() => {
    return localStorage.getItem("isCalcOpen") === "true";
  });

  const [qrScanTarget, setQrScanTarget] = useState(null);
  const [loginMessage, setLoginMessage] = useState("");
  const isDark = theme === "dark";

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
    window.navigateToArchiveReceipt = (receiptNo) => {
      setQrScanTarget(receiptNo);
      setActivePage("archive");
    };
    return () => { delete window.navigateToArchiveReceipt; };
  }, []);

  useEffect(() => { localStorage.setItem("theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("activePage", activePage); }, [activePage]);
  useEffect(() => { localStorage.setItem("isCalcOpen", isCalcOpen); }, [isCalcOpen]);

  // Route Guarding Effect
  useEffect(() => {
    if (!isAuthenticated && !publicPages.includes(activePage)) {
      setActivePage('login');
    }
  }, [isAuthenticated, activePage]);

  useEffect(() => {
    const handleSessionExpiry = () => {
      if (localStorage.getItem("isLoggedIn") === "true") {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userRole");
        setUserRole("user");
        setLoginMessage("Your session has expired. Please log in again.");
        setIsAuthenticated(false);
        setActivePage("login");
      }
    };
    window.addEventListener('auth:session-expired', handleSessionExpiry);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpiry);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCalcOpen(false);
        const mobileAllowed = ['login', 'receipt', 'archive', 'verify', 'gatepass', 'dp_receipt', 'pricelist', 'attendance', 'info', 'profile', 'admin', 'audit'];
        if (!mobileAllowed.includes(activePage)) {
          setActivePage(isAuthenticated ? "receipt" : "login");
        }
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activePage, isAuthenticated]);

  const toggleTheme      = () => setTheme(isDark ? "light" : "dark");
  const toggleCalculator = () => setIsCalcOpen(v => !v);

  const handleLogin = (role, email) => {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userRole", role);
    if (email) localStorage.setItem("userEmail", email);
    setUserRole(role);
    setLoginMessage("");
    setIsAuthenticated(true);
    setActivePage("receipt");
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
      setActivePage("login");
    }
  };

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
          isCalcOpen={isCalcOpen}
          toggleCalculator={toggleCalculator}
          isAuthenticated={isAuthenticated}
        />
      </div>

      <div className="flex-1 w-full relative flex overflow-hidden">
        <div className="flex-1 relative overflow-hidden">

          <div className={`absolute inset-0 overflow-y-auto ${activePage === "login" ? "block" : "hidden"}`}>
            <Login onLogin={handleLogin} initialError={loginMessage} />
          </div>

          {isAuthenticated && (
            <>
              <div className={`absolute inset-0 overflow-y-auto ${activePage === "receipt" ? "block" : "hidden"}`}>
                <Receipt theme={theme} />
              </div>

              <div className={`absolute inset-0 overflow-hidden ${activePage === "archive" ? "block" : "hidden"}`}>
                <ArchivePage
                  theme={theme}
                  initialScanTarget={qrScanTarget}
                  onScanTargetConsumed={() => setQrScanTarget(null)}
                />
              </div>

              <div className={`absolute inset-0 overflow-y-auto ${activePage === "verify" ? "block" : "hidden"}`}>
                <Verify theme={theme} />
              </div>

              <div className={`absolute inset-0 overflow-y-auto ${activePage === "gatepass" ? "block" : "hidden"}`}>
                <SuzukiGatePass theme={theme} />
              </div>

              <div className={`absolute inset-0 overflow-y-auto ${activePage === "tally" ? "block" : "hidden"}`}>
                <XmlGenerator theme={theme} />
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

              <div className={`absolute inset-0 overflow-y-auto ${activePage === "audit" ? "block" : "hidden"}`}>
                {userRole === 'admin' && <AuditLogPage theme={theme} />}
              </div>
            </>
          )}

          {/* Public Views */}
          <div className={`absolute inset-0 overflow-hidden ${activePage === "pricelist" ? "block" : "hidden"}`}>
            <PriceList theme={theme} isActive={activePage === "pricelist"} />
          </div>

          <div className={`absolute inset-0 overflow-y-auto ${activePage === "dp_receipt" ? "block" : "hidden"}`}>
            <DpReceipt theme={theme} />
          </div>

          <div className={`absolute inset-0 overflow-y-auto ${activePage === "tools" ? "block" : "hidden"}`}>
            <ToolsPage theme={theme} />
          </div>

          <div className={`absolute inset-0 overflow-y-auto ${activePage === "attendance" ? "block" : "hidden"}`}>
            <AttendanceApp theme={theme} />
          </div>

        </div>

        {/* GLOBAL CALCULATOR SIDEBAR — desktop only */}
        {isCalcOpen && (
          <aside className={`w-[280px] lg:w-[320px] flex-none border-l flex flex-col h-full z-40 transition-all shadow-[-4px_0_15px_rgba(0,0,0,0.05)] ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
            <Calculator theme={theme} />
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;