// --- Global State ---
let currentUser = null;
let services = [];
let toastTimeout = null;
let authMode = 'login'; // 'login' or 'register'

// Enrollment State
let familyMembers = [
  { id: 'me', name: 'Yo', icon: '🥋', belt: 'white', graus: 0, progress: 0, attendance: [] }
];
let currentMemberId = 'me';
let dashboardMemberId = 'me';
let enrollmentCart = {};

// --- SDK Initializations (keys loaded from config.js) ---
const mp = new MercadoPago(CONFIG.MERCADOPAGO_PUBLIC_KEY);
const _supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// --- Initialization ---
window.addEventListener('load', async () => {
  // Init navigation handles
  const navItems = document.querySelectorAll('.nav-tab');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const screenName = item.dataset.screen;
      if (screenName) navigateTo(screenName);
    });
  });

  // Check Session
  const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
  
  // Check Password Recovery Hash Map
  const hash = window.location.hash;
  if (hash && hash.includes('type=recovery')) {
    // Show new password modal
    const newPassModal = document.getElementById('new-password-modal');
    if (newPassModal) newPassModal.style.display = 'flex';
    // Clear hash to prevent infinite loop on reload
    window.history.replaceState(null, null, ' ');
  } else if (session) {
    const { user } = session;
    const { data: profile } = await _supabase
      .from('cohab_profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    let displayName = profile?.full_name;
    if (!displayName || displayName.trim() === '' || displayName.includes('@')) {
      displayName = '';
    }
    
    const isAdmin = profile?.role === 'admin' || user.email === 'ambler.eduardo@gmail.com';
    
    // Hardcode name and try to fix role if needed
    if (user.email === 'ambler.eduardo@gmail.com') {
      displayName = 'Eduardo Javier Ambler Rios';
      if (profile?.role !== 'admin' || profile?.full_name !== 'Eduardo Javier Ambler Rios') {
        _supabase.from('cohab_profiles').update({ role: 'admin', full_name: 'Eduardo Javier Ambler Rios' }).eq('id', user.id).then();
      }
    }

    loginSuccess(displayName, isAdmin, user.id, user.email);
  }
});


function toggleAuthMode(event) {
  event.preventDefault();
  authMode = authMode === 'login' ? 'register' : 'login';

  const submitBtn = document.getElementById('auth-submit-btn');
  const switchText = document.getElementById('auth-switch-text');
  const switchLink = document.getElementById('auth-switch-link');
  const hints = document.getElementById('demo-hints');

  if (authMode === 'register') {
    submitBtn.textContent = 'Crear Cuenta';
    switchText.textContent = '¿Ya tienes cuenta?';
    switchLink.textContent = 'Inicia Sesión';
    if (hints) hints.style.display = 'none';
  } else {
    submitBtn.textContent = 'Ingresar';
    switchText.textContent = '¿No tienes cuenta?';
    switchLink.textContent = 'Regístrate';
    if (hints) hints.style.display = 'block';
  }
}

async function handleAuth(event) {
  event.preventDefault();
  if (authMode === 'login') {
    handleLogin(event);
  } else {
    handleSignup(event);
  }
}

// --- Modal Dialogs ---
function openProfileEditModal() {
  document.getElementById('profile-edit-modal').style.display = 'flex';
}

function closeProfileEditModal() {
  document.getElementById('profile-edit-modal').style.display = 'none';
}

// --- Password Recovery ---
function showRecoveryModal(event) {
  event.preventDefault();
  document.getElementById('recovery-modal').style.display = 'flex';
}

function closeRecoveryModal() {
  document.getElementById('recovery-modal').style.display = 'none';
  document.getElementById('recovery-email').value = '';
}

async function sendRecoveryEmail() {
  const email = document.getElementById('recovery-email').value;
  if (!email) {
    showToast('⚠️ Ingresa tu correo electrónico');
    return;
  }
  
  const btn = document.getElementById('btn-send-recovery');
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  const { data, error } = await _supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });

  if (error) {
    showToast(`❌ Error: ${error.message}`);
  } else {
    showToast('✅ ¡Enlace enviado! Revisa tu bandeja de entrada o spam.');
    closeRecoveryModal();
  }
  
  btn.textContent = 'Enviar Enlace';
  btn.disabled = false;
}

async function saveNewPassword() {
  const newPassword = document.getElementById('new-password-input').value;
  if (!newPassword || newPassword.length < 6) {
    showToast('⚠️ La contraseña debe tener al menos 6 caracteres');
    return;
  }

  const btn = document.getElementById('btn-save-new-password');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  const { data, error } = await _supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    showToast(`❌ Error: ${error.message}`);
  } else {
    showToast('✅ Contraseña actualizada correctamente. Ingresando...');
    document.getElementById('new-password-modal').style.display = 'none';
    
    // Check if session exists (Supabase auto-logs-in user on recovery click)
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      setTimeout(() => {
        showToast('Inicia sesión con tu nueva contraseña');
      }, 1500);
    }
  }
  
  btn.textContent = 'Guardar Contraseña';
  btn.disabled = false;
}

async function handleSignup(event) {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;

  showToast("Creando cuenta...");

  const { data, error } = await _supabase.auth.signUp({
    email,
    password: pass,
  });

  if (error) {
    showToast(`❌ Error: ${error.message}`);
    return;
  }

  if (data.user) {
    // Create initial profile
    const { error: profileError } = await _supabase
      .from('cohab_profiles')
      .insert([
        { id: data.user.id, full_name: email.split('@')[0], role: 'alumno' }
      ]);

    if (profileError) {
      console.error("Profile creation error:", profileError);
    }

    showToast("✅ Cuenta creada. Revisa tu email (si aplica).");
    authMode = 'login';
    toggleAuthMode(event);
  }
}

/**
 * Handle Login (Supabase)
 */
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;

  showToast("Iniciando sesión...");

  const { data, error } = await _supabase.auth.signInWithPassword({
    email: email,
    password: pass,
  });

  if (error) {
    showToast(`❌ Error: ${error.message}`);
    return;
  }

  // Fetch profile to get role
  const { data: profile } = await _supabase
    .from('cohab_profiles')
    .select('role, full_name')
    .eq('id', data.user.id)
    .single();

  let displayName = profile?.full_name;
  if (!displayName || displayName.trim() === '' || displayName.includes('@')) {
    displayName = '';
  }

  const isAdmin = profile?.role === 'admin' || email === 'ambler.eduardo@gmail.com';
  
  // Hardcode name and try to fix role if needed
  if (email === 'ambler.eduardo@gmail.com') {
    displayName = 'Eduardo Javier Ambler Rios';
    if (profile?.role !== 'admin' || profile?.full_name !== 'Eduardo Javier Ambler Rios') {
      _supabase.from('cohab_profiles').update({ role: 'admin', full_name: 'Eduardo Javier Ambler Rios' }).eq('id', data.user.id).then();
    }
  }

  loginSuccess(displayName, isAdmin, data.user.id, email);
}

async function loginSuccess(name, isAdmin, userId, email) {
  currentUser = { name, isAdmin, id: userId, email };

  // Update UI Elements
  const userDisplay = document.getElementById('user-display-name');
  const adminBadge = document.getElementById('admin-badge');
  const statusCard = document.getElementById('status-card-dashboard');
  const navServicios = document.getElementById('nav-servicios');
  const navPagos = document.getElementById('nav-pagos');

  if (userDisplay) userDisplay.textContent = name;
  if (adminBadge) adminBadge.style.display = isAdmin ? 'inline-block' : 'none';
  if (statusCard) statusCard.style.display = isAdmin ? 'none' : 'block';
  if (navServicios) navServicios.style.display = isAdmin ? 'flex' : 'none';
  if (navPagos) navPagos.style.display = isAdmin ? 'none' : 'flex';

  if (isAdmin) {
    updateAdminMetrics();
    fetchAllStudents();
    renderAdminServicesList();
  }

  // Visual Transitions
  document.getElementById('screen-auth').style.display = 'none';
  document.getElementById('app-main-content').style.display = 'block';
  document.getElementById('bottom-nav').style.display = 'flex';

  // Fetch Family Data dynamically instead of relying on hardcoded array
  await fetchFamilyMembers();

  // Route: admins go to admin panel, students to dashboard
  if (isAdmin) {
    navigateTo('servicios');
  } else {
    navigateTo('dashboard');
  }
}

function fillDemo(email, pass) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-pass').value = pass;
}

async function handleLogout() {
  try {
    await _supabase.auth.signOut();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
  currentUser = null;
  document.getElementById('screen-auth').style.display = 'flex';
  document.getElementById('app-main-content').style.display = 'none';
  document.getElementById('bottom-nav').style.display = 'none';
  showToast("Vuelve pronto 🥋");
}

async function loadProfileData() {
  if (!currentUser) return;

  const nameInput = document.getElementById('profile-input-name');
  const emailInput = document.getElementById('profile-input-email');
  const phoneInput = document.getElementById('profile-input-phone');

  const nameDisplay = document.getElementById('profile-full-name-display');
  const roleDisplay = document.getElementById('profile-role-display');

  // Load from current session user
  emailInput.value = currentUser.email || 'Sin correo asociado';

  // Fetch profile from DB to get name and phone
  const { data: profile, error } = await _supabase
    .from('cohab_profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (!error && profile) {
    nameInput.value = profile.full_name || '';
    phoneInput.value = profile.phone || '';

    if (nameDisplay) nameDisplay.textContent = profile.full_name || ' ';
    // Display role from DB
    const roleLabels = { admin: 'PROFESOR', alumno: 'ALUMNO' };
    if (roleDisplay) roleDisplay.textContent = roleLabels[profile.role] || profile.role || 'Alumno';
  }
}

async function handleUpdateProfile(event) {
  event.preventDefault();
  if (!currentUser) return;

  const newName = document.getElementById('profile-input-name').value;
  const newPhone = document.getElementById('profile-input-phone').value;

  const { error } = await _supabase
    .from('cohab_profiles')
    .update({
      full_name: newName,
      phone: newPhone
    })
    .eq('id', currentUser.id);

  if (error) {
    showToast("Error al actualizar perfil ❌");
    console.error(error);
  } else {
    showToast("Perfil actualizado con éxito ✅");
    // Update local display
    document.getElementById('profile-full-name-display').textContent = newName;
    document.getElementById('user-display-name').textContent = newName;
  }
}


// Update Screen Navigation to handle the new services screen
function navigateTo(screenName) {
  try {
    const screens = document.querySelectorAll('.screen');
    const navItems = document.querySelectorAll('.nav-tab');

    // Hide all screens
    screens.forEach(s => s.classList.remove('active'));

    // Show target screen
    const target = document.getElementById(`screen-${screenName}`);
    if (target) {
      target.classList.add('active');
    }

    // Update nav active state
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.screen === screenName) {
        item.classList.add('active');
      }
    });

    // Special logic for services
    if (screenName === 'servicios') {
      renderAdminServicesList();
      renderAdminNewsList();
      renderAdminVideosList();
    }

    if (screenName === 'profile') {
      loadProfileData();
    }

    if (screenName === 'videoteca') {
      fetchVideos();
    }

    if (screenName === 'dashboard') {
      fetchAttendance();
    }

    if (screenName === 'novedades') {
      fetchNews();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

// --- Copy to Clipboard ---
/**
 * Copy text content of an element to clipboard and show feedback.
 * @param {string} elementId - ID of the element containing text
 * @param {HTMLElement} btn - The copy button element
 */
function copyToClipboard(elementId, btn) {
  try {
    const el = document.getElementById(elementId);
    if (!el) return;

    const text = el.textContent.trim();

    navigator.clipboard.writeText(text).then(() => {
      // Visual feedback on button
      const originalText = btn.textContent;
      btn.textContent = 'Copiado ✓';
      btn.classList.add('copied');

      showToast(`Copiado: ${text}`);

      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      btn.textContent = 'Copiado ✓';
      btn.classList.add('copied');
      showToast(`Copiado: ${text}`);

      setTimeout(() => {
        btn.textContent = 'Copiar';
        btn.classList.remove('copied');
      }, 2000);
    });
  } catch (error) {
    console.error('Copy error:', error);
  }
}

// --- Toast Notification ---

/**
 * Show a brief toast notification.
 * @param {string} message - Message to display
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('show');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// --- File Upload & Drag-and-Drop ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

if (dropZone) {
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-over');
    });
  });

  // Handle dropped files
  dropZone.addEventListener('drop', (e) => {
    try {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    } catch (error) {
      console.error('Drop error:', error);
    }
  });
}

// Handle file input change
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    try {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    } catch (error) {
      console.error('File input error:', error);
    }
  });
}

/**
 * Handle a selected/dropped file.
 * @param {File} file - The file to process
 */
function handleFile(file) {
  if (!file) return;

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showToast('⚠️ Archivo muy grande (máx 10MB)');
    return;
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    showToast('⚠️ Solo imágenes o PDF');
    return;
  }

  // Show success feedback
  const uploadBtn = document.getElementById('btn-upload');
  if (uploadBtn) {
    uploadBtn.innerHTML = `✓ Listo: ${file.name.substring(0, 15)}...`;
    uploadBtn.style.background = 'linear-gradient(135deg, #047857, #10B981)';

    setTimeout(() => {
      uploadBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Subir Comprobante';
      uploadBtn.style.background = '';
    }, 3500);
  }

  showToast(`Comprobante recibido ✓`);

  // Update drop zone
  if (dropZone) {
    dropZone.innerHTML = `<span class="drop-area-icon">✓</span>Archivo cargado`;

    setTimeout(() => {
      dropZone.innerHTML = '<span class="drop-area-icon">📥</span>O arrastra tu archivo aquí';
    }, 3500);
  }
}

// --- Mercado Pago Logic ---
async function openMercadoPago() {
  const selectedIds = Object.keys(enrollmentCart);
  if (selectedIds.length === 0) {
    showToast("⚠️ Primero selecciona un plan para ti o tu familia");
    return;
  }

  showToast("🚀 Conectando con Mercado Pago...");

  // 1. Record pending payment in DB
  let totalAmount = 0;
  selectedIds.forEach(id => totalAmount += enrollmentCart[id].price);

  const { data: paymentData, error: payError } = await _supabase
    .from('cohab_payments')
    .insert([{ profile_id: currentUser.id, amount: totalAmount, status: 'pending' }])
    .select();

  if (payError) {
    showToast("❌ Error al registrar pago");
    return;
  }

  // Simulating Checkout Pro redirect
  setTimeout(async () => {
    alert("Redirigiendo a entorno de pruebas de Mercado Pago...\n(Checkout Pro con tu TEST Public Key)");

    // 2. Simulate Success: Update Payment and Create Subscriptions
    await _supabase
      .from('cohab_payments')
      .update({ status: 'approved' })
      .eq('id', paymentData[0].id);

    for (const id of selectedIds) {
      const item = enrollmentCart[id];
      const isFamily = id.startsWith('mem_') || id.includes('-'); // Supabase UUIDs contain dashes

      const subData = {
        service_id: item.service.id,
        months: item.months,
        status: 'active',
        expires_at: new Date(Date.now() + item.months * 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      if (id === 'me') {
        subData.profile_id = currentUser.id;
      } else {
        subData.family_member_id = id;
      }

      await _supabase.from('cohab_subscriptions').insert([subData]);
    }

    showToast("✅ Inscripción Completada Exitosamente");

    // Clear cart
    enrollmentCart = {};
    updateCheckoutSummary();
    navigateTo('dashboard');
  }, 1500);
}

// --- Global Services ---
async function fetchServices() {
  const { data, error } = await _supabase
    .from('cohab_services')
    .select('*');

  if (!error && data.length > 0) {
    services = data;
    renderServiceCatalog();
    updateAdminMetrics();
    renderAdminServicesList();
  }
}

function renderAdminServicesList() {
  const container = document.getElementById('admin-services-list');
  const badge = document.getElementById('admin-services-count-badge');
  if (!container) return;

  if (badge) badge.textContent = services.length;

  const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

  container.innerHTML = services.map(s => `
    <div class="service-card-full">
      <div class="service-icon-box" style="background: rgba(255, 215, 0, 0.1); color: #FFD700;">
        ${s.icon || '🥊'}
      </div>
      <div class="service-info-box">
        <div class="service-name-text">${s.name}</div>
        <div class="service-price-text">
          <span style="color:var(--text-muted); text-decoration:line-through; font-size:0.7rem;">${formats.format(s.base_price || s.basePrice)}</span> 
          ${formats.format(s.discount_price || s.discountPrice)}
        </div>
      </div>
      <button class="icon-btn" style="width:32px; height:32px; font-size:0.8rem;" onclick="handleDeleteService('${s.id}')">
        🗑️
      </button>
    </div>
  `).join('');
}

async function handleDeleteService(id) {
  if (!confirm("¿Seguro que quieres eliminar este servicio?")) return;

  showToast("Eliminando...");
  const { error } = await _supabase
    .from('cohab_services')
    .delete()
    .eq('id', id);

  if (error) {
    showToast(`❌ Error: ${error.message}`);
  } else {
    showToast("✅ Servicio eliminado");
    services = services.filter(s => s.id != id);
    renderAdminServicesList();
    renderServiceCatalog();
    updateAdminMetrics();
  }
}

let activeService = services[0];

async function updateAdminMetrics() {
  const revenueEl = document.getElementById('admin-revenue');
  const activeCountEl = document.getElementById('admin-active-count');

  // Real fetch for stats
  const { data: students, error } = await _supabase
    .from('cohab_profiles')
    .select('id')
    .eq('role', 'alumno');

  if (!error && students) {
    if (activeCountEl) activeCountEl.textContent = students.length;
    if (revenueEl) {
      // Mocking revenue based on active students * average price for now
      const revenue = students.length * 35000;
      revenueEl.textContent = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(revenue);
    }
  }
}

async function handleCreateService() {
  const name = document.getElementById('new-service-name').value;
  const price = parseInt(document.getElementById('new-service-price').value);
  const discount = parseInt(document.getElementById('new-service-discount').value);

  if (!name || isNaN(price) || isNaN(discount)) {
    showToast("⚠️ Completa todos los campos");
    return;
  }

  showToast("Guardando servicio...");

  const { data, error } = await _supabase
    .from('cohab_services')
    .insert([{ name, base_price: price, discount_price: discount, icon: '🥊' }])
    .select();

  if (error) {
    showToast(`❌ Error: ${error.message}`);
    return;
  }

  services.push(data[0]);
  updateAdminMetrics();
  renderServiceCatalog();
  renderAdminServicesList();

  showToast(`✅ Servicio "${name}" creado con éxito`);

  document.getElementById('new-service-name').value = '';
  document.getElementById('new-service-price').value = '';
  document.getElementById('new-service-discount').value = '';
}

async function fetchAllStudents() {
  const { data, error } = await _supabase
    .from('cohab_profiles')
    .select('*')
    .eq('role', 'alumno');

  if (!error && data) {
    renderStudentList(data);
    renderAdminPaymentsList(data);
  }
}

function renderAdminPaymentsList(students) {
  const container = document.getElementById('admin-payments-list');
  if (!container) return;

  const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

  container.innerHTML = students.map(s => `
    <div class="student-admin-card" style="border-left: 4px solid #34D399;">
      <div class="stu-info">
        <strong>${s.full_name || ' '}</strong>
        <span>Plan Mensual: ${formats.format(35000)}</span>
      </div>
      <div class="stu-actions">
        <span class="status-badge ok" style="padding: 4px 8px; font-size: 0.6rem;">PAGADO</span>
      </div>
    </div>
  `).join('');
}

function renderStudentList(students) {
  const container = document.getElementById('admin-student-list');
  if (!container) return;

  if (students.length === 0) {
    container.innerHTML = '<div style="padding:20px; color:var(--text-muted);">No hay alumnos registrados aún.</div>';
    return;
  }

  container.innerHTML = students.map(s => `
    <div class="student-admin-card shadow-sm">
      <div class="stu-info">
        <strong>${s.full_name || 'Alumno'}</strong>
        <span>${s.belt.toUpperCase()} - ${s.graus} Graus</span>
      </div>
      <div class="stu-actions">
        <button onclick="updateStudentRank('${s.id}', '${s.belt}', ${s.graus + 1})">+ Grau</button>
        <select onchange="updateStudentRank('${s.id}', this.value, ${s.graus})">
          <option value="white" ${s.belt === 'white' ? 'selected' : ''}>Blanco</option>
          <option value="blue" ${s.belt === 'blue' ? 'selected' : ''}>Azul</option>
          <option value="purple" ${s.belt === 'purple' ? 'selected' : ''}>Morado</option>
          <option value="brown" ${s.belt === 'brown' ? 'selected' : ''}>Café</option>
          <option value="black" ${s.belt === 'black' ? 'selected' : ''}>Negro</option>
        </select>
      </div>
    </div>
  `).join('');
}

async function updateStudentRank(userId, newBelt, newGraus) {
  // Cap graus at 4 for colored belts normally
  if (newGraus > 4) newGraus = 4;
  if (newGraus < 0) newGraus = 0;

  showToast("Actualizando rango...");

  const { error } = await _supabase
    .from('cohab_profiles')
    .update({ belt: newBelt, graus: newGraus })
    .eq('id', userId);

  if (error) {
    showToast("❌ Error al graduar");
  } else {
    showToast("✅ Alumno graduado correctamente");
    fetchAllStudents();
  }
}


function renderFamilyDashboardSwitch() {
  const container = document.getElementById('family-dashboard-switch');
  if (!container) return;

  if (familyMembers.length <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = familyMembers.map(m => `
    <div class="switch-pill ${m.id === dashboardMemberId ? 'active' : ''}" onclick="switchDashboardView('${m.id}')">
      ${m.name}
    </div>
  `).join('');
}

function switchDashboardView(id) {
  dashboardMemberId = id;
  renderFamilyDashboardSwitch();
  const member = familyMembers.find(m => m.id === id);
  updateRankDisplay(member);
  updateDashboardStatus(member.id);
}

function updateRankDisplay(member) {
  const beltName = document.getElementById('current-belt-name');
  const beltPreview = document.getElementById('belt-preview');
  const stripeContainer = document.getElementById('belt-stripes-container');
  const grausText = document.getElementById('current-graus-text');
  const progressFill = document.getElementById('rank-progress-fill');
  const progressText = document.getElementById('progress-percent-text');

  // Update Data
  const beltMap = {
    white: 'Cinturón Blanco',
    blue: 'Cinturón Azul',
    purple: 'Cinturón Morado',
    brown: 'Cinturón Café',
    black: 'Cinturón Negro'
  };

  beltName.textContent = beltMap[member.belt] || 'Cinturón Blanco';
  grausText.textContent = `${member.graus} Graus`;
  progressText.textContent = `${member.progress}%`;
  progressFill.style.width = `${member.progress}%`;

  // Update Visuals
  beltPreview.className = `belt-visual belt-${member.belt}`;
  stripeContainer.innerHTML = Array(member.graus).fill('<div class="grau-stripe"></div>').join('');
}

async function fetchFamilyMembers() {
  if (!currentUser) return;

  const { data: myProfile } = await _supabase
    .from('cohab_profiles')
    .select('belt, graus')
    .eq('id', currentUser.id)
    .single();

  const myBelt = myProfile?.belt || 'white';
  const myGraus = myProfile?.graus || 0;

  const me = { 
    id: 'me', 
    name: currentUser.name.split(' ')[0], 
    icon: '🥋', 
    belt: myBelt, 
    graus: myGraus, 
    progress: 0, 
    attendance: [] 
  };

  const { data, error } = await _supabase
    .from('cohab_family_members')
    .select('*')
    .eq('parent_id', currentUser.id);

  if (!error && data) {
    familyMembers = [me, ...data.map(d => ({
      id: d.id,
      name: d.name,
      icon: d.relationship === 'Hija' ? '👧' : (d.relationship === 'Hijo' ? '👦' : '👤'),
      belt: 'white',
      graus: 0,
      progress: 0,
      attendance: []
    }))];
  } else {
    familyMembers = [me];
  }

  renderMemberSelector();
  renderFamilyDashboardSwitch();

  const dashboardMember = familyMembers.find(m => m.id === dashboardMemberId) || familyMembers[0];
  updateRankDisplay(dashboardMember);
  updateDashboardStatus(dashboardMember.id);
}

async function updateDashboardStatus(memberId) {
  const card = document.getElementById('status-card-dashboard');
  const badge = document.getElementById('status-badge-dashboard');
  const badgeText = document.getElementById('status-badge-text');
  const mainText = document.getElementById('status-main-text');
  const subText = document.getElementById('status-sub-text');
  const icon = document.getElementById('status-icon-dashboard');

  if (!card) return;

  // Clear previous colors
  card.className = 'status-glass';
  badge.className = 'status-badge';

  try {
    const { data: subs, error } = await _supabase
      .from('cohab_subscriptions')
      .select('end_date, status')
      .eq('profile_id', memberId)
      .eq('status', 'active')
      .order('end_date', { ascending: false })
      .limit(1);

    if (error || !subs || subs.length === 0) {
      card.classList.add('danger');
      badge.classList.add('danger');
      badgeText.textContent = 'INACTIVA';
      mainText.textContent = 'Sin Membresía';
      subText.textContent = 'Regulariza tus pagos';
      icon.textContent = '⚠️';
      return;
    }

    const endTime = Date.parse(subs[0].end_date + 'T00:00:00');
    const endDate = new Date(endTime);
    const endStr = String(endDate.getDate()).padStart(2,'0') + '/' + String(endDate.getMonth()+1).padStart(2,'0') + '/' + endDate.getFullYear();
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      card.classList.add('danger');
      badge.classList.add('danger');
      badgeText.textContent = 'VENCIDA';
      mainText.textContent = 'Membresía Vencida';
      subText.textContent = `Venció el: ${endStr}`;
      icon.textContent = '⛔';
    } else if (diffDays <= 1) {
      card.classList.add('warning');
      badge.classList.add('warning');
      badgeText.textContent = 'POR VENCER';
      mainText.textContent = 'Pago Pendiente';
      subText.textContent = `Vence ${diffDays === 0 ? 'hoy' : 'mañana'}`;
      icon.textContent = '⏳';
    } else {
      card.classList.add('ok');
      badge.classList.add('ok');
      badgeText.textContent = 'AL DÍA';
      mainText.textContent = 'Membresía Activa';
      subText.textContent = `Válida hasta: ${endStr}`;
      icon.textContent = '🛡️';
    }
  } catch (err) {
    console.error('Error fetching subscription status:', err);
  }
}

function renderMemberSelector() {
  const container = document.getElementById('member-selector');
  if (!container) return;

  let html = familyMembers.map(m => `
    <div class="member-item ${m.id === currentMemberId ? 'active' : ''}" onclick="selectMember('${m.id}')">
      <div class="member-avatar">${m.icon}</div>
      <div class="member-name">${m.name}</div>
    </div>
  `).join('');

  html += `<button class="add-member-btn" onclick="addNewMember()">+</button>`;
  container.innerHTML = html;
}

function selectMember(id) {
  currentMemberId = id;
  renderMemberSelector();
  renderServiceCatalog();

  // If this member already has a selection, highlight it
  const selection = enrollmentCart[id];
  if (selection) {
    updatePlanPrices(selection.service.discountPrice);
    document.getElementById('step-plans-section').style.display = 'block';
  } else {
    document.getElementById('step-plans-section').style.display = 'none';
  }
}

async function addNewMember() {
  const name = prompt("Nombre del familiar:");
  if (!name) return;

  showToast("Añadiendo familiar...");

  const { data, error } = await _supabase
    .from('cohab_family_members')
    .insert([
      { parent_id: currentUser.id, name: name, relationship: 'Familiar' }
    ])
    .select();

  if (error) {
    showToast(`❌ Error: ${error.message}`);
    return;
  }

  const d = data[0];
  familyMembers.push({
    id: d.id,
    name: d.name,
    icon: '👦',
    belt: 'white',
    graus: 0,
    progress: 0,
    attendance: []
  });

  selectMember(d.id);
  renderFamilyDashboardSwitch();
  showToast(`✅ ${name} añadido a tu cuenta.`);
}

function renderServiceCatalog() {
  const container = document.getElementById('service-catalog');
  if (!container) return;

  const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
  const selection = enrollmentCart[currentMemberId];

  container.innerHTML = services.map(s => `
    <div class="service-card-full ${selection?.service.name === s.name ? 'active' : ''}" onclick="selectServiceForMember('${s.name}')">
      <div class="service-icon-box">${s.icon || '🥊'}</div>
      <div class="service-info-box">
        <div class="service-name-text">${s.name}</div>
        <div class="service-price-text">desde ${formats.format(s.discountPrice)} /mes</div>
      </div>
    </div>
  `).join('');
}

function selectServiceForMember(serviceName) {
  const service = services.find(s => s.name === serviceName);
  activeService = service;

  // Highlight selection in catalog
  renderServiceCatalog();

  // Show plan selection
  updatePlanPrices(service.discountPrice);
  document.getElementById('step-plans-section').style.display = 'block';
  document.getElementById('step-plans-section').scrollIntoView({ behavior: 'smooth' });
}

function selectFinalPlan(months) {
  // Save to cart for current member
  const monthlyPrice = activeService.discountPrice;
  let finalPrice = monthlyPrice * months;

  // Apply bulk discounts
  if (months === 3) finalPrice *= 0.9;
  if (months === 6) finalPrice *= 0.85;
  if (months === 12) finalPrice *= 0.75;

  enrollmentCart[currentMemberId] = {
    service: activeService,
    months,
    price: finalPrice
  };

  updateCheckoutSummary();
  showToast(`Plan de ${months} meses para ${familyMembers.find(m => m.id === currentMemberId).name} guardado.`);
}

function updateCheckoutSummary() {
  const container = document.getElementById('summary-items');
  const summaryBox = document.getElementById('checkout-summary');
  const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

  const selectedIds = Object.keys(enrollmentCart);
  if (selectedIds.length === 0) {
    summaryBox.style.display = 'none';
    return;
  }

  summaryBox.style.display = 'block';
  let totalPay = 0;

  container.innerHTML = selectedIds.map(id => {
    const item = enrollmentCart[id];
    const member = familyMembers.find(m => m.id === id);
    totalPay += item.price;
    return `
      <div class="summary-row">
        <span><strong>${member.name}</strong>: ${item.service.name} (${item.months}m)</span>
        <span>${formats.format(item.price)}</span>
      </div>
    `;
  }).join('');

  document.getElementById('summary-total-price').textContent = formats.format(totalPay);
}

function updatePlanPrices(monthlyPrice) {
  const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

  // 1 Month
  document.getElementById('price-1m').textContent = formats.format(monthlyPrice);

  // 3 Months (10% Off)
  const p3m_old = monthlyPrice * 3;
  const p3m_new = p3m_old * 0.9;
  document.getElementById('old-3m').textContent = formats.format(p3m_old);
  document.getElementById('new-3m').textContent = formats.format(p3m_new);

  // 6 Months (15% Off)
  const p6m_old = monthlyPrice * 6;
  const p6m_new = p6m_old * 0.85;
  document.getElementById('old-6m').textContent = formats.format(p6m_old);
  document.getElementById('new-6m').textContent = formats.format(p6m_new);

  // 12 Months (25% Off)
  const p12m_old = monthlyPrice * 12;
  const p12m_new = p12m_old * 0.75;
  document.getElementById('old-12m').textContent = formats.format(p12m_old);
  document.getElementById('new-12m').textContent = formats.format(p12m_new);
}

// =====================================================
// --- ATTENDANCE / CHECK-IN MODULE ---
// =====================================================

let attendanceRecords = [];

async function fetchAttendance() {
  if (!currentUser) return;

  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await _supabase
      .from('cohab_attendance')
      .select('*')
      .eq('profile_id', currentUser.id)
      .gte('checked_at', firstDay)
      .order('checked_at', { ascending: false });

    if (!error && data) {
      attendanceRecords = data;
      renderAttendanceUI();
    }
  } catch (error) {
    console.error('Error fetching attendance:', error);
  }
}

function renderAttendanceUI() {
  const countEl = document.getElementById('attendance-count');
  if (countEl) countEl.textContent = attendanceRecords.length;

  const today = new Date().toDateString();
  const checkedToday = attendanceRecords.some(
    r => new Date(r.checked_at).toDateString() === today
  );

  const btn = document.getElementById('checkin-btn');
  if (btn) {
    if (checkedToday) {
      btn.textContent = '\u2714 Ya registrado hoy';
      btn.classList.add('disabled');
    } else {
      btn.textContent = '\u2705 Marcar Asistencia';
      btn.classList.remove('disabled');
    }
  }

  renderWeekCalendar();
}

function renderWeekCalendar() {
  const container = document.getElementById('week-calendar');
  if (!container) return;

  const dayNames = ['Lun', 'Mar', 'Mi\u00e9', 'Jue', 'Vie', 'S\u00e1b', 'Dom'];
  const now = new Date();
  const todayDate = now.getDate();

  // Get Monday of current week
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  let html = '';
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayNum = day.getDate();
    const isToday = dayNum === todayDate && day.getMonth() === now.getMonth();

    const attended = attendanceRecords.some(
      r => new Date(r.checked_at).toDateString() === day.toDateString()
    );

    html += `
      <div class="week-day ${isToday ? 'today' : ''} ${attended ? 'attended' : ''}">
        <div class="day-label">${dayNames[i]}</div>
        <div class="day-num">${dayNum}</div>
        <div class="day-dot"></div>
      </div>
    `;
  }

  container.innerHTML = html;
}

async function handleCheckIn() {
  if (!currentUser) return;

  const today = new Date().toDateString();
  const alreadyChecked = attendanceRecords.some(
    r => new Date(r.checked_at).toDateString() === today
  );

  if (alreadyChecked) {
    showToast('\u26a0\ufe0f Ya registraste tu asistencia hoy');
    return;
  }

  showToast('Registrando asistencia...');

  try {
    const { data, error } = await _supabase
      .from('cohab_attendance')
      .insert([{ profile_id: currentUser.id }])
      .select();

    if (error) {
      showToast(`\u274c Error: ${error.message}`);
      return;
    }

    attendanceRecords.unshift(data[0]);
    renderAttendanceUI();
    showToast('\u2705 \u00a1Asistencia registrada! Sigue entrenando \ud83e\udd4b');
  } catch (error) {
    console.error('Check-in error:', error);
    showToast('\u274c Error al registrar asistencia');
  }
}

// =====================================================
// --- NOVEDADES / NEWS MODULE ---
// =====================================================

let newsItems = [];

async function fetchNews() {
  try {
    const { data, error } = await _supabase
      .from('cohab_news')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      newsItems = data;
      renderNews();
    }
  } catch (error) {
    console.error('Error fetching news:', error);
  }
}

function renderNews() {
  const container = document.getElementById('news-container');
  if (!container) return;

  if (newsItems.length === 0) {
    container.innerHTML = '<div style="padding:16px; color:var(--text-muted); font-size:0.85rem;">No hay novedades</div>';
    return;
  }

  container.innerHTML = newsItems.map(n => `
    <div class="news-item">
      <span class="news-emoji">${n.emoji || '\ud83d\udce2'}</span>
      <div class="news-name">${n.title}</div>
      <div class="news-date">${n.subtitle || ''}</div>
    </div>
  `).join('');
}

async function handleCreateNews() {
  const title = document.getElementById('new-news-title').value;
  const subtitle = document.getElementById('new-news-subtitle').value;
  const emoji = document.getElementById('new-news-emoji').value || '\ud83d\udce2';

  if (!title) {
    showToast('\u26a0\ufe0f Ingresa un t\u00edtulo');
    return;
  }

  showToast('Creando novedad...');

  try {
    const { data, error } = await _supabase
      .from('cohab_news')
      .insert([{ title, subtitle, emoji }])
      .select();

    if (error) {
      showToast(`\u274c Error: ${error.message}`);
      return;
    }

    newsItems.unshift(data[0]);
    renderNews();
    renderAdminNewsList();
    showToast(`\u2705 Novedad "${title}" creada`);

    document.getElementById('new-news-title').value = '';
    document.getElementById('new-news-subtitle').value = '';
    document.getElementById('new-news-emoji').value = '';
  } catch (error) {
    console.error('Create news error:', error);
    showToast('\u274c Error al crear novedad');
  }
}

async function handleDeleteNews(id) {
  if (!confirm('\u00bfSeguro que quieres eliminar esta novedad?')) return;

  try {
    const { error } = await _supabase
      .from('cohab_news')
      .delete()
      .eq('id', id);

    if (error) {
      showToast(`\u274c Error: ${error.message}`);
      return;
    }

    newsItems = newsItems.filter(n => n.id !== id);
    renderNews();
    renderAdminNewsList();
    showToast('\u2705 Novedad eliminada');
  } catch (error) {
    console.error('Delete news error:', error);
  }
}

function renderAdminNewsList() {
  const container = document.getElementById('admin-news-list');
  if (!container) return;

  container.innerHTML = newsItems.map(n => `
    <div class="admin-list-item">
      <span class="item-emoji">${n.emoji || '\ud83d\udce2'}</span>
      <div class="item-info">
        <div class="item-title">${n.title}</div>
        <div class="item-sub">${n.subtitle || 'Sin subt\u00edtulo'}</div>
      </div>
      <button class="delete-btn" onclick="handleDeleteNews('${n.id}')">🗑️</button>
    </div>
  `).join('');
}

// =====================================================
// --- VIDEOTECA / VIDEOS MODULE ---
// =====================================================

let videoItems = [];

async function fetchVideos() {
  try {
    const { data, error } = await _supabase
      .from('cohab_videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      videoItems = data;
      renderVideoteca();
    }
  } catch (error) {
    console.error('Error fetching videos:', error);
  }
}

function renderVideoteca() {
  const featuredContainer = document.getElementById('featured-video-container');
  const gridContainer = document.getElementById('video-grid');
  const descEl = document.getElementById('featured-video-desc');

  const featured = videoItems.find(v => v.featured) || videoItems[0];
  const others = videoItems.filter(v => v.id !== featured?.id);

  if (featuredContainer && featured) {
    featuredContainer.innerHTML = `
      <div class="featured-video">
        <img src="${featured.thumbnail_url || 'assets/thumb-1.png'}" alt="${featured.title}">
        <div class="vid-overlay">
          <div class="vid-play">
            <svg viewBox="0 0 24 24"><polygon points="7,4 20,12 7,20" /></svg>
          </div>
          <span class="vid-label">T\u00e9cnica Destacada</span>
          <h2 class="vid-title">${featured.title}</h2>
          <div class="vid-meta">${featured.instructor || 'Instructor'} \u2022 ${featured.duration || ''}</div>
        </div>
      </div>
    `;
    if (descEl) descEl.textContent = featured.description || '';
  } else if (featuredContainer) {
    featuredContainer.innerHTML = '<div style="padding:40px 20px; text-align:center; color:var(--text-muted);">No hay videos a\u00fan</div>';
    if (descEl) descEl.textContent = '';
  }

  if (gridContainer) {
    gridContainer.innerHTML = others.map(v => `
      <div class="thumb-card">
        <div class="img-wrap">
          <img src="${v.thumbnail_url || 'assets/thumb-1.png'}" alt="${v.title}">
          <div class="thumb-play">
            <div class="thumb-play-icon"><svg viewBox="0 0 24 24"><polygon points="7,4 20,12 7,20" /></svg></div>
          </div>
        </div>
        <div class="thumb-text">
          ${v.title}
          <div class="thumb-dur">${v.duration || ''}</div>
        </div>
      </div>
    `).join('');
  }
}

async function handleCreateVideo() {
  const title = document.getElementById('new-video-title').value;
  const description = document.getElementById('new-video-desc').value;
  const duration = document.getElementById('new-video-duration').value;
  const instructor = document.getElementById('new-video-instructor').value || 'Prof. Andr\u00e9s';
  const thumbnail_url = document.getElementById('new-video-thumb').value;
  const featured = document.getElementById('new-video-featured').checked;

  if (!title) {
    showToast('\u26a0\ufe0f Ingresa un t\u00edtulo para el video');
    return;
  }

  showToast('Creando video...');

  try {
    if (featured) {
      await _supabase
        .from('cohab_videos')
        .update({ featured: false })
        .eq('featured', true);
    }

    const { data, error } = await _supabase
      .from('cohab_videos')
      .insert([{ title, description, duration, instructor, thumbnail_url, featured }])
      .select();

    if (error) {
      showToast(`\u274c Error: ${error.message}`);
      return;
    }

    if (featured) {
      videoItems.forEach(v => v.featured = false);
    }
    videoItems.unshift(data[0]);
    renderVideoteca();
    renderAdminVideosList();
    showToast(`\u2705 Video "${title}" creado`);

    document.getElementById('new-video-title').value = '';
    document.getElementById('new-video-desc').value = '';
    document.getElementById('new-video-duration').value = '';
    document.getElementById('new-video-instructor').value = '';
    document.getElementById('new-video-thumb').value = '';
    document.getElementById('new-video-featured').checked = false;
  } catch (error) {
    console.error('Create video error:', error);
    showToast('\u274c Error al crear video');
  }
}

async function handleDeleteVideo(id) {
  if (!confirm('\u00bfSeguro que quieres eliminar este video?')) return;

  try {
    const { error } = await _supabase
      .from('cohab_videos')
      .delete()
      .eq('id', id);

    if (error) {
      showToast(`\u274c Error: ${error.message}`);
      return;
    }

    videoItems = videoItems.filter(v => v.id !== id);
    renderVideoteca();
    renderAdminVideosList();
    showToast('\u2705 Video eliminado');
  } catch (error) {
    console.error('Delete video error:', error);
  }
}

function renderAdminVideosList() {
  const container = document.getElementById('admin-videos-list');
  if (!container) return;

  container.innerHTML = videoItems.map(v => `
    <div class="admin-list-item">
      <span class="item-emoji">${v.featured ? '\u2b50' : '\ud83c\udfac'}</span>
      <div class="item-info">
        <div class="item-title">${v.title}</div>
        <div class="item-sub">${v.instructor || ''} \u2022 ${v.duration || ''}</div>
      </div>
      <button class="delete-btn" onclick="handleDeleteVideo('${v.id}')">🗑️</button>
    </div>
  `).join('');
}

// =====================================================
// --- MERCADOPAGO CHECKOUT INTEGRATION ---
// =====================================================

async function startCheckoutMp() {
  if (!currentUser) return;
  
  const selectedIds = Object.keys(enrollmentCart);
  if (selectedIds.length === 0) {
    showToast("⚠️ El carrito está vacío");
    return;
  }

  showToast("Generando pago seguro...");
  const btn = document.querySelector('.mp-btn');
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.textContent = 'Procesando...';
  }

  try {
    // Procesamos el primer miembro del carrito
    const memberId = selectedIds[0]; 
    const selection = enrollmentCart[memberId];

    // Obtenemos el ID del servicio
    const { data: serviceData } = await _supabase
      .from('cohab_services')
      .select('id')
      .eq('name', selection.service.name)
      .single();

    const serviceId = serviceData?.id || "default";

    const bodyData = {
      items: [{
        id: serviceId,
        title: `Plan ${selection.service.name} (${selection.months} Meses)`,
        quantity: 1,
        unit_price: selection.price
      }],
      profile_id: memberId,
      service_id: serviceId,
      months: selection.months,
      origin_url: window.location.origin
    };

    const { data, error } = await _supabase.functions.invoke('create-preference', {
      body: bodyData
    });

    if (error) throw error;
    
    if (data?.init_point) {
      window.location.href = data.init_point;
    } else {
      throw new Error("No se devolvió la URL de pago");
    }
  } catch (err) {
    console.error("Error Checkout MP:", err);
    showToast("❌ Error al conectar con Mercado Pago");
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Pagar con Mercado Pago';
    }
  }
}
