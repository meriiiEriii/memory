import { useEffect, useState } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../auth";

function friendlyError(err) {
  const code = err && err.code ? err.code : "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error — check your internet connection.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled in the Firebase console yet.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";
  const from = (location.state && location.state.from) || "/";

  useEffect(() => {
    document.title = "Sign in — Memory Lane";
    document.body.classList.add("auth-page");
    return () => document.body.classList.remove("auth-page");
  }, []);

  if (!loading && user) return <Navigate to={from} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (registering) {
        if (password !== confirm) {
          throw { code: "auth/mismatch" };
        }
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      window.location.assign(from);
    } catch (err) {
      setError(
        err && err.code === "auth/mismatch"
          ? "Passwords do not match."
          : friendlyError(err)
      );
      setBusy(false);
    }
  }

  return (
    <main className="auth-main">
      <div className="auth-card">
        <Link className="brand auth-brand" to="/">
          <span className="brand-mark">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          </span>
          Memory Lane
        </Link>

        <h1>{registering ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">
          {registering
            ? "One free account for the whole Memory Lane studio."
            : "Sign in to open the Memory Lane studio."}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label className="auth-label" htmlFor="auth-email">Email</label>
          <input
            className="auth-input"
            type="email"
            id="auth-email"
            autoComplete="email"
            required
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="auth-label" htmlFor="auth-password">Password</label>
          <input
            className="auth-input"
            type="password"
            id="auth-password"
            autoComplete={registering ? "new-password" : "current-password"}
            required
            minLength={6}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {registering && (
            <>
              <label className="auth-label" htmlFor="auth-confirm">Confirm password</label>
              <input
                className="auth-input"
                type="password"
                id="auth-confirm"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </>
          )}

          <button className="btn btn-block" type="submit" disabled={busy}>
            {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
          </button>
        </form>

        {error && (
          <p className="auth-error" role="alert">{error}</p>
        )}

        <p className="auth-switch">
          {registering ? "Already have an account?" : "New to Memory Lane?"}{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setMode(registering ? "login" : "register");
              setError("");
            }}
          >
            {registering ? "Sign in" : "Create a free account"}
          </a>
        </p>

        <Link className="auth-back" to="/">&larr; Back to the homepage</Link>
      </div>
    </main>
  );
}
