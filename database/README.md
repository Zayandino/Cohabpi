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

> [!WARNING]
> Ya están aplicados en producción. **No** son migraciones idempotentes: no re-ejecutar
> sobre la base productiva. El orden se infirió del historial de git; `002` puede
> incluir cambios de `001`. Para cambios nuevos usar `supabase/migrations/`.
