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

/**
 * The brief is now returned as structure as well as prose, so the UI can render an
 * action as an action. That creates a second way out of the engine — and a second way
 * for a scrubbed claim to escape. These pin the two paths to the same guarantee.
 */
describe('structured judgement carries the same guarantee as the prose', () => {
  it('returns only survivors, so a dropped claim cannot reappear as structure', () => {
    const { judgement: out, validation } = validateJudgement(
      judgement({
        actions: [
          {
            action: 'Send tailored demo to Sarah Chen',
            rationale: 'She owns the decision.',
            evidence: 'openActionItems: Send tailored demo',
            priority: 'high',
          },
          {
            action: 'Brief Jennifer Whitfield before the board review',
            rationale: 'She signs off on security spend.',
            evidence: 'stakeholders',
            priority: 'high',
          },
        ],
      }),
      pack
    );

    expect(validation.dropped).toHaveLength(1);
    expect(out.actions).toHaveLength(1);
    // The invented stakeholder must not survive anywhere in the returned object.
    expect(JSON.stringify(out)).not.toContain('Jennifer Whitfield');
  });

  it('catches an invented name shielded by an allowlisted word in front of it', () => {
    // Regression: candidate pairs used to be non-overlapping, so "Brief Jennifer
    // Whitfield" was only ever tested as "Brief Jennifer" — and "brief" is allowlisted
    // business vocabulary, so the fabrication passed. Any sentence-initial capital
    // ("Call Marcus Webb", "Send Diana Fowler…") was a way through.
    for (const shield of ['Brief', 'Call', 'Demo', 'Target']) {
      const { validation } = validateJudgement(
        judgement({
          risks: [{ risk: `${shield} Priya Raghunathan slips`, evidence: 'stakeholders' }],
        }),
        pack
      );
      expect(validation.dropped, `"${shield} Priya Raghunathan" evaded detection`).toHaveLength(1);
    }
  });

  it('preserves priority and evidence on surviving actions', () => {
    // The UI ranks by priority and shows evidence as the reason to trust the action;
    // dropping either field silently would make the list look authoritative but bare.
    const { judgement: out } = validateJudgement(
      judgement({
        actions: [{
          action: 'Confirm rollout scope with Marcus Reyes',
          rationale: 'RevOps owns the integration work.',
          evidence: 'Team Rollout, Proposal stage, $98,000',
          priority: 'medium',
        }],
      }),
      pack
    );

    expect(out.actions[0].priority).toBe('medium');
    expect(out.actions[0].evidence).toContain('98,000');
  });

  /**
   * Reproduces a brief that shipped to the UI on account 18 (Cobaltreach Health). Its only
   * Competitor readings were 7 and 5; the brief cited "intent.competitor 6" and validation
   * returned no dropped claims, so the citation under "every claim cites the signal it rests
   * on" disagreed with the signal panel rendered directly beside it.
   */
  describe('figures cited against a signal-pack field', () => {
    const intentPack: SignalPack = {
      ...pack,
      intent: {
        ...pack.intent,
        score: 5,
        history: [
          { score: 5, category: 'Pain Point', source: '6sense', at: '2026-06-18T11:54:55.900Z' },
          { score: 7, category: 'Competitor', source: '6sense', at: '2026-06-26T11:54:55.900Z' },
          { score: 6, category: 'Compliance', source: '6sense', at: '2026-07-09T11:54:55.900Z' },
          { score: 5, category: 'Competitor', source: '6sense', at: '2026-07-17T11:54:55.900Z' },
        ],
      },
    };

    it('drops a claim whose cited score was never recorded under that category', () => {
      const { judgement: out, validation } = validateJudgement(
        judgement({
          whyNow: [{
            point: 'Competitor activity detected in past month',
            evidence: 'intent.competitor 6 score from 2026-07-17T11:54:55.900Z',
          }],
        }),
        intentPack
      );

      expect(out.whyNow).toHaveLength(0);
      expect(validation.dropped[0].reason).toContain('intent.competitor 6');
      // The reason names what the pack does hold, so the gap is legible rather than just refused.
      expect(validation.dropped[0].reason).toContain('5, 7');
    });

    it('keeps a score that was recorded under the category it is cited against', () => {
      const { judgement: out, validation } = validateJudgement(
        judgement({
          whyNow: [
            { point: 'Compliance interest', evidence: 'intent.compliance 6 score from 2026-07-09T11:54:55.900Z' },
            { point: 'Competitor pressure', evidence: 'intent.competitor 7 score from 2026-06-26T11:54:55.900Z' },
          ],
          risks: [
            { risk: 'Low purchase intent', evidence: 'intent.score 5' },
            { risk: 'No stakeholders mapped', evidence: 'stakeholders.total 2' },
          ],
        }),
        intentPack
      );

      expect(validation.dropped).toHaveLength(0);
      expect(out.whyNow).toHaveLength(2);
      expect(out.risks).toHaveLength(2);
    });

    it('reads a trailing timestamp as a date being quoted, not a figure being claimed', () => {
      // "intent.compliance 2026-07-09" must not be read as a claim that the score is 2026.
      const { validation } = validateJudgement(
        judgement({ whyNow: [{ point: 'Recent signal', evidence: 'intent.compliance 2026-07-09T11:54:55.900Z' }] }),
        intentPack
      );
      expect(validation.dropped).toHaveLength(0);
    });

    // Punctuation must not be a way out of the check. Excluding "." and "," outright to
    // dodge decimals and thousands separators also exempted the two commonest ways a
    // sentence ends, and a skipped claim is reported exactly like a passing one.
    it.each([
      ['a sentence-ending period', 'intent.competitor 6.'],
      ['a trailing comma', 'intent.competitor 6, which is unusual'],
      ['a closing parenthesis', 'intent.competitor 6)'],
    ])('still catches a wrong figure followed by %s', (_label, evidence) => {
      const { judgement: out, validation } = validateJudgement(
        judgement({ whyNow: [{ point: 'Competitor activity', evidence }] }),
        intentPack
      );
      expect(validation.dropped).toHaveLength(1);
      expect(out.whyNow).toHaveLength(0);
    });

    it('reads a comma-grouped figure as one number', () => {
      // "1" followed by ",500" must not be checked as the number 1 — nor skipped entirely.
      const grouped: SignalPack = {
        ...intentPack,
        pipeline: { ...intentPack.pipeline, totalValue: 1500 },
      };
      const good = validateJudgement(
        judgement({ risks: [{ risk: 'Small deal', evidence: 'pipeline.totalValue 1,500' }] }),
        grouped
      );
      expect(good.validation.dropped).toHaveLength(0);

      const bad = validateJudgement(
        judgement({ risks: [{ risk: 'Small deal', evidence: 'pipeline.totalValue 2,500' }] }),
        grouped
      );
      expect(bad.validation.dropped).toHaveLength(1);
    });

    it('leaves a field it does not model alone rather than guessing', () => {
      const { validation } = validateJudgement(
        judgement({ whyNow: [{ point: 'Keyword volume', evidence: 'intent.keywordVolume 41' }] }),
        intentPack
      );
      expect(validation.dropped).toHaveLength(0);
    });
  });

  it('blanks a fabricating situation so the caller can substitute a real one', () => {
    // generateAccountBrief swaps the blank for deterministicSituation(pack). If validation
    // returned the fabricated text instead, the structured path would ship it verbatim.
    const { judgement: out } = validateJudgement(
      judgement({ situation: 'Priya Raghunathan has championed the deal internally.' }),
      pack
    );
    expect(out.situation).toBe('');
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
