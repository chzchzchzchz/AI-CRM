/**
 * SILVERFORT SEQUENCE CONTEXT
 * 
 * Hardcoded Silverfort platform overview and context for email generation,
 * account briefs, and contact briefs. This ensures all Silverfort sequence
 * outreach references the correct platform capabilities and value props.
 */

export const SILVERFORT_PLATFORM_CONTEXT = {
  company: "Silverfort",
  products: ["Silverfort Identity Fabric", "Silverfort Agentless Access", "Silverfort Risk Engine"],
  
  // Core value proposition
  valueProposition: "Identity Fabric for Hybrid Enterprise - unified identity control across cloud, on-prem, and hybrid infrastructure",
  
  // Key capabilities and benefits
  capabilities: [
    "Unified identity fabric across cloud, on-premises, and hybrid environments",
    "Agentless access control without requiring endpoint agents",
    "Real-time risk assessment and adaptive access policies",
    "Legacy system protection without code changes or integrations",
    "Seamless integration with existing identity infrastructure (Okta, Ping, Azure AD, etc.)",
  ],
  
  // Integration approach
  integration: {
    approach: "Transparent Identity Fabric",
    description: "Deploy Silverfort as a transparent identity fabric layer that sits between users and applications. No agents required, no code changes, works with existing infrastructure.",
    benefits: [
      "Protect legacy systems without modification",
      "Works with any identity provider (Okta, Ping, Azure AD, etc.)",
      "Immediate deployment without disrupting existing workflows",
      "Unified policy enforcement across entire infrastructure",
    ],
  },
  
  // Risk mitigation
  riskMitigation: {
    approach: "Continuous Adaptive Risk Assessment",
    description: "Real-time risk scoring based on user behavior, device posture, network context, and threat intelligence. Policies adapt automatically to emerging threats.",
    benefits: [
      "Detect and block anomalous access patterns in real-time",
      "Reduce false positives with AI-powered risk scoring",
      "Adapt policies automatically without manual intervention",
      "Comprehensive audit trail for compliance and forensics",
    ],
  },
  
  // Technical architecture
  architecture: {
    coverage: "Universal Infrastructure Coverage",
    description: "Agentless architecture provides complete visibility and control across cloud, on-prem, and hybrid environments without requiring endpoint software.",
    benefits: [
      "No agents to deploy or manage",
      "Works with unmanaged and BYOD devices",
      "Protects legacy systems and custom applications",
      "Scales from small deployments to enterprise-wide infrastructure",
    ],
  },
  
  // Customer example
  customerExample: {
    company: "Global financial services firm, 50K+ employees",
    challenge: "Protect legacy mainframe and on-prem systems while enabling cloud migration",
    solution: "Silverfort Identity Fabric unified access control across legacy, on-prem, and cloud",
    outcomes: [
      "Reduced identity attack surface by 70%",
      "Eliminated VPN dependency for legacy system access",
      "Achieved compliance with zero trust architecture",
      "Reduced access provisioning time from weeks to minutes",
    ],
  },
  
  // Competitive positioning
  competitive: {
    vsPing: "Silverfort complements Ping by adding identity fabric layer; Ping provides identity orchestration",
    vsOkta: "Silverfort provides agentless access control for legacy systems that Okta cannot protect natively",
    vsAzure: "Silverfort extends Azure AD with universal infrastructure coverage including on-prem systems",
    vscompany: "Silverfort focuses on identity fabric and access control; the company focuses on device trust",
  },
  
  // Common pain points for Silverfort prospects
  painPoints: [
    "Legacy systems cannot be migrated to modern identity providers",
    "VPN-based access is slow and creates security blind spots",
    "Lack of unified identity control across cloud and on-prem",
    "Compliance requirements demand audit trail for all access",
    "Unmanaged devices create identity attack surface",
  ],
  
  // Talking points for different roles
  talkingPoints: {
    ciso: [
      "Unified identity control across entire infrastructure reduces attack surface",
      "Agentless architecture eliminates endpoint management complexity",
      "Real-time risk assessment adapts policies to emerging threats",
      "Complete audit trail for compliance and forensic investigation",
    ],
    cto: [
      "No agents to deploy or manage - immediate deployment",
      "Works with existing identity providers (Okta, Ping, Azure AD, etc.)",
      "Protects legacy systems without code changes",
      "Scales from small deployments to enterprise-wide infrastructure",
    ],
    infrastructure: [
      "Agentless deployment reduces operational overhead",
      "Works with any identity provider - no rip-and-replace required",
      "Transparent to applications and users",
      "Unified policy management across cloud and on-prem",
    ],
    compliance: [
      "Comprehensive audit trail for all access events",
      "Enforce policies consistently across entire infrastructure",
      "Demonstrate zero trust architecture to auditors",
      "Real-time compliance monitoring and reporting",
    ],
  },
};

/**
 * Generate Silverfort-specific account summary prompt
 */
export function getSilverfortAccountSummaryPrompt(accountData: {
  name: string;
  industry?: string;
  employees?: number;
  techStack?: string[];
}): string {
  return `You are an elite Enterprise Account Executive for Silverfort, an identity fabric platform.

CRITICAL CONTEXT - SILVERFORT SEQUENCE:
This prospect operates hybrid infrastructure with cloud, on-premises, and legacy systems.

SILVERFORT PLATFORM OVERVIEW:
${JSON.stringify(SILVERFORT_PLATFORM_CONTEXT, null, 2)}

PROSPECT DETAILS:
- Company: ${accountData.name}
- Industry: ${accountData.industry || "Unknown"}
- Employees: ${accountData.employees || "Unknown"}
- Tech Stack: ${accountData.techStack?.join(", ") || "Unknown"}

YOUR TASK:
Generate a comprehensive account brief that positions Silverfort as the unified identity fabric for their hybrid infrastructure.

REQUIREMENTS:
1. Analyze their likely infrastructure (cloud, on-prem, hybrid)
2. Identify pain points that Silverfort solves for hybrid enterprises
3. Reference the Silverfort agentless approach
4. Surface competitive advantages vs. Ping/Okta/Azure
5. Provide Silverfort-specific talking points based on their likely role (CISO, CTO, Infrastructure, Compliance)
6. Suggest the best engagement angle for a hybrid enterprise

OUTPUT FORMAT:
Provide a structured brief with these sections:
- COMPANY OVERVIEW: Size, industry, location, business focus
- INFRASTRUCTURE ANALYSIS: Likely cloud/on-prem/hybrid mix
- SILVERFORT FIT: How Silverfort unifies their infrastructure
- PAIN POINTS: Specific challenges for hybrid enterprises that Silverfort solves
- COMPETITIVE LANDSCAPE: How we differentiate from Ping, Okta, Azure
- RECOMMENDED TALKING POINTS: 3-4 Silverfort-specific angles for outreach
- ENGAGEMENT STRATEGY: Best approach for a hybrid enterprise`;
}

/**
 * Generate Silverfort-specific contact summary prompt
 */
export function getSilverfortContactSummaryPrompt(contactData: {
  name: string;
  title?: string;
  company?: string;
}): string {
  return `You are an elite Enterprise Account Executive for Silverfort.

CRITICAL CONTEXT - SILVERFORT SEQUENCE:
This prospect works at a company with hybrid infrastructure (cloud, on-prem, legacy systems).

SILVERFORT PLATFORM OVERVIEW:
${JSON.stringify(SILVERFORT_PLATFORM_CONTEXT, null, 2)}

CONTACT DETAILS:
- Name: ${contactData.name}
- Title: ${contactData.title || "Unknown"}
- Company: ${contactData.company || "Unknown"}

YOUR TASK:
Generate a personalized contact brief that references their hybrid infrastructure and positions Silverfort as the unified identity fabric.

REQUIREMENTS:
1. Analyze their role and responsibilities in a hybrid infrastructure organization
2. Identify what matters to them based on their title (CISO, CTO, Infrastructure, Compliance)
3. Reference the Silverfort agentless approach
4. Provide role-specific talking points from our Silverfort context
5. Suggest the best angle to approach them specifically
6. Anticipate their concerns and objections

OUTPUT FORMAT:
Provide a structured brief with these sections:
- ROLE ANALYSIS: What they likely do in a hybrid infrastructure organization
- INFRASTRUCTURE CONTEXT: How their role relates to hybrid infrastructure challenges
- PAIN POINTS: Specific challenges for someone in their role
- DECISION CRITERIA: What matters to them in vendor selection
- INFLUENCE LEVEL: Are they a decision-maker, influencer, or blocker?
- BEST ANGLE: How to approach them with Silverfort identity fabric value prop
- PERSONALIZED TALKING POINTS: 3-4 angles tailored to their role
- COMMUNICATION STYLE: Recommended tone and approach`;
}

/**
 * Generate Silverfort-specific email system prompt
 */
export function getSilverfortEmailSystemPrompt(): string {
  return `You are an elite Enterprise Account Executive for Silverfort.

CRITICAL CONTEXT - SILVERFORT SEQUENCE:
This prospect operates hybrid infrastructure with cloud, on-premises, and legacy systems.

SILVERFORT PLATFORM OVERVIEW:
${JSON.stringify(SILVERFORT_PLATFORM_CONTEXT, null, 2)}

YOUR TASK:
Write a short (3-5 sentences), highly personalized outreach email that positions Silverfort as the unified identity fabric for their hybrid infrastructure.

REQUIREMENTS:
1. Reference their hybrid infrastructure specifically
2. Highlight how Silverfort unifies identity control across cloud and on-prem
3. Reference one specific pain point that Silverfort solves
4. Use one of the Silverfort-specific talking points
5. Include ONE clear ask (meeting, demo, brief call)
6. Be human - write like a real person, not marketing robot
7. Be short - 3-5 sentences max

GOOD EXAMPLES:
- "Your hybrid infrastructure likely spans cloud, on-prem, and legacy systems. Silverfort unifies identity control across all of them without agents or code changes—protecting legacy systems while enabling cloud migration."
- "Managing identity across cloud and on-prem is complex. Silverfort's agentless fabric gives you unified access control and real-time risk assessment across your entire infrastructure."
- "Legacy systems are often the weakest link in hybrid infrastructure. Silverfort protects them without modification, giving you the same identity controls as your modern cloud environment."

BAD EXAMPLES:
- "Your 87 intent score suggests you're actively evaluating identity solutions..."
- "Based on our 6sense data, we can see you're in the purchase stage..."
- Generic identity platform references without hybrid infrastructure context

OUTPUT:
Write only the email content itself, no preamble or explanation. The email should be immediately ready to send.`;
}
