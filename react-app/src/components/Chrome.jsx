import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";

function BrandMark() {
  return (
    <span className="brand-mark">
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
    </span>
  );
}

export function AccountArea() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <span className="auth-area">
      <span className="auth-user" title={user.email}>{user.email}</span>
      <button className="btn btn-sm btn-ghost" type="button" onClick={logout}>
        Log out
      </button>
    </span>
  );
}

/* Compact account icon with a dropdown (email + log out). */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  if (!user) return null;
  const initial = (user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="account-menu" ref={ref}>
      <button
        className="account-btn"
        type="button"
        title={user.email}
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {initial}
      </button>
      {open && (
        <div className="account-pop" role="menu">
          <div className="account-pop-label">Signed in as</div>
          <div className="account-email" title={user.email}>{user.email}</div>
          <button
            className="account-logout"
            type="button"
            role="menuitem"
            onClick={logout}
          >
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function HomeNav() {
  return (
    <nav className="nav" id="nav" aria-label="Main navigation">
      <Link className="brand" to="/">
        <BrandMark />
        Memory Lane
      </Link>
      <ul className="nav-links">
        <li><a href="#demo">See it work</a></li>
        <li><a href="#how">How it works</a></li>
        <li><a href="#features">Features</a></li>
      </ul>
      <AccountMenu />
      <Link className="btn btn-sm" to="/enhance">AI Enhance</Link>
      <Link className="btn btn-sm" to="/editor">Open Studio</Link>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <Link className="brand" to="/" style={{ fontSize: 18 }}>
          <span className="brand-mark" style={{ width: 28, height: 28 }}>
            <svg className="icon" style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          </span>
          Memory Lane
        </Link>
        <ul className="footer-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#features">Features</a></li>
          <li><Link to="/editor">Studio</Link></li>
        </ul>
        <small>© <span id="year"></span> Memory Lane. A school project crafted with React, CSS and JavaScript.</small>
      </div>
    </footer>
  );
}
