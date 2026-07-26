import { Suspense, lazy } from "react";
import { stripXmlReasoning } from "@/lib/stripXmlReasoning";

/**
 * Streamdown is loaded on demand. It carries a markdown pipeline, Shiki syntax
 * grammars, KaTeX, and Mermaid — together the single largest thing in the app,
 * and none of it is needed until a model actually streams a reply. Importing it
 * eagerly put all of that in the initial bundle for every page load, including
 * the eleven screens that only render it conditionally.
 *
 * The split lives inside this wrapper rather than at the eleven call sites, so
 * nothing else has to know about it.
 */
const Streamdown = lazy(() =>
  import("streamdown").then(m => ({ default: m.Streamdown }))
);

interface SafeStreamdownProps {
  children: string;
  className?: string;
}

/**
 * SafeStreamdown - A wrapper around Streamdown that strips XML reasoning tags
 *
 * The RCP (Recursive Cognitive Protocol) system prompt causes LLMs to output
 * XML-style tags for reasoning. These tags cause React errors when rendered.
 * This component automatically strips those tags before rendering.
 */
export function SafeStreamdown({ children, className }: SafeStreamdownProps) {
  const cleanContent = stripXmlReasoning(children);

  return (
    <Suspense
      fallback={
        // Plain text while the renderer loads: the words are already here, so
        // showing a spinner would hide content the user could be reading.
        <div className={className} style={{ whiteSpace: "pre-wrap" }}>
          {cleanContent}
        </div>
      }
    >
      <Streamdown className={className}>{cleanContent}</Streamdown>
    </Suspense>
  );
}
