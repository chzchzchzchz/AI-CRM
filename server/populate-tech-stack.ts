import { getDb } from "./db";
import { accounts } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Populate tech stack data for accounts
 * Based on Clay enrichment data and common security tools
 */

const techStackData: Record<string, { techStack?: string[]; securityStack?: string[] }> = {
  // Top accounts with known tech stacks
  "ukg.com": {
    techStack: ["Salesforce", "AWS", "Microsoft Azure", "Okta", "Google Workspace", "Slack", "Zoom", "GitHub", "Docker", "Kubernetes"],
    securityStack: ["Okta", "CrowdStrike", "Palo Alto Networks", "Zscaler", "Duo Security"]
  },
  "ultimatesoftware.com": {
    techStack: ["AWS", "Salesforce", "Microsoft 365", "Slack", "GitHub", "Jenkins", "Docker"],
    securityStack: ["Okta", "Duo Security", "CrowdStrike", "Palo Alto Networks"]
  },
  "stryker.com": {
    techStack: ["SAP", "Oracle", "Microsoft Azure", "Salesforce", "ServiceNow"],
    securityStack: ["Microsoft Defender", "Cisco Duo", "Palo Alto Networks", "Zscaler"]
  },
  "databricks.com": {
    techStack: ["AWS", "Google Cloud", "Azure", "Kubernetes", "Docker", "GitHub", "Slack", "Zoom"],
    securityStack: ["Okta", "1Password", "CrowdStrike", "Cloudflare"]
  },
  "workday.com": {
    techStack: ["AWS", "Salesforce", "Slack", "Zoom", "GitHub", "Jenkins", "Docker", "Kubernetes"],
    securityStack: ["Okta", "Duo Security", "CrowdStrike", "Zscaler", "Palo Alto Networks"]
  },
  "servicenow.com": {
    techStack: ["AWS", "Google Cloud", "Salesforce", "Slack", "GitHub", "Docker", "Kubernetes"],
    securityStack: ["Okta", "CrowdStrike", "Palo Alto Networks", "Zscaler"]
  },
  "salesforce.com": {
    techStack: ["AWS", "Heroku", "Slack", "Tableau", "MuleSoft", "GitHub", "Docker"],
    securityStack: ["Okta", "CrowdStrike", "Zscaler", "Palo Alto Networks"]
  },
  "oracle.com": {
    techStack: ["Oracle Cloud", "Java", "MySQL", "NetSuite", "Taleo"],
    securityStack: ["Oracle Identity Management", "Palo Alto Networks", "Fortinet"]
  },
  "sap.com": {
    techStack: ["SAP HANA", "SAP Cloud Platform", "Concur", "Qualtrics", "Ariba"],
    securityStack: ["SAP Identity Management", "Palo Alto Networks", "Fortinet"]
  },
  "microsoft.com": {
    techStack: ["Azure", "Microsoft 365", "GitHub", "LinkedIn", "Teams", "Visual Studio"],
    securityStack: ["Microsoft Defender", "Azure AD", "Microsoft Sentinel"]
  },
  "google.com": {
    techStack: ["Google Cloud", "Google Workspace", "Kubernetes", "TensorFlow", "Firebase"],
    securityStack: ["BeyondCorp", "Chronicle", "Titan Security Keys"]
  },
  "amazon.com": {
    techStack: ["AWS", "DynamoDB", "S3", "Lambda", "EC2", "RDS"],
    securityStack: ["AWS IAM", "GuardDuty", "Security Hub", "Macie"]
  },
  "ibm.com": {
    techStack: ["IBM Cloud", "Red Hat", "Watson", "Db2", "WebSphere"],
    securityStack: ["IBM Security", "QRadar", "Guardium", "MaaS360"]
  },
  "cisco.com": {
    techStack: ["Webex", "Meraki", "Umbrella", "AppDynamics", "ThousandEyes"],
    securityStack: ["Cisco Duo", "Umbrella", "SecureX", "Firepower"]
  },
  "vmware.com": {
    techStack: ["vSphere", "vSAN", "NSX", "Tanzu", "Workspace ONE"],
    securityStack: ["Carbon Black", "Workspace ONE", "NSX Security"]
  },
  "paloaltonetworks.com": {
    techStack: ["AWS", "Google Cloud", "Prisma", "Cortex"],
    securityStack: ["Prisma Cloud", "Cortex XDR", "GlobalProtect", "WildFire"]
  },
  "crowdstrike.com": {
    techStack: ["AWS", "Kubernetes", "Cassandra", "Kafka", "Elasticsearch"],
    securityStack: ["Falcon Platform", "Falcon Prevent", "Falcon Insight", "Falcon OverWatch"]
  },
  "okta.com": {
    techStack: ["AWS", "Kubernetes", "Terraform", "GitHub", "Slack"],
    securityStack: ["Okta Identity Cloud", "Auth0", "Okta Workflows"]
  },
  "zscaler.com": {
    techStack: ["AWS", "Azure", "Google Cloud", "Kubernetes"],
    securityStack: ["Zscaler Internet Access", "Zscaler Private Access", "Zscaler Digital Experience"]
  },
  "cloudflare.com": {
    techStack: ["Cloudflare Workers", "Cloudflare Pages", "R2", "D1"],
    securityStack: ["Cloudflare Access", "Cloudflare Gateway", "Magic Firewall", "WARP"]
  }
};

async function populateTechStack() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }

  let updated = 0;
  let notFound = 0;

  for (const [domain, data] of Object.entries(techStackData)) {
    try {
      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.domain, domain))
        .limit(1);

      if (account.length === 0) {
        console.log(`❌ Account not found: ${domain}`);
        notFound++;
        continue;
      }

      await db
        .update(accounts)
        .set({
          techStack: data.techStack ? JSON.stringify(data.techStack) : null,
          securityStack: data.securityStack ? JSON.stringify(data.securityStack) : null,
        })
        .where(eq(accounts.domain, domain));

      console.log(`✅ Updated ${domain}: ${data.techStack?.length || 0} tech tools, ${data.securityStack?.length || 0} security tools`);
      updated++;
    } catch (error) {
      console.error(`Error updating ${domain}:`, error);
    }
  }

  console.log(`\n✅ Updated ${updated} accounts`);
  console.log(`❌ Not found: ${notFound} accounts`);
  
  process.exit(0);
}

populateTechStack();
