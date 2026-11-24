import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth";
import RequireAuth from "./components/RequireAuth";
import { Suspense, lazy } from "react";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

const EditorPage = lazy(() => import("./pages/EditorPage"));
const EnhancePage = lazy(() => import("./pages/EnhancePage"));
const CloudRestorePage = lazy(() => import("./pages/CloudRestorePage"));

function LoadingFallback() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      color: "#8a7a6e", fontFamily: "Inter, system-ui, sans-serif"
    }}>
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
            <Route path="/editor" element={<RequireAuth><EditorPage /></RequireAuth>} />
            <Route path="/enhance" element={<RequireAuth><EnhancePage /></RequireAuth>} />
            <Route path="/cloud-restore" element={<RequireAuth><CloudRestorePage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
