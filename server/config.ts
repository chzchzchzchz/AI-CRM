/**
 * Company Configuration
 * Loads company-specific settings from config/company-config.json
 * Can be overridden by environment variables
 */

import fs from 'fs';
import path from 'path';

export interface RepConfig {
  name: string;
  email: string;
  region: string;
  sizeSegment: "commercial" | "enterprise";
}

interface CompanyConfig {
  companyName: string;
  companyDescription: string;
  industry: string;
  productDescription: string;
  keyDifferentiators: string[];
  targetCustomers: string;
  competitors: string;
  // Branding / white-label
  productName: string;      // app/dashboard name shown in UI, emails, 2FA issuer
  supportContact: string;   // what the help bot tells users to do (e.g. "your admin", "#gtm-help on Slack")
  emailDomain: string;      // default domain for generated rep/demo emails
  reps: RepConfig[];        // sales reps / AEs for territory assignment (empty = none configured)
  apiKeys: {
    sixsense?: string;
    gong?: string;
    clay?: string;
    openai?: string;
  };
  demoMode: boolean;
}

// Built-in demo roster (100% synthetic). Kept in sync with client RepContext.
const DEFAULT_DEMO_REPS: RepConfig[] = [
  { name: "Alex Rivera", email: "alex.rivera@demo.example.com", region: "Central", sizeSegment: "commercial" },
  { name: "Jordan Bailey", email: "jordan.bailey@demo.example.com", region: "West", sizeSegment: "commercial" },
  { name: "Sam Okoye", email: "sam.okoye@demo.example.com", region: "East", sizeSegment: "commercial" },
  { name: "Taylor Brooks", email: "taylor.brooks@demo.example.com", region: "Central", sizeSegment: "enterprise" },
  { name: "Casey Morgan", email: "casey.morgan@demo.example.com", region: "West", sizeSegment: "enterprise" },
  { name: "Riley Nguyen", email: "riley.nguyen@demo.example.com", region: "East", sizeSegment: "enterprise" },
];

import { currentIdentity, type CompanyProfile } from "./_core/company-profile";

let cachedConfig: CompanyConfig | null = null;

export function getCompanyConfig(): CompanyConfig {
  // The calling ORGANIZATION's identity, when a request has set one.
  //
  // This function is synchronous, module-cached and read from 43 places — prompt builders
  // several frames inside AI paths that have no idea an organization exists. Every one of
  // them used to get the deployment's COMPANY_NAME, so on a self-serve instance a second
  // customer's outreach went out written as the operator's company, pitching the
  // operator's differentiators against the operator's competitors.
  //
  // Reading the scope here rather than threading an orgId through all 43 is deliberate:
  // the failure mode of missing one call site is silent, and a silently-wrong identity on
  // one prompt is the whole defect. See _core/company-profile.ts.
  const scoped = currentIdentity();
  if (!scoped) return deploymentConfig();
  // inherit:false means the profile IS the identity — a blank field is blank, not the
  // deployment's value showing through. See _core/company-profile.ts.
  const base = scoped.inherit ? deploymentConfig() : { ...deploymentConfig(), ...neutralBase() };
  return withProfile(base, scoped.profile, scoped.inherit);
}

/** The deployment's own identity, from config file or environment. Unchanged behaviour. */
function deploymentConfig(): CompanyConfig {
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
        productName: '',
        supportContact: '',
        emailDomain: '',
        reps: [],
        apiKeys: {
          sixsense: process.env.SIXSENSE_API_KEY,
          gong: process.env.GONG_API_KEY,
          clay: process.env.CLAY_API_KEY,
          openai: process.env.OPENAI_API_KEY,
        },
        demoMode: process.env.DEMO_MODE !== 'false',
      };
    }

    // Fill defaults for any fields missing from the config file, then apply
    // environment overrides. Keeps older config files forward-compatible.
    if (cachedConfig) {
      if (process.env.COMPANY_NAME) cachedConfig.companyName = process.env.COMPANY_NAME;
      if (process.env.COMPANY_DESCRIPTION) cachedConfig.companyDescription = process.env.COMPANY_DESCRIPTION;
      if (process.env.COMPANY_INDUSTRY) cachedConfig.industry = process.env.COMPANY_INDUSTRY;
      if (process.env.COMPANY_PRODUCT) cachedConfig.productDescription = process.env.COMPANY_PRODUCT;
      if (process.env.COMPANY_DIFFERENTIATORS) cachedConfig.keyDifferentiators = process.env.COMPANY_DIFFERENTIATORS.split(',');
      if (process.env.COMPANY_TARGET) cachedConfig.targetCustomers = process.env.COMPANY_TARGET;
      if (process.env.COMPANY_COMPETITORS) cachedConfig.competitors = process.env.COMPANY_COMPETITORS;

      // Branding / support / reps (config file value -> env override -> sensible default)
      cachedConfig.productName = process.env.PRODUCT_NAME || cachedConfig.productName || 'TargetDash';
      cachedConfig.supportContact = process.env.SUPPORT_CONTACT || cachedConfig.supportContact || 'your admin';
      cachedConfig.emailDomain = process.env.COMPANY_EMAIL_DOMAIN || cachedConfig.emailDomain || 'demo.example.com';
      if (!Array.isArray(cachedConfig.reps) || cachedConfig.reps.length === 0) {
        cachedConfig.reps = DEFAULT_DEMO_REPS;
      }
    }

    return cachedConfig!;
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
      productName: 'TargetDash',
      supportContact: 'your admin',
      emailDomain: 'demo.example.com',
      reps: DEFAULT_DEMO_REPS,
      apiKeys: {},
      demoMode: true,
    };
  }
}

/** The identity fields blanked, for a workspace that inherits nothing. */
function neutralBase(): Partial<CompanyConfig> {
  return {
    companyName: "Your company",
    productName: "Your product",
    companyDescription: "",
    industry: "",
    productDescription: "",
    keyDifferentiators: [],
    targetCustomers: "",
    competitors: "",
  } as Partial<CompanyConfig>;
}

/**
 * Overlay an organization's profile on a base, field by field.
 *
 * When inheriting, a blank field is skipped so the base shows through. When not, a blank
 * field is a real value and is written — that distinction is the whole reason the scope
 * carries `inherit`, and getting it wrong left the operator's differentiators in an
 * unconfigured customer's prompts while their company name was correctly blanked.
 */
function withProfile(base: CompanyConfig, profile: CompanyProfile, inherit: boolean): CompanyConfig {
  const merged: CompanyConfig = { ...base };
  for (const [k, v] of Object.entries(profile)) {
    if (v === undefined || v === null) continue;
    const blank = Array.isArray(v) ? v.length === 0 : String(v).trim() === "";
    if (blank && inherit) continue;
    (merged as any)[k] = v;
  }
  return merged;
}

export function getCompanyContext(): string {
  const config = getCompanyConfig();
  return `COMPANY: ${config.companyName} (${config.productDescription})
TARGET CUSTOMERS: ${config.targetCustomers}
KEY DIFFERENTIATORS: ${config.keyDifferentiators.join(', ')}
COMPETITORS: ${config.competitors}`;
}
