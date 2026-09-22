import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ui/ProtectedRoutes";
import Home from './pages/Home';
import Lounge from './pages/Lounge';
import Rooms from './pages/Rooms';
import Devices from './pages/Devices';
import Reports from './pages/Reports';
import AttendanceQR from './pages/AttendanceQR';
import AttendanceForm from './pages/AttendanceForm';
import IacMobile from './pages/IacMobile';
import Login from './pages/Login';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes — never touch ProtectedRoute */}
        <Route path="/attendance/:token" element={<AttendanceForm />} />
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Home />} />
          <Route path="lounge" element={<Lounge />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="devices" element={<Devices />} />
          <Route path="reports" element={<Reports />} />
          <Route path="attendance-qr" element={<AttendanceQR />} />
          <Route path="iac-mobile" element={<IacMobile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;