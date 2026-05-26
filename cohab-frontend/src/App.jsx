import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import BottomNav from './components/BottomNav';

import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import VideoLibrary from './pages/VideoLibrary';
import Profile from './pages/Profile';
import Payments from './pages/Payments';
import Novedades from './pages/Novedades';

import AdminDashboard from './pages/AdminDashboard';
import AdminSchedule from './pages/AdminSchedule';
import AdminTeachers from './pages/AdminTeachers';

function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Ambient Light Effect Original */}
        <div className="ambient-light">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>

        {/* Persistent Background Backdrop Original */}
        <div className="bg-panorama">
          <img src="/assets/bg-vitral-new.png" alt="Stained Glass BJJ" />
          <div className="bg-panorama-gradient"></div>
        </div>

        {/* Main App Container */}
        <div className="app">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/videos" element={<ProtectedRoute><VideoLibrary /></ProtectedRoute>} />
            <Route path="/novedades" element={<ProtectedRoute><Novedades /></ProtectedRoute>} />
            <Route path="/pagos" element={<ProtectedRoute><Payments /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/schedule" element={<ProtectedRoute requireAdmin={true}><AdminSchedule /></ProtectedRoute>} />
            <Route path="/admin/teachers" element={<ProtectedRoute requireAdmin={true}><AdminTeachers /></ProtectedRoute>} />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <BottomNav />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
