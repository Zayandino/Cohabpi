# COHAB Los Andes — Expediente Único del Alumno & Modo Tatami

Este documento describe la arquitectura, modelo de datos, flujos de usuario y componentes implementados para la unificación del expediente de alumnos, la formalización del **Protocolo v5** y el **Modo Tatami** para el cuerpo de instructores de la academia de Brazilian Jiu-Jitsu.

---

## 1. Visión General de la Solución

Anteriormente, los procesos de registro de prueba y formalización dependían de formularios externos (Google Forms) desvinculados de la base de datos principal, generando inconsistencias y duplicidad de registros. 

La nueva solución implementa un **Expediente Único Digital** integrado directamente en la plataforma web y la base de datos Supabase/PostgreSQL, estructurado en **dos etapas formativas** y un módulo operativo para instructores en el tatami:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FLUJO UNIFICADO DE ALUMNOS                      │
└────────────────────────────────────────────────────────────────────────┘

    [ETAPA 1: REGISTRO DE PRUEBA] ────► [PASE 2 CLASES] ────► [DASHBOARD]
    • Apoderado o Alumno Adulto             (Gratuito)          Estado: "prueba"
    • Clasificación Etaria Automática
    • Semáforo Médico Preventivo (🟢🟡🔴)
    • Contacto de Emergencia
    • Firma Táctil Digital (Canvas)
                                                                    │
                                                                    ▼
    [ETAPA 2: FORMALIZACIÓN V5] ◄───────────────────────────────────┘
    • Lectura 11 Deberes Protocolo v5
    • Escala de Faltas y Disciplina
    • Refrendo con Firma Digital
    • Visado Institucional Inteligente (Trigger Postgres)
    • Suscripción Membresía Mercado Pago (Estado: "vigente")

                                                                    │
                                                                    ▼
    [MODO TATAMI PARA INSTRUCTORES] (/tatami)
    • Nómina de alumnos en tiempo real con semáforos de salud
    • Marcado de asistencia con 1 clic ("Presente ✓")
    • Filtros: Sub-8, Infantil, Adultos, Todos
    • Botón de llamada rápida de emergencia
    • Registro de Incidentes y Lesiones en Tatami
```

---

## 2. Etapa 1: Registro y Pase de Prueba (`/registro`)

### Reglas de Negocio Clave
1. **Menores de 13 años:** No tienen cuenta de autenticación en `auth.users`. Quedan registrados como perfiles dependientes en `cohab_profiles` con su columna `parent_id` vinculada al apoderado titular.
2. **Clasificación Etaria Automática:** A partir de la fecha de nacimiento ingresada:
   - Menores de 8 años: **Sub-8**
   - 8 a 13 años: **Infantil**
   - 14 a 17 años: **Adolescente**
   - 18 años o más: **Adulto**
3. **Semáforo Médico Preventivo:**
   - 🟢 **Verde (Apto pleno):** Sin antecedentes cardíacos, respiratorios ni lesiones agudas.
   - 🟡 **Amarillo (Apto con observación preventiva):** Alergias controladas, asma con inhalador, lesiones pasadas tratadas. Visible en el tatami como nota de precaución.
   - 🔴 **Rojo (Pendiente de Certificado Médico):** Afecciones cardíacas, cirugías recientes o contraindicaciones médicas. Requiere validación manual de administración.
4. **Pase de Cortesía:** La firma digital activa automáticamente un saldo de **2 clases de prueba gratuitas**.

---

## 3. Etapa 2: Formalización del Protocolo v5 (`/formalizacion`)

### Reglas de Negocio Clave
1. **Contenido Oficial por Audiencia:** Se nutre de la tabla `cohab_documents` con 4 versiones oficiales del Protocolo de Compromiso v5:
   - Sub-8 (Enfocado en el apoderado).
   - 8 a 13 años (Valores y autonomía formativa).
   - 14 a 17 años (Disciplina adolescente e integración a clases de adultos).
   - Adulto 18+ (Cuidado mutuo, regla de oro del *tap* y control técnico).
2. **Los 11 Deberes Obligatorios:** Puntualidad, Respeto, No agredir fuera del dojo, Higiene rigurosa, Actitud humilde, Sparring consciente y respeto incondicional al toque (*tap*), Conducta ética, Comunicación de dolencias, Pago oportuno (días 1 al 5), Cuidado del tatami y Asistencia obligatoria a reuniones bimestrales.
3. **Visado Inteligente Institucional:** Al insertar el consentimiento firmado en `cohab_consents`, el trigger de PostgreSQL `trg_auto_approve_consent` evalúa el nivel de riesgo médico:
   - Si es **verde** o **amarillo**, el consentimiento se aprueba automáticamente de forma inmediata (`approval_status = 'approved'`).
   - Si es **rojo**, queda en estado `pending`, requiriendo validación médica en la bandeja de administración (se eliminó la exigencia de firma manual del profesor en cada registro).
4. **Checkout Integrado:** Conexión directa a los planes de suscripción de **Mercado Pago** (`cohab_checkout_sessions`). Se eliminaron completamente todos los enlaces a Google Forms.

---

## 4. Modo Tatami (`/tatami`)

Diseñado como herramienta táctica para profesores y monitores durante la clase:
- **Seguridad y Privacidad:** Utiliza la función PostgreSQL `cohab_get_tatami_roster()`, protegida con `SECURITY DEFINER` y verificada con `cohab_is_instructor()`. No expone saldos ni datos bancarios.
- **Identificación Rápida:** Muestra nombre, cinturón, grados, grupo de edad, estado del alumno (`prueba`, `vigente`, `restringido`, etc.) y semáforo preventivo con resumen de alerta médica (ej. *"Asma (inhalador en bolso)"*).
- **Control de Asistencia:** Marcado instantáneo que actualiza el contador de presentes en vivo.
- **Protocolo de Lesiones e Incidentes:** Modal conectado a la tabla `cohab_incidents`, permitiendo documentar la zona del cuerpo afectada, la severidad (leve, moderada o grave) y las circunstancias del incidente para seguimiento médico y notificación a apoderados.

---

## 5. Barra de Navegación Inferior Simétrica (2 - LOGO - 2)

El componente [`BottomNav.jsx`](file:///c:/Users/eduar/Cohabpi/cohab-frontend/src/components/BottomNav.jsx) implementa una estructura perfectamente simétrica de 5 posiciones con el logo central flotante en el 50% de la pantalla:

```
┌─────────────┬─────────────┬───────────────┬─────────────┬─────────────┐
│  Academia   │  Noticias   │  [LOGO COHAB] │   Tatami*   │   Perfil    │
│  (/videos)  │ (/novedades)│ (/dashboard)  │  (/tatami)  │ (/profile)  │
└─────────────┴─────────────┴───────────────┴─────────────┴─────────────┘
  ◄──── 2 a la Izquierda ────►   ▲ Centro ▲   ◄──── 2 a la Derecha ─────►
```

- **Alumnos y Apoderados:** Izquierda: *Academia*, *Noticias* · Centro: *Logo Inicio* · Derecha: *Beneficios*, *Perfil*.
- **Instructores y Admins:** Izquierda: *Academia*, *Noticias* · Centro: *Logo Inicio* · Derecha: *Tatami*, *Perfil*.

---

## 6. Modelo de Base de Datos (Migración 012)

La migración [`database/012_expediente.sql`](file:///c:/Users/eduar/Cohabpi/database/012_expediente.sql) crea las siguientes estructuras:

| Tabla / Objeto | Propósito |
|---|---|
| `cohab_seasons` | Temporadas oficiales (Enero a Diciembre de cada año). |
| `cohab_health_records` | Fichas médicas versionadas con nivel de riesgo (`green`, `yellow`, `red`) y alertas visibles. |
| `cohab_emergency_contacts` | Contactos primarios y secundarios de rescate y emergencias. |
| `cohab_documents` | Repositorio de versiones oficiales de protocolos y consentimientos (Markdown). |
| `cohab_consents` | Registros firmados digitalmente con hash/trazos y visado institucional. |
| `cohab_incidents` | Bitácora de lesiones e incidentes ocurridos en el tatami. |
| `cohab_student_status` | Vista unificada que calcula el estado del alumno (`prueba`, `vigente`, `por_vencer`, `vencido`, `revision`, `restringido`). |
| `cohab_is_instructor()` | Función RLS de seguridad que valida privilegios de instructor o administrador. |
| `cohab_get_tatami_roster()` | Función segura para cargar la plantilla de tatami sin exponer datos sensibles. |
| `trg_auto_approve_consent` | Trigger para auto-visado de fichas médicas de riesgo verde y amarillo. |
