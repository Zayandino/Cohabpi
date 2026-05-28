import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const EyeIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const getPasswordStrength = (pwd) => {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { label: 'Débil', color: '#EF4444', width: '25%' };
  if (score <= 2) return { label: 'Regular', color: '#F59E0B', width: '50%' };
  if (score <= 3) return { label: 'Buena', color: '#3B82F6', width: '75%' };
  return { label: 'Segura', color: '#10B981', width: '100%' };
};

const translateAuthError = (msg = '') => {
  if (msg.includes('already registered') || msg.includes('User already registered'))
    return 'Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.';
  if (msg.includes('Invalid login credentials'))
    return 'Correo o contraseña incorrectos. Verifica tus datos.';
  if (msg.includes('Email not confirmed'))
    return 'Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.';
  if (msg.includes('Password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('over_email_send_rate_limit') || msg.includes('rate limit'))
    return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
  if (msg.includes('User not found') || msg.includes('user_not_found'))
    return 'No encontramos ninguna cuenta con ese correo.';
  if (msg.includes('expired') || msg.includes('Token has expired'))
    return 'El enlace expiró. Solicita uno nuevo.';
  if (msg.includes('same_password') || msg.includes('New password should be different'))
    return 'La nueva contraseña debe ser diferente a la anterior.';
  return msg;
};

// Modes: 'login' | 'register' | 'forgot' | 'new_password'
export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');

  // Login / Register
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  // Forgot password
  const [resetEmail, setResetEmail]     = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent]       = useState(false);
  const [resetError, setResetError]     = useState(null);

  // New password (after clicking reset link)
  const [newPwd, setNewPwd]               = useState('');
  const [confirmPwd, setConfirmPwd]       = useState('');
  const [showNewPwd, setShowNewPwd]       = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [newPwdLoading, setNewPwdLoading] = useState(false);
  const [newPwdError, setNewPwdError]     = useState(null);
  const [newPwdSuccess, setNewPwdSuccess] = useState(false);

  // Supabase fires PASSWORD_RECOVERY when the user arrives via the reset link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('new_password');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Auto-redirect after successful password reset
  useEffect(() => {
    if (!newPwdSuccess) return;
    const timer = setTimeout(() => navigate('/dashboard'), 2500);
    return () => clearTimeout(timer);
  }, [newPwdSuccess, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/dashboard');
      } else {
        const { data, error } = await signUp(email, password);
        if (error) throw error;
        if (data?.session) {
          navigate('/onboarding');
        } else {
          setInfoMessage('✉️ Te enviamos un correo de confirmación. Revísalo y haz clic en el enlace para activar tu cuenta.');
        }
      }
    } catch (err) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/login`
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setResetError(translateAuthError(err.message));
    } finally {
      setResetLoading(false);
    }
  };

  const handleNewPassword = async (e) => {
    e.preventDefault();
    setNewPwdError(null);

    if (newPwd.length < 8) {
      setNewPwdError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setNewPwdError('Las contraseñas no coinciden. Verifica e intenta de nuevo.');
      return;
    }

    setNewPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setNewPwdSuccess(true);
    } catch (err) {
      setNewPwdError(translateAuthError(err.message));
    } finally {
      setNewPwdLoading(false);
    }
  };

  const goToLogin = () => {
    setMode('login');
    setResetSent(false);
    setResetEmail('');
    setResetError(null);
    setError(null);
    setNewPwd('');
    setConfirmPwd('');
    setNewPwdError(null);
    setNewPwdSuccess(false);
  };

  const strength = getPasswordStrength(mode === 'new_password' ? newPwd : (mode === 'register' ? password : ''));
  const passwordsMatch = confirmPwd.length > 0 && newPwd === confirmPwd;

  const titleMap = {
    login: 'Acceso Alumnos',
    register: 'Registro de Alumnos',
    forgot: 'Recuperar Contraseña',
    new_password: 'Nueva Contraseña',
  };

  return (
    <div className="auth-wrapper screen-auth">
      <div className="bg-panorama" style={{ position: 'fixed', zIndex: -1, top: 0, left: 0, width: '100%', height: '100%' }}>
        <img src="/assets/bg-vitral-new.png" alt="Stained Glass BJJ" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8, filter: 'saturate(1.25) contrast(1.12)', mixBlendMode: 'color-dodge' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(180deg, rgba(6,11,24,0.1) 0%, rgba(6,11,24,0.7) 35%, var(--bg-deep) 65%)' }} />
      </div>

      <div className="auth-glass">
        <div className="auth-header">
          <img src="/assets/logo-original.jpg" alt="Cohab Logo" className="auth-card-logo" />
          <h1 className="auth-title">{titleMap[mode]}</h1>
        </div>

        {/* ══════════════ NUEVA CONTRASEÑA (llega desde el link del email) ══════════════ */}
        {mode === 'new_password' && (
          <>
            {newPwdSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.8rem', marginBottom: '12px' }}>🎉</div>
                <p style={{ color: '#34D399', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '8px' }}>
                  ¡Contraseña actualizada correctamente!
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  Redirigiendo al inicio…
                </p>
                <div style={{ marginTop: '16px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#34D399', animation: 'progressBar 2.5s linear forwards' }} />
                </div>
              </div>
            ) : (
              <form onSubmit={handleNewPassword}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '18px', lineHeight: 1.5 }}>
                  Elige una contraseña segura. Mínimo 8 caracteres.
                </p>

                {/* Nueva contraseña */}
                <div className="form-group">
                  <label className="form-label">Nueva contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Mínimo 8 caracteres"
                      value={newPwd}
                      onChange={(e) => { setNewPwd(e.target.value); setNewPwdError(null); }}
                      required
                      autoFocus
                      style={{ paddingRight: '44px' }}
                    />
                    <button type="button" onClick={() => setShowNewPwd(v => !v)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                      <EyeIcon open={showNewPwd} />
                    </button>
                  </div>

                  {/* Barra de fortaleza */}
                  {strength && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: strength.width, background: strength.color, transition: 'all 0.3s', borderRadius: '2px' }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: strength.color, marginTop: '4px', fontWeight: 700 }}>
                        Seguridad: {strength.label}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirmar contraseña */}
                <div className="form-group">
                  <label className="form-label">Confirmar contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Repite la contraseña"
                      value={confirmPwd}
                      onChange={(e) => { setConfirmPwd(e.target.value); setNewPwdError(null); }}
                      required
                      style={{ paddingRight: '44px', borderColor: confirmPwd.length > 0 ? (passwordsMatch ? 'rgba(52,211,153,0.5)' : 'rgba(239,68,68,0.5)') : undefined }}
                    />
                    <button type="button" onClick={() => setShowConfirmPwd(v => !v)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                      <EyeIcon open={showConfirmPwd} />
                    </button>
                  </div>
                  {confirmPwd.length > 0 && (
                    <div style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 700, color: passwordsMatch ? '#34D399' : '#EF4444' }}>
                      {passwordsMatch ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                    </div>
                  )}
                </div>

                {newPwdError && (
                  <p style={{ color: '#FF6B6B', fontSize: '0.82rem', marginBottom: '15px', lineHeight: 1.4 }}>
                    ⚠️ {newPwdError}
                  </p>
                )}

                <button type="submit" className="auth-btn" disabled={newPwdLoading || !passwordsMatch || newPwd.length < 8}>
                  {newPwdLoading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>
            )}
          </>
        )}

        {/* ══════════════ RECUPERAR CONTRASEÑA (solicitud de email) ══════════════ */}
        {mode === 'forgot' && (
          <>
            {resetSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📬</div>
                <p style={{ color: '#34D399', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '6px' }}>
                  Enlace de recuperación enviado a:
                </p>
                <p style={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', marginBottom: '16px' }}>
                  {resetEmail}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '20px' }}>
                  Revisa tu bandeja de entrada y carpeta de spam. El enlace expira en 1 hora.
                </p>
                <button onClick={goToLogin} className="auth-btn"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Volver al Login
                </button>
                <div style={{ marginTop: '14px' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); setResetSent(false); }}
                    style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textDecoration: 'none' }}>
                    ¿No llegó? Reenviar correo
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '18px', lineHeight: 1.5 }}>
                  Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
                </p>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="correo@ejemplo.com"
                    value={resetEmail}
                    onChange={(e) => { setResetEmail(e.target.value); setResetError(null); }}
                    required
                    autoFocus
                  />
                </div>
                {resetError && (
                  <p style={{ color: '#FF6B6B', fontSize: '0.82rem', marginBottom: '15px', lineHeight: 1.4 }}>
                    ⚠️ {resetError}
                  </p>
                )}
                <button type="submit" className="auth-btn" disabled={resetLoading}>
                  {resetLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); goToLogin(); }}
                    style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textDecoration: 'none' }}>
                    ← Volver al login
                  </a>
                </div>
              </form>
            )}
          </>
        )}

        {/* ══════════════ LOGIN / REGISTRO ══════════════ */}
        {(mode === 'login' || mode === 'register') && (
          <>
            {infoMessage && (
              <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#34D399', fontSize: '0.82rem', lineHeight: 1.5 }}>
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
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className="form-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      required
                      minLength={6}
                      style={{ paddingRight: '44px' }}
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                      <EyeIcon open={showPwd} />
                    </button>
                  </div>

                  {/* Indicador de fortaleza solo en registro */}
                  {mode === 'register' && strength && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: strength.width, background: strength.color, transition: 'all 0.3s', borderRadius: '2px' }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: strength.color, marginTop: '4px', fontWeight: 700 }}>
                        Seguridad: {strength.label}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <p style={{ color: '#FF6B6B', fontSize: '0.82rem', marginBottom: '15px', lineHeight: 1.4 }}>
                    ⚠️ {error}
                  </p>
                )}

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Procesando...' : (mode === 'login' ? 'Ingresar' : 'Crear Cuenta')}
                </button>

                <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {mode === 'login' && (
                    <div style={{ marginBottom: '12px' }}>
                      <a href="#"
                        onClick={(e) => { e.preventDefault(); setMode('forgot'); setResetEmail(email); setResetError(null); }}
                        style={{ color: 'var(--text-light)', textDecoration: 'none', fontWeight: 500, fontSize: '0.8rem' }}>
                        ¿Olvidaste tu contraseña?
                      </a>
                    </div>
                  )}
                  <span>{mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}</span>
                  <a href="#"
                    onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); setError(null); setPassword(''); setShowPwd(false); }}
                    style={{ color: 'var(--crimson-bright)', fontWeight: 700, textDecoration: 'none', marginLeft: '5px' }}>
                    {mode === 'login' ? 'Regístrate' : 'Inicia Sesión'}
                  </a>
                </div>
              </form>
            )}

            {infoMessage && (
              <button
                onClick={() => { setInfoMessage(null); setMode('login'); setEmail(''); setPassword(''); }}
                className="auth-btn"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', marginTop: '8px' }}>
                Volver al Login
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
