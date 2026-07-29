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
        // data-route-loading is how the quality gate knows the chunk has not arrived
        // yet. Without it the gate waits a fixed 2.2s and measures whatever is there,
        // which is a race: three routes were reported as 108 characters of content
        // because their chunk had not resolved, and a genuinely blank page looked
        // exactly the same as a slow one.
        <div
          data-route-loading="true"
          className="min-h-[60vh] flex items-center justify-center"
        >
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );
}
