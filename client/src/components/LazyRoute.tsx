import { Suspense, lazy, ComponentType } from "react";
import { Loader2 } from "lucide-react";

/**
 * Lazy load wrapper for route components
 * Shows loading spinner while component loads
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFunc);

  return (props: any) => (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );
}
