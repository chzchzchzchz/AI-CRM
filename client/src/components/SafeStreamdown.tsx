import { Streamdown } from "streamdown";
import { stripXmlReasoning } from "@/lib/stripXmlReasoning";

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
    <Streamdown className={className}>
      {cleanContent}
    </Streamdown>
  );
}
