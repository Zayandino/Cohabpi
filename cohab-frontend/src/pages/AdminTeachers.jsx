import { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Trash2, Edit2, Save, X, Award, Shield, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AdminTeachers() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form States (agregar nuevo / promover)
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [staffTitle, setStaffTitle] = useState('Instructor');
  const [staffOrder, setStaffOrder] = useState(1);
  const [assignedRole, setAssignedRole] = useState('teacher');

  // Inline Edit States
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOrder, setEditOrder] = useState(1);
  const [editRole, setEditRole] = useState('teacher');
  const [updatingId, setUpdatingId] = useState(null);

  // Mapeo canónico de cinturones
  const getBeltLabel = (b, graus = 0) => {
    const val = (b || '').toLowerCase();
    let name = 'Cinturón Blanco';
    if (val.includes('black') || val.includes('negro')) name = 'Cinturón Negro';
    else if (val.includes('brown') || val.includes('marrón') || val.includes('marron') || val.includes('cafe')) name = 'Cinturón Café / Marrón';
    else if (val.includes('purple') || val.includes('morado')) name = 'Cinturón Morado';
    else if (val.includes('blue') || val.includes('azul')) name = 'Cinturón Azul';
    
    return graus > 0 ? `${name} (${graus} ${graus === 1 ? 'Grau' : 'Graus'})` : name;
  };

  const getBeltColor = (b) => {
    const val = (b || '').toLowerCase();
    if (val.includes('black') || val.includes('negro')) return '#000000';
    if (val.includes('brown') || val.includes('marrón') || val.includes('marron') || val.includes('cafe')) return '#8B4513';
    if (val.includes('purple') || val.includes('morado')) return '#800080';
    if (val.includes('blue') || val.includes('azul')) return '#2563EB';
    return '#E5E7EB';
  };

  // Sugiere automáticamente la maestría según el cinturón y los graus
  const getSuggestedMastery = (belt, graus = 0) => {
    const val = (belt || '').toLowerCase();
    const g = parseInt(graus) || 0;
    if (val.includes('black') || val.includes('negro')) {
      return g >= 3 ? 'Maestro' : 'Profesor';
    }
    if (val.includes('brown') || val.includes('marrón') || val.includes('marron') || val.includes('cafe')) {
      return 'Instructor';
    }
    if (val.includes('purple') || val.includes('morado')) {
      return 'Monitor';
    }
    return 'Instructor';
  };

  // Cargar Staff actual
  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('cohab_profiles')
        .select('id, name, email, belt, graus, role, is_instructor, staff_title, staff_order')
        .or('is_instructor.eq.true,role.in.(admin,teacher,instructor,monitor)')
        .not('name', 'is', null)
        .neq('name', '')
        .order('staff_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });
        
      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      console.error("Error fetching teachers:", err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar exclusivamente alumnos con cinturón Morado, Café/Marrón y Negro
  const fetchEligibleStudents = async () => {
    try {
      setLoadingStudents(true);
      const { data, error } = await supabase
        .from('cohab_profiles')
        .select('id, name, email, belt, graus, role, is_instructor, staff_title')
        .in('belt', ['purple', 'brown', 'black', 'morado', 'marron', 'cafe', 'negro'])
        .not('name', 'is', null)
        .neq('name', '')
        .order('name', { ascending: true });
        
      if (error) throw error;
      setEligibleStudents(data || []);
    } catch (err) {
      console.error("Error fetching eligible students:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchEligibleStudents();
  }, []);

  // Al seleccionar un alumno en el formulario, pre-configurar su maestría correspondiente
  const handleSelectStudent = (studentId) => {
    setSelectedStudentId(studentId);
    if (!studentId) return;

    const student = eligibleStudents.find(s => s.id === studentId);
    if (student) {
      const suggested = getSuggestedMastery(student.belt, student.graus);
      setStaffTitle(student.staff_title || suggested);
      
      if (suggested === 'Maestro' || suggested === 'Profesor') {
        setAssignedRole('teacher');
      } else if (suggested === 'Instructor') {
        setAssignedRole('instructor');
      } else {
        setAssignedRole('monitor');
      }
    }
  };

  const handleStartEdit = (t) => {
    setEditingId(t.id);
    setEditTitle(t.staff_title || getSuggestedMastery(t.belt, t.graus));
    setEditOrder(t.staff_order || 1);
    setEditRole(t.role || 'teacher');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditOrder(1);
    setEditRole('teacher');
  };

  const handleUpdateTeacher = async (id) => {
    try {
      setUpdatingId(id);
      const { error } = await supabase
        .from('cohab_profiles')
        .update({ 
          staff_title: editTitle,
          staff_order: parseInt(editOrder) || 1,
          role: editRole,
          is_instructor: true
        })
        .eq('id', id);

      if (error) throw error;

      setTeachers(prev => prev.map(t => 
        t.id === id ? { ...t, staff_title: editTitle, staff_order: parseInt(editOrder) || 1, role: editRole } : t
      ));
      setEditingId(null);
    } catch (err) {
      console.error("Error updating teacher:", err);
      alert("Error al actualizar información del staff.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert("Por favor selecciona un alumno graduado para asignar al Staff.");
      return;
    }

    try {
      const { error } = await supabase
        .from('cohab_profiles')
        .update({
          is_instructor: true,
          staff_title: staffTitle,
          staff_order: parseInt(staffOrder) || 1,
          role: assignedRole
        })
        .eq('id', selectedStudentId);

      if (error) throw error;
      
      setSelectedStudentId('');
      setStaffTitle('Instructor');
      setStaffOrder(1);
      setShowAddForm(false);
      fetchTeachers();
      fetchEligibleStudents();
    } catch (err) {
      console.error("Error promoting student to staff:", err);
      alert("Error al asignar alumno al staff.");
    }
  };

  const handleDeleteTeacher = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de que deseas desvincular a ${name} del staff de instrucción? Su cuenta de alumno permanecerá intacta.`)) return;

    try {
      const { error } = await supabase
        .from('cohab_profiles')
        .update({
          is_instructor: false,
          staff_title: null,
          role: 'student'
        })
        .eq('id', id);

      if (error) throw error;
      fetchTeachers();
      fetchEligibleStudents();
    } catch (err) {
      console.error("Error removing teacher from staff:", err);
      alert("Error al quitar instructor del staff.");
    }
  };

  // Filtrar de la lista de selección los alumnos que ya están activos en staff
  const unassignedStudents = eligibleStudents.filter(
    s => !teachers.some(t => t.id === s.id)
  );

  return (
    <div>
      <div className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/profile')} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="top-bar-title">Staff & Maestría Técnica</div>
        <button className="icon-btn" onClick={() => setShowAddForm(!showAddForm)} aria-label="Añadir Staff">
          <UserPlus size={20} />
        </button>
      </div>

      <div className="content" style={{ paddingTop: '20px', paddingBottom: '40px' }}>
        
        {/* Banner Explicativo de Regla Técnica BJJ */}
        <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', borderLeft: '4px solid var(--aurora)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Award size={18} color="var(--aurora)" />
            <h4 style={{ margin: 0, color: 'white', fontSize: '0.9rem', fontWeight: 800 }}>Normativa Técnica de Graduación</h4>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, lineHeight: '1.4' }}>
            Solo alumnos graduados con cinturones <strong style={{ color: '#C084FC' }}>Morado</strong>, <strong style={{ color: '#D97706' }}>Café / Marrón</strong> y <strong style={{ color: '#FFFFFF' }}>Negro</strong> pueden ser asignados al Staff y dirigir clases con código QR.
          </p>
        </div>

        {/* Formulario para asignar nuevo miembro al Staff */}
        {showAddForm && (
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ color: 'white', margin: 0, fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800 }}>
                Asignar Alumno Graduado a Staff
              </h4>
              <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTeacher}>
              {/* Selector de alumno graduado */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                  Selecciona Alumno Graduado (Morado, Café o Negro)
                </label>
                {loadingStudents ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '5px 0' }}>Buscando graduados...</p>
                ) : unassignedStudents.length === 0 ? (
                  <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <p style={{ color: '#EF4444', fontSize: '0.78rem', fontWeight: 800, margin: 0 }}>
                      No hay alumnos graduados pendientes por promover (todos los alumnos morado/café/negro ya son miembros del Staff).
                    </p>
                  </div>
                ) : (
                  <select 
                    className="form-input" 
                    value={selectedStudentId} 
                    onChange={e => handleSelectStudent(e.target.value)}
                    style={{ background: 'var(--bg-elevated)', color: 'white', height: '42px', fontSize: '0.85rem' }}
                    required
                  >
                    <option value="">-- Elige un Alumno Graduado --</option>
                    {unassignedStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {getBeltLabel(s.belt, s.graus)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Título de Maestría / Cargo */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                  Grado y Maestría Asignada
                </label>
                <select 
                  className="form-input" 
                  value={staffTitle} 
                  onChange={e => {
                    const title = e.target.value;
                    setStaffTitle(title);
                    if (title === 'Maestro' || title === 'Profesor' || title === 'Director Técnico') {
                      setAssignedRole('teacher');
                    } else if (title === 'Instructor') {
                      setAssignedRole('instructor');
                    } else {
                      setAssignedRole('monitor');
                    }
                  }}
                  style={{ background: 'var(--bg-elevated)', color: 'white', height: '40px', fontSize: '0.85rem' }}
                >
                  <option value="Profesor">Profesor (Cinturón Negro)</option>
                  <option value="Maestro">Maestro (Cinturón Negro 3+ Graus)</option>
                  <option value="Director Técnico">Director Técnico</option>
                  <option value="Instructor">Instructor (Cinturón Café / Marrón)</option>
                  <option value="Instructor Asistente">Instructor Asistente</option>
                  <option value="Monitor">Monitor (Cinturón Morado)</option>
                </select>
              </div>

              {/* Orden de visualización en la academia */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                  Prioridad / Orden en Horarios (1 = Principal)
                </label>
                <input 
                  type="number"
                  min="1"
                  max="99"
                  className="form-input" 
                  value={staffOrder} 
                  onChange={e => setStaffOrder(e.target.value)}
                  style={{ background: 'var(--bg-elevated)', color: 'white', height: '40px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="submit" 
                  className="auth-btn" 
                  disabled={!selectedStudentId}
                  style={{ 
                    flex: 1, minHeight: '42px', height: 'auto',
                    background: 'linear-gradient(135deg, var(--aurora), #10B981)', 
                    color: '#060B18', fontWeight: 900, cursor: 'pointer', 
                    border: 'none', borderRadius: '8px',
                    boxShadow: selectedStudentId ? '0 0 15px rgba(52, 211, 153, 0.3)' : 'none',
                    fontSize: '0.82rem', margin: 0, textTransform: 'uppercase',
                    opacity: selectedStudentId ? 1 : 0.5
                  }}
                >
                  Confirmar Asignación
                </button>
                <button 
                  type="button" 
                  className="auth-btn" 
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedStudentId('');
                  }} 
                  style={{ 
                    flex: 1, minHeight: '42px', height: 'auto',
                    background: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid var(--border-glass)', color: 'white', 
                    cursor: 'pointer', borderRadius: '8px',
                    fontSize: '0.82rem', margin: 0, textTransform: 'uppercase'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista del Staff Activo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.05rem', margin: 0, fontWeight: 800 }}>
            Cuerpo Docente & Staff ({teachers.length})
          </h3>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Cargando equipo docente de COHAB...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {teachers.map(t => {
              const isEditing = editingId === t.id;
              const isUpdating = updatingId === t.id;
              const beltColor = getBeltColor(t.belt);
              const masteryTitle = t.staff_title || getSuggestedMastery(t.belt, t.graus);

              return (
                <div 
                  key={t.id} 
                  className="glass-panel" 
                  style={{ 
                    padding: '16px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px', 
                    border: '1px solid var(--border-glass)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Fila principal del profesor */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.8rem', border: '1px solid var(--border-glass)', flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}>
                      🥋
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.05rem', margin: 0, fontWeight: 900 }}>
                          {t.name}
                        </h3>
                        {/* Badge de Maestría */}
                        <span style={{ 
                          background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(16, 185, 129, 0.1))',
                          color: 'var(--aurora)',
                          border: '1px solid rgba(52, 211, 153, 0.4)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {masteryTitle}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: beltColor,
                          border: '1px solid rgba(255,255,255,0.3)'
                        }} />
                        <span>{getBeltLabel(t.belt, t.graus)}</span>
                        {t.staff_order && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>• Prioridad: #{t.staff_order}</span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {t.email || 'Sin correo registrado'}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button 
                        onClick={() => isEditing ? handleCancelEdit() : handleStartEdit(t)}
                        className="icon-btn" 
                        style={{ 
                          width: '34px', height: '34px', 
                          background: isEditing ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
                          color: isEditing ? '#EF4444' : '#60A5FA', 
                          borderColor: isEditing ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)' 
                        }}
                        title={isEditing ? 'Cancelar edición' : 'Editar maestría y orden'}
                      >
                        {isEditing ? <X size={15} /> : <Edit2 size={15} />}
                      </button>
                      <button 
                        onClick={() => handleDeleteTeacher(t.id, t.name)}
                        className="icon-btn" 
                        style={{ width: '34px', height: '34px', background: 'rgba(255,77,77,0.1)', color: '#FF6B6B', borderColor: 'rgba(255,77,77,0.3)' }}
                        title="Quitar del Staff"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Panel de edición inline colapsable */}
                  {isEditing && (
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      paddingTop: '12px',
                      display: 'flex', flexDirection: 'column', gap: '10px',
                      animation: 'fadeIn 0.25s ease-out'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>
                            Grado y Maestría
                          </label>
                          <select 
                            className="form-input"
                            value={editTitle}
                            onChange={e => {
                              const title = e.target.value;
                              setEditTitle(title);
                              if (title === 'Maestro' || title === 'Profesor' || title === 'Director Técnico') {
                                setEditRole('teacher');
                              } else if (title === 'Instructor') {
                                setEditRole('instructor');
                              } else {
                                setEditRole('monitor');
                              }
                            }}
                            style={{ background: 'var(--bg-elevated)', color: 'white', height: '36px', fontSize: '0.78rem' }}
                          >
                            <option value="Profesor">Profesor</option>
                            <option value="Maestro">Maestro</option>
                            <option value="Director Técnico">Director Técnico</option>
                            <option value="Instructor">Instructor</option>
                            <option value="Instructor Asistente">Instructor Asistente</option>
                            <option value="Monitor">Monitor</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>
                            Prioridad / Orden
                          </label>
                          <input 
                            type="number"
                            min="1"
                            max="99"
                            className="form-input"
                            value={editOrder}
                            onChange={e => setEditOrder(e.target.value)}
                            style={{ background: 'var(--bg-elevated)', color: 'white', height: '36px', fontSize: '0.78rem' }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => handleUpdateTeacher(t.id)}
                        disabled={isUpdating}
                        className="auth-btn"
                        style={{ 
                          height: '38px', 
                          background: isUpdating ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--aurora), #10B981)',
                          color: isUpdating ? 'var(--text-muted)' : '#060B18',
                          fontWeight: 900, fontSize: '0.8rem', border: 'none',
                          borderRadius: '8px', cursor: isUpdating ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          margin: 0, letterSpacing: '1px'
                        }}
                      >
                        <Save size={14} />
                        {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {teachers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-glass)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 10px 0' }}>
                  No hay miembros asignados al staff aún.
                </p>
                <button 
                  onClick={() => setShowAddForm(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--aurora)', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  + Asignar primer alumno graduado
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
