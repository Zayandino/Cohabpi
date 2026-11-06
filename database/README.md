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

## Infra: parche Kong (login y confirmación de correo)

En el VPS, tanto las rutas abiertas (`auth-v1-open` para `/auth/v1/verify`, `auth-v1-open-callback` para `/auth/v1/callback`, `auth-v1-open-authorize` para `/auth/v1/authorize`) como la ruta protegida `auth-v1-all` (`/auth/v1/`) de `volumes/api/kong.yml` (compose `cohab-los-andes-supabase-dww5gh`) deben incluir el mismo bloque `hosts`:

```yaml
        hosts:
          - api.cohablosandes.cloud
          - kong
          - localhost
```

> [!IMPORTANT]
> En Kong 2.8, cualquier ruta con `hosts:` tiene mayor prioridad de enrutamiento que una ruta sin `hosts:`, sin importar la longitud del path. Si `auth-v1-all` tiene `hosts:` y `auth-v1-open` (`/auth/v1/verify`) no lo tiene, Kong intercepta el clic del enlace de confirmación de correo con `auth-v1-all` y devuelve `401 {"message":"No API key found in request"}`.
> Al aplicar cambios en `volumes/api/kong.yml` (modo DB-less), reiniciar el contenedor Kong (`docker restart cohab-los-andes-supabase-dww5gh-supabase-kong`). Backup: `kong.yml.bak`.

