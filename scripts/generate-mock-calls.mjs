import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('🎭 Generating 10 mock Gong call transcripts...\n');

// Get all demo accounts and contacts
const [accounts] = await connection.query('SELECT * FROM accounts');
const [contacts] = await connection.query('SELECT * FROM contacts');

console.log(`Found ${accounts.length} accounts and ${contacts.length} contacts\n`);

const callTemplates = [
  {
    title: "Discovery Call - Security Requirements",
    duration: "45 min",
    transcript: `[00:02] Sales Rep: Thanks for taking the time today. I'd love to understand your current security infrastructure and pain points.

[00:45] Contact: We're currently using a mix of legacy systems and modern cloud solutions. Our biggest challenge is managing MFA across all platforms.

[02:15] Sales Rep: That's a common issue. Can you walk me through your current authentication flow?

[03:30] Contact: Right now we have separate MFA for AWS, our internal apps, and SaaS tools. It's creating friction for our users.

[05:00] Sales Rep: I see. How many users are we talking about?

[05:20] Contact: About 5,000 employees globally, plus contractors.

[07:45] Sales Rep: Got it. Have you looked at unified identity platforms before?

[08:10] Contact: We evaluated a few last year but didn't pull the trigger. Budget constraints and implementation concerns.

[10:30] Sales Rep: What would success look like for you in the next 6 months?

[11:00] Contact: Single sign-on across all platforms, reduced help desk tickets, and better security posture for compliance.

[15:20] Sales Rep: Those are exactly the outcomes our customers see. Let me show you how we've helped similar companies...

[40:00] Contact: This looks promising. What are the next steps?

[42:00] Sales Rep: I'll send over a custom proposal and some case studies from your industry. Can we schedule a technical deep dive for next week?

[43:30] Contact: Sounds good. Loop in our CISO and I'll get you on the calendar.`
  },
  {
    title: "Technical Deep Dive - Architecture Review",
    duration: "60 min",
    transcript: `[00:05] Solutions Engineer: Thanks for joining. I'll walk through our architecture and how it integrates with your existing stack.

[01:30] Technical Contact: We're particularly interested in how this handles our hybrid cloud setup.

[03:00] Solutions Engineer: Great question. Our platform is cloud-agnostic and supports on-prem, AWS, Azure, and GCP.

[05:45] Technical Contact: What about API rate limits? We have some high-volume applications.

[06:20] Solutions Engineer: Standard tier is 10,000 requests per minute, but we can customize for your needs.

[10:00] Technical Contact: How does failover work if your service goes down?

[11:15] Solutions Engineer: We have 99.99% uptime SLA with automatic failover to secondary regions. Let me show you our status page...

[20:30] Technical Contact: What's the implementation timeline typically?

[21:00] Solutions Engineer: For your scale, 4-6 weeks. We'd start with a pilot group, then roll out in phases.

[35:00] Technical Contact: Can you walk through the SSO configuration?

[36:00] Solutions Engineer: Absolutely. We support SAML, OAuth, and OpenID Connect...

[55:00] Technical Contact: This addresses most of our concerns. I'll need to review with the team, but I'm optimistic.`
  },
  {
    title: "Pricing Discussion - Enterprise Plan",
    duration: "30 min",
    transcript: `[00:10] Sales Rep: Let's talk through pricing options that make sense for your organization.

[01:00] Buyer: We're looking at a 3-year commitment. What kind of discount can you offer?

[01:45] Sales Rep: For a 3-year deal at your volume, we can offer 25% off list price.

[03:00] Buyer: That's still above our budget. We're comparing you against two other vendors.

[04:30] Sales Rep: I understand. Can you share what budget range you're working with?

[05:00] Buyer: We're targeting $800K annually, all-in.

[07:00] Sales Rep: Let me see what I can do. If we can hit that number, is there anything else blocking the deal?

[08:00] Buyer: Just legal review and final sign-off from the CFO.

[12:00] Sales Rep: I can get you to $850K annually with our premium support package included. That's a $1.2M value.

[15:00] Buyer: If you can throw in the advanced analytics module, we have a deal.

[18:00] Sales Rep: Let me check with my manager... [pause] ... Okay, we can make that work.

[25:00] Buyer: Great. Send over the updated proposal and I'll get it through legal this week.`
  },
  {
    title: "Quarterly Business Review - Usage & ROI",
    duration: "45 min",
    transcript: `[00:05] Customer Success Manager: Thanks for joining our QBR. Let's review your usage and outcomes over the past quarter.

[02:00] Customer: We've been really happy with the rollout so far.

[03:30] CSM: The data shows you're at 87% adoption across your user base. That's excellent for month 3.

[05:00] Customer: What's driving the remaining 13%?

[06:00] CSM: Mostly legacy systems that haven't been migrated yet. We can help accelerate that.

[10:00] Customer: What about cost savings? We need to show ROI for the renewal.

[11:30] CSM: Based on your help desk tickets, you've reduced password reset requests by 73%. That's roughly $180K in annual savings.

[15:00] Customer: That's great. Can you document that for our CFO?

[16:00] CSM: Absolutely. I'll send over a detailed ROI report this week.

[25:00] Customer: We're also looking at expanding to our EMEA offices next quarter.

[26:00] CSM: Perfect timing. Let's talk about what that expansion would look like...`
  },
  {
    title: "Renewal Discussion - Expansion Opportunity",
    duration: "40 min",
    transcript: `[00:10] Account Executive: Your renewal is coming up in 60 days. Let's talk about what's working and what's next.

[01:30] Customer: Overall we're happy, but we need to talk about pricing for the renewal.

[03:00] AE: I understand. Before we get into pricing, I noticed you're only using 60% of your licenses. Are you planning to grow?

[04:00] Customer: Actually yes. We're acquiring another company and need to add 2,000 users.

[06:00] AE: That's exciting. With that volume increase, I can actually reduce your per-user cost.

[08:00] Customer: What are we talking about?

[09:30] AE: Current rate is $45/user. At 7,000 users, I can get you to $38/user.

[12:00] Customer: That works. Can we also add the advanced reporting module?

[13:30] AE: Yes, and at this tier it's included at no additional cost.

[20:00] Customer: When can we start onboarding the new users?

[21:00] AE: As soon as the renewal is signed, we can begin. I'll have our CSM reach out to plan the migration.

[35:00] Customer: Let's do it. Send over the paperwork.`
  },
  {
    title: "Competitive Displacement - Win Back",
    duration: "50 min",
    transcript: `[00:15] Sales Rep: I understand you evaluated us last year but went with a competitor. What's changed?

[01:30] Prospect: Their implementation was a disaster. Took 9 months instead of 3, and we're still having issues.

[03:00] Sales Rep: I'm sorry to hear that. What specific issues are you facing?

[04:00] Prospect: Performance problems, poor support response times, and the integration with our CRM never worked right.

[07:00] Sales Rep: Those are exactly the areas where we differentiate. Can you walk me through your current setup?

[10:00] Prospect: We have about 8,000 users across 15 locations. Mix of cloud and on-prem apps.

[15:00] Sales Rep: How soon do you need to make a change?

[16:00] Prospect: We're in the middle of our fiscal year planning. Ideally by Q1 next year.

[20:00] Sales Rep: That gives us time to do this right. Let me show you how we'd approach the migration...

[40:00] Prospect: This is much more thorough than what we saw before. What's the investment?

[42:00] Sales Rep: For your scale, we're looking at $1.2M annually. But given the competitive situation, I can work with you on migration credits.

[45:00] Prospect: Let's schedule a technical review with our team. If that goes well, we'll move forward.`
  },
  {
    title: "Executive Briefing - Strategic Alignment",
    duration: "30 min",
    transcript: `[00:05] VP Sales: Thanks for meeting with us today. I know your time is valuable.

[01:00] C-Level: I've heard good things from my team. Walk me through the strategic value.

[02:30] VP Sales: At the highest level, this is about reducing risk while enabling growth. Your team is spending too much time on identity management.

[04:00] C-Level: What's the business impact?

[05:00] VP Sales: Based on similar customers, you'll see 40% reduction in security incidents and 60% faster employee onboarding.

[08:00] C-Level: What about compliance? We're in a regulated industry.

[09:00] VP Sales: We're SOC 2 Type II, ISO 27001, and GDPR compliant. Many of our customers use us specifically for compliance.

[15:00] C-Level: Timeline and investment?

[16:00] VP Sales: 6-week implementation, $1.5M annually for your scale. ROI typically hits in 8-10 months.

[20:00] C-Level: Who else in our industry is using you?

[21:00] VP Sales: I can't name names without permission, but we have 8 of the top 20 companies in your sector.

[25:00] C-Level: Okay. Work with my team on the details. If they're comfortable, you have my support.`
  },
  {
    title: "Security Audit Review - Compliance Discussion",
    duration: "55 min",
    transcript: `[00:10] Security Lead: We need to review your security practices and compliance certifications.

[02:00] Solutions Engineer: Absolutely. Let me start with our security architecture...

[05:00] Security Lead: What encryption standards do you use?

[06:00] Solutions Engineer: AES-256 for data at rest, TLS 1.3 for data in transit. All keys are managed through AWS KMS.

[10:00] Security Lead: How do you handle key rotation?

[11:00] Solutions Engineer: Automatic rotation every 90 days, with manual rotation available anytime.

[18:00] Security Lead: What about penetration testing?

[19:00] Solutions Engineer: We do quarterly pen tests with third-party firms. I can share the executive summaries.

[25:00] Security Lead: How do you handle data residency requirements?

[26:00] Solutions Engineer: We have regional deployments in US, EU, and APAC. Data never leaves the region you specify.

[35:00] Security Lead: What's your incident response process?

[36:00] Solutions Engineer: We have a 24/7 SOC with defined SLAs. Critical incidents get escalated within 15 minutes.

[45:00] Security Lead: Can you provide customer references from regulated industries?

[46:00] Solutions Engineer: Yes, I'll connect you with three customers in financial services who can speak to our security posture.

[50:00] Security Lead: This looks solid. I'll recommend we move forward.`
  },
  {
    title: "Implementation Kickoff - Project Planning",
    duration: "45 min",
    transcript: `[00:05] Implementation Manager: Welcome to your kickoff call. Let's align on timeline, scope, and success criteria.

[02:00] Customer PM: We need to be live by end of Q2. Is that realistic?

[03:00] Implementation Manager: Yes, that gives us 12 weeks. Here's the phased approach we recommend...

[07:00] Customer PM: What do you need from us?

[08:00] Implementation Manager: Access to your identity provider, list of applications to integrate, and a pilot user group of 50-100 people.

[12:00] Customer PM: When do we start?

[13:00] Implementation Manager: Week 1 is discovery and architecture design. Week 2-3 is configuration. Week 4 is pilot testing.

[20:00] Customer PM: What about training?

[21:00] Implementation Manager: We'll do admin training in week 3, and end-user training in week 5 before the full rollout.

[30:00] Customer PM: How do we handle issues during rollout?

[31:00] Implementation Manager: You'll have a dedicated Slack channel with our team and daily standups during the critical phases.

[40:00] Customer PM: This sounds well-planned. Let's get started.`
  },
  {
    title: "Upsell Discussion - Advanced Features",
    duration: "35 min",
    transcript: `[00:10] Account Manager: I noticed you're not using our advanced analytics module. Can I show you what you're missing?

[01:30] Customer: We looked at it during the initial purchase but decided to start with the basics.

[03:00] Account Manager: That makes sense. Now that you're live, let me show you how analytics can help...

[07:00] Customer: What kind of insights would we get?

[08:00] Account Manager: User behavior patterns, security risk scoring, and automated compliance reporting.

[12:00] Customer: That compliance reporting would save our team a lot of time.

[13:00] Account Manager: Exactly. One of your peers in the industry saves 40 hours per month on audit prep.

[18:00] Customer: What's the additional cost?

[19:00] Account Manager: Normally $200K annually, but since you're an existing customer, I can do $150K.

[22:00] Customer: Can we trial it first?

[23:00] Account Manager: Absolutely. I'll enable it for 30 days at no cost. If you love it, we'll add it to your renewal.

[30:00] Customer: Deal. Let's try it out.`
  }
];

// Distribute calls across accounts (1-2 calls per account)
let callIndex = 0;
const callsToCreate = [];

for (let i = 0; i < accounts.length && callIndex < 10; i++) {
  const account = accounts[i];
  const accountContacts = contacts.filter(c => c.accountId === account.id);
  
  if (accountContacts.length === 0) continue;
  
  // Pick 1-2 calls for this account
  const numCalls = i < 4 ? 2 : 1; // First 4 accounts get 2 calls, rest get 1
  
  for (let j = 0; j < numCalls && callIndex < 10; j++) {
    const template = callTemplates[callIndex];
    const contact = accountContacts[Math.floor(Math.random() * accountContacts.length)];
    
    // Generate call date within last 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const callDate = new Date();
    callDate.setDate(callDate.getDate() - daysAgo);
    
    callsToCreate.push({
      accountId: account.id,
      contactId: contact.id,
      title: template.title,
      duration: template.duration,
      callDate: callDate,
      transcriptUrl: template.transcript,
      recordingUrl: `https://gong.io/call/demo-${callIndex + 1}`,
      participants: `${contact.name}, Sales Team`,
      sentiment: Math.random() > 0.3 ? 'positive' : 'neutral',
      createdAt: callDate,
      updatedAt: callDate
    });
    
    console.log(`✅ Call ${callIndex + 1}: "${template.title}" for ${account.name} (${contact.name})`);
    callIndex++;
  }
}

// Insert calls into database
if (callsToCreate.length > 0) {
  for (const call of callsToCreate) {
    await connection.query(
      `INSERT INTO calls (accountId, contactId, title, duration, callDate, transcriptUrl, recordingUrl, sentiment, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        call.accountId,
        call.contactId,
        call.title,
        parseInt(call.duration.replace(' min', '')) * 60, // Convert to seconds
        call.callDate,
        call.transcriptUrl,
        call.recordingUrl,
        call.sentiment,
        call.createdAt,
        call.updatedAt
      ]
    );
  }
  console.log(`\n✅ Successfully created ${callsToCreate.length} mock Gong calls!\n`);
} else {
  console.log('\n❌ No calls created - check account/contact data\n');
}

await connection.end();
