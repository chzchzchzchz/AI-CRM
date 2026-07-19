import { describe, it, expect } from 'vitest';
import { validateJudgement, type Judgement } from './brief';
import { inferSeniority, type SignalPack } from './signals';

/**
 * The brief engine's safety guarantee is that no unverifiable claim reaches a rep.
 * These tests pin that guarantee down with known-bad input rather than waiting for a
 * model to hallucinate on its own.
 */

const pack: SignalPack = {
  account: {
    id: 1,
    name: 'Northwind Logistics',
    domain: 'northwind.com',
    website: null,
    linkedinUrl: null,
    industry: 'Logistics & Supply Chain',
    employeeCount: 2400,
    revenue: '$420M',
    location: 'Chicago, IL',
    region: 'Central',
    description: null,
    relationship: 'Opportunity',
    type: null,
    crmId: null,
  },
  intent: {
    score: 92,
    buyingStage: 'Purchase',
    profileFit: 'Strong',
    segments: [],
    history: [{ score: 92, category: null, source: '6sense', at: '2026-07-01T00:00:00.000Z' }],
    trend: 'flat',
    delta: -3,
    largestJump: 4,
    keywords: ['Zero Trust'],
    lastSyncedAt: null,
  },
  technology: { techStack: ['Salesforce', 'Outreach'], securityStack: ['Okta'] },
  triggers: ['New VP Sales hire'],
  stakeholders: {
    total: 2,
    withEmail: 2,
    bySeniority: { 'C-Suite': 0, VP: 1, Director: 1, Manager: 0, Individual: 0, Unknown: 0 },
    departments: ['Sales'],
    people: [
      { id: 1, name: 'Sarah Chen', title: 'VP Sales', seniority: 'VP', department: 'Sales', email: 's@x.com', linkedinUrl: null },
      { id: 2, name: 'Marcus Reyes', title: 'RevOps Director', seniority: 'Director', department: 'Revenue Operations', email: 'm@x.com', linkedinUrl: null },
    ],
  },
  conversations: {
    total: 1,
    lastCallDate: '2026-07-15T00:00:00.000Z',
    daysSinceLastCall: 3,
    totalDurationMinutes: 25,
    sentimentCounts: { positive: 1 },
    topics: ['manual CRM entry'],
    openActionItems: ['Send tailored demo'],
    recent: [],
  },
  pipeline: {
    total: 1,
    open: 1,
    won: 0,
    lost: 0,
    totalValue: 98000,
    weightedValue: 80360,
    stages: { Proposal: 1 },
    opportunities: [
      { name: 'Team Rollout', stage: 'Proposal', status: 'Open', amount: 98000, probability: 82, expectedCloseDate: '2026-07-31T00:00:00.000Z', aiSuccessScore: null },
    ],
  },
  coverage: { present: ['intent score'], missing: [], completeness: 1 },
  generatedAt: '2026-07-18T00:00:00.000Z',
};

const judgement = (over: Partial<Judgement>): Judgement => ({
  situation: 'Northwind Logistics is in the Purchase stage.',
  whyNow: [],
  actions: [],
  risks: [],
  ...over,
});

describe('brief validation', () => {
  it('keeps statements that reference real stakeholders and real amounts', () => {
    const { judgement: out, validation } = validateJudgement(
      judgement({
        actions: [{
          action: 'Send tailored demo to Sarah Chen',
          rationale: 'She owns the buying decision.',
          evidence: 'openActionItems: Send tailored demo',
          priority: 'high',
        }],
        risks: [{ risk: 'Deal may slip', evidence: 'pipeline $98,000 closing 2026-07-31' }],
      }),
      pack
    );

    expect(validation.dropped).toHaveLength(0);
    expect(out.actions).toHaveLength(1);
    expect(out.risks).toHaveLength(1);
  });

  it('drops an action that invents a stakeholder who is not on the account', () => {
    const { judgement: out, validation } = validateJudgement(
      judgement({
        actions: [{
          action: 'Loop in Jennifer Whitfield, their CISO',
          rationale: 'Security sign-off is needed.',
          evidence: 'stakeholders',
          priority: 'high',
        }],
      }),
      pack
    );

    expect(out.actions).toHaveLength(0);
    expect(validation.dropped).toHaveLength(1);
    expect(validation.dropped[0].reason).toContain('Jennifer Whitfield');
    expect(validation.dropped[0].section).toBe('Recommended Actions');
  });

  it('drops a claim citing a dollar figure the pipeline cannot support', () => {
    const { judgement: out, validation } = validateJudgement(
      judgement({
        whyNow: [{ point: 'Large deal in flight', evidence: 'pipeline value $450,000' }],
      }),
      pack
    );

    expect(out.whyNow).toHaveLength(0);
    expect(validation.dropped[0].reason).toContain('$450,000');
  });

  it('accepts the real weighted-pipeline figure', () => {
    const { validation } = validateJudgement(
      judgement({ whyNow: [{ point: 'Weighted forecast', evidence: 'weighted $80,360' }] }),
      pack
    );
    expect(validation.dropped).toHaveLength(0);
  });

  it('blanks a fabricating situation paragraph instead of showing it', () => {
    const { judgement: out, validation } = validateJudgement(
      judgement({ situation: 'Their CTO Robert Delgado has budget approved.' }),
      pack
    );

    expect(out.situation).toBe('');
    expect(validation.dropped.some((d) => d.section === 'Situation')).toBe(true);
  });

  it('does not mistake business vocabulary for a person', () => {
    const { validation } = validateJudgement(
      judgement({
        whyNow: [
          { point: 'Zero Trust interest is rising', evidence: 'intent keywords: Zero Trust' },
          { point: 'Purchase Stage reached', evidence: 'buyingStage: Purchase' },
        ],
      }),
      pack
    );
    expect(validation.dropped).toHaveLength(0);
  });
});

describe('seniority inference', () => {
  it('maps titles to seniority levels', () => {
    expect(inferSeniority('VP Sales')).toBe('VP');
    expect(inferSeniority('RevOps Director')).toBe('Director');
    expect(inferSeniority('Chief Information Security Officer')).toBe('C-Suite');
    expect(inferSeniority('Head of Revenue')).toBe('VP');
    expect(inferSeniority('Account Executive')).toBe('Individual');
    expect(inferSeniority(null)).toBe('Unknown');
  });
});
