import Link from 'next/link';

import { LeadForm } from '@/components/leads/lead-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createLeadAction } from '@/services/leads/actions';
import { getLeadFormPageData } from '@/services/leads/queries';

export default async function NewLeadPage() {
  const { profiles } = await getLeadFormPageData();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Nuevo lead</h1>
          <p className="mt-2 text-sm text-muted-foreground">Captura una oportunidad real con seguimiento, prioridad y responsable.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/leads">Volver a leads</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formulario base de creación</CardTitle>
          <CardDescription>Todos los leads deben tener estado y próxima acción desde el primer registro.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadForm action={createLeadAction} profiles={profiles} submitLabel="Crear lead" />
        </CardContent>
      </Card>
    </div>
  );
}
