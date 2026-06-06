import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Assets from "./pages/Assets";
import Transfers from "./pages/Transfers.js";
import Maintenance from "./pages/Maintenance";
import Reports from "./pages/Reports";
import Users from "./pages/Users.jsx";
import Notifications from "./pages/Notifications";
import Depreciation from "./pages/Depreciation";
import ICTHelpdesk from "./pages/ICTHelpdesk";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
          <Route path="assets"        element={<Assets />} />
          <Route path="transfers"     element={<Transfers />} />
          <Route path="maintenance"   element={<Maintenance />} />
          <Route path="reports"       element={<Reports />} />
          <Route path="users"         element={<Users />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="depreciation"  element={<Depreciation />} />
          <Route path="ict-helpdesk"  element={<ICTHelpdesk />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
