import { describe, it, expect, vi } from 'vitest';
import { calculateVectorScores, type AccountData } from './vectorScoring';

describe('VECTOR Scoring System', () => {
  it('should calculate composite score from all dimensions', () => {
    const accountData: AccountData = {
      name: 'Test Company',
      intentScore: 85,
      temperature: 'Hot',
      totalContacts: 10,
      totalCalls: 5,
      employeeCount: 1500,
      industry: 'Financial Services',
      buyingStage: 'Decision',
    };

    const scores = calculateVectorScores(accountData);

    // Verify all score dimensions exist
    expect(scores).toHaveProperty('engagement');
    expect(scores).toHaveProperty('conversion');
    expect(scores).toHaveProperty('strategic');
    expect(scores).toHaveProperty('timing');
    expect(scores).toHaveProperty('composite');
    expect(scores).toHaveProperty('tier');

    // Verify scores are in valid range
    expect(scores.engagement).toBeGreaterThanOrEqual(0);
    expect(scores.engagement).toBeLessThanOrEqual(100);
    expect(scores.conversion).toBeGreaterThanOrEqual(0);
    expect(scores.conversion).toBeLessThanOrEqual(100);
    expect(scores.strategic).toBeGreaterThanOrEqual(0);
    expect(scores.strategic).toBeLessThanOrEqual(100);
    expect(scores.timing).toBeGreaterThanOrEqual(0);
    expect(scores.timing).toBeLessThanOrEqual(100);
    expect(scores.composite).toBeGreaterThanOrEqual(0);
    expect(scores.composite).toBeLessThanOrEqual(100);

    // Verify tier is valid (1-6)
    expect(scores.tier).toBeGreaterThanOrEqual(1);
    expect(scores.tier).toBeLessThanOrEqual(6);
  });

  it('should assign higher tier for high-intent accounts with engagement', () => {
    const highIntent: AccountData = {
      name: 'High Intent Corp',
      intentScore: 95,
      temperature: 'Hot',
      totalContacts: 20,
      totalCalls: 10,
      employeeCount: 5000,
      industry: 'Technology',
      buyingStage: 'Decision',
    };

    const lowIntent: AccountData = {
      name: 'Low Intent Corp',
      intentScore: 25,
      temperature: 'Cold',
      totalContacts: 2,
      totalCalls: 0,
      employeeCount: 50,
      industry: 'Unknown',
    };

    const highScores = calculateVectorScores(highIntent);
    const lowScores = calculateVectorScores(lowIntent);

    // High intent should have higher composite score
    expect(highScores.composite).toBeGreaterThan(lowScores.composite);
    
    // High intent should have better (lower number) tier
    expect(highScores.tier).toBeLessThanOrEqual(lowScores.tier);
  });

  it('should handle missing data gracefully', () => {
    const minimalData: AccountData = {
      name: 'Minimal Corp',
    };

    const scores = calculateVectorScores(minimalData);

    // Should not throw and should return valid scores
    expect(scores.composite).toBeGreaterThanOrEqual(0);
    expect(scores.tier).toBeGreaterThanOrEqual(1);
    expect(scores.tier).toBeLessThanOrEqual(6);
  });
});

describe('Revenue Architect Persona', () => {
  it('should export persona constants', async () => {
    const { REVENUE_ARCHITECT_PERSONA, STANDARDIZED_OUTPUT_STRUCTURE } = await import('./ai-system-prompt');
    
    expect(REVENUE_ARCHITECT_PERSONA).toBeDefined();
    expect(REVENUE_ARCHITECT_PERSONA).toContain('Revenue Architect');
    expect(REVENUE_ARCHITECT_PERSONA).toContain('{COMPANY_NAME}');
    
    expect(STANDARDIZED_OUTPUT_STRUCTURE).toBeDefined();
    expect(STANDARDIZED_OUTPUT_STRUCTURE).toContain('EXECUTIVE SUMMARY');
    expect(STANDARDIZED_OUTPUT_STRUCTURE).toContain('STAKEHOLDERS TABLE');
    expect(STANDARDIZED_OUTPUT_STRUCTURE).toContain('NEXT ACTIONS');
  });

  it('should have helper functions for persona application', async () => {
    const { withRCP, asRevenueArchitect, withRevenueArchitect } = await import('./ai-system-prompt');
    
    expect(typeof withRCP).toBe('function');
    expect(typeof asRevenueArchitect).toBe('function');
    expect(typeof withRevenueArchitect).toBe('function');
    
    // Test that functions return strings
    const rcpResult = withRCP('test context');
    expect(typeof rcpResult).toBe('string');
    expect(rcpResult).toContain('test context');
    
    const raResult = asRevenueArchitect('test task');
    expect(typeof raResult).toBe('string');
    expect(raResult).toContain('Revenue Architect');
    expect(raResult).toContain('test task');
  });
});
