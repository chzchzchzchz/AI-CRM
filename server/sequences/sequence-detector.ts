/**
 * SEQUENCE DETECTOR
 * 
 * Detects which sequence an account belongs to based on Salesforce markers
 * and returns the appropriate context (Ping, Silverfort, AI, SDO)
 */

import { PING_PLATFORM_CONTEXT, getPingAccountSummaryPrompt, getPingContactSummaryPrompt, getPingEmailSystemPrompt } from './ping-context';
import { SILVERFORT_PLATFORM_CONTEXT, getSilverfortAccountSummaryPrompt, getSilverfortContactSummaryPrompt, getSilverfortEmailSystemPrompt } from './silverfort-context';

export type SequenceType = 'ping' | 'silverfort' | 'ai' | 'sdo';

export interface SequenceContext {
  type: SequenceType;
  platformContext: Record<string, unknown>;
  getAccountSummaryPrompt: (accountData: { name: string; industry?: string; employees?: number; techStack?: string[] }) => string;
  getContactSummaryPrompt: (contactData: { name: string; title?: string; company?: string }) => string;
  getEmailSystemPrompt: () => string;
}

/**
 * Detect sequence type from Salesforce account data
 */
export function detectSequenceType(sfdcData: {
  sequenceType?: string | null;
  campaignFocus?: string | null;
  buyingStage?: string | null;
  industry?: string | null;
  name?: string;
}): SequenceType {
  // Check explicit sequence type from Salesforce
  if (sfdcData.sequenceType) {
    const normalized = sfdcData.sequenceType.toLowerCase().trim();
    if (normalized === 'ping' || normalized === 'pingidentity') return 'ping';
    if (normalized === 'silverfort') return 'silverfort';
    if (normalized === 'ai') return 'ai';
    if (normalized === 'sdo') return 'sdo';
  }

  // Check campaign focus
  if (sfdcData.campaignFocus) {
    const focus = sfdcData.campaignFocus.toLowerCase();
    if (focus.includes('ping')) return 'ping';
    if (focus.includes('silverfort')) return 'silverfort';
    if (focus.includes('ai')) return 'ai';
    if (focus.includes('sdo')) return 'sdo';
  }

  // Check buying stage for clues
  if (sfdcData.buyingStage) {
    const stage = sfdcData.buyingStage.toLowerCase();
    // This is a fallback - buying stage alone doesn't determine sequence
    // but can be combined with other signals
  }

  // Check industry for infrastructure signals
  if (sfdcData.industry) {
    const industry = sfdcData.industry.toLowerCase();
    // Financial services often have legacy infrastructure -> Silverfort
    if (industry.includes('financial') || industry.includes('banking') || industry.includes('insurance')) {
      return 'silverfort';
    }
    // Tech companies often use modern identity -> Ping
    if (industry.includes('technology') || industry.includes('software') || industry.includes('saas')) {
      return 'ping';
    }
  }

  // Default to Ping if no markers found
  return 'ping';
}

/**
 * Get the sequence context for an account
 */
export function getSequenceContext(sequenceType: SequenceType): SequenceContext {
  switch (sequenceType) {
    case 'silverfort':
      return {
        type: 'silverfort',
        platformContext: SILVERFORT_PLATFORM_CONTEXT,
        getAccountSummaryPrompt: getSilverfortAccountSummaryPrompt,
        getContactSummaryPrompt: getSilverfortContactSummaryPrompt,
        getEmailSystemPrompt: getSilverfortEmailSystemPrompt,
      };

    case 'ping':
    default:
      return {
        type: 'ping',
        platformContext: PING_PLATFORM_CONTEXT,
        getAccountSummaryPrompt: getPingAccountSummaryPrompt,
        getContactSummaryPrompt: getPingContactSummaryPrompt,
        getEmailSystemPrompt: getPingEmailSystemPrompt,
      };

    // TODO: Implement AI and SDO sequences
    case 'ai':
    case 'sdo':
      // Fallback to Ping for now
      return {
        type: 'ping',
        platformContext: PING_PLATFORM_CONTEXT,
        getAccountSummaryPrompt: getPingAccountSummaryPrompt,
        getContactSummaryPrompt: getPingContactSummaryPrompt,
        getEmailSystemPrompt: getPingEmailSystemPrompt,
      };
  }
}

/**
 * Get sequence context with automatic detection
 */
export function getSequenceContextForAccount(accountData: {
  sequenceType?: string | null;
  campaignFocus?: string | null;
  buyingStage?: string | null;
  industry?: string | null;
  name?: string;
}): SequenceContext {
  const sequenceType = detectSequenceType(accountData);
  return getSequenceContext(sequenceType);
}
