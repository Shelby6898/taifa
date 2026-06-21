import { BrowserRouter, Routes, Route } from "react-router-dom";
import Welcome from "./pages/Welcome.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard";
import Assets from "./pages/Assets";
import Transfers from "./pages/Transfers.js";
import Maintenance from "./pages/Maintenance";
import Reports from "./pages/Reports";
import Users from "./pages/Users.jsx";
import Notifications from "./pages/Notifications";
import Depreciation from "./pages/Depreciation";
import ICTHelpdesk from "./pages/ICTHelpdesk";
import Settings from "./pages/Settings";
import Organizations from "./pages/Organizations";
import OrgSettings from "./pages/OrgSettings";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
          <Route path="assets"        element={<Assets />} />
          <Route path="transfers"     element={<Transfers />} />
          <Route path="maintenance"   element={<Maintenance />} />
          <Route path="reports"       element={<Reports />} />
          <Route path="users"         element={<Users />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="depreciation"  element={<Depreciation />} />
          <Route path="ict-helpdesk"  element={<ICTHelpdesk />} />
          <Route path="settings"       element={<Settings />} />
          <Route path="organizations" element={<Organizations />} />
          <Route path="org-settings" element={<OrgSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
