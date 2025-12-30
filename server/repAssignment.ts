/**
 * Rep Assignment Logic
 * 
 * Territory Assignments:
 * - East: Miranda (Commercial <2000) + Kevin (Enterprise 2000+)
 * - Central: Zane (Commercial <2000) + Jeff (Enterprise 2000+)
 * - West: Morgan (Commercial <2000) + Dan (Enterprise 2000+)
 * 
 * Special Cases:
 * - Lost Opp: Data exists in Salesforce, rep should check SFDC
 * - SFDC Services: Unassigned accounts
 */

export interface RepInfo {
  name: string;
  email: string;
  type: 'commercial' | 'enterprise';
  territory: string;
}

export const REPS: Record<string, RepInfo> = {
  // East Territory
  miranda: {
    name: 'Miranda',
    email: 'miranda@company.com',
    type: 'commercial',
    territory: 'East'
  },
  kevin: {
    name: 'Kevin',
    email: 'kevin@company.com',
    type: 'enterprise',
    territory: 'East'
  },
  // Central Territory
  zane: {
    name: 'Zane',
    email: 'zane.torres@company.com',
    type: 'commercial',
    territory: 'Central'
  },
  jeff: {
    name: 'Jeff',
    email: 'jeff@company.com',
    type: 'enterprise',
    territory: 'Central'
  },
  // West Territory
  morgan: {
    name: 'Morgan',
    email: 'morgan@company.com',
    type: 'commercial',
    territory: 'West'
  },
  dan: {
    name: 'Dan',
    email: 'dan@company.com',
    type: 'enterprise',
    territory: 'West'
  }
};

export const TERRITORY_REPS: Record<string, { commercial: string; enterprise: string }> = {
  'East': { commercial: 'miranda', enterprise: 'kevin' },
  'Central': { commercial: 'zane', enterprise: 'jeff' },
  'West': { commercial: 'morgan', enterprise: 'dan' }
};

/**
 * Get the assigned rep for an account based on territory and company size
 */
export function getAssignedRep(territory: string | null, employeeCount: number | null): RepInfo | null {
  // Normalize territory
  const normalizedTerritory = normalizeTerritory(territory);
  
  if (!normalizedTerritory || !TERRITORY_REPS[normalizedTerritory]) {
    return null;
  }
  
  // Determine if commercial or enterprise based on employee count
  const isEnterprise = (employeeCount || 0) >= 2000;
  const repKey = isEnterprise 
    ? TERRITORY_REPS[normalizedTerritory].enterprise 
    : TERRITORY_REPS[normalizedTerritory].commercial;
  
  return REPS[repKey] || null;
}

/**
 * Normalize territory string to match our keys
 */
function normalizeTerritory(territory: string | null): string | null {
  if (!territory) return null;
  
  const t = territory.toLowerCase().trim();
  
  if (t.includes('east')) return 'East';
  if (t.includes('central')) return 'Central';
  if (t.includes('west')) return 'West';
  
  // Handle specific region mappings
  if (t.includes('northeast') || t.includes('southeast') || t.includes('mid-atlantic')) return 'East';
  if (t.includes('midwest') || t.includes('south central')) return 'Central';
  if (t.includes('pacific') || t.includes('mountain') || t.includes('southwest')) return 'West';
  
  return null;
}

/**
 * Get account status context for AI insights
 */
export function getAccountStatusContext(accountType: string | null): string {
  if (!accountType) return '';
  
  const type = accountType.toLowerCase().trim();
  
  if (type === 'lost opp' || type.includes('lost')) {
    return `
⚠️ LOST OPP STATUS: This account has previous opportunity history in Salesforce.
- Check SFDC for deal history, loss reasons, and previous contacts
- Review what went wrong before re-engaging
- May need different approach or timing than before
`;
  }
  
  if (type === 'sfdc services' || type.includes('services') || type === 'unassigned') {
    return `
📋 UNASSIGNED STATUS: This account is currently unassigned (SFDC Services).
- No rep currently owns this account
- Assign based on territory and company size before outreach
- Good opportunity for new rep to claim
`;
  }
  
  return '';
}

/**
 * Format rep assignment for display
 */
export function formatRepAssignment(territory: string | null, employeeCount: number | null): string {
  const rep = getAssignedRep(territory, employeeCount);
  
  if (!rep) {
    return 'Unassigned (territory not mapped)';
  }
  
  const segment = (employeeCount || 0) >= 2000 ? 'Enterprise' : 'Commercial';
  return `${rep.name} (${segment} - ${rep.territory})`;
}

/**
 * Get all reps for a territory
 */
export function getTerritoryReps(territory: string): RepInfo[] {
  const normalizedTerritory = normalizeTerritory(territory);
  if (!normalizedTerritory || !TERRITORY_REPS[normalizedTerritory]) {
    return [];
  }
  
  const repKeys = TERRITORY_REPS[normalizedTerritory];
  return [REPS[repKeys.commercial], REPS[repKeys.enterprise]];
}
