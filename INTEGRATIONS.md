# External Service Integrations

This document describes how to integrate external services with the Target Account Dashboard.

## Clay Integration

Clay is used for account and contact enrichment. The dashboard supports two integration methods:

### 1. Clay HTTP API (Pull)
Use the Clay HTTP API to manually trigger enrichment:

```typescript
// Example: Enrich an account using Clay API
const response = await fetch('https://api.clay.com/v1/enrichment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CLAY_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    domain: 'example.com',
    enrichments: ['company_info', 'tech_stack', 'security_stack']
  })
});
```

### 2. Clay Webhooks (Push)
Configure Clay to send enrichment data to your dashboard via webhook:

**Webhook Endpoint**: `POST /api/trpc/clay.syncAccount`

**Payload Example**:
```json
{
  "clayRecordId": "rec_123456",
  "name": "Acme Corp",
  "domain": "acme.com",
  "industry": "Technology",
  "employeeCount": 500,
  "revenue": "$50M-$100M",
  "location": "San Francisco, CA",
  "securityStack": ["Okta", "CrowdStrike", "Zscaler"],
  "techStack": ["AWS", "Salesforce", "Slack"],
  "triggerEvents": ["Hired new CISO", "Expanded to EU market"]
}
```

The webhook automatically creates or updates accounts in the database.

## 6sense Integration

6sense provides intent scoring data. Configure API credentials and use the intent scores endpoint:

```typescript
// Example: Fetch intent scores from 6sense
const response = await fetch('https://api.6sense.com/v1/intent/scores', {
  headers: {
    'Authorization': `Bearer ${SIXSENSE_API_KEY}`,
  }
});

// Store in database via tRPC
await trpc.intentScores.create.mutate({
  accountId: 123,
  score: 85,
  category: 'Security',
  keywords: JSON.stringify(['Zero Trust', 'MFA', 'SSO']),
  source: '6sense'
});
```

## Gong Integration

Gong provides call intelligence and conversation insights:

```typescript
// Example: Sync call data from Gong
const response = await fetch('https://api.gong.io/v2/calls', {
  headers: {
    'Authorization': `Bearer ${GONG_API_KEY}`,
  }
});

// Store call data
await trpc.calls.create.mutate({
  accountId: 123,
  contactId: 456,
  title: 'Discovery Call - Acme Corp',
  duration: 1800, // seconds
  gongCallId: 'call_789',
  sentiment: 'Positive',
  keyTopics: JSON.stringify(['Budget approved', 'Q4 timeline', 'Security requirements']),
  actionItems: JSON.stringify(['Send proposal', 'Schedule technical demo']),
  callDate: new Date()
});
```

## SAM.gov Integration

Monitor government RFPs and opportunities:

```typescript
// Example: Fetch RFPs from SAM.gov API
const response = await fetch('https://api.sam.gov/opportunities/v2/search', {
  params: {
    api_key: SAM_GOV_API_KEY,
    keywords: 'cybersecurity',
    postedFrom: '2024-01-01'
  }
});

// Store RFP data
await trpc.rfps.create.mutate({
  title: 'Cybersecurity Services Contract',
  description: 'Full description...',
  agency: 'Department of Defense',
  solicitationNumber: 'W91CRB-24-R-0001',
  postedDate: new Date('2024-01-15'),
  responseDeadline: new Date('2024-02-15'),
  awardAmount: '$5M-$10M',
  samGovId: 'opp_123456',
  url: 'https://sam.gov/opp/123456',
  status: 'active'
});
```

## Zapier Integration

Zapier webhooks enable workflow automation. Configure Zaps to trigger on events:

**Webhook Endpoint**: `POST /api/trpc/zapier.webhook`

**Payload Example**:
```json
{
  "event": "account.enriched",
  "data": {
    "accountId": 123,
    "accountName": "Acme Corp",
    "enrichmentSource": "clay",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

Use cases:
- Send Slack notifications when high-intent accounts are identified
- Create tasks in project management tools when RFPs match criteria
- Update CRM records when enrichment data is received

## OpenAI Integration

AI-powered research and outreach recommendations are already integrated via the built-in LLM helper:

```typescript
// Generate account research
const research = await trpc.ai.generateAccountResearch.mutate({
  accountId: 123,
  accountName: 'Acme Corp',
  industry: 'Technology',
  description: 'Leading SaaS provider...'
});

// Generate outreach recommendation
const outreach = await trpc.ai.generateOutreachRecommendation.mutate({
  accountId: 123,
  accountName: 'Acme Corp',
  contactName: 'John Doe',
  contactTitle: 'CISO',
  recentActivity: 'Downloaded whitepaper on Zero Trust'
});
```

## Environment Variables

Add these to your `.env` file:

```bash
# Clay
CLAY_API_KEY=your_clay_api_key
CLAY_WEBHOOK_SECRET=your_webhook_secret

# 6sense
SIXSENSE_API_KEY=your_6sense_api_key

# Gong
GONG_API_KEY=your_gong_api_key

# SAM.gov
SAM_GOV_API_KEY=your_sam_gov_api_key

# Zapier (optional - for webhook verification)
ZAPIER_WEBHOOK_SECRET=your_zapier_secret
```

## Testing Integrations

Use the provided test scripts to verify integrations:

```bash
# Test Clay webhook
curl -X POST http://localhost:3001/api/trpc/clay.syncAccount \
  -H "Content-Type: application/json" \
  -d '{"clayRecordId":"test_123","name":"Test Corp"}'

# Test Zapier webhook
curl -X POST http://localhost:3001/api/trpc/zapier.webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"test","data":{"message":"Hello"}}'
```
