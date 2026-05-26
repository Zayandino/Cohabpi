import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { signIn } = useAuth(); // Assume signUp is implemented in AuthContext if needed
  const navigate = useNavigate();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLoginMode) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/dashboard');
      } else {
        // Handle Register
        // const { error } = await signUp(email, password);
        // if (error) throw error;
        // navigate('/onboarding');
      }
    } catch (err) {
      setError(err.message);
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
            />
          </div>
          
          {error && <p style={{color: '#FF6B6B', fontSize: '0.85rem', marginBottom: '15px'}}>{error}</p>}
          
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Cargando...' : (isLoginMode ? 'Ingresar' : 'Registrar')}
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
              onClick={(e) => { e.preventDefault(); setIsLoginMode(!isLoginMode); }} 
              style={{ color: 'var(--crimson-bright)', fontWeight: 700, textDecoration: 'none', marginLeft: '5px' }}
            >
              {isLoginMode ? 'Regístrate' : 'Inicia Sesión'}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
