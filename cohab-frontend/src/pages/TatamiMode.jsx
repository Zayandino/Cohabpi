import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import QRCode from 'qrcode';
import { 
  Shield, PhoneCall, AlertTriangle, CheckCircle, Clock, 
  Users, Award, Activity, Heart, ArrowLeft, PlusCircle, 
  Calendar, Check, UserCheck, Flame, QrCode, RefreshCw, X
} from 'lucide-react';

export default function TatamiMode() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('todos'); // 'todos' | 'sub8' | 'infantil' | 'adolescente' | 'adulto'
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // { [studentId]: boolean }

  // Servicios y Código QR
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrAttendanceCount, setQrAttendanceCount] = useState(0);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  // Modal de Incidentes
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentStudent, setIncidentStudent] = useState(null);
  const [bodyPart, setBodyPart] = useState('Muñeca / Mano');
  const [severity, setSeverity] = useState('leve');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [parentNotified, setParentNotified] = useState(false);
  const [savingIncident, setSavingIncident] = useState(false);
  const [incidentSuccess, setIncidentSuccess] = useState(false);

  // Quita perfiles sin nombre y los que no pertenecen al grupo seleccionado
  const cleanRoster = (rows) => (rows || []).filter(r => {
    const hasName = r.name && r.name.trim() && r.name !== 'Sin nombre';
    if (!hasName) return false;
    if (selectedGroup === 'todos') return true;
    return r.age_group === selectedGroup;
  });

  // Cargar roster de alumnos y asistencias de hoy
  const fetchRoster = async () => {
    setLoading(true);
    try {
      // 1. Intentar llamar a la RPC segura cohab_get_tatami_roster si existe
      let rosterData = null;
      try {
        const { data, error } = await supabase.rpc('cohab_get_tatami_roster', {
          p_group: selectedGroup === 'todos' ? null : selectedGroup
        });
        if (!error && data) {
          rosterData = data;
        }
      } catch (rpcErr) {
        // Fallback a consulta directa si la función aún no fue creada en la BD
      }

      // Fallback: Consulta directa a cohab_profiles y datos asociados
      if (!rosterData) {
        const { data: profiles, error: pErr } = await supabase
          .from('cohab_profiles')
          .select('id, name, belt, graus, birthdate, status, trial_classes_used, max_trial_classes')
          .order('name', { ascending: true });

        if (pErr) throw pErr;

        // Fichas de salud recientes
        const { data: healthRecords } = await supabase
          .from('cohab_health_records')
          .select('profile_id, risk_level, alert_summary, certificate_verified')
          .order('created_at', { ascending: false });

        // Contactos de emergencia primarios
        const { data: contacts } = await supabase
          .from('cohab_emergency_contacts')
          .select('profile_id, name, phone, relationship')
          .eq('is_primary', true);

        // Incidentes activos recientes (últimos 7 días)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentIncidents } = await supabase
          .from('cohab_incidents')
          .select('profile_id, body_part, severity')
          .gte('occurred_at', sevenDaysAgo);

        // Suscripciones activas
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: subs } = await supabase
          .from('cohab_subscriptions')
          .select('profile_id, status, end_date')
          .eq('status', 'active');

        rosterData = (profiles || []).map(p => {
          // Grupo de edad
          // Sin fecha de nacimiento no se puede clasificar: solo aparece en 'Todos'
          let ageGroup = 'sin_edad';
          if (p.birthdate) {
            const birth = new Date(p.birthdate);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            if (age < 8) ageGroup = 'sub8';
            else if (age <= 13) ageGroup = 'infantil';
            else if (age <= 17) ageGroup = 'adolescente';
            else ageGroup = 'adulto';
          }

          const h = (healthRecords || []).find(rec => rec.profile_id === p.id);
          const c = (contacts || []).find(con => con.profile_id === p.id);
          const inc = (recentIncidents || []).find(i => i.profile_id === p.id);
          const sub = (subs || []).find(s => s.profile_id === p.id && (!s.end_date || s.end_date >= todayStr));

          // Estado del alumno
          let studentStatus = 'prueba';
          if (inc) {
            studentStatus = 'restringido';
          } else if (h?.risk_level === 'red' && !h?.certificate_verified) {
            studentStatus = 'revision';
          } else if (sub) {
            studentStatus = 'vigente';
          } else if ((p.trial_classes_used || 0) < (p.max_trial_classes || 2)) {
            studentStatus = 'prueba';
          } else {
            studentStatus = 'vencido';
          }

          return {
            profile_id: p.id,
            name: p.name || 'Sin nombre',
            belt: p.belt || 'Cinturón Blanco',
            graus: p.graus || 0,
            age_group: ageGroup,
            student_status: studentStatus,
            risk_level: h?.risk_level || 'green',
            alert_summary: h?.alert_summary || null,
            has_active_incident: !!inc,
            incident_body_part: inc?.body_part || null,
            primary_emergency_name: c?.name || null,
            primary_emergency_phone: c?.phone || null
          };
        });

      }

      setStudents(cleanRoster(rosterData));

      // 2. Cargar asistencias de hoy en cohab_attendance
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { data: todayAttendance } = await supabase
        .from('cohab_attendance')
        .select('profile_id')
        .gte('checked_at', startOfToday.toISOString());

      const attendedObj = {};
      if (todayAttendance) {
        todayAttendance.forEach(att => {
          attendedObj[att.profile_id] = true;
        });
      }
      setAttendanceMap(attendedObj);

    } catch (err) {
      console.error('Error al cargar roster del tatami:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('cohab_services')
        .select('id, name, schedule, instructor_id, instructor_name')
        .eq('is_active', true)
        .order('name');
        
      if (error) throw error;
      // El admin ve todos los horarios; el instructor solo los que tiene asignados
      const visible = isAdmin
        ? (data || [])
        : (data || []).filter(s => s.instructor_id === profile?.id);
      setServices(visible);
      setSelectedServiceId(visible[0]?.id || '');
    } catch (e) {
      console.error('Error fetching services for tatami:', e);
    }
  };

  const fetchTodayQrCount = async (serviceId) => {
    const sId = serviceId || selectedServiceId;
    if (!sId) return;
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from('cohab_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('service_id', sId)
        .gte('checked_at', startOfToday.toISOString());
        
      if (!error) {
        setQrAttendanceCount(count || 0);
      }
    } catch (e) {
      console.error('Error fetching QR count:', e);
    }
  };

  const handleGenerateQr = async (serviceId) => {
    const targetId = serviceId || selectedServiceId;
    const target = services.find(s => s.id === targetId);
    if (!target) {
      alert('Por favor selecciona una clase/horario para generar el código QR.');
      return;
    }

    setIsGeneratingQr(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const payload = JSON.stringify({
        app: 'cohab_bjj',
        service_id: target.id,
        date: todayStr,
        instructor_id: profile?.id || target.instructor_id || null
      });

      const url = await QRCode.toDataURL(payload, {
        width: 360,
        margin: 2,
        color: {
          dark: '#050B14',
          light: '#FFFFFF'
        }
      });

      setQrDataUrl(url);
      setShowQrModal(true);
      fetchTodayQrCount(target.id);
    } catch (err) {
      console.error('Error generating QR:', err);
      alert('No se pudo generar el código QR.');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [selectedGroup]);

  useEffect(() => {
    fetchServices();
  }, [profile?.id]);

  // Toggle de Asistencia
  const toggleAttendance = async (studentId) => {
    const isAttended = !!attendanceMap[studentId];
    try {
      if (isAttended) {
        // Desmarcar asistencia de hoy
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        await supabase
          .from('cohab_attendance')
          .delete()
          .eq('profile_id', studentId)
          .gte('checked_at', startOfToday.toISOString());

        setAttendanceMap(prev => ({ ...prev, [studentId]: false }));
      } else {
        // Registrar asistencia de hoy
        await supabase
          .from('cohab_attendance')
          .insert({
            profile_id: studentId,
            checked_at: new Date().toISOString()
          });

        setAttendanceMap(prev => ({ ...prev, [studentId]: true }));
      }
    } catch (err) {
      console.error('Error al registrar asistencia:', err);
      alert('No se pudo registrar la asistencia.');
    }
  };

  // Abrir modal de incidente
  const openIncidentModal = (student) => {
    setIncidentStudent(student);
    setBodyPart('Muñeca / Mano');
    setSeverity('leve');
    setIncidentDesc('');
    setParentNotified(false);
    setIncidentSuccess(false);
    setIncidentModalOpen(true);
  };

  // Guardar Incidente en Tatami
  const handleSaveIncident = async (e) => {
    e.preventDefault();
    if (!incidentDesc.trim()) {
      alert('Por favor escribe una breve descripción de lo ocurrido.');
      return;
    }
    setSavingIncident(true);

    try {
      const { error: incErr } = await supabase
        .from('cohab_incidents')
        .insert({
          profile_id: incidentStudent.profile_id,
          reported_by: profile?.id || null,
          body_part: bodyPart,
          severity: severity,
          description: incidentDesc.trim(),
          parent_notified: parentNotified,
          parent_notified_at: parentNotified ? new Date().toISOString() : null
        });

      if (incErr) throw incErr;

      setIncidentSuccess(true);
      setTimeout(() => {
        setIncidentModalOpen(false);
        fetchRoster();
      }, 1500);
    } catch (err) {
      console.error('Error al guardar incidente:', err);
      alert('Error al registrar el incidente.');
    } finally {
      setSavingIncident(false);
    }
  };

  // Contadores del semáforo en el grupo actual
  const greenCount = students.filter(s => s.risk_level === 'green').length;
  const yellowCount = students.filter(s => s.risk_level === 'yellow').length;
  const redCount = students.filter(s => s.risk_level === 'red').length;
  const attendedCount = Object.values(attendanceMap).filter(Boolean).length;

  return (
    <div style={{
      minHeight: '100vh',
      padding: '24px 16px 100px',
      fontFamily: 'var(--font-body)',
      color: 'white',
      maxWidth: '680px',
      margin: '0 auto'
    }}>

      {/* Cabecera del Modo Tatami */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '8px 12px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} />
          <span>Volver</span>
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 180, 216, 0.15)',
          border: '1px solid rgba(0, 180, 216, 0.35)',
          borderRadius: '20px',
          padding: '6px 14px'
        }}>
          <Flame size={16} color="#00B4D8" />
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#00B4D8', letterSpacing: '0.5px' }}>
            MODO TATAMI · PROFESOR
          </span>
        </div>
      </div>

      {/* Tarjeta de Resumen de Sesión */}
      <div style={{
        background: 'rgba(10, 17, 40, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        padding: '18px 20px',
        marginBottom: '18px',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
              Control de Clase y Seguridad
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Hoy: {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div style={{
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            borderRadius: '12px',
            padding: '6px 12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#34D399' }}>
              {attendedCount} / {students.length}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Presentes
            </div>
          </div>
        </div>

        {/* Semáforo Global */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, padding: '8px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#34D399' }}>🟢 {greenCount}</span>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Aptos</div>
          </div>
          <div style={{ flex: 1, padding: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#F59E0B' }}>🟡 {yellowCount}</span>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Con Alerta</div>
          </div>
          <div style={{ flex: 1, padding: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#EF4444' }}>🔴 {redCount}</span>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>En Revisión</div>
          </div>
        </div>
      </div>

      {/* Panel de Pase de Asistencia QR para el Tatami */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 180, 216, 0.12), rgba(52, 211, 153, 0.08))',
        border: '1px solid rgba(52, 211, 153, 0.3)',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={20} color="var(--aurora)" />
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'white' }}>
              Código QR de Asistencia Tatami
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', background: 'rgba(52, 211, 153, 0.15)', color: 'var(--aurora)', padding: '2px 8px', borderRadius: '10px', fontWeight: 800, border: '1px solid rgba(52, 211, 153, 0.3)' }}>
            AUTO-VALIDACIÓN
          </span>
        </div>

        {/* Selector de Disciplina / Clase a cargo */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedServiceId}
            onChange={e => {
              setSelectedServiceId(e.target.value);
              fetchTodayQrCount(e.target.value);
            }}
            style={{
              flex: '1 1 100%',
              minWidth: 0,
              width: '100%',
              height: '42px',
              background: 'rgba(5, 11, 20, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '0.82rem',
              padding: '0 12px',
              fontWeight: 600
            }}
          >
            {services.length === 0 && (
              <option value="">No tienes horarios asignados</option>
            )}
            {services.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.instructor_name ? `• ${s.instructor_name}` : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => handleGenerateQr()}
            disabled={isGeneratingQr || !selectedServiceId}
            style={{
              flex: '1 1 100%',
              justifyContent: 'center',
              height: '42px',
              padding: '0 18px',
              background: 'linear-gradient(135deg, var(--aurora), #10B981)',
              border: 'none',
              borderRadius: '8px',
              color: '#060B18',
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 15px rgba(52, 211, 153, 0.3)',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            <QrCode size={16} />
            <span>{isGeneratingQr ? 'Generando...' : '📲 Proyectar QR'}</span>
          </button>
        </div>

        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Proyecta este código en pantalla completa o muéstralo a los alumnos para que lo lean desde su aplicación y registren su asistencia automáticamente.
        </div>
      </div>

      {/* Selector de Grupos Horarios */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginBottom: '16px'
      }}>
        {[
          { id: 'todos', label: 'Todos', color: '#00B4D8' },
          { id: 'sub8', label: '🟦 Sub-8', color: '#00B4D8' },
          { id: 'infantil', label: '🟨 Infantil', color: '#F59E0B' },
          { id: 'adolescente', label: '🌸 Jóvenes', color: '#EC4899' },
          { id: 'adulto', label: '🟩 Adultos', color: '#10B981' }
        ].map(grp => (
          <button
            key={grp.id}
            type="button"
            onClick={() => setSelectedGroup(grp.id)}
            style={{
              padding: '8px 14px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: selectedGroup === grp.id ? 'rgba(0, 180, 216, 0.25)' : 'rgba(255, 255, 255, 0.04)',
              border: selectedGroup === grp.id ? `1px solid ${grp.color}` : '1px solid rgba(255, 255, 255, 0.08)',
              color: selectedGroup === grp.id ? 'white' : 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {grp.label}
          </button>
        ))}
      </div>

      {/* Lista de Alumnos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Cargando alumnos de tatami...
        </div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No hay alumnos registrados en este grupo para la temporada actual.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {students.map(st => {
            const isAttended = !!attendanceMap[st.profile_id];

            return (
              <div
                key={st.profile_id}
                style={{
                  background: isAttended ? 'rgba(0, 180, 216, 0.08)' : 'rgba(10, 17, 40, 0.65)',
                  border: isAttended ? '1px solid rgba(0, 180, 216, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  transition: 'all 0.2s',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)'
                }}
              >
                {/* Fila Superior: Nombre y Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'white' }}>
                      {st.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {st.belt} {st.graus > 0 ? `· ${st.graus} Graus` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {/* Badge de Estado del Alumno */}
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '8px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: st.student_status === 'vigente' ? 'rgba(52, 211, 153, 0.15)' :
                                  st.student_status === 'prueba' ? 'rgba(0, 180, 216, 0.15)' :
                                  st.student_status === 'restringido' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                      color: st.student_status === 'vigente' ? '#34D399' :
                             st.student_status === 'prueba' ? '#00B4D8' :
                             st.student_status === 'restringido' ? '#EF4444' : '#F59E0B',
                      border: `1px solid ${
                        st.student_status === 'vigente' ? '#34D39940' :
                        st.student_status === 'prueba' ? '#00B4D840' :
                        st.student_status === 'restringido' ? '#EF444460' : '#F59E0B40'
                      }`
                    }}>
                      {st.student_status === 'vigente' && 'VIGENTE'}
                      {st.student_status === 'prueba' && 'CLASE PRUEBA'}
                      {st.student_status === 'restringido' && '⚠️ LESIONADO'}
                      {st.student_status === 'revision' && 'EN REVISIÓN'}
                      {st.student_status === 'vencido' && 'PAGO PENDIENTE'}
                    </span>

                    {/* Semáforo de Salud */}
                    <span style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: st.risk_level === 'green' ? '#34D399' : st.risk_level === 'yellow' ? '#F59E0B' : '#EF4444',
                      boxShadow: `0 0 8px ${st.risk_level === 'green' ? '#34D399' : st.risk_level === 'yellow' ? '#F59E0B' : '#EF4444'}`
                    }} title={`Riesgo: ${st.risk_level}`} />
                  </div>
                </div>

                {/* Alerta de Salud Visible para el Profesor */}
                {st.alert_summary && (
                  <div style={{
                    margin: '8px 0',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: st.risk_level === 'red' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.12)',
                    border: `1px solid ${st.risk_level === 'red' ? '#EF444440' : '#F59E0B35'}`,
                    fontSize: '0.75rem',
                    color: st.risk_level === 'red' ? '#FCA5A5' : '#FDE68A',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    <span><strong>Alerta tatami:</strong> {st.alert_summary}</span>
                  </div>
                )}

                {/* Fila de Acciones de Tatami */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  {/* Botón Asistencia */}
                  <button
                    type="button"
                    onClick={() => toggleAttendance(st.profile_id)}
                    style={{
                      flex: 1.4,
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: isAttended ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: isAttended ? '1px solid #34D399' : '1px solid rgba(255, 255, 255, 0.12)',
                      color: isAttended ? '#34D399' : 'white',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={16} />
                    <span>{isAttended ? 'Presente' : 'Marcar Presente'}</span>
                  </button>

                  {/* Botón Llamar a Emergencia */}
                  {st.primary_emergency_phone ? (
                    <a
                      href={`tel:${st.primary_emergency_phone}`}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'rgba(0, 180, 216, 0.15)',
                        border: '1px solid rgba(0, 180, 216, 0.35)',
                        color: '#00B4D8',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title={`Llamar a ${st.primary_emergency_name || 'Emergencia'}: ${st.primary_emergency_phone}`}
                    >
                      <PhoneCall size={15} />
                      <span>Llamar</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      style={{
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                        fontSize: '0.72rem',
                        cursor: 'not-allowed'
                      }}
                    >
                      Sin tel.
                    </button>
                  )}

                  {/* Botón Reportar Lesión */}
                  <button
                    type="button"
                    onClick={() => openIncidentModal(st)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#EF4444',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                    title="Reportar lesión o golpe en tatami"
                  >
                    <Activity size={15} />
                    <span>Lesión</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          MODAL DE REPORTE DE INCIDENTE EN TATAMI
      ======================================================== */}
      {incidentModalOpen && incidentStudent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 11, 24, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 200
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            background: 'rgba(17, 29, 58, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)'
          }}>
            {incidentSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle size={48} color="#34D399" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem' }}>Incidente Registrado</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  El alumno pasa a estado restringido preventivo y se registró la alerta.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveIncident} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#EF4444' }}>
                      Reportar Lesión / Incidente
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'white', marginTop: '2px' }}>
                      Alumno: <strong>{incidentStudent.name}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncidentModalOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Zona del Cuerpo */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Zona Afectada *</label>
                  <select
                    className="form-input"
                    value={bodyPart}
                    onChange={e => setBodyPart(e.target.value)}
                  >
                    <option value="Muñeca / Mano">Muñeca / Mano</option>
                    <option value="Codo">Codo</option>
                    <option value="Hombro">Hombro</option>
                    <option value="Cuello / Cervical">Cuello / Cervical</option>
                    <option value="Rodilla">Rodilla</option>
                    <option value="Tobillo / Pie">Tobillo / Pie</option>
                    <option value="Costillas / Torso">Costillas / Torso</option>
                    <option value="Cabeza / Rostro">Cabeza / Rostro</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                {/* Severidad */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Severidad *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { id: 'leve', label: '🟢 Leve (Molestia)', color: '#34D399' },
                      { id: 'moderada', label: '🟡 Moderada (Detiene)', color: '#F59E0B' },
                      { id: 'grave', label: '🔴 Grave (Clínica)', color: '#EF4444' }
                    ].map(sev => (
                      <button
                        key={sev.id}
                        type="button"
                        onClick={() => setSeverity(sev.id)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: '8px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: severity === sev.id ? `${sev.color}25` : 'rgba(255, 255, 255, 0.04)',
                          border: severity === sev.id ? `1px solid ${sev.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                          color: severity === sev.id ? 'white' : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        {sev.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descripción */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">¿Qué ocurrió? (Breve descripción) *</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Ej: Durante sparring recibió hiperextensión en el codo derecho. Se aplicó hielo en dojo."
                    value={incidentDesc}
                    onChange={e => setIncidentDesc(e.target.value)}
                    required
                    style={{ resize: 'none' }}
                  />
                </div>

                {/* Checkbox Notificación al Apoderado */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: '#E2E8F0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={parentNotified}
                    onChange={e => setParentNotified(e.target.checked)}
                  />
                  <span>Se contactó o avisó al apoderado / contacto de emergencia</span>
                </label>

                {/* Botones */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setIncidentModalOpen(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingIncident}
                    style={{
                      flex: 2,
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #DC2626, #EF4444)',
                      border: 'none',
                      color: 'white',
                      fontWeight: 800,
                      cursor: savingIncident ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    {savingIncident ? 'Guardando...' : 'Registrar Incidente'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL FULLSCREEN / PANTALLA TATAMI QR */}
      {showQrModal && (() => {
        const currentService = services.find(s => s.id === selectedServiceId);
        const instructorDisplay = currentService?.instructor_name || (profile?.staff_title ? `${profile.staff_title} ${profile.name}` : profile?.name);

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.96)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 9999,
            animation: 'fadeIn 0.25s ease-out'
          }}>
            <div style={{
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(6, 11, 24, 0.98) 100%)',
              border: '2px solid rgba(52, 211, 153, 0.4)',
              borderRadius: '24px',
              padding: '28px 24px',
              width: '100%',
              maxWidth: '440px',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(52, 211, 153, 0.2)',
              position: 'relative'
            }}>
              {/* Botón Cerrar */}
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                title="Cerrar"
              >
                <X size={18} />
              </button>

              {/* Encabezado Marcial */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '1.4rem' }}>🥋</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--aurora)', fontSize: '0.85rem', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  COHAB LOS ANDES · BJJ
                </span>
              </div>

              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 900, color: 'white', margin: '4px 0 6px 0' }}>
                {currentService?.name || 'Clase de Brazilian Jiu-Jitsu'}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', color: '#94A3B8', marginBottom: '18px' }}>
                <span style={{ color: 'var(--aurora)', fontWeight: 800 }}>A cargo:</span>
                <span style={{ color: 'white', fontWeight: 700 }}>{instructorDisplay}</span>
              </div>

              {/* Imagen del Código QR */}
              <div style={{
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: '20px',
                display: 'inline-block',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(52, 211, 153, 0.3)',
                marginBottom: '18px',
                maxWidth: '100%'
              }}>
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt="Código QR Asistencia Tatami" 
                    style={{ 
                      width: '260px', 
                      height: '260px', 
                      display: 'block',
                      borderRadius: '10px'
                    }} 
                  />
                ) : (
                  <div style={{ width: '260px', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#060B18', fontWeight: 700 }}>
                    Generando código...
                  </div>
                )}
              </div>

              {/* Instrucción para el Alumno */}
              <div style={{
                background: 'rgba(52, 211, 153, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '16px'
              }}>
                <div style={{ color: 'var(--aurora)', fontWeight: 800, fontSize: '0.82rem', marginBottom: '2px' }}>
                  📲 Escaneo Automático para Alumnos
                </div>
                <div style={{ color: '#E2E8F0', fontSize: '0.74rem', lineHeight: '1.3' }}>
                  Abre la App COHAB y pulsa <strong>"Escanear QR de Asistencia"</strong> para marcar tu presencia sin validación manual.
                </div>
              </div>

              {/* Contador en Vivo de Asistencias */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Validados hoy
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--aurora)' }}>
                    ⚡ {qrAttendanceCount} alumnos
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fetchTodayQrCount(currentService?.id)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Actualizar conteo en vivo"
                >
                  <RefreshCw size={14} />
                  <span>Refrescar</span>
                </button>
              </div>

              {/* Botón de Salir */}
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Cerrar Pantalla QR
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
