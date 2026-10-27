import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const { profile } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  if (currentPath === '/login' || currentPath === '/onboarding') {
    return null;
  }

  const isActive = (path) => currentPath === path ? 'active' : '';

  const iconStyle = { display: 'block', margin: '0 auto', stroke: 'white', opacity: 0.8 };
  
  const hasAccess = profile?.status === 'activo';
  const isInstructorOrAdmin = profile?.is_instructor || profile?.role === 'admin';

  return (
    <nav className="bottom-nav" id="bottom-nav" style={{ zIndex: 100 }}>
      {/* 1. Izquierda 1: Academia */}
      <Link 
        to={hasAccess ? "/videos" : "#"} 
        onClick={(e) => {
          if (!hasAccess) {
            e.preventDefault();
            alert('Debes habilitar un servicio para utilizar la academia.');
          }
        }}
        className={`nav-tab ${hasAccess && isActive('/videos')}`} 
        style={{ textDecoration: 'none', opacity: hasAccess ? 1 : 0.6 }} 
        aria-label="Academia"
      >
        {hasAccess ? (
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={iconStyle}>
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={{...iconStyle, stroke: '#FF4D4D', opacity: 1}}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        )}
        <span className="nav-tab-label" style={{ color: hasAccess ? 'white' : '#FF4D4D' }}>Academia</span>
      </Link>

      {/* 2. Izquierda 2: Noticias */}
      <Link to="/novedades" className={`nav-tab ${isActive('/novedades')}`} style={{ textDecoration: 'none' }} aria-label="Noticias">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={iconStyle}>
          <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M2 15h10"></path>
          <path d="M2 18h10"></path>
        </svg>
        <span className="nav-tab-label" style={{ color: 'white' }}>Noticias</span>
      </Link>

      {/* 3. Centro: Logo Inicio (perfectamente centrado) */}
      <Link to="/dashboard" className={`nav-tab nav-center-btn ${isActive('/dashboard')}`} style={{ textDecoration: 'none' }} aria-label="Inicio">
        <div className="nav-logo-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/assets/logo-original.jpg" alt="Cohab Logo" className="nav-center-logo" style={{ display: 'block' }} />
        </div>
      </Link>

      {/* 4. Derecha 1: Tatami (para instructores/admin) o Beneficios (para alumnos) */}
      {isInstructorOrAdmin ? (
        <Link to="/tatami" className={`nav-tab ${isActive('/tatami')}`} style={{ textDecoration: 'none' }} aria-label="Tatami">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={{ ...iconStyle, stroke: '#00B4D8' }}>
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
          </svg>
          <span className="nav-tab-label" style={{ color: '#00B4D8', fontWeight: 800 }}>Tatami</span>
        </Link>
      ) : (
        <Link to="/beneficios" className={`nav-tab ${isActive('/beneficios')}`} style={{ textDecoration: 'none' }} aria-label="Beneficios">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={iconStyle}>
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <span className="nav-tab-label" style={{ color: 'white' }}>Beneficios</span>
        </Link>
      )}

      {/* 5. Derecha 2: Perfil */}
      <Link to="/profile" className={`nav-tab ${isActive('/profile')}`} style={{ textDecoration: 'none' }} aria-label="Perfil">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={iconStyle}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="nav-tab-label" style={{ color: 'white' }}>Perfil</span>
      </Link>
    </nav>
  );
}
