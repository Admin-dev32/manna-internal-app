# Deploy Prep / Production Readiness (Manna Internal App)

Este documento cierra la preparación de despliegue sin rehacer arquitectura ni agregar módulos grandes.

## 1) Checklist de despliegue

### 1.1 Variables de entorno requeridas

Configurar en el entorno de deploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (URL pública real del ambiente)
- `NEXT_PUBLIC_AUTH_ENFORCED=true`

Checklist:

- [ ] Todas las variables están presentes en el entorno.
- [ ] `NEXT_PUBLIC_APP_URL` coincide con el dominio final.
- [ ] `NEXT_PUBLIC_AUTH_ENFORCED` está en `true` en staging/producción.

### 1.2 Base de datos (migraciones)

- [ ] Ejecutar migraciones de `supabase/migrations` en orden (ver sección 2).
- [ ] Verificar que no haya errores de constraints/funciones al aplicar migraciones.
- [ ] Confirmar que las políticas RLS quedaron activas en tablas críticas.

### 1.3 Bootstrap owner/admin

- [ ] Existe el usuario auth del owner principal (`jorgermendoza18@gmail.com`).
- [ ] Se ejecutó `public.ensure_primary_owner_account()` (incluido en migración de user management).
- [ ] El owner principal tiene `role=owner`, `is_active=true`, `is_site_owner=true`.
- [ ] Validar que no existan overrides para owner principal.

SQL de verificación rápida:

```sql
select p.id, p.role, p.is_active, uac.is_site_owner
from public.profiles p
left join public.user_access_controls uac on uac.user_id = p.id
join auth.users au on au.id = p.id
where lower(au.email) = lower('jorgermendoza18@gmail.com');
```

### 1.4 Permisos/admin críticos

- [ ] Al menos 2 cuentas con acceso administrativo (`admin.users.manage`) para evitar lockout operativo.
- [ ] El owner principal puede entrar a `/configuracion/usuarios`.
- [ ] Un usuario sin permisos admin no puede acceder a user management.

### 1.5 Módulos sensibles a validar

- [ ] Leads (`/leads`) y clientes (`/clientes`) con datos.
- [ ] Cotizaciones y reservas (`/cotizaciones`, `/reservas`) con flujo real.
- [ ] Eventos/tareas (`/eventos`, `/tareas`) con estados y updates.
- [ ] Finanzas (`/finanzas`) e inventario (`/inventario`).
- [ ] Configuración/admin (`/configuracion`, `/configuracion/usuarios`).

## 2) Orden correcto de migraciones SQL y dependencias

Orden recomendado (exactamente por nombre de archivo):

1. `20260319_auth_profiles.sql` (base auth + `profiles`)
2. `20260319_leads_module.sql` (depende de `profiles`)
3. `20260320_clients_conversion.sql` (depende de `leads`; relación a `quotes` se amarra más adelante)
4. `20260320_pre_events.sql` (depende de `clients`/`leads`; relación a `quotes` se amarra más adelante)
5. `20260320_quotes_module.sql` (depende de `leads`; además agrega FK faltantes hacia `quotes` en `clients` y `pre_events`)
6. `20260321_events_module.sql` (depende de `clients`/`leads`/`quotes`/`pre_events`)
7. `20260321_financial_sheets.sql` (depende de `profiles` y flujo comercial)
8. `20260321_user_management.sql` (depende de `profiles` y `auth.users`)
9. `20260322_event_operations_core.sql` (depende de `events`)
10. `20260322_event_staff_assignments.sql` (depende de `events` + `profiles`)
11. `20260323_event_tasks.sql` (depende de `events` + `event_staff_assignments`)
12. `20260323_inventory_materials.sql` (depende de `events` + `profiles`)
13. `20260323_operational_templates.sql` (depende de `profiles` + `events`)
14. `20260326_operational_templates_refine_and_seed.sql` (depende de templates base)
15. `20260328_internal_record_communication.sql` (depende de `profiles` y entidades funcionales)

Clasificación:

- **Esenciales para operar auth y control de acceso:** 1, 8.
- **Esenciales para flujo comercial mínimo:** 2, 3, 4, 5.
- **Esenciales para operación de eventos:** 6, 9, 10, 11.
- **Esenciales según módulos activados:** 7, 12, 13, 14, 15.

## 3) Hardening aplicado en esta iteración

### 3.1 Rutas sensibles con guard explícito por permiso

Se añadieron guards de permiso en páginas top-level que antes solo exigían sesión activa por layout:

- `/dashboard` → `dashboard.view`
- `/leads` y `/clientes` → `crm.view`
- `/cotizaciones` → `quotes.view`
- `/reservas` → `events.view`
- `/notificaciones` → `notifications.view`
- `/comunicacion` → `communication.view`
- `/empleados` → `employees.view`

Con esto se evita exposición de pantallas sensibles por URL directa a usuarios autenticados sin permisos.

### 3.2 Riesgo de orden SQL corregido

Se corrigió dependencia circular de ejecución temprana:

- `clients.source_quote_id` y `pre_events.source_quote_id` ya no intentan crear FK a `quotes` antes de que exista la tabla.
- Las FKs se agregan al final de `20260320_quotes_module.sql` mediante bloques `DO`, con verificación de existencia e idempotencia.

## 4) Validación final recomendada

Antes de declarar producción:

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run dev` y smoke test manual de login + navegación por permisos.
- [ ] Validar owner principal en user management.
- [ ] Validar al menos un admin secundario.
- [ ] Validar flujos críticos de cada módulo habilitado.

## 5) Riesgos residuales (pre-producción real)

- Falta definir observabilidad (logs centralizados, alertas, tracking de errores).
- Falta definir backup/restore probado en Supabase para incidentes.
- No hay suite automatizada E2E para flujos críticos (solo validación manual + build/typecheck).
- Recomendada una corrida de migraciones en base vacía de staging para verificar tiempos y bloqueos.
