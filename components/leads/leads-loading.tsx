import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function LeadsLoading() {
  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-0">
      <Card className="bg-slate-950 p-6 text-white">
        <Skeleton className="h-5 w-24 bg-white/20" />
        <Skeleton className="mt-4 h-8 w-full max-w-xl bg-white/20" />
        <Skeleton className="mt-3 h-4 w-full max-w-3xl bg-white/20" />
        <div className="mt-5 flex gap-3">
          <Skeleton className="h-11 w-36 bg-white/20" />
          <Skeleton className="h-11 w-36 bg-white/20" />
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="grid gap-4 md:hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full rounded-3xl" />
          ))}
        </CardContent>
        <CardContent className="hidden md:block">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="mb-3 h-16 w-full last:mb-0" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
