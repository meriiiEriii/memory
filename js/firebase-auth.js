// Memory Lane — Firebase authentication (login / register / logout)
// Uses the Firebase CDN SDK. Included with: <script type="module" src="js/firebase-auth.js"></script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAl43visRZqdut_pRvIZFM_R-WACCtJ9A",
  authDomain: "website-31fc8.firebaseapp.com",
  projectId: "website-31fc8",
  storageBucket: "website-31fc8.firebasestorage.app",
  messagingSenderId: "862634117481",
  appId: "1:862634117481:web:fbb3a72188a8a86783d5f8",
  measurementId: "G-ZJL4C2VGP4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

const isLoginPage = document.getElementById("login-form") !== null;

// Turn Firebase error codes into friendly sentences.
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

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ------------------------------------------------------------------ */
/* Login / Register page                                               */
/* ------------------------------------------------------------------ */
if (isLoginPage) {
  const form = document.getElementById("login-form");
  const title = document.getElementById("auth-title");
  const sub = document.getElementById("auth-sub");
  const submitBtn = document.getElementById("auth-submit");
  const errorEl = document.getElementById("auth-error");
  const switchLink = document.getElementById("toggle-mode");
  const switchText = document.getElementById("switch-text");
  const confirmRow = document.getElementById("confirm-row");
  const confirmInput = document.getElementById("auth-confirm");

  let mode = "login"; // "login" | "register"

  function setMode(next) {
    mode = next;
    const registering = mode === "register";
    title.textContent = registering ? "Create your account" : "Welcome back";
    sub.textContent = registering
      ? "One free account for the whole Memory Lane studio."
      : "Sign in to open the Memory Lane studio.";
    submitBtn.textContent = registering ? "Create account" : "Sign in";
    switchText.textContent = registering
      ? "Already have an account?"
      : "New to Memory Lane?";
    switchLink.textContent = registering ? "Sign in" : "Create a free account";
    confirmRow.classList.toggle("hidden-row", !registering);
    confirmInput.classList.toggle("hidden-row", !registering);
    confirmInput.required = registering;
    errorEl.hidden = true;
  }

  switchLink.addEventListener("click", (e) => {
    e.preventDefault();
    setMode(mode === "login" ? "register" : "login");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;

    errorEl.hidden = true;
    submitBtn.disabled = true;

    try {
      if (mode === "register") {
        if (password !== confirmInput.value) {
          throw { code: "auth/mismatch", message: "Passwords do not match" };
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      window.location.replace("index.html");
    } catch (err) {
      errorEl.textContent =
        err && err.code === "auth/mismatch"
          ? "Passwords do not match."
          : friendlyError(err);
      errorEl.hidden = false;
      submitBtn.disabled = false;
    }
  });

  // Already signed in? Skip the form.
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.replace("index.html");
  });
}

/* ------------------------------------------------------------------ */
/* Protected pages: guard + navbar account area                        */
/* ------------------------------------------------------------------ */
else {
  const authArea = document.getElementById("auth-area");

  function renderAuthArea(user) {
    if (!authArea) return;
    const email = escapeHTML(user.email || "Signed in");
    const existingBtn = document.getElementById("btn-logout");
    if (existingBtn) {
      // Page provides its own styled logout button — just fill in the email.
      const emailEl = document.getElementById("auth-user-email");
      if (emailEl) emailEl.textContent = email;
    } else {
      authArea.innerHTML =
        '<span class="auth-user" title="' + email + '">' + email + "</span>" +
        '<button class="btn btn-sm btn-ghost" id="btn-logout" type="button">Log out</button>';
    }
    const btn = document.getElementById("btn-logout");
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", async () => {
        try {
          await signOut(auth);
        } finally {
          window.location.replace("login.html");
        }
      });
    }
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }
    document.documentElement.classList.remove("auth-wait");
    renderAuthArea(user);
  });
}
