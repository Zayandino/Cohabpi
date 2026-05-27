import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Newspaper, PlayCircle, Tag, Award, Gift, Plus, Trash2, 
  Search, ShieldCheck, CheckCircle2, AlertCircle, Save, Sparkles 
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('menu'); // 'menu', 'news', 'academy', 'benefits', 'grades', 'scholarships'
  
  // Search state for users (Grades & Scholarships)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // NEWS STATE
  const [news, setNews] = useState([]);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsEmoji, setNewsEmoji] = useState('📢');
  const [newsAuthor, setNewsAuthor] = useState('Sensei');
  const [newsImageFile, setNewsImageFile] = useState(null);
  const [newsImageUrl, setNewsImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [loadingNews, setLoadingNews] = useState(false);
  const [publishingNews, setPublishingNews] = useState(false);

  // ACADEMY STATE
  const [videos, setVideos] = useState([]);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLevel, setVideoLevel] = useState('Todos');
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [publishingVideo, setPublishingVideo] = useState(false);

  // BENEFITS STATE
  const [benefits, setBenefits] = useState([]);
  const [benefitTitle, setBenefitTitle] = useState('');
  const [benefitDesc, setBenefitDesc] = useState('');
  const [benefitEmoji, setBenefitEmoji] = useState('🎁');
  const [loadingBenefits, setLoadingBenefits] = useState(false);
  const [publishingBenefit, setPublishingBenefit] = useState(false);

  // GRADES STATE
  const [userBelt, setUserBelt] = useState('white');
  const [userGraus, setUserGraus] = useState(0);
  const [updatingGrade, setUpdatingGrade] = useState(false);

  // SCHOLARSHIPS STATE
  const [userScholarship, setUserScholarship] = useState(0); // 0, 25, 50, 75, 100
  const [updatingScholarship, setUpdatingScholarship] = useState(false);

  // TOAST NOTIFICATIONS
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  // Load initial data based on active tab
  useEffect(() => {
    if (activeTab === 'news') {
      fetchNews();
    } else if (activeTab === 'academy') {
      fetchVideos();
    } else if (activeTab === 'benefits') {
      fetchBenefits();
    } else if (activeTab === 'grades' || activeTab === 'scholarships') {
      // Carga automática de todos los usuarios para que el admin pueda asignarse a sí mismo
      fetchInitialUsers();
    }
  }, [activeTab]);

  // AUTO-CREACIÓN DE SERVICIOS OFICIALES al montar el componente
  useEffect(() => {
    const syncOfficialServices = async () => {
      try {
        // Verificar cuáles servicios ya existen
        const { data: existing } = await supabase
          .from('cohab_services')
          .select('name');

        const existingNames = (existing || []).map(s => s.name.toLowerCase());

        const officialServices = [
          {
            name: 'BJJ General',
            description: 'Jiu-Jitsu Brasileño para adultos. Entrenamiento técnico y sparring con cinturón reglamentario.',
            price: 45000,
            is_active: true,
            pricing_tiers: [
              { name: '5 clases semanales', price: 45000 },
              { name: '4 clases semanales', price: 38000 },
              { name: '3 clases semanales', price: 32000 }
            ],
            schedule: 'LUN-MIE-VIE 13:00 | LUN-MIE-VIE 20:00 | MAR-JUE 20:00'
          },
          {
            name: 'BJJ KIDS',
            description: 'BJJ para niños y adolescentes. Clases adaptadas con énfasis en valores, disciplina y técnica.',
            price: 45000,
            is_active: true,
            pricing_tiers: [
              { name: 'Plan Mensual KIDS', price: 45000 }
            ],
            schedule: 'SAB 10:00'
          },
          {
            name: 'Funcional',
            description: 'Entrenamiento funcional de alta intensidad. Acondicionamiento físico y fuerza.',
            price: 45000,
            is_active: true,
            pricing_tiers: [
              { name: '5 clases semanales', price: 45000 },
              { name: '4 clases semanales', price: 40000 },
              { name: '3 clases semanales', price: 35000 },
              { name: '2 clases semanales', price: 30000 },
              { name: '1 clase semanal',    price: 25000 }
            ],
            schedule: 'LUN-MIE-VIE 07:00 | MAR-JUE 07:00'
          },
          {
            name: 'BJJ Seminarios',
            description: 'Seminarios especiales con instructores invitados. Se activan por temporada.',
            price: 20000,
            is_active: false, // Desactivado hasta que el admin programe uno
            pricing_tiers: [
              { name: 'Entrada Seminario', price: 20000 }
            ],
            schedule: 'Sin programar'
          }
        ];

        // Solo insertar los que no existan
        for (const svc of officialServices) {
          if (!existingNames.includes(svc.name.toLowerCase())) {
            const { error } = await supabase
              .from('cohab_services')
              .insert([svc]);
            if (error) {
              console.warn(`No se pudo crear el servicio "${svc.name}":`, error.message);
            } else {
              console.info(`✅ Servicio "${svc.name}" creado exitosamente.`);
            }
          }
        }
      } catch (err) {
        console.warn('Error al sincronizar servicios oficiales (no crítico):', err);
      }
    };

    syncOfficialServices();
  }, []);

  // Carga inicial de todos los usuarios (para Grados y Becas)
  const fetchInitialUsers = async () => {
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('cohab_profiles')
        .select('id, name, email, belt, graus, parent_id, scholarship_percent')
        .order('name', { ascending: true })
        .limit(50);

      if (error) throw error;
      // Agregar scholarship_percent con valor 0 por defecto si la columna no existe aún
      const enriched = (data || []).map(u => ({ ...u, scholarship_percent: u.scholarship_percent ?? 0 }));
      setSearchResults(enriched);
    } catch (err) {
      console.error('Error cargando usuarios iniciales:', err);
    } finally {
      setSearching(false);
    }
  };


  // SEARCH USERS HANDLER
  const handleSearchUsers = async (query) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      // Al limpiar búsqueda, recargamos todos los usuarios
      fetchInitialUsers();
      return;
    }
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('cohab_profiles')
        .select('id, name, email, belt, graus, parent_id, scholarship_percent')
        .or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`)
        .limit(10);

      if (error) throw error;
      const enriched = (data || []).map(u => ({ ...u, scholarship_percent: u.scholarship_percent ?? 0 }));
      setSearchResults(enriched);
    } catch (err) {
      console.error("Error searching users:", err);
    } finally {
      setSearching(false);
    }
  };


  // 1. NEWS & ANNOUNCEMENTS LOGIC
  const fetchNews = async () => {
    try {
      setLoadingNews(true);
      const { data, error } = await supabase
        .from('cohab_news')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (err) {
      console.error("Error fetching news:", err);
    } finally {
      setLoadingNews(false);
    }
  };

  const handlePublishNews = async (e) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsContent.trim()) return;

    try {
      setPublishingNews(true);
      let finalImageUrl = newsImageUrl.trim();

      // Subir archivo al bucket de Supabase si existe
      if (newsImageFile) {
        try {
          const fileExt = newsImageFile.name.split('.').pop();
          const fileName = `news_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
          const filePath = `${fileName}`;

          const { data, error: uploadError } = await supabase.storage
            .from('news')
            .upload(filePath, newsImageFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.warn("Error al subir archivo a storage:", uploadError.message);
            showToast("Aviso: No se pudo subir el archivo de imagen. Publicando sin imagen. Asegúrate de ejecutar el script SQL en Supabase.", 'error');
          } else {
            const { data: publicUrlData } = supabase.storage
              .from('news')
              .getPublicUrl(filePath);
            
            finalImageUrl = publicUrlData.publicUrl;
          }
        } catch (uploadErr) {
          console.error("Excepción al subir imagen:", uploadErr);
        }
      }

      const { error } = await supabase
        .from('cohab_news')
        .insert([{
          title: newsTitle.trim(),
          content: newsContent.trim(),
          emoji: newsEmoji,
          author: newsAuthor.trim() || 'Cohab Los Andes',
          image_url: finalImageUrl || null,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      
      setNewsTitle('');
      setNewsContent('');
      setNewsEmoji('📢');
      setNewsAuthor('Sensei');
      setNewsImageFile(null);
      setNewsImageUrl('');
      setImagePreview('');
      showToast("¡Novedad publicada con éxito!", 'success');
      fetchNews();
    } catch (err) {
      console.error("Error publishing news:", err);
      showToast("Error al publicar novedad.", 'error');
    } finally {
      setPublishingNews(false);
    }
  };

  const handleDeleteNews = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta novedad?")) return;
    try {
      const { error } = await supabase
        .from('cohab_news')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setNews(prev => prev.filter(n => n.id !== id));
      showToast("Novedad eliminada.", 'success');
    } catch (err) {
      console.error("Error deleting news:", err);
      showToast("Error al eliminar novedad.", 'error');
    }
  };

  // 2. ACADEMY VIDEOS LOGIC
  const fetchVideos = async () => {
    try {
      setLoadingVideos(true);
      const { data, error } = await supabase
        .from('cohab_videos')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      setVideos(data || []);
    } catch (err) {
      console.error("Error fetching videos:", err);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handlePublishVideo = async (e) => {
    e.preventDefault();
    if (!videoTitle.trim() || !videoUrl.trim()) return;

    try {
      setPublishingVideo(true);
      const { error } = await supabase
        .from('cohab_videos')
        .insert([{
          title: videoTitle.trim(),
          url: videoUrl.trim(),
          level: videoLevel
        }]);

      if (error) throw error;
      
      setVideoTitle('');
      setVideoUrl('');
      setVideoLevel('Todos');
      showToast("¡Video agregado a la Academia!", 'success');
      fetchVideos();
    } catch (err) {
      console.error("Error publishing video:", err);
      showToast("Error al guardar video.", 'error');
    } finally {
      setPublishingVideo(false);
    }
  };

  const handleDeleteVideo = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este video de la academia?")) return;
    try {
      const { error } = await supabase
        .from('cohab_videos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setVideos(prev => prev.filter(v => v.id !== id));
      showToast("Video eliminado.", 'success');
    } catch (err) {
      console.error("Error deleting video:", err);
      showToast("Error al eliminar video.", 'error');
    }
  };

  // 3. BENEFITS & CONVENIOS LOGIC
  const fetchBenefits = async () => {
    try {
      setLoadingBenefits(true);
      const { data, error } = await supabase
        .from('cohab_discounts')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      setBenefits(data || []);
    } catch (err) {
      console.error("Error fetching benefits:", err);
    } finally {
      setLoadingBenefits(false);
    }
  };

  const handlePublishBenefit = async (e) => {
    e.preventDefault();
    if (!benefitTitle.trim() || !benefitDesc.trim()) return;

    try {
      setPublishingBenefit(true);
      const { error } = await supabase
        .from('cohab_discounts')
        .insert([{
          title: benefitTitle.trim(),
          description: benefitDesc.trim(),
          emoji: benefitEmoji
        }]);

      if (error) throw error;
      
      setBenefitTitle('');
      setBenefitDesc('');
      setBenefitEmoji('🎁');
      showToast("¡Convenio de Beneficio agregado con éxito!", 'success');
      fetchBenefits();
    } catch (err) {
      console.error("Error publishing benefit:", err);
      showToast("Error al guardar beneficio.", 'error');
    } finally {
      setPublishingBenefit(false);
    }
  };

  const handleDeleteBenefit = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este beneficio de la galería?")) return;
    try {
      const { error } = await supabase
        .from('cohab_discounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setBenefits(prev => prev.filter(b => b.id !== id));
      showToast("Beneficio eliminado.", 'success');
    } catch (err) {
      console.error("Error deleting benefit:", err);
      showToast("Error al eliminar beneficio.", 'error');
    }
  };

  // 4. ASSIGN GRADES LOGIC
  const handleSelectUserForGrades = (user) => {
    setSelectedUser(user);
    setUserBelt(user.belt || 'white');
    setUserGraus(user.graus || 0);
  };

  const handleUpdateUserGrade = async () => {
    if (!selectedUser) return;
    try {
      setUpdatingGrade(true);
      const { error } = await supabase
        .from('cohab_profiles')
        .update({
          belt: userBelt,
          graus: parseInt(userGraus, 10)
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      showToast(`¡Cinturón y grados actualizados con éxito para ${selectedUser.name}!`, 'success');
      // Update local state in search result
      setSearchResults(prev => prev.map(u => u.id === selectedUser.id ? { ...u, belt: userBelt, graus: parseInt(userGraus, 10) } : u));
      setSelectedUser(prev => ({ ...prev, belt: userBelt, graus: parseInt(userGraus, 10) }));
    } catch (err) {
      console.error("Error updating user grade:", err);
      showToast("Error al guardar grado.", 'error');
    } finally {
      setUpdatingGrade(false);
    }
  };

  // 5. ASSIGN SCHOLARSHIPS LOGIC
  const handleSelectUserForScholarship = (user) => {
    setSelectedUser(user);
    
    // Read from DB status first
    let initialScholarship = user.scholarship_percent || 0;
    
    // Check localStorage fallback
    try {
      const localScholarships = JSON.parse(localStorage.getItem('cohab_scholarships') || '{}');
      if (localScholarships[user.id] !== undefined) {
        initialScholarship = localScholarships[user.id];
      }
    } catch (e) {}
    
    setUserScholarship(initialScholarship);
  };

  const handleUpdateUserScholarship = async () => {
    if (!selectedUser) return;
    try {
      setUpdatingScholarship(true);
      
      // 1. Guardar en localStorage como fallback robusto garantizado
      try {
        const localScholarships = JSON.parse(localStorage.getItem('cohab_scholarships') || '{}');
        localScholarships[selectedUser.id] = parseInt(userScholarship, 10);
        localStorage.setItem('cohab_scholarships', JSON.stringify(localScholarships));
      } catch (e) {
        console.warn("No se pudo guardar beca en localStorage:", e);
      }

      // 2. Intentar guardar en Supabase si la columna scholarship_percent existe
      try {
        const { error } = await supabase
          .from('cohab_profiles')
          .update({
            scholarship_percent: parseInt(userScholarship, 10)
          })
          .eq('id', selectedUser.id);

        if (error) {
          console.warn("Aviso: la columna scholarship_percent no existe físicamente en Supabase o falló, se usará fallback de localStorage. Error:", error.message);
        }
      } catch (dbErr) {
        console.warn("Aviso: Ocurrió un error en Supabase, usando persistencia en localStorage:", dbErr);
      }

      showToast(`¡Beca del ${userScholarship}% asignada con éxito para ${selectedUser.name}!`, 'success');
      setSearchResults(prev => prev.map(u => u.id === selectedUser.id ? { ...u, scholarship_percent: parseInt(userScholarship, 10) } : u));
      setSelectedUser(prev => ({ ...prev, scholarship_percent: parseInt(userScholarship, 10) }));
    } catch (err) {
      console.error("Error general al asignar beca:", err);
      showToast("Error al asignar beca.", 'error');
    } finally {
      setUpdatingScholarship(false);
    }
  };

  // Helper to format belt class
  const getBeltLabel = (beltVal) => {
    if (!beltVal) return 'Blanco';
    const val = beltVal.toLowerCase();
    if (val === 'white' || val === 'blanco') return 'Blanco';
    if (val === 'blue' || val === 'azul') return 'Azul';
    if (val === 'purple' || val === 'morado') return 'Morado';
    if (val === 'brown' || val === 'marrón' || val === 'marron') return 'Marrón';
    if (val === 'black' || val === 'negro') return 'Negro';
    return beltVal;
  };

  return (
    <div>
      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'success' 
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))' 
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '10px',
          fontSize: '0.88rem',
          fontWeight: 800,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(16, 185, 129, 0.2)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="top-bar">
        <button className="icon-btn" onClick={() => {
          if (activeTab === 'menu') {
            navigate('/profile');
          } else {
            setActiveTab('menu');
            setSelectedUser(null);
            setSearchQuery('');
            setSearchResults([]);
          }
        }} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="top-bar-title">
          {activeTab === 'menu' && 'Ajustes Administrativos'}
          {activeTab === 'news' && 'Noticias y Novedades'}
          {activeTab === 'academy' && 'Academia y Cursos'}
          {activeTab === 'benefits' && 'Galería de Beneficios'}
          {activeTab === 'grades' && 'Asignación de Grados'}
          {activeTab === 'scholarships' && 'Asignación de Becas'}
        </div>
      </div>

      <div className="content" style={{ paddingTop: '20px', paddingBottom: '70px' }}>
        
        {/* TABS DE NAVEGACIÓN PRINCIPAL / MENU DE ADMINISTRACIÓN */}
        {activeTab === 'menu' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            
            {/* Logo Original */}
            <div style={{ marginBottom: '25px', marginTop: '5px', textAlign: 'center' }}>
              <img 
                src="/assets/logo-original.jpg" 
                alt="Cohab Logo" 
                style={{ width: '85px', height: '85px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border-glass)', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }} 
              />
            </div>

            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.35rem', margin: '0 0 6px 0', fontWeight: 800 }}>
                Consola del Tatami
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                Selecciona la funcionalidad administrativa para configurar las secciones de la plataforma.
              </p>
            </div>

            {/* Grid 100% de Configuración de Secciones */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
              
              <div 
                onClick={() => setActiveTab('news')}
                className="glass-panel"
                style={{ 
                  padding: '18px', 
                  cursor: 'pointer', 
                  border: '1px solid rgba(0, 180, 216, 0.25)', 
                  background: 'linear-gradient(135deg, rgba(0, 180, 216, 0.08), rgba(6, 11, 24, 0.8))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ padding: '10px', background: 'rgba(0, 180, 216, 0.1)', borderRadius: '10px' }}>
                  <Newspaper size={28} color="var(--aurora)" />
                </div>
                <div>
                  <h4 style={{ color: 'white', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800 }}>Noticias y Novedades</h4>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem', lineHeight: 1.3 }}>Redacta comunicados oficiales y novedades del tatami.</p>
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('academy')}
                className="glass-panel"
                style={{ 
                  padding: '18px', 
                  cursor: 'pointer', 
                  border: '1px solid rgba(245, 158, 11, 0.25)', 
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(6, 11, 24, 0.8))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px' }}>
                  <PlayCircle size={28} color="#f59e0b" />
                </div>
                <div>
                  <h4 style={{ color: 'white', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800 }}>Academia y Cursos</h4>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem', lineHeight: 1.3 }}>Administra los videos didácticos, técnicas y clases online.</p>
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('benefits')}
                className="glass-panel"
                style={{ 
                  padding: '18px', 
                  cursor: 'pointer', 
                  border: '1px solid rgba(16, 185, 129, 0.25)', 
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 11, 24, 0.8))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px' }}>
                  <Tag size={28} color="#10B981" />
                </div>
                <div>
                  <h4 style={{ color: 'white', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800 }}>Beneficios y Convenios</h4>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem', lineHeight: 1.3 }}>Gestiona los convenios y descuentos dinámicos para los alumnos.</p>
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('grades')}
                className="glass-panel"
                style={{ 
                  padding: '18px', 
                  cursor: 'pointer', 
                  border: '1px solid rgba(167, 139, 250, 0.25)', 
                  background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.08), rgba(6, 11, 24, 0.8))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ padding: '10px', background: 'rgba(167, 139, 250, 0.1)', borderRadius: '10px' }}>
                  <Award size={28} color="#a78bfa" />
                </div>
                <div>
                  <h4 style={{ color: 'white', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800 }}>Asignación de Grados</h4>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem', lineHeight: 1.3 }}>Modifica cinturones y graus de los practicantes de la escuela.</p>
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('scholarships')}
                className="glass-panel"
                style={{ 
                  padding: '18px', 
                  cursor: 'pointer', 
                  border: '1px solid rgba(236, 72, 153, 0.25)', 
                  background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(6, 11, 24, 0.8))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ padding: '10px', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '10px' }}>
                  <Gift size={28} color="#ec4899" />
                </div>
                <div>
                  <h4 style={{ color: 'white', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800 }}>Asignación de Becas</h4>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem', lineHeight: 1.3 }}>Aplica descuentos especiales y becas completas o parciales.</p>
                </div>
              </div>

            </div>

            {/* Back button */}
            <div style={{ marginTop: '35px', textAlign: 'center' }}>
              <button 
                onClick={() => navigate('/profile')}
                className="auth-btn" 
                style={{ background: 'transparent', border: '1px solid var(--border-glass)', width: 'auto', padding: '10px 24px', fontSize: '0.85rem' }}
              >
                Volver a Perfil de Alumno
              </button>
            </div>
          </div>
        )}

        {/* 1. SECCIÓN NOTICIAS Y NOVEDADES */}
        {activeTab === 'news' && (
          <div style={{ animation: 'fadeIn 0.35s ease-out' }}>
            
            {/* Formulario de Creación */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', border: '1px solid rgba(0, 180, 216, 0.2)' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontFamily: 'var(--font-display)', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="var(--aurora)" /> Crear Nueva Publicación
              </h3>
              
              <form onSubmit={handlePublishNews} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>Título de la Novedad</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Nuevo Horario Sabatino" 
                    className="form-input" 
                    value={newsTitle} 
                    onChange={e => setNewsTitle(e.target.value)} 
                    required 
                    style={{ background: 'var(--bg-elevated)', color: 'white' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>Emoji / Icono de la Publicación</label>
                  <input 
                    type="text" 
                    placeholder="📢" 
                    className="form-input" 
                    value={newsEmoji} 
                    onChange={e => setNewsEmoji(e.target.value)} 
                    required 
                    style={{ background: 'var(--bg-elevated)', color: 'white', maxWidth: '80px', textAlign: 'center' }}
                  />
                </div>

                {/* Cargador de Imagen Premium */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '15px', borderRadius: '10px', border: '1px dashed rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 800, margin: 0 }}>Imagen de la Novedad (Opcional)</label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: imagePreview ? '80px 1fr' : '1fr', gap: '15px', alignItems: 'center' }}>
                    {imagePreview && (
                      <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--border-glass)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                        <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button 
                          type="button" 
                          onClick={() => {
                            setNewsImageFile(null);
                            setNewsImageUrl('');
                            setImagePreview('');
                          }}
                          style={{ position: 'absolute', top: '2px', right: '2px', padding: '2px', background: 'rgba(239, 68, 68, 0.85)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Remover imagen"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                          type="file" 
                          accept="image/*" 
                          id="news-image-upload" 
                          style={{ display: 'none' }} 
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setNewsImageFile(file);
                              setNewsImageUrl(''); // Limpiar campo de URL si se sube archivo
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setImagePreview(reader.result);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <label 
                          htmlFor="news-image-upload"
                          style={{ 
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))', 
                            color: 'white', 
                            border: '1px solid var(--border-glass)', 
                            borderRadius: '8px', 
                            padding: '8px 16px', 
                            fontSize: '0.75rem', 
                            fontWeight: 800, 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            transition: 'all 0.2s ease',
                            width: 'fit-content'
                          }}
                          className="glass-panel"
                        >
                          <Plus size={14} /> Seleccionar Imagen Local
                        </label>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>O ingresa una URL:</span>
                        <input 
                          type="text" 
                          placeholder="https://ejemplo.com/imagen.jpg" 
                          className="form-input" 
                          value={newsImageUrl}
                          onChange={(e) => {
                            setNewsImageUrl(e.target.value);
                            setNewsImageFile(null); // Limpiar archivo local si se escribe URL
                            setImagePreview(e.target.value);
                          }}
                          style={{ background: 'var(--bg-elevated)', color: 'white', height: '28px', fontSize: '0.72rem', flex: 1, padding: '2px 8px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>Cuerpo / Contenido</label>
                  <textarea 
                    placeholder="Escribe el comunicado aquí..." 
                    className="form-input" 
                    rows={4} 
                    value={newsContent} 
                    onChange={e => setNewsContent(e.target.value)} 
                    required 
                    style={{ background: 'var(--bg-elevated)', color: 'white', height: 'auto', paddingTop: '8px' }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={publishingNews} 
                  className="auth-btn" 
                  style={{ background: 'linear-gradient(135deg, var(--aurora), #10B981)', color: '#060B18', fontWeight: 900, height: '40px', marginTop: '5px' }}
                >
                  {publishingNews ? 'Publicando...' : 'Publicar Comunicación'}
                </button>
              </form>
            </div>

            {/* Listado de Novedades */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontFamily: 'var(--font-display)', margin: '0 0 15px 0' }}>
                📰 Comunicados Publicados
              </h3>

              {loadingNews ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem', padding: '15px' }}>Cargando novedades...</p>
              ) : news.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem', padding: '15px' }}>No hay comunicados publicados.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {news.map(item => (
                    <div key={item.id} className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.6rem' }}>{item.emoji || '📢'}</span>
                        <div>
                          <h4 style={{ color: 'white', margin: '0 0 2px 0', fontSize: '0.85rem', fontWeight: 800 }}>{item.title}</h4>
                          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>{item.content}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteNews(item.id)}
                        className="icon-btn" 
                        style={{ background: 'transparent', borderColor: 'transparent', color: '#FF6B6B' }}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* 2. SECCIÓN ACADEMIA Y VIDEOS */}
        {activeTab === 'academy' && (
          <div style={{ animation: 'fadeIn 0.35s ease-out' }}>
            
            {/* Formulario de Creación */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontFamily: 'var(--font-display)', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="#f59e0b" /> Agregar Nuevo Video Didáctico
              </h3>
              
              <form onSubmit={handlePublishVideo} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>Título de la Clase / Técnica</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Pasaje de Guardia Cerrada" 
                    className="form-input" 
                    value={videoTitle} 
                    onChange={e => setVideoTitle(e.target.value)} 
                    required 
                    style={{ background: 'var(--bg-elevated)', color: 'white' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>URL del Video (YouTube o Vimeo)</label>
                  <input 
                    type="url" 
                    placeholder="Ej: https://www.youtube.com/watch?v=..." 
                    className="form-input" 
                    value={videoUrl} 
                    onChange={e => setVideoUrl(e.target.value)} 
                    required 
                    style={{ background: 'var(--bg-elevated)', color: 'white' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>Cinturón / Nivel Recomendado</label>
                  <select 
                    className="form-input" 
                    value={videoLevel} 
                    onChange={e => setVideoLevel(e.target.value)} 
                    style={{ background: 'var(--bg-elevated)', color: 'white', height: '36px' }}
                  >
                    <option value="Todos">Todos los Niveles</option>
                    <option value="Blanco">Iniciados (Cinturón Blanco)</option>
                    <option value="Azul">Avanzado I (Cinturón Azul)</option>
                    <option value="Morado">Avanzado II (Cinturón Morado)</option>
                    <option value="Marrón">Competidor (Cinturón Marrón)</option>
                    <option value="Negro">Avanzado Superior (Cinturón Negro)</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={publishingVideo} 
                  className="auth-btn" 
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #10B981)', color: '#060B18', fontWeight: 900, height: '40px', marginTop: '5px' }}
                >
                  {publishingVideo ? 'Guardando...' : 'Agregar Video a Videoteca'}
                </button>
              </form>
            </div>

            {/* Listado de Videos */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontFamily: 'var(--font-display)', margin: '0 0 15px 0' }}>
                🎥 Biblioteca de Videos Academia
              </h3>

              {loadingVideos ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem', padding: '15px' }}>Cargando biblioteca...</p>
              ) : videos.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem', padding: '15px' }}>No hay videos en la academia.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {videos.map(item => (
                    <div key={item.id} className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.6rem' }}>🥋</span>
                        <div>
                          <h4 style={{ color: 'white', margin: '0 0 2px 0', fontSize: '0.85rem', fontWeight: 800 }}>{item.title}</h4>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ padding: '2px 6px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#F59E0B', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 800 }}>
                              {item.level || 'Todos'}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{item.url}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteVideo(item.id)}
                        className="icon-btn" 
                        style={{ background: 'transparent', borderColor: 'transparent', color: '#FF6B6B' }}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* 3. SECCIÓN BENEFICIOS Y CONVENIOS */}
        {activeTab === 'benefits' && (
          <div style={{ animation: 'fadeIn 0.35s ease-out' }}>
            
            {/* Formulario de Creación */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontFamily: 'var(--font-display)', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="#10B981" /> Agregar Nuevo Convenio
              </h3>
              
              <form onSubmit={handlePublishBenefit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>Título del Convenio</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Descuento Isapre Colmena" 
                    className="form-input" 
                    value={benefitTitle} 
                    onChange={e => setBenefitTitle(e.target.value)} 
                    required 
                    style={{ background: 'var(--bg-elevated)', color: 'white' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>Emoji / Icono del Beneficio</label>
                  <input 
                    type="text" 
                    placeholder="🎁" 
                    className="form-input" 
                    value={benefitEmoji} 
                    onChange={e => setBenefitEmoji(e.target.value)} 
                    required 
                    style={{ background: 'var(--bg-elevated)', color: 'white', maxWidth: '80px', textAlign: 'center' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>Descripción del Beneficio</label>
                  <textarea 
                    placeholder="Explica detalladamente las condiciones del descuento..." 
                    className="form-input" 
                    rows={3} 
                    value={benefitDesc} 
                    onChange={e => setBenefitDesc(e.target.value)} 
                    required 
                    style={{ background: 'var(--bg-elevated)', color: 'white', height: 'auto', paddingTop: '8px' }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={publishingBenefit} 
                  className="auth-btn" 
                  style={{ background: 'linear-gradient(135deg, #10B981, #00B4D8)', color: '#060B18', fontWeight: 900, height: '40px', marginTop: '5px' }}
                >
                  {publishingBenefit ? 'Publicando...' : 'Agregar a Galería de Beneficios'}
                </button>
              </form>
            </div>

            {/* Listado de Beneficios */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontFamily: 'var(--font-display)', margin: '0 0 15px 0' }}>
                💎 Convenios y Descuentos Actuales
              </h3>

              {loadingBenefits ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem', padding: '15px' }}>Cargando convenios...</p>
              ) : benefits.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem', padding: '15px' }}>No hay convenios en la galería.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {benefits.map(item => (
                    <div key={item.id} className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.6rem' }}>{item.emoji || '💎'}</span>
                        <div>
                          <h4 style={{ color: 'white', margin: '0 0 2px 0', fontSize: '0.85rem', fontWeight: 800 }}>{item.title}</h4>
                          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>{item.description}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteBenefit(item.id)}
                        className="icon-btn" 
                        style={{ background: 'transparent', borderColor: 'transparent', color: '#FF6B6B' }}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* 4. SECCIÓN ASIGNACIÓN DE GRADOS */}
        {activeTab === 'grades' && (
          <div style={{ animation: 'fadeIn 0.35s ease-out' }}>
            
            {/* Buscador de Alumnos */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontFamily: 'var(--font-display)', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} color="#a78bfa" /> Buscar Practicante
              </h3>
              
              <div style={{ position: 'relative', marginBottom: '15px' }}>
                <input 
                  type="text" 
                  placeholder="Escribe el nombre del alumno..." 
                  className="form-input" 
                  value={searchQuery} 
                  onChange={e => handleSearchUsers(e.target.value)} 
                  style={{ background: 'var(--bg-elevated)', color: 'white', paddingLeft: '36px' }}
                />
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              </div>

              {searching ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Buscando en la base de datos...</p>
              ) : searchResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {searchResults.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => handleSelectUserForGrades(u)}
                      className="glass-panel" 
                      style={{ 
                        padding: '10px 12px', 
                        background: selectedUser?.id === u.id ? 'rgba(167, 139, 250, 0.12)' : 'rgba(255,255,255,0.01)', 
                        borderColor: selectedUser?.id === u.id ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderRadius: '8px'
                      }}
                    >
                      <div>
                        <div style={{ color: 'white', fontWeight: 800, fontSize: '0.82rem' }}>{u.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{u.email}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>
                          🥋 {getBeltLabel(u.belt)}
                        </span>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(0, 180, 216, 0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--aurora)', fontWeight: 800 }}>
                          ⭐ {u.graus || 0} Graus
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Ningún alumno encontrado.</p>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Escribe al menos 2 letras para iniciar la búsqueda en tiempo real.</p>
              )}
            </div>

            {/* Asignación Grado Activo */}
            {selectedUser && (
              <div className="glass-panel" style={{ padding: '22px', borderLeft: '4px solid #a78bfa', background: 'rgba(167, 139, 250, 0.03)', animation: 'slideIn 0.3s ease-out' }}>
                <h4 style={{ color: 'white', margin: '0 0 16px 0', fontFamily: 'var(--font-display)', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  🎓 Asignar Grado a: <strong style={{ color: '#a78bfa' }}>{selectedUser.name}</strong>
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 800 }}>Cinturón BJJ Oficial</label>
                    <select 
                      className="form-input" 
                      value={userBelt} 
                      onChange={e => setUserBelt(e.target.value)} 
                      style={{ background: 'var(--bg-elevated)', color: 'white', height: '36px' }}
                    >
                      <option value="white">Blanco</option>
                      <option value="blue">Azul</option>
                      <option value="purple">Morado</option>
                      <option value="brown">Marrón</option>
                      <option value="black">Negro</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 800 }}>Grados (Graus / Stripes)</label>
                    <select 
                      className="form-input" 
                      value={userGraus} 
                      onChange={e => setUserGraus(parseInt(e.target.value))} 
                      style={{ background: 'var(--bg-elevated)', color: 'white', height: '36px' }}
                    >
                      <option value={0}>0 Graus (Liso)</option>
                      <option value={1}>1 Grau</option>
                      <option value={2}>2 Graus</option>
                      <option value={3}>3 Graus</option>
                      <option value={4}>4 Graus</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button 
                      onClick={handleUpdateUserGrade}
                      disabled={updatingGrade}
                      className="auth-btn" 
                      style={{ 
                        background: 'linear-gradient(135deg, #a78bfa, #10B981)', 
                        color: '#060B18', 
                        fontWeight: 900, 
                        minHeight: '40px', 
                        height: 'auto', 
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        lineHeight: '1.2',
                        textTransform: 'uppercase',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        margin: 0, 
                        flex: 1.25 
                      }}
                    >
                      {updatingGrade ? 'Guardando...' : 'Guardar Grado'}
                    </button>
                    <button 
                      onClick={() => setSelectedUser(null)}
                      className="auth-btn" 
                      style={{ 
                        background: 'transparent', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        color: 'white', 
                        fontWeight: 800, 
                        minHeight: '40px', 
                        height: 'auto', 
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        lineHeight: '1.2',
                        textTransform: 'uppercase',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        margin: 0, 
                        flex: 0.75 
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* 5. SECCIÓN ASIGNACIÓN DE BECAS */}
        {activeTab === 'scholarships' && (
          <div style={{ animation: 'fadeIn 0.35s ease-out' }}>
            
            {/* Buscador de Alumnos */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontFamily: 'var(--font-display)', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} color="#ec4899" /> Buscar Alumno para Beca
              </h3>
              
              <div style={{ position: 'relative', marginBottom: '15px' }}>
                <input 
                  type="text" 
                  placeholder="Escribe el nombre del alumno..." 
                  className="form-input" 
                  value={searchQuery} 
                  onChange={e => handleSearchUsers(e.target.value)} 
                  style={{ background: 'var(--bg-elevated)', color: 'white', paddingLeft: '36px' }}
                />
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              </div>

              {searching ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Buscando en la base de datos...</p>
              ) : searchResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {searchResults.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => handleSelectUserForScholarship(u)}
                      className="glass-panel" 
                      style={{ 
                        padding: '10px 12px', 
                        background: selectedUser?.id === u.id ? 'rgba(236, 72, 153, 0.12)' : 'rgba(255,255,255,0.01)', 
                        borderColor: selectedUser?.id === u.id ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderRadius: '8px'
                      }}
                    >
                      <div>
                        <div style={{ color: 'white', fontWeight: 800, fontSize: '0.82rem' }}>{u.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{u.email}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(236, 72, 153, 0.1)', padding: '2px 6px', borderRadius: '4px', color: '#ec4899', fontWeight: 800 }}>
                          🎓 Beca: {u.scholarship_percent || 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Ningún alumno encontrado.</p>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Escribe al menos 2 letras para iniciar la búsqueda en tiempo real.</p>
              )}
            </div>

            {/* Asignación Beca Activo */}
            {selectedUser && (
              <div className="glass-panel" style={{ padding: '22px', borderLeft: '4px solid #ec4899', background: 'rgba(236, 72, 153, 0.03)', animation: 'slideIn 0.3s ease-out' }}>
                <h4 style={{ color: 'white', margin: '0 0 16px 0', fontFamily: 'var(--font-display)', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  🎁 Asignar Beca a: <strong style={{ color: '#ec4899' }}>{selectedUser.name}</strong>
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ background: 'rgba(255, 77, 77, 0.05)', border: '1px dashed rgba(255, 77, 77, 0.2)', padding: '12px', borderRadius: '8px', color: 'var(--text-light)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                    💡 <strong>¿Cómo funciona la beca?</strong>
                    <br />
                    El porcentaje asignado se restará del precio de la disciplina de este alumno al simular el planificador de mensualidades y pagos en Perfil, ajustando el total de la familia de forma automática.
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 800 }}>Porcentaje de Beca / Descuento</label>
                    <select 
                      className="form-input" 
                      value={userScholarship} 
                      onChange={e => setUserScholarship(parseInt(e.target.value))} 
                      style={{ background: 'var(--bg-elevated)', color: 'white', height: '36px' }}
                    >
                      <option value={0}>0% - Sin Beca (Pago Completo)</option>
                      <option value={25}>25% Beca Parcial (Paga 75%)</option>
                      <option value={50}>50% Media Beca (Paga 50%)</option>
                      <option value={75}>75% Beca Mayor (Paga 25%)</option>
                      <option value={100}>100% Beca Completa (Pago Liberado / Gratis)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                    <button 
                      onClick={handleUpdateUserScholarship}
                      disabled={updatingScholarship}
                      className="auth-btn" 
                      style={{ 
                        background: 'linear-gradient(135deg, #ec4899, #10B981)', 
                        color: '#060B18', 
                        fontWeight: 900, 
                        minHeight: '44px', 
                        height: 'auto', 
                        padding: '6px 12px',
                        lineHeight: '1.2',
                        fontSize: '0.82rem',
                        margin: 0, 
                        flex: 1.3,
                        textTransform: 'uppercase',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 15px rgba(236, 72, 153, 0.3)'
                      }}
                    >
                      {updatingScholarship ? 'Guardando...' : 'Asignar Beca Oficial'}
                    </button>
                    <button 
                      onClick={() => setSelectedUser(null)}
                      className="auth-btn" 
                      style={{ 
                        background: 'transparent', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        color: 'white', 
                        fontWeight: 800, 
                        minHeight: '44px', 
                        height: 'auto', 
                        padding: '6px 12px',
                        lineHeight: '1.2',
                        fontSize: '0.82rem',
                        margin: 0, 
                        flex: 0.7,
                        textTransform: 'uppercase',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 10px rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
