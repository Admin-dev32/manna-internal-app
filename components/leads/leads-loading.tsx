import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function LeadsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-slate-950 p-6 text-white">
        <Skeleton className="h-5 w-24 bg-white/20" />
        <Skeleton className="mt-4 h-8 w-72 bg-white/20" />
        <Skeleton className="mt-3 h-4 w-full max-w-3xl bg-white/20" />
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
