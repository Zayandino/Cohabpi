import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>Cargando validación...</div>;
  }

  // Sin sesión → al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Usuario autenticado pero con perfil incompleto (onboarding pendiente o sin nombre).
  // O usuarios afectados por el bug de fecha de nacimiento (fecha de registro).
  // Solo aplica si NO estamos ya en /onboarding para evitar loops.
  const isBirthdateBugged = profile?.birthdate && profile?.created_at && 
    (profile.birthdate === profile.created_at.substring(0, 10));

  if (profile && (!profile.phone || !profile.name || !profile.birthdate || isBirthdateBugged) && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Ruta que requiere admin
  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
