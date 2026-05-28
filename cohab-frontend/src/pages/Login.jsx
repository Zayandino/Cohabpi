import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Mensaje informativo (ej: "revisa tu correo" si email confirmation está activo)
  const [infoMessage, setInfoMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (isLoginMode) {
        // INICIO DE SESIÓN
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/dashboard');
      } else {
        // REGISTRO DE NUEVO ALUMNO
        const { data, error } = await signUp(email, password);
        if (error) throw error;

        if (data?.session) {
          // Sin confirmación de email → sesión activa inmediatamente
          // El trigger handle_new_user() ya creó el perfil en cohab_profiles
          navigate('/onboarding');
        } else {
          // Supabase requiere confirmación de email antes de activar la sesión
          setInfoMessage('✉️ Te enviamos un correo de confirmación. Revísalo y haz clic en el enlace para activar tu cuenta.');
        }
      }
    } catch (err) {
      // Traducir mensajes comunes de Supabase al español
      const msg = err.message || '';
      if (msg.includes('already registered') || msg.includes('User already registered')) {
        setError('Este correo ya tiene una cuenta. Inicia sesión o usa "¿Olvidaste tu contraseña?".');
      } else if (msg.includes('Invalid login credentials')) {
        setError('Correo o contraseña incorrectos. Verifica tus datos.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.');
      } else if (msg.includes('Password should be at least')) {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper screen-auth">
      {/* Background Panorama specific to login */}
      <div className="bg-panorama" style={{position:'fixed', zIndex: -1, top:0, left:0, width:'100%', height:'100%'}}>
        <img src="/assets/bg-vitral-new.png" alt="Stained Glass BJJ" style={{width:'100%', height:'100%', objectFit:'cover', opacity: 0.8, filter: 'saturate(1.25) contrast(1.12)', mixBlendMode: 'color-dodge'}} />
        <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'linear-gradient(180deg, rgba(6, 11, 24, 0.1) 0%, rgba(6, 11, 24, 0.7) 35%, var(--bg-deep) 65%)'}}></div>
      </div>

      <div className="auth-glass">
        <div className="auth-header">
          <img src="/assets/logo-original.jpg" alt="Cohab Logo" className="auth-card-logo" />
          <h1 className="auth-title">{isLoginMode ? 'Acceso Alumnos' : 'Registro de Alumnos'}</h1>
        </div>

        {/* Mensaje informativo (confirmación de email) */}
        {infoMessage && (
          <div style={{
            background: 'rgba(52, 211, 153, 0.08)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#34D399',
            fontSize: '0.82rem',
            lineHeight: 1.5
          }}>
            {infoMessage}
          </div>
        )}

        {!infoMessage && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="correo@ejemplo.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                minLength={6}
              />
            </div>
            
            {error && (
              <p style={{color: '#FF6B6B', fontSize: '0.82rem', marginBottom: '15px', lineHeight: 1.4}}>
                ⚠️ {error}
              </p>
            )}
            
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Procesando...' : (isLoginMode ? 'Ingresar' : 'Crear Cuenta')}
            </button>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isLoginMode && (
                <div style={{ marginBottom: '12px' }}>
                  <a href="#" style={{ color: 'var(--text-light)', textDecoration: 'none', fontWeight: 500, fontSize: '0.8rem' }}>
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              )}
              <span>{isLoginMode ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}</span>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setIsLoginMode(!isLoginMode); setError(null); }} 
                style={{ color: 'var(--crimson-bright)', fontWeight: 700, textDecoration: 'none', marginLeft: '5px' }}
              >
                {isLoginMode ? 'Regístrate' : 'Inicia Sesión'}
              </a>
            </div>
          </form>
        )}

        {/* Botón para volver al login si ya confirmó el email */}
        {infoMessage && (
          <button
            onClick={() => { setInfoMessage(null); setIsLoginMode(true); setEmail(''); setPassword(''); }}
            className="auth-btn"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', marginTop: '8px' }}
          >
            Volver al Login
          </button>
        )}
      </div>
    </div>
  );
}
