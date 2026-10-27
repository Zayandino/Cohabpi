import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  FileText, ShieldCheck, CheckCircle2, AlertCircle, 
  ArrowRight, ArrowLeft, RefreshCw, CreditCard, Clock, 
  Award, Sparkles, ChevronDown, ChevronUp, Info
} from 'lucide-react';

export default function FormalizationFlow() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Lectura Protocolo, 2: Firma, 3: Selección de Plan y Pago
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Alumnos vinculados (titular y familiares)
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [protocolContent, setProtocolContent] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);

  // Canvas de Firma
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [acceptedClauses, setAcceptedClauses] = useState({
    deberes: false,
    derechos: false,
    sanciones: false,
    reuniones: false
  });

  // Servicios / Planes disponibles en BD
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Cargar estudiantes del núcleo familiar y servicios
  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      try {
        setLoading(true);

        // 1. Cargar dependientes
        const { data: familyData } = await supabase
          .from('cohab_profiles')
          .select('*')
          .eq('parent_id', user.id);

        const list = [];
        // Agregar titular si no tiene parent_id
        if (profile && !profile.parent_id) {
          list.push({
            id: profile.id,
            name: profile.name,
            rut: profile.rut,
            birthdate: profile.birthdate,
            isTitular: true,
            belt: profile.belt || 'Cinturón Blanco'
          });
        }
        if (familyData && familyData.length > 0) {
          familyData.forEach(fam => {
            list.push({
              id: fam.id,
              name: fam.name,
              rut: fam.rut,
              birthdate: fam.birthdate,
              isTitular: false,
              relationship: fam.relationship || 'hijo',
              belt: fam.belt || 'Cinturón Blanco'
            });
          });
        }

        setStudents(list);
        if (list.length > 0) {
          setSelectedStudentId(list[0].id);
        }

        // 2. Cargar servicios activos
        const { data: servicesData } = await supabase
          .from('cohab_services')
          .select('*')
          .order('price', { ascending: true });

        if (servicesData && servicesData.length > 0) {
          setServices(servicesData);
          setSelectedServiceId(servicesData[0].id);
        }
      } catch (err) {
        console.error('Error al cargar datos:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, profile]);

  // Al cambiar de alumno, determinar su grupo etario y cargar el documento correspondiente
  const currentStudent = students.find(s => s.id === selectedStudentId);

  const getAgeGroupCode = (birthdate) => {
    if (!birthdate) return 'adulto';
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    if (age < 8) return 'sub8';
    if (age <= 13) return 'infantil';
    if (age <= 17) return 'adolescente';
    return 'adulto';
  };

  const currentAudience = currentStudent ? getAgeGroupCode(currentStudent.birthdate) : 'adulto';

  // Cargar contenido oficial del protocolo v5 desde cohab_documents
  useEffect(() => {
    async function fetchDocument() {
      if (!currentAudience) return;
      const { data } = await supabase
        .from('cohab_documents')
        .select('*')
        .eq('code', 'protocolo_v5')
        .eq('target_audience', currentAudience)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setProtocolContent(data);
      }
    }
    fetchDocument();
  }, [currentAudience]);

  // Inicializar canvas en paso 2
  useEffect(() => {
    if (step === 2 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * scale;
      canvas.height = 140 * scale;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = '140px';
      
      ctx.scale(scale, scale);
      ctx.strokeStyle = '#00B4D8';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [step]);

  // Helpers de Dibujo Canvas
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
  };

  // Validaciones
  const handleNextFromStep1 = () => {
    if (!acceptedClauses.deberes || !acceptedClauses.derechos || !acceptedClauses.sanciones) {
      setError('Por favor marca los casilleros confirmando la lectura de los deberes, derechos y sanciones.');
      return;
    }
    if (currentAudience !== 'adulto' && !acceptedClauses.reuniones) {
      setError('Debes aceptar el compromiso de asistencia a las 4 reuniones anuales de apoderados.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextFromStep2 = async () => {
    if (!hasSignature) {
      setError('Por favor realiza la firma digital para refrendar el Protocolo de Compromiso.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');

      // Guardar consentimiento en cohab_consents
      if (protocolContent?.id) {
        const { error: consentError } = await supabase
          .from('cohab_consents')
          .insert({
            profile_id: currentStudent.id,
            signed_by: user.id,
            document_id: protocolContent.id,
            signature_url: signatureDataUrl,
            signer_name: profile.name,
            signer_rut: profile.rut,
            signer_relationship: currentStudent.isTitular ? 'titular' : 'apoderado'
          });

        if (consentError) throw consentError;
      }

      setStep(3); // Paso a pago de membresía
    } catch (err) {
      console.error('Error al guardar firma:', err);
      setError(err.message || 'Error al guardar la firma del protocolo.');
    } finally {
      setLoading(false);
    }
  };

  // Procesar Pago de Membresía vía Mercado Pago
  const handleProceedPayment = async () => {
    setIsProcessingPayment(true);
    setError(null);

    try {
      const selectedPlan = services.find(s => s.id === selectedServiceId);
      if (!selectedPlan) throw new Error('Selecciona un plan de membresía.');

      // 1. Guardar la sesión de checkout en cohab_checkout_sessions
      const cartItems = [{
        personId: currentStudent.id,
        serviceId: selectedPlan.id,
        price: Number(selectedPlan.price),
        serviceName: selectedPlan.name
      }];

      const { data: sessionData, error: sessionError } = await supabase
        .from('cohab_checkout_sessions')
        .insert({
          profile_id: user.id,
          cart_items: cartItems,
          total_amount: Number(selectedPlan.price),
          status: 'pending'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 2. Invocar Edge Function create-preference
      const { data: prefData, error: prefError } = await supabase.functions.invoke('create-preference', {
        body: {
          sessionId: sessionData.id,
          payerEmail: profile.email || user.email,
          payerName: profile.name,
          title: `COHAB BJJ - Membresía 2026: ${selectedPlan.name}`,
          unitPrice: Number(selectedPlan.price),
          quantity: 1
        }
      });

      if (prefError) throw prefError;

      // 3. Redirigir al checkout de Mercado Pago
      if (prefData?.init_point) {
        window.location.href = prefData.init_point;
      } else {
        throw new Error('No se pudo generar el enlace de pago con Mercado Pago.');
      }
    } catch (err) {
      console.error('Error al iniciar pago:', err);
      setError(err.message || 'Error al conectar con la pasarela de pagos.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px 16px 100px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      fontFamily: 'var(--font-body)',
      color: 'white'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '580px',
        background: 'rgba(10, 17, 40, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '24px',
        padding: '30px 24px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
      }}>

        {/* Encabezado */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(0, 180, 216, 0.12)', border: '1px solid rgba(0, 180, 216, 0.3)', borderRadius: '30px', marginBottom: '12px' }}>
            <Award size={14} color="#00B4D8" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00B4D8', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Etapa 2 · Protocolo de Compromiso v5 & Matrícula
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 800, margin: '4px 0', letterSpacing: '-0.3px' }}>
            {step === 1 && 'Lectura del Protocolo de Compromiso'}
            {step === 2 && 'Firma Legal y Visado Institucional'}
            {step === 3 && 'Activación de Membresía Temporada 2026'}
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            {currentStudent ? `Formalizando expediente para: ${currentStudent.name}` : 'COHAB Los Andes · Sección BJJ'}
          </p>

          {/* Selector de alumno si hay más de 1 */}
          {students.length > 1 && step === 1 && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {students.map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStudentId(st.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: st.id === selectedStudentId ? 'rgba(0, 180, 216, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: st.id === selectedStudentId ? '1px solid #00B4D8' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: st.id === selectedStudentId ? '#00B4D8' : 'var(--text-muted)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {st.name} ({st.isTitular ? 'Titular' : 'Pupilo'})
                </button>
              ))}
            </div>
          )}

          {/* Barra de Progreso */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: i <= step ? 'linear-gradient(90deg, #00B4D8, #48CAE4)' : 'rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '20px',
            color: '#FCA5A5',
            fontSize: '0.82rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================
            PASO 1: Lectura Interactiva del Protocolo v5
        ======================================================== */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Banner de Categoría */}
            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: currentAudience === 'sub8' ? 'rgba(0, 180, 216, 0.15)' :
                          currentAudience === 'infantil' ? 'rgba(245, 158, 11, 0.15)' :
                          currentAudience === 'adolescente' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${
                currentAudience === 'sub8' ? '#00B4D8' :
                currentAudience === 'infantil' ? '#F59E0B' :
                currentAudience === 'adolescente' ? '#EC4899' : '#10B981'
              }`,
              fontSize: '0.8rem',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <ShieldCheck size={20} color={
                currentAudience === 'sub8' ? '#00B4D8' :
                currentAudience === 'infantil' ? '#F59E0B' :
                currentAudience === 'adolescente' ? '#EC4899' : '#10B981'
              } />
              <div>
                <strong>Categoría: </strong>
                {currentAudience === 'sub8' && 'Apoderado Sub-8 (Hasta 7 años) — Color Azul'}
                {currentAudience === 'infantil' && 'Apoderado Infantil (8–13 años) — Color Amarillo'}
                {currentAudience === 'adolescente' && 'Apoderado Jóvenes (14–17 años) — Color Rosa'}
                {currentAudience === 'adulto' && 'Practicante Adulto (18+ años) — Color Verde'}
              </div>
            </div>

            {/* Acordeón de Secciones del Protocolo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Sección 1: Los 11 Deberes */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <button
                  type="button"
                  onClick={() => setExpandedSection(expandedSection === 'deberes' ? null : 'deberes')}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <span>I. Los 11 Deberes Obligatorios del Alumno/Apoderado</span>
                  {expandedSection === 'deberes' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSection === 'deberes' && (
                  <div style={{ padding: '0 14px 14px', fontSize: '0.78rem', color: 'var(--text-light)', lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 6px' }}><strong>1. Puntualidad:</strong> Llegar a tiempo a cada clase.</p>
                    <p style={{ margin: '0 0 6px' }}><strong>2. Respeto mutuo:</strong> Prohibida agresión verbal dentro y fuera del dojo.</p>
                    <p style={{ margin: '0 0 6px' }}><strong>3. No usar el BJJ para agredir:</strong> El arte suave es exclusivo para defensa y deporte. Usarlo para agredir es causa de expulsión inmediata.</p>
                    <p style={{ margin: '0 0 6px' }}><strong>4. Higiene:</strong> Kimono limpio, uñas cortas y aseo personal riguroso.</p>
                    <p style={{ margin: '0 0 6px' }}><strong>5. Actitud:</strong> Humildad y constancia en el aprendizaje.</p>
                    <p style={{ margin: '0 0 6px' }}><strong>6. Cuidado en el sparring:</strong> <em>¡Cuando el compañero toca (TAP), se suelta de inmediato! Siempre.</em></p>
                    <p style={{ margin: '0 0 6px' }}><strong>7. Valores:</strong> Representar a COHAB con honestidad y solidaridad.</p>
                    <p style={{ margin: '0 0 6px' }}><strong>8. Comunicación:</strong> Notificar oportunamente cualquier lesión o dificultad física.</p>
                    <p style={{ margin: '0 0 6px' }}><strong>9. Mensualidad:</strong> Pago puntual en los primeros 5 días de cada mes.</p>
                    <p style={{ margin: '0 0 6px' }}><strong>10. Espacio sagrado:</strong> Sin celulares ni calzado de calle en el tatami.</p>
                    <p style={{ margin: 0 }}><strong>11. Reuniones:</strong> Asistir a las 4 reuniones bimestrales (apoderados).</p>
                  </div>
                )}
              </div>

              {/* Sección 2: Derechos del Alumno */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <button
                  type="button"
                  onClick={() => setExpandedSection(expandedSection === 'derechos' ? null : 'derechos')}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <span>II. Derechos del Alumno</span>
                  {expandedSection === 'derechos' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSection === 'derechos' && (
                  <div style={{ padding: '0 14px 14px', fontSize: '0.78rem', color: 'var(--text-light)', lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 6px' }}>• <strong>Enseñanza de calidad:</strong> Clases estructuradas según pauta técnica oficial.</p>
                    <p style={{ margin: '0 0 6px' }}>• <strong>Trato digno:</strong> Libre de humillaciones, gritos o discriminación.</p>
                    <p style={{ margin: '0 0 6px' }}>• <strong>Progresión justa:</strong> Evaluación transparente con regla del 70% de asistencia mínima.</p>
                    <p style={{ margin: 0 }}>• <strong>Voz y participación:</strong> Espacio de diálogo abierto con los profesores.</p>
                  </div>
                )}
              </div>

              {/* Sección 3: Consecuencias del Incumplimiento */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <button
                  type="button"
                  onClick={() => setExpandedSection(expandedSection === 'sanciones' ? null : 'sanciones')}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <span>III. Escala de Faltas y Consecuencias</span>
                  {expandedSection === 'sanciones' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandedSection === 'sanciones' && (
                  <div style={{ padding: '0 14px 14px', fontSize: '0.78rem', color: 'var(--text-light)', lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 6px' }}>• <strong>Leve (impuntualidad, distracción):</strong> Diálogo privado + anotación en ficha.</p>
                    <p style={{ margin: '0 0 6px' }}>• <strong>Moderada (falta de respeto verbal, mal uso de sparring):</strong> Amonestación escrita + suspensión de 1 a 2 clases.</p>
                    <p style={{ margin: 0 }}>• <strong>Grave (agresión fuera del dojo, deshonestidad grave):</strong> Suspensión inmediata y posible expulsión.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Checkboxes de Aceptación */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.78rem', color: 'var(--text-light)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={acceptedClauses.deberes}
                  onChange={e => setAcceptedClauses(prev => ({ ...prev, deberes: e.target.checked }))}
                  style={{ marginTop: '2px' }}
                />
                <span>Comprendo y me comprometo al cumplimiento de los 11 Deberes Obligatorios de la Sección BJJ.</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.78rem', color: 'var(--text-light)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={acceptedClauses.derechos}
                  onChange={e => setAcceptedClauses(prev => ({ ...prev, derechos: e.target.checked }))}
                  style={{ marginTop: '2px' }}
                />
                <span>Conozco mis derechos como practicante y las exigencias de respeto mutuo en el dojo.</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.78rem', color: 'var(--text-light)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={acceptedClauses.sanciones}
                  onChange={e => setAcceptedClauses(prev => ({ ...prev, sanciones: e.target.checked }))}
                  style={{ marginTop: '2px' }}
                />
                <span>Acepto la escala de faltas proporcionales en caso de incumplimiento de conducta.</span>
              </label>

              {currentAudience !== 'adulto' && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.78rem', color: '#F59E0B', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={acceptedClauses.reuniones}
                    onChange={e => setAcceptedClauses(prev => ({ ...prev, reuniones: e.target.checked }))}
                    style={{ marginTop: '2px' }}
                  />
                  <span>
                    <strong>Compromiso de Apoderado:</strong> Asistiré a las 4 reuniones bimestrales del año (Junio, Agosto, Octubre, Diciembre) o avisaré con 48 hrs para designar un adulto responsable.
                  </span>
                </label>
              )}
            </div>

            <button 
              type="button" 
              onClick={handleNextFromStep1}
              style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0077B6, #00B4D8)',
                border: 'none',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>Continuar a la Firma Digital</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ========================================================
            PASO 2: Firma Digital Táctil y Visado Institucional
        ======================================================== */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '0.78rem',
              color: 'var(--text-light)'
            }}>
              <div style={{ fontWeight: 800, color: '#00B4D8', marginBottom: '4px' }}>
                {currentStudent?.isTitular ? 'DECLARACIÓN DEL PRACTICANTE ADULTO (PARTE A)' : 'DECLARACIÓN DEL APODERADO / TUTOR LEGAL (PARTE B)'}
              </div>
              <p style={{ margin: '0 0 6px' }}>
                Firmante: <strong>{profile?.name}</strong> (RUT: {profile?.rut || '—'})
              </p>
              <p style={{ margin: 0 }}>
                {currentStudent?.isTitular 
                  ? 'Declaro haber leído y comprendido el presente Protocolo de Compromiso v5, aceptando voluntariamente sus deberes y derechos.'
                  : `Como apoderado/a, declaro haber leído este Protocolo, explicado su contenido a ${currentStudent?.name} y me comprometo a velar activamente por su cumplimiento.`}
              </p>
            </div>

            {/* Recuadro de Firma Digital */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Firma Digital Táctil *
                </label>
                <button 
                  type="button" 
                  onClick={clearSignature}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#00B4D8',
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={12} /> Limpiar trazo
                </button>
              </div>

              <div style={{
                border: hasSignature ? '2px solid #00B4D8' : '1px dashed rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                background: 'rgba(6, 11, 24, 0.6)',
                touchAction: 'none',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <canvas 
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{ width: '100%', height: '140px', display: 'block', cursor: 'crosshair' }}
                />
                {!hasSignature && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    color: 'rgba(255, 255, 255, 0.35)',
                    fontSize: '0.8rem'
                  }}>
                    Dibuja tu firma con tu dedo o mouse
                  </div>
                )}
              </div>
            </div>

            {/* Sello de Visado Inteligente */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(52, 211, 153, 0.1)',
              border: '1px solid rgba(52, 211, 153, 0.25)',
              fontSize: '0.75rem',
              color: '#6EE7B7'
            }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Visado Institucional COHAB BJJ:</strong> Al firmar y activar tu membresía, este protocolo quedará automáticamente refrendado y visado con sello oficial del club.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                Volver
              </button>
              <button 
                type="button" 
                onClick={handleNextFromStep2}
                disabled={loading}
                style={{
                  flex: 2, padding: '12px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0077B6, #00B4D8)',
                  border: 'none', color: 'white', fontWeight: 800, fontSize: '0.88rem',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Registrando firma...' : 'Confirmar y Seleccionar Plan'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            PASO 3: Selección de Plan y Pago Mercado Pago
        ======================================================== */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: 0 }}>
              Selecciona tu plan de entrenamiento para activar la membresía del alumno en la temporada oficial:
            </p>

            {/* Listado de Servicios */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {services.map(svc => {
                const isSelected = svc.id === selectedServiceId;
                return (
                  <div 
                    key={svc.id}
                    onClick={() => setSelectedServiceId(svc.id)}
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      background: isSelected ? 'rgba(0, 180, 216, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '2px solid #00B4D8' : '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>{svc.name}</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Mensualidad regular · Pago primeros 5 días del mes
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#00B4D8' }}>
                        {formatPrice(svc.price)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>mensual</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen de Activación */}
            <div style={{
              background: 'rgba(0, 180, 216, 0.08)',
              border: '1px solid rgba(0, 180, 216, 0.25)',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '0.78rem',
              color: 'var(--text-light)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Alumno a matricular:</span>
                <strong>{currentStudent?.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Temporada:</span>
                <strong style={{ color: '#00B4D8' }}>2026 (Enero - Diciembre)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Protocolo v5:</span>
                <strong style={{ color: '#34D399' }}>Firmado y Visado Digitalmente</strong>
              </div>
            </div>

            <button 
              type="button" 
              onClick={handleProceedPayment}
              disabled={isProcessingPayment}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #009EE3, #007EB5)',
                border: 'none',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: isProcessingPayment ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(0, 158, 227, 0.35)'
              }}
            >
              {isProcessingPayment ? (
                <span>Conectando con Mercado Pago...</span>
              ) : (
                <>
                  <CreditCard size={18} />
                  <span>Activar y Pagar con Mercado Pago</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
