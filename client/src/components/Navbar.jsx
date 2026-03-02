import React, { useState, useEffect, useRef } from "react";
import {
  Moon, Sun, LogOut, UserCircle, Shield, Calculator,
  ChevronLeft, ChevronRight, Menu
} from "lucide-react";

const NavbarStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500&family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

    .nb-root {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 60px;
      z-index: 50;
      display: flex;
      align-items: stretch;
      font-family: 'DM Sans', sans-serif;
      transition: background 0.3s, border-color 0.3s;
    }

    /* ── Light ── */
    .nb-root.light {
      background: rgba(255,255,255,0.96);
      border-bottom: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .nb-root.light::after {
      content: '';
      position: absolute;
      bottom: -1px; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, #4f63f0, transparent);
      opacity: 0.45;
      pointer-events: none;
    }

    /* ── Dark ── */
    .nb-root.dark {
      background: rgba(17,24,39,0.97);
      border-bottom: 1px solid rgba(255,255,255,0.07);
      box-shadow: 0 1px 12px rgba(0,0,0,0.3);
    }
    .nb-root.dark::after {
      content: '';
      position: absolute;
      bottom: -1px; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, #4f63f0, transparent);
      opacity: 0.6;
      pointer-events: none;
    }

    /* ── Brand ── */
    .nb-brand {
      flex: none;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px 0 18px;
      border-right: 1px solid;
      transition: border-color 0.3s;
      text-decoration: none;
      cursor: default;
      user-select: none;
    }
    .nb-root.light .nb-brand { border-color: rgba(0,0,0,0.07); }
    .nb-root.dark  .nb-brand { border-color: rgba(255,255,255,0.07); }

    .nb-brand-icon {
      width: 30px; height: 30px;
      border-radius: 8px;
      background: linear-gradient(135deg, #4f63f0, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 18px rgba(79,99,240,0.35);
      flex-shrink: 0;
    }
    .nb-brand-text {
      font-family: 'Syne', sans-serif;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.4px;
      white-space: nowrap;
    }
    .nb-root.light .nb-brand-text { color: #111827; }
    .nb-root.dark  .nb-brand-text { color: #f9fafb; }
    .nb-brand-text span { color: #4f63f0; }

    /* ── Nav scroll region ── */
    .nb-nav-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      position: relative;
      overflow: hidden;
      min-width: 0;
    }
    .nb-nav-scroll {
      display: flex;
      align-items: center;
      gap: 4px;
      overflow-x: auto;
      padding: 0 10px;
      scroll-behavior: smooth;
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .nb-nav-scroll::-webkit-scrollbar { display: none; }

    /* Fade edges */
    .nb-nav-fade-left,
    .nb-nav-fade-right {
      position: absolute;
      top: 0; bottom: 0;
      width: 28px;
      pointer-events: none;
      z-index: 2;
    }
    .nb-nav-fade-left  { left: 0; }
    .nb-nav-fade-right { right: 0; }
    .nb-root.light .nb-nav-fade-left  { background: linear-gradient(to right, rgba(255,255,255,0.95), transparent); }
    .nb-root.light .nb-nav-fade-right { background: linear-gradient(to left,  rgba(255,255,255,0.95), transparent); }
    .nb-root.dark  .nb-nav-fade-left  { background: linear-gradient(to right, rgba(17,24,39,0.97), transparent); }
    .nb-root.dark  .nb-nav-fade-right { background: linear-gradient(to left,  rgba(17,24,39,0.97), transparent); }

    /* Scroll arrows */
    .nb-scroll-arrow {
      position: absolute;
      top: 50%; transform: translateY(-50%);
      z-index: 5;
      width: 26px; height: 26px;
      border-radius: 6px;
      border: 1px solid;
      background: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: opacity 0.2s, background 0.2s;
      padding: 0;
    }
    .nb-scroll-arrow.left  { left: 4px; }
    .nb-scroll-arrow.right { right: 4px; }
    .nb-root.light .nb-scroll-arrow { border-color: rgba(0,0,0,0.12); color: #6b7280; }
    .nb-root.dark  .nb-scroll-arrow { border-color: rgba(255,255,255,0.1); color: #9ca3af; }
    .nb-root.light .nb-scroll-arrow:hover { background: rgba(0,0,0,0.05); color: #111827; }
    .nb-root.dark  .nb-scroll-arrow:hover { background: rgba(255,255,255,0.07); color: #f9fafb; }

    /* ── Nav items ── */
    .nb-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid transparent;
      font-family: 'Syne', sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.3px;
      white-space: nowrap;
      cursor: pointer;
      background: none;
      transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
      outline: none;
    }
    .nb-item .nb-item-icon { opacity: 0.7; flex-shrink: 0; transition: opacity 0.15s; }
    .nb-item:hover .nb-item-icon { opacity: 1; }

    /* Inactive - light */
    .nb-root.light .nb-item {
      color: #6b7280;
    }
    .nb-root.light .nb-item:hover {
      background: rgba(79,99,240,0.07);
      color: #4f63f0;
      border-color: rgba(79,99,240,0.15);
    }

    /* Inactive - dark */
    .nb-root.dark .nb-item {
      color: #9ca3af;
    }
    .nb-root.dark .nb-item:hover {
      background: rgba(79,99,240,0.1);
      color: #818cf8;
      border-color: rgba(79,99,240,0.2);
    }

    /* Active */
    .nb-root.light .nb-item.active {
      background: #4f63f0;
      color: #fff;
      border-color: transparent;
      box-shadow: 0 2px 8px rgba(79,99,240,0.3);
    }
    .nb-root.dark .nb-item.active {
      background: rgba(79,99,240,0.9);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 2px 12px rgba(79,99,240,0.4);
    }
    .nb-item.active .nb-item-icon { opacity: 1; }

    /* ── Divider ── */
    .nb-divider {
      flex: none;
      width: 1px;
      height: 28px;
      margin: 0 8px;
      align-self: center;
    }
    .nb-root.light .nb-divider { background: rgba(0,0,0,0.08); }
    .nb-root.dark  .nb-divider { background: rgba(255,255,255,0.08); }

    /* ── Action bar ── */
    .nb-actions {
      flex: none;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 16px 0 12px;
      border-left: 1px solid;
    }
    .nb-root.light .nb-actions { border-color: rgba(0,0,0,0.07); }
    .nb-root.dark  .nb-actions { border-color: rgba(255,255,255,0.07); }

    /* Action icon buttons */
    .nb-action-btn {
      width: 34px; height: 34px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
      position: relative;
    }

    /* Calculator enlarged button */
    .nb-action-btn.is-calc {
      width: 42px; height: 42px;
    }

    /* Default colour per theme */
    .nb-root.light .nb-action-btn { color: #9ca3af; }
    .nb-root.dark  .nb-action-btn { color: #6b7280; }

    /* Hover */
    .nb-root.light .nb-action-btn:hover { background: rgba(0,0,0,0.05); color: #374151; border-color: rgba(0,0,0,0.08); }
    .nb-root.dark  .nb-action-btn:hover { background: rgba(255,255,255,0.07); color: #d1d5db; border-color: rgba(255,255,255,0.1); }

    /* Active states per button type */
    .nb-action-btn.is-active-calc {
      background: rgba(5,150,105,0.1);
      color: #059669;
      border-color: rgba(5,150,105,0.2);
    }
    .nb-root.dark .nb-action-btn.is-active-calc {
      background: rgba(52,211,153,0.1);
      color: #34d399;
      border-color: rgba(52,211,153,0.2);
    }

    .nb-action-btn.is-theme {
      color: inherit;
    }
    .nb-root.light .nb-action-btn.is-theme { color: #6b7280; }
    .nb-root.dark  .nb-action-btn.is-theme { color: #fbbf24; }
    .nb-root.dark  .nb-action-btn.is-theme:hover { color: #fde68a; }

    /* Tooltip */
    .nb-action-btn::after {
      content: attr(data-tip);
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%; transform: translateX(-50%);
      background: #111827;
      color: #f9fafb;
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      padding: 4px 8px;
      border-radius: 6px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 100;
    }
    .nb-root.light .nb-action-btn::after { background: #1f2937; }
    .nb-action-btn:hover::after { opacity: 1; }

    /* ── Dropdown Menu ── */
    .nb-menu-wrapper {
      position: relative;
    }
    .nb-dropdown {
      position: absolute;
      top: calc(100% + 12px);
      right: 0;
      min-width: 180px;
      border-radius: 8px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 100;
    }
    .nb-root.light .nb-dropdown {
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .nb-root.dark .nb-dropdown {
      background: #1f2937;
      border: 1px solid rgba(255,255,255,0.07);
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .nb-dropdown-btn {
      display: flex; align-items: center; gap: 10px;
      width: 100%; text-align: left;
      padding: 8px 12px;
      border-radius: 6px;
      border: none; background: none;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .nb-root.light .nb-dropdown-btn { color: #374151; }
    .nb-root.light .nb-dropdown-btn:hover { background: rgba(0,0,0,0.05); }
    .nb-root.dark .nb-dropdown-btn { color: #d1d5db; }
    .nb-root.dark .nb-dropdown-btn:hover { background: rgba(255,255,255,0.07); }

    .nb-dropdown-btn.active {
      color: #4f63f0;
      background: rgba(79,99,240,0.08);
    }
    .nb-root.dark .nb-dropdown-btn.active {
      color: #818cf8;
      background: rgba(99,102,241,0.15);
    }

    .nb-dropdown-btn.logout { color: #ef4444; }
    .nb-root.light .nb-dropdown-btn.logout:hover { background: rgba(239,68,68,0.1); }
    .nb-root.dark .nb-dropdown-btn.logout:hover { background: rgba(239,68,68,0.15); }

  `}</style>
);

const pages = [
  { id: "receipt",    name: "Receipt"},
  { id: "verify",    name: "Verify"},
  { id: "pricelist", name: "Price List"},
  { id: "gatepass",  name: "Gate Pass"},
  { id: "dp_receipt",name: "DP Receipt" },
  { id: "vahan",     name: "VAHAN"},
  { id: "dms",       name: "DMS Names"},
  { id: "tally",     name: "TALLY"},
  { id: "attendance",name: "Attendance"},
  { id: "info",      name: "Info"},
];

const Navbar = ({
  activePage,
  setActivePage,
  theme,
  toggleTheme,
  onLogout,
  userRole,
  isCalcOpen,
  toggleCalculator,
}) => {
  const isDark = theme === "dark";
  const mode = isDark ? "dark" : "light";
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    if (el) ro.observe(el);
    return () => { el?.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, []);

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
  };

  return (
    <>
      <NavbarStyle />
      <nav className={`nb-root ${mode}`}>

        {/* Brand */}
        <div className="nb-brand">
          <span className="nb-brand-text" style={{ display: "none" }}>
            Value<span>One</span>
          </span>
          {/* Show text on wider screens via inline media trick */}
          <style>{`@media(min-width:1024px){.nb-brand-text{display:block!important}}`}</style>
        </div>

        {/* Scrollable nav */}
        <div className="nb-nav-wrap">
          {canScrollLeft && (
            <>
              <div className="nb-nav-fade-left" />
              <button className="nb-scroll-arrow left" onClick={() => scroll(-1)} tabIndex={-1} aria-label="Scroll left">
                <ChevronLeft size={16} />
              </button>
            </>
          )}

          <div className="nb-nav-scroll" ref={scrollRef}>
            {pages.map((page) => {
              const isActive = activePage === page.id;
              return (
                <button
                  key={page.id}
                  onClick={() => setActivePage(page.id)}
                  className={`nb-item${isActive ? " active" : ""}`}
                >
                  {page.name}
                </button>
              );
            })}
          </div>

          {canScrollRight && (
            <>
              <div className="nb-nav-fade-right" />
              <button className="nb-scroll-arrow right" onClick={() => scroll(1)} tabIndex={-1} aria-label="Scroll right">
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>

        {/* Action bar */}
        <div className="nb-actions">

          <button
            onClick={toggleCalculator}
            data-tip="Calculator"
            className={`nb-action-btn is-calc${isCalcOpen ? " is-active-calc" : ""}`}
          >
            <Calculator size={20} />
          </button>

          <button
            onClick={toggleTheme}
            data-tip={isDark ? "Light mode" : "Dark mode"}
            className="nb-action-btn is-theme"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <div className="nb-divider" />

          {/* Burger Menu for User Actions */}
          <div className="nb-menu-wrapper">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              data-tip="Menu"
              className="nb-action-btn"
            >
              <Menu size={18} />
            </button>

            {isMenuOpen && (
              <div className="nb-dropdown">
                {userRole === "admin" && (
                  <button
                    className={`nb-dropdown-btn${activePage === "admin" ? " active" : ""}`}
                    onClick={() => { setActivePage("admin"); setIsMenuOpen(false); }}
                  >
                    <Shield size={16} /> Admin Panel
                  </button>
                )}
                
                <button
                  className={`nb-dropdown-btn${activePage === "profile" ? " active" : ""}`}
                  onClick={() => { setActivePage("profile"); setIsMenuOpen(false); }}
                >
                  <UserCircle size={16} /> Profile
                </button>
                
                <button
                  className="nb-dropdown-btn logout"
                  onClick={() => { onLogout(); setIsMenuOpen(false); }}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>

        </div>
      </nav>
    </>
  );
};

export default Navbar;