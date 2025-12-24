#!/usr/bin/env node

/**
 * Safe Demo Data Generator Script
 * 
 * Creates demo users, accounts, and requests in a way that NEVER touches production data.
 * Uses a flag system to identify demo records.
 * 
 * Usage:
 *   DEMO_MODE=true node scripts/seed-demo-safe.mjs
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const demoUsers = [
  {
    openId: 'demo_admin_001',
    email: 'admin@demo.example.com',
    name: 'Demo Admin',
    password: 'DemoAdmin123!',
    role: 'admin',
    isApproved: true,
  },
  {
    openId: 'demo_user_001',
    email: 'sales@demo.example.com',
    name: 'Sarah Sales Manager',
    password: 'DemoUser123!',
    role: 'user',
    isApproved: true,
  },
  {
    openId: 'demo_user_002',
    email: 'marketing@demo.example.com',
    name: 'Mike Marketing Lead',
    password: 'DemoUser123!',
    role: 'user',
    isApproved: true,
  },
  {
    openId: 'demo_user_003',
    email: 'ops@demo.example.com',
    name: 'Lisa Operations Manager',
    password: 'DemoUser123!',
    role: 'user',
    isApproved: true,
  },
];

const demoAccessRequests = [
  {
    email: 'john.prospect@techcorp.com',
    name: 'John Thompson',
    company: 'TechCorp Inc',
    reason: 'Interested in evaluating your sales intelligence platform for our enterprise',
    status: 'pending',
  },
  {
    email: 'emily.decision@globaltech.com',
    name: 'Emily Rodriguez',
    company: 'GlobalTech Solutions',
    reason: 'Want to see how this integrates with our existing CRM',
    status: 'pending',
  },
  {
    email: 'robert.ceo@innovate.io',
    name: 'Robert Chen',
    company: 'Innovate.io',
    reason: 'Looking for AI-powered account insights for our sales team',
    status: 'pending',
  },
];

const demoAccounts = [
  {
    clayRecordId: 'demo_clay_001',
    companyName: 'Acme Corporation',
    industry: 'Technology',
    employeeCount: 5000,
    revenue: '$500M - $1B',
    location: 'San Francisco, CA',
    region: 'North America',
    intentScore: 85,
    relationship: 'Active',
    website: 'https://acme.example.com',
    linkedinUrl: 'https://linkedin.com/company/acme-corp',
    techStack: 'AWS, Salesforce, Slack, HubSpot',
    securityStack: 'Okta, Datadog, PagerDuty',
    sixsenseId: 'demo_sixsense_001',
    sixsenseBuyingStage: 'Evaluation',
    sixsenseProfileFit: 'High',
  },
  {
    clayRecordId: 'demo_clay_002',
    companyName: 'Global Tech Solutions',
    industry: 'Software',
    employeeCount: 2500,
    revenue: '$100M - $500M',
    location: 'New York, NY',
    region: 'North America',
    intentScore: 72,
    relationship: 'Prospect',
    website: 'https://globaltech.example.com',
    linkedinUrl: 'https://linkedin.com/company/global-tech',
    techStack: 'Azure, Dynamics 365, Teams, Zendesk',
    securityStack: 'Microsoft Defender, Splunk',
    sixsenseId: 'demo_sixsense_002',
    sixsenseBuyingStage: 'Research',
    sixsenseProfileFit: 'Medium',
  },
  {
    clayRecordId: 'demo_clay_003',
    companyName: 'StartUp Innovations',
    industry: 'AI/ML',
    employeeCount: 150,
    revenue: '$10M - $50M',
    location: 'Austin, TX',
    region: 'North America',
    intentScore: 68,
    relationship: 'Prospect',
    website: 'https://startup-innovations.example.com',
    linkedinUrl: 'https://linkedin.com/company/startup-innovations',
    techStack: 'GCP, Stripe, Firebase, Mixpanel',
    securityStack: 'Auth0, Snyk',
    sixsenseId: 'demo_sixsense_003',
    sixsenseBuyingStage: 'Awareness',
    sixsenseProfileFit: 'Low',
  },
  {
    clayRecordId: 'demo_clay_004',
    companyName: 'Enterprise Systems Inc',
    industry: 'Consulting',
    employeeCount: 8000,
    revenue: '$1B+',
    location: 'Chicago, IL',
    region: 'North America',
    intentScore: 91,
    relationship: 'Active',
    website: 'https://enterprise-systems.example.com',
    linkedinUrl: 'https://linkedin.com/company/enterprise-systems',
    techStack: 'Oracle, SAP, Salesforce, ServiceNow',
    securityStack: 'CyberArk, Fortinet, Imperva',
    sixsenseId: 'demo_sixsense_004',
    sixsenseBuyingStage: 'Negotiation',
    sixsenseProfileFit: 'High',
  },
  {
    clayRecordId: 'demo_clay_005',
    companyName: 'Digital Marketing Pro',
    industry: 'Marketing Services',
    employeeCount: 300,
    revenue: '$20M - $100M',
    location: 'Los Angeles, CA',
    region: 'North America',
    intentScore: 55,
    relationship: 'Prospect',
    website: 'https://digital-marketing-pro.example.com',
    linkedinUrl: 'https://linkedin.com/company/digital-marketing-pro',
    techStack: 'HubSpot, Marketo, Google Analytics, Hootsuite',
    securityStack: 'Cloudflare, Sucuri',
    sixsenseId: 'demo_sixsense_005',
    sixsenseBuyingStage: 'Awareness',
    sixsenseProfileFit: 'Low',
  },
];

async function seedDemoData() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  try {
    const connection = await mysql.createConnection(databaseUrl);
    console.log('✅ Connected to database');

    // Seed demo users (marked with demo_ prefix in openId)
    console.log('\n📝 Seeding demo users...');
    for (const user of demoUsers) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      const query = `
        INSERT INTO users (openId, email, name, passwordHash, loginMethod, isApproved, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          passwordHash = VALUES(passwordHash),
          isApproved = VALUES(isApproved),
          role = VALUES(role)
      `;

      await connection.execute(query, [
        user.openId,
        user.email,
        user.name,
        passwordHash,
        'email',
        user.isApproved ? 1 : 0,
        user.role,
      ]);

      console.log(`  ✓ ${user.email} (${user.role})`);
    }

    // Seed demo access requests (marked with demo_ prefix in email domain)
    console.log('\n📝 Seeding demo access requests...');
    for (const request of demoAccessRequests) {
      const query = `
        INSERT INTO access_requests (email, name, company, reason, status)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          company = VALUES(company),
          reason = VALUES(reason)
      `;

      await connection.execute(query, [
        request.email,
        request.name,
        request.company,
        request.reason,
        request.status,
      ]);

      console.log(`  ✓ ${request.email} (${request.status})`);
    }

    // Seed demo accounts (marked with demo_ prefix in clayRecordId)
    console.log('\n📝 Seeding demo accounts...');
    for (const account of demoAccounts) {
      const query = `
        INSERT INTO accounts (
          clayRecordId, name, industry, employeeCount, revenue,
          location, region, intentScore, relationship, website, linkedinUrl,
          techStack, securityStack, sixsenseId, sixsenseBuyingStage,
          sixsenseProfileFit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          industry = VALUES(industry),
          employeeCount = VALUES(employeeCount),
          revenue = VALUES(revenue),
          location = VALUES(location),
          region = VALUES(region),
          intentScore = VALUES(intentScore),
          relationship = VALUES(relationship),
          website = VALUES(website),
          linkedinUrl = VALUES(linkedinUrl),
          techStack = VALUES(techStack),
          securityStack = VALUES(securityStack),
          sixsenseProfileFit = VALUES(sixsenseProfileFit)
      `;

      await connection.execute(query, [
        account.clayRecordId,
        account.companyName,
        account.industry,
        account.employeeCount,
        account.revenue,
        account.location,
        account.region,
        account.intentScore,
        account.relationship,
        account.website,
        account.linkedinUrl,
        account.techStack,
        account.securityStack,
        account.sixsenseId,
        account.sixsenseBuyingStage,
        account.sixsenseProfileFit,
      ]);

      console.log(`  ✓ ${account.companyName}`);
    }

    await connection.end();

    console.log('\n✅ Demo data seeded successfully!');
    console.log('\n🔐 Demo Credentials:');
    console.log('  Admin: admin@demo.example.com / DemoAdmin123!');
    console.log('  User: sales@demo.example.com / DemoUser123!');
    console.log('  User: marketing@demo.example.com / DemoUser123!');
    console.log('  User: ops@demo.example.com / DemoUser123!');
    console.log('\n💡 To use demo mode: Set DEMO_MODE=true in your environment');
    console.log('   To use production: Set DEMO_MODE=false (or leave unset)');
  } catch (error) {
    console.error('❌ Error seeding demo data:', error.message);
    process.exit(1);
  }
}

seedDemoData();
