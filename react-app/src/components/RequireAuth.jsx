import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8a7a6e",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Checking your session…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
