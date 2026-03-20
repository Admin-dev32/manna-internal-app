import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const previewRows = [
  { area: 'CRM', estado: 'Pendiente', siguiente: 'Definir entidades base' },
  { area: 'Operación', estado: 'En preparación', siguiente: 'Diseñar flujos de eventos y tareas' },
  { area: 'Administración', estado: 'Pendiente', siguiente: 'Modelar métricas e inventario' },
];

export function DataPreviewTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Área</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Siguiente paso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {previewRows.map((row) => (
          <TableRow key={row.area}>
            <TableCell className="font-medium">{row.area}</TableCell>
            <TableCell>
              <Badge variant={row.estado === 'En preparación' ? 'secondary' : 'outline'}>{row.estado}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{row.siguiente}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
