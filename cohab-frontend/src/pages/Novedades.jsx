import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Novedades() {
  const navigate = useNavigate();
  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNovedades() {
      try {
        // Intentar obtener de cohab_news si existe
        const { data, error } = await supabase
          .from('cohab_news')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setNovedades(data || []);
      } catch (err) {
        console.log("No se pudo cargar la tabla cohab_news o no existe. Usando novedades locales.");
      } finally {
        setLoading(false);
      }
    }
    fetchNovedades();
  }, []);

  return (
    <div>
      <div className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/dashboard')} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="top-bar-title">Novedades del Tatami</div>
      </div>

      <div className="content" style={{ paddingTop: '10px', paddingBottom: '30px' }}>
        
        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '0 5px' }}>Cargando novedades...</p>
        ) : (
          <div className="news-grid" style={{ gap: '20px' }}>
            {novedades.map(item => (
              <div key={item.id} className="glass-panel news-item" style={{ overflow: 'hidden', padding: 0, borderRadius: '16px', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-glass)' }}>
                {item.image_url && (
                  <div style={{ width: '100%', height: '200px', overflow: 'hidden', position: 'relative', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <img 
                      src={item.image_url} 
                      alt={item.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} 
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                    <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(6, 11, 24, 0.65)', backdropFilter: 'blur(8px)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {item.emoji || '📢'}
                    </div>
                  </div>
                )}
                
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {!item.image_url && (
                    <span className="news-emoji" style={{ fontSize: '2.2rem', marginBottom: '6px', display: 'block' }}>{item.emoji || '📢'}</span>
                  )}
                  
                  <h3 className="news-name" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'white', fontFamily: 'var(--font-display)', lineHeight: 1.3 }}>
                    {item.title}
                  </h3>
                  
                  <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', lineHeight: 1.5, margin: '8px 0 16px 0', whiteSpace: 'pre-line' }}>
                    {item.content}
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px' }}>
                    <span className="news-date" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(item.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    
                    <span style={{ 
                      fontSize: '0.68rem', 
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      background: 'linear-gradient(135deg, rgba(0, 180, 216, 0.15), rgba(16, 185, 129, 0.15))', 
                      color: 'var(--aurora)', 
                      padding: '4px 10px', 
                      borderRadius: '20px',
                      border: '1px solid rgba(0, 180, 216, 0.25)',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      🥋 {item.author || 'Cohab Los Andes'}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Novedades por defecto premium del tatami si no hay datos en la DB */}
            {novedades.length === 0 && (
              <>
                <div className="glass-panel news-item">
                  <span className="news-emoji">🥋</span>
                  <h3 className="news-name">Seminario de Guardia Lapel con Prof. Andrés</h3>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', lineHeight: 1.4, margin: '8px 0' }}>
                    Este sábado 30 de Mayo nos reuniremos para un entrenamiento intensivo enfocado en técnicas avanzadas de guardia de solapa. Cupos limitados, inscríbete en recepción.
                  </p>
                  <span className="news-date">25 de Mayo, 2026</span>
                </div>

                <div className="glass-panel news-item">
                  <span className="news-emoji">🏆</span>
                  <h3 className="news-name">Resultados del Open de Jiu-Jitsu Chile</h3>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', lineHeight: 1.4, margin: '8px 0' }}>
                    ¡Queremos felicitar a todos nuestros competidores que representaron a Cohab Los Andes este fin de semana! Trajimos a casa 3 medallas de oro y 2 de plata. ¡Orgullo de equipo!
                  </p>
                  <span className="news-date">24 de Mayo, 2026</span>
                </div>

                <div className="glass-panel news-item">
                  <span className="news-emoji">⏰</span>
                  <h3 className="news-name">Ajuste de Horarios en Invierno</h3>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', lineHeight: 1.4, margin: '8px 0' }}>
                    A partir del próximo mes, la clase nocturna de BJJ Avanzado comenzará 15 minutos antes (a las 20:15 hrs) para optimizar los traslados en época invernal. El resto del bloque sigue igual.
                  </p>
                  <span className="news-date">20 de Mayo, 2026</span>
                </div>
              </>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
