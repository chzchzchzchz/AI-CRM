/**
 * Company Configuration
 * Loads company-specific settings from config/company-config.json
 * Can be overridden by environment variables
 */

import fs from 'fs';
import path from 'path';

interface CompanyConfig {
  companyName: string;
  companyDescription: string;
  industry: string;
  productDescription: string;
  keyDifferentiators: string[];
  targetCustomers: string;
  competitors: string;
  apiKeys: {
    sixsense?: string;
    gong?: string;
    clay?: string;
    openai?: string;
  };
  demoMode: boolean;
}

let cachedConfig: CompanyConfig | null = null;

export function getCompanyConfig(): CompanyConfig {
  if (cachedConfig) return cachedConfig;

  try {
    // Try to load from config file
    const configPath = path.join(process.cwd(), 'config', 'company-config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      cachedConfig = JSON.parse(configData);
    } else {
      // Default config for demo
      cachedConfig = {
        companyName: process.env.COMPANY_NAME || 'Demo Company',
        companyDescription: process.env.COMPANY_DESCRIPTION || 'AI-Native Sales Intelligence Platform',
        industry: process.env.COMPANY_INDUSTRY || 'B2B SaaS',
        productDescription: process.env.COMPANY_PRODUCT || 'Next-generation CRM with AI-powered insights',
        keyDifferentiators: (process.env.COMPANY_DIFFERENTIATORS || 'AI-first architecture,Zero manual entry,Real-time signals').split(','),
        targetCustomers: process.env.COMPANY_TARGET || 'Enterprise 1000+ employees, Financial Services, Healthcare, Tech',
        competitors: process.env.COMPANY_COMPETITORS || 'Salesforce, HubSpot, Traditional CRMs',
        apiKeys: {
          sixsense: process.env.SIXSENSE_API_KEY,
          gong: process.env.GONG_API_KEY,
          clay: process.env.CLAY_API_KEY,
          openai: process.env.OPENAI_API_KEY,
        },
        demoMode: process.env.DEMO_MODE !== 'false',
      };
    }

    // Override with environment variables if present
    if (process.env.COMPANY_NAME) cachedConfig.companyName = process.env.COMPANY_NAME;
    if (process.env.COMPANY_DESCRIPTION) cachedConfig.companyDescription = process.env.COMPANY_DESCRIPTION;
    if (process.env.COMPANY_INDUSTRY) cachedConfig.industry = process.env.COMPANY_INDUSTRY;
    if (process.env.COMPANY_PRODUCT) cachedConfig.productDescription = process.env.COMPANY_PRODUCT;
    if (process.env.COMPANY_DIFFERENTIATORS) cachedConfig.keyDifferentiators = process.env.COMPANY_DIFFERENTIATORS.split(',');
    if (process.env.COMPANY_TARGET) cachedConfig.targetCustomers = process.env.COMPANY_TARGET;
    if (process.env.COMPANY_COMPETITORS) cachedConfig.competitors = process.env.COMPANY_COMPETITORS;

    return cachedConfig;
  } catch (error) {
    console.error('Error loading company config:', error);
    // Return minimal default
    return {
      companyName: 'Demo Company',
      companyDescription: 'AI-Native Sales Intelligence Platform',
      industry: 'B2B SaaS',
      productDescription: 'Next-generation CRM',
      keyDifferentiators: ['AI-first'],
      targetCustomers: 'Enterprise',
      competitors: 'Traditional CRMs',
      apiKeys: {},
      demoMode: true,
    };
  }
}

export function getCompanyContext(): string {
  const config = getCompanyConfig();
  return `COMPANY: ${config.companyName} (${config.productDescription})
TARGET CUSTOMERS: ${config.targetCustomers}
KEY DIFFERENTIATORS: ${config.keyDifferentiators.join(', ')}
COMPETITORS: ${config.competitors}`;
}
