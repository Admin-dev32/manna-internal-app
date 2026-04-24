# Auditoría de sistema y UX/UI (fase de entendimiento)

Fecha: 2026-04-23

## 1) Resumen ejecutivo

- **Qué es este sistema:** una app interna de Manna Snack Bars para operar el negocio de punta a punta: captación comercial (leads), cotización, conversión a cliente, reservas/pre-eventos, ejecución de eventos, tareas, inventario, finanzas internas y coordinación del equipo. La base técnica es Next.js + Supabase + permisos por rol con overrides por usuario.  
- **Para qué sirve:** centralizar operación comercial y operativa en un solo panel administrativo con trazabilidad (actividades, comentarios, gastos, movimientos de inventario, tickets internos, chat, etc.).  
- **Usuario principal aparente:** owner/gerencia operativa; también hay experiencia para empleados de campo (asignaciones, reportes, checklist y tickets).  
- **Flujo principal de uso aparente:**  
  1. Capturar y mover leads en board CRM.  
  2. Crear y gestionar cotización desde lead.  
  3. Aceptar/rechazar cotización; al aceptar, convertir lead a cliente.  
  4. Crear reserva/pre-evento desde quote aceptada.  
  5. Confirmar y operar evento (checklist, tareas, inventario, gastos).  
  6. Coordinar equipo por chat/comunicación/tickets y revisar recordatorios.

## 2) Mapa del sistema (módulos y relaciones)

### Shell global, acceso y permisos

- **Autenticación y acceso:** rutas públicas para login/recuperación/actualizar clave; rutas de app protegidas por sesión activa y permisos.  
- **Control de acceso:** `requirePermission`, `requireAnyPermission`, `requireRole` redirigen a dashboard si no hay permiso.  
- **Navegación principal:** sidebar + mobile nav basadas en `navigationItems`, filtradas por permisos.  
- **Roles base:** owner, manager, empleado; además existe override granular por permiso.

### Módulos de negocio

1. **Dashboard / Notificaciones**  
   - Propósito: centro de recordatorios y pendientes operativos/comerciales.  
   - Pantallas: `/dashboard`, `/notificaciones`.  
   - Relación: usa mismo origen de datos de recordatorios.

2. **Leads (CRM)**  
   - Propósito: pipeline comercial con board por estatus, filtros, búsqueda, edición rápida y detalle de lead.  
   - Pantallas: `/leads`, `/leads/nuevo`, `/leads/[leadId]`, `/leads/[leadId]/editar`.  
   - Relación: desde detalle de lead se crean cotizaciones; timeline de comunicación embebido por entidad.

3. **Cotizaciones**  
   - Propósito: propuestas comerciales, envío por email/manual, aceptación/rechazo, conversión a cliente, links de pago, invoices y hoja financiera de quote.  
   - Pantallas: `/cotizaciones`, `/cotizaciones/[quoteId]`, `/cotizaciones/[quoteId]/editar`, `/leads/[leadId]/cotizaciones/nueva`.  
   - Relación: depende de lead y puede derivar en cliente + pre-evento.

4. **Clientes**  
   - Propósito: vista de clientes convertidos mínimos con datos base y vínculo a reservas.  
   - Pantallas: `/clientes`, `/clientes/[clientId]`.  
   - Relación: nace desde cotización aceptada (conversión explícita).

5. **Reservas (pre-eventos)**  
   - Propósito: antesala operativa entre venta y evento real, con estado, pagos, sync de calendario y preparación.  
   - Pantallas: `/reservas`, `/reservas/[preEventId]`, `/reservas/[preEventId]/editar`, `/cotizaciones/[quoteId]/pre-evento/nuevo`.  
   - Relación: puente entre quote aceptada y eventos.

6. **Eventos**  
   - Propósito: operación real del evento (checklist, tareas, asignaciones, inventario, gastos, señales operativas, reportes de empleados).  
   - Pantallas: `/eventos`, `/eventos/[eventId]`.  
   - Relación: se alimenta de pre-evento, quote, cliente, inventario, tareas, empleados y finanzas.

7. **Tareas**  
   - Propósito: vista consolidada de tareas por evento, estado/prioridad/responsable y cierres recientes.  
   - Pantallas: `/tareas`.  
   - Relación: muchas acciones redirigen al detalle de evento.

8. **Empleados**  
   - Propósito: operación diaria del staff (asignaciones, disponibilidad, reportes, checklist de team leader/assistant) + panel para crear tickets internos.  
   - Pantallas: `/empleados`, `/empleados/revision`.  
   - Relación: conectado con eventos, tareas y oficina-solicitudes.

9. **Inventario**  
   - Propósito: catálogo, filtros, estatus de stock, ledger de movimientos, ajustes/restock y preparación por evento.  
   - Pantallas: `/inventario`.  
   - Relación: se cruza con eventos y plantillas maestras de barras.

10. **Finanzas**  
   - Propósito: defaults financieros, gastos transaccionales, resumen y control por permisos finos; además soporte de hoja financiera por quote y gastos por evento.  
   - Pantallas: `/finanzas`.  
   - Relación: estrechamente ligado a cotizaciones y eventos.

11. **Comunicación y chat**  
   - Propósito: dos canales: (a) timeline contextual por entidad, (b) chat global/evento, más hub de comunicación con filtros.  
   - Pantallas: `/chat`, `/comunicacion`.  
   - Relación: transversal a lead/quote/client/pre-event/event/task.

12. **Main office (tickets internos)**  
   - Propósito: inbox de tickets internos para gestión central (status, asignación).  
   - Pantallas: `/oficina-solicitudes`.  
   - Relación: input desde empleados y output hacia coordinación central.

13. **Configuración / administración**  
   - Propósito: user management, plantillas email, negocio-pagos, plantillas operativas y listas maestras de inventario.  
   - Pantallas: `/configuracion` y subrutas.  
   - Relación: impacta a varios módulos por parametrización.

## 3) Flujo de uso actual (journey inferido)

1. **Entrada y acceso**: usuario inicia sesión (o demo mode sin credenciales Supabase).  
2. **Aterrizaje**: home redirige a dashboard, que hoy funciona más como centro de recordatorios que como cockpit KPI completo.  
3. **Navegación principal**: sidebar (desktop) o drawer (mobile), filtrada por permisos; cada rol ve subconjunto distinto.  
4. **Operación comercial**: leads → detalle → cotización → aceptación/rechazo → conversión a cliente.  
5. **Operación pre-evento/evento**: quote aceptada → reserva/pre-evento → evento → checklist/tareas/inventario/gastos/reportes.  
6. **Coordinación interna**: chat global/evento + comentarios en timeline + tickets oficina + recordatorios/notificaciones.

### Dónde puede perderse el usuario

- Entre **notificaciones**, **comunicación**, **chat** y **timeline por entidad**, porque hay superposición conceptual y distintos puntos de entrada.  
- Entre **reservas** vs **eventos** (frontera del cambio de estado no siempre obvia para usuario nuevo).  
- En vistas con mucha densidad (lead board, detalle de evento, inventario, detalle de quote) sin una jerarquía de “qué hago primero”.

### Fricciones observadas

- CTA y acciones críticas distribuidas en varios bloques verticales dentro de páginas largas.  
- Dependencia de IDs truncados (#xxxxxxx) en tablas/listas para orientarse.  
- Multiplicidad de variantes visuales de “hero + cards + badges”, sin una guía única explícita de patrón por tipo de tarea.

## 4) Auditoría UX/UI

### Hallazgos de navegación e IA

- Arquitectura rica pero **alta carga cognitiva**: muchos módulos con fronteras cercanas (chat/comunicación/notificaciones/tickets).  
- Terminología mixta “operación”, “main office”, “pre-evento”, “reserva” puede ser clara para equipo experto, pero no necesariamente para onboarding nuevo.

### Hallazgos de layout y patrones visuales

- Se repite patrón de: **hero oscuro + summary cards + card stacks** (consistente a nivel macro).  
- Dentro de cada módulo, los controles cambian entre tablas, cards, details/summary, formularios inline y acciones server-action en bloque; esto genera micro-inconsistencia.  
- Varias pantallas son largas y con mucha densidad de contenido/acciones (especialmente quote detail, event detail, inventory), lo que dificulta escaneo rápido.

### Hallazgos en tablas, formularios y acciones

- Hay tablas funcionales (tareas/leads), pero sin pistas globales de priorización fuera del color/estado (por ejemplo, no siempre hay agrupación por urgencia en el primer fold).  
- Formularios operativos (inventario/finanzas) están en la misma vista del monitoreo, lo cual acelera operación experta, pero puede elevar riesgo de error para usuarios menos frecuentes.  
- Múltiples acciones sensibles por botón directo (aceptar/rechazar quote, conversiones, ajustes de inventario) sin capas homogéneas de confirmación visual/undo.

### Hallazgos de feedback y estados

- Buen uso de badges/estados textuales, pero no siempre hay “state transitions” guiadas (wizard/stepper) para flujos de alto impacto (de quote aceptada a evento ejecutado).  
- Hay mensajes de empty state y hints, pero falta una capa uniforme de “qué sigue exactamente” por módulo.

### Deuda técnica con impacto UX

- Existe un archivo de definiciones de módulos “pendiente de implementar” que no representa el estado real actual; puede inducir ambigüedad para nuevos devs/diseño.  
- El sistema depende fuertemente de permisos granulares; cualquier inconsistencia de permisos altera navegación visible y puede generar sensación de interfaz “incompleta”.

## 5) Riesgos y restricciones (qué no romper)

1. **Control de permisos y guards**: es columna vertebral; cambios de navegación/layout deben respetar visibilidad por permiso y redirecciones actuales.  
2. **Flujo comercial crítico**: lead → quote → aceptación/rechazo → conversión cliente → pre-evento.  
3. **Flujo operativo crítico**: pre-evento → evento → tareas/checklist/inventario/gastos/reportes.  
4. **Integraciones sensibles**: envío de email de quote, links de pago, facturación, sync calendario.  
5. **Trazabilidad y auditoría operativa**: timeline de comentarios, ledger inventario, gastos, tickets y estado de tareas.  
6. **Modelo de roles/overrides**: cualquier rediseño de IA debe contemplar vistas parciales por rol para evitar rutas huérfanas.

## 6) Recomendación estratégica antes de rediseñar

### Estrategia sugerida: **híbrida por capas**

1. **Primero navegación + arquitectura de información (shell liviano)**  
   - Clarificar taxonomía y frontera de módulos (ej. coordinación interna: chat vs comunicación vs notificaciones vs tickets).  
   - Mantener compatibilidad de rutas y permisos existentes.

2. **Luego design system operativo mínimo**  
   - Definir patrones canon para: página índice, detalle de entidad, tabla operativa, formulario transaccional, panel de acciones críticas, estados vacíos/errores.  
   - Estandarizar jerarquías de CTA primario/secundario/destructivo y densidad tipográfica/espaciado.

3. **Después rediseño módulo por módulo (orden recomendado)**  
   - a) Leads + Cotizaciones (impacto comercial).  
   - b) Reservas + Eventos (impacto operativo).  
   - c) Inventario + Finanzas (impacto de control y riesgo).  
   - d) Comunicación/Chat/Tickets/Notificaciones (convergencia IA de coordinación).

4. **Tablas y formularios como track transversal**  
   - Aplicar mejoras de escaneo, filtros, bulk actions, feedback y prevención de error de forma consistente.

## Ambigüedades detectadas / cosas no claras

- No está completamente explícita en UI la regla de paso exacta de reserva a evento (parece existir en lógica, pero podría comunicarse mejor).  
- El rol funcional final de `/empleados/revision` requiere validación adicional de producto.  
- El buscador del header aparenta placeholder/futuro (“acciones futuras”), por lo que su alcance real no está claro.

## Lo que entendí del sistema

- Es una plataforma interna operacional-comercial integrada para Manna Snack Bars, con fuerte enfoque en trazabilidad y permisos.  
- El backbone es un funnel comercial que desemboca en ejecución operativa de eventos.

## Lo que está haciendo la interfaz difícil de usar

- Solapamiento de módulos de coordinación interna.  
- Páginas de alta densidad con demasiadas decisiones en un mismo scroll.  
- Inconsistencia de micro-patrones de interacción entre módulos.

## Qué cambiaría primero

1. IA y navegación (nombres, agrupación y rutas mentales).  
2. Patrón de detalle de entidad + patrón de acciones críticas.  
3. Sistema unificado para tablas/formularios operativos.

## Qué necesito confirmar antes de rediseñar

- Jerarquía real de prioridades del negocio: comercial vs operación diaria vs finanzas.  
- Segmentos de usuarios y frecuencia de uso por módulo.  
- Qué acciones requieren confirmación fuerte/legal.  
- Metas UX cuantitativas (tiempo de completar tarea, tasa de error, adopción por rol).  
- Si se desea converger o separar explícitamente chat/comunicación/notificaciones/tickets.
