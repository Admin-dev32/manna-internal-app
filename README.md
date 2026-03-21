# Manna Internal App

Base interna de Manna Snack Bars construida con Next.js App Router, TypeScript, Tailwind CSS y Supabase.

## Qué incluye actualmente

- Estructura escalable por `app`, `components`, `features`, `services`, `config`, `types` y `lib`.
- Layout administrativo mobile-first con sidebar, header, navegación móvil y cierre de sesión visible.
- Rutas públicas y protegidas con autenticación real preparada para Supabase SSR.
- Base funcional de roles (`owner`, `manager`, `empleado`) y perfil básico de empleado.
- SQL inicial para perfiles autenticados y estado activo/inactivo.

## Variables de entorno

Copia `.env.example` a `.env.local` y completa:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_AUTH_ENFORCED=true
```

## SQL inicial de Supabase

Puedes usar cualquiera de estos archivos según el flujo de trabajo:

- `supabase/migrations/20260319_auth_profiles.sql` para migraciones versionadas.
- `supabase/sql/initial_auth_profiles.sql` para pegar directamente en Supabase SQL Editor.

## Siguiente bloque sugerido

Implementar la administración inicial de empleados y permisos base por rol sobre esta autenticación ya conectada.
