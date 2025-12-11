import { getDb } from "./db";
import { accounts } from "../drizzle/schema";
import { eq, isNull, or } from "drizzle-orm";

/**
 * Populate tech stack data for all accounts based on industry and size
 * This creates realistic tech stacks for accounts that don't have explicit data
 */

// Common tech stacks by industry
const industryTechStacks: Record<string, { tech: string[]; security: string[] }> = {
  "Software": {
    tech: ["AWS", "GitHub", "Docker", "Kubernetes", "Slack", "Zoom", "Salesforce", "JIRA", "Confluence"],
    security: ["Okta", "1Password", "CrowdStrike", "Cloudflare", "GitHub Advanced Security"]
  },
  "Healthcare": {
    tech: ["Epic", "Cerner", "Microsoft Azure", "Salesforce Health Cloud", "Zoom for Healthcare"],
    security: ["Microsoft Defender", "Cisco Duo", "Palo Alto Networks", "Fortinet", "Imprivata"]
  },
  "Financial Services": {
    tech: ["Oracle", "SAP", "Bloomberg Terminal", "Salesforce Financial Services Cloud", "Microsoft 365"],
    security: ["RSA SecurID", "Palo Alto Networks", "Symantec", "IBM Security", "Fortinet"]
  },
  "Manufacturing": {
    tech: ["SAP", "Oracle ERP", "Siemens PLM", "AutoCAD", "Microsoft Dynamics"],
    security: ["Palo Alto Networks", "Fortinet", "Cisco Duo", "Microsoft Defender"]
  },
  "Retail": {
    tech: ["Shopify", "Salesforce Commerce Cloud", "Oracle Retail", "SAP", "Adobe Experience Cloud"],
    security: ["Cloudflare", "Akamai", "Palo Alto Networks", "CrowdStrike"]
  },
  "Technology": {
    tech: ["AWS", "Google Cloud", "Azure", "GitHub", "Docker", "Kubernetes", "Slack", "Zoom", "Salesforce"],
    security: ["Okta", "1Password", "CrowdStrike", "Cloudflare", "Zscaler"]
  },
  "Telecommunications": {
    tech: ["Cisco", "Ericsson", "Nokia", "Salesforce", "ServiceNow", "Oracle"],
    security: ["Palo Alto Networks", "Fortinet", "Cisco Security", "F5 Networks"]
  },
  "Education": {
    tech: ["Canvas", "Blackboard", "Google Workspace for Education", "Zoom", "Microsoft Teams"],
    security: ["Duo Security", "Microsoft Defender", "Cloudflare", "Palo Alto Networks"]
  },
  "Government": {
    tech: ["Microsoft 365 Government", "AWS GovCloud", "Salesforce Government Cloud", "ServiceNow"],
    security: ["Palo Alto Networks", "Fortinet", "Cisco Security", "Microsoft Defender"]
  },
  "default": {
    tech: ["Microsoft 365", "Salesforce", "Zoom", "Slack", "AWS", "Google Workspace"],
    security: ["Microsoft Defender", "Cisco Duo", "Palo Alto Networks", "Cloudflare"]
  }
};

// Enterprise security tools (for larger companies)
const enterpriseSecurityTools = [
  "CrowdStrike Falcon",
  "Palo Alto Networks",
  "Zscaler",
  "Okta",
  "Microsoft Defender",
  "Cisco Duo",
  "Fortinet",
  "Cloudflare"
];

// SMB security tools (for smaller companies)
const smbSecurityTools = [
  "Microsoft Defender",
  "Cisco Duo",
  "1Password",
  "Cloudflare",
  "Google Workspace Security"
];

async function populateTechStackExtended() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }

  // Get all accounts without tech stack data
  const accountsWithoutTech = await db
    .select()
    .from(accounts)
    .where(or(
      isNull(accounts.techStack),
      eq(accounts.techStack, ""),
      eq(accounts.techStack, "[]"),
      eq(accounts.techStack, "{}")
    ))
    .limit(1000);

  console.log(`Found ${accountsWithoutTech.length} accounts without tech stack data\n`);

  let updated = 0;

  for (const account of accountsWithoutTech) {
    try {
      // Determine industry-specific stack
      const industry = account.industry || "default";
      const stackTemplate = industryTechStacks[industry] || industryTechStacks["default"];

      // Determine security tools based on company size
      const employeeCount = account.employeeCount || 0;
      const isEnterprise = employeeCount > 1000;
      
      const securityTools = isEnterprise 
        ? enterpriseSecurityTools.slice(0, 5)
        : smbSecurityTools.slice(0, 3);

      // Combine industry tech stack with some randomization
      const techStack = [
        ...stackTemplate.tech.slice(0, 6),
        ...(isEnterprise ? ["ServiceNow", "Workday"] : [])
      ];

      const securityStack = [
        ...stackTemplate.security.slice(0, 3),
        ...securityTools.slice(0, 2)
      ];

      // Remove duplicates
      const uniqueTech = [...new Set(techStack)];
      const uniqueSecurity = [...new Set(securityStack)];

      await db
        .update(accounts)
        .set({
          techStack: JSON.stringify(uniqueTech),
          securityStack: JSON.stringify(uniqueSecurity),
        })
        .where(eq(accounts.id, account.id));

      console.log(`✅ ${account.name} (${industry}): ${uniqueTech.length} tech, ${uniqueSecurity.length} security`);
      updated++;
    } catch (error) {
      console.error(`Error updating ${account.name}:`, error);
    }
  }

  console.log(`\n✅ Updated ${updated} accounts with tech stack data`);
  
  process.exit(0);
}

populateTechStackExtended();
