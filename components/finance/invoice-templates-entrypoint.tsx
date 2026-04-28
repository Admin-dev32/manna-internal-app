import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function InvoiceTemplatesEntrypoint({ canManageTemplates }: { canManageTemplates: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Templates</CardTitle>
        <CardDescription>
          Invoice emails use the shared email template system. Edit delivery and reminder templates from here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Invoice Delivery</Badge>
          <Badge variant="secondary">Invoice Reminder</Badge>
        </div>

        {canManageTemplates ? (
          <Button asChild>
            <Link href="/configuracion/plantillas-email">Open Email Templates</Link>
          </Button>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            You don&apos;t have permission to edit templates. Ask an admin with <code>settings.view</code> access.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
