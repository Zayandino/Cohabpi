import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  User, Users, HeartPulse, PhoneCall, ShieldCheck, 
  CheckCircle2, AlertTriangle, AlertCircle, ArrowRight, 
  ArrowLeft, RefreshCw, Sparkles, Calendar, Award
} from 'lucide-react';

export default function RegistrationFlow() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Paso actual (1 a 5, y 6 pantalla de éxito)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. ¿Quién entrenará?
  // 'adult_only' | 'child_only' | 'both'
  const [trainingMode, setTrainingMode] = useState('adult_only');

  // 2. Datos del Titular / Apoderado
  const [titularName, setTitularName] = useState('');
  const [titularPhone, setTitularPhone] = useState('');
  const [titularRut, setTitularRut] = useState('');
  const [titularBirthdate, setTitularBirthdate] = useState('');

  // 3. Datos de Alumnos Menores (si aplica)
  const [children, setChildren] = useState([
    { id: 1, name: '', rut: '', birthdate: '', relationship: 'hijo' }
  ]);

  // 4. Ficha de Salud por Persona (Filtro Semáforo)
  // Estructura: { [personKey]: { cardiac: false, surgery: false, epilepsy: false, asthma: false, meds: false, details: '', healthSystem: 'Fonasa', schoolInsurance: false } }
  const [healthData, setHealthData] = useState({});

  // 5. Contacto de Emergencia
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('Familiar directo');

  // 6. Canvas de Firma Digital Táctil
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // 7. Resultado de Registro
  const [registeredSummary, setRegisteredSummary] = useState(null);

  // Precargar datos del perfil existente del titular
  useEffect(() => {
    if (profile) {
      if (profile.name) setTitularName(profile.name);
      if (profile.phone) setTitularPhone(profile.phone);
      if (profile.rut) setTitularRut(profile.rut);
      if (profile.birthdate) {
        const isBirthdateBugged = profile.created_at && profile.birthdate === profile.created_at.substring(0, 10);
        if (!isBirthdateBugged) setTitularBirthdate(profile.birthdate);
      }
    }
  }, [profile]);

  // Inicializar canvas de firma cuando llegamos al paso 5
  useEffect(() => {
    if (step === 5 && canvasRef.current) {
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

  // Helpers de Dibujo Canvas (Táctil y Ratón)
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
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

  // Cálculo de Grupo Etario según fecha de nacimiento
  const calculateAgeGroup = (birthdate) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

    if (age < 8) return { code: 'sub8', name: 'Grupo A: Sub-8 (Hasta 7 años)', schedule: 'Ma, Mi, Ju (45 min)', color: '#00B4D8' };
    if (age <= 13) return { code: 'infantil', name: 'Grupo B: Infantil (8–13 años)', schedule: 'Lu a Vi (60 min)', color: '#F59E0B' };
    if (age <= 17) return { code: 'adolescente', name: 'Grupo C: Jóvenes (14–17 años)', schedule: 'Lu a Sá en clase adultos (60 min)', color: '#EC4899' };
    return { code: 'adulto', name: 'Grupo D: Adultos (18+ años)', schedule: 'Lu a Sá (60 min)', color: '#10B981' };
  };

  // Manejo de Alumnos Dependientes
  const addChild = () => {
    setChildren(prev => [
      ...prev,
      { id: Date.now(), name: '', rut: '', birthdate: '', relationship: 'hijo' }
    ]);
  };

  const removeChild = (id) => {
    if (children.length === 1) return;
    setChildren(prev => prev.filter(c => c.id !== id));
  };

  const updateChild = (id, field, value) => {
    setChildren(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // Listado de personas que van a entrenar
  const getTrainees = () => {
    const list = [];
    if (trainingMode === 'adult_only' || trainingMode === 'both') {
      list.push({
        key: 'titular',
        name: titularName || 'Titular',
        birthdate: titularBirthdate,
        isMinor: false,
        group: calculateAgeGroup(titularBirthdate)
      });
    }
    if (trainingMode === 'child_only' || trainingMode === 'both') {
      children.forEach((c, idx) => {
        list.push({
          key: `child_${c.id || idx}`,
          name: c.name || `Hijo(a) ${idx + 1}`,
          birthdate: c.birthdate,
          isMinor: true,
          childData: c,
          group: calculateAgeGroup(c.birthdate)
        });
      });
    }
    return list;
  };

  // Manejo de Respuestas de Salud
  const updateHealth = (key, field, val) => {
    setHealthData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: val
      }
    }));
  };

  // Evaluación de Nivel de Riesgo (Semáforo)
  const evaluateRiskLevel = (key) => {
    const data = healthData[key] || {};
    // Rojo: riesgo cardíaco, cirugía reciente o epilepsia
    if (data.cardiac || data.surgery || data.epilepsy) return 'red';
    // Amarillo: asma, alergia o medicamentos
    if (data.asthma || data.meds) return 'yellow';
    return 'green';
  };

  // Validaciones por Paso
  const validateStep = () => {
    setError(null);
    if (step === 1) {
      return true;
    }
    if (step === 2) {
      if (!titularName.trim()) { setError('Por favor ingresa el nombre completo del titular.'); return false; }
      if (!titularPhone.trim()) { setError('Por favor ingresa un teléfono de contacto.'); return false; }
      if (!titularRut.trim()) { setError('Por favor ingresa tu RUT.'); return false; }
      if (!titularBirthdate) { setError('Por favor ingresa la fecha de nacimiento del titular.'); return false; }

      if (trainingMode === 'child_only' || trainingMode === 'both') {
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          if (!c.name.trim() || !c.rut.trim() || !c.birthdate) {
            setError(`Por favor completa los datos del alumno(a) #${i + 1}.`);
            return false;
          }
        }
      }
      return true;
    }
    if (step === 3) {
      // Salud completada para todos
      const trainees = getTrainees();
      for (const t of trainees) {
        const h = healthData[t.key] || {};
        if (h.cardiac === undefined || h.asthma === undefined) {
          setError(`Por favor responde las preguntas de salud para ${t.name}.`);
          return false;
        }
      }
      return true;
    }
    if (step === 4) {
      if (!emergencyName.trim()) { setError('Por favor indica el nombre del contacto de emergencia.'); return false; }
      if (!emergencyPhone.trim()) { setError('Por favor indica el teléfono de emergencia.'); return false; }
      return true;
    }
    if (step === 5) {
      if (!hasSignature) { setError('Por favor realiza tu firma digital en el recuadro.'); return false; }
      if (!acceptedTerms) { setError('Debes aceptar la declaración de salud y riesgos para continuar.'); return false; }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep(prev => Math.max(1, prev - 1));
  };

  // Guardado Final de Registro Etapa 1
  const handleSubmitRegistration = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setError(null);

    try {
      if (!user?.id) throw new Error('Sesión no encontrada. Por favor inicia sesión nuevamente.');

      // 1. Obtener imagen de firma en base64
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');

      // 2. Actualizar perfil del titular en cohab_profiles
      const { error: titularError } = await supabase
        .from('cohab_profiles')
        .update({
          name: titularName,
          phone: titularPhone,
          rut: titularRut,
          birthdate: titularBirthdate,
          waiver_signed: true,
          trial_classes_used: 0,
          max_trial_classes: 2,
          health_system: healthData['titular']?.healthSystem || 'Fonasa'
        })
        .eq('id', user.id);

      if (titularError) throw titularError;

      // 3. Crear perfiles dependientes de menores de 13/jóvenes (sin cuenta auth)
      const createdChildrenProfiles = [];
      if (trainingMode === 'child_only' || trainingMode === 'both') {
        for (const child of children) {
          const { data: newProfile, error: childError } = await supabase
            .from('cohab_profiles')
            .insert({
              name: child.name,
              rut: child.rut,
              birthdate: child.birthdate,
              parent_id: user.id,
              relationship: child.relationship || 'hijo',
              role: 'student',
              status: 'activo',
              waiver_signed: true,
              trial_classes_used: 0,
              max_trial_classes: 2,
              has_school_insurance: healthData[`child_${child.id}`]?.schoolInsurance || false
            })
            .select()
            .single();

          if (childError) throw childError;
          createdChildrenProfiles.push(newProfile);
        }
      }

      // 4. Buscar documento de consentimiento 'riesgos_prueba'
      const { data: docData } = await supabase
        .from('cohab_documents')
        .select('id')
        .eq('code', 'riesgos_prueba')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const documentId = docData?.id || null;

      // 5. Guardar fichas de salud, consentimientos y contactos
      const trainees = getTrainees();
      const summaryList = [];

      for (const t of trainees) {
        const isTitular = t.key === 'titular';
        let targetProfileId = user.id;

        if (!isTitular) {
          const match = createdChildrenProfiles.find(c => c.name === t.name);
          if (match) targetProfileId = match.id;
        }

        const hData = healthData[t.key] || {};
        const risk = evaluateRiskLevel(t.key);
        let alertSummaryText = null;
        if (hData.asthma) alertSummaryText = `Asma o alergia respiratoria. ${hData.details || ''}`.trim();
        if (hData.meds && !alertSummaryText) alertSummaryText = `Medicamentos diarios: ${hData.details || ''}`.trim();

        // Ficha de salud
        await supabase
          .from('cohab_health_records')
          .insert({
            profile_id: targetProfileId,
            risk_level: risk,
            answers: hData,
            alert_summary: alertSummaryText
          });

        // Contacto de emergencia
        await supabase
          .from('cohab_emergency_contacts')
          .insert({
            profile_id: targetProfileId,
            name: emergencyName,
            phone: emergencyPhone,
            relationship: emergencyRelation,
            is_primary: true
          });

        // Consentimiento y firma
        if (documentId) {
          await supabase
            .from('cohab_consents')
            .insert({
              profile_id: targetProfileId,
              signed_by: user.id,
              document_id: documentId,
              signature_url: signatureDataUrl,
              signer_name: titularName,
              signer_rut: titularRut,
              signer_relationship: isTitular ? 'titular' : 'apoderado',
              approval_status: risk === 'red' ? 'pending' : 'approved',
              approval_type: risk === 'red' ? 'manual' : 'automatic',
              approval_notes: risk === 'red' 
                ? 'Requiere validación de certificado médico por Administración.' 
                : 'Visado inteligente automático para clase de prueba.'
            });
        }

        summaryList.push({
          name: t.name,
          group: t.group,
          risk: risk,
          status: risk === 'red' ? 'En revisión médica' : 'Aprobado para prueba (2 clases)'
        });
      }

      await refreshProfile();
      setRegisteredSummary(summaryList);
      setStep(6); // Pantalla de éxito
    } catch (err) {
      console.error('Error al procesar registro:', err);
      setError(err.message || 'Ocurrió un error al guardar tu expediente. Intenta nuevamente.');
    } finally {
      setLoading(false);
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
      {/* Tarjeta Contenedora Principal */}
      <div style={{
        width: '100%',
        maxWidth: '560px',
        background: 'rgba(10, 17, 40, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '24px',
        padding: '30px 24px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
      }}>

        {/* Encabezado y Progreso */}
        {step < 6 && (
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(0, 180, 216, 0.12)', border: '1px solid rgba(0, 180, 216, 0.3)', borderRadius: '30px', marginBottom: '12px' }}>
              <Sparkles size={14} color="#00B4D8" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00B4D8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Etapa 1 · Pase de 2 Clases de Prueba
              </span>
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 800, margin: '4px 0', letterSpacing: '-0.3px' }}>
              {step === 1 && '¿Quién va a entrenar?'}
              {step === 2 && 'Datos de Inscripción'}
              {step === 3 && 'Ficha de Salud y Seguridad'}
              {step === 4 && 'Contacto de Emergencia'}
              {step === 5 && 'Firma y Aceptación de Riesgos'}
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Paso {step} de 5 · Completa tu expediente para pisar el tatami
            </p>

            {/* Barra de Progreso */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
              {[1, 2, 3, 4, 5].map(i => (
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
        )}

        {/* Error Alert */}
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
            PASO 1: Selector de Modo de Entrenamiento
        ======================================================== */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>
              Selecciona quién participará en las clases de Brazilian Jiu-Jitsu:
            </p>

            {/* Opción 1: Solo Adulto */}
            <div 
              onClick={() => setTrainingMode('adult_only')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                borderRadius: '16px',
                background: trainingMode === 'adult_only' ? 'rgba(0, 180, 216, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: trainingMode === 'adult_only' ? '2px solid #00B4D8' : '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(0, 180, 216, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={24} color="#00B4D8" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Yo mismo (Adulto o Joven)</h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Inscripción personal para entrenar en la sección adultos.
                </p>
              </div>
            </div>

            {/* Opción 2: Solo Hijo(s) */}
            <div 
              onClick={() => setTrainingMode('child_only')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                borderRadius: '16px',
                background: trainingMode === 'child_only' ? 'rgba(0, 180, 216, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: trainingMode === 'child_only' ? '2px solid #00B4D8' : '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={24} color="#F59E0B" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Mi hijo/a o pupilo</h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Soy el apoderado y administraré su expediente (menores de 13 sin cuenta de acceso).
                </p>
              </div>
            </div>

            {/* Opción 3: Ambos */}
            <div 
              onClick={() => setTrainingMode('both')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                borderRadius: '16px',
                background: trainingMode === 'both' ? 'rgba(0, 180, 216, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: trainingMode === 'both' ? '2px solid #00B4D8' : '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(123, 104, 238, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={24} color="#7B68EE" />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Ambos (Familia)</h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Entrenaremos yo y mis hijos bajo una misma cuenta familiar con descuento.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            PASO 2: Datos del Titular y Dependientes
        ======================================================== */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px 0', color: '#00B4D8' }}>
                {trainingMode === 'child_only' ? '1. Datos del Apoderado Titular' : '1. Tus Datos Personales'}
              </h3>
              
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej. Juan Pérez González" 
                  value={titularName} 
                  onChange={e => setTitularName(e.target.value)} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">RUT *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="12.345.678-9" 
                    value={titularRut} 
                    onChange={e => setTitularRut(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono WhatsApp *</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="+56 9 1234 5678" 
                    value={titularPhone} 
                    onChange={e => setTitularPhone(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Fecha de Nacimiento *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={titularBirthdate} 
                  onChange={e => setTitularBirthdate(e.target.value)} 
                />
              </div>
            </div>

            {/* Sección de Hijos / Dependientes si aplica */}
            {(trainingMode === 'child_only' || trainingMode === 'both') && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#F59E0B' }}>
                    2. Alumnos a Inscribir (Hijos/Pupilos)
                  </h3>
                  <button 
                    type="button" 
                    onClick={addChild}
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#F59E0B',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Agregar otro hijo/a
                  </button>
                </div>

                {children.map((child, idx) => {
                  const grp = calculateAgeGroup(child.birthdate);
                  return (
                    <div 
                      key={child.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '14px',
                        padding: '14px',
                        marginBottom: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#E2E8F0' }}>
                          Alumno #{idx + 1}
                        </span>
                        {children.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeChild(child.id)}
                            style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: '0.72rem', cursor: 'pointer' }}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Nombre del Menor *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Nombre y dos apellidos" 
                          value={child.name} 
                          onChange={e => updateChild(child.id, 'name', e.target.value)} 
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label className="form-label">RUT del Menor *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="23.456.789-0" 
                            value={child.rut} 
                            onChange={e => updateChild(child.id, 'rut', e.target.value)} 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Fecha de Nacimiento *</label>
                          <input 
                            type="date" 
                            className="form-input" 
                            value={child.birthdate} 
                            onChange={e => updateChild(child.id, 'birthdate', e.target.value)} 
                          />
                        </div>
                      </div>

                      {/* Asignación Automática de Grupo */}
                      {grp && (
                        <div style={{
                          marginTop: '6px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: `${grp.color}15`,
                          border: `1px solid ${grp.color}40`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <Award size={16} color={grp.color} />
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: grp.color }}>
                              {grp.name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              Horario oficial: {grp.schedule}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            PASO 3: Ficha de Salud Breve con Semáforo
        ======================================================== */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Cuestionario médico preventivo para proteger tu seguridad y la del dojo durante la práctica:
            </p>

            {getTrainees().map(trainee => {
              const h = healthData[trainee.key] || {};
              const risk = evaluateRiskLevel(trainee.key);

              return (
                <div 
                  key={trainee.key}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#E2E8F0' }}>
                      Salud: {trainee.name}
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: risk === 'red' ? 'rgba(239, 68, 68, 0.2)' : risk === 'yellow' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                      color: risk === 'red' ? '#EF4444' : risk === 'yellow' ? '#F59E0B' : '#34D399',
                      border: `1px solid ${risk === 'red' ? '#EF4444' : risk === 'yellow' ? '#F59E0B' : '#34D399'}`
                    }}>
                      {risk === 'red' && '🔴 Riesgo Clínico'}
                      {risk === 'yellow' && '🟡 Alerta Tatami'}
                      {risk === 'green' && '🟢 100% Apto'}
                    </span>
                  </div>

                  {/* Pregunta 1: Cardiopatías */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#E2E8F0', marginBottom: '6px' }}>
                      1. ¿Ha presentado problemas al corazón, presión alta, dolor al pecho o desmayos?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => updateHealth(trainee.key, 'cardiac', false)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                          background: h.cardiac === false ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: h.cardiac === false ? '1px solid #34D399' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: h.cardiac === false ? '#34D399' : 'var(--text-muted)', cursor: 'pointer'
                        }}
                      >
                        No
                      </button>
                      <button 
                        type="button" 
                        onClick={() => updateHealth(trainee.key, 'cardiac', true)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                          background: h.cardiac === true ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: h.cardiac === true ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: h.cardiac === true ? '#EF4444' : 'var(--text-muted)', cursor: 'pointer'
                        }}
                      >
                        Sí (Requiere certificado)
                      </button>
                    </div>
                  </div>

                  {/* Pregunta 2: Cirugías o Fracturas recientes */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#E2E8F0', marginBottom: '6px' }}>
                      2. ¿Ha tenido alguna cirugía, fractura o lesión articular en los últimos 6 meses?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => updateHealth(trainee.key, 'surgery', false)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                          background: h.surgery === false ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: h.surgery === false ? '1px solid #34D399' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: h.surgery === false ? '#34D399' : 'var(--text-muted)', cursor: 'pointer'
                        }}
                      >
                        No
                      </button>
                      <button 
                        type="button" 
                        onClick={() => updateHealth(trainee.key, 'surgery', true)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                          background: h.surgery === true ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: h.surgery === true ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: h.surgery === true ? '#EF4444' : 'var(--text-muted)', cursor: 'pointer'
                        }}
                      >
                        Sí
                      </button>
                    </div>
                  </div>

                  {/* Pregunta 3: Asma o alergias */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#E2E8F0', marginBottom: '6px' }}>
                      3. ¿Padece asma, dificultad para respirar o alergias relevantes?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => updateHealth(trainee.key, 'asthma', false)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                          background: h.asthma === false ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: h.asthma === false ? '1px solid #34D399' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: h.asthma === false ? '#34D399' : 'var(--text-muted)', cursor: 'pointer'
                        }}
                      >
                        No
                      </button>
                      <button 
                        type="button" 
                        onClick={() => updateHealth(trainee.key, 'asthma', true)}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                          background: h.asthma === true ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: h.asthma === true ? '1px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: h.asthma === true ? '#F59E0B' : 'var(--text-muted)', cursor: 'pointer'
                        }}
                      >
                        Sí (Alerta en tatami)
                      </button>
                    </div>
                  </div>

                  {/* Campo de detalle si marcó sí */}
                  {(h.asthma || h.surgery || h.cardiac) && (
                    <div className="form-group" style={{ marginTop: '10px' }}>
                      <label className="form-label" style={{ color: '#F59E0B' }}>
                        Indicaciones para el profesor en el tatami:
                      </label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: Asma controlada, lleva inhalador en su bolso" 
                        value={h.details || ''} 
                        onChange={e => updateHealth(trainee.key, 'details', e.target.value)} 
                      />
                    </div>
                  )}

                  {/* Previsión de salud */}
                  <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Previsión</label>
                      <select 
                        className="form-input"
                        value={h.healthSystem || 'Fonasa'}
                        onChange={e => updateHealth(trainee.key, 'healthSystem', e.target.value)}
                      >
                        <option value="Fonasa">Fonasa</option>
                        <option value="Isapre">Isapre</option>
                        <option value="Particular">Particular</option>
                        <option value="Ninguna">Ninguna</option>
                      </select>
                    </div>

                    {trainee.isMinor && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Seguro Escolar</label>
                        <select 
                          className="form-input"
                          value={h.schoolInsurance ? 'si' : 'no'}
                          onChange={e => updateHealth(trainee.key, 'schoolInsurance', e.target.value === 'si')}
                        >
                          <option value="si">Cuenta con seguro escolar</option>
                          <option value="no">Sin seguro escolar</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================
            PASO 4: Contacto de Emergencia
        ======================================================== */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Persona a quien contactar de inmediato en caso de cualquier incidente o eventualidad durante la clase:
            </p>

            <div className="form-group">
              <label className="form-label">Nombre del Contacto *</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej. María Valenzuela Soto" 
                value={emergencyName} 
                onChange={e => setEmergencyName(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono de Emergencia *</label>
              <input 
                type="tel" 
                className="form-input" 
                placeholder="+56 9 9876 5432" 
                value={emergencyPhone} 
                onChange={e => setEmergencyPhone(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Parentesco o Relación</label>
              <select 
                className="form-input"
                value={emergencyRelation}
                onChange={e => setEmergencyRelation(e.target.value)}
              >
                <option value="Madre">Madre</option>
                <option value="Padre">Padre</option>
                <option value="Cónyuge">Cónyuge / Pareja</option>
                <option value="Hermano/a">Hermano/a</option>
                <option value="Tutor/a Legal">Tutor/a Legal</option>
                <option value="Familiar">Otro Familiar</option>
              </select>
            </div>
          </div>
        )}

        {/* ========================================================
            PASO 5: Firma Digital Táctil y Aceptación de Riesgos
        ======================================================== */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'rgba(0, 180, 216, 0.08)',
              border: '1px solid rgba(0, 180, 216, 0.25)',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '0.78rem',
              color: 'var(--text-light)',
              lineHeight: 1.5
            }}>
              <div style={{ fontWeight: 800, color: '#00B4D8', marginBottom: '6px' }}>
                DECLARACIÓN Y ACEPTACIÓN DE RIESGOS (2 CLASES DE PRUEBA)
              </div>
              <p style={{ margin: '0 0 8px 0' }}>
                Declaro que los datos ingresados son fidedignos y que los participantes no presentan impedimentos médicos para realizar ejercicio físico de contacto en tatami.
              </p>
              <p style={{ margin: 0 }}>
                Acepto que el Brazilian Jiu-Jitsu involucra caídas y combate simulado, comprometiéndome a seguir siempre las instrucciones de seguridad del cuerpo técnico y respetar inmediatamente la rendición táctica (TAP).
              </p>
            </div>

            {/* Recuadro de Firma Digital */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Firma Digital {trainingMode === 'adult_only' ? 'del Alumno' : 'del Apoderado Titular'} *
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
                    Firma aquí con tu dedo o mouse
                  </div>
                )}
              </div>
            </div>

            {/* Checkbox de aceptación */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.78rem', color: 'var(--text-light)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: '2px' }}
              />
              <span>
                He leído y acepto los términos de la clase de prueba y autorizo el resguardo seguro de mis datos de salud en el club COHAB Los Andes.
              </span>
            </label>
          </div>
        )}

        {/* ========================================================
            PASO 6: Pantalla de Éxito y Pase de Prueba
        ======================================================== */}
        {step === 6 && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(52, 211, 153, 0.15)',
              border: '2px solid #34D399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={36} color="#34D399" />
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px' }}>
              ¡Expediente de Prueba Activado!
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Tu registro ha sido completado y visado por la Dirección Técnica de COHAB Los Andes.
            </p>

            {/* Credenciales de Prueba por Alumno */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {registeredSummary && registeredSummary.map((item, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '14px',
                    padding: '14px',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>{item.name}</span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '10px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: item.risk === 'red' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                      color: item.risk === 'red' ? '#EF4444' : '#34D399'
                    }}>
                      {item.status}
                    </span>
                  </div>
                  {item.group && (
                    <div style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Grupo: <strong style={{ color: item.group.color }}>{item.group.name}</strong> · {item.group.schedule}
                    </div>
                  )}
                  <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#00B4D8' }}>
                    Saldo disponible: <strong>2 Clases de Prueba en Tatami</strong>
                  </div>
                </div>
              ))}
            </div>

            <button 
              type="button" 
              className="auth-btn"
              onClick={() => navigate('/dashboard')}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #0077B6, #00B4D8)',
                color: 'white',
                fontWeight: 800,
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>Ir a mi Dashboard</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Botones de Navegación (Pasos 1 a 5) */}
        {step < 6 && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            {step > 1 && (
              <button 
                type="button" 
                onClick={handleBack}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={16} />
                <span>Atrás</span>
              </button>
            )}

            <button 
              type="button" 
              onClick={step === 5 ? handleSubmitRegistration : handleNext}
              disabled={loading}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0077B6, #00B4D8)',
                border: 'none',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 8px 20px rgba(0, 180, 216, 0.3)'
              }}
            >
              {loading ? (
                <span>Guardando expediente...</span>
              ) : step === 5 ? (
                <>
                  <span>Finalizar y Obtener Pase</span>
                  <CheckCircle2 size={18} />
                </>
              ) : (
                <>
                  <span>Siguiente</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
