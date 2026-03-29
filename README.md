# Manna Internal App

Base interna de Manna Snack Bars construida con Next.js App Router, TypeScript, Tailwind CSS y Supabase.

## Estado actual

La app ya incluye módulos operativos de:

- Auth y perfiles internos.
- Leads, cotizaciones, clientes y reservas.
- Eventos, staff por evento y tareas.
- Inventario y finanzas internas.
- Recordatorios, comunicación interna y plantillas operativas.
- User management con owner protegido y overrides de permisos.

## Requisitos de entorno

Copia `.env.example` a `.env.local` y completa:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_AUTH_ENFORCED=true
```

Notas importantes:

- `NEXT_PUBLIC_AUTH_ENFORCED=true` debe mantenerse en ambientes reales.
- Si faltan credenciales de Supabase, la app entra en modo demo interno (`isDemoMode`).

## Levantar local

```bash
npm install
npm run typecheck
npm run dev
```

Para validación de release local:

```bash
npm run build
```

## Preparación de deploy / producción

Se dejó una guía específica para cierre de despliegue en:

- `docs/deploy-production-readiness.md`

Incluye:

- checklist de despliegue
- orden de migraciones SQL y dependencias
- bootstrap de owner/admin inicial
- hardening revisado y riesgos residuales
- validación final recomendada antes de producción
