/**
 * PING SEQUENCE CONTEXT
 * 
 * Hardcoded Ping platform overview and context for email generation,
 * account briefs, and contact briefs. This ensures all Ping sequence
 * outreach references the correct platform capabilities and value props.
 */

export const PING_PLATFORM_CONTEXT = {
  company: "Ping Identity",
  products: ["PingOne", "PingFederate", "Ping Intelligent Cloud"],
  
  // Core value proposition
  valueProposition: "Verified Trust Layer for PingIdentity - eliminate identity attack surface without slowing down workforce",
  
  // Key capabilities and benefits
  capabilities: [
    "Eliminate phishing, MFA bypass, and other identity-based attacks, reducing attack surface by over 80%",
    "Eliminate password reset calls and free up IT and support resources for high-impact initiatives",
    "Accelerate productivity by giving end-users passwordless logins that are 50% faster than password-based authentication",
    "Lowered cyber insurance premiums with phishing-resistant MFA, device trust, and robust access controls",
  ],
  
  // Integration approach
  integration: {
    approach: "Orchestrated Defense",
    description: "Deploy {COMPANY_NAME} as a high-assurance IoP or MFA factor within PingOne DaVinci flows. Enforce strict device verification standards as a prerequisite for access.",
    benefits: [
      "Secure entire estate without custom work",
      "Leverage standard OIDC and SAML integrations",
      "Protect cloud apps, legacy systems, and VPNs alike",
    ],
  },
  
  // Risk mitigation
  riskMitigation: {
    approach: "Continuous Risk Neutralization",
    description: "Monitor dozens of device security settings—like firewall status and OS version—to detect and block compromised endpoints the moment they fall out of compliance.",
    benefits: [
      "Real-time threat detection and response",
      "Cryptographic proof of who is accessing what, from which device",
      "Defenses adapt in real-time to lock down assets",
    ],
  },
  
  // Technical architecture
  architecture: {
    coverage: "Universal Coverage",
    description: "Supports all operating systems and devices regardless of management state to provide 100% coverage for your device fleet.",
    benefits: [
      "Protect managed and unmanaged devices equally",
      "No gaps in security posture",
      "Comprehensive visibility across entire infrastructure",
    ],
  },
  
  // Customer example
  customerExample: {
    company: "Global financial software leader, 18K+ employees",
    challenge: "Legacy VPN-based access with device-bound identity enforcement",
    solution: "{COMPANY_NAME} + Ping integration replaced VPN with device-bound identity",
    outcomes: [
      "Reduced operational cost and friction of network-based access",
      "Strengthened overall security posture",
      "Eliminated password reset calls",
      "Accelerated user productivity",
    ],
  },
  
  // Competitive positioning
  competitive: {
    vsOkta: "{COMPANY_NAME} + Ping provides superior device trust and risk signals compared to Okta's native capabilities",
    vsAzure: "{COMPANY_NAME} + Ping offers passwordless MFA at scale with better device compliance monitoring than Azure AD",
    vsSilverfort: "{COMPANY_NAME} complements Ping with device-level risk signals; Silverfort focuses on identity fabric integration",
  },
  
  // Common pain points for Ping customers
  painPoints: [
    "Static policies fail to catch active threats and managed devices create blind spots",
    "Traditional MFA frustrates users while allowing attackers through",
    "Password reset calls consume IT resources without improving security",
    "VPN-based access is slow and creates network friction",
    "Unmanaged devices pose security risks without proper controls",
  ],
  
  // Talking points for different roles
  talkingPoints: {
    ciso: [
      "Reduce your identity attack surface by over 80% with device-bound passwordless authentication",
      "Achieve continuous risk neutralization with real-time device compliance monitoring",
      "Provide cryptographic proof of who accessed what, from which device",
      "Lower cyber insurance premiums with phishing-resistant MFA and device trust",
    ],
    cto: [
      "Simple integration with PingOne DaVinci flows using standard OIDC/SAML",
      "Universal device coverage for managed, unmanaged, and BYOD devices",
      "No custom development required - leverage standard integrations",
      "Protect cloud apps, legacy systems, and VPNs with a single solution",
    ],
    iam: [
      "Deploy {COMPANY_NAME} as a high-assurance IoP or MFA factor within PingOne",
      "Enforce strict device verification standards as a prerequisite for access",
      "Monitor device security settings in real-time to detect compromised endpoints",
      "Integrate with existing Ping infrastructure without disrupting current flows",
    ],
    it: [
      "Eliminate password reset calls and free up IT resources",
      "Reduce support burden with passwordless authentication that's 50% faster",
      "Simplify device management with universal coverage for all device types",
      "Reduce operational friction with device-bound access instead of VPN",
    ],
  },
};

/**
 * Generate Ping-specific account summary prompt
 */
export function getPingAccountSummaryPrompt(accountData: {
  name: string;
  industry?: string;
  employees?: number;
  techStack?: string[];
}): string {
  return `You are an elite Enterprise Account Executive for {COMPANY_NAME}, a passwordless MFA/Zero Trust security company.

CRITICAL CONTEXT - PING SEQUENCE:
This prospect uses Ping Identity (PingOne, PingFederate, or Ping Intelligent Cloud) for their identity infrastructure.

PING PLATFORM OVERVIEW:
${JSON.stringify(PING_PLATFORM_CONTEXT, null, 2)}

PROSPECT DETAILS:
- Company: ${accountData.name}
- Industry: ${accountData.industry || "Unknown"}
- Employees: ${accountData.employees || "Unknown"}
- Tech Stack: ${accountData.techStack?.join(", ") || "Unknown"}

YOUR TASK:
Generate a comprehensive account brief that positions {COMPANY_NAME} as the "Verified Trust Layer" for their Ping deployment.

REQUIREMENTS:
1. Analyze how {COMPANY_NAME} complements their Ping infrastructure
2. Identify specific pain points that {COMPANY_NAME} solves for Ping customers
3. Reference the Ping + {COMPANY_NAME} integration approach (Orchestrated Defense)
4. Surface competitive advantages vs. Okta/Azure/Silverfort
5. Provide Ping-specific talking points based on their likely role (CISO, CTO, IAM, IT)
6. Suggest the best engagement angle for a Ping customer

OUTPUT FORMAT:
Provide a structured brief with these sections:
- COMPANY OVERVIEW: Size, industry, location, business focus
- PING INFRASTRUCTURE ANALYSIS: How they likely use Ping, potential gaps
- {COMPANY_NAME} FIT: How {COMPANY_NAME} complements their Ping deployment
- PAIN POINTS: Specific challenges for Ping customers that {COMPANY_NAME} solves
- COMPETITIVE LANDSCAPE: How we differentiate from Okta, Azure, Silverfort
- RECOMMENDED TALKING POINTS: 3-4 Ping-specific angles for outreach
- ENGAGEMENT STRATEGY: Best approach for a Ping customer`;
}

/**
 * Generate Ping-specific contact summary prompt
 */
export function getPingContactSummaryPrompt(contactData: {
  name: string;
  title?: string;
  company?: string;
}): string {
  return `You are an elite Enterprise Account Executive for {COMPANY_NAME}.

CRITICAL CONTEXT - PING SEQUENCE:
This prospect works at a company that uses Ping Identity for their identity infrastructure.

PING PLATFORM OVERVIEW:
${JSON.stringify(PING_PLATFORM_CONTEXT, null, 2)}

CONTACT DETAILS:
- Name: ${contactData.name}
- Title: ${contactData.title || "Unknown"}
- Company: ${contactData.company || "Unknown"}

YOUR TASK:
Generate a personalized contact brief that references their Ping infrastructure and positions {COMPANY_NAME} as the ideal complement.

REQUIREMENTS:
1. Analyze their role and responsibilities within a Ping-using organization
2. Identify what matters to them based on their title (CISO, CTO, IAM, IT)
3. Reference the Ping + {COMPANY_NAME} integration approach
4. Provide role-specific talking points from our Ping context
5. Suggest the best angle to approach them specifically
6. Anticipate their concerns and objections

OUTPUT FORMAT:
Provide a structured brief with these sections:
- ROLE ANALYSIS: What they likely do in a Ping-using organization
- PING CONTEXT: How their role relates to Ping infrastructure
- PAIN POINTS: Specific challenges for someone in their role
- DECISION CRITERIA: What matters to them in vendor selection
- INFLUENCE LEVEL: Are they a decision-maker, influencer, or blocker?
- BEST ANGLE: How to approach them with {COMPANY_NAME} + Ping value prop
- PERSONALIZED TALKING POINTS: 3-4 angles tailored to their role
- COMMUNICATION STYLE: Recommended tone and approach`;
}

/**
 * Generate Ping-specific email system prompt
 */
export function getPingEmailSystemPrompt(): string {
  return `You are an elite Enterprise Account Executive for {COMPANY_NAME}.

CRITICAL CONTEXT - PING SEQUENCE:
This prospect uses Ping Identity (PingOne, PingFederate, or Ping Intelligent Cloud) for their identity infrastructure.

PING PLATFORM OVERVIEW:
${JSON.stringify(PING_PLATFORM_CONTEXT, null, 2)}

YOUR TASK:
Write a short (3-5 sentences), highly personalized outreach email that positions {COMPANY_NAME} as the "Verified Trust Layer" for their Ping deployment.

REQUIREMENTS:
1. Reference their Ping infrastructure specifically
2. Highlight how {COMPANY_NAME} complements Ping (Orchestrated Defense approach)
3. Reference one specific pain point that {COMPANY_NAME} solves
4. Use one of the Ping-specific talking points
5. Include ONE clear ask (meeting, demo, brief call)
6. Be human - write like a real person, not marketing robot
7. Be short - 3-5 sentences max

GOOD EXAMPLES:
- "Given your Ping deployment, you've likely seen the challenge of balancing security with user experience. {COMPANY_NAME} eliminates that tradeoff by adding device-bound passwordless authentication to your Ping flows—50% faster logins with 80% fewer identity attacks."
- "Your Ping infrastructure is solid, but static policies can't catch active threats. We've helped similar companies add continuous risk neutralization to their Ping deployment, blocking compromised endpoints in real-time."
- "Ping gives you strong identity controls, but password resets still consume IT resources. {COMPANY_NAME} eliminates password reset calls entirely by enabling passwordless authentication within PingOne DaVinci."

BAD EXAMPLES:
- "Your 97 intent score suggests you're actively evaluating identity solutions..."
- "Based on our 6sense data, we can see you're in the purchase stage..."
- Generic identity platform references without Ping context

OUTPUT:
Write only the email content itself, no preamble or explanation. The email should be immediately ready to send.`;
}
