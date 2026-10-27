# Base de datos COHAB

Scripts SQL históricos, ordenados por la **fecha en que se agregaron al repositorio**.

| # | Archivo | Propósito |
|---|---|---|
| 001 | `rls_policies.sql` | Políticas Row Level Security |
| 002 | `cohab_full_schema.sql` | Esquema completo base |
| 003-005 | `patch_profiles*`, `patch_fase4` | Ajustes de perfiles y fase 4 |
| 006 | `update_news_schema.sql` | Novedades |
| 007 | `patch_fase2_onboarding.sql` | Onboarding |
| 008-009 | `clean_duplicate_services`, `insert_services` | Datos de servicios |
| 010 | `create_checkout_sessions.sql` | Carrito / checkout Mercado Pago |
| 011 | `patch_rut_birthdate.sql` | RUT y fecha de nacimiento |
| 012 | `012_expediente.sql` | Expediente único, salud con semáforo, visado inteligente, vista `cohab_student_status` y Modo Tatami |

> [!NOTE]
> Todas las migraciones del 001 al 012 se encuentran **aplicadas y operativas en producción** (PostgreSQL Supabase en el VPS Hostinger).
>
> **Objetos principales introducidos en 012:**
> - Tablas: `cohab_seasons`, `cohab_health_records`, `cohab_emergency_contacts`, `cohab_documents`, `cohab_consents`, `cohab_incidents`, `cohab_legacy_forms`.
> - Vistas: `cohab_student_status` (consolidación en tiempo real del estado de cada alumno: `prueba`, `vigente`, `por_vencer`, `vencido`, `revision`, `restringido`).
> - Funciones y Triggers: `cohab_is_instructor()`, `cohab_get_tatami_roster()`, `trg_auto_approve_consent()`.
