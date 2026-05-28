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

  // Usuario autenticado pero con perfil incompleto (onboarding pendiente).
  // El trigger handle_new_user() crea el perfil sin teléfono → redirigir a onboarding.
  // Solo aplica si NO estamos ya en /onboarding para evitar loops.
  if (profile && !profile.phone && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Ruta que requiere admin
  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
