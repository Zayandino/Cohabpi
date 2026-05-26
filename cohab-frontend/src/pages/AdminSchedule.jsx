import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Calendar, HelpCircle, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const parseDaysText = (daysText) => {
  const text = (daysText || '').toLowerCase();
  const selected = [];
  
  if (text.includes('lunes a viernes') || text.includes('lun a vie') || text.includes('lunes a vie') || text.includes('lun a viernes')) {
    return ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'];
  }
  if (text.includes('lunes a sabado') || text.includes('lun a sab') || text.includes('lunes a sáb') || text.includes('lunes a sab')) {
    return ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
  }
  
  if (text.includes('lun') || text.includes('lunes')) selected.push('LUN');
  if (text.includes('mar') || text.includes('martes')) selected.push('MAR');
  if (text.includes('mie') || text.includes('mié') || text.includes('miercoles') || text.includes('miércoles')) selected.push('MIE');
  if (text.includes('jue') || text.includes('juev') || text.includes('jueves')) selected.push('JUE');
  if (text.includes('vie') || text.includes('viernes')) selected.push('VIE');
  if (text.includes('sab') || text.includes('sáb') || text.includes('sabado') || text.includes('sábado') || text.includes('sábados')) selected.push('SAB');
  if (text.includes('dom') || text.includes('domingo') || text.includes('domingos')) selected.push('DOM');
  
  return selected;
};

const serializeDays = (daysArray) => {
  if (!daysArray || daysArray.length === 0) return '';
  
  const isLunToVie = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'].every(d => daysArray.includes(d)) && daysArray.length === 5;
  if (isLunToVie) return 'LUN a VIE';
  
  const isLunToSab = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].every(d => daysArray.includes(d)) && daysArray.length === 6;
  if (isLunToSab) return 'LUN a SÁB';
  
  const order = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
  const sorted = [...daysArray].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  
  return sorted.join('-');
};

export default function AdminSchedule() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form States
  const [name, setName] = useState('');
  
  // Editing Mode States
  const [editingServiceId, setEditingServiceId] = useState(null);

  const parseScheduleText = (scheduleText) => {
    if (!scheduleText) return [{ days: 'Lunes a Viernes', start: '20:00', end: '21:30' }];
    try {
      const blocks = scheduleText.split(' | ');
      return blocks.map(block => {
        // Formato: "Lunes a Viernes de 20:00 a 21:30 hrs"
        const match = block.match(/^(.*?) de (\d{2}:\d{2}) a (\d{2}:\d{2}) hrs$/);
        if (match) {
          return { days: match[1], start: match[2], end: match[3] };
        }
        return { days: block, start: '20:00', end: '21:30' };
      });
    } catch (e) {
      console.error("Error parsing schedule:", e);
      return [{ days: 'Lunes a Viernes', start: '20:00', end: '21:30' }];
    }
  };

  const handleEditClick = (service) => {
    setEditingServiceId(service.id);
    setName(service.name);
    
    // Parse schedules
    setScheduleBlocks(parseScheduleText(service.schedule));
    
    // Parse capacity
    if (service.capacity_limit > 0) {
      setCapacityType('limited');
      setCapacityLimit(service.capacity_limit.toString());
    } else {
      setCapacityType('unlimited');
      setCapacityLimit('12');
    }
    
    // Parse pricing
    if (service.pricing_tiers && service.pricing_tiers.length > 0) {
      setPricingType('tiered');
      setPricingTiers(service.pricing_tiers.map(t => {
        const classesMatch = t.name ? t.name.match(/^(\d+)/) : null;
        return {
          classesPerWeek: classesMatch ? parseInt(classesMatch[1]) : 3,
          price: t.price.toString()
        };
      }));
      setFlatPrice('45000');
    } else {
      setPricingType('flat');
      setFlatPrice(service.price ? service.price.toString() : '45000');
      setPricingTiers([
        { classesPerWeek: 5, price: '45000' },
        { classesPerWeek: 4, price: '40000' },
        { classesPerWeek: 3, price: '35000' }
      ]);
    }
    
    setRequiresAttendance(service.requires_attendance || false);
    setShowAddForm(true);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelForm = () => {
    setName('');
    setScheduleBlocks([{ days: 'Lunes a Viernes', start: '20:00', end: '21:30' }]);
    setCapacityType('unlimited');
    setCapacityLimit('12');
    setPricingType('flat');
    setFlatPrice('45000');
    setPricingTiers([
      { classesPerWeek: 5, price: '45000' },
      { classesPerWeek: 4, price: '40000' },
      { classesPerWeek: 3, price: '35000' }
    ]);
    setRequiresAttendance(false);
    setEditingServiceId(null);
    setShowAddForm(false);
  };
  
  // Dynamic Schedule Blocks
  const [scheduleBlocks, setScheduleBlocks] = useState([
    { days: 'Lunes a Viernes', start: '20:00', end: '21:30' }
  ]);

  // Capacity Limits
  const [capacityType, setCapacityType] = useState('unlimited'); // 'unlimited' or 'limited'
  const [capacityLimit, setCapacityLimit] = useState('12');

  // Pricing Model
  const [pricingType, setPricingType] = useState('flat'); // 'flat' or 'tiered'
  const [flatPrice, setFlatPrice] = useState('45000');
  const [pricingTiers, setPricingTiers] = useState([
    { classesPerWeek: 5, price: '45000' },
    { classesPerWeek: 4, price: '40000' },
    { classesPerWeek: 3, price: '35000' }
  ]);

  const [requiresAttendance, setRequiresAttendance] = useState(false);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('cohab_services')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error("Error fetching services/schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Handlers for Schedule Blocks
  const handleAddBlock = () => {
    setScheduleBlocks([...scheduleBlocks, { days: 'Sábados', start: '11:30', end: '12:30' }]);
  };

  const handleRemoveBlock = (index) => {
    if (scheduleBlocks.length === 1) return;
    setScheduleBlocks(scheduleBlocks.filter((_, idx) => idx !== index));
  };

  const handleBlockChange = (index, field, value) => {
    const updated = scheduleBlocks.map((block, idx) => {
      if (idx === index) {
        return { ...block, [field]: value };
      }
      return block;
    });
    setScheduleBlocks(updated);
  };

  // Handlers for Pricing Tiers
  const handleAddTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const newClasses = lastTier ? Math.max(1, lastTier.classesPerWeek - 1) : 3;
    const newPrice = lastTier ? Math.max(0, parseInt(lastTier.price) - 5000).toString() : '35000';
    setPricingTiers([...pricingTiers, { classesPerWeek: newClasses, price: newPrice }]);
  };

  const handleRemoveTier = (index) => {
    if (pricingTiers.length === 1) return;
    setPricingTiers(pricingTiers.filter((_, idx) => idx !== index));
  };

  const handleTierChange = (index, field, value) => {
    const updated = pricingTiers.map((tier, idx) => {
      if (idx === index) {
        return { ...tier, [field]: value };
      }
      return tier;
    });
    setPricingTiers(updated);
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // 1. Consolida los bloques horariales en un texto legible
    const consolidatedSchedule = scheduleBlocks
      .map(b => `${b.days} de ${b.start} a ${b.end} hrs`)
      .join(' | ');

    // 2. Determina el precio base y los tiers finales
    let finalPrice = 0;
    let finalTiers = [];

    if (pricingType === 'flat') {
      finalPrice = parseFloat(flatPrice) || 0;
    } else {
      // Guardar pricing tiers ordenados por clases de forma descendente
      const sortedTiers = [...pricingTiers]
        .map(t => ({ name: `${t.classesPerWeek} clases semanales`, price: parseFloat(t.price) || 0 }))
        .sort((a, b) => b.price - a.price);

      finalPrice = sortedTiers[0]?.price || 0; // Precio base es el del tier mayor
      finalTiers = sortedTiers;
    }

    // 3. Cupos
    const finalCapacity = capacityType === 'unlimited' ? 0 : parseInt(capacityLimit) || 0;

    try {
      const payload = {
        name,
        price: finalPrice,
        schedule: consolidatedSchedule,
        capacity_limit: finalCapacity,
        requires_attendance: requiresAttendance,
        pricing_tiers: finalTiers
      };

      let error;
      if (editingServiceId) {
        const res = await supabase
          .from('cohab_services')
          .update(payload)
          .eq('id', editingServiceId);
        error = res.error;
      } else {
        const res = await supabase
          .from('cohab_services')
          .insert([payload]);
        error = res.error;
      }

      if (error) throw error;

      // Reset Form
      setName('');
      setScheduleBlocks([{ days: 'Lunes a Viernes', start: '20:00', end: '21:30' }]);
      setCapacityType('unlimited');
      setCapacityLimit('12');
      setPricingType('flat');
      setFlatPrice('45000');
      setPricingTiers([
        { classesPerWeek: 5, price: '45000' },
        { classesPerWeek: 4, price: '40000' },
        { classesPerWeek: 3, price: '35000' }
      ]);
      setRequiresAttendance(false);
      setEditingServiceId(null);
      setShowAddForm(false);
      
      fetchServices();
    } catch (err) {
      console.error("Error saving service:", err);
      alert("Error al guardar disciplina.");
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta disciplina y todos sus horarios?")) return;

    try {
      const { error } = await supabase
        .from('cohab_services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchServices();
    } catch (err) {
      console.error("Error deleting service:", err);
      alert("Error al eliminar la disciplina.");
    }
  };

  const handleToggleActive = async (service) => {
    const nextActiveState = service.is_active === false ? true : false;
    try {
      const { error } = await supabase
        .from('cohab_services')
        .update({ is_active: nextActiveState })
        .eq('id', service.id);

      if (error) throw error;
      fetchServices();
    } catch (err) {
      console.error("Error toggling active state:", err);
      alert("Error al cambiar el estado de la disciplina.");
    }
  };

  return (
    <div>
      <div className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/profile')} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="top-bar-title">Horarios Academia</div>
        <button 
          className="icon-btn" 
          onClick={() => {
            if (showAddForm) {
              handleCancelForm();
            } else {
              setEditingServiceId(null);
              setShowAddForm(true);
            }
          }} 
          aria-label="Añadir"
        >
          <Plus size={20} style={{ transform: showAddForm && !editingServiceId ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s' }} />
        </button>
      </div>

      <div className="content" style={{ paddingTop: '20px', paddingBottom: '40px' }}>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Configura y administra los horarios y el esquema de precios de tus disciplinas oficiales en Cohab Los Andes.
        </p>

        {showAddForm && (
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', border: '1px solid var(--border-glass)' }}>
            <h4 style={{ color: 'white', margin: '0 0 18px 0', fontFamily: 'var(--font-display)', fontSize: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
              {editingServiceId ? `✏️ Editar Actividad: ${name}` : '🔧 Configurar Nueva Actividad'}
            </h4>
            
            <form onSubmit={handleAddService}>
              
              {/* 1. Nombre */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Nombre de la Disciplina</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="ej: BJJ General, Funcional, Infantil..."
                  required 
                />
              </div>

              {/* 2. Horarios Dinámicos */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>⏰ Horarios y Bloques</label>
                  <button 
                    type="button" 
                    onClick={handleAddBlock}
                    style={{ background: 'rgba(52, 211, 153, 0.1)', color: 'var(--aurora)', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    + Agregar Bloque
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {scheduleBlocks.map((block, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        background: 'rgba(255,255,255,0.01)', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        padding: '10px', 
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {[
                              { key: 'LUN', label: 'Lun' },
                              { key: 'MAR', label: 'Mar' },
                              { key: 'MIE', label: 'Mié' },
                              { key: 'JUE', label: 'Jue' },
                              { key: 'VIE', label: 'Vie' },
                              { key: 'SAB', label: 'Sáb' },
                              { key: 'DOM', label: 'Dom' }
                            ].map(day => {
                              const selectedDays = parseDaysText(block.days);
                              const isSelected = selectedDays.includes(day.key);
                              return (
                                <button
                                  key={day.key}
                                  type="button"
                                  onClick={() => {
                                    let updatedDays;
                                    if (isSelected) {
                                      updatedDays = selectedDays.filter(d => d !== day.key);
                                    } else {
                                      updatedDays = [...selectedDays, day.key];
                                    }
                                    const serialized = serializeDays(updatedDays);
                                    handleBlockChange(idx, 'days', serialized);
                                  }}
                                  style={{
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 8px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: isSelected 
                                      ? 'linear-gradient(135deg, var(--aurora) 0%, #10b981 100%)' 
                                      : 'rgba(255, 255, 255, 0.03)',
                                    color: isSelected ? 'white' : 'var(--text-muted)',
                                    border: isSelected ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                                    boxShadow: isSelected ? '0 2px 8px rgba(16, 185, 129, 0.2)' : 'none',
                                    minWidth: '38px',
                                    textAlign: 'center'
                                  }}
                                >
                                  {day.label}
                                </button>
                              );
                            })}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--aurora)', fontWeight: 600, marginTop: '2px', display: 'block' }}>
                            Seleccionado: {block.days || 'Sin especificar'}
                          </span>
                        </div>
                        {scheduleBlocks.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveBlock(idx)}
                            style={{ 
                              background: 'rgba(255,77,77,0.1)', 
                              color: '#FF6B6B', 
                              border: 'none', 
                              borderRadius: '6px', 
                              width: '36px', 
                              height: '36px', 
                              cursor: 'pointer', 
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>De:</span>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ flex: 1, fontSize: '0.85rem', height: '36px', textAlign: 'center' }}
                          value={block.start} 
                          onChange={e => handleBlockChange(idx, 'start', e.target.value)} 
                          placeholder="20:00"
                          required
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A:</span>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ flex: 1, fontSize: '0.85rem', height: '36px', textAlign: 'center' }}
                          value={block.end} 
                          onChange={e => handleBlockChange(idx, 'end', e.target.value)} 
                          placeholder="21:30"
                          required
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>hrs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Cupos Dinámicos */}
              <div style={{ marginBottom: '18px' }}>
                <label className="form-label">👥 Disponibilidad y Cupos</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => setCapacityType('unlimited')}
                    style={{
                      flex: 1,
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: capacityType === 'unlimited' ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                      background: capacityType === 'unlimited' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255,255,255,0.01)',
                      color: capacityType === 'unlimited' ? 'white' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cupos Libres
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setCapacityType('limited')}
                    style={{
                      flex: 1,
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: capacityType === 'limited' ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                      background: capacityType === 'limited' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255,255,255,0.01)',
                      color: capacityType === 'limited' ? 'white' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cupos Limitados
                  </button>
                </div>

                {capacityType === 'limited' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Límite de alumnos:</span>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ width: '100px', height: '36px', textAlign: 'center' }}
                      value={capacityLimit} 
                      onChange={e => setCapacityLimit(e.target.value)} 
                      required 
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>alumnos por tatami</span>
                  </div>
                )}
              </div>

              {/* 4. Modelo de Precios Dinámico */}
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">💰 Modelo de Tarifas</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => setPricingType('flat')}
                    style={{
                      flex: 1,
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: pricingType === 'flat' ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                      background: pricingType === 'flat' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255,255,255,0.01)',
                      color: pricingType === 'flat' ? 'white' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Tarifa Fija Mensual
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setPricingType('tiered')}
                    style={{
                      flex: 1,
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: pricingType === 'tiered' ? 'var(--aurora)' : 'rgba(255,255,255,0.05)',
                      background: pricingType === 'tiered' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255,255,255,0.01)',
                      color: pricingType === 'tiered' ? 'white' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Escalonado (x Clases)
                  </button>
                </div>

                {pricingType === 'flat' ? (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Valor Mensual (CLP)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={flatPrice} 
                      onChange={e => setFlatPrice(e.target.value)} 
                      placeholder="ej: 45000"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600 }}>Niveles de Clases Semanales</span>
                      <button 
                        type="button" 
                        onClick={handleAddTier}
                        style={{ background: 'rgba(52, 211, 153, 0.1)', color: 'var(--aurora)', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                      >
                        + Agregar Nivel
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pricingTiers.map((tier, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            background: 'rgba(255,255,255,0.01)', 
                            border: '1px solid rgba(255,255,255,0.05)', 
                            padding: '8px', 
                            borderRadius: '8px' 
                          }}
                        >
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ width: '60px', height: '34px', textAlign: 'center', fontSize: '0.85rem' }}
                            value={tier.classesPerWeek} 
                            onChange={e => handleTierChange(idx, 'classesPerWeek', e.target.value)} 
                            placeholder="5"
                            required
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>clases x sem. =</span>
                          <span style={{ fontSize: '0.8rem', color: 'white' }}>$</span>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ width: '110px', height: '34px', fontSize: '0.85rem' }}
                            value={tier.price} 
                            onChange={e => handleTierChange(idx, 'price', e.target.value)} 
                            placeholder="45000"
                            required
                          />
                          {pricingTiers.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => handleRemoveTier(idx)}
                              style={{ background: 'transparent', color: '#FF6B6B', border: 'none', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800, width: '24px' }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Asistencia */}
              <div className="form-group" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="req-attendance"
                  checked={requiresAttendance} 
                  onChange={e => setRequiresAttendance(e.target.checked)}
                />
                <label htmlFor="req-attendance" style={{ color: 'white', fontSize: '0.85rem', cursor: 'pointer' }}>
                  Requiere registro de asistencia obligatorio
                </label>
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button 
                  type="submit" 
                  className="auth-btn" 
                  style={{ 
                    flex: 1, 
                    minHeight: '46px', 
                    height: 'auto', 
                    background: 'linear-gradient(135deg, var(--aurora), #10B981)', 
                    color: '#060B18', 
                    fontWeight: 900, 
                    cursor: 'pointer', 
                    border: 'none', 
                    borderRadius: '8px', 
                    boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 10px',
                    lineHeight: '1.2',
                    letterSpacing: '1px',
                    margin: 0,
                    textTransform: 'uppercase'
                  }}
                >
                  {editingServiceId ? 'Guardar Cambios' : 'Crear Horario'}
                </button>
                <button 
                  type="button" 
                  className="auth-btn" 
                  onClick={handleCancelForm} 
                  style={{ 
                    flex: 1, 
                    minHeight: '46px', 
                    height: 'auto', 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid var(--border-glass)', 
                    color: 'white', 
                    cursor: 'pointer', 
                    borderRadius: '8px',
                    boxShadow: '0 0 10px rgba(255, 255, 255, 0.05)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 10px',
                    lineHeight: '1.2',
                    letterSpacing: '1px',
                    margin: 0,
                    textTransform: 'uppercase'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Cargando horarios...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {services.map(s => {
              const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
              
              // Verificar si el horario tiene bloques (separados por |)
              const scheduleBlocksList = s.schedule ? s.schedule.split(' | ') : [];

              // Verificar si tiene tiers de precios
              const hasTiers = s.pricing_tiers && s.pricing_tiers.length > 0;

              return (
                <div key={s.id} className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '3px solid var(--aurora)' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.15rem', margin: 0 }}>
                          {s.name}
                        </h3>
                        <span style={{
                          fontSize: '0.65rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: s.is_active !== false ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: s.is_active !== false ? 'var(--aurora)' : '#FF6B6B',
                          border: s.is_active !== false ? '1px solid rgba(52, 211, 153, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                          {s.is_active !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--aurora)', fontWeight: 800, fontSize: '0.85rem', marginTop: '4px' }}>
                        {hasTiers 
                          ? `Desde ${formats.format(s.pricing_tiers[s.pricing_tiers.length - 1].price)} / mes`
                          : `${formats.format(s.price)} / mes`
                        }
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleToggleActive(s)}
                        className="icon-btn" 
                        style={{ 
                          width: '32px', 
                          height: '32px', 
                          background: s.is_active !== false ? 'rgba(239, 68, 68, 0.1)' : 'rgba(52, 211, 153, 0.1)', 
                          color: s.is_active !== false ? '#FF6B6B' : 'var(--aurora)', 
                          borderColor: s.is_active !== false ? 'rgba(239, 68, 68, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title={s.is_active !== false ? "Desactivar disciplina" : "Activar disciplina"}
                      >
                        {s.is_active !== false ? '⏸️' : '▶️'}
                      </button>
                      <button 
                        onClick={() => handleEditClick(s)}
                        className="icon-btn" 
                        style={{ width: '32px', height: '32px', background: 'rgba(59,130,246,0.1)', color: '#60A5FA', borderColor: 'rgba(59,130,246,0.3)' }}
                        title="Editar disciplina"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteService(s.id)}
                        className="icon-btn" 
                        style={{ width: '32px', height: '32px', background: 'rgba(255,77,77,0.1)', color: '#FF6B6B', borderColor: 'rgba(255,77,77,0.3)' }}
                        title="Eliminar disciplina"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      ⏰ Horario
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {scheduleBlocksList.map((block, idx) => (
                        <div key={idx} style={{ fontSize: '0.8rem', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🥋</span> {block}
                        </div>
                      ))}
                      {scheduleBlocksList.length === 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No definido</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div>
                      👥 <b>Cupos:</b> {s.capacity_limit > 0 ? `${s.capacity_limit} alumnos (LDO)` : 'Libres (ILDO)'}
                    </div>
                    <div>
                      📍 <b>Asistencia:</b> {s.requires_attendance ? 'Obligatoria' : 'Opcional'}
                    </div>
                  </div>

                  {hasTiers && (
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                      <strong style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '5px', display: 'block', textTransform: 'uppercase' }}>
                        Tarifas Escalonadas Semanales:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '0.8rem', color: 'var(--aurora)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {s.pricing_tiers.map((tier, idx) => (
                          <li key={idx}>
                            <span style={{ color: 'white' }}>{tier.name || `${tier.classesPerWeek} clases`}:</span> {formats.format(tier.price)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              );
            })}

            {/* Fallback si no hay planes/horarios registrados en la base de datos */}
            {services.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                No hay disciplinas ni horarios oficiales registrados. ¡Crea el primero usando el botón superior derecho!
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
