import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Lock, PlayCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function VideoLibrary() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Un usuario tiene acceso si su status es 'activo'
  const hasAccess = profile?.status === 'activo';

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const { data, error } = await supabase
          .from('cohab_videos')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setVideos(data || []);
      } catch (err) {
        console.error("Error fetching videos", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  return (
    <div>
      <div className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/dashboard')} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="top-bar-title">Academia Virtual</div>
      </div>

      <div className="content" style={{ position: 'relative', paddingTop: '10px' }}>
        
        {!hasAccess && (
          <div className="paywall-overlay">
            <div className="paywall-content">
              <Lock size={48} color="#FF4D4D" style={{ margin: '0 auto 15px' }} />
              <h3 style={{ color: 'var(--text-white)', fontSize: '1.2rem', marginBottom: '8px' }}>Contenido Premium</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Tu membresía no está activa. Renueva tu plan para acceder a todas las técnicas.
              </p>
              <button 
                className="auth-btn" 
                style={{ background: 'linear-gradient(135deg, var(--crimson-deep), var(--crimson))' }} 
                onClick={() => navigate('/pagos')}
              >
                Renovar Plan
              </button>
            </div>
          </div>
        )}

        <div className="section-head" style={{ marginTop: '10px' }}>
          <h3 className="section-label">Biblioteca de Técnicas</h3>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '0 18px' }}>Cargando videos...</p>
        ) : (
          <div className="thumb-grid">
            {videos.map(video => {
              const targetUrl = video.video_url || video.url;
              const levelTag = video.description?.startsWith('Nivel: ') 
                ? video.description.replace('Nivel: ', '') 
                : (video.level || 'Todos');
              const subtitle = `${levelTag} • ${video.instructor || 'Prof. Andrés'}`;

              return (
                <div 
                  key={video.id} 
                  className="thumb-card" 
                  onClick={() => targetUrl && window.open(targetUrl, '_blank')}
                  style={{ cursor: targetUrl ? 'pointer' : 'default' }}
                >
                  <div className="img-wrap">
                    <img src={video.thumbnail_url || 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=400'} alt={video.title} />
                    <div className="thumb-play">
                      <div className="thumb-play-icon">
                        <svg viewBox="0 0 24 24">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="thumb-text">
                    {video.title}
                    <div className="thumb-dur">{video.duration ? `${video.duration} • ` : ''}{subtitle}</div>
                  </div>
                </div>
              );
            })}
            
            {/* Fallback visual if no videos in DB */}
            {videos.length === 0 && (
              <>
                <div className="thumb-card">
                  <div className="img-wrap">
                    <img src="https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=400" alt="Pasaje Guardia" />
                    <div className="thumb-play">
                      <div className="thumb-play-icon">
                        <svg viewBox="0 0 24 24">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="thumb-text">
                    Pasaje Guardia
                    <div className="thumb-dur">4:20 • Prof. Andrés</div>
                  </div>
                </div>
                <div className="thumb-card">
                  <div className="img-wrap">
                    <img src="https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=400" alt="Armbar Cerrado" />
                    <div className="thumb-play">
                      <div className="thumb-play-icon">
                        <svg viewBox="0 0 24 24">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="thumb-text">
                    Armbar Cerrado
                    <div className="thumb-dur">3:15 • Prof. Andrés</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
