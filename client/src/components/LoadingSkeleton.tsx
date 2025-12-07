import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AccountCardSkeleton() {
  return (
    <Card className="bg-slate-900/50 border-slate-800 animate-pulse">
      <CardContent className="p-6">
        <div className="h-4 bg-slate-800 rounded w-3/4 mb-3"></div>
        <div className="h-3 bg-slate-800 rounded w-1/2 mb-4"></div>
        <div className="flex gap-2">
          <div className="h-5 bg-slate-800 rounded w-16"></div>
          <div className="h-5 bg-slate-800 rounded w-20"></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContactCardSkeleton() {
  return (
    <Card className="bg-slate-900/50 border-slate-800 animate-pulse">
      <CardContent className="p-6">
        <div className="h-4 bg-slate-800 rounded w-2/3 mb-2"></div>
        <div className="h-3 bg-slate-800 rounded w-1/2 mb-3"></div>
        <div className="h-3 bg-slate-800 rounded w-3/4"></div>
      </CardContent>
    </Card>
  );
}

export function CallCardSkeleton() {
  return (
    <Card className="bg-slate-900/50 border-slate-800 animate-pulse">
      <CardContent className="p-6">
        <div className="h-4 bg-slate-800 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-slate-800 rounded w-1/2 mb-3"></div>
        <div className="h-16 bg-slate-800 rounded w-full"></div>
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 bg-slate-950/50 rounded-lg border border-slate-800 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 bg-slate-800 rounded w-1/3"></div>
            <div className="h-6 bg-slate-800 rounded w-16"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-800 rounded w-full"></div>
            <div className="h-3 bg-slate-800 rounded w-2/3"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="container py-8 space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-slate-800 rounded w-1/3"></div>
        <div className="h-4 bg-slate-800 rounded w-1/4"></div>
        <div className="flex gap-2">
          <div className="h-6 bg-slate-800 rounded w-24"></div>
          <div className="h-6 bg-slate-800 rounded w-20"></div>
          <div className="h-6 bg-slate-800 rounded w-28"></div>
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-slate-900/50 border-slate-800 animate-pulse">
            <CardContent className="p-6">
              <div className="h-8 w-8 bg-slate-800 rounded mb-2"></div>
              <div className="h-8 bg-slate-800 rounded w-16 mb-2"></div>
              <div className="h-3 bg-slate-800 rounded w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Cards Skeleton */}
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="bg-slate-900/50 border-slate-800 animate-pulse">
            <CardHeader>
              <div className="h-5 bg-slate-800 rounded w-1/3"></div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-4 bg-slate-800 rounded w-full"></div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
