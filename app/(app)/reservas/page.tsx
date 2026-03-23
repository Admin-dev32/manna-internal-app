import { PreEventsOperationsBoard } from '@/components/pre-events/pre-events-operations-board';
import { getPreEventsOverviewPageData } from '@/services/pre-events/queries';

export default async function ReservasPage() {
  const { clients, preEvents, quotes } = await getPreEventsOverviewPageData();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[2rem] border border-border bg-slate-950 p-6 text-white shadow-panel sm:p-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold">Reservas iniciales</h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Antesala operativa del futuro módulo de Eventos. Aquí puedes priorizar, confirmar y preparar reservas ligadas a clientes y cotizaciones ya aceptadas.
          </p>
        </div>
      </section>

      <PreEventsOperationsBoard preEvents={preEvents} clients={clients} quotes={quotes} />
    </div>
  );
}
