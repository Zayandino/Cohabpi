async function handleCreateService() {
  const name = document.getElementById('new-service-name').value;
  const schedule = document.getElementById('new-service-schedule').value;
  const imageUrl = document.getElementById('new-service-image').value;
  const capacity = parseInt(document.getElementById('new-service-capacity').value) || 0;
  const type = document.getElementById('new-service-type').value;
  const requiresAttendance = document.getElementById('new-service-attendance').checked;
  const isExclusive = type === 'seminario';

  // Recoger Tiers
  const tierNames = document.querySelectorAll('#service-tiers-container .tier-name');
  const tierPrices = document.querySelectorAll('#service-tiers-container .tier-price');
  let tiers = [];
  for(let i=0; i<tierNames.length; i++) {
     const tName = tierNames[i].value.trim();
     const tPrice = parseInt(tierPrices[i].value);
     if (tName && !isNaN(tPrice)) {
        tiers.push({ name: tName, price: tPrice });
     }
  }

  // Fallback simple: Si no hay tiers, tomamos el primero vacío como base?
  // O podemos requerir al menos 1 tier
  if (!name || tiers.length === 0) {
    showToast("⚠️ Ingresa un nombre y al menos un Plan/Precio (Tier)");
    return;
  }

  // Usar el primer tier como precio base para compatibilidad
  const basePrice = tiers[0].price;

  showToast("Guardando disciplina...");

  const { error } = await _supabase
    .from('cohab_services')
    .insert([{ 
      name: name,
      price: basePrice,
      schedule: schedule,
      image_url: imageUrl,
      requires_quota: capacity > 0,
      capacity_limit: capacity,
      is_exclusive: isExclusive,
      requires_attendance: requiresAttendance,
      pricing_tiers: tiers
    }]);

  if (error) {
    showToast(`❌ Error: ${error.message}`);
  } else {
    showToast(`✅ Disciplina "${name}" creada con éxito`);
    
    // Limpiar inputs
    document.getElementById('new-service-name').value = '';
    document.getElementById('new-service-schedule').value = '';
    document.getElementById('new-service-image').value = '';
    document.getElementById('new-service-capacity').value = '';
    tierNames.forEach(i => i.value = '');
    tierPrices.forEach(i => i.value = '');
    
    renderAdminServicesList();
  }
}// --- Global State ---
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

// --- Utilities ---
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

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
      .select('role, name, belt')
      .eq('id', user.id)
      .single();

    let displayName = profile?.name;
    if (!displayName || displayName.trim() === '' || displayName.includes('@')) {
      displayName = '';
    }
    
    const isAdmin = profile?.role === 'admin' || user.email === 'ambler.eduardo@gmail.com';
    
    // Auto-fix admin role if needed
    if (user.email === 'ambler.eduardo@gmail.com') {
      displayName = 'Eduardo Javier Ambler Rios';
      if (profile?.role !== 'admin') {
        _supabase.from('cohab_profiles').update({ role: 'admin', name: 'Eduardo Javier Ambler Rios', belt: 'black' }).eq('id', user.id).then();
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
        { id: data.user.id, name: email.split('@')[0], role: 'alumno' }
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
    .select('role, name, belt')
    .eq('id', data.user.id)
    .single();

  let displayName = profile?.name;
  if (!displayName || displayName.trim() === '' || displayName.includes('@')) {
    displayName = '';
  }

  const isAdmin = profile?.role === 'admin' || email === 'ambler.eduardo@gmail.com';
  
  // Auto-fix admin role and belt if needed
  if (email === 'ambler.eduardo@gmail.com') {
    displayName = 'Eduardo Javier Ambler Rios';
    if (profile?.role !== 'admin') {
      _supabase.from('cohab_profiles').update({ role: 'admin', name: 'Eduardo Javier Ambler Rios', belt: 'black' }).eq('id', data.user.id).then();
    }
  }

  loginSuccess(displayName, isAdmin, data.user.id, email);
}

async function loginSuccess(name, isAdmin, userId, email) {
  currentUser = { name, isAdmin, id: userId, email };

  // Fetch the full profile to check Onboarding status
  const { data: myProfile } = await _supabase
    .from('cohab_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (myProfile) {
    currentUser.status = myProfile.status;
    currentUser.belt = myProfile.belt || 'white';
  }

  // Visual Transitions
  document.getElementById('screen-auth').style.display = 'none';
  document.getElementById('app-main-content').style.display = 'block';

  // Check Onboarding
  if (!myProfile?.waiver_signed && !isAdmin) {
    // Force onboarding
    document.getElementById('bottom-nav').style.display = 'none';
    navigateTo('onboarding');
    return; // Stop here, do not load other things yet
  }

  // Update UI Elements
  const userDisplay = document.getElementById('user-display-name');
  const adminBadge = document.getElementById('admin-badge');
  const statusCard = document.getElementById('status-card-dashboard');
  const navServicios = document.getElementById('nav-servicios');
  const navPagos = document.getElementById('nav-pagos');

  if (userDisplay) userDisplay.textContent = name;

  // Admin badge - estilo Cinturón Negro para Sensei Eduardo
  if (adminBadge) {
    adminBadge.style.display = isAdmin ? 'inline-block' : 'none';
    if (isAdmin) {
      adminBadge.textContent = '⚫ Cinturón Negro';
      adminBadge.style.cssText = 'background:linear-gradient(135deg,#1a1a1a,#333); color:#FFD700; border:1px solid #FFD700; border-radius:12px; padding:3px 10px; font-size:0.75rem; font-weight:700; display:inline-block;';
    }
  }
  if (statusCard) statusCard.style.display = isAdmin ? 'none' : 'block';
  if (navPagos) navPagos.style.display = isAdmin ? 'none' : 'flex';
  
  // Mostrar Panel Admin dentro del Perfil solo a Admins
  const adminPanelContainer = document.getElementById('admin-panel-container');
  if (adminPanelContainer) {
    adminPanelContainer.style.display = isAdmin ? 'block' : 'none';
  }

  // Actualizar cinturón en el widget del dashboard
  const beltNames = { 'white':'Cinturón Blanco','blue':'Cinturón Azul','purple':'Cinturón Morado','brown':'Cinturón Marrón','black':'Cinturón Negro','No Belt':'Sin Cinturón' };
  const userBelt = currentUser.belt || 'white';
  const beltNameEl = document.getElementById('current-belt-name');
  const beltPreviewEl = document.getElementById('belt-preview');
  if (beltNameEl) beltNameEl.textContent = beltNames[userBelt] || userBelt;
  if (beltPreviewEl) beltPreviewEl.className = 'belt-visual belt-' + userBelt;

  document.getElementById('bottom-nav').style.display = 'flex';

  if (isAdmin) {
    updateAdminMetrics();
    fetchAllStudents();
    renderAdminServicesList();
  }
  renderDiscountsList();
  if (isAdmin) renderAdminDiscountsList();

  // Fetch Family Data dynamically instead of relying on hardcoded array
  await fetchFamilyMembers();

  // Route: admins go to admin panel, students to dashboard
  navigateTo('dashboard');
}

async function submitOnboarding() {
  const phone = document.getElementById('onboarding-phone').value;
  const emergency = document.getElementById('onboarding-emergency').value;
  const waiver = document.getElementById('onboarding-waiver').checked;

  if (!phone || !emergency) {
    showToast('⚠️ Por favor completa todos tus datos');
    return;
  }
  
  if (!waiver) {
    showToast('⚠️ Debes aceptar el acuerdo de riesgos');
    return;
  }

  showToast('Guardando tu perfil...');

  const { error } = await _supabase
    .from('cohab_profiles')
    .update({ 
      phone: phone, 
      emergency_contact: emergency,
      waiver_signed: true 
    })
    .eq('id', currentUser.id);

  if (error) {
    showToast(`❌ Error: ${error.message}`);
    return;
  }

  showToast('✅ ¡Perfil completado!');
  celebrate();
  
  // Reload data and proceed to dashboard
  await fetchFamilyMembers();
  document.getElementById('bottom-nav').style.display = 'flex';
  navigateTo('dashboard');
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
    nameInput.value = profile.name || '';
    phoneInput.value = profile.phone || '';

    if (nameDisplay) nameDisplay.textContent = profile.name || ' ';
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
      name: newName,
      phone: newPhone
    })
    .eq('id', currentUser.id);

  if (error) {
    showToast("Error al actualizar perfil ❌");
    console.error(error);
  } else {
    showToast("Perfil actualizado con éxito ✅");
    const nameDisplay = document.getElementById('profile-full-name-display');
    const navDisplay = document.getElementById('user-display-name');
    if (nameDisplay) nameDisplay.textContent = newName;
    if (navDisplay) navDisplay.textContent = newName;
  }
}

// Update Screen Navigation
function navigateTo(screenName) {
  try {
    const screens = document.querySelectorAll('.screen');
    const navItems = document.querySelectorAll('.nav-tab');

    screens.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(`screen-${screenName}`);
    if (target) target.classList.add('active');

    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.screen === screenName) item.classList.add('active');
    });

    if (screenName === 'profile') {
      loadProfileData();
      if (typeof renderAdminServicesList === 'function') renderAdminServicesList();
      if (typeof renderAdminNewsList === 'function') renderAdminNewsList();
      if (typeof renderAdminVideosList === 'function') renderAdminVideosList();
      if (typeof renderAdminDiscountsList === 'function') renderAdminDiscountsList();
    }
    if (screenName === 'videoteca') fetchVideos();
    if (screenName === 'dashboard') { fetchAttendance(); renderQuickActions(dashboardMemberId); }
    if (screenName === 'novedades') fetchNews();
    if (screenName === 'descuentos' && typeof renderDiscountsList === 'function') renderDiscountsList();

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
// --- Visual Effects ---
function celebrate() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 1000
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}

// --- Quick Actions Logic ---
async function renderQuickActions(memberId) {
  const container = document.getElementById('quick-actions-container');
  if (!container) return;

  container.innerHTML = '';
  container.style.display = 'none';

  const actions = [];

  // 1. Check Attendance today
  const today = new Date().toDateString();
  const checkedToday = attendanceRecords.some(r => new Date(r.checked_at).toDateString() === today);
  
  if (!checkedToday && memberId === 'me') {
    actions.push({
      label: 'Marcar Clase',
      icon: '🥋',
      class: 'action-checkin',
      fn: 'handleCheckIn()'
    });
  }

  // 2. Check Subscription status
  const { data: subs } = await _supabase
    .from('cohab_subscriptions')
    .select('end_date, status')
    .eq('profile_id', memberId === 'me' ? currentUser.id : memberId)
    .eq('status', 'active')
    .order('end_date', { ascending: false })
    .limit(1);

  const isExpired = !subs || subs.length === 0 || new Date(subs[0].end_date) < new Date();
  
  if (isExpired) {
    actions.push({
      label: 'Renovar Plan',
      icon: '💳',
      class: 'action-pay',
      fn: "navigateTo('pagos')"
    });
  } else {
     // If active, maybe suggest a video
     actions.push({
       label: 'Ver Técnica',
       icon: '🎬',
       class: 'action-video',
       fn: "navigateTo('videoteca')"
     });
  }

  if (actions.length > 0) {
    container.style.display = 'flex';
    container.innerHTML = actions.map(a => `
      <button class="quick-action-btn ${a.class}" onclick="${a.fn}">
        <span class="q-icon">${a.icon}</span>
        <span class="q-label">${a.label}</span>
      </button>
    `).join('');
  }
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
async function startCheckoutMp() {
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
    celebrate();

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

  container.innerHTML = services.map(s => {
    const isExcl = s.is_exclusive ? '<span style="background:var(--aurora); color:#000; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:8px;">Exclusiva</span>' : '';
    const tiersStr = (s.pricing_tiers && s.pricing_tiers.length > 0) 
      ? s.pricing_tiers.map(t => `<li style="margin-bottom:2px;">${t.name}: ${formats.format(t.price)}</li>`).join('')
      : `<li>Precio Base: ${formats.format(s.price || s.base_price || 0)}</li>`;

    return `
    <div class="service-card-full" style="flex-direction:column; align-items:flex-start; padding:15px; border-left: 3px solid var(--crimson-bright); width: 100%; box-sizing:border-box;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; margin-bottom:10px;">
        <div class="service-name-text" style="font-size:1.1rem; line-height: 1.3;">
          ${s.name} ${isExcl}
        </div>
        <button class="auth-btn" style="background:rgba(255,50,50,0.1); color:var(--crimson); padding:5px 10px; font-size:0.75rem; min-width:auto; height:auto; border-radius:4px;" onclick="handleDeleteService('${s.id}')">
          Eliminar
        </button>
      </div>
      <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px; line-height:1.5;">
        ⏱️ <b>Horario:</b> ${s.schedule || 'No definido'}<br>
        👥 <b>Cupos:</b> ${s.capacity_limit > 0 ? s.capacity_limit : 'Sin límite'}<br>
        📍 <b>Asistencia:</b> ${s.requires_attendance ? 'Obligatoria' : 'Opcional'}
      </div>
      <div style="background:var(--bg-glass-strong); padding:10px; border-radius:8px; width:100%; box-sizing:border-box;">
        <strong style="font-size:0.85rem; color:var(--text-light); margin-bottom:5px; display:block;">Planes Disponibles:</strong>
        <ul style="margin:0 0 0 15px; font-size:0.85rem; color:var(--aurora); padding-left: 5px;">
          ${tiersStr}
        </ul>
      </div>
    </div>
    `;
  }).join('');
}

function openPlanSelector(memberId) {
  currentMemberId = memberId;
  const modal = document.getElementById('plan-modal');
  const title = document.getElementById('plan-modal-title');
  const member = familyMembers.find(m => m.id === memberId);
  const nameLabel = member.id === currentUser?.id ? 'mi plan' : `plan para ${member.name}`;
  
  title.textContent = `Elegir ${nameLabel}`;
  
  activeService = null;
  document.getElementById('modal-duration-section').style.display = 'none';
  document.getElementById('modal-confirm-btn').style.opacity = '0.5';
  document.getElementById('modal-confirm-btn').style.pointerEvents = 'none';

  renderModalServiceCatalog();
  modal.style.display = 'flex';
}

function closePlanSelector() {
  document.getElementById('plan-modal').style.display = 'none';
}

function addNewMember() {
  openAddMemberModal();
}

function openAddMemberModal() {
  const input = document.getElementById('new-member-name');
  if (input) input.value = '';
  document.getElementById('add-member-modal').style.display = 'flex';
}

function closeAddMemberModal() {
  document.getElementById('add-member-modal').style.display = 'none';
}

async function confirmAddMember() {
  const input = document.getElementById('new-member-name');
  const name = input ? input.value.trim() : '';
  
  if (!name) {
    showToast('⚠️ Ingresa un nombre válido');
    return;
  }

  closeAddMemberModal();
  showToast("Añadiendo familiar...");

  const { data: myProfile } = await _supabase
    .from('cohab_profiles')
    .select('email, phone')
    .eq('id', currentUser.id)
    .single();

  const { data, error } = await _supabase
    .from('cohab_profiles')
    .insert([
      { 
        parent_id: currentUser.id, 
        name: name, 
        relationship: 'Familiar',
        email: myProfile?.email || null,
        phone: myProfile?.phone || null,
        role: 'alumno',
        belt: 'white',
        status: 'activo'
      }
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
    belt: d.belt || 'white',
    graus: d.graus || 0,
    progress: 0,
    attendance: []
  });

  renderFamilyDashboardSwitch();
  if (typeof renderFamilyCart === 'function') renderFamilyCart();
  showToast(`✅ ${name} añadido a tu cuenta.`);
}

function renderModalServiceCatalog() {
  const container = document.getElementById('modal-service-catalog');
  if (!container) return;
  const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

  container.innerHTML = services.map(s => {
    const displayPrice = (s.pricing_tiers && s.pricing_tiers.length > 0)
      ? s.pricing_tiers[0].price
      : (s.price || s.base_price || 0);
    const exclBadge = s.is_exclusive ? '<span style="background:var(--aurora);color:#000;font-size:0.6rem;padding:2px 4px;border-radius:4px;margin-left:5px;">EXCL</span>' : '';
    return `
    <div class="service-card-full ${activeService?.name === s.name ? 'active' : ''}" onclick="selectModalService('${s.name}')">
      <div class="service-icon-box">${s.icon || '🥋'}</div>
      <div class="service-info-box">
        <div class="service-name-text">${s.name} ${exclBadge}</div>
        <div class="service-price-text">desde ${formats.format(displayPrice)} /mes</div>
      </div>
    </div>
  `}).join('');
}

function selectModalService(serviceName) {
  activeService = services.find(s => s.name === serviceName);
  renderModalServiceCatalog();

  const monthlyPrice = (activeService.pricing_tiers && activeService.pricing_tiers.length > 0)
    ? activeService.pricing_tiers[0].price
    : (activeService.price || activeService.base_price || 0);
  const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

  // Update Modal Prices
  document.getElementById('modal-price-1m').textContent = formats.format(monthlyPrice);
  document.getElementById('modal-old-3m').textContent = formats.format(monthlyPrice * 3);
  document.getElementById('modal-new-3m').textContent = formats.format(monthlyPrice * 3 * 0.9);
  document.getElementById('modal-old-6m').textContent = formats.format(monthlyPrice * 6);
  document.getElementById('modal-new-6m').textContent = formats.format(monthlyPrice * 6 * 0.85);
  document.getElementById('modal-old-12m').textContent = formats.format(monthlyPrice * 12);
  document.getElementById('modal-new-12m').textContent = formats.format(monthlyPrice * 12 * 0.75);

  document.getElementById('modal-duration-section').style.display = 'block';
  // Reset confirmation button until duration is picked
  document.getElementById('modal-confirm-btn').style.opacity = '0.5';
  document.getElementById('modal-confirm-btn').style.pointerEvents = 'none';
}

let pendingDuration = null;
function selectModalDuration(months) {
  pendingDuration = months;
  // Visual feedback for selected plan card
  const cards = document.querySelectorAll('#modal-duration-section .plan-card');
  cards.forEach(c => c.style.borderColor = 'rgba(255,255,255,0.05)');
  
  let index = 0;
  if(months === 3) index = 1;
  if(months === 6) index = 2;
  if(months === 12) index = 3;
  
  if (cards[index]) {
    cards[index].style.borderColor = 'var(--crimson-bright)';
  }

  // Enable confirm button
  const btn = document.getElementById('modal-confirm-btn');
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'auto';
}

function confirmPlanSelection() {
  if (!activeService || !pendingDuration) return;

  const monthlyPrice = activeService.discountPrice;
  let finalPrice = monthlyPrice * pendingDuration;

  if (pendingDuration === 3) finalPrice *= 0.9;
  if (pendingDuration === 6) finalPrice *= 0.85;
  if (pendingDuration === 12) finalPrice *= 0.75;

  enrollmentCart[currentMemberId] = {
    service: activeService,
    months: pendingDuration,
    price: finalPrice
  };

  closePlanSelector();
  renderFamilyCart();
  updateCheckoutSummary();
  showToast(`✅ Plan actualizado exitosamente.`);
}

function updateCheckoutSummary() {
  const summaryBox = document.getElementById('checkout-summary');
  const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

  const selectedIds = Object.keys(enrollmentCart);
  if (selectedIds.length === 0) {
    summaryBox.style.display = 'none';
    return;
  }

  summaryBox.style.display = 'block';
  let totalPay = 0;

  selectedIds.forEach(id => {
    totalPay += enrollmentCart[id].price;
  });

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

const TODAY_CLASSES = [
  { id: 'bjj_am', name: 'BJJ Mediodía', time: '13:00', icon: '🥋' },
  { id: 'bjj_pm', name: 'BJJ Noche', time: '20:00', icon: '🥋' },
  { id: 'nogi', name: 'NoGi', time: '21:00', icon: '🤼' }
];

function renderAttendanceUI() {
  const countEl = document.getElementById('attendance-count');
  if (countEl) countEl.textContent = attendanceRecords.length;

  const today = new Date().toDateString();
  const listEl = document.getElementById('today-classes-list');
  
  if (listEl) {
    listEl.innerHTML = TODAY_CLASSES.map(cls => {
      // Check if user attended this specific class today
      const attended = attendanceRecords.some(
        r => new Date(r.checked_at).toDateString() === today && r.class_type === cls.id
      );

      if (attended) {
        return `
          <div class="class-card attended">
            <div class="class-info">
              <span class="class-icon">${cls.icon}</span>
              <div>
                <div class="class-name">${cls.name}</div>
                <div class="class-time">${cls.time}</div>
              </div>
            </div>
            <button class="checkin-btn disabled" disabled>
              ✔ Listo
            </button>
          </div>
        `;
      } else {
        return `
          <div class="class-card">
            <div class="class-info">
              <span class="class-icon">${cls.icon}</span>
              <div>
                <div class="class-name">${cls.name}</div>
                <div class="class-time">${cls.time}</div>
              </div>
            </div>
            <button class="checkin-btn" onclick="handleCheckIn('${cls.id}', '${cls.name}')">
              Marcar
            </button>
          </div>
        `;
      }
    }).join('');
  }

  // Actualizar Quick Actions si aplica
  if (typeof renderQuickActions === 'function' && typeof dashboardMemberId !== 'undefined') {
    renderQuickActions(dashboardMemberId);
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

async function handleCheckIn(classId = 'BJJ', className = 'Clase') {
  if (!currentUser) return;

  const today = new Date().toDateString();
  const alreadyChecked = attendanceRecords.some(
    r => new Date(r.checked_at).toDateString() === today && r.class_type === classId
  );

  if (alreadyChecked) {
    showToast(`⚠️ Ya registraste tu asistencia en ${className} hoy`);
    return;
  }

  showToast(`Registrando asistencia en ${className}...`);

  try {
    const { data, error } = await _supabase
      .from('cohab_attendance')
      .insert([{ profile_id: currentUser.id, class_type: classId }])
      .select();

    if (error) {
      showToast(`❌ Error: ${error.message}`);
      return;
    }

    attendanceRecords.unshift(data[0]);
    renderAttendanceUI();
    celebrate();
    showToast(`✅ ¡Asistencia en ${className} registrada! Sigue entrenando 🥋`);
  } catch (error) {
    console.error('Check-in error:', error);
    showToast('❌ Error al registrar asistencia');
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

  container.innerHTML = newsItems.map(n => {
    const isLink = n.link_url && n.link_url.trim() !== '';
    const wrapperStart = isLink ? `<a href="${n.link_url}" target="_blank" style="text-decoration:none; color:inherit; display:block;">` : '';
    const wrapperEnd = isLink ? '</a>' : '';
    const linkIcon = isLink ? '<span style="margin-left:auto; font-size:0.8rem; color:var(--text-muted);">\ud83d\udd17</span>' : '';

    return `
      ${wrapperStart}
      <div class="news-item" style="${isLink ? 'cursor:pointer;' : ''}">
        <span class="news-emoji">${n.emoji || '\ud83d\udce2'}</span>
        <div style="flex:1;">
          <div class="news-name">${n.title}</div>
          <div class="news-date">${n.subtitle || ''}</div>
        </div>
        ${linkIcon}
      </div>
      ${wrapperEnd}
    `;
  }).join('');
}

async function handleCreateNews() {
  const title = document.getElementById('new-news-title').value;
  const subtitle = document.getElementById('new-news-subtitle').value;
  const emoji = document.getElementById('new-news-emoji').value || '\ud83d\udce2';
  const linkEl = document.getElementById('new-news-link');
  const link_url = linkEl ? linkEl.value : null;

  if (!title) {
    showToast('\u26a0\ufe0f Ingresa un t\u00edtulo');
    return;
  }

  showToast('Creando novedad...');

  try {
    const { data, error } = await _supabase
      .from('cohab_news')
      .insert([{ title, subtitle, emoji, link_url }])
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
    if (linkEl) linkEl.value = '';
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

function openVideoPlayer(videoUrl) {
  if (!videoUrl) {
    showToast('⚠️ No hay URL de video disponible');
    return;
  }
  
  // Extract YouTube ID
  let videoId = '';
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = videoUrl.match(ytRegex);
  
  if (match && match[1]) {
    videoId = match[1];
  } else {
    // Try to use it as a direct link if not a standard YT link
    window.open(videoUrl, '_blank');
    return;
  }

  const iframe = document.getElementById('youtube-iframe');
  if (iframe) {
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  }
  
  document.getElementById('video-player-modal').style.display = 'flex';
}

function closeVideoPlayer() {
  document.getElementById('video-player-modal').style.display = 'none';
  const iframe = document.getElementById('youtube-iframe');
  if (iframe) iframe.src = '';
}

function renderVideoteca() {
  const featuredContainer = document.getElementById('featured-video-container');
  const gridContainer = document.getElementById('video-grid');
  const descEl = document.getElementById('featured-video-desc');
  const paywallOverlay = document.getElementById('videoteca-paywall');

  // Evaluar status del usuario para el Paywall
  const isPremium = currentUser && currentUser.status === 'activo';
  if (paywallOverlay) {
    paywallOverlay.style.display = isPremium ? 'none' : 'flex';
  }

  const featured = videoItems.find(v => v.featured) || videoItems[0];
  const others = videoItems.filter(v => v.id !== featured?.id);

  if (featuredContainer && featured) {
    featuredContainer.innerHTML = `
      <div class="featured-video" ${isPremium ? `onclick="openVideoPlayer('${featured.video_url || ''}')" style="cursor:pointer;"` : ''}>
        <img src="${featured.thumbnail_url || 'assets/thumb-1.png'}" alt="${featured.title}">
        <div class="vid-overlay">
          <div class="vid-play">
            <svg viewBox="0 0 24 24"><polygon points="7,4 20,12 7,20" /></svg>
          </div>
          <span class="vid-label">Técnica Destacada</span>
          <h2 class="vid-title">${featured.title}</h2>
          <div class="vid-meta">${featured.instructor || 'Instructor'} • ${featured.duration || ''}</div>
        </div>
      </div>
    `;
    if (descEl) descEl.textContent = featured.description || '';
  } else if (featuredContainer) {
    featuredContainer.innerHTML = '<div style="padding:40px 20px; text-align:center; color:var(--text-muted);">No hay videos aún</div>';
    if (descEl) descEl.textContent = '';
  }

  if (gridContainer) {
    gridContainer.innerHTML = others.map(v => `
      <div class="thumb-card" ${isPremium ? `onclick="openVideoPlayer('${v.video_url || ''}')" style="cursor:pointer;"` : ''}>
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
  const instructor = document.getElementById('new-video-instructor').value || 'Prof. Andrés';
  const thumbnail_url = document.getElementById('new-video-thumb').value;
  const video_url = document.getElementById('new-video-url') ? document.getElementById('new-video-url').value : null;
  const featured = document.getElementById('new-video-featured').checked;

  if (!title) {
    showToast('⚠️ Ingresa un título para el video');
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
      .insert([{ title, description, duration, instructor, thumbnail_url, video_url, featured }])
      .select();

    if (error) {
      showToast(`❌ Error: ${error.message}`);
      return;
    }

    if (featured) {
      videoItems.forEach(v => v.featured = false);
    }
    videoItems.unshift(data[0]);
    renderVideoteca();
    renderAdminVideosList();
    showToast(`✅ Video "${title}" creado`);

    document.getElementById('new-video-title').value = '';
    document.getElementById('new-video-desc').value = '';
    document.getElementById('new-video-duration').value = '';
    document.getElementById('new-video-instructor').value = '';
    document.getElementById('new-video-thumb').value = '';
    if (document.getElementById('new-video-url')) document.getElementById('new-video-url').value = '';
    document.getElementById('new-video-featured').checked = false;
  } catch (error) {
    console.error('Create video error:', error);
    showToast('❌ Error al crear video');
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

// =====================================================
// --- SANDBOX / TESTING FLOW MODULE ---
// =====================================================

async function resetTestData() {
  if (!confirm("Esto eliminará tu asistencia y suscripciones de prueba para reiniciar el flujo. ¿Continuar?")) return;
  
  showToast("Reiniciando datos de prueba...");
  
  try {
    // 1. Delete Attendance
    await _supabase.from('cohab_attendance').delete().eq('profile_id', currentUser.id);
    
    // 2. Delete Subscriptions
    await _supabase.from('cohab_subscriptions').delete().eq('profile_id', currentUser.id);
    
    // 3. Delete Family members and their data
    const { data: family } = await _supabase.from('cohab_family_members').select('id').eq('parent_id', currentUser.id);
    if (family && family.length > 0) {
      const ids = family.map(f => f.id);
      await _supabase.from('cohab_subscriptions').delete().in('family_member_id', ids);
      await _supabase.from('cohab_family_members').delete().eq('parent_id', currentUser.id);
    }

    showToast("✅ Datos reseteados. Iniciando flujo...");
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    console.error("Reset error:", err);
    showToast("❌ Error al resetear datos");
  }
}

async function simulateMembershipExpiry() {
  showToast("Simulando vencimiento...");
  
  try {
    const { error } = await _supabase
      .from('cohab_subscriptions')
      .update({ end_date: new Date(Date.now() - 86400000).toISOString().split('T')[0] }) // Yesterday
      .eq('profile_id', currentUser.id)
      .eq('status', 'active');

    if (error) throw error;
    
    showToast("⌛ Membresía vencida simulada");
    setTimeout(() => navigateTo('dashboard'), 1000);
  } catch (err) {
    console.error("Expiry simulation error:", err);
    showToast("❌ Error al simular vencimiento");
  }
}

let tourStep = 0;
function startGuidedTour() {
  tourStep = 1;
  const guideBox = document.getElementById('tour-guide-box');
  const stepText = document.getElementById('tour-step-text');
  
  if (guideBox && stepText) {
    guideBox.style.display = 'block';
    stepText.innerHTML = "🏁 <b>Tour Iniciado:</b> Ve al Dashboard para ver tu estado actual.";
    navigateTo('dashboard');
    
    // Watch for state changes to progress the tour
    setTimeout(() => {
       stepText.innerHTML = "💡 <b>Paso 2:</b> Si tu membresía está vencida, aparecerá el botón 'Renovar Plan' en Acciones Rápidas. ¡Haz clic en él!";
    }, 4000);
  }
}



// ==========================================
// MÓDULO DE DESCUENTOS (FASE 4)
// ==========================================

async function handleCreateDiscount() {
  const title = document.getElementById('new-discount-title').value;
  const code = document.getElementById('new-discount-code').value;
  const imageUrl = document.getElementById('new-discount-image').value;

  if (!title || !code) {
    showToast("⚠️ Ingresa título y código del descuento");
    return;
  }

  showToast("Creando beneficio...");

  const { error } = await _supabase
    .from('cohab_discounts')
    .insert([{ title, code, image_url: imageUrl }]);

  if (error) {
    showToast(`❌ Error: ${error.message}`);
  } else {
    showToast(`✅ Beneficio creado con éxito`);
    document.getElementById('new-discount-title').value = '';
    document.getElementById('new-discount-code').value = '';
    document.getElementById('new-discount-image').value = '';
    renderAdminDiscountsList();
  }
}

async function renderAdminDiscountsList() {
  const list = document.getElementById('admin-discounts-list');
  if (!list) return;

  const { data, error } = await _supabase.from('cohab_discounts').select('*').order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">No hay beneficios creados.</p>';
    return;
  }

  list.innerHTML = data.map(d => `
    <div class="service-card" style="border: 1px dashed #F59E0B; background: rgba(245, 158, 11, 0.05);">
      ${d.image_url ? `<img src="${d.image_url}" style="width:100%; height:120px; object-fit:cover; border-radius:8px 8px 0 0;">` : ''}
      <div style="padding: 15px;">
        <h4 style="color:#F59E0B; margin-bottom:8px;">${d.title}</h4>
        <div style="background:#000; border:1px solid #333; padding:8px; border-radius:4px; text-align:center; letter-spacing:2px; font-weight:bold; font-family:monospace; margin-bottom:12px;">${d.code}</div>
        <button class="auth-btn" style="background:rgba(239, 68, 68, 0.1); color:#EF4444; border:1px solid rgba(239, 68, 68, 0.2); padding:8px; font-size:0.8rem;" onclick="deleteDiscount('${d.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

async function deleteDiscount(id) {
  if(!confirm("¿Estás seguro de eliminar este beneficio?")) return;
  const { error } = await _supabase.from('cohab_discounts').delete().eq('id', id);
  if (!error) {
    showToast("✅ Beneficio eliminado");
    renderAdminDiscountsList();
  }
}

async function renderDiscountsList() {
  const list = document.getElementById('discounts-list');
  if (!list) return;

  const { data, error } = await _supabase.from('cohab_discounts').select('*').order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    list.innerHTML = '<div class="empty-state">Aún no hay descuentos disponibles. ¡Vuelve pronto!</div>';
    return;
  }

  list.innerHTML = data.map(d => `
    <div class="service-card" style="position:relative; overflow:hidden; border: 1px dashed var(--aurora); background: linear-gradient(180deg, var(--bg-elevated) 0%, rgba(56, 189, 248, 0.05) 100%);">
      ${d.image_url ? `<img src="${d.image_url}" style="width:100%; height:150px; object-fit:cover; border-radius:8px 8px 0 0; border-bottom:1px solid rgba(255,255,255,0.05);">` : ''}
      <div style="padding: 20px;">
        <h4 style="color:var(--text-white); font-size:1.1rem; margin-bottom:10px; font-family:var(--font-display);">${d.title}</h4>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Usa este código exclusivo al momento de pagar o mostrar en la tienda.</p>
        <div style="background:var(--bg-deep); border:1px dashed var(--aurora); padding:12px; border-radius:8px; text-align:center; letter-spacing:3px; font-weight:800; font-family:monospace; color:var(--aurora); display:flex; align-items:center; justify-content:center; gap:10px;">
          ${d.code}
          <button onclick="navigator.clipboard.writeText('${d.code}'); showToast('Código copiado ✅')" style="background:none; border:none; color:var(--text-light); cursor:pointer;">📋</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ==========================================
// MÓDULO SÚPER ADMINISTRADOR - MÉTRICAS Y GRADUACIONES (FASE 4 PENDIENTES)
// ==========================================

async function updateAdminMetrics() {
  try {
    // 1. Contar estudiantes activos
    const { count: studentCount, error: countErr } = await _supabase
      .from('cohab_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'activo');

    // 2. Sumar recaudación del mes actual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const { data: payments, error: payErr } = await _supabase
      .from('cohab_payments')
      .select('amount')
      .eq('status', 'approved')
      .gte('payment_date', startOfMonth.toISOString());

    let totalRevenue = 0;
    if (payments) {
      totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    }

    const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

    const revEl = document.getElementById('admin-revenue');
    const actEl = document.getElementById('admin-active-count');

    if (revEl) revEl.textContent = formats.format(totalRevenue);
    if (actEl) actEl.textContent = studentCount !== null ? studentCount : '0';

  } catch (error) {
    console.error('Error updating admin metrics:', error);
  }
}

async function fetchAllStudents() {
  try {
    const studentList = document.getElementById('admin-student-list');
    const paymentsList = document.getElementById('admin-payments-list');

    // --- 1. Cargar alumnos para graduaciones ---
    if (studentList) {
      studentList.innerHTML = '<div class="loading-spinner">Cargando alumnos...</div>';
      const { data: students, error: studentError } = await _supabase
        .from('cohab_profiles')
        .select('*')
        .order('name');

      if (studentError) throw studentError;

      if (!students || students.length === 0) {
        studentList.innerHTML = '<p class="empty-state">No hay alumnos registrados.</p>';
      } else {
        const beltLabels = {
          'white': '⚪ Blanco',
          'blue': '🔵 Azul',
          'purple': '🟣 Morado',
          'brown': '🟤 Marrón',
          'black': '⚫ Negro',
          'No Belt': '🥋 Sin Cinturón'
        };

        studentList.innerHTML = students.map(st => {
          const selectOptions = Object.entries(beltLabels).map(([key, label]) => {
            return `<option value="${key}" ${st.belt === key ? 'selected' : ''}>${label}</option>`;
          }).join('');

          return `
            <div class="service-card-full" style="padding: 15px; margin-bottom: 10px; border-left: 3px solid var(--aurora); width: 100%; box-sizing: border-box; display: block; background: var(--bg-glass);">
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:10px; flex-wrap:wrap;">
                <div>
                  <h4 style="color:var(--text-white); margin:0 0 5px 0; font-size:1.05rem;">${st.name || 'Sin Nombre'}</h4>
                  <span style="font-size:0.8rem; color:var(--text-muted);">${st.email || 'Sin correo'}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <select onchange="updateStudentBelt('${st.id}', this.value)" style="background:var(--bg-deep); color:var(--text-white); border:1px solid rgba(255,255,255,0.1); padding:6px 12px; border-radius:6px; font-size:0.85rem; cursor:pointer;">
                    ${selectOptions}
                  </select>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // --- 2. Cargar pagos para control mensual ---
    if (paymentsList) {
      paymentsList.innerHTML = '<div class="loading-spinner">Cargando pagos...</div>';
      const { data: payments, error: payError } = await _supabase
        .from('cohab_payments')
        .select('*, cohab_profiles(name)')
        .order('payment_date', { ascending: false });

      if (payError) throw payError;

      if (!payments || payments.length === 0) {
        paymentsList.innerHTML = '<p class="empty-state">No hay registros de pagos.</p>';
      } else {
        const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

        paymentsList.innerHTML = payments.map(p => {
          const payerName = p.cohab_profiles?.name || 'Usuario Desconocido';
          const isApproved = p.status === 'approved';
          const statusBadge = isApproved 
            ? '<span style="background:rgba(52, 211, 153, 0.15); color:#34D399; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold;">Aprobado</span>'
            : '<span style="background:rgba(245, 158, 11, 0.15); color:#F59E0B; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold;">Pendiente</span>';

          const approveBtn = !isApproved
            ? `<button class="auth-btn" onclick="approvePaymentDirect('${p.id}')" style="background:var(--aurora); color:#000; padding:4px 8px; font-size:0.75rem; min-width:auto; height:auto; border-radius:4px; border:none; cursor:pointer;">Aprobar</button>`
            : '';

          const paymentDate = p.payment_date ? new Date(p.payment_date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' }) : 'Sin fecha';

          return `
            <div class="service-card-full" style="padding: 15px; margin-bottom: 10px; border-left: 3px solid ${isApproved ? '#34D399' : '#F59E0B'}; width: 100%; box-sizing: border-box; display: block; background: var(--bg-glass);">
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:10px; flex-wrap:wrap;">
                <div>
                  <h4 style="color:var(--text-white); margin:0 0 5px 0; font-size:1.05rem;">${payerName}</h4>
                  <span style="font-size:0.8rem; color:var(--text-muted);">${paymentDate} • <b>${formats.format(p.amount)}</b></span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  ${statusBadge}
                  ${approveBtn}
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

  } catch (error) {
    console.error('Error fetching admin student data:', error);
  }
}

async function updateStudentBelt(studentId, newBelt) {
  try {
    showToast("Actualizando cinturón...");
    const { error } = await _supabase
      .from('cohab_profiles')
      .update({ belt: newBelt })
      .eq('id', studentId);

    if (error) throw error;
    showToast("🥋 Graduación actualizada con éxito");
    fetchAllStudents();
  } catch (error) {
    console.error("Error updating belt:", error);
    showToast("❌ Error al graduar alumno");
  }
}

async function approvePaymentDirect(paymentId) {
  try {
    showToast("Aprobando pago...");
    const { error } = await _supabase
      .from('cohab_payments')
      .update({ status: 'approved' })
      .eq('id', paymentId);

    if (error) throw error;
    showToast("💰 Pago aprobado con éxito");
    updateAdminMetrics();
    fetchAllStudents();
  } catch (error) {
    console.error("Error approving payment:", error);
    showToast("❌ Error al aprobar pago");
  }
}

// =====================================================
// --- CODIGO DE SOPORTE FAMILIAR Y GESTIÓN REINTRODUCIDO ---
// =====================================================

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
  if (member) {
    updateRankDisplay(member);
  }
}

function updateRankDisplay(member) {
  const beltName = document.getElementById('current-belt-name');
  const beltPreview = document.getElementById('belt-preview');
  const stripeContainer = document.getElementById('belt-stripes-container');
  const grausText = document.getElementById('current-graus-text');
  const progressFill = document.getElementById('rank-progress-fill');
  const progressText = document.getElementById('progress-percent-text');

  if (!beltName || !beltPreview) return;

  const beltMap = {
    white: 'Cinturón Blanco',
    blue: 'Cinturón Azul',
    purple: 'Cinturón Morado',
    brown: 'Cinturón Café',
    black: 'Cinturón Negro'
  };

  beltName.textContent = beltMap[member.belt] || member.belt || 'Cinturón Blanco';
  
  if (grausText) grausText.textContent = `${member.graus || 0} Graus`;
  if (progressText) progressText.textContent = `${member.progress || 0}%`;
  if (progressFill) progressFill.style.width = `${member.progress || 0}%`;

  beltPreview.className = `belt-visual belt-${member.belt || 'white'}`;
  if (stripeContainer) {
    stripeContainer.innerHTML = Array(member.graus || 0).fill('<div class="grau-stripe"></div>').join('');
  }
}

async function fetchFamilyMembers() {
  if (!currentUser) return;

  try {
    let myProfile = null;
    const response = await _supabase
      .from('cohab_profiles')
      .select('belt, graus')
      .eq('id', currentUser.id)
      .single();

    if (response.error) {
      console.warn('Fallo al cargar belt y graus (posiblemente la columna graus no exista aún). Reintentando solo con belt...');
      const fallbackResponse = await _supabase
        .from('cohab_profiles')
        .select('belt')
        .eq('id', currentUser.id)
        .single();
      if (!fallbackResponse.error) {
        myProfile = { belt: fallbackResponse.data?.belt, graus: 0 };
      }
    } else {
      myProfile = response.data;
    }

    const myBelt = myProfile?.belt || 'white';
    const myGraus = myProfile?.graus || 0;

    const me = { 
      id: 'me', 
      name: currentUser.name ? currentUser.name.split(' ')[0] : 'Yo', 
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
        belt: d.belt || 'white',
        graus: d.graus || 0,
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
  } catch (err) {
    console.error('Error fetching family members:', err);
    // Fallback simple para que no se caiga la app si falla Supabase o la tabla
    familyMembers = [{ id: 'me', name: currentUser.name ? currentUser.name.split(' ')[0] : 'Yo', icon: '🥋', belt: 'white', graus: 0, progress: 0, attendance: [] }];
    renderMemberSelector();
    renderFamilyDashboardSwitch();
    updateRankDisplay(familyMembers[0]);
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
  if (typeof renderServiceCatalog === 'function') renderServiceCatalog();

  // If this member already has a selection, highlight it
  const selection = enrollmentCart[id];
  const plansSection = document.getElementById('step-plans-section');
  if (selection && plansSection) {
    if (typeof updatePlanPrices === 'function') updatePlanPrices(selection.service.discountPrice);
    plansSection.style.display = 'block';
  } else if (plansSection) {
    plansSection.style.display = 'none';
  }
}

async function addNewMember() {
  const name = prompt("Nombre del familiar:");
  if (!name) return;

  showToast("Añadiendo familiar...");

  try {
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
  } catch (err) {
    console.error('Add family member error:', err);
    showToast("❌ Error al añadir familiar");
  }
}

async function handleDeleteService(id) {
  if (!confirm("¿Seguro que quieres eliminar este servicio?")) return;

  showToast("Eliminando...");
  try {
    const { error } = await _supabase
      .from('cohab_services')
      .delete()
      .eq('id', id);

    if (error) {
      showToast(`❌ Error: ${error.message}`);
    } else {
      showToast("✅ Servicio eliminado");
      services = services.filter(s => s.id != id);
      if (typeof renderAdminServicesList === 'function') renderAdminServicesList();
      if (typeof renderServiceCatalog === 'function') renderServiceCatalog();
      if (typeof updateAdminMetrics === 'function') updateAdminMetrics();
    }
  } catch (err) {
    console.error('Delete service error:', err);
    showToast("❌ Error al eliminar servicio");
  }
}

function renderFamilyCart() {
  const container = document.getElementById('family-cards-list');
  if (!container) return;

  const formats = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

  container.innerHTML = familyMembers.map(m => {
    const selection = enrollmentCart[m.id];
    const isMe = m.id === 'me';
    const nameLabel = isMe ? 'Yo' : m.name;
    
    let planInfoHtml = '<div class="family-plan">Sin plan seleccionado</div>';
    let btnHtml = `<button class="family-action-btn" onclick="openPlanSelector('${m.id}')">ELEGIR PLAN</button>`;

    if (selection) {
      planInfoHtml = `
        <div class="family-plan" style="color:var(--crimson-bright); font-weight:600;">
          ${selection.service.name} (${selection.months} Meses) - ${formats.format(selection.price)}
        </div>
      `;
      btnHtml = `<button class="family-action-btn edit" onclick="openPlanSelector('${m.id}')">CAMBIAR</button>`;
    }

    return `
      <div class="family-card">
        <div class="family-card-info">
          <div class="family-avatar">${m.icon || '👤'}</div>
          <div>
            <div class="family-name">${nameLabel}</div>
            ${planInfoHtml}
          </div>
        </div>
        <div>
          ${btnHtml}
        </div>
      </div>
    `;
  }).join('');
}

function openPlanSelector(memberId) {
  currentMemberId = memberId;
  const modal = document.getElementById('plan-modal');
  const title = document.getElementById('plan-modal-title');
  const member = familyMembers.find(m => m.id === memberId);
  const nameLabel = member.id === 'me' ? 'mi plan' : `plan para ${member.name}`;
  
  if (title) title.textContent = `Elegir ${nameLabel}`;
  
  activeService = null;
  const durSec = document.getElementById('modal-duration-section');
  const confBtn = document.getElementById('modal-confirm-btn');
  if (durSec) durSec.style.display = 'none';
  if (confBtn) {
    confBtn.style.opacity = '0.5';
    confBtn.style.pointerEvents = 'none';
  }

  if (typeof renderModalServiceCatalog === 'function') renderModalServiceCatalog();
  if (modal) modal.style.display = 'flex';
}

function closePlanSelector() {
  const modal = document.getElementById('plan-modal');
  if (modal) modal.style.display = 'none';
}
