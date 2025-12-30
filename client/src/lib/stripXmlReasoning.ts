/**
 * Strip XML reasoning tags from AI responses
 * 
 * The RCP (Recursive Cognitive Protocol) system prompt instructs the LLM to output
 * XML-style tags for its reasoning process. These tags cause React errors when
 * rendered via Streamdown or dangerouslySetInnerHTML.
 * 
 * This utility extracts only the final response content.
 */

// List of XML tags used by RCP protocol that should be stripped
const RCP_TAGS = [
  'COGNITION_START', 'COGNITION_END',
  'DECONSTRUCTION', 'BRANCHING', 'PATH_A', 'PATH_B', 'PATH_C',
  'CRITIQUE', 'SYNTHESIS', 'RECURSION_CHECK', 'FINAL_RESPONSE',
  // Deep-Think Layer 1 tags
  'REASONING_LOG', 'QUERY_ANALYSIS', 'INTENT', 'CONSTRAINTS',
  'HYPOTHESIS_GENERATION', 'PATH_1', 'PATH_2', 'PATH_3',
  'ADVERSARIAL_REVIEW', 'FLAWS_IN_PATH_1', 'FLAWS_IN_PATH_2', 'FLAWS_IN_PATH_3',
  'FINAL_SYNTHESIS', 'LOGIC_CHAIN', 'RAW_ANSWER',
  // Additional RCP tags that appear in responses
  'parse', 'nouns', 'verbs', 'concepts', 'constraints', 'define',
  'n1', 'n2', 'n3', 'n4', 'v1', 'v2', 'c1', 'c2', 'c3',
  'l1', 'l2', 'l3', 'l4', 'l5', 'l6',
  'p1', 'p2', 'p3', 'p4', 'p5',
  'branching', 'deconstruction', 'critique', 'synthesis',
  'integration', 'gaps', 'draft_solution', 'merged_insights',
  'discarded_paths', 'attack_path_a', 'attack_path_b', 'attack_path_c',
  'weak_assumption', 'fallacy', 'missing_data', 'validity_score',
  'VARIABLE', 'CONSTRAINT'
];

/**
 * Strip all XML reasoning tags from AI response content
 * Returns only the clean, renderable content
 */
export function stripXmlReasoning(content: string): string {
  if (!content) return '';
  
  let result = content;
  
  // First, try to extract content from FINAL_RESPONSE tag if present
  const finalResponseMatch = result.match(/<FINAL_RESPONSE>([\s\S]*?)<\/FINAL_RESPONSE>/i);
  if (finalResponseMatch) {
    result = finalResponseMatch[1].trim();
  }
  
  // Also try RAW_ANSWER tag
  const rawAnswerMatch = result.match(/<RAW_ANSWER>([\s\S]*?)<\/RAW_ANSWER>/i);
  if (rawAnswerMatch && !finalResponseMatch) {
    result = rawAnswerMatch[1].trim();
  }
  
  // Remove all known RCP XML tags (both opening and closing)
  for (const tag of RCP_TAGS) {
    // Case-insensitive removal of opening tags with any attributes
    const openTagRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    result = result.replace(openTagRegex, '');
    
    // Case-insensitive removal of closing tags
    const closeTagRegex = new RegExp(`</${tag}>`, 'gi');
    result = result.replace(closeTagRegex, '');
  }
  
  // Remove any remaining XML-like tags that look like RCP reasoning
  // This catches tags like <hypothesis_a>, <path_analysis>, etc.
  result = result.replace(/<\/?[a-z_]+[0-9]*>/gi, '');
  
  // Remove XML tags with attributes
  result = result.replace(/<\/?[a-z_]+[0-9]*\s+[^>]*>/gi, '');
  
  // Remove RCP stage headers and hypothesis patterns
  result = result.replace(/^\s*STAGE \d+:[^\n]*\n/gim, '');
  result = result.replace(/^\s*###\s*STAGE \d+:[^\n]*\n/gim, '');
  result = result.replace(/^\s*\*\*STAGE \d+:[^\n]*\*\*\n/gim, '');
  result = result.replace(/Hypothesis [A-Z]:\s*\*\*[^*]+\*\*/gi, '');
  result = result.replace(/Hypothesis [A-Z]:[^\n]*\n/gi, '');
  result = result.replace(/\*\*Hypothesis [A-Z]:[^\n]*\*\*/gi, '');
  result = result.replace(/Path [A-Z]:[^\n]*\n/gi, '');
  result = result.replace(/^\s*\d+\.\s*\*\*Define:\*\*[^\n]*\n/gim, '');
  result = result.replace(/^\s*\d+\.\s*\*\*Constraints:\*\*[^\n]*\n/gim, '');
  result = result.replace(/^\s*\d+\.\s*\*\*Query \d+[^\n]*\n/gim, '');
  result = result.replace(/^\s*BEGIN PROCESSING NOW\.?\s*$/gim, '');
  result = result.replace(/^\s*CONFIDENCE_SCORE:[^\n]*\n/gim, '');
  
  // Remove common AI boilerplate phrases
  result = result.replace(/The analysis is complete and adheres to all constraints\.?/gi, '');
  result = result.replace(/The analysis adheres to all constraints\.?/gi, '');
  result = result.replace(/This analysis adheres to all constraints\.?/gi, '');
  result = result.replace(/This analysis is complete\.?/gi, '');
  result = result.replace(/I have completed the analysis\.?/gi, '');
  
  // Clean up excessive whitespace
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  
  return result;
}

/**
 * Check if content contains RCP XML reasoning tags
 */
export function hasXmlReasoning(content: string): boolean {
  if (!content) return false;
  
  // Check for any of the known RCP tags
  for (const tag of RCP_TAGS) {
    const regex = new RegExp(`</?${tag}[^>]*>`, 'i');
    if (regex.test(content)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract the reasoning portion from AI response (for debug display)
 */
export function extractReasoning(content: string): string | null {
  if (!content) return null;
  
  // Try to extract COGNITION block
  const cognitionMatch = content.match(/<COGNITION_START>([\s\S]*?)<COGNITION_END>/i);
  if (cognitionMatch) {
    return cognitionMatch[0];
  }
  
  // Try to extract REASONING_LOG block
  const reasoningMatch = content.match(/<REASONING_LOG>([\s\S]*?)<\/REASONING_LOG>/i);
  if (reasoningMatch) {
    return reasoningMatch[0];
  }
  
  // If no specific blocks found but content has XML tags, return everything before FINAL_RESPONSE
  const finalResponseIndex = content.indexOf('<FINAL_RESPONSE>');
  if (finalResponseIndex > 0) {
    return content.substring(0, finalResponseIndex).trim();
  }
  
  return null;
}
