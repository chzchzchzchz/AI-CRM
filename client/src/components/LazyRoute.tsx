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
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );
}
