# Scripts utilitarios

Scripts de diagnóstico/mantenimiento contra Supabase. Leen credenciales desde `cohab-frontend/.env`
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Ejecutar desde `cohab-frontend/` (Node 20+):

```bash
node --env-file=.env scripts/scratch_check_services.js
```
