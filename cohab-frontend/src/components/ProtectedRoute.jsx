import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        color: '#FFFFFF',
        textAlign: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: '#C4151C',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ fontSize: '0.95rem', color: '#CBD5E1', fontWeight: 500 }}>
          Cargando academia COHAB...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
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

  if (profile && (!profile.phone || !profile.name || !profile.birthdate || isBirthdateBugged) && location.pathname !== '/onboarding' && location.pathname !== '/registro') {
    return <Navigate to="/registro" replace />;
  }

  // Ruta que requiere admin
  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
