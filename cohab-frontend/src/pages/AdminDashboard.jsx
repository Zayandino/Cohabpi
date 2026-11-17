import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Newspaper, PlayCircle, Tag, Award, Gift, Plus, Trash2, 
  Search, ShieldCheck, CheckCircle2, AlertCircle, Save, Sparkles, CreditCard
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
  // --- Estados de Membresías, Pagos y Asistencias ---
  const [membershipSubTab, setMembershipSubTab] = useState('status'); // 'status' | 'payment' | 'attendance' | 'bank'
  const [allProfiles, setAllProfiles] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [monthPayments, setMonthPayments] = useState([]);
  const [pendingPaymentsList, setPendingPaymentsList] = useState([]);
  const [rejectedPaymentsList, setRejectedPaymentsList] = useState([]);
  const [approvingPaymentId, setApprovingPaymentId] = useState(null);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [memberFilter, setMemberFilter] = useState('todos'); // 'todos' | 'vigente' | 'pendiente' | 'vencido' | 'beca' | 'prueba'
  const [memberSearch, setMemberSearch] = useState('');
  const [bankForm, setBankForm] = useState({
    bank_name: 'BancoEstado',
    account_type: 'CuentaRUT',
    account_number: '16851618',
    holder_name: 'Eduardo Javier Ambler Ríos',
    holder_rut: '16.851.618-5',
    confirmation_email: 'ambler.eduardo@gmail.com',
    instructions: ''
  });
  const [savingBankSettings, setSavingBankSettings] = useState(false);
  
  // Formulario de Pago Manual
  const [payStudentId, setPayStudentId] = useState('');
  const [payServiceId, setPayServiceId] = useState('');
  const [payMonths, setPayMonths] = useState('1');
  const [payMethod, setPayMethod] = useState('transferencia');
  const [payAmount, setPayAmount] = useState('45000');
  const [savingManualPayment, setSavingManualPayment] = useState(false);

  // Reporte de Asistencia
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedInstructorFilter, setSelectedInstructorFilter] = useState('all');
  const [monthlyAttendances, setMonthlyAttendances] = useState([]);
  const [loadingAttendanceReport, setLoadingAttendanceReport] = useState(false);

  // Asistencias del alumno seleccionado en la sección Grados (para sugerencia al Admin)
  const [selectedUserAttendanceCount, setSelectedUserAttendanceCount] = useState(0);
  const [loadingUserAttendance, setLoadingUserAttendance] = useState(false);

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
    if (activeTab === 'menu') {
      fetchMembershipsOverview();
    } else if (activeTab === 'news') {
      fetchNews();
    } else if (activeTab === 'academy') {
      fetchVideos();
    } else if (activeTab === 'benefits') {
      fetchBenefits();
    } else if (activeTab === 'grades' || activeTab === 'scholarships') {
      // Carga automática de todos los usuarios para que el admin pueda asignarse a sí mismo
      fetchInitialUsers();
    } else if (activeTab === 'memberships') {
      fetchMembershipsOverview();
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

        if (existing && existing.length > 0) return;

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
        console.error("Error sincronizando servicios:", err);
      }
    };
    syncOfficialServices();
  }, []);

  // AUTO-CREACIÓN DE BENEFICIOS OFICIALES al montar el componente
  useEffect(() => {
    const syncOfficialBenefits = async () => {
      try {
        const { data: existing } = await supabase
          .from('cohab_discounts')
          .select('title');

        const existingTitles = (existing || []).map(b => b.title.toLowerCase());

        const officialBenefits = [
          {
            title: '15% Descuento Familiar',
            description: 'Inscribe a 2 o más miembros de tu grupo familiar y obtén automáticamente 15% de descuento sobre el total de tu mensualidad.',
            code: '👨‍👩‍👧‍👦'
          },
          {
            title: 'Ahorro por Pago Anticipado',
            description: 'Paga de forma anticipada tu membresía y recibe espectaculares descuentos: 3 meses (10%), 6 meses (15%) o un año completo (25%).',
            code: '📅'
          }
        ];

        let added = false;
        for (const ben of officialBenefits) {
          if (!existingTitles.includes(ben.title.toLowerCase())) {
            const { error } = await supabase.from('cohab_discounts').insert([ben]);
            if (!error) added = true;
          }
        }
        if (added && activeTab === 'benefits') {
          fetchBenefits(); // Refrescar si estábamos en esa pestaña
        }
      } catch (err) {
        console.error("Error sincronizando beneficios:", err);
      }
    };
    syncOfficialBenefits();
  }, [activeTab]);

  // Carga inicial de todos los usuarios (para Grados y Becas)
  const fetchInitialUsers = async () => {
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('cohab_profiles')
        .select('id, name, email, belt, graus, parent_id, scholarship_percent')
        .not('name', 'is', null)
        .neq('name', '')
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
        .not('name', 'is', null)
        .neq('name', '')
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
      
      // Extraer miniatura si es un enlace de YouTube
      const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = videoUrl.match(ytRegExp);
      const thumbnailUrl = match && match[2].length === 11 
        ? `https://img.youtube.com/vi/${match[2]}/mqdefault.jpg` 
        : null;

      const { error } = await supabase
        .from('cohab_videos')
        .insert([{
          title: videoTitle.trim(),
          video_url: videoUrl.trim(),
          description: `Nivel: ${videoLevel}`,
          thumbnail_url: thumbnailUrl
        }]);

      if (error) throw error;
      
      setVideoTitle('');
      setVideoUrl('');
      setVideoLevel('Todos');
      showToast("¡Video agregado a la Academia!", 'success');
      fetchVideos();
    } catch (err) {
      // Log detallado para diagnóstico de RLS / permisos de Supabase
      console.error("Error publishing video — código:", err?.code, "| mensaje:", err?.message, "| detalles:", err?.details, "| hint:", err?.hint);
      const readableError = err?.message || err?.hint || 'Verifica que el usuario tiene role = admin en Supabase.';
      showToast(`Error al guardar video: ${readableError}`, 'error');
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

      if (error) {
        // Log detallado para diagnosticar errores de RLS o permisos
        console.error('fetchBenefits error — código:', error?.code, '| mensaje:', error?.message, '| hint:', error?.hint);
        throw error;
      }
      console.log('fetchBenefits — registros obtenidos:', data?.length, data);
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
          code: benefitEmoji
        }]);

      if (error) {
        console.error('handlePublishBenefit error — código:', error?.code, '| mensaje:', error?.message, '| hint:', error?.hint);
        throw error;
      }
      
      setBenefitTitle('');
      setBenefitDesc('');
      setBenefitEmoji('🎁');
      showToast("¡Convenio de Beneficio agregado con éxito!", 'success');
      fetchBenefits();
    } catch (err) {
      console.error("Error publishing benefit:", err);
      const readableError = err?.message || err?.hint || 'Verifica que el usuario tiene role = admin.';
      showToast(`Error al guardar beneficio: ${readableError}`, 'error');
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
  const handleSelectUserForGrades = async (user) => {
    setSelectedUser(user);
    setUserBelt(user.belt || 'white');
    setUserGraus(user.graus || 0);
    try {
      setLoadingUserAttendance(true);
      const { count, error } = await supabase
        .from('cohab_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', user.id);
      setSelectedUserAttendanceCount(error ? 0 : (count || 0));
    } catch (e) {
      setSelectedUserAttendanceCount(0);
    } finally {
      setLoadingUserAttendance(false);
    }
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
      const msg = err?.message?.includes('JWT') || err?.message?.includes('expired')
        ? "Tu sesión ha expirado. Por favor recarga la página o inicia sesión de nuevo."
        : (err?.message || "Error al guardar grado.");
      showToast(msg, 'error');
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

      // Si la beca es 100%, auto-activar membresía indefinida en cohab_subscriptions
      if (parseInt(userScholarship, 10) === 100) {
        try {
          const farFuture = '2099-12-31';
          const todayStr = new Date().toISOString().split('T')[0];
          await supabase.from('cohab_profiles').update({ status: 'activo' }).eq('id', selectedUser.id);
          
          // Obtener primer servicio activo
          const { data: srvs } = await supabase.from('cohab_services').select('id').eq('is_active', true).limit(1);
          const defaultServiceId = srvs?.[0]?.id || null;

          await supabase.from('cohab_subscriptions').upsert([{
            profile_id: selectedUser.id,
            service_id: defaultServiceId,
            status: 'active',
            start_date: todayStr,
            end_date: farFuture
          }], { onConflict: 'profile_id,service_id' });
        } catch (subErr) {
          console.warn('Auto-activación de suscripción 100% beca:', subErr);
        }
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

  // 6. CONTROL DE MEMBRESÍAS, PAGOS MANUALES Y REPORTE DE ASISTENCIAS
  const fetchMembershipsOverview = async () => {
    try {
      setLoadingMemberships(true);
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Perfiles con nombre válido
      const { data: profilesData, error: pErr } = await supabase
        .from('cohab_profiles')
        .select('id, name, email, belt, graus, role, is_instructor, staff_title, status, scholarship_percent, trial_classes_used, max_trial_classes')
        .not('name', 'is', null)
        .neq('name', '')
        .order('name', { ascending: true });
      if (pErr) throw pErr;

      // 2. Servicios activos
      const { data: servicesData } = await supabase
        .from('cohab_services')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      // 3. Suscripciones activas
      const { data: subsData } = await supabase
        .from('cohab_subscriptions')
        .select('id, profile_id, service_id, status, start_date, end_date')
        .eq('status', 'active')
        .order('end_date', { ascending: false });

      // 4. Pagos del mes actual (aprobados)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { data: paymentsData } = await supabase
        .from('cohab_payments')
        .select('id, profile_id, amount, status, payment_method, payment_date')
        .eq('status', 'approved')
        .gte('payment_date', startOfMonth.toISOString())
        .order('payment_date', { ascending: false });

      // 5. Pagos pendientes de aprobación (Transferencias / MP en proceso) y rechazados recientes
      const { data: pendingPays } = await supabase
        .from('cohab_payments')
        .select('*')
        .eq('status', 'pending')
        .order('payment_date', { ascending: false });

      const { data: rejectedPays } = await supabase
        .from('cohab_payments')
        .select('*')
        .eq('status', 'rejected')
        .order('payment_date', { ascending: false })
        .limit(10);

      // 6. Configuración bancaria para transferencias
      try {
        const { data: bData } = await supabase
          .from('cohab_bank_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();
        if (bData) {
          setBankForm({
            bank_name: bData.bank_name || '',
            account_type: bData.account_type || '',
            account_number: bData.account_number || '',
            holder_name: bData.holder_name || '',
            holder_rut: bData.holder_rut || '',
            confirmation_email: bData.confirmation_email || '',
            instructions: bData.instructions || ''
          });
        }
      } catch (bErr) {
        console.warn('No se pudo cargar cohab_bank_settings:', bErr);
      }

      let localScholarships = {};
      try {
        localScholarships = JSON.parse(localStorage.getItem('cohab_scholarships') || '{}');
      } catch (e) {}

      const profileMap = new Map((profilesData || []).map(pr => [pr.id, pr]));
      const enrichedPendingPays = (pendingPays || []).map(pay => ({
        ...pay,
        student: profileMap.get(pay.profile_id) || null
      }));
      const enrichedRejectedPays = (rejectedPays || []).map(pay => ({
        ...pay,
        student: profileMap.get(pay.profile_id) || null
      }));

      const enrichedProfiles = (profilesData || [])
        .filter(p => p.name.trim() !== 'Sin nombre')
        .map(p => {
          const scholarship = localScholarships[p.id] !== undefined ? localScholarships[p.id] : (p.scholarship_percent || 0);
          const userSubs = (subsData || []).filter(s => s.profile_id === p.id);
          const activeSub = userSubs.find(s => !s.end_date || s.end_date >= todayStr) || null;
          const latestSub = userSubs[0] || null;
          const subService = (servicesData || []).find(srv => srv.id === (activeSub?.service_id || latestSub?.service_id));
          const pendingPayment = enrichedPendingPays.find(pay => pay.profile_id === p.id) || null;

          let computedStatus = 'vencido';
          if (scholarship === 100) {
            computedStatus = 'beca';
          } else if (activeSub) {
            computedStatus = 'vigente';
          } else if (pendingPayment) {
            computedStatus = 'pendiente';
          } else if ((p.trial_classes_used || 0) < (p.max_trial_classes || 2) && !latestSub) {
            computedStatus = 'prueba';
          }

          return {
            ...p,
            scholarship_percent: scholarship,
            activeSub,
            latestSub,
            serviceName: subService?.name || null,
            pendingPayment,
            computedStatus
          };
        });

      setAllProfiles(enrichedProfiles);
      setAllServices(servicesData || []);
      setAllSubscriptions(subsData || []);
      setMonthPayments(paymentsData || []);
      setPendingPaymentsList(enrichedPendingPays);
      setRejectedPaymentsList(enrichedRejectedPays);

      if (!payServiceId && servicesData && servicesData.length > 0) {
        setPayServiceId(servicesData[0].id);
        setPayAmount(String(servicesData[0].price || 45000));
      }
    } catch (err) {
      console.error('Error cargando resumen de membresías:', err);
      showToast('Error al cargar estado de membresías.', 'error');
    } finally {
      setLoadingMemberships(false);
    }
  };

  // Calcula la mensualidad con descuento de beca (22% deja $45.000 exactamente en $35.000)
  const calculateDiscountedMonthlyPrice = (basePrice, scholarshipPercent) => {
    const pct = Number(scholarshipPercent || 0);
    const price = Number(basePrice || 45000);
    if (pct <= 0) return price;
    if (pct === 22) {
      return price === 45000 ? 35000 : Math.round((price * (35000 / 45000)) / 500) * 500;
    }
    return Math.round(price * (1 - pct / 100));
  };

  // Calcula el monto total a cobrar en el formulario de Pago Manual considerando beca y período
  const calculateManualPaymentAmount = (studentId, serviceId, monthsVal, profilesList = allProfiles, servicesList = allServices) => {
    const student = (profilesList || []).find(p => p.id === studentId);
    const srv = (servicesList || []).find(s => s.id === serviceId) || (servicesList || [])[0];
    const basePrice = Number(srv?.price || 45000);
    const pct = Number(student?.scholarship_percent || 0);
    const isBJJ = !srv || (srv.name || '').toLowerCase().includes('bjj') || (srv.name || '').toLowerCase().includes('jiu jitsu');
    const monthlyAfterScholarship = (pct > 0 && isBJJ)
      ? calculateDiscountedMonthlyPrice(basePrice, pct)
      : basePrice;

    const mult = Math.max(1, parseInt(monthsVal, 10) || 1);
    let prepayDisc = 0;
    if (mult === 3) prepayDisc = 0.10;
    else if (mult === 6) prepayDisc = 0.15;
    else if (mult === 12) prepayDisc = 0.25;

    return Math.round(monthlyAfterScholarship * mult * (1 - prepayDisc));
  };

  const handleRegisterManualPayment = async (e) => {
    e.preventDefault();
    if (!payStudentId || !payServiceId) {
      showToast('Selecciona el alumno y la disciplina.', 'error');
      return;
    }

    try {
      setSavingManualPayment(true);
      const months = Math.max(1, parseInt(payMonths, 10) || 1);
      const amount = Math.max(0, parseFloat(payAmount) || 0);

      // Si el alumno ya tenía un pago pendiente (ej. aviso de transferencia), actualizarlo a aprobado para no duplicar
      const existingPending = pendingPaymentsList.find(p => p.profile_id === payStudentId);
      if (existingPending?.id) {
        await supabase
          .from('cohab_payments')
          .update({
            amount,
            status: 'approved',
            payment_method: payMethod,
            status_detail: 'approved_manual_form',
            payment_date: new Date().toISOString()
          })
          .eq('id', existingPending.id);

        if (existingPending.checkout_session_id) {
          await supabase
            .from('cohab_checkout_sessions')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', existingPending.checkout_session_id);
        }
      } else {
        // Insertar pago aprobado en cohab_payments
        const { error: payErr } = await supabase
          .from('cohab_payments')
          .insert([{
            profile_id: payStudentId,
            amount,
            status: 'approved',
            payment_method: payMethod,
            payment_date: new Date().toISOString()
          }]);
        if (payErr) throw payErr;
      }

      // Buscar si tiene suscripción vigente para encadenar fecha de término
      const today = new Date();
      const { data: currentSub } = await supabase
        .from('cohab_subscriptions')
        .select('end_date')
        .eq('profile_id', payStudentId)
        .eq('service_id', payServiceId)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const activeEnd = currentSub?.end_date ? new Date(currentSub.end_date) : null;
      const startDate = activeEnd && activeEnd > today ? new Date(activeEnd) : new Date(today);
      const endDate = new Date(startDate);
      endDate.setUTCMonth(endDate.getUTCMonth() + months);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Activar perfil en cohab_profiles
      await supabase
        .from('cohab_profiles')
        .update({ status: 'activo' })
        .eq('id', payStudentId);

      // Crear suscripción activa en cohab_subscriptions
      const { error: subErr } = await supabase
        .from('cohab_subscriptions')
        .insert([{
          profile_id: payStudentId,
          service_id: payServiceId,
          status: 'active',
          start_date: startDateStr,
          end_date: endDateStr
        }]);
      if (subErr) throw subErr;

      const studentObj = allProfiles.find(p => p.id === payStudentId);
      showToast(`¡Pago manual (${payMethod}) y membresía hasta ${endDateStr} registrados para ${studentObj?.name || 'el alumno'}!`, 'success');
      setMembershipSubTab('status');
      fetchMembershipsOverview();
    } catch (err) {
      console.error('Error registrando pago manual:', err);
      showToast(err?.message || 'Error al registrar pago manual.', 'error');
    } finally {
      setSavingManualPayment(false);
    }
  };

  // HABILITAR ALUMNO CON PAGO PENDIENTE (1 CLIC HASTA EL PRÓXIMO MES)
  const handleApprovePendingPayment = async (paymentId, overrideMonths = null) => {
    try {
      setApprovingPaymentId(paymentId);
      const { data, error } = await supabase.rpc('cohab_approve_pending_payment', {
        p_payment_id: paymentId,
        p_override_months: overrideMonths
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Error al aprobar el pago.');
      }
      showToast(`¡Alumno habilitado exitosamente hasta ${data?.end_date || 'el próximo mes'}!`, 'success');
      await fetchMembershipsOverview();
    } catch (err) {
      console.error('Error al aprobar pago pendiente:', err);
      showToast(err?.message || 'Error al habilitar al alumno.', 'error');
    } finally {
      setApprovingPaymentId(null);
    }
  };

  const handleRejectPendingPayment = async (paymentId) => {
    if (!window.confirm('¿Seguro que deseas rechazar esta solicitud de pago por transferencia?')) return;
    try {
      setApprovingPaymentId(paymentId);
      const { data, error } = await supabase.rpc('cohab_reject_pending_payment', {
        p_payment_id: paymentId,
        p_reason: 'Rechazado por administración'
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Error al rechazar solicitud.');
      }
      showToast('Solicitud de pago rechazada.', 'success');
      await fetchMembershipsOverview();
    } catch (err) {
      console.error('Error al rechazar pago:', err);
      showToast(err?.message || 'Error al rechazar solicitud.', 'error');
    } finally {
      setApprovingPaymentId(null);
    }
  };

  // HABILITAR DIRECTAMENTE A UN ALUMNO HASTA EL PRÓXIMO MES (1 MES)
  const handleQuickEnableStudentMonth = async (student) => {
    if (student.pendingPayment?.id) {
      await handleApprovePendingPayment(student.pendingPayment.id, 1);
      return;
    }
    const defaultSrv = allServices[0];
    if (!defaultSrv) {
      showToast('No hay disciplinas activas configuradas.', 'error');
      return;
    }
    const pct = Number(student.scholarship_percent || 0);
    const amount = calculateDiscountedMonthlyPrice(defaultSrv.price || 45000, pct);
    const discountLabel = pct > 0 ? ` (Beca ${pct}% aplicada → $${amount.toLocaleString('es-CL')})` : ` ($${amount.toLocaleString('es-CL')})`;

    if (!window.confirm(`¿Deseas habilitar a ${student.name} en "${defaultSrv.name}"${discountLabel} por 1 mes (hasta el próximo mes) mediante pago por transferencia?`)) {
      return;
    }
    try {
      setApprovingPaymentId(student.id);
      const today = new Date();
      const endDate = new Date(today);
      endDate.setUTCMonth(endDate.getUTCMonth() + 1);
      const startDateStr = today.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const { error: payErr } = await supabase.from('cohab_payments').insert([{
        profile_id: student.id,
        amount,
        status: 'approved',
        payment_method: 'transferencia',
        status_detail: 'quick_enabled_by_admin',
        payment_date: new Date().toISOString()
      }]);
      if (payErr) throw payErr;

      await supabase.from('cohab_profiles').update({ status: 'activo' }).eq('id', student.id);

      const { error: subErr } = await supabase.from('cohab_subscriptions').insert([{
        profile_id: student.id,
        service_id: defaultSrv.id,
        status: 'active',
        start_date: startDateStr,
        end_date: endDateStr
      }]);
      if (subErr) throw subErr;

      showToast(`¡${student.name} habilitado hasta ${endDateStr}!`, 'success');
      await fetchMembershipsOverview();
    } catch (err) {
      console.error('Error en habilitación rápida:', err);
      showToast(err?.message || 'Error al habilitar alumno.', 'error');
    } finally {
      setApprovingPaymentId(null);
    }
  };

  const handleSaveBankSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingBankSettings(true);
      const { error } = await supabase
        .from('cohab_bank_settings')
        .upsert({
          id: 1,
          ...bankForm,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      if (error) throw error;
      showToast('¡Datos bancarios para transferencia actualizados!', 'success');
    } catch (err) {
      console.error('Error guardando datos bancarios:', err);
      showToast(err?.message || 'Error al guardar datos bancarios.', 'error');
    } finally {
      setSavingBankSettings(false);
    }
  };

  const fetchMonthlyAttendanceReport = async (monthStr = selectedMonth) => {
    try {
      setLoadingAttendanceReport(true);
      const [year, month] = (monthStr || new Date().toISOString().slice(0, 7)).split('-').map(Number);
      const startOfPeriod = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endOfPeriod = new Date(Date.UTC(year, month, 0, 23, 59, 59));

      const { data, error } = await supabase
        .from('cohab_attendance')
        .select('*')
        .gte('checked_at', startOfPeriod.toISOString())
        .lte('checked_at', endOfPeriod.toISOString())
        .order('checked_at', { ascending: false });

      if (error) throw error;
      setMonthlyAttendances(data || []);
    } catch (err) {
      console.error('Error cargando reporte mensual de asistencias:', err);
    } finally {
      setLoadingAttendanceReport(false);
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
          {activeTab === 'memberships' && 'Membresías, Pagos y Asistencias'}
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

            {/* Alerta destacada de pagos pendientes de habilitación */}
            {pendingPaymentsList.length > 0 && (
              <div
                onClick={() => {
                  setActiveTab('memberships');
                  setMembershipSubTab('status');
                }}
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(6, 11, 24, 0.9))',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  marginBottom: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 8px 25px rgba(245, 158, 11, 0.15)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.8rem' }}>🔔</span>
                  <div>
                    <div style={{ color: '#FBBF24', fontWeight: 900, fontSize: '0.92rem' }}>
                      {pendingPaymentsList.length} Pago(s) por Transferencia Pendiente(s)
                    </div>
                    <div style={{ color: 'var(--text-light)', fontSize: '0.76rem', marginTop: '2px' }}>
                      Toca aquí para revisar y habilitar al alumno hasta el próximo mes.
                    </div>
                  </div>
                </div>
                <span style={{ color: '#FBBF24', fontWeight: 900, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  Revisar →
                </span>
              </div>
            )}

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
                onClick={() => setActiveTab('memberships')}
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
                  <CreditCard size={28} color="#10b981" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ color: 'white', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800 }}>Membresías y Pagos</h4>
                    {pendingPaymentsList.length > 0 && (
                      <span style={{
                        background: '#F59E0B',
                        color: '#060B18',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        padding: '2px 8px',
                        borderRadius: '12px'
                      }}>
                        {pendingPaymentsList.length} pendiente(s)
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.75rem', lineHeight: 1.3 }}>Habilitar transferencias, alumnos al día vs. vencidos y reporte mensual.</p>
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
                              {item.description?.startsWith('Nivel: ') ? item.description.replace('Nivel: ', '') : (item.level || 'Todos')}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{item.video_url || item.url}</span>
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
                  style={{ background: 'linear-gradient(135deg, #10B981, #00B4D8)', color: '#060B18', fontWeight: 900, minHeight: '40px', height: 'auto', padding: '10px 16px', marginTop: '5px' }}
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
                        <span style={{ fontSize: '1.6rem' }}>{item.code || item.emoji || '🎁'}</span>
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

                {/* Aviso y Sugerencia para el Administrador según Asistencias Reales */}
                {(() => {
                  const b = (selectedUser.belt || 'white').toLowerCase();
                  let targetClasses = 150;
                  let targetBelt = 'Azul';
                  let nextBeltVal = 'blue';

                  if (b.includes('white') || b.includes('blanco')) {
                    targetClasses = 150; targetBelt = 'Azul'; nextBeltVal = 'blue';
                  } else if (b.includes('blue') || b.includes('azul')) {
                    targetClasses = 175; targetBelt = 'Morado'; nextBeltVal = 'purple';
                  } else if (b.includes('purple') || b.includes('morado')) {
                    targetClasses = 150; targetBelt = 'Marrón'; nextBeltVal = 'brown';
                  } else if (b.includes('brown') || b.includes('marron') || b.includes('marrón')) {
                    targetClasses = 125; targetBelt = 'Negro'; nextBeltVal = 'black';
                  } else {
                    targetClasses = 600; targetBelt = 'Faixa Preta'; nextBeltVal = 'black';
                  }

                  const hasReachedRequirement = selectedUserAttendanceCount >= targetClasses;

                  return (
                    <div style={{
                      background: hasReachedRequirement ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 180, 216, 0.08)',
                      border: `1px solid ${hasReachedRequirement ? 'rgba(16, 185, 129, 0.4)' : 'rgba(0, 180, 216, 0.25)'}`,
                      borderRadius: '10px',
                      padding: '12px 16px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: hasReachedRequirement ? '#34d399' : 'var(--aurora)' }}>
                            {hasReachedRequirement ? '🏆 ¡Requisito de Asistencia Cumplido!' : '📊 Registro de Asistencia Acumulada'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                            {loadingUserAttendance ? 'Consultando asistencias...' : (
                              <>
                                El alumno acumula <strong>{selectedUserAttendanceCount} clases</strong> en el tatami (Meta estimada: <strong>{targetClasses} clases</strong> para {targetBelt}).
                              </>
                            )}
                          </div>
                        </div>

                        {hasReachedRequirement && (
                          <button
                            type="button"
                            onClick={() => {
                              setUserBelt(nextBeltVal);
                              setUserGraus(0);
                            }}
                            style={{
                              background: '#10b981',
                              color: 'black',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            ⚡ Seleccionar {targetBelt}
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>
                        ℹ️ <em>Nota: La graduación es decisión exclusiva del profesor/administrador. Este aviso es una sugerencia basada en permanencia y asistencias.</em>
                      </div>
                    </div>
                  );
                })()}

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
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 800 }}>Selección Rápida de Beca / Descuento</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                      {[
                        { val: 0, label: '0% Normal', sub: '$45.000' },
                        { val: 22, label: '⚡ 22% Convenio', sub: '$45k → $35.000' },
                        { val: 25, label: '25% Parcial', sub: '$33.750' },
                        { val: 50, label: '50% Media Beca', sub: '$22.500' },
                        { val: 75, label: '75% Beca Mayor', sub: '$11.250' },
                        { val: 100, label: '🎓 100% Beca', sub: '$0 Liberado' }
                      ].map(opt => {
                        const active = Number(userScholarship) === opt.val;
                        return (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setUserScholarship(opt.val)}
                            style={{
                              padding: '8px 6px',
                              borderRadius: '8px',
                              border: active ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                              background: active ? 'rgba(236, 72, 153, 0.18)' : 'rgba(255,255,255,0.03)',
                              color: 'white',
                              cursor: 'pointer',
                              textAlign: 'center'
                            }}
                          >
                            <div style={{ fontWeight: 900, fontSize: '0.76rem', color: active ? '#f472b6' : 'white' }}>{opt.label}</div>
                            <div style={{ fontSize: '0.68rem', color: active ? '#34d399' : 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>{opt.sub}</div>
                          </button>
                        );
                      })}
                    </div>

                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 800 }}>Porcentaje de Beca / Descuento</label>
                    <select 
                      className="form-input" 
                      value={userScholarship} 
                      onChange={e => setUserScholarship(parseInt(e.target.value, 10))} 
                      style={{ background: 'var(--bg-elevated)', color: 'white', height: '38px' }}
                    >
                      <option value={0}>0% - Sin Beca (Pago Completo $45.000)</option>
                      <option value={22}>22% - Beca Especial / Convenio ($45.000 → $35.000)</option>
                      <option value={25}>25% - Beca Parcial (Paga 75% → $33.750)</option>
                      <option value={50}>50% - Media Beca (Paga 50% → $22.500)</option>
                      <option value={75}>75% - Beca Mayor (Paga 25% → $11.250)</option>
                      <option value={100}>100% - Beca Completa (Pago Liberado / Gratis)</option>
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

        {/* 6. PESTAÑA: MEMBRESÍAS, PAGOS MANUALES Y REPORTE DE ASISTENCIA */}
        {activeTab === 'memberships' && (
          <div>
            {/* Sub-navegación interna */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setMembershipSubTab('status')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: membershipSubTab === 'status' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  background: membershipSubTab === 'status' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                  color: membershipSubTab === 'status' ? '#60a5fa' : 'rgba(255,255,255,0.7)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                👥 Estado de Alumnos ({allProfiles.length})
              </button>

              <button
                type="button"
                onClick={() => setMembershipSubTab('payment')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: membershipSubTab === 'payment' ? '#10b981' : 'rgba(255,255,255,0.1)',
                  background: membershipSubTab === 'payment' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                  color: membershipSubTab === 'payment' ? '#34d399' : 'rgba(255,255,255,0.7)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                💵 Registrar Pago Manual
              </button>

              <button
                type="button"
                onClick={() => {
                  setMembershipSubTab('attendance');
                  fetchMonthlyAttendanceReport(selectedMonth);
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: membershipSubTab === 'attendance' ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                  background: membershipSubTab === 'attendance' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                  color: membershipSubTab === 'attendance' ? '#c084fc' : 'rgba(255,255,255,0.7)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                📊 Asistencias del Mes
              </button>

              <button
                type="button"
                onClick={() => setMembershipSubTab('bank')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: membershipSubTab === 'bank' ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                  background: membershipSubTab === 'bank' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
                  color: membershipSubTab === 'bank' ? '#fbbf24' : 'rgba(255,255,255,0.7)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🏦 Datos Transferencia
              </button>

              <button
                type="button"
                onClick={fetchMembershipsOverview}
                title="Refrescar datos"
                style={{
                  marginLeft: 'auto',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                🔄 Actualizar
              </button>
            </div>

            {loadingMemberships ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                Cargando estado general de membresías...
              </div>
            ) : (
              <>
                {/* SUBTAB 1: ESTADO DE ALUMNOS */}
                {membershipSubTab === 'status' && (
                  <div>
                    {/* BANDEJA DE HABILITACIÓN RÁPIDA: PAGOS POR TRANSFERENCIA PENDIENTES */}
                    {pendingPaymentsList.length > 0 && (
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(6, 11, 24, 0.92))',
                        border: '1px solid rgba(245, 158, 11, 0.45)',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '24px',
                        boxShadow: '0 8px 30px rgba(245, 158, 11, 0.12)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.5rem' }}>🔔</span>
                            <div>
                              <h3 style={{ margin: 0, color: '#FBBF24', fontSize: '1.05rem', fontWeight: 900 }}>
                                Solicitudes de Pago por Transferencia Pendientes ({pendingPaymentsList.length})
                              </h3>
                              <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>
                                Revisa el comprobante en tu banco y presiona <strong>Habilitar hasta el Próximo Mes</strong> para activar la membresía del alumno.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {pendingPaymentsList.map(pay => {
                            const isBusy = approvingPaymentId === pay.id;
                            const studentName = pay.student?.name || 'Alumno';
                            const studentEmail = pay.student?.email || '';
                            const dateFormatted = pay.payment_date ? new Date(pay.payment_date).toLocaleString('es-CL') : '';
                            return (
                              <div
                                key={pay.id}
                                style={{
                                  background: 'rgba(0,0,0,0.35)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '12px',
                                  padding: '14px 16px',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '12px'
                                }}
                              >
                                <div>
                                  <div style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span>{studentName}</span>
                                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.2)', color: '#34D399', fontWeight: 900 }}>
                                      ${Number(pay.amount || 0).toLocaleString('es-CL')} CLP
                                    </span>
                                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(245,158,11,0.2)', color: '#FBBF24', fontWeight: 800 }}>
                                      {pay.payment_method === 'transferencia' ? '🏦 Transferencia' : '💳 Mercado Pago'}
                                    </span>
                                    {Number(pay.student?.scholarship_percent || 0) > 0 && (
                                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.22)', border: '1px solid rgba(236, 72, 153, 0.45)', color: '#F472B6', fontWeight: 900 }}>
                                        🎓 Beca {pay.student.scholarship_percent}% Aplicada
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.76rem', marginTop: '3px' }}>
                                    {studentEmail} • Informado: {dateFormatted}
                                  </div>
                                  {pay.notes && (
                                    <div style={{ color: '#60A5FA', fontSize: '0.76rem', marginTop: '4px', fontWeight: 700 }}>
                                      📝 Nota / Comprobante: {pay.notes}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleApprovePendingPayment(pay.id)}
                                    style={{
                                      background: 'linear-gradient(135deg, #10B981, #059669)',
                                      border: 'none',
                                      color: '#060B18',
                                      fontWeight: 900,
                                      fontSize: '0.8rem',
                                      padding: '9px 14px',
                                      borderRadius: '8px',
                                      cursor: isBusy ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    <span>✅ {isBusy ? 'Habilitando...' : 'Habilitar hasta el Próximo Mes'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleRejectPendingPayment(pay.id)}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.35)',
                                      color: '#F87171',
                                      fontWeight: 800,
                                      fontSize: '0.78rem',
                                      padding: '9px 12px',
                                      borderRadius: '8px',
                                      cursor: isBusy ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    ❌ Rechazar
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Tarjetas métricas superiores */}
                    {(() => {
                      const vigentesCount = allProfiles.filter(p => p.computedStatus === 'vigente' || p.computedStatus === 'beca').length;
                      const vencidosCount = allProfiles.filter(p => p.computedStatus === 'vencido').length;
                      const pruebaCount = allProfiles.filter(p => p.computedStatus === 'prueba').length;
                      const becadosCount = allProfiles.filter(p => p.computedStatus === 'beca').length;
                      const totalRecaudado = monthPayments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

                      return (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '16px',
                          marginBottom: '24px'
                        }}>
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '16px 20px',
                            borderRadius: '14px'
                          }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#34d399', fontWeight: 700 }}>
                              Al Día / Vigentes
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', marginTop: '6px' }}>
                              {vigentesCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>({becadosCount} becados 100%)</span>
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '16px 20px',
                            borderRadius: '14px'
                          }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f87171', fontWeight: 700 }}>
                              Membresías Vencidas
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', marginTop: '6px' }}>
                              {vencidosCount}
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            padding: '16px 20px',
                            borderRadius: '14px'
                          }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fbbf24', fontWeight: 700 }}>
                              En Período de Prueba
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', marginTop: '6px' }}>
                              {pruebaCount}
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            padding: '16px 20px',
                            borderRadius: '14px'
                          }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#60a5fa', fontWeight: 700 }}>
                              Recaudado este Mes
                            </div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', marginTop: '6px' }}>
                              ${totalRecaudado.toLocaleString('es-CL')}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Filtros y buscador */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '20px',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                          { key: 'todos', label: 'Todos' },
                          { key: 'vigente', label: '✅ Vigentes' },
                          { key: 'pendiente', label: `⏳ Pago Pendiente (${allProfiles.filter(p => p.computedStatus === 'pendiente').length})` },
                          { key: 'vencido', label: '⚠️ Vencidos' },
                          { key: 'beca', label: '🎓 Becados 100%' },
                          { key: 'prueba', label: '🥋 En Prueba' }
                        ].map(f => (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setMemberFilter(f.key)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '20px',
                              border: memberFilter === f.key ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                              background: memberFilter === f.key ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                              color: 'white',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <div style={{ minWidth: '260px', flex: '1', maxWidth: '360px' }}>
                        <input
                          type="text"
                          placeholder="Buscar alumno por nombre o email..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: 'white',
                            fontSize: '0.85rem'
                          }}
                        />
                      </div>
                    </div>

                    {/* Lista de Alumnos */}
                    {(() => {
                      const filtered = allProfiles.filter(p => {
                        if (memberFilter !== 'todos' && p.computedStatus !== memberFilter) return false;
                        if (memberSearch.trim()) {
                          const q = memberSearch.toLowerCase();
                          const matchesName = (p.name || '').toLowerCase().includes(q);
                          const matchesEmail = (p.email || '').toLowerCase().includes(q);
                          if (!matchesName && !matchesEmail) return false;
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div style={{
                            padding: '40px',
                            textAlign: 'center',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '12px',
                            color: 'rgba(255,255,255,0.5)'
                          }}>
                            No se encontraron alumnos con los filtros seleccionados.
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {filtered.map(st => {
                            const isVigente = st.computedStatus === 'vigente';
                            const isBeca = st.computedStatus === 'beca';
                            const isPrueba = st.computedStatus === 'prueba';
                            const isPendiente = st.computedStatus === 'pendiente';

                            const badgeBg = isBeca
                              ? 'rgba(236, 72, 153, 0.2)'
                              : isVigente
                              ? 'rgba(16, 185, 129, 0.2)'
                              : isPendiente
                              ? 'rgba(245, 158, 11, 0.25)'
                              : isPrueba
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)';

                            const badgeColor = isBeca
                              ? '#f472b6'
                              : isVigente
                              ? '#34d399'
                              : isPendiente
                              ? '#fbbf24'
                              : isPrueba
                              ? '#fbbf24'
                              : '#f87171';

                            const badgeBorder = isBeca
                              ? 'rgba(236, 72, 153, 0.4)'
                              : isVigente
                              ? 'rgba(16, 185, 129, 0.4)'
                              : isPendiente
                              ? 'rgba(245, 158, 11, 0.5)'
                              : isPrueba
                              ? 'rgba(245, 158, 11, 0.4)'
                              : 'rgba(239, 68, 68, 0.4)';

                            const badgeText = isBeca
                              ? '🎓 Beca 100%'
                              : isVigente
                              ? '✅ Al Día'
                              : isPendiente
                              ? '⏳ Pago Pendiente'
                              : isPrueba
                              ? `🥋 Prueba (${st.trial_classes_used || 0}/${st.max_trial_classes || 2})`
                              : '⚠️ Vencido';

                            return (
                              <div
                                key={st.id}
                                style={{
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: '12px',
                                  padding: '16px 20px',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '14px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '240px' }}>
                                  <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.2rem',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}>
                                    🥋
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {st.name}
                                      {st.role === 'admin' && (
                                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderRadius: '4px' }}>
                                          ADMIN
                                        </span>
                                      )}
                                      {st.is_instructor && (
                                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', borderRadius: '4px' }}>
                                          PROFESOR
                                        </span>
                                      )}
                                      {Number(st.scholarship_percent || 0) > 0 && Number(st.scholarship_percent) < 100 && (
                                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'rgba(236, 72, 153, 0.18)', border: '1px solid rgba(236, 72, 153, 0.4)', color: '#f472b6', borderRadius: '6px', fontWeight: 800 }}>
                                          🎓 Beca {st.scholarship_percent}% (${calculateDiscountedMonthlyPrice(45000, st.scholarship_percent).toLocaleString('es-CL')}/mes)
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                                      {st.email} • Faixa {getBeltLabel(st.belt)} ({st.graus || 0}º Grau)
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                      display: 'inline-block',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      background: badgeBg,
                                      color: badgeColor,
                                      border: `1px solid ${badgeBorder}`,
                                      fontSize: '0.78rem',
                                      fontWeight: 800
                                    }}>
                                      {badgeText}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                                      {st.activeSub?.end_date 
                                        ? `Vence: ${st.activeSub.end_date}` 
                                        : st.latestSub?.end_date 
                                        ? `Expiró: ${st.latestSub.end_date}` 
                                        : 'Sin suscripción registrada'}
                                      {st.serviceName && ` (${st.serviceName})`}
                                    </div>
                                  </div>

                                  {!isVigente && !isBeca && (
                                    <button
                                      type="button"
                                      disabled={approvingPaymentId === (st.pendingPayment?.id || st.id)}
                                      onClick={() => handleQuickEnableStudentMonth(st)}
                                      style={{
                                        background: isPendiente ? 'linear-gradient(135deg, #10B981, #059669)' : 'rgba(59, 130, 246, 0.15)',
                                        border: isPendiente ? 'none' : '1px solid rgba(59, 130, 246, 0.4)',
                                        color: isPendiente ? '#060B18' : '#60A5FA',
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        fontWeight: 800,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}
                                      title="Habilita al alumno por 1 mes (hasta el próximo mes)"
                                    >
                                      ✅ {isPendiente ? 'Habilitar Solicitud (1 Mes)' : 'Habilitar 1 Mes'}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayStudentId(st.id);
                                      const defaultSrvId = payServiceId || allServices[0]?.id || '';
                                      if (!payServiceId && defaultSrvId) setPayServiceId(defaultSrvId);
                                      const calcAmt = st.pendingPayment?.amount !== undefined && st.pendingPayment?.amount !== null
                                        ? Number(st.pendingPayment.amount)
                                        : calculateManualPaymentAmount(st.id, defaultSrvId, payMonths);
                                      setPayAmount(String(calcAmt));
                                      setMembershipSubTab('payment');
                                    }}
                                    style={{
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      border: '1px solid rgba(16, 185, 129, 0.4)',
                                      color: '#34d399',
                                      padding: '8px 14px',
                                      borderRadius: '8px',
                                      fontWeight: 700,
                                      fontSize: '0.82rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    💵 Registrar Pago
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* SUBTAB 2: REGISTRO DE PAGO MANUAL */}
                {membershipSubTab === 'payment' && (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '28px',
                    maxWidth: '680px',
                    margin: '0 auto'
                  }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'white' }}>
                      💵 Registrar Pago Manual (Efectivo / Transferencia)
                    </h3>
                    <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                      Registra una mensualidad pagada directamente en el Dojo o transferida a la cuenta del taller/academia. Al guardar, se activará automáticamente el acceso y la vigencia del alumno.
                    </p>

                    <form onSubmit={handleRegisterManualPayment} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                          1. Alumno
                        </label>
                        <select
                          value={payStudentId}
                          onChange={(e) => {
                            const newStId = e.target.value;
                            setPayStudentId(newStId);
                            if (newStId) {
                              const stObj = allProfiles.find(p => p.id === newStId);
                              const calcAmt = stObj?.pendingPayment?.amount !== undefined && stObj?.pendingPayment?.amount !== null
                                ? Number(stObj.pendingPayment.amount)
                                : calculateManualPaymentAmount(newStId, payServiceId, payMonths);
                              setPayAmount(String(calcAmt));
                            }
                          }}
                          required
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: '#18181b',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            fontSize: '0.9rem'
                          }}
                        >
                          <option value="">-- Seleccionar Alumno --</option>
                          {allProfiles.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.email}) - {p.computedStatus.toUpperCase()}{Number(p.scholarship_percent || 0) > 0 ? ` • BECA ${p.scholarship_percent}%` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Aviso automático de Beca / Descuento o Transferencia Pendiente del alumno seleccionado */}
                      {(() => {
                        const stObj = allProfiles.find(p => p.id === payStudentId);
                        if (!stObj) return null;
                        const pct = Number(stObj.scholarship_percent || 0);
                        const srvObj = allServices.find(s => s.id === payServiceId) || allServices[0];
                        const baseP = Number(srvObj?.price || 45000);
                        const discMonthly = calculateDiscountedMonthlyPrice(baseP, pct);

                        if (pct <= 0 && !stObj.pendingPayment) return null;

                        return (
                          <div style={{
                            background: 'rgba(236, 72, 153, 0.12)',
                            border: '1px solid rgba(236, 72, 153, 0.4)',
                            borderRadius: '10px',
                            padding: '12px 16px',
                            fontSize: '0.82rem',
                            color: 'white',
                            lineHeight: 1.45
                          }}>
                            {pct > 0 && (
                              <div style={{ color: '#F472B6', fontWeight: 900, marginBottom: stObj.pendingPayment ? '6px' : 0 }}>
                                🎓 Descuento Activo ({pct}% Beca): Tarifa base ${baseP.toLocaleString('es-CL')} → Tarifa mensual con descuento <strong>${discMonthly.toLocaleString('es-CL')} CLP</strong>. El monto inferior se ajustó automáticamente.
                              </div>
                            )}
                            {stObj.pendingPayment && (
                              <div style={{ color: '#FBBF24', fontWeight: 800 }}>
                                ⏳ Este alumno tiene un aviso de pago pendiente por <strong>${Number(stObj.pendingPayment.amount || 0).toLocaleString('es-CL')} CLP</strong>{stObj.pendingPayment.notes ? ` (${stObj.pendingPayment.notes})` : ''}. Al confirmar aquí, esa solicitud quedará aprobada.
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                          2. Disciplina / Servicio
                        </label>
                        <select
                          value={payServiceId}
                          onChange={(e) => {
                            const sId = e.target.value;
                            setPayServiceId(sId);
                            setPayAmount(String(calculateManualPaymentAmount(payStudentId, sId, payMonths)));
                          }}
                          required
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: '#18181b',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            fontSize: '0.9rem'
                          }}
                        >
                          <option value="">-- Seleccionar Disciplina --</option>
                          {allServices.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} (${Number(s.price || 0).toLocaleString('es-CL')} / mes)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                            3. Período a Renovar
                          </label>
                          <select
                            value={payMonths}
                            onChange={(e) => {
                              const m = e.target.value;
                              setPayMonths(m);
                              setPayAmount(String(calculateManualPaymentAmount(payStudentId, payServiceId, m)));
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: '#18181b',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: 'white',
                              fontSize: '0.9rem'
                            }}
                          >
                            <option value="1">1 Mes (Plan Mensual)</option>
                            <option value="3">3 Meses (10% Dcto. Anticipado)</option>
                            <option value="6">6 Meses (15% Dcto. Semestral)</option>
                            <option value="12">12 Meses (25% Dcto. Anual)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                            4. Método de Pago
                          </label>
                          <select
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: '#18181b',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: 'white',
                              fontSize: '0.9rem'
                            }}
                          >
                            <option value="transferencia">🏦 Transferencia Bancaria</option>
                            <option value="efectivo">💵 Efectivo en Recepción</option>
                            <option value="debito_credito">💳 POS / Tarjeta Presencial</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                          5. Monto Cobrado (CLP)
                        </label>
                        <input
                          type="number"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          min="0"
                          step="1000"
                          required
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            fontSize: '1.1rem',
                            fontWeight: 800
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <button
                          type="submit"
                          disabled={savingManualPayment}
                          style={{
                            flex: 1,
                            padding: '12px 20px',
                            borderRadius: '8px',
                            background: '#10b981',
                            color: 'black',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {savingManualPayment ? 'Procesando y Activando...' : 'Confirmar y Activar Membresía'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMembershipSubTab('status')}
                          style={{
                            padding: '12px 20px',
                            borderRadius: '8px',
                            background: 'transparent',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Volver
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* SUBTAB 4: DATOS BANCARIOS PARA TRANSFERENCIA */}
                {membershipSubTab === 'bank' && (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '28px',
                    maxWidth: '680px',
                    margin: '0 auto'
                  }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'white' }}>
                      🏦 Configurar Datos Bancarios para Transferencias
                    </h3>
                    <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                      Estos datos se muestran a los alumnos y apoderados cuando seleccionan pagar su membresía mediante Transferencia Bancaria.
                    </p>

                    <form onSubmit={handleSaveBankSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                          Nombre del Titular / Academia
                        </label>
                        <input
                          type="text"
                          value={bankForm.holder_name}
                          onChange={(e) => setBankForm(prev => ({ ...prev, holder_name: e.target.value }))}
                          required
                          className="form-input"
                          style={{ background: '#18181b', color: 'white' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                            RUT del Titular
                          </label>
                          <input
                            type="text"
                            value={bankForm.holder_rut}
                            onChange={(e) => setBankForm(prev => ({ ...prev, holder_rut: e.target.value }))}
                            placeholder="Ej: 12.345.678-9"
                            className="form-input"
                            style={{ background: '#18181b', color: 'white' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                            Banco
                          </label>
                          <input
                            type="text"
                            value={bankForm.bank_name}
                            onChange={(e) => setBankForm(prev => ({ ...prev, bank_name: e.target.value }))}
                            required
                            placeholder="Ej: Banco de Chile / BancoEstado"
                            className="form-input"
                            style={{ background: '#18181b', color: 'white' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                            Tipo de Cuenta
                          </label>
                          <input
                            type="text"
                            value={bankForm.account_type}
                            onChange={(e) => setBankForm(prev => ({ ...prev, account_type: e.target.value }))}
                            required
                            placeholder="Ej: Cuenta Corriente / Cuenta Vista"
                            className="form-input"
                            style={{ background: '#18181b', color: 'white' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                            Número de Cuenta
                          </label>
                          <input
                            type="text"
                            value={bankForm.account_number}
                            onChange={(e) => setBankForm(prev => ({ ...prev, account_number: e.target.value }))}
                            required
                            placeholder="Ej: 00-123-45678-9"
                            className="form-input"
                            style={{ background: '#18181b', color: 'white' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                          Correo de Confirmación
                        </label>
                        <input
                          type="email"
                          value={bankForm.confirmation_email}
                          onChange={(e) => setBankForm(prev => ({ ...prev, confirmation_email: e.target.value }))}
                          required
                          className="form-input"
                          style={{ background: '#18181b', color: 'white' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button
                          type="submit"
                          disabled={savingBankSettings}
                          style={{
                            flex: 1,
                            padding: '12px 20px',
                            borderRadius: '8px',
                            background: '#10b981',
                            color: '#060B18',
                            fontWeight: 900,
                            fontSize: '0.9rem',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {savingBankSettings ? 'Guardando...' : '💾 Guardar Datos Bancarios'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* SUBTAB 3: REPORTE DE ASISTENCIAS DEL MES */}
                {membershipSubTab === 'attendance' && (
                  <div>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                          📅 Seleccionar Mes:
                        </span>
                        <input
                          type="month"
                          value={selectedMonth}
                          onChange={(e) => {
                            setSelectedMonth(e.target.value);
                            fetchMonthlyAttendanceReport(e.target.value);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: '#18181b',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            fontSize: '0.9rem'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                          🥋 Filtrar por Disciplina / Horario:
                        </span>
                        <select
                          value={selectedInstructorFilter}
                          onChange={(e) => setSelectedInstructorFilter(e.target.value)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: '#18181b',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            fontSize: '0.85rem'
                          }}
                        >
                          <option value="all">Todas las clases</option>
                          {allServices.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {loadingAttendanceReport ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                        Cargando asistencias de {selectedMonth}...
                      </div>
                    ) : (
                      <>
                        {/* Resumen por disciplina y total */}
                        {(() => {
                          const filteredAtt = monthlyAttendances.filter(a => {
                            if (selectedInstructorFilter !== 'all' && a.service_id !== selectedInstructorFilter) {
                              return false;
                            }
                            return true;
                          });

                          return (
                            <div>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: '14px',
                                marginBottom: '24px'
                              }}>
                                <div style={{
                                  background: 'rgba(139, 92, 246, 0.1)',
                                  border: '1px solid rgba(139, 92, 246, 0.3)',
                                  padding: '16px 20px',
                                  borderRadius: '12px'
                                }}>
                                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#c084fc', fontWeight: 700 }}>
                                    Total Asistencias en {selectedMonth}
                                  </div>
                                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', marginTop: '6px' }}>
                                    {filteredAtt.length} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>check-ins</span>
                                  </div>
                                </div>

                                {allServices.map(srv => {
                                  const count = monthlyAttendances.filter(a => a.service_id === srv.id).length;
                                  return (
                                    <div
                                      key={srv.id}
                                      style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        padding: '16px 20px',
                                        borderRadius: '12px'
                                      }}
                                    >
                                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                                        {srv.name}
                                      </div>
                                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginTop: '6px' }}>
                                        {count} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>asistencias</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Tabla o lista detallada de check-ins */}
                              <div style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '12px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  padding: '14px 20px',
                                  background: 'rgba(255,255,255,0.04)',
                                  fontWeight: 800,
                                  fontSize: '0.9rem',
                                  color: 'white',
                                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                                }}>
                                  Detalle de Asistencias ({filteredAtt.length})
                                </div>

                                {filteredAtt.length === 0 ? (
                                  <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                                    No hay registros de asistencias para el mes y filtros seleccionados.
                                  </div>
                                ) : (
                                  <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                                    {filteredAtt.map((att, idx) => {
                                      const student = allProfiles.find(p => p.id === att.profile_id);
                                      const srv = allServices.find(s => s.id === att.service_id);
                                      const dateStr = att.checked_at ? new Date(att.checked_at).toLocaleString('es-CL') : 'Fecha no registrada';

                                      return (
                                        <div
                                          key={att.id || idx}
                                          style={{
                                            padding: '12px 20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            fontSize: '0.85rem'
                                          }}
                                        >
                                          <div>
                                            <span style={{ fontWeight: 700, color: 'white' }}>
                                              {student?.name || 'Alumno'}
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '8px' }}>
                                              {srv?.name || 'Clase General'}
                                            </span>
                                          </div>
                                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                            {dateStr}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
