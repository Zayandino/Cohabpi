import { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, Trash2, Edit2, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AdminTeachers() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form States (agregar nuevo / promover)
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [newRole, setNewRole] = useState('teacher');
  const [newBelt, setNewBelt] = useState('black');

  // Inline Edit States
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editBelt, setEditBelt] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('cohab_profiles')
        .select('*')
        .in('role', ['admin', 'teacher', 'instructor', 'monitor'])
        .order('name', { ascending: true });
        
      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      console.error("Error fetching teachers:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true);
      const { data, error } = await supabase
        .from('cohab_profiles')
        .select('id, name, email')
        .in('role', ['student', 'miembro'])
        .order('name', { ascending: true });
        
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchStudents();
  }, []);

  const handleStartEdit = (t) => {
    setEditingId(t.id);
    setEditRole(t.role || 'teacher');
    setEditBelt(t.belt || 'black');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditRole('');
    setEditBelt('');
  };

  const handleUpdateTeacher = async (id) => {
    try {
      setUpdatingId(id);
      const { error } = await supabase
        .from('cohab_profiles')
        .update({ role: editRole, belt: editBelt })
        .eq('id', id);

      if (error) throw error;

      // Actualizar estado local sin recargar toda la lista
      setTeachers(prev => prev.map(t => 
        t.id === id ? { ...t, role: editRole, belt: editBelt } : t
      ));
      setEditingId(null);
    } catch (err) {
      console.error("Error updating teacher:", err);
      alert("Error al actualizar staff.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert("Por favor selecciona un alumno para promover.");
      return;
    }

    try {
      const { error } = await supabase
        .from('cohab_profiles')
        .update({
          role: newRole,
          belt: newBelt
        })
        .eq('id', selectedStudentId);

      if (error) throw error;
      
      setSelectedStudentId('');
      setNewRole('teacher');
      setNewBelt('black');
      setShowAddForm(false);
      fetchTeachers();
      fetchStudents(); // Recargar la lista de alumnos disponibles
    } catch (err) {
      console.error("Error promoting student to staff:", err);
      alert("Error al promover alumno a staff.");
    }
  };

  const handleDeleteTeacher = async (id) => {
    if (!window.confirm("¿Estás seguro de que deseas quitar a esta persona del staff? Su cuenta de alumno no será eliminada, simplemente volverá a ser un alumno regular (rol 'student').")) return;

    try {
      const { error } = await supabase
        .from('cohab_profiles')
        .update({
          role: 'student'
        })
        .eq('id', id);

      if (error) throw error;
      fetchTeachers();
      fetchStudents(); // Reaparecerá en la lista de alumnos seleccionables
    } catch (err) {
      console.error("Error removing teacher from staff:", err);
      alert("Error al remover staff.");
    }
  };

  const getBeltLabel = (b) => {
    const map = {
      black: 'Cinturón Negro', brown: 'Cinturón Café / Marrón',
      purple: 'Cinturón Morado', blue: 'Cinturón Azul', white: 'Cinturón Blanco'
    };
    return map[b] || b || '—';
  };

  const getRoleLabel = (r) => {
    const map = { 
      admin: 'Administrador', 
      teacher: 'Profesor', 
      instructor: 'Instructor',
      monitor: 'Monitor'
    };
    return map[r] || r || '—';
  };

  return (
    <div>
      <div className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/profile')} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="top-bar-title">Gestión de Staff</div>
        <button className="icon-btn" onClick={() => setShowAddForm(!showAddForm)} aria-label="Añadir">
          <UserPlus size={20} />
        </button>
      </div>

      <div className="content" style={{ paddingTop: '20px', paddingBottom: '30px' }}>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Administra los perfiles de los profesores, instructores y staff de la academia en tiempo real promoviendo cuentas de alumnos existentes.
        </p>

        {showAddForm && (
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '25px', border: '1px solid var(--border-glass)' }}>
            <h4 style={{ color: 'white', margin: '0 0 15px 0', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800 }}>Promover Alumno a Staff</h4>
            <form onSubmit={handleAddTeacher}>
              
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>Selecciona un Alumno Registrado</label>
                {loadingStudents ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '5px 0' }}>Cargando alumnos del tatami...</p>
                ) : students.length === 0 ? (
                  <p style={{ color: '#EF4444', fontSize: '0.78rem', fontWeight: 800, margin: '5px 0' }}>No hay cuentas de alumnos regulares disponibles para promover.</p>
                ) : (
                  <select 
                    className="form-input" 
                    value={selectedStudentId} 
                    onChange={e => setSelectedStudentId(e.target.value)}
                    style={{ background: 'var(--bg-elevated)', color: 'white', height: '38px', fontSize: '0.82rem' }}
                    required
                  >
                    <option value="">-- Elige un Alumno --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.email || 'Sin correo'})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>Rol / Cargo Asignado</label>
                <select 
                  className="form-input" 
                  value={newRole} 
                  onChange={e => {
                    const role = e.target.value;
                    setNewRole(role);
                    // Sugerir cinturón automáticamente para una UX premium
                    if (role === 'teacher') setNewBelt('black');
                    else if (role === 'instructor') setNewBelt('brown');
                    else if (role === 'monitor') setNewBelt('purple');
                  }}
                  style={{ background: 'var(--bg-elevated)', color: 'white', height: '38px', fontSize: '0.82rem' }}
                >
                  <option value="teacher">Profesor (Cinturón Negro)</option>
                  <option value="instructor">Instructor (Cinturón Café / Marrón)</option>
                  <option value="monitor">Monitor (Cinturón Morado)</option>
                  <option value="admin">Administrador General</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>Cinturón BJJ</label>
                <select 
                  className="form-input" 
                  value={newBelt} 
                  onChange={e => setNewBelt(e.target.value)}
                  style={{ background: 'var(--bg-elevated)', color: 'white', height: '38px', fontSize: '0.82rem' }}
                >
                  <option value="black">Cinturón Negro</option>
                  <option value="brown">Cinturón Café / Marrón</option>
                  <option value="purple">Cinturón Morado</option>
                  <option value="blue">Cinturón Azul</option>
                  <option value="white">Cinturón Blanco</option>
                  <option value="No Belt">- Sin Cinturón BJJ -</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button 
                  type="submit" 
                  className="auth-btn" 
                  disabled={!selectedStudentId}
                  style={{ 
                    flex: 1, minHeight: '40px', height: 'auto',
                    background: 'linear-gradient(135deg, var(--aurora), #10B981)', 
                    color: '#060B18', fontWeight: 900, cursor: 'pointer', 
                    border: 'none', borderRadius: '8px',
                    boxShadow: selectedStudentId ? '0 0 15px rgba(52, 211, 153, 0.3)' : 'none',
                    fontSize: '0.82rem', margin: 0, textTransform: 'uppercase',
                    opacity: selectedStudentId ? 1 : 0.5
                  }}
                >
                  Promover a Staff
                </button>
                <button 
                  type="button" 
                  className="auth-btn" 
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedStudentId('');
                  }} 
                  style={{ 
                    flex: 1, minHeight: '40px', height: 'auto',
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

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Cargando staff de la academia...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {teachers.map(t => {
              const isEditing = editingId === t.id;
              const isUpdating = updatingId === t.id;

              return (
                <div key={t.id} className="glass-panel" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-glass)' }}>
                  {/* Fila principal */}
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{
                      width: '50px', height: '50px', borderRadius: '50%',
                      background: 'rgba(255,255,255,0.04)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.8rem', border: '2px solid var(--border-glass)', flexShrink: 0
                    }}>
                      🥋
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.05rem', marginBottom: '2px', marginTop: 0, fontWeight: 800 }}>
                        {t.name}
                      </h3>
                      <div style={{ fontSize: '0.72rem', color: 'var(--aurora)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
                        {getRoleLabel(t.role)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          background: t.belt === 'black' ? '#000' : t.belt === 'brown' ? '#8B4513' : t.belt === 'purple' ? '#800080' : t.belt === 'blue' ? '#0000FF' : '#FFF',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }} />
                        {getBeltLabel(t.belt)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Botón Editar / Cancelar */}
                      <button 
                        onClick={() => isEditing ? handleCancelEdit() : handleStartEdit(t)}
                        className="icon-btn" 
                        style={{ 
                          width: '32px', height: '32px', 
                          background: isEditing ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
                          color: isEditing ? '#EF4444' : '#60A5FA', 
                          borderColor: isEditing ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)' 
                        }}
                        title={isEditing ? 'Cancelar edición' : 'Editar rol y cinturón'}
                      >
                        {isEditing ? <X size={14} /> : <Edit2 size={14} />}
                      </button>
                      <button 
                        onClick={() => handleDeleteTeacher(t.id)}
                        className="icon-btn" 
                        style={{ width: '32px', height: '32px', background: 'rgba(255,77,77,0.1)', color: '#FF6B6B', borderColor: 'rgba(255,77,77,0.3)' }}
                        title="Quitar del Staff"
                      >
                        <Trash2 size={14} />
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>
                            Rol / Cargo
                          </label>
                          <select 
                            className="form-input"
                            value={editRole}
                            onChange={e => {
                              const role = e.target.value;
                              setEditRole(role);
                              // Sugerir cinturón en edición
                              if (role === 'teacher') setEditBelt('black');
                              else if (role === 'instructor') setEditBelt('brown');
                              else if (role === 'monitor') setEditBelt('purple');
                            }}
                            style={{ background: 'var(--bg-elevated)', color: 'white', height: '36px', fontSize: '0.78rem' }}
                          >
                            <option value="teacher">Profesor</option>
                            <option value="instructor">Instructor</option>
                            <option value="monitor">Monitor</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 800 }}>
                            Cinturón BJJ
                          </label>
                          <select 
                            className="form-input"
                            value={editBelt}
                            onChange={e => setEditBelt(e.target.value)}
                            style={{ background: 'var(--bg-elevated)', color: 'white', height: '36px', fontSize: '0.78rem' }}
                          >
                            <option value="black">Negro</option>
                            <option value="brown">Café / Marrón</option>
                            <option value="purple">Morado</option>
                            <option value="blue">Azul</option>
                            <option value="white">Blanco</option>
                            <option value="No Belt">Sin Cinturón</option>
                          </select>
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
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                No hay miembros del staff registrados. ¡Promueve a un alumno usando el botón superior derecho!
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
