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

  return (
    <nav className="bottom-nav" id="bottom-nav" style={{ zIndex: 100 }}>
      
      <Link to="/videos" className={`nav-tab ${isActive('/videos')}`} style={{ textDecoration: 'none' }} aria-label="Academia">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={iconStyle}>
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <span className="nav-tab-label" style={{ color: 'white' }}>Academia</span>
      </Link>

      <Link to="/novedades" className={`nav-tab ${isActive('/novedades')}`} style={{ textDecoration: 'none' }} aria-label="Noticias">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={iconStyle}>
          <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M2 15h10"></path>
          <path d="M2 18h10"></path>
        </svg>
        <span className="nav-tab-label" style={{ color: 'white' }}>Noticias</span>
      </Link>

      <Link to="/dashboard" className={`nav-tab nav-center-btn ${isActive('/dashboard')}`} style={{ textDecoration: 'none' }} aria-label="Inicio">
        <div className="nav-logo-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/assets/logo-original.jpg" alt="Cohab Logo" className="nav-center-logo" style={{ display: 'block' }} />
        </div>
      </Link>

      <Link to="/beneficios" className={`nav-tab ${isActive('/beneficios')}`} style={{ textDecoration: 'none' }} aria-label="Beneficios">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={iconStyle}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <span className="nav-tab-label" style={{ color: 'white' }}>Beneficios</span>
      </Link>

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
