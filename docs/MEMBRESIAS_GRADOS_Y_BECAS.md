# Documentación Técnica y Operativa: Membresías, Graduaciones BJJ y Beca 100%
**Proyecto:** COHAB Los Andes  
**Fecha de Actualización:** Noviembre 2026  
**Módulos Afectados:** [`AdminDashboard.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/AdminDashboard.jsx), [`Dashboard.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/Dashboard.jsx), [`RegistrationFlow.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/RegistrationFlow.jsx), [`TatamiMode.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/TatamiMode.jsx).

---

## 1. Escala Oficial de Graduación BJJ y Reglas de Negocio

### 1.1 Modelo de Permanencia y Asistencia
El Jiu-Jitsu Brasileño tradicional contempla una trayectoria de aproximadamente **10 años** para alcanzar el cinturón negro (desde los 16 años en adelante), estructurada bajo la estimación de 1 grado cada ~6 meses asistiendo a 2-3 clases semanales (~60–70 clases semestrales por grado).

* **Blanco a Azul:** ~150 clases acumuladas (~2 a 2.5 años).
* **Azul a Morado:** ~175 clases acumuladas (~2.5 a 3 años).
* **Morado a Marrón:** ~150 clases acumuladas (~2 a 2.5 años).
* **Marrón a Negro:** ~125 clases acumuladas (~1.5 a 2 años).
* **Total trayectoria:** ~600 clases / ~10 años.

### 1.2 Regla de Decisión Humana (No Automática)
* **Criterio pedagógico:** La plataforma **NUNCA promueve de cinturón de forma automática en la base de datos**. El ascenso es un acto marcial y pedagógico reservado exclusivamente al criterio del profesor / administrador.
* **Aviso en pantalla:** En la pestaña `Asignación de Grados` de [`AdminDashboard.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/AdminDashboard.jsx), al seleccionar a un alumno, el sistema consulta en tiempo real sus asistencias en `cohab_attendance` y muestra una tarjeta con su estado. Si cumple la meta de clases, se resalta:
  > **¡Requisito de Asistencia Cumplido!**  
  > Botón de asistencia rápida: `⚡ Seleccionar Azul` (o el cinturón correspondiente).  
  > El administrador confirma manualmente presionando **"Guardar Grado"**.

### 1.3 Visualización en el Dashboard del Alumno
* En [`Dashboard.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/Dashboard.jsx), la barra de progreso calcula el avance hacia el siguiente cinturón a partir de las asistencias reales registradas en `cohab_attendance`.
* La visualización de grados/franjas en la punta negra se mantiene pospuesta para más adelante, luciendo una franja limpia y elegante.

---

## 2. Automatización Continua de Beca 100%

### 2.1 Eliminación de la Renovación Manual Mensual
Anteriormente, los alumnos con `scholarship_percent = 100` debían ingresar cada mes a la pantalla de pagos a presionar *"Activar Membresía Gratuita 🎓"*, lo que generaba fricción innecesaria para un cobro de \$0.

### 2.2 Flujo Automatizado
1. **Asignación en Admin Dashboard:** Al asignar 100% de beca en [`AdminDashboard.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/AdminDashboard.jsx), el sistema activa el perfil y crea una suscripción en `cohab_subscriptions` con vigencia extendida (`end_date = 2099-12-31`).
2. **Dashboard de Alumno:** En [`Dashboard.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/Dashboard.jsx), si `profile.scholarship_percent === 100`, el estado de membresía se marca automáticamente como **"Membresía Activa"** de forma ininterrumpida.
3. **Modo Tatami (QR):** En [`TatamiMode.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/TatamiMode.jsx), el lector de QR reconoce la condición de beca 100% como `vigente`, permitiendo el ingreso al dojo sin rechazos ni alertas de vencimiento.

---

## 3. Panel de Membresías, Pagos Manuales y Asistencias

### 3.1 Pestaña Estado de Alumnos
* **Métricas en tiempo real:** Al Día, Membresías Vencidas, Alumnos en Prueba (clases gratuitas utilizadas) y Recaudación del Mes actual en CLP.
* **Filtros rápidos:** `Todos`, `✅ Vigentes`, `⚠️ Vencidos`, `🎓 Becados 100%`, `🥋 En Prueba`.
* **Buscador:** Filtrado en vivo por nombre o correo electrónico.

### 3.2 Registro de Pagos Manuales (Efectivo / Transferencia)
Permite al administrador o recepcionista registrar pagos directos:
* Selección de alumno y disciplina.
* Período de renovación (1 mes, 3 meses con 10% dcto., 6 meses con 15% dcto., 12 meses con 25% dcto.).
* Medio de pago: `transferencia`, `efectivo`, `debito_credito`.
* Al confirmar, inserta el comprobante aprobado en `cohab_payments`, actualiza el estado del alumno y crea/extiende la suscripción en `cohab_subscriptions`.

### 3.3 Reporte Mensual de Asistencia
* Selector de mes calendario (`YYYY-MM`).
* Filtro por disciplina/horario.
* Desglose numérico de check-ins por servicio y listado detallado con fecha, hora y alumno.

---

## 4. Sincronización Segura de Horarios en Registro
* En [`RegistrationFlow.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/RegistrationFlow.jsx), los bloques horarios y los profesores asignados por bloque se leen directamente desde `cohab_services`.
* En [`AdminDashboard.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/pages/AdminDashboard.jsx), la función `syncOfficialServices` no sobreescribe ni duplica registros existentes si el administrador modificó los servicios.
