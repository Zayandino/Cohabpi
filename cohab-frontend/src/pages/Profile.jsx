import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { LogOut, ArrowLeft, Plus, Calendar, Users, QrCode, Settings, Trash2, Edit2, CreditCard, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function Profile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [family, setFamily] = useState([]);
  const [showFamilyPanel, setShowFamilyPanel] = useState(false);
  
  // State for Add Family Form
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [familyRelation, setFamilyRelation] = useState('Hijo/a');
  const [familyEmail, setFamilyEmail] = useState('');
  const [familyPassword, setFamilyPassword] = useState('');
  const [familyAge, setFamilyAge] = useState('');
  const [addingFamily, setAddingFamily] = useState(false);

  // State for Editing Family Inline
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRelationship, setEditRelationship] = useState('Hijo/a');
  const [editAge, setEditAge] = useState('');
  const [updatingFamily, setUpdatingFamily] = useState(false);

  // States for Payments Calculator (Profile-integrated)
  const [showPaymentsPanel, setShowPaymentsPanel] = useState(false);
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [enrollments, setEnrollments] = useState({});
  const [prepayPeriod, setPrepayPeriod] = useState(1); // 1, 3, 6, 12 months
  const [paymentMethod, setPaymentMethod] = useState('debito'); // 'debito' or 'credito'
  const [installments, setInstallments] = useState(0); // 0, 3, 6, 12 cuotas
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [discounts, setDiscounts] = useState([]);

  const handleStartEditFamily = (member) => {
    setEditingMemberId(member.id);
    setEditName(member.name || member.full_name || '');
    setEditRelationship(member.relationship || 'Hijo/a');
    setEditAge(member.age || '');
  };

  const handleUpdateFamilyMember = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editingMemberId || !editAge) return;

    setUpdatingFamily(true);
    try {
      const birthDateCalc = new Date(new Date().getFullYear() - parseInt(editAge, 10), 0, 1).toISOString().split('T')[0];
      
      // Actualizar perfil del familiar
      const { error: profileError } = await supabase
        .from('cohab_profiles')
        .update({
          name: editName.trim(),
          relationship: editRelationship,
          age: parseInt(editAge, 10),
          birthdate: birthDateCalc
        })
        .eq('id', editingMemberId);

      if (profileError) throw profileError;

      // Actualizar también en cohab_family_members para sincronía
      await supabase
        .from('cohab_family_members')
        .update({
          name: editName.trim(),
          relationship: editRelationship,
          birthdate: birthDateCalc
        })
        .eq('id', editingMemberId);

      // Actualizar estado local
      setFamily(prev => prev.map(m => m.id === editingMemberId ? { 
        ...m, 
        name: editName.trim(), 
        relationship: editRelationship,
        age: parseInt(editAge, 10),
        birthdate: birthDateCalc
      } : m));
      
      // Limpiar estado de edición
      setEditingMemberId(null);
      setEditName('');
      setEditAge('');
    } catch (err) {
      console.error("Error updating family member:", err);
      alert("Error al actualizar familiar.");
    } finally {
      setUpdatingFamily(false);
    }
  };
  
  useEffect(() => {
    async function fetchFamily() {
      try {
        const { data, error } = await supabase
          .from('cohab_profiles')
          .select('id, name, relationship, age, email, birthdate, scholarship_percent')
          .eq('parent_id', profile.id);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          localStorage.setItem(`cohab_family_${profile.id}`, JSON.stringify(data));
          setFamily(data);
        } else {
          const localData = JSON.parse(localStorage.getItem(`cohab_family_${profile.id}`) || '[]');
          setFamily(localData);
        }
      } catch (err) {
        console.error('Error fetching family:', err);
        const localData = JSON.parse(localStorage.getItem(`cohab_family_${profile.id}`) || '[]');
        setFamily(localData);
      }
    }

    if (profile?.id) {
      fetchFamily();
    }
  }, [profile]);

  // Integrated Payments Logic (Profile-based)
  useEffect(() => {
    async function fetchPaymentsData() {
      if (!profile?.id || profile?.parent_id) return;
      try {
        setLoadingServices(true);
        // Fetch services/disciplines
        const { data: servicesData, error: servicesError } = await supabase
          .from('cohab_services')
          .select('*')
          .order('name', { ascending: true });
          
        if (servicesError) throw servicesError;

        // Filtrar duplicados por nombre normalizado (LOWER + TRIM)
        const uniqueServices = [];
        const seenNames = new Set();
        (servicesData || []).forEach(s => {
          const nameNormalized = s.name.trim().toLowerCase();
          if (!seenNames.has(nameNormalized)) {
            seenNames.add(nameNormalized);
            uniqueServices.push(s);
          }
        });
        
        setServices(uniqueServices);

        // Fetch dynamic discounts from database if any
        try {
          const { data: discountsData } = await supabase
            .from('cohab_discounts')
            .select('*');
          setDiscounts(discountsData || []);
        } catch (discErr) {
          console.warn("No se pudieron cargar descuentos en perfil:", discErr);
        }
        
        // Helper to get default service based on age
        const getDefaultServiceForAge = (age, servicesList) => {
          if (!servicesList || servicesList.length === 0) return '';
          const isOver16 = (age || 0) > 16;
          if (isOver16) {
            const adultService = servicesList.find(s => {
              const nameLower = s.name.toLowerCase();
              return !nameLower.includes('kids') && !nameLower.includes('infantil') && !nameLower.includes('niños');
            });
            return adultService?.id || servicesList[0]?.id || '';
          }
          return servicesList[0]?.id || '';
        };

        // Initialize enrollments state safely
        const initial = {
          main: { 
            enabled: true, 
            serviceId: getDefaultServiceForAge(profile?.age || 0, servicesData), 
            tierIdx: 0 
          }
        };
        
        if (family && family.length > 0) {
          family.forEach(m => {
            initial[m.id] = { 
              enabled: false, 
              serviceId: getDefaultServiceForAge(m.age || 0, servicesData), 
              tierIdx: 0 
            };
          });
        }
        setEnrollments(initial);
      } catch (err) {
        console.error("Error loading payments data in profile:", err);
      } finally {
        setLoadingServices(false);
      }
    }

    if (profile?.id && !profile?.parent_id) {
      fetchPaymentsData();
    }
  }, [profile, family]);

  const getScholarshipPercentForPerson = (personId) => {
    let dbPercent = 0;
    if (personId === 'main') {
      dbPercent = profile?.scholarship_percent || 0;
    } else {
      const famMember = family.find(f => f.id === personId);
      dbPercent = famMember?.scholarship_percent || 0;
    }
    
    try {
      const localScholarships = JSON.parse(localStorage.getItem('cohab_scholarships') || '{}');
      const targetId = personId === 'main' ? profile?.id : personId;
      return localScholarships[targetId] !== undefined ? localScholarships[targetId] : dbPercent;
    } catch (e) {
      return dbPercent;
    }
  };

  const calculateTotal = () => {
    let subtotal = 0;
    let activeEnrollmentsCount = 0;
    
    Object.keys(enrollments).forEach(personId => {
      const entry = enrollments[personId];
      
      // Obtener edad para calcular el fallback de disciplina de adultos si corresponde
      let age = 0;
      if (personId === 'main') {
        age = profile?.age || 0;
      } else {
        const famMember = family.find(f => f.id === personId);
        age = famMember?.age || 0;
      }

      const defaultServiceId = services.length > 0 ? (
        (age > 16) 
          ? (services.find(s => !s.name.toLowerCase().includes('kids') && !s.name.toLowerCase().includes('infantil') && !s.name.toLowerCase().includes('niños'))?.id || services[0]?.id)
          : services[0]?.id
      ) : '';

      const currentServiceId = entry?.serviceId || defaultServiceId;
      
      if (entry?.enabled && currentServiceId) {
        activeEnrollmentsCount++;
        const service = services.find(s => s.id === currentServiceId);
        if (service) {
          const hasTiers = service.pricing_tiers && service.pricing_tiers.length > 0;
          let basePrice = 0;
          if (hasTiers) {
            const tier = service.pricing_tiers[entry.tierIdx] || service.pricing_tiers[0];
            basePrice = tier.price || 0;
          } else {
            basePrice = service.price || 0;
          }

          // Aplicar descuento de beca antes de sumarlo al subtotal familiar
          const scholarshipPercent = getScholarshipPercentForPerson(personId);
          if (scholarshipPercent > 0) {
            basePrice = Math.round(basePrice * (1 - scholarshipPercent / 100));
          }
          subtotal += basePrice;
        }
      }
    });

    const isFamilyDiscountApplicable = activeEnrollmentsCount > 1;
    const familyDiscountAmount = isFamilyDiscountApplicable ? Math.round(subtotal * 0.15) : 0;
    const monthlyTotalAfterFamilyDiscount = subtotal - familyDiscountAmount;

    let prepayDiscountPercent = 0;
    if (prepayPeriod === 3) prepayDiscountPercent = 0.10;
    else if (prepayPeriod === 6) prepayDiscountPercent = 0.15;
    else if (prepayPeriod === 12) prepayDiscountPercent = 0.25;

    const basePrepaidTotal = monthlyTotalAfterFamilyDiscount * prepayPeriod;
    const prepayDiscountAmount = Math.round(basePrepaidTotal * prepayDiscountPercent);
    const finalTotal = basePrepaidTotal - prepayDiscountAmount;

    return {
      subtotal,
      activeEnrollmentsCount,
      isFamilyDiscountApplicable,
      familyDiscountAmount,
      monthlyTotalAfterFamilyDiscount,
      prepayDiscountPercent,
      prepayDiscountAmount,
      finalTotal
    };
  };

  const handleToggleEnrollment = (personId) => {
    setEnrollments(prev => ({
      ...prev,
      [personId]: {
        ...prev[personId],
        enabled: !prev[personId]?.enabled
      }
    }));
  };

  const handleServiceSelectSafe = (personId, serviceId) => {
    const selectedService = services.find(s => s.id === serviceId);
    if (!selectedService) return;

    let targetAge = 0;
    if (personId === 'main') {
      targetAge = profile?.age || 0;
    } else {
      const famMember = family.find(f => f.id === personId);
      targetAge = famMember?.age || 0;
    }

    if (targetAge > 16) {
      const nameLower = selectedService.name.toLowerCase();
      if (nameLower.includes('kids') || nameLower.includes('infantil') || nameLower.includes('niños')) {
        alert("Regla de Cohab Tatami: No es posible inscribir en disciplinas infantiles a personas mayores de 16 años.");
        return;
      }
    }

    setEnrollments(prev => ({
      ...prev,
      [personId]: {
        ...prev[personId],
        serviceId,
        tierIdx: 0
      }
    }));
  };

  const handleTierChange = (personId, tierIdx) => {
    setEnrollments(prev => ({
      ...prev,
      [personId]: {
        ...prev[personId],
        tierIdx: parseInt(tierIdx, 10)
      }
    }));
  };

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    const totals = calculateTotal();
    
    try {
      // Simular tiempo de carga de pasarela de pago
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const activeEnrollments = Object.keys(enrollments).filter(pId => enrollments[pId]?.enabled);
      
      for (const personId of activeEnrollments) {
        const pId = personId === 'main' ? profile.id : personId;
        const enrollment = enrollments[personId];
        const currentServiceId = enrollment.serviceId || services[0]?.id;
        
        // 1. Activar estado del perfil
        await supabase
          .from('cohab_profiles')
          .update({ status: 'activo' })
          .eq('id', pId);

        // 2. Crear suscripción
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + prepayPeriod);

        await supabase
          .from('cohab_subscriptions')
          .insert([{
            profile_id: pId,
            service_id: currentServiceId,
            status: 'active',
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0]
          }]);
      }

      // 3. Registrar pago único global aprobado
      await supabase
        .from('cohab_payments')
        .insert([{
          profile_id: profile.id,
          amount: totals.finalTotal,
          status: 'approved',
          payment_method: paymentMethod,
          payment_date: new Date().toISOString()
        }]);
      
      setPaymentSuccess(true);
    } catch (err) {
      console.error("Payment registration failed:", err);
      alert("Error al procesar el pago.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddFamilyMember = async (e) => {
    e.preventDefault();
    if (!familyName.trim() || !familyEmail.trim() || !familyPassword || !familyAge || !profile?.id) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }

    if (familyPassword.length < 6) {
      alert("La clave provisoria debe tener al menos 6 caracteres.");
      return;
    }

    setAddingFamily(true);
    try {
      // 1. Crear usuario en Auth usando el cliente temporal para no cerrar la sesión del padre
      const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
        email: familyEmail.trim(),
        password: familyPassword,
        options: {
          data: {
            full_name: familyName.trim()
          }
        }
      });

      if (signUpError) throw signUpError;

      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error("No se pudo obtener el ID del usuario registrado.");

      const birthDateCalc = new Date(new Date().getFullYear() - parseInt(familyAge, 10), 0, 1).toISOString().split('T')[0];

      // 2. Usar el cliente temporal (autenticado como el hijo) para actualizar su propio perfil cohab_profiles
      const { error: profileError } = await tempClient
        .from('cohab_profiles')
        .update({
          name: familyName.trim(),
          parent_id: profile.id,
          relationship: familyRelation,
          age: parseInt(familyAge, 10),
          birthdate: birthDateCalc,
          status: 'activo'
        })
        .eq('id', newUserId);

      if (profileError) throw profileError;

      // 3. Crear el registro en cohab_family_members con el mismo ID para mantener la sincronización histórica
      const { error: familyMemberError } = await supabase
        .from('cohab_family_members')
        .insert([{
          id: newUserId,
          parent_id: profile.id,
          name: familyName.trim(),
          relationship: familyRelation,
          birthdate: birthDateCalc
        }]);

      if (familyMemberError) {
        console.warn("Aviso: No se pudo guardar en cohab_family_members, pero la cuenta de perfil principal fue creada con éxito:", familyMemberError);
      }

      // Resetear campos del formulario
      setFamilyName('');
      setFamilyEmail('');
      setFamilyPassword('');
      setFamilyAge('');
      setShowAddFamily(false);
      
      // Guardar en el estado local inmediatamente con persistencia en localStorage para evitar bloqueos por RLS
      const newLocalMember = {
        id: newUserId,
        name: familyName.trim(),
        relationship: familyRelation,
        age: parseInt(familyAge, 10),
        email: familyEmail.trim(),
        birthdate: birthDateCalc,
        scholarship_percent: 0
      };

      setFamily(prev => {
        const updated = [...prev.filter(m => m.id !== newUserId), newLocalMember];
        localStorage.setItem(`cohab_family_${profile.id}`, JSON.stringify(updated));
        return updated;
      });

      // Intentar sincronizar con Supabase de fondo
      try {
        const { data: updatedFamily } = await supabase
          .from('cohab_profiles')
          .select('id, name, relationship, age, email, birthdate, scholarship_percent')
          .eq('parent_id', profile.id);
        
        if (updatedFamily && updatedFamily.length > 0) {
          localStorage.setItem(`cohab_family_${profile.id}`, JSON.stringify(updatedFamily));
          setFamily(updatedFamily);
        }
      } catch (silentErr) {
        console.warn("Refresco silencioso de familiares falló (se usará local):", silentErr);
      }
      
      alert("¡Familiar agregado con éxito! Se ha creado su cuenta provisoria.");
    } catch (err) {
      console.error("Error adding family member:", err);
      alert("Error al agregar familiar: " + (err.message || "Inténtalo de nuevo."));
    } finally {
      setAddingFamily(false);
    }
  };

  const handleDeleteFamilyMember = async (memberId) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar a este familiar de tu perfil? Esto también eliminará su cuenta asociada.")) return;

    try {
      // Eliminar el perfil (por cascada en la base de datos se eliminan suscripciones y registros asociados)
      const { error: profileDeleteError } = await supabase
        .from('cohab_profiles')
        .delete()
        .eq('id', memberId);

      if (profileDeleteError) throw profileDeleteError;

      // Eliminar también de cohab_family_members por si acaso
      await supabase
        .from('cohab_family_members')
        .delete()
        .eq('id', memberId);

      // Actualizar estado local
      setFamily(prev => prev.filter(m => m.id !== memberId));
      alert("Familiar eliminado correctamente.");
    } catch (err) {
      console.error("Error deleting family member:", err);
      alert("Error al eliminar familiar.");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div>
      <div className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/dashboard')} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="top-bar-title">Area Personal</div>
      </div>

      <div className="content" style={{ paddingTop: '20px' }}>
        
        {/* Hero Card */}
        <div className="profile-hero-card">
          <div className="profile-hero-bg"></div>
          <div className="profile-avatar-container">
            🥋
          </div>
          <div className="profile-hero-info">
            <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: '1.6rem', color: '#fff' }}>
              {profile?.name || 'Cargando...'}
            </h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: 'var(--aurora)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>
              {profile?.role === 'admin' ? 'Administrador' : 'Alumno'}
            </p>
          </div>
        </div>

        {/* Data Form */}
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px' }}>
          <h3 className="settings-title">Datos Personales</h3>
          
          <div className="settings-input-group">
            <div className="settings-input-icon">👤</div>
            <div className="settings-input-wrapper">
              <label>Nombre de Usuario</label>
              <input type="text" defaultValue={profile?.name || ''} readOnly />
            </div>
          </div>
          <div className="settings-input-group">
            <div className="settings-input-icon">✉️</div>
            <div className="settings-input-wrapper">
              <label>Correo Asociado</label>
              <input type="email" defaultValue={profile?.email || ''} readOnly />
            </div>
          </div>
          <div className="settings-input-group">
            <div className="settings-input-icon">📱</div>
            <div className="settings-input-wrapper">
              <label>Teléfono / WhatsApp</label>
              <input type="tel" defaultValue={profile?.phone || ''} readOnly />
            </div>
          </div>
        </div>

        {/* Enlace Premium a Mi Familia - Solo visible para titulares (parent_id es null o undefined) */}
        {!profile?.parent_id && (
          <div 
            onClick={() => setShowFamilyPanel(!showFamilyPanel)}
            className="mp-card" 
            style={{
              marginTop:'25px', 
              marginBottom:'15px', 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 11, 24, 0.9))', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.15)', 
              textAlign: 'left', 
              padding: '20px', 
              display:'flex', 
              alignItems:'center', 
              gap: '18px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            <div style={{fontSize: '2.5rem', filter: 'drop-shadow(0 4px 10px rgba(16, 185, 129, 0.5))'}}>👨‍👩‍👧‍👦</div>
            <div style={{ flex: 1 }}>
              <h3 style={{fontFamily:'var(--font-display)', fontSize:'1.15rem', fontWeight:800, color:'var(--text-white)', marginBottom:'4px', marginTop:0}}>Administración de Mi Familia</h3>
              <p style={{fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.4, margin:0}}>Crea cuentas provisorias para tus familiares, configura sus datos y edita sus edades.</p>
            </div>
            <div style={{ fontSize: '1.2rem', color: '#10B981', fontWeight: 800, transform: showFamilyPanel ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }}>
              {showFamilyPanel ? '↓' : '→'}
            </div>
          </div>
        )}

        {/* Family Management colapsable - Solo visible para titulares */}
        {!profile?.parent_id && showFamilyPanel && (
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="settings-title" style={{ marginBottom: 0 }}>👨‍👩‍👧‍👦 Panel de Control Familiar</h3>
              <button 
                className="icon-btn" 
                onClick={() => setShowAddFamily(!showAddFamily)} 
                style={{ width: '36px', height: '36px' }}
                aria-label="Agregar familiar"
              >
                <Plus size={18} style={{ transform: showAddFamily ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s' }} />
              </button>
            </div>

            {/* Formulario Agregar Familiar (Inline) */}
            {showAddFamily && (
              <div 
                style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '10px', 
                  padding: '16px', 
                  marginBottom: '18px' 
                }}
              >
                <form onSubmit={handleAddFamilyMember}>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Nombre Completo</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ fontSize: '0.85rem', height: '36px' }}
                      value={familyName}
                      onChange={e => setFamilyName(e.target.value)}
                      placeholder="ej: Lucas Silva"
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Correo Electrónico (Para su cuenta propia)</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      style={{ fontSize: '0.85rem', height: '36px' }}
                      value={familyEmail}
                      onChange={e => setFamilyEmail(e.target.value)}
                      placeholder="ej: lucas@gmail.com"
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Clave Provisoria</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        style={{ fontSize: '0.85rem', height: '36px' }}
                        value={familyPassword}
                        onChange={e => setFamilyPassword(e.target.value)}
                        placeholder="Mín. 6 chars"
                        required
                      />
                    </div>
                    
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Edad (Obligatoria)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        style={{ fontSize: '0.85rem', height: '36px' }}
                        value={familyAge}
                        onChange={e => setFamilyAge(e.target.value)}
                        placeholder="ej: 12"
                        min="1"
                        max="120"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Parentesco / Relación</label>
                    <select 
                      className="form-input" 
                      style={{ fontSize: '0.85rem', height: '36px', background: 'var(--bg-elevated)', color: 'white' }}
                      value={familyRelation}
                      onChange={e => setFamilyRelation(e.target.value)}
                    >
                      <option value="Hijo/a">Hijo/a</option>
                      <option value="Cónyuge">Cónyuge / Pareja</option>
                      <option value="Hermano/a">Hermano/a</option>
                      <option value="Padre/Madre">Padre/Madre</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      type="submit" 
                      className="auth-btn" 
                      disabled={addingFamily}
                      style={{ 
                        flex: 1, 
                        minHeight: '38px', 
                        height: 'auto', 
                        background: 'linear-gradient(135deg, var(--aurora), #10B981)', 
                        color: '#060B18', 
                        fontWeight: 900,
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        borderRadius: '6px',
                        boxShadow: '0 0 10px rgba(52, 211, 153, 0.2)',
                        margin: 0
                      }}
                    >
                      {addingFamily ? 'Creando cuenta...' : 'Guardar y Crear Cuenta'}
                    </button>
                    <button 
                      type="button" 
                      className="auth-btn" 
                      onClick={() => {
                        setShowAddFamily(false);
                        setFamilyName('');
                        setFamilyEmail('');
                        setFamilyPassword('');
                        setFamilyAge('');
                      }}
                      style={{ 
                        flex: 1, 
                        minHeight: '38px', 
                        height: 'auto', 
                        background: 'transparent', 
                        border: '1px solid var(--border-glass)', 
                        color: 'white', 
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        borderRadius: '6px',
                        margin: 0
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista de Familiares */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {family.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No tienes familiares agregados.</p>
              ) : (
                family.map(member => {
                  const isEditing = editingMemberId === member.id;
                  
                  if (isEditing) {
                    return (
                      <div 
                        key={member.id} 
                        style={{ 
                          background: 'rgba(255, 255, 255, 0.02)', 
                          border: '1px solid var(--border-glass)', 
                          borderRadius: '10px', 
                          padding: '12px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '10px' 
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ flex: 2, fontSize: '0.85rem', height: '34px', margin: 0 }}
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="Nombre"
                            required
                          />
                          <select 
                            className="form-input" 
                            style={{ flex: 1.5, fontSize: '0.85rem', height: '34px', background: 'var(--bg-elevated)', color: 'white', padding: '0 4px', margin: 0 }}
                            value={editRelationship}
                            onChange={e => setEditRelationship(e.target.value)}
                          >
                            <option value="Hijo/a">Hijo/a</option>
                            <option value="Cónyuge">Cónyuge</option>
                            <option value="Hermano/a">Hermano/a</option>
                            <option value="Padre/Madre">Padre/Madre</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Edad</label>
                            <input 
                              type="number" 
                              className="form-input" 
                              style={{ fontSize: '0.85rem', height: '34px', margin: 0 }}
                              value={editAge}
                              onChange={e => setEditAge(e.target.value)}
                              placeholder="Edad"
                              min="1"
                              max="120"
                              required
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button 
                            onClick={handleUpdateFamilyMember}
                            disabled={updatingFamily}
                            className="auth-btn" 
                            style={{ 
                              flex: 1, 
                              minHeight: '32px', 
                              height: 'auto', 
                              background: 'linear-gradient(135deg, var(--aurora), #10B981)', 
                              color: '#060B18', 
                              fontWeight: 900,
                              fontSize: '0.75rem',
                              padding: '4px',
                              borderRadius: '4px',
                              margin: 0
                            }}
                          >
                            {updatingFamily ? '...' : 'Guardar'}
                          </button>
                          <button 
                            onClick={() => setEditingMemberId(null)}
                            className="auth-btn" 
                            style={{ 
                              flex: 1, 
                              minHeight: '32px', 
                              height: 'auto', 
                              background: 'transparent', 
                              border: '1px solid var(--border-glass)', 
                              color: 'white', 
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              padding: '4px',
                              borderRadius: '4px',
                              margin: 0
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={member.id} 
                      className="settings-input-group" 
                      style={{ 
                        marginBottom: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        paddingRight: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <div className="settings-input-icon" style={{ flexShrink: 0 }}>🧑‍🤝‍🧑</div>
                        <div className="settings-input-wrapper" style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'white', fontSize: '0.92rem', fontWeight: 700 }}>{member.name}</span>
                            <span style={{ background: 'rgba(0, 180, 216, 0.15)', color: 'var(--aurora)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                              {member.age || '—'} años
                            </span>
                          </div>
                          <span style={{ color: 'var(--aurora)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginTop: '2px', display: 'block' }}>
                            {member.relationship} • <span style={{ textTransform: 'none', color: 'var(--text-muted)' }}>{member.email}</span>
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleStartEditFamily(member)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            color: '#60A5FA',
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                          }}
                          title="Editar familiar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteFamilyMember(member.id)}
                          style={{
                            background: 'rgba(255, 77, 77, 0.1)',
                            border: '1px solid rgba(255, 77, 77, 0.2)',
                            color: '#FF6B6B',
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                          }}
                          title="Eliminar familiar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Enlace Premium a Pagos - Solo visible para titulares (parent_id es null o undefined) */}
        {!profile?.parent_id && (
          <div 
            onClick={() => setShowPaymentsPanel(!showPaymentsPanel)}
            className="mp-card" 
            style={{
              marginTop:'25px', 
              marginBottom:'15px', 
              background: 'linear-gradient(135deg, rgba(0, 180, 216, 0.15), rgba(6, 11, 24, 0.9))', 
              border: '1px solid rgba(0, 180, 216, 0.3)', 
              boxShadow: '0 8px 32px rgba(0, 180, 216, 0.15)', 
              textAlign: 'left', 
              padding: '20px', 
              display:'flex', 
              alignItems:'center', 
              gap: '18px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            <div style={{fontSize: '2.5rem', filter: 'drop-shadow(0 4px 10px rgba(0, 180, 216, 0.5))'}}>💳</div>
            <div style={{ flex: 1 }}>
              <h3 style={{fontFamily:'var(--font-display)', fontSize:'1.15rem', fontWeight:800, color:'var(--text-white)', marginBottom:'4px', marginTop:0}}>Membresías y Pagos</h3>
              <p style={{fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.4, margin:0}}>Administra los planes de tu familia, revisa descuentos y realiza pagos seguros en línea.</p>
            </div>
            <div style={{ fontSize: '1.2rem', color: 'var(--aurora)', fontWeight: 800, transform: showPaymentsPanel ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }}>
              {showPaymentsPanel ? '↓' : '→'}
            </div>
          </div>
        )}

        {/* Panel Colapsable de Membresías y Pagos - Lógica 100% Integrada en Perfil */}
        {!profile?.parent_id && showPaymentsPanel && (
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', border: '1px solid rgba(0, 180, 216, 0.2)', background: 'rgba(6, 11, 24, 0.65)', animation: 'fadeIn 0.35s ease-out' }}>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.2rem', marginBottom: '6px' }}>
                Planificador Familiar y Pagos
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
                Configura las disciplinas de tu grupo familiar y calcula el total con descuentos aplicados.
              </p>
            </div>

            {loadingServices ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Cargando planes y disciplinas...</p>
            ) : (
              <div>
                {/* STEP 1: ASIGNACIÓN DE SERVICIOS */}
                <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)' }}>
                  <h4 style={{ color: 'white', margin: '0 0 15px 0', fontFamily: 'var(--font-display)', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    👤 1. Asignar Disciplinas
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    
                    {/* Usuario Principal ("A mí mismo") */}
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>🥋</span>
                          <div>
                            <div style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{profile?.name || 'Tú (Titular)'}</div>
                            <div style={{ color: 'var(--aurora)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>A mí mismo</div>
                          </div>
                        </div>
                        <label className="switch-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={enrollments.main?.enabled || false}
                            onChange={() => handleToggleEnrollment('main')}
                            style={{ display: 'none' }}
                          />
                          <div style={{
                            width: '40px',
                            height: '22px',
                            borderRadius: '11px',
                            background: enrollments.main?.enabled ? 'var(--aurora)' : 'rgba(255,255,255,0.1)',
                            position: 'relative',
                            transition: 'all 0.3s'
                          }}>
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: '#060B18',
                              position: 'absolute',
                              top: '2px',
                              left: enrollments.main?.enabled ? '20px' : '2px',
                              transition: 'all 0.3s'
                            }} />
                          </div>
                        </label>
                      </div>

                      {enrollments.main?.enabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.05)' }}>
                          <select 
                            className="form-input" 
                            style={{ height: '36px', fontSize: '0.82rem', background: 'var(--bg-elevated)', color: 'white' }}
                            value={enrollments.main.serviceId || services[0]?.id || ''}
                            onChange={e => handleServiceSelectSafe('main', e.target.value)}
                          >
                            {services
                              .filter(s => {
                                const isOver16 = (profile?.age || 0) > 16;
                                if (isOver16) {
                                  const nameLower = s.name.toLowerCase();
                                  return !nameLower.includes('kids') && !nameLower.includes('infantil') && !nameLower.includes('niños');
                                }
                                return true;
                              })
                              .map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))
                            }
                          </select>
                          
                          {(() => {
                            const selectedService = services.find(s => s.id === (enrollments.main.serviceId || services[0]?.id));
                            if (selectedService?.pricing_tiers && selectedService.pricing_tiers.length > 0) {
                              return (
                                <select 
                                  className="form-input"
                                  style={{ height: '36px', fontSize: '0.82rem', background: 'var(--bg-elevated)', color: 'white' }}
                                  value={enrollments.main.tierIdx}
                                  onChange={e => handleTierChange('main', e.target.value)}
                                >
                                  {selectedService.pricing_tiers.map((t, idx) => (
                                    <option key={idx} value={idx}>{t.name} - {formats.format(t.price)}/mes</option>
                                  ))}
                                </select>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Miembros Familiares */}
                    {family.map(m => {
                      const entry = enrollments[m.id] || { enabled: false, serviceId: services[0]?.id || '', tierIdx: 0 };
                      return (
                        <div key={m.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '1.2rem' }}>🥋</span>
                              <div>
                                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{m.name}</div>
                                <div style={{ color: '#10B981', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Familiar ({m.relationship})</div>
                              </div>
                            </div>
                            <label className="switch-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={entry.enabled}
                                onChange={() => handleToggleEnrollment(m.id)}
                                style={{ display: 'none' }}
                              />
                              <div style={{
                                width: '40px',
                                height: '22px',
                                borderRadius: '11px',
                                background: entry.enabled ? 'var(--aurora)' : 'rgba(255,255,255,0.1)',
                                position: 'relative',
                                transition: 'all 0.3s'
                              }}>
                                <div style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: '#060B18',
                                  position: 'absolute',
                                  top: '2px',
                                  left: entry.enabled ? '20px' : '2px',
                                  transition: 'all 0.3s'
                                }} />
                              </div>
                            </label>
                          </div>

                          {entry.enabled && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.05)' }}>
                              <select 
                                className="form-input" 
                                style={{ height: '36px', fontSize: '0.82rem', background: 'var(--bg-elevated)', color: 'white' }}
                                value={entry.serviceId || services[0]?.id || ''}
                                onChange={e => handleServiceSelectSafe(m.id, e.target.value)}
                              >
                                {services
                                  .filter(s => {
                                    const isOver16 = (m.age || 0) > 16;
                                    if (isOver16) {
                                      const nameLower = s.name.toLowerCase();
                                      return !nameLower.includes('kids') && !nameLower.includes('infantil') && !nameLower.includes('niños');
                                    }
                                    return true;
                                  })
                                  .map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))
                                }
                              </select>
                              
                              {(() => {
                                const selectedService = services.find(s => s.id === (entry.serviceId || services[0]?.id));
                                if (selectedService?.pricing_tiers && selectedService.pricing_tiers.length > 0) {
                                  return (
                                    <select 
                                      className="form-input"
                                      style={{ height: '36px', fontSize: '0.82rem', background: 'var(--bg-elevated)', color: 'white' }}
                                      value={entry.tierIdx}
                                      onChange={e => handleTierChange(m.id, e.target.value)}
                                    >
                                      {selectedService.pricing_tiers.map((t, idx) => (
                                        <option key={idx} value={idx}>{t.name} - {formats.format(t.price)}/mes</option>
                                      ))}
                                    </select>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* STEP 2: PERÍODOS DE PREPAGO */}
                <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)' }}>
                  <h4 style={{ color: 'white', margin: '0 0 15px 0', fontFamily: 'var(--font-display)', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    📅 2. Período de Suscripción
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { value: 1, label: '1 Mes', desc: 'Tarifa Estándar' },
                      { value: 3, label: '3 Meses', desc: 'Ahorra 10%' },
                      { value: 6, label: '6 Meses', desc: 'Ahorra 15%' },
                      { value: 12, label: '1 Año', desc: 'Ahorra 25%' }
                    ].map(period => (
                      <button
                        key={period.value}
                        type="button"
                        onClick={() => setPrepayPeriod(period.value)}
                        style={{
                          padding: '12px 8px',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: prepayPeriod === period.value ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                          background: prepayPeriod === period.value ? 'rgba(0, 180, 216, 0.08)' : 'rgba(255,255,255,0.01)',
                          color: prepayPeriod === period.value ? 'white' : 'var(--text-muted)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.3s'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{period.label}</div>
                        <div style={{ fontSize: '0.68rem', color: prepayPeriod === period.value ? 'var(--aurora)' : 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                          {period.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* STEP 3: MÉTODOS DE PAGO Y CUOTAS */}
                <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)' }}>
                  <h4 style={{ color: 'white', margin: '0 0 15px 0', fontFamily: 'var(--font-display)', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    💳 3. Método de Pago
                  </h4>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('debito');
                        setInstallments(0);
                      }}
                      style={{
                        flex: 1,
                        height: '38px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: paymentMethod === 'debito' ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                        background: paymentMethod === 'debito' ? 'rgba(0, 180, 216, 0.08)' : 'rgba(255,255,255,0.01)',
                        color: paymentMethod === 'debito' ? 'white' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Débito
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('credito')}
                      style={{
                        flex: 1,
                        height: '38px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: paymentMethod === 'credito' ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                        background: paymentMethod === 'credito' ? 'rgba(0, 180, 216, 0.08)' : 'rgba(255,255,255,0.01)',
                        color: paymentMethod === 'credito' ? 'white' : 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Crédito
                    </button>
                  </div>

                  {paymentMethod === 'credito' && (
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '8px', display: 'block' }}>
                        Selecciona Cuotas (Sin Interés)
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {[0, 3, 6, 12].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setInstallments(c)}
                            style={{
                              height: '34px',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: installments === c ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                              background: installments === c ? 'rgba(0, 180, 216, 0.1)' : 'rgba(255,255,255,0.01)',
                              color: installments === c ? 'white' : 'var(--text-light)',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            {c === 0 ? '1' : c} {c === 0 ? 'cuota' : 'cuotas'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* BREAKDOWN CARD - SIEMPRE VISIBLE */}
                {(() => {
                  const totals = calculateTotal();
                  return (
                    <div className="glass-panel" style={{ padding: '22px', borderLeft: `3px solid ${totals.activeEnrollmentsCount > 0 ? 'var(--aurora)' : '#FF6B6B'}`, marginBottom: '10px', background: 'rgba(0,0,0,0.1)' }}>
                      <h4 style={{ color: 'white', margin: '0 0 15px 0', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
                        Resumen de Membresía
                      </h4>

                      {totals.activeEnrollmentsCount > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)' }}>
                            <span>Mensualidad Base (Suma):</span>
                            <span>{formats.format(totals.subtotal)}</span>
                          </div>

                          {totals.isFamilyDiscountApplicable && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10B981', fontWeight: 700 }}>
                              <span>Descuento Familiar (15%):</span>
                              <span>-{formats.format(totals.familyDiscountAmount)}</span>
                            </div>
                          )}

                          {totals.isFamilyDiscountApplicable && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <span>Subtotal Mensual Neto:</span>
                              <span>{formats.format(totals.monthlyTotalAfterFamilyDiscount)}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)' }}>
                            <span>Período Suscripción:</span>
                            <span>{prepayPeriod} {prepayPeriod === 1 ? 'Mes' : 'Meses'}</span>
                          </div>

                          {totals.prepayDiscountPercent > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10B981', fontWeight: 700 }}>
                              <span>Descuento por Prepago ({totals.prepayDiscountPercent * 100}%):</span>
                              <span>-{formats.format(totals.prepayDiscountAmount)}</span>
                            </div>
                          )}

                          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '12px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <strong style={{ fontSize: '1rem', color: 'white' }}>TOTAL A PAGAR:</strong>
                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ fontSize: '1.45rem', color: 'var(--aurora)', fontFamily: 'var(--font-display)', textShadow: '0 0 10px rgba(0, 180, 216, 0.4)' }}>
                                {formats.format(totals.finalTotal)}
                              </strong>
                            </div>
                          </div>

                          {paymentMethod === 'credito' && (
                            <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, marginTop: '4px' }}>
                              ⚡ {installments === 0 ? '1 cuota de ' : `${installments} cuotas de `} 
                              <span style={{ color: 'white' }}>
                                {formats.format(totals.finalTotal / (installments === 0 ? 1 : installments))}
                              </span> sin interés.
                            </div>
                          )}

                          {totals.finalTotal === 0 ? (
                            // BECA 100%: Inscripción gratuita directa sin pasarela de pago
                            <div style={{ marginTop: '20px' }}>
                              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '14px', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.3rem' }}>🎓</span>
                                <p style={{ color: '#10B981', fontSize: '0.82rem', fontWeight: 800, margin: '4px 0 2px 0' }}>¡Beca Completa Aplicada!</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: 0 }}>Tu membresía está 100% cubierta. No se requiere pago.</p>
                              </div>
                              <button
                                onClick={handleProcessPayment}
                                disabled={isProcessing}
                                className="auth-btn"
                                style={{
                                  width: '100%',
                                  height: '46px',
                                  background: isProcessing ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10B981, #34D399)',
                                  color: isProcessing ? 'var(--text-muted)' : '#060B18',
                                  fontWeight: 900,
                                  fontSize: '0.9rem',
                                  letterSpacing: '1.5px',
                                  boxShadow: isProcessing ? 'none' : '0 0 15px rgba(16, 185, 129, 0.4)',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                                  marginRight: 0,
                                  marginLeft: 0
                                }}
                              >
                                {isProcessing ? 'Activando Membresía...' : 'Activar Membresía Gratuita 🎓'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                setShowCheckoutModal(true);
                              }}
                              className="auth-btn"
                              style={{
                                width: '100%',
                                height: '46px',
                                background: 'linear-gradient(135deg, var(--aurora), #10B981)',
                                color: '#060B18',
                                fontWeight: 900,
                                fontSize: '0.9rem',
                                letterSpacing: '1.5px',
                                marginTop: '20px',
                                boxShadow: '0 0 15px rgba(0, 180, 216, 0.3)',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                marginRight: 0,
                                marginLeft: 0
                              }}
                            >
                              Proceder al Pago
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '10px 0' }}>
                          <p style={{ color: '#FF6B6B', fontSize: '0.85rem', fontWeight: 700, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            ⚠️ Ningún miembro o titular habilitado para el pago
                          </p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.4, margin: '0 0 18px 0' }}>
                            Para poder concretar tu pago, activa el interruptor al lado de tu nombre ("A mí mismo") o de tus familiares en la sección "1. Asignar Disciplinas".
                          </p>
                          <button
                            disabled={true}
                            className="auth-btn"
                            style={{
                              width: '100%',
                              height: '46px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              color: 'var(--text-muted)',
                              fontWeight: 900,
                              fontSize: '0.9rem',
                              letterSpacing: '1.5px',
                              cursor: 'not-allowed',
                              borderRadius: '8px',
                              margin: 0
                            }}
                          >
                            Selecciona un Miembro o a Ti Mismo
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Ficha de Salud - Inteligente por Edad */}
        {profile?.age && (
          <a 
            href={profile.age >= 18 
              ? "https://docs.google.com/forms/d/e/1FAIpQLSdopTSPEEUyUgIFDFuqEaFH57u310TQaYV-XVnegiJsg3VyUA/viewform?pli=1" 
              : "https://docs.google.com/forms/d/e/1FAIpQLSdopTSPEEUyUgIFDFuqEaFH57u310TQaYV-XVnegiJsg3VyUA/viewform?pli=1&entry.12345=MenorDeEdad" /* Se simula el formulario infantil */
            } 
            target="_blank" 
            rel="noreferrer" 
            style={{textDecoration:'none'}}
          >
            <div className="mp-card" style={{marginTop:'25px', marginBottom:'25px', background: 'linear-gradient(135deg, rgba(10, 17, 40, 0.8), rgba(6, 11, 24, 0.9))', border: '1px solid var(--border-glass)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', textAlign: 'left', padding: '20px', display:'flex', alignItems:'center', gap: '18px'}}>
              <div style={{fontSize: '2.5rem', filter: 'drop-shadow(0 4px 10px rgba(52, 211, 153, 0.3))'}}>🏥</div>
              <div>
                <h3 style={{fontFamily:'var(--font-display)', fontSize:'1.15rem', fontWeight:800, color:'var(--text-white)', marginBottom:'4px', marginTop:0}}>
                  {profile.age >= 18 ? "Ficha de Salud Obligatoria (Adulto)" : "Ficha de Salud Obligatoria (Menores de Edad)"}
                </h3>
                <p style={{fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.4, margin:0}}>
                  {profile.age >= 18 
                    ? "Completar para mantener un registro médico de adulto y entrenar seguros." 
                    : "Debe ser completada por tu apoderado para menores de 18 años."
                  }
                </p>
              </div>
            </div>
          </a>
        )}

        {/* Administración del Tatami (Grid de cajas como botones) */}
        {profile?.role === 'admin' && (
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px' }}>
            <h3 className="settings-title" style={{ marginBottom: '18px' }}>🔑 Administración del Tatami</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              
              <button 
                onClick={() => navigate('/admin/schedule')}
                className="glass-panel" 
                style={{ 
                  padding: '20px 15px', 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  border: '1px solid rgba(59, 130, 246, 0.2)', 
                  background: 'rgba(59, 130, 246, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  borderRadius: '12px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <Calendar size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>Horarios</div>
              </button>

              <button 
                onClick={() => navigate('/admin/teachers')}
                className="glass-panel" 
                style={{ 
                  padding: '20px 15px', 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  border: '1px solid rgba(245, 158, 11, 0.2)', 
                  background: 'rgba(245, 158, 11, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  borderRadius: '12px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <Users size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>Staff/Profesores</div>
              </button>

              <button 
                className="glass-panel" 
                onClick={() => alert("Función Escanear QR en desarrollo.")}
                style={{ 
                  padding: '20px 15px', 
                  textAlign: 'center', 
                  cursor: 'pointer',
                  border: '1px solid rgba(52, 211, 153, 0.2)',
                  background: 'rgba(52, 211, 153, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  borderRadius: '12px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <QrCode size={28} color="var(--aurora)" style={{ marginBottom: '8px' }} />
                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>Escanear QR</div>
              </button>

              <button 
                className="glass-panel" 
                onClick={() => navigate('/admin')}
                style={{ 
                  padding: '20px 15px', 
                  textAlign: 'center', 
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.01)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  borderRadius: '12px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <Settings size={28} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>Ajustes</div>
              </button>

            </div>
          </div>
        )}



        {/* CHECKOUT MODAL / OVERLAY */}
        {showCheckoutModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(6, 11, 24, 0.95)',
            backdropFilter: 'blur(15px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '30px', border: '1px solid var(--border-glass)', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
              
              {!paymentSuccess ? (
                <div>
                  <CreditCard size={48} color="var(--aurora)" style={{ margin: '0 auto 15px' }} />
                  <h3 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.3rem', marginBottom: '8px' }}>
                    Pasarela de Pago Segura
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '22px' }}>
                    Estás a un paso de renovar el entrenamiento. La transacción se procesará a través de Mercado Pago.
                  </p>

                  {(() => {
                    const totals = calculateTotal();
                    return (
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', textAlign: 'left', marginBottom: '25px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Monto a Transferir</div>
                        <div style={{ fontSize: '1.4rem', color: 'white', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: '4px' }}>
                          {formats.format(totals.finalTotal)}
                        </div>
                        
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginTop: '12px' }}>Titular del Pago</div>
                        <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: 700, marginTop: '2px' }}>
                          {profile?.name}
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginTop: '12px' }}>Método de Selección</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--aurora)', fontWeight: 800, textTransform: 'uppercase', marginTop: '2px' }}>
                          {paymentMethod === 'debito' ? '💳 Débito' : `💳 Crédito (${installments === 0 ? '1 pago' : `${installments} cuotas sin interés`})`}
                        </div>
                      </div>
                    );
                  })()}

                  {isProcessing ? (
                    <div style={{ padding: '10px 0' }}>
                      <div className="spinner" style={{
                        width: '32px',
                        height: '32px',
                        border: '3px solid rgba(255,255,255,0.05)',
                        borderTopColor: 'var(--aurora)',
                        borderRadius: '50%',
                        margin: '0 auto 15px',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <p style={{ color: 'white', fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Procesando con la entidad bancaria...</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '4px' }}>No cierres ni recargues esta pestaña</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button
                        onClick={handleProcessPayment}
                        className="auth-btn"
                        style={{
                          width: '100%',
                          height: '42px',
                          background: 'linear-gradient(135deg, var(--aurora), #10B981)',
                          color: '#060B18',
                          fontWeight: 900,
                          fontSize: '0.82rem',
                          letterSpacing: '1px',
                          margin: 0
                        }}
                      >
                        Pagar e Inscribir Grupo
                      </button>
                      <button
                        onClick={() => setShowCheckoutModal(false)}
                        className="auth-btn"
                        style={{
                          width: '100%',
                          height: '42px',
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'white',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          margin: 0
                        }}
                      >
                        Cancelar Transacción
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <CheckCircle2 size={56} color="#10B981" style={{ margin: '0 auto 15px', filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.4))' }} />
                  <h3 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.45rem', marginBottom: '8px' }}>
                    ¡PAGO APROBADO!
                  </h3>
                  <p style={{ color: '#34D399', fontSize: '0.85rem', fontWeight: 700, marginBottom: '15px' }}>
                    Membresía renovada con éxito.
                  </p>
                  {(() => {
                    const totals = calculateTotal();
                    return (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '25px', lineHeight: 1.4 }}>
                        Se ha registrado tu pago de <strong style={{ color: 'white' }}>{formats.format(totals.finalTotal)}</strong>. Tu cuenta y las membresías familiares ya se encuentran totalmente activadas. ¡Nos vemos en el tatami!
                      </p>
                    );
                  })()}

                  <button
                    onClick={() => {
                      setShowCheckoutModal(false);
                      setPaymentSuccess(false);
                      setShowPaymentsPanel(false);
                      window.location.reload();
                    }}
                    className="auth-btn"
                    style={{
                      width: '100%',
                      height: '44px',
                      background: 'linear-gradient(135deg, var(--aurora), #10B981)',
                      color: '#060B18',
                      fontWeight: 900,
                      margin: 0
                    }}
                  >
                    Volver al Panel Principal
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div className="danger-zone-card" style={{ marginBottom: '30px' }}>
          <div className="danger-text">
            <h4>Sesión Activa</h4>
            <p>Cierra la sesión para proteger tus datos.</p>
          </div>
          <button 
            onClick={handleLogout} 
            className="icon-btn" 
            style={{ background: 'transparent', borderColor: 'rgba(255, 77, 77, 0.5)', color: '#FF6B6B' }}
          >
            <LogOut size={20} />
          </button>
        </div>

      </div>
    </div>
  );
}
