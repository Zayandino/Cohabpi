import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function Payments() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDiscounts() {
      try {
        setLoading(true);
        // Consultar descuentos dinámicos administrados desde la base de datos
        const { data, error } = await supabase
          .from('cohab_discounts')
          .select('*')
          .order('id', { ascending: true });
          
        if (error) {
          // Error visible para diagnóstico (RLS, permisos, etc.)
          console.error('fetchDiscounts error — código:', error?.code, '| mensaje:', error?.message, '| hint:', error?.hint);
          throw error;
        }
        console.log('fetchDiscounts — registros desde DB:', data?.length, data);
        setDiscounts(data || []);
      } catch (err) {
        console.error('Error al cargar convenios dinámicos:', err);
      } finally {
        setLoading(false);
      }
    }

    // Cargar al montar (no esperar profile para no retrasar la carga)
    fetchDiscounts();
  }, []);

  return (
    <div>
      <div className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/dashboard')} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="top-bar-title">Beneficios y Convenios</div>
      </div>

      <div className="content" style={{ paddingTop: '20px', paddingBottom: '70px' }}>
        
        {/* GALERÍA DE BENEFICIOS COHAB - VISIBLE PARA TODOS */}
        <div style={{ textAlign: 'center', marginBottom: '25px', animation: 'fadeIn 0.5s ease-out' }}>
          <div style={{ fontSize: '3rem', filter: 'drop-shadow(0 4px 12px rgba(0, 180, 216, 0.4))', marginBottom: '10px' }}>💎</div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.45rem', marginBottom: '8px' }}>
            Beneficios de la Comunidad Cohab
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '340px', margin: '0 auto', lineHeight: 1.45 }}>
            Descubre los convenios y descuentos exclusivos de los que puedes disfrutar al formar parte de Cohab Los Andes.
          </p>
        </div>

        </div>

        {/* Renderizar descuentos adicionales desde la base de datos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.75rem', padding: '10px' }}>Cargando convenios dinámicos...</p>
          ) : (
            discounts.map(disc => (
              <div key={disc.id} className="glass-panel" style={{ 
                padding: '18px', 
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(6, 11, 24, 0.8))', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                display: 'flex', 
                gap: '15px', 
                alignItems: 'center',
                borderRadius: '12px'
              }}>
                <span style={{ fontSize: '2.2rem' }}>{disc.code || disc.emoji || '🎁'}</span>
                <div>
                  <h4 style={{ color: 'white', margin: '0 0 4px 0', fontSize: '0.92rem', fontWeight: 800 }}>{disc.title}</h4>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.78rem', lineHeight: 1.35 }}>{disc.description}</p>
                </div>
              </div>
            ))
          )}

        </div>

        {/* ACCIÓN SEGÚN ROL / PARENTESCO */}
        {!profile?.parent_id ? (
          <div className="glass-panel" style={{
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(0, 180, 216, 0.12), rgba(6, 11, 24, 0.95))',
            border: '1px solid rgba(0, 180, 216, 0.25)',
            boxShadow: '0 10px 30px rgba(0, 180, 216, 0.12)',
            borderRadius: '12px',
            textAlign: 'center',
            marginTop: '25px',
            animation: 'fadeIn 0.5s ease-out'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💳</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'white', fontWeight: 800, margin: '0 0 8px 0' }}>
              Gestión de Planes y Pagos
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: '0 auto 20px', maxWidth: '320px' }}>
              Para contratar disciplinas de tu grupo familiar, simular mensualidades y realizar pagos seguros en línea mediante Mercado Pago, dirígete a tu perfil personal.
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="auth-btn"
              style={{
                width: '100%',
                maxWidth: '240px',
                height: '42px',
                background: 'linear-gradient(135deg, var(--aurora), #10B981)',
                color: '#060B18',
                fontWeight: 900,
                fontSize: '0.82rem',
                letterSpacing: '1px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                margin: '0 auto'
              }}
            >
              Ir a Mi Perfil
            </button>
          </div>
        ) : (
          <div className="glass-panel" style={{
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(6, 11, 24, 0.95))',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            boxShadow: '0 10px 30px rgba(245, 158, 11, 0.05)',
            borderRadius: '12px',
            textAlign: 'center',
            marginTop: '25px'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔒</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'white', fontWeight: 800, margin: '0 0 8px 0' }}>
              Planificación Reservada
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: '0 auto 15px', maxWidth: '300px' }}>
              La simulación de planes familiares y pagos está reservada exclusivamente para el administrador familiar o titular de la cuenta.
            </p>
            <div style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed rgba(245, 158, 11, 0.2)', borderRadius: '8px', fontSize: '0.72rem', color: '#F59E0B', fontWeight: 700 }}>
              Consulta con tu apoderado para que asigne tu plan e inscriba tus clases.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
