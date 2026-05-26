import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [familyProfiles, setFamilyProfiles] = useState([]);
  // Selector de miembro: 'main' = titular, o el id de un familiar
  const [selectedMemberId, setSelectedMemberId] = useState('main');

  // Retorna el perfil del miembro actualmente seleccionado
  const getSelectedProfile = useCallback(() => {
    if (selectedMemberId === 'main') return profile;
    return familyProfiles.find(f => f.id === selectedMemberId) || profile;
  }, [selectedMemberId, profile, familyProfiles]);

  const fetchAttendance = useCallback(async (targetProfileId) => {
    const profileId = targetProfileId || profile?.id;
    if (!profileId) return;
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('cohab_attendance')
        .select('*')
        .eq('profile_id', profileId)
        .gte('checked_at', startOfMonth.toISOString());

      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (err) {
      console.error("Error fetching attendance:", err);
    }
  }, [profile?.id]);

  const checkMembershipAndFamily = async () => {
    if (!profile?.id) return;
    try {
      // 1. Consultar si el perfil logueado tiene suscripción activa propia
      const { data: subsData, error: subsError } = await supabase
        .from('cohab_subscriptions')
        .select('id, end_date, status')
        .eq('profile_id', profile.id)
        .eq('status', 'active');
        
      if (subsError) throw subsError;
      
      const nowStr = new Date().toISOString().split('T')[0];
      const isSelfActive = subsData && subsData.some(s => !s.end_date || s.end_date >= nowStr);
      setHasActiveMembership(isSelfActive);

      // 2. Si el perfil logueado es titular (no tiene parent_id), cargar familiares
      if (!profile.parent_id) {
        const { data: famData, error: famError } = await supabase
          .from('cohab_profiles')
          .select('id, name, relationship, email, belt, graus, status')
          .eq('parent_id', profile.id);

        if (famError) throw famError;

        // Cargar también las suscripciones vigentes de los familiares
        const famProfilesWithSubs = [];
        if (famData) {
          for (const fam of famData) {
            const { data: fSubs, error: fSubsError } = await supabase
              .from('cohab_subscriptions')
              .select('end_date, status, service_id')
              .eq('profile_id', fam.id)
              .eq('status', 'active')
              .order('end_date', { ascending: false })
              .limit(1);

            if (fSubsError) throw fSubsError;
            
            const activeSub = fSubs?.[0];
            const isFamActive = activeSub && (!activeSub.end_date || activeSub.end_date >= nowStr);
            
            famProfilesWithSubs.push({
              ...fam,
              activeSub: isFamActive ? activeSub : null,
              endDate: activeSub?.end_date || null
            });
          }
        }
        setFamilyProfiles(famProfilesWithSubs);
      }
    } catch (err) {
      console.error("Error checking membership and family:", err);
    }
  };

  useEffect(() => {
    if (profile?.id) {
      fetchAttendance(profile.id);
      checkMembershipAndFamily();
    }
  }, [profile]);

  // Cuando cambia el miembro seleccionado, cargar su asistencia
  useEffect(() => {
    const targetId = selectedMemberId === 'main' ? profile?.id : selectedMemberId;
    if (targetId) {
      fetchAttendance(targetId);
    }
  }, [selectedMemberId]);

  const handleMarkAttendance = async (classType) => {
    const targetId = selectedMemberId === 'main' ? profile?.id : selectedMemberId;
    if (!targetId) return;
    try {
      const { error } = await supabase
        .from('cohab_attendance')
        .insert([{ profile_id: targetId, class_type: classType }]);
      if (error) throw error;
      fetchAttendance(targetId);
    } catch (err) {
      console.error("Error marking attendance:", err);
    }
  };

  const handleUnmarkAttendance = async (classType) => {
    const targetId = selectedMemberId === 'main' ? profile?.id : selectedMemberId;
    if (!targetId) return;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { error } = await supabase
        .from('cohab_attendance')
        .delete()
        .eq('profile_id', targetId)
        .eq('class_type', classType)
        .gte('checked_at', todayStart.toISOString())
        .lte('checked_at', todayEnd.toISOString());

      if (error) throw error;
      fetchAttendance(targetId);
    } catch (err) {
      console.error("Error unmarking attendance:", err);
    }
  };


  return (
    <section id="screen-dashboard" className="screen active" style={{ display: 'block' }}>
      
      {/* Hero Header IDÉNTICO AL ORIGINAL */}
      <header className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            <span>COHAB</span>
            LOS ANDES
          </h1>
          <img src="/assets/logo-original.jpg" alt="Cohab Logo" className="hero-logo" />
        </div>
      </header>

      <div className="content">
        {/* Greeting IDÉNTICO AL ORIGINAL */}
        <div className="greeting-block">
          <div className="greeting-hello">Bienvenido de vuelta</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            <div className="greeting-name" style={{ marginBottom: 0 }}>
              <span id="user-display-name">{profile?.name || 'Cargando...'}</span>
            </div>
            {profile?.role === 'admin' && (
              <span id="admin-badge" className="admin-badge" style={{ display: 'inline-block' }}>ADMIN</span>
            )}
          </div>
        </div>

        {/* ─── SELECTOR DE MIEMBRO DEL GRUPO FAMILIAR ─── */}
        {!profile?.parent_id && familyProfiles.length > 0 && (
          <div style={{ marginBottom: '18px', marginTop: '4px' }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'none'
            }}>
              {/* Tab: Titular */}
              <button
                onClick={() => setSelectedMemberId('main')}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: selectedMemberId === 'main' ? 'var(--aurora)' : 'rgba(255,255,255,0.1)',
                  background: selectedMemberId === 'main' ? 'rgba(0, 180, 216, 0.12)' : 'rgba(255,255,255,0.03)',
                  color: selectedMemberId === 'main' ? 'white' : 'var(--text-muted)',
                  fontWeight: selectedMemberId === 'main' ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                  boxShadow: selectedMemberId === 'main' ? '0 0 10px rgba(0, 180, 216, 0.2)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>🥋</span>
                {profile?.name?.split(' ')[0] || 'Yo'} (Titular)
              </button>

              {/* Tabs: Familiares */}
              {familyProfiles.map(fam => (
                <button
                  key={fam.id}
                  onClick={() => setSelectedMemberId(fam.id)}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: selectedMemberId === fam.id ? 'var(--aurora)' : 'rgba(255,255,255,0.1)',
                    background: selectedMemberId === fam.id ? 'rgba(0, 180, 216, 0.12)' : 'rgba(255,255,255,0.03)',
                    color: selectedMemberId === fam.id ? 'white' : 'var(--text-muted)',
                    fontWeight: selectedMemberId === fam.id ? 800 : 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.25s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>{(fam.age || 0) < 16 ? '👦' : '🥋'}</span>
                  {fam.name?.split(' ')[0] || fam.relationship}
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: fam.activeSub ? '#10B981' : '#F59E0B',
                    display: 'inline-block',
                    boxShadow: fam.activeSub ? '0 0 5px rgba(16,185,129,0.6)' : 'none'
                  }} />
                </button>
              ))}
            </div>

            {/* Indicador contextual del miembro activo */}
            {selectedMemberId !== 'main' && (
              <div style={{ marginTop: '8px', padding: '6px 12px', background: 'rgba(0, 180, 216, 0.05)', border: '1px solid rgba(0, 180, 216, 0.15)', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--aurora)', fontWeight: 700 }}>
                📊 Viendo datos de: <strong>{familyProfiles.find(f => f.id === selectedMemberId)?.name || '—'}</strong>
                {' '}• {familyProfiles.find(f => f.id === selectedMemberId)?.relationship}
              </div>
            )}
          </div>
        )}

        {/* Status Card — Condicionado por rol e integridad de membresía */}

        {(() => {
          const isFamiliar = !!profile?.parent_id;
          const nowStr = new Date().toISOString().split('T')[0];
          
          if (isFamiliar) {
            // Para familiares, el estado depende de su membresía
            const isActive = profile?.status === 'activo';
            return (
              <div className={`status-glass ${isActive ? 'ok' : 'pending'}`} id="status-card-dashboard" style={{ marginBottom: '20px' }}>
                <div className="status-row">
                  <div className="status-text-group">
                    <div className={`status-badge ${isActive ? 'ok' : 'pending'}`} id="status-badge-dashboard">
                      <span className="dot"></span> <span id="status-badge-text">{isActive ? 'AL DÍA' : 'PENDIENTE'}</span>
                    </div>
                    <div className="status-main" id="status-main-text">{isActive ? 'Membresía Activa' : 'Membresía Inactiva'}</div>
                    <div className="status-sub" id="status-sub-text">
                      {isActive ? 'Entrenamiento desbloqueado. ¡A rodar!' : 'Contacta a tu apoderado para activar tu plan.'}
                    </div>
                  </div>
                  <div className="status-icon-big" id="status-icon-dashboard">{isActive ? '🛡️' : '⚠️'}</div>
                </div>
              </div>
            );
          } else {
            // Para el titular
            const hasActiveFam = familyProfiles.some(f => f.activeSub);
            const statusClass = hasActiveMembership ? 'ok' : (hasActiveFam ? 'ok' : 'pending');
            const badgeText = hasActiveMembership ? 'AL DÍA' : (hasActiveFam ? 'GRUPO ACTIVO' : 'SIN PLAN');
            const mainText = hasActiveMembership ? 'Membresía Activa' : (hasActiveFam ? 'Familia Entrenando' : 'Membresías Inactivas');
            const subText = hasActiveMembership 
              ? 'Tú y tu familia tienen el tatami listo.' 
              : (hasActiveFam ? 'Tus familiares tienen planes activos. Revisa la consola familiar.' : 'Regulariza las membresías de tu grupo familiar en el área de Pagos.');

            return (
              <div className={`status-glass ${statusClass}`} id="status-card-dashboard" style={{ marginBottom: '20px' }}>
                <div className="status-row">
                  <div className="status-text-group">
                    <div className={`status-badge ${statusClass}`} id="status-badge-dashboard">
                      <span className="dot"></span> <span id="status-badge-text">{badgeText}</span>
                    </div>
                    <div className="status-main" id="status-main-text">{mainText}</div>
                    <div className="status-sub" id="status-sub-text">{subText}</div>
                  </div>
                  <div className="status-icon-big" id="status-icon-dashboard">{hasActiveMembership || hasActiveFam ? '🛡️' : '⚠️'}</div>
                </div>
              </div>
            );
          }
        })()}

        {/* Rank Progression Center — usa el miembro seleccionado */}
        {(() => {
          const selectedProfile = getSelectedProfile();
          const isFamiliar = !!profile?.parent_id;
          const isSelectedFam = selectedMemberId !== 'main';
          const showBelt = isFamiliar || hasActiveMembership || isSelectedFam;

          if (!showBelt) return null;

          const getBeltInfo = (beltVal) => {
            if (!beltVal) return { className: 'belt-white', name: 'Cinturón Blanco' };
            const val = beltVal.toLowerCase();
            if (val.includes('white') || val.includes('blanco')) return { className: 'belt-white', name: 'Cinturón Blanco' };
            if (val.includes('blue') || val.includes('azul')) return { className: 'belt-blue', name: 'Cinturón Azul' };
            if (val.includes('purple') || val.includes('morado')) return { className: 'belt-purple', name: 'Cinturón Morado' };
            if (val.includes('brown') || val.includes('marrón') || val.includes('marron')) return { className: 'belt-brown', name: 'Cinturón Marrón' };
            if (val.includes('black') || val.includes('negro')) return { className: 'belt-black', name: 'Cinturón Negro' };
            return { className: 'belt-white', name: beltVal.charAt(0).toUpperCase() + beltVal.slice(1) };
          };

          const beltInfo = getBeltInfo(selectedProfile?.belt);
          const numGraus = parseInt(selectedProfile?.graus) || 0;

          return (
            <div id="rank-center" className="rank-display-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="metric-label" style={{ marginBottom: '2px' }}>Grado Actual</span>
                  <h3 id="current-belt-name" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'white', fontSize: '1.1rem' }}>
                    {beltInfo.name}
                  </h3>
                </div>
                <div id="current-graus-text" style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {numGraus} {numGraus === 1 ? 'Grau' : 'Graus'}
                </div>
              </div>

              {/* Dynamic BJJ Belt using CSS legacy classes */}
              <div id="belt-preview" className={`belt-visual ${beltInfo.className}`}>
                <div className="belt-tip">
                  {Array.from({ length: numGraus }).map((_, idx) => (
                    <div key={idx} className="grau-stripe"></div>
                  ))}
                </div>
              </div>

              <div className="progress-container">
                <div className="progress-labels">
                  <span>Progreso a Siguiente Grado</span>
                  <span id="progress-percent-text">15%</span>
                </div>
                <div className="progress-bar-bg">
                  <div id="rank-progress-fill" className="progress-fill" style={{ width: '15%' }}></div>
                </div>
              </div>
            </div>
          );
        })()}



        {/* Consola Familiar del Titular Apoderado */}
        {profile && !profile.parent_id && familyProfiles.length > 0 && (
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', marginTop: '20px' }}>
            <h3 className="settings-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', fontSize: '1.15rem' }}>
              👨‍👩‍👧‍👦 Consola de Grupo Familiar
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {familyProfiles.map(fam => {
                const getBeltColorStyle = (beltVal) => {
                  if (!beltVal) return { bg: '#e5e7eb', text: '#1f2937', label: 'Blanco' };
                  const val = beltVal.toLowerCase();
                  if (val.includes('white') || val.includes('blanco')) return { bg: '#ffffff', text: '#000000', label: 'Blanco' };
                  if (val.includes('blue') || val.includes('azul')) return { bg: '#2563eb', text: '#ffffff', label: 'Azul' };
                  if (val.includes('purple') || val.includes('morado')) return { bg: '#7c3aed', text: '#ffffff', label: 'Morado' };
                  if (val.includes('brown') || val.includes('marrón') || val.includes('marron')) return { bg: '#78350f', text: '#ffffff', label: 'Marrón' };
                  if (val.includes('black') || val.includes('negro')) return { bg: '#000000', text: '#ffffff', label: 'Negro' };
                  return { bg: '#ffffff', text: '#000000', label: beltVal };
                };
                
                const beltStyle = getBeltColorStyle(fam.belt);
                const numGraus = parseInt(fam.graus) || 0;
                const isExpired = fam.endDate && new Date(fam.endDate) < new Date();
                
                return (
                  <div 
                    key={fam.id} 
                    style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '10px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    {/* Fila Principal: Nombre y Parentesco */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>{fam.name}</div>
                        <div style={{ color: 'var(--aurora)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginTop: '2px' }}>
                          {fam.relationship} • <span style={{ textTransform: 'none', color: 'var(--text-muted)' }}>{fam.email}</span>
                        </div>
                      </div>
                      
                      {/* Estado de Suscripción */}
                      {fam.activeSub ? (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                            ACTIVO
                          </span>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Vence: {fam.endDate}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ 
                            background: isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
                            color: isExpired ? '#EF4444' : '#F59E0B', 
                            padding: '3px 8px', 
                            borderRadius: '4px', 
                            fontSize: '0.7rem', 
                            fontWeight: 800 
                          }}>
                            {isExpired ? 'MEMBRESÍA VENCIDA' : 'SIN PLAN ACTIVO'}
                          </span>
                          {fam.endDate && (
                            <div style={{ fontSize: '0.65rem', color: '#EF4444', marginTop: '4px', fontWeight: 700 }}>
                              Venció: {fam.endDate}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Fila de Avance: Cinturón y Graus */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600 }}>Cinturón:</span>
                        <span style={{ 
                          background: beltStyle.bg, 
                          color: beltStyle.text, 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.72rem', 
                          fontWeight: 800,
                          border: '1px solid rgba(255,255,255,0.15)'
                        }}>
                          {beltStyle.label}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 800 }}>
                        {numGraus} {numGraus === 1 ? 'Grau' : 'Graus'}
                      </div>
                    </div>
                    
                    {/* Botón Ficha de Salud por Edad */}
                    <div style={{ marginTop: '4px' }}>
                      <a 
                        href={fam.age >= 18 
                          ? "https://docs.google.com/forms/d/e/1FAIpQLSdopTSPEEUyUgIFDFuqEaFH57u310TQaYV-XVnegiJsg3VyUA/viewform?pli=1"
                          : "https://docs.google.com/forms/d/e/1FAIpQLSdopTSPEEUyUgIFDFuqEaFH57u310TQaYV-XVnegiJsg3VyUA/viewform?pli=1&entry.12345=MenorDeEdad"
                        }
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: 'none', width: '100%', display: 'block' }}
                      >
                        <button
                          type="button"
                          className="auth-btn"
                          style={{
                            width: '100%',
                            minHeight: '32px',
                            height: 'auto',
                            padding: '6px 12px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-glass)',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            margin: 0
                          }}
                        >
                          🏥 Ficha de Salud Pendiente ({fam.age >= 18 ? 'Adulto' : 'Menor de Edad'})
                        </button>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attendance Card & Today Classes Schedule */}
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <span className="metric-label" style={{ marginBottom: '2px' }}>Asistencia del Mes</span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'white', fontSize: '1.4rem', margin: 0 }}>
                {attendanceRecords.length} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>clases</span>
              </h3>
            </div>
            <div style={{ fontSize: '2rem' }}>📈</div>
          </div>

          {/* Today Classes list */}
          <div style={{ marginTop: '15px' }}>
            <span className="metric-label" style={{ display: 'block', marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
              Clases de Hoy (Horario Oficial)
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { id: 'bjj_am', name: 'BJJ Mediodía', time: '13:00', icon: '🥋' },
                { id: 'bjj_pm', name: 'BJJ Noche', time: '20:00', icon: '🥋' },
                { id: 'nogi', name: 'NoGi', time: '21:00', icon: '🤼' }
              ].map(cls => {
                // Verificar si asistió hoy a esta clase
                const attended = attendanceRecords.some(r => {
                  const checkDate = new Date(r.checked_at);
                  const today = new Date();
                  return checkDate.toDateString() === today.toDateString() && r.class_type === cls.id;
                });

                return (
                  <div 
                    key={cls.id} 
                    style={{
                      background: attended ? 'rgba(52, 211, 153, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid',
                      borderColor: attended ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{cls.icon}</span>
                      <div>
                        <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>{cls.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>⏱️ {cls.time} hrs</div>
                      </div>
                    </div>
                    {attended ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#34D399', fontWeight: 800, fontSize: '0.8rem' }}>✔ ASISTIDO</span>
                        <button 
                          onClick={() => handleUnmarkAttendance(cls.id)}
                          style={{
                            background: 'rgba(255, 77, 77, 0.1)',
                            border: 'none',
                            color: '#FF4D4D',
                            fontSize: '0.7rem',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleMarkAttendance(cls.id)}
                        style={{
                          background: 'linear-gradient(135deg, var(--aurora), #10B981)',
                          border: 'none',
                          color: '#060B18',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          boxShadow: '0 2px 10px rgba(52, 211, 153, 0.2)'
                        }}
                      >
                        Marcar Clase
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Week Calendar */}
          <div style={{ marginTop: '25px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '15px' }}>
            <span className="metric-label" style={{ display: 'block', marginBottom: '12px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
              Tu Asistencia Semanal
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
              {(() => {
                const daysOfWeek = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
                const today = new Date();
                // Encontrar el Lunes de la semana actual
                const currentDay = today.getDay(); // 0 = Dom, 1 = Lun, etc.
                const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
                const monday = new Date(today);
                monday.setDate(today.getDate() + distanceToMonday);

                return daysOfWeek.map((dayName, idx) => {
                  const targetDayDate = new Date(monday);
                  targetDayDate.setDate(monday.getDate() + idx);
                  
                  const isToday = targetDayDate.toDateString() === today.toDateString();
                  // Verificar si asistió en esta fecha
                  const attendedThatDay = attendanceRecords.some(r => {
                    const checkDate = new Date(r.checked_at);
                    return checkDate.toDateString() === targetDayDate.toDateString();
                  });

                  return (
                    <div 
                      key={dayName}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 4px',
                        borderRadius: '8px',
                        background: isToday ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                        border: isToday ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(255,255,255,0.02)'
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isToday ? 'white' : 'var(--text-muted)' }}>
                        {dayName}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 900, color: isToday ? 'var(--aurora)' : 'white' }}>
                        {targetDayDate.getDate()}
                      </span>
                      {/* Check dot cian si asistió */}
                      <div 
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: attendedThatDay ? 'var(--aurora)' : 'transparent',
                          boxShadow: attendedThatDay ? '0 0 6px var(--aurora)' : 'none',
                          marginTop: '2px'
                        }}
                      ></div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
