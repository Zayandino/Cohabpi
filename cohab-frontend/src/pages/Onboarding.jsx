import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [rut, setRut] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('cohab_profiles')
        .update({
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
            <label className="form-label">Tu Teléfono</label>
            <input type="tel" className="form-input" placeholder="+56 9..." value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">RUT (Para acceso futuro)</label>
            <input type="text" className="form-input" placeholder="12345678-9" value={rut} onChange={(e) => setRut(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Fecha de Nacimiento</label>
            <input type="date" className="form-input" value={dob} onChange={(e) => setDob(e.target.value)} required />
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
