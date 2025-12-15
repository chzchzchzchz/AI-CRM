/**
 * VECTOR Lead Scoring System
 * Value-Engagement-Conversion-Timing-Opportunity-Readiness
 * 
 * This module calculates multi-dimensional lead scores and generates
 * deep analysis for any account using all available data.
 */

export interface VectorScores {
  engagement: number;      // 0-100: How engaged is this account?
  conversion: number;      // 0-100: How likely to convert?
  strategic: number;       // 0-100: How valuable strategically?
  timing: number;          // 0-100: How urgent is the timing?
  composite: number;       // 0-100: Overall VECTOR score
  tier: 1 | 2 | 3 | 4 | 5 | 6;  // Priority tier
}

export interface AccountData {
  // Core account data
  name: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  region?: string;
  relationship?: string;
  
  // Intent & buying signals
  intentScore?: number;
  buyingStage?: string;
  temperature?: string;
  
  // Engagement data
  totalContacts?: number;
  totalCalls?: number;
  lastCallDate?: Date | string;
  engagementActivities?: number;
  
  // Tech stack
  techStack?: any;
  securityStack?: any;
  
  // Contacts
  contacts?: Array<{
    name: string;
    title?: string;
    email?: string;
    department?: string;
    managementLevel?: string;
  }>;
  
  // Call history
  calls?: Array<{
    date: string;
    duration?: number;
    participants?: string[];
    summary?: string;
  }>;
}

/**
 * Calculate VECTOR scores for an account
 */
export function calculateVectorScores(data: AccountData): VectorScores {
  // 1. ENGAGEMENT SCORE (0-100)
  // Based on: contacts, calls, activities, recency
  let engagement = 0;
  
  // Contact volume (max 25 points)
  const contactCount = data.totalContacts || 0;
  engagement += Math.min(25, contactCount * 0.5);
  
  // Call volume (max 25 points)
  const callCount = data.totalCalls || 0;
  engagement += Math.min(25, callCount * 5);
  
  // Recency of last activity (max 25 points)
  if (data.lastCallDate) {
    const daysSinceCall = Math.floor((Date.now() - new Date(data.lastCallDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCall <= 7) engagement += 25;
    else if (daysSinceCall <= 30) engagement += 20;
    else if (daysSinceCall <= 90) engagement += 10;
    else engagement += 5;
  }
  
  // Engagement activities (max 25 points)
  const activities = data.engagementActivities || 0;
  engagement += Math.min(25, activities * 0.1);
  
  // 2. CONVERSION PROBABILITY (0-100)
  // Based on: intent score, buying stage, relationship status
  let conversion = 0;
  
  // Intent score contribution (max 50 points)
  const intentScore = data.intentScore || 0;
  conversion += intentScore * 0.5;
  
  // Buying stage contribution (max 30 points)
  const buyingStageMap: Record<string, number> = {
    'Purchase': 30,
    'Decision': 25,
    'Consideration': 15,
    'Awareness': 8,
    'Target': 3
  };
  conversion += buyingStageMap[data.buyingStage || ''] || 0;
  
  // Relationship status (max 20 points)
  const relationshipMap: Record<string, number> = {
    'Customer': 20,
    'Opportunity': 18,
    'Engaged': 15,
    'Prospect': 10,
    'Lost': 5
  };
  conversion += relationshipMap[data.relationship || ''] || 10;
  
  // 3. STRATEGIC VALUE (0-100)
  // Based on: company size, industry fit, tech stack compatibility
  let strategic = 0;
  
  // Company size (max 40 points)
  const employees = data.employeeCount || 0;
  if (employees >= 10000) strategic += 40;
  else if (employees >= 5000) strategic += 35;
  else if (employees >= 1000) strategic += 30;
  else if (employees >= 500) strategic += 20;
  else if (employees >= 100) strategic += 10;
  else strategic += 5;
  
  // Industry fit (max 30 points) - prioritize regulated industries
  const highValueIndustries = ['Financial Services', 'Banking', 'Insurance', 'Healthcare', 'Government', 'Defense'];
  const mediumValueIndustries = ['Technology', 'Software', 'Manufacturing', 'Retail', 'Energy'];
  if (highValueIndustries.some(i => (data.industry || '').toLowerCase().includes(i.toLowerCase()))) {
    strategic += 30;
  } else if (mediumValueIndustries.some(i => (data.industry || '').toLowerCase().includes(i.toLowerCase()))) {
    strategic += 20;
  } else {
    strategic += 10;
  }
  
  // Competitor presence (max 30 points) - displacement opportunity
  const competitors = ['Okta', 'Duo', 'Ping Identity', 'Microsoft Entra', 'Auth0', 'OneLogin'];
  const securityStack = JSON.stringify(data.securityStack || {}).toLowerCase();
  const hasCompetitor = competitors.some(c => securityStack.includes(c.toLowerCase()));
  if (hasCompetitor) strategic += 30;
  else strategic += 15; // Greenfield opportunity
  
  // 4. TIMING ALIGNMENT (0-100)
  // Based on: intent velocity, buying stage, recent triggers
  let timing = 0;
  
  // Intent score as timing indicator (max 50 points)
  if (intentScore >= 86) timing += 50;      // Purchase stage
  else if (intentScore >= 70) timing += 40; // Decision stage
  else if (intentScore >= 50) timing += 25; // Consideration
  else if (intentScore >= 20) timing += 10; // Awareness
  else timing += 5;
  
  // Temperature (max 30 points)
  const tempMap: Record<string, number> = {
    'Hot': 30,
    'Warm': 20,
    'Cold': 5
  };
  timing += tempMap[data.temperature || ''] || 10;
  
  // Recent engagement (max 20 points)
  if (callCount > 0 && data.lastCallDate) {
    const daysSince = Math.floor((Date.now() - new Date(data.lastCallDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 14) timing += 20;
    else if (daysSince <= 30) timing += 15;
    else timing += 5;
  }
  
  // 5. COMPOSITE SCORE
  // Weighted average: Conversion (35%), Timing (25%), Strategic (25%), Engagement (15%)
  const composite = Math.round(
    (conversion * 0.35) +
    (timing * 0.25) +
    (strategic * 0.25) +
    (engagement * 0.15)
  );
  
  // 6. TIER ASSIGNMENT
  let tier: 1 | 2 | 3 | 4 | 5 | 6;
  if (composite >= 80) tier = 1;
  else if (composite >= 65) tier = 2;
  else if (composite >= 50) tier = 3;
  else if (composite >= 35) tier = 4;
  else if (composite >= 20) tier = 5;
  else tier = 6;
  
  return {
    engagement: Math.round(engagement),
    conversion: Math.round(conversion),
    strategic: Math.round(strategic),
    timing: Math.round(timing),
    composite,
    tier
  };
}

/**
 * Generate the master deep analysis prompt for an account
 */
export function generateDeepAnalysisPrompt(data: AccountData, scores: VectorScores): string {
  const contactsList = (data.contacts || []).slice(0, 15).map(c => 
    `- ${c.name} | ${c.title || 'No title'} | ${c.email || 'No email'}`
  ).join('\n');
  
  const callsList = (data.calls || []).slice(0, 5).map(c =>
    `- ${c.date}: ${c.summary || 'No summary'}`
  ).join('\n');
  
  // Infer buying stage from intent if not set
  const intentNum = data.intentScore || 0;
  const inferredStage = data.buyingStage || (
    intentNum >= 86 ? 'Purchase' :
    intentNum >= 70 ? 'Decision' :
    intentNum >= 50 ? 'Consideration' :
    intentNum >= 20 ? 'Awareness' :
    'Target'
  );
  
  return `You are an elite B2B sales intelligence analyst. Perform a DEEP analysis of this account and generate tactical, actionable intelligence.

═══════════════════════════════════════════════════════════════════════════════
ACCOUNT: ${data.name}
═══════════════════════════════════════════════════════════════════════════════

VECTOR SCORES (Pre-calculated):
┌─────────────────┬────────┬──────────────────────────────────────────────────┐
│ Dimension       │ Score  │ Interpretation                                   │
├─────────────────┼────────┼──────────────────────────────────────────────────┤
│ Engagement      │ ${String(scores.engagement).padStart(3)}/100 │ ${scores.engagement >= 70 ? 'HIGH - Active engagement' : scores.engagement >= 40 ? 'MEDIUM - Some engagement' : 'LOW - Needs nurturing'}  │
│ Conversion      │ ${String(scores.conversion).padStart(3)}/100 │ ${scores.conversion >= 70 ? 'HIGH - Strong buy signals' : scores.conversion >= 40 ? 'MEDIUM - Developing interest' : 'LOW - Early stage'}  │
│ Strategic Value │ ${String(scores.strategic).padStart(3)}/100 │ ${scores.strategic >= 70 ? 'HIGH - Enterprise target' : scores.strategic >= 40 ? 'MEDIUM - Good fit' : 'LOW - Smaller opportunity'}  │
│ Timing          │ ${String(scores.timing).padStart(3)}/100 │ ${scores.timing >= 70 ? 'URGENT - Act now' : scores.timing >= 40 ? 'ACTIVE - Good timing' : 'DEVELOPING - Build pipeline'}  │
├─────────────────┼────────┼──────────────────────────────────────────────────┤
│ COMPOSITE       │ ${String(scores.composite).padStart(3)}/100 │ TIER ${scores.tier} PRIORITY                                    │
└─────────────────┴────────┴──────────────────────────────────────────────────┘

ACCOUNT DATA:
• Company: ${data.name}
• Domain: ${data.domain || 'Unknown'}
• Industry: ${data.industry || 'Unknown'}
• Employees: ${data.employeeCount?.toLocaleString() || 'Unknown'}
• Region: ${data.region || 'Unknown'}
• Relationship: ${data.relationship || 'Prospect'}

INTENT & BUYING SIGNALS:
• Intent Score: ${data.intentScore || 0}/100
• Buying Stage: ${inferredStage}
• Temperature: ${data.temperature || 'Unknown'}

ENGAGEMENT METRICS:
• Total Contacts: ${data.totalContacts || 0}
• Total Calls: ${data.totalCalls || 0}
• Last Call: ${data.lastCallDate || 'No calls recorded'}

TECHNOLOGY STACK:
${data.techStack ? JSON.stringify(data.techStack, null, 2) : 'Not available'}

SECURITY STACK:
${data.securityStack ? JSON.stringify(data.securityStack, null, 2) : 'Not available'}

KEY CONTACTS (Use EXACT names):
${contactsList || 'No contacts available'}

RECENT CALLS:
${callsList || 'No calls recorded'}

═══════════════════════════════════════════════════════════════════════════════
ANALYSIS REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

Generate a comprehensive analysis with these EXACT sections:

## 🎯 EXECUTIVE VERDICT
[One paragraph: What is this account, why does it matter, what should we do RIGHT NOW]

## 📊 VECTOR SCORE BREAKDOWN
Explain what each score means for THIS specific account and what's driving it.

## 👥 POWER MAP
| Contact | Title | Priority | Why Target | Approach |
|---------|-------|----------|------------|----------|
[Use EXACT names from data. Rank by influence. Include specific approach for each.]

## 🔥 BUYING SIGNALS
List specific signals indicating purchase intent:
1. [Signal with evidence]
2. [Signal with evidence]
3. [Signal with evidence]

## ⚔️ COMPETITIVE LANDSCAPE
Based on their security stack, identify:
- Current competitors in account
- Displacement strategy
- Differentiation points

## 💬 TALK TRACKS
Three specific conversation starters based on their actual situation:
1. **[Topic]:** "[Exact opening line]"
2. **[Topic]:** "[Exact opening line]"
3. **[Topic]:** "[Exact opening line]"

## ⚠️ RISKS & OBJECTIONS
| Risk | Likelihood | Mitigation |
|------|------------|------------|
[Specific risks for THIS account]

## 📋 ACTION PLAN
| Priority | Action | Owner | Contact | Deadline |
|----------|--------|-------|---------|----------|
| 1 | [Specific action] | AE | [Exact contact name] | [Timeframe] |
| 2 | [Specific action] | AE | [Exact contact name] | [Timeframe] |
| 3 | [Specific action] | AE | [Exact contact name] | [Timeframe] |

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════════
1. Use EXACT contact names from data - NEVER make up names
2. Use EXACT numbers from data - NEVER estimate
3. If data is missing, say "Data not available" - NEVER fabricate
4. Be tactical and specific - no generic advice
5. Every recommendation must reference real data points
6. Focus on the company's value prop: phishing-resistant MFA, passwordless auth
`;
}

/**
 * Get tier description
 */
export function getTierDescription(tier: number): string {
  const descriptions: Record<number, string> = {
    1: 'Tier 1: Immediate Priority - High intent, high value, ready to buy',
    2: 'Tier 2: Active Pursuit - Strong signals, needs focused attention',
    3: 'Tier 3: Developing - Good potential, building relationship',
    4: 'Tier 4: Nurture - Early stage, needs education',
    5: 'Tier 5: Monitor - Low current activity, watch for signals',
    6: 'Tier 6: Dormant - No active signals, periodic check-in'
  };
  return descriptions[tier] || 'Unknown tier';
}
