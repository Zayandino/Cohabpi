import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Cargando validación...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
