import Link from 'next/link';

import { LeadForm } from '@/components/leads/lead-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateLeadAction } from '@/services/leads/actions';
import { getLeadFormPageData } from '@/services/leads/queries';

export default async function EditLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const { lead, profiles } = await getLeadFormPageData(leadId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Editar lead</h1>
          <p className="mt-2 text-sm text-muted-foreground">Actualiza datos, seguimiento, prioridad o contexto interno del prospecto.</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/leads/${leadId}`}>Volver al detalle</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edición básica</CardTitle>
          <CardDescription>Preparado para crecer a seguimiento más profundo, cotización y conversión futura.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadForm action={updateLeadAction.bind(null, leadId)} lead={lead} profiles={profiles} submitLabel="Guardar cambios" />
        </CardContent>
      </Card>
    </div>
  );
}
