import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Onboarding() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [rut, setRut] = useState(profile?.rut || '');
  const [dob, setDob] = useState(profile?.birthdate || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.phone) setPhone(profile.phone);
      if (profile.rut) setRut(profile.rut);
      
      const isBirthdateBugged = profile.birthdate && profile.created_at && profile.birthdate === profile.created_at.substring(0, 10);
      if (profile.birthdate && !isBirthdateBugged) {
        setDob(profile.birthdate);
      }
    }
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('cohab_profiles')
        .update({
          name: name,
          phone: phone,
          rut: rut,
          birthdate: dob,
          role: 'miembro',
          waiver_signed: false // Inicialmente false (se firma al contratar plan)
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      // Redirigir al dashboard directamente
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
      <div className="auth-glass" style={{ textAlign: 'left' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/assets/logo-original.jpg" alt="Cohab Logo" style={{ width: '90px', borderRadius: '50%', border: '2px solid var(--border-glass)' }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--text-white)', marginTop: '12px' }}>¡Bienvenido a Cohab!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '8px' }}>Antes de empezar, completa tu perfil básico.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre Completo</label>
            <input type="text" className="form-input" placeholder="Ej. Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Tu Teléfono</label>
            <input type="tel" className="form-input" placeholder="+56 9..." value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">RUT (Para acceso futuro)</label>
            <input type="text" className="form-input" placeholder="12345678-9" value={rut} onChange={(e) => setRut(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Fecha de Nacimiento</label>
            <input 
              type="date" 
              className="form-input" 
              value={dob} 
              onChange={(e) => setDob(e.target.value)} 
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 16)).toISOString().split('T')[0]}
              required 
            />
          </div>

          {error && <p style={{color: '#FF6B6B', fontSize: '0.85rem', marginBottom: '15px'}}>{error}</p>}

          <button type="submit" className="auth-btn" style={{ background: 'linear-gradient(135deg, var(--crimson-deep), var(--crimson))' }} disabled={loading}>
            {loading ? 'Guardando...' : 'Comenzar mi camino'}
          </button>
        </form>
      </div>
    </div>
  );
}
