export interface OperationalTemplateSeed {
  name: string;
  slug: string;
  description: string;
  serviceCategory: string;
  note?: string;
  checklist: Array<{ label: string; description?: string; sortOrder: number; isRequired?: boolean }>;
  tasks: Array<{ title: string; description?: string; suggestedPriority?: 'baja' | 'media' | 'alta' | 'urgente'; suggestedPhase?: string; suggestedRole?: 'lider' | 'apoyo' | 'setup' | 'general'; sortOrder: number }>;
  materials: Array<{ name: string; materialType?: string; note?: string; sortOrder: number; pendingDefinition?: boolean; unknowns?: string }>;
}

const SHARED_CHECKLIST = [
  { label: 'Ubicación confirmada', description: 'La dirección y acceso operativo ya fueron validados.', sortOrder: 10, isRequired: true },
  { label: 'Servicio confirmado', description: 'Servicio contratado y alcance operativo confirmados.', sortOrder: 20, isRequired: true },
  { label: 'Checklist específico pendiente', description: 'Pendiente de cargar checklist detallado operativo de esta barra.', sortOrder: 90, isRequired: false },
];

const SHARED_TASKS = [
  { title: 'Revisar alcance final del servicio', description: 'Validación operativa final antes del evento.', suggestedPriority: 'alta' as const, suggestedPhase: 'preparacion', suggestedRole: 'lider' as const, sortOrder: 10 },
  { title: 'Preparar set base del servicio', description: 'Armar estación según estándar de operación.', suggestedPriority: 'media' as const, suggestedPhase: 'setup', suggestedRole: 'setup' as const, sortOrder: 20 },
  { title: 'Completar tareas pendientes por definición', description: 'Actualizar pendientes operativos documentados en la plantilla.', suggestedPriority: 'media' as const, suggestedPhase: 'preparacion', suggestedRole: 'general' as const, sortOrder: 90 },
];

const pendingMaterial = (name: string) => ({
  name: `Insumos base de ${name}`,
  materialType: 'pendiente_definir',
  note: 'Pendiente detallar gramajes/unidades exactas.',
  sortOrder: 90,
  pendingDefinition: true,
  unknowns: 'Falta catálogo operativo detallado de materiales para este servicio.',
});

export const OPERATIONAL_TEMPLATE_SEEDS: OperationalTemplateSeed[] = [
  {
    name: 'Mini Pancake Bar',
    slug: 'mini-pancake-bar',
    description: 'Servicio de mini pancakes con operación dedicada en barra.',
    serviceCategory: 'mini-pancake-bar',
    checklist: SHARED_CHECKLIST,
    tasks: SHARED_TASKS,
    materials: [pendingMaterial('Mini Pancake Bar')],
  },
  {
    name: 'Tostiloco Bar',
    slug: 'tostiloco-bar',
    description: 'Servicio de preparación y armado de Tostilocos en barra.',
    serviceCategory: 'tostiloco-bar',
    checklist: SHARED_CHECKLIST,
    tasks: SHARED_TASKS,
    materials: [pendingMaterial('Tostiloco Bar')],
  },
  {
    name: 'Maruchan Bar',
    slug: 'maruchan-bar',
    description: 'Servicio de Maruchan preparada en barra para eventos.',
    serviceCategory: 'maruchan-bar',
    checklist: SHARED_CHECKLIST,
    tasks: SHARED_TASKS,
    materials: [pendingMaterial('Maruchan Bar')],
  },
  {
    name: 'Esquites Bar',
    slug: 'esquites-bar',
    description: 'Servicio de Esquites con operación de barra móvil.',
    serviceCategory: 'esquites-bar',
    checklist: SHARED_CHECKLIST,
    tasks: SHARED_TASKS,
    materials: [pendingMaterial('Esquites Bar')],
  },
  {
    name: 'Manna Snack Bar — La Clásica',
    slug: 'manna-snack-bar-la-clasica',
    description: 'Formato clásico de Manna Snack Bar para eventos estándar.',
    serviceCategory: 'manna-snack-bar-la-clasica',
    checklist: SHARED_CHECKLIST,
    tasks: SHARED_TASKS,
    materials: [pendingMaterial('Manna Snack Bar — La Clásica')],
  },
  {
    name: 'Chocolate Fountain',
    slug: 'chocolate-fountain-addon',
    description: 'Add-on de fuente de chocolate integrado al servicio principal.',
    serviceCategory: 'chocolate-fountain-addon',
    note: 'Add-on: se aplica encima del servicio principal.',
    checklist: SHARED_CHECKLIST,
    tasks: SHARED_TASKS,
    materials: [pendingMaterial('Chocolate Fountain')],
  },
  {
    name: 'Servicio con 2 barras',
    slug: 'servicio-con-2-barras',
    description: 'Plantilla contenedor para configurar combinación de dos barras reales.',
    serviceCategory: 'servicio-con-2-barras',
    note: 'Contenedor especial. Diseñado para combinar dos barras en iteraciones siguientes.',
    checklist: [
      ...SHARED_CHECKLIST,
      { label: 'Definir barra A y barra B', description: 'Seleccionar combinación real de barras para el evento.', sortOrder: 95, isRequired: true },
    ],
    tasks: [
      ...SHARED_TASKS,
      { title: 'Confirmar combinación de 2 barras', description: 'Alinear disponibilidad y alcance de cada barra.', suggestedPriority: 'alta', suggestedPhase: 'preparacion', suggestedRole: 'lider', sortOrder: 95 },
    ],
    materials: [
      {
        name: 'Materiales compuestos de barra A + barra B',
        materialType: 'contenedor',
        note: 'Se consolidará automáticamente en una siguiente iteración.',
        sortOrder: 95,
        pendingDefinition: true,
        unknowns: 'Pendiente motor de combinación de materiales entre dos plantillas reales.',
      },
    ],
  },
];
