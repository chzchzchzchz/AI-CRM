// Realistic demo dataset generator: ~1000 companies, ~10,000 contacts.
//
// Realism is the point. Real books of business are SPARSE and UNEVEN — most accounts are
// cold with almost no enrichment; a few are hot with calls, opps, and intent history. That
// unevenness is exactly why a consolidation/intelligence layer is worth using: it surfaces
// the signal hiding in a mostly-empty CRM. So we deliberately vary coverage per account
// instead of giving everyone the same fields.
//
// Deterministic (seeded PRNG) so the committed seed is reproducible.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---- seeded PRNG (mulberry32) ------------------------------------------------------
let _s = 0x9e3779b9;
function rng() { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const rand = (a, b) => a + rng() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const chance = (p) => rng() < p;
const weighted = (pairs) => { const total = pairs.reduce((s, [, w]) => s + w, 0); let r = rng() * total; for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; } return pairs[0][0]; };
// power-law-ish: many small, few large
const powInt = (min, max, exp = 2.2) => Math.round(min + (max - min) * Math.pow(rng(), exp));

// ---- vocab -------------------------------------------------------------------------
const INDUSTRIES = [
  "B2B SaaS", "FinTech", "Cybersecurity", "Healthcare Technology", "Cloud Infrastructure",
  "Data & Analytics", "E-commerce & Retail", "Logistics & Supply Chain", "Manufacturing",
  "Clean Energy", "Biotech", "LegalTech", "InsurTech", "EdTech", "Media & Advertising",
  "Travel & Hospitality", "Real Estate Tech", "Telecommunications", "Automotive",
  "Aerospace & Defense", "Agriculture Tech", "Construction Tech", "Gaming", "Marketing Tech",
  "HR Tech", "PropTech", "Financial Services", "Pharmaceuticals", "Consumer Electronics",
  "Professional Services", "Non-Profit", "Government & Public Sector",
];
const REGIONS = [["West", 22], ["Central", 20], ["Northeast", 18], ["Southeast", 15], ["Southwest", 10], ["International", 15]];
const CITY_BY_REGION = {
  West: ["San Francisco, CA", "Seattle, WA", "Los Angeles, CA", "Portland, OR", "Denver, CO", "San Diego, CA"],
  Central: ["Chicago, IL", "Austin, TX", "Dallas, TX", "Minneapolis, MN", "Kansas City, MO", "Columbus, OH"],
  Northeast: ["New York, NY", "Boston, MA", "Philadelphia, PA", "Pittsburgh, PA", "Hartford, CT"],
  Southeast: ["Atlanta, GA", "Miami, FL", "Charlotte, NC", "Nashville, TN", "Orlando, FL"],
  Southwest: ["Phoenix, AZ", "Las Vegas, NV", "Albuquerque, NM", "Houston, TX", "Tucson, AZ"],
  International: ["London, UK", "Toronto, CA", "Berlin, DE", "Sydney, AU", "Dublin, IE", "Singapore, SG"],
};
const RELATIONSHIP = [["Prospect", 68], ["Opportunity", 16], ["Customer", 10], ["Lost", 6]];
const STAGES = ["Target", "Awareness", "Consideration", "Decision", "Purchase"];
const PROFILE_FIT = ["Strong", "Moderate", "Weak"];

const NAME_PREFIX = ["North", "Blue", "Bright", "Vertex", "Apex", "Summit", "Pioneer", "Quantum", "Cobalt", "Iron", "Silver", "Golden", "Cedar", "Harbor", "Atlas", "Nova", "Orbit", "Pulse", "Lumen", "Solstice", "Meridian", "Cascade", "Sterling", "Crimson", "Onyx", "Zenith", "Beacon", "Horizon", "Keystone", "Falcon", "Titan", "Ember", "Frost", "Granite", "Aspen", "Delta", "Echo", "Vantage", "Clarity", "Momentum"];
const NAME_ROOT = ["wind", "wave", "field", "stone", "gate", "bridge", "works", "labs", "logic", "core", "grid", "flow", "path", "point", "line", "base", "forge", "spring", "peak", "sync", "hub", "byte", "loop", "stack", "shift", "scale", "bloom", "reach", "dyne", "matrix"];
const NAME_SUFFIX = ["Systems", "Technologies", "Solutions", "Labs", "Group", "Industries", "Networks", "Software", "Analytics", "Digital", "Ventures", "Partners", "Global", "Health", "Financial", "Logistics", "Dynamics", "Corp", "Holdings", "Robotics", "Cloud", "Security", "Media", "Retail", "Energy", "Bio", ""];

const FIRST = ["Sarah", "James", "Maria", "David", "Jennifer", "Michael", "Linda", "Robert", "Priya", "Wei", "Carlos", "Aisha", "Daniel", "Emily", "Marcus", "Sofia", "Ahmed", "Hannah", "Kevin", "Olivia", "Raj", "Grace", "Tyler", "Nadia", "Ethan", "Chloe", "Omar", "Isabella", "Liam", "Zoe", "Andre", "Fatima", "Noah", "Yuki", "Diego", "Amara", "Ben", "Elena", "Samuel", "Leah", "Victor", "Naomi", "Jordan", "Mia", "Felix", "Ava", "Hassan", "Ruby", "Ian", "Nina"];
const LAST = ["Chen", "Reyes", "Sullivan", "Patel", "Kim", "Nguyen", "Garcia", "Johnson", "Okafor", "Rossi", "Muller", "Sato", "Silva", "Cohen", "Ahmed", "Novak", "Brown", "Martinez", "Wang", "Anderson", "Kowalski", "Ferrari", "Dubois", "Ivanov", "Singh", "Torres", "Walsh", "Bauer", "Fischer", "Romano", "Hansen", "Costa", "Blanc", "Petrov", "Nakamura", "Adeyemi", "Larsen", "Vargas", "Meyer", "Foster", "Riley", "Bauer", "Khan", "Diaz", "Watson", "Ali", "Park", "Reeves", "Bell", "Ortiz"];

const DEPTS = [
  { d: "Executive", w: 6, titles: [["CEO", "C-Suite"], ["President", "C-Suite"], ["Founder", "C-Suite"], ["Chief of Staff", "VP"]] },
  { d: "Sales", w: 16, titles: [["CRO", "C-Suite"], ["VP Sales", "VP"], ["VP Revenue", "VP"], ["Sales Director", "Director"], ["RevOps Director", "Director"], ["Regional Sales Manager", "Manager"], ["Account Executive", "Individual"], ["SDR", "Individual"], ["Sales Engineer", "Individual"]] },
  { d: "Marketing", w: 12, titles: [["CMO", "C-Suite"], ["VP Marketing", "VP"], ["Demand Gen Director", "Director"], ["Marketing Manager", "Manager"], ["Content Lead", "Manager"], ["Growth Marketer", "Individual"]] },
  { d: "Engineering", w: 18, titles: [["CTO", "C-Suite"], ["VP Engineering", "VP"], ["Engineering Director", "Director"], ["Engineering Manager", "Manager"], ["Staff Engineer", "Individual"], ["Senior Software Engineer", "Individual"], ["Software Engineer", "Individual"], ["Platform Engineer", "Individual"]] },
  { d: "IT & Security", w: 12, titles: [["CISO", "C-Suite"], ["CIO", "C-Suite"], ["VP Infrastructure", "VP"], ["Security Director", "Director"], ["IT Manager", "Manager"], ["Security Engineer", "Individual"], ["SysAdmin", "Individual"]] },
  { d: "Product", w: 9, titles: [["CPO", "C-Suite"], ["VP Product", "VP"], ["Product Director", "Director"], ["Product Manager", "Manager"], ["Product Analyst", "Individual"]] },
  { d: "Finance", w: 8, titles: [["CFO", "C-Suite"], ["VP Finance", "VP"], ["Controller", "Director"], ["Finance Manager", "Manager"], ["Financial Analyst", "Individual"]] },
  { d: "Operations", w: 9, titles: [["COO", "C-Suite"], ["VP Operations", "VP"], ["Ops Director", "Director"], ["Operations Manager", "Manager"], ["Business Analyst", "Individual"]] },
  { d: "Human Resources", w: 5, titles: [["CHRO", "C-Suite"], ["VP People", "VP"], ["HR Director", "Director"], ["HR Manager", "Manager"], ["Recruiter", "Individual"]] },
  { d: "Legal", w: 5, titles: [["General Counsel", "C-Suite"], ["VP Legal", "VP"], ["Legal Director", "Director"], ["Contracts Manager", "Manager"], ["Paralegal", "Individual"]] },
];
const TECH = ["Salesforce", "HubSpot", "AWS", "Google Cloud", "Azure", "Snowflake", "Databricks", "Segment", "Outreach", "Salesloft", "Gong", "6sense", "Marketo", "Zendesk", "Slack", "Workday", "NetSuite", "Jira", "Datadog", "Okta", "Tableau", "Looker", "Stripe", "Twilio", "MongoDB", "Kubernetes", "Terraform", "GitHub", "Notion", "Airtable"];
const SECURITY = ["Okta", "CrowdStrike", "Duo", "Microsoft Entra ID", "Auth0", "SentinelOne", "Palo Alto", "Zscaler", "Cloudflare", "1Password", "Splunk", "Wiz"];
const TRIGGERS = ["New VP Sales hire", "Series A raise", "Series B raise", "Series C raise", "Series D raise", "New CISO hire", "New CFO hire", "Cloud migration", "SOC 2 audit", "HIPAA compliance push", "Expanding sales team", "Acquisition announced", "New product launch", "Layoffs announced", "Office expansion", "Leadership transition", "GDPR initiative", "Digital transformation", "Hiring 10+ SDRs", "IPO filing"];
const INTENT_KW = ["account intelligence", "sales automation", "intent data", "lead scoring", "CRM migration", "revenue operations", "zero trust", "identity security", "data enrichment", "pipeline analytics", "conversation intelligence", "buyer intent", "ABM platform", "sales enablement", "forecasting", "territory planning"];
const CALL_TOPICS = ["pricing", "budget", "current tooling", "pain points", "integration needs", "security review", "rollout timeline", "team adoption", "competitor comparison", "ROI", "pilot scope", "data migration", "compliance", "renewal terms", "expansion"];
const CALL_ACTIONS = ["Send pricing proposal", "Schedule technical demo", "Loop in security team", "Share case study", "Draft pilot terms", "Follow up with champion", "Send integration docs", "Book exec alignment call", "Provide ROI model", "Confirm next steps"];
const SENTIMENT = [["positive", 55], ["neutral", 33], ["negative", 12]];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

function companyName() {
  const style = weighted([[0, 40], [1, 35], [2, 25]]);
  if (style === 0) return `${pick(NAME_PREFIX)}${pick(NAME_ROOT)} ${pick(NAME_SUFFIX)}`.trim();
  if (style === 1) return `${pick(NAME_PREFIX)} ${pick(NAME_SUFFIX)}`.trim();
  return `${pick(NAME_PREFIX)}${pick(NAME_ROOT)}`.trim();
}

// ---- load base seed, keep users + first hero accounts --------------------------------
const seedPath = path.join(ROOT, "demo-db.seed.json");
const base = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const HERO_COUNT = 16;
const heroAccounts = (base.accounts || []).slice(0, HERO_COUNT);
const heroIds = new Set(heroAccounts.map((a) => a.id));
const heroContacts = (base.contacts || []).filter((c) => heroIds.has(c.accountId));
const heroCalls = (base.calls || []).filter((c) => heroIds.has(c.accountId));
const heroOpps = (base.opportunities || []).filter((o) => heroIds.has(o.accountId));
const heroIntent = (base.intentScores || []).filter((r) => heroIds.has(r.accountId));

const TARGET_ACCOUNTS = 1000;
const TARGET_CONTACTS = 10800;

const accounts = [...heroAccounts];
const contacts = [...heroContacts];
const calls = [...heroCalls];
const opportunities = [...heroOpps];
const intentScores = [...heroIntent];

let accId = Math.max(...accounts.map((a) => a.id), 0);
let contactId = Math.max(0, ...contacts.map((c) => c.id));
let callId = Math.max(0, ...calls.map((c) => c.id));
let oppId = Math.max(0, ...opportunities.map((o) => o.id));
let intentId = Math.max(0, ...intentScores.map((r) => r.id));
const usedDomains = new Set(accounts.map((a) => a.domain));

function genAccount() {
  const id = ++accId;
  const industry = pick(INDUSTRIES);
  const region = weighted(REGIONS);
  const name = companyName();
  let domain = slug(name) + pick([".com", ".io", ".co", ".ai", ".com", ".com"]);
  let guard = 0;
  while (usedDomains.has(domain) && guard++ < 5) domain = slug(name) + randInt(2, 99) + ".com";
  usedDomains.add(domain);

  const employeeCount = powInt(8, 42000, 2.4);
  const relationship = weighted(RELATIONSHIP);

  // Intent: power law. Most accounts are cold; few are hot. A big chunk has NO 6sense data.
  const has6sense = chance(0.45);
  let intentScore = 0;
  if (has6sense) intentScore = weighted([["cold", 50], ["warm", 32], ["hot", 18]]) === "cold" ? randInt(1, 39) : (rng() < 0.64 ? randInt(40, 69) : randInt(70, 99));
  const buyingStage = has6sense ? (intentScore >= 86 ? "Purchase" : intentScore >= 70 ? "Decision" : intentScore >= 50 ? "Consideration" : intentScore >= 25 ? "Awareness" : "Target") : null;
  const profileFit = has6sense ? weighted([["Strong", intentScore], ["Moderate", 60], ["Weak", 40]]) : null;

  // Enrichment coverage varies wildly (the realism the user asked for).
  const techStack = chance(0.42) ? JSON.stringify(shuffleTake(TECH, randInt(3, 9))) : null;
  const securityStack = chance(0.24) ? JSON.stringify(shuffleTake(SECURITY, randInt(2, 5))) : null;
  const triggerEvents = chance(0.18) ? JSON.stringify(shuffleTake(TRIGGERS, randInt(1, 3))) : null;
  const revenue = chance(0.7) ? "$" + revenueFor(employeeCount) : null;
  const description = chance(0.5) ? `${industry} company; ${employeeCount.toLocaleString()} employees. ${pick(["Growing fast.", "Enterprise focus.", "Mid-market player.", "Recently funded.", "Established brand.", "Expanding into new markets."])}` : null;

  return {
    id, clayRecordId: null, clayTableId: null, name, domain,
    industry, employeeCount, revenue,
    location: pick(CITY_BY_REGION[region]), region,
    intentScore, relationship,
    description,
    website: `https://${domain}`,
    linkedinUrl: chance(0.6) ? `https://linkedin.com/company/${slug(name)}` : null,
    techStack, securityStack, triggerEvents,
    sixsenseBuyingStage: buyingStage, sixsenseProfileFit: profileFit,
    sfdcAccountId: chance(0.55) ? `acc_${slug(name)}_${id}` : null,
    createdAt: iso(randInt(30, 400)), updatedAt: iso(randInt(0, 20)),
    _has6sense: has6sense, // internal, stripped before write
  };
}
function revenueFor(emp) {
  const perHead = rand(90000, 320000);
  const v = emp * perHead;
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  return Math.round(v / 1e6) + "M";
}
function shuffleTake(arr, n) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }

function genContacts(acc, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const dept = weighted(DEPTS.map((d) => [d, d.w]));
    const [title, seniority] = pick(dept.titles);
    const first = pick(FIRST), last = pick(LAST);
    const id = ++contactId;
    out.push({
      id, accountId: acc.id, clayRecordId: null,
      firstName: first, lastName: last, name: `${first} ${last}`,
      title, seniority, department: dept.d,
      email: chance(0.82) ? `${first.toLowerCase()}.${last.toLowerCase()}@${acc.domain}` : null,
      phone: chance(0.38) ? `+1${randInt(200, 989)}${randInt(200, 989)}${randInt(1000, 9999)}` : null,
      linkedinUrl: chance(0.55) ? `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-${id}` : null,
      location: chance(0.5) ? acc.location : pick(CITY_BY_REGION[acc.region]),
      sfdcContactId: null, mobilePhone: null, directPhone: null,
      createdAt: acc.createdAt, updatedAt: iso(randInt(0, 30)),
    });
  }
  return out;
}

// ---- generate ----------------------------------------------------------------------
// contacts per account: power-law (1..40), some accounts get 0 (sparse). Tune to hit ~10k.
const newAccountCount = TARGET_ACCOUNTS - accounts.length;
const pending = [];
for (let i = 0; i < newAccountCount; i++) pending.push(genAccount());

// distribute ~ (TARGET_CONTACTS - existing) contacts across the new accounts, power-law.
let remaining = TARGET_CONTACTS - contacts.length;
const weights = pending.map(() => Math.pow(rng(), 1.7)); // most small, few large
const wsum = weights.reduce((s, w) => s + w, 0);
pending.forEach((acc, idx) => {
  let n = Math.round((weights[idx] / wsum) * remaining);
  n = Math.max(0, Math.min(40, n));
  if (chance(0.06)) n = 0; // some accounts have no contacts on file at all
  contacts.push(...genContacts(acc, n));

  // Opportunities: ~15% of accounts, more likely if warm/hot.
  const oppP = 0.06 + (acc.intentScore / 100) * 0.35;
  if (chance(oppP)) {
    const count = chance(0.85) ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const amount = Math.round(powInt(8000, 480000, 1.8) / 1000) * 1000;
      const status = weighted([["Open", 74], ["Won", 16], ["Lost", 10]]);
      const stage = status === "Won" ? "Closed Won" : status === "Lost" ? "Closed Lost" : pick(["Discovery", "Validation", "Proposal", "Negotiation"]);
      const probability = status === "Won" ? 100 : status === "Lost" ? 0 : ({ Discovery: 15, Validation: 35, Proposal: 60, Negotiation: 80 })[stage];
      opportunities.push({
        id: ++oppId, accountId: acc.id,
        name: `${acc.name} — ${pick(["Platform Rollout", "Team Expansion", "Enterprise Deal", "Pilot Program", "Annual Renewal", "Department License"])}`,
        amount: amount.toFixed(2), stage, probability, status,
        expectedCloseDate: iso(-randInt(5, 120)),
        sfdcOpportunityId: null,
        aiSuccessScore: Math.max(5, Math.min(98, acc.intentScore + randInt(-15, 15))),
        aiInsights: null,
        createdAt: iso(randInt(10, 90)), updatedAt: iso(randInt(0, 10)),
      });
    }
  }

  // Calls: ~12% of accounts, correlated with engagement.
  const callP = 0.04 + (acc.intentScore / 100) * 0.22;
  if (chance(callP) && contacts.some((c) => c.accountId === acc.id)) {
    const n = randInt(1, 4);
    const accContacts = contacts.filter((c) => c.accountId === acc.id);
    for (let k = 0; k < n; k++) {
      const dur = randInt(300, 2700);
      calls.push({
        id: ++callId, accountId: acc.id,
        contactId: pick(accContacts).id,
        title: `${acc.name} — ${pick(["Discovery Call", "Demo", "Follow-up", "Technical Review", "Exec Sync"])}`,
        duration: dur, recordingUrl: null, transcriptUrl: null,
        gongCallId: `gong_${acc.id}_${k}_${callId}`,
        sentiment: weighted(SENTIMENT),
        keyTopics: JSON.stringify(shuffleTake(CALL_TOPICS, randInt(2, 5))),
        actionItems: JSON.stringify(shuffleTake(CALL_ACTIONS, randInt(1, 3))),
        callDate: iso(randInt(1, 60)),
        createdAt: iso(randInt(1, 60)), updatedAt: iso(randInt(0, 5)),
      });
    }
  }

  // Intent time series: only 6sense accounts, weekly readings with a trend + occasional spike.
  if (acc._has6sense) {
    const points = randInt(4, 8);
    const trend = weighted([["rising", 40], ["flat", 35], ["falling", 25]]);
    const spike = chance(0.12);
    let score = Math.max(1, acc.intentScore - (trend === "rising" ? points * 4 : trend === "falling" ? -points * 3 : 0));
    for (let p = points; p >= 1; p--) {
      let s = Math.round(score);
      if (spike && p === 2) s = Math.min(99, s + randInt(15, 25));
      s = Math.max(1, Math.min(100, s));
      intentScores.push({
        id: ++intentId, accountId: acc.id, score: s,
        category: pick(["Product", "Competitor", "Pain Point", "Compliance", "Pricing"]),
        keywords: JSON.stringify(shuffleTake(INTENT_KW, randInt(1, 3))),
        source: "6sense",
        createdAt: iso(p * 7 + randInt(0, 2)), updatedAt: iso(p * 7),
      });
      score += trend === "rising" ? rand(2, 6) : trend === "falling" ? rand(-5, -1) : rand(-2, 2);
    }
    // ensure the account's current intentScore matches its latest reading
    const latest = intentScores.filter((r) => r.accountId === acc.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (latest) acc.intentScore = latest.score;
  }

  delete acc._has6sense;
  accounts.push(acc);
});

// ---- write -------------------------------------------------------------------------
// ---- RFPs ---------------------------------------------------------------------------
// The RFP feature is real (it pulls from SAM.gov and stores here), but it shipped with an
// empty table, so anyone opening the page without a federal API key saw a blank screen and
// reasonably concluded the feature was broken. Seed a small, plausible set — public-sector
// solicitations skew to a handful of agencies and a long tail of IT modernisation work.
const AGENCIES = [
  "General Services Administration", "Department of Veterans Affairs",
  "Department of Homeland Security", "Department of Health and Human Services",
  "Department of Defense", "Department of Energy", "NASA",
  "Department of Transportation", "Small Business Administration",
  "Environmental Protection Agency",
];
const RFP_SUBJECTS = [
  "Customer Relationship Management Platform Modernization",
  "Enterprise Sales Analytics and Reporting Services",
  "Cloud Data Warehouse Migration Support",
  "Identity and Access Management Modernization",
  "Contact Center Analytics Platform",
  "Zero Trust Architecture Implementation Services",
  "Enterprise Data Integration and Governance",
  "Constituent Engagement Platform",
  "Revenue Operations Software and Support",
  "Business Intelligence Modernization Initiative",
  "Secure Collaboration Platform Licensing",
  "Workforce Analytics and Planning System",
];
const RFP_STATUS = [["open", 62], ["closed", 24], ["awarded", 14]];

const rfps = [];
const rfpCount = 24;
for (let i = 0; i < rfpCount; i++) {
  const agency = pick(AGENCIES);
  const posted = randInt(5, 180);                 // days ago
  const deadline = posted - randInt(20, 90);      // may be in the past → closed
  const status = deadline > 0 ? "open" : weighted(RFP_STATUS);
  // Most solicitations aren't tied to an account we track; a few are.
  const linked = chance(0.3) ? pick(accounts).id : null;
  rfps.push({
    id: i + 1,
    accountId: linked,
    title: `${pick(RFP_SUBJECTS)}`,
    description: `${agency} is seeking qualified vendors for ${pick(RFP_SUBJECTS).toLowerCase()}. Responses must address technical approach, past performance, and pricing.`,
    agency,
    solicitationNumber: `${["GS", "VA", "HS", "HHS", "DOD"][randInt(0, 4)]}-${randInt(20, 26)}-R-${randInt(1000, 9999)}`,
    postedDate: iso(posted),
    responseDeadline: iso(deadline),
    awardAmount: chance(0.55) ? String(randInt(150, 9800) * 1000) : null,
    samGovId: `sam_${randInt(100000, 999999)}_${i}`,
    url: `https://sam.gov/opp/${randInt(100000, 999999).toString(16)}/view`,
    status,
    createdAt: iso(posted),
    updatedAt: iso(randInt(0, 5)),
  });
}

const out = { ...base, accounts, contacts, calls, opportunities, intentScores, rfps };
// trim internal fields
out.accounts.forEach((a) => { delete a._has6sense; });
fs.writeFileSync(seedPath, JSON.stringify(out, null, 1));

const hot = accounts.filter((a) => a.intentScore >= 70).length;
const withTech = accounts.filter((a) => a.techStack).length;
const withOpps = new Set(opportunities.map((o) => o.accountId)).size;
const withCalls = new Set(calls.map((c) => c.accountId)).size;
console.log(JSON.stringify({
  accounts: accounts.length, contacts: contacts.length, calls: calls.length,
  opportunities: opportunities.length, intentScores: intentScores.length,
  hotAccounts: hot, withTechStack: withTech, accountsWithOpps: withOpps, accountsWithCalls: withCalls,
  fileMB: +(fs.statSync(seedPath).size / 1e6).toFixed(2),
}, null, 2));
