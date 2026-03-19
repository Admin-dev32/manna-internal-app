import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function LeadsLoading() {
  return (
    <div className="flex flex-col gap-5 pb-10">
      <Card className="bg-slate-950 p-6 text-white">
        <Skeleton className="h-5 w-32 bg-white/20" />
        <Skeleton className="mt-4 h-10 w-full max-w-2xl bg-white/20" />
        <Skeleton className="mt-3 h-4 w-full max-w-3xl bg-white/20" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full bg-white/20" />
          ))}
        </div>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4 xl:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </CardContent>
      </Card>

      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((__, rowIndex) => (
              <Skeleton key={rowIndex} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
