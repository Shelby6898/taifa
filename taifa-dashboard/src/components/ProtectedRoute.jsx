import { Navigate } from "react-router-dom";
import useInactivityLogout from "../hooks/useInactivityLogout";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  useInactivityLogout();

  if (!token) return <Navigate to="/login" replace />;
  return children;
}
