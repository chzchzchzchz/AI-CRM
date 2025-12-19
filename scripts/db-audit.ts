import { getDb } from "../server/db";
import { accounts, contacts, calls, rfps, sixsense6QA, sixsenseKeywords, emailHistory, aiChatHistory, knowledgeBase, generatedContent, transcriptReports } from "../drizzle/schema";
import { sql, count, isNull, eq, or } from "drizzle-orm";

async function audit() {
  const db = await getDb();
  if (!db) {
    console.log("No database connection");
    return;
  }
  
  console.log("=== DATABASE AUDIT REPORT ===\n");
  
  // Table counts
  const tables = [
    { name: "accounts", table: accounts },
    { name: "contacts", table: contacts },
    { name: "calls", table: calls },
    { name: "rfps", table: rfps },
    { name: "sixsense6QA", table: sixsense6QA },
    { name: "sixsenseKeywords", table: sixsenseKeywords },
    { name: "emailHistory", table: emailHistory },
    { name: "aiChatHistory", table: aiChatHistory },
    { name: "knowledgeBase", table: knowledgeBase },
    { name: "generatedContent", table: generatedContent },
    { name: "transcriptReports", table: transcriptReports },
  ];
  
  console.log("=== TABLE ROW COUNTS ===");
  for (const { name, table } of tables) {
    try {
      const result = await db.select({ cnt: count() }).from(table);
      const cnt = result[0]?.cnt || 0;
      const status = cnt === 0 ? '❌ EMPTY' : cnt < 10 ? '⚠️  LOW' : '✅';
      console.log(`${status} ${name}: ${cnt} rows`);
    } catch (e) {
      console.log(`❓ ${name}: table may not exist`);
    }
  }
  
  // Data quality
  console.log("\n=== ACCOUNTS DATA QUALITY ===");
  const totalAccounts = await db.select({ cnt: count() }).from(accounts);
  const total = totalAccounts[0]?.cnt || 0;
  
  const noIntent = await db.select({ cnt: count() }).from(accounts).where(or(isNull(accounts.intentScore), eq(accounts.intentScore, 0)));
  console.log(`Missing intent score: ${noIntent[0]?.cnt}/${total}`);
  
  const noIndustry = await db.select({ cnt: count() }).from(accounts).where(or(isNull(accounts.industry), eq(accounts.industry, ''), eq(accounts.industry, 'Unknown')));
  console.log(`Missing industry: ${noIndustry[0]?.cnt}/${total}`);
  
  const noTechStack = await db.select({ cnt: count() }).from(accounts).where(or(isNull(accounts.techStack), eq(accounts.techStack, '')));
  console.log(`Missing tech stack: ${noTechStack[0]?.cnt}/${total}`);
  
  const noDomain = await db.select({ cnt: count() }).from(accounts).where(or(isNull(accounts.domain), eq(accounts.domain, '')));
  console.log(`Missing domain: ${noDomain[0]?.cnt}/${total}`);
  
  const noDesc = await db.select({ cnt: count() }).from(accounts).where(or(isNull(accounts.description), eq(accounts.description, '')));
  console.log(`Missing description: ${noDesc[0]?.cnt}/${total}`);
  
  const no6sense = await db.select({ cnt: count() }).from(accounts).where(isNull(accounts.sixsenseId));
  console.log(`Missing 6sense ID: ${no6sense[0]?.cnt}/${total}`);
  
  // Contacts quality
  console.log("\n=== CONTACTS DATA QUALITY ===");
  const totalContacts = await db.select({ cnt: count() }).from(contacts);
  const contactTotal = totalContacts[0]?.cnt || 0;
  
  const noEmail = await db.select({ cnt: count() }).from(contacts).where(or(isNull(contacts.email), eq(contacts.email, '')));
  console.log(`Missing email: ${noEmail[0]?.cnt}/${contactTotal}`);
  
  const noTitle = await db.select({ cnt: count() }).from(contacts).where(or(isNull(contacts.title), eq(contacts.title, '')));
  console.log(`Missing title: ${noTitle[0]?.cnt}/${contactTotal}`);
  
  const noLinkedin = await db.select({ cnt: count() }).from(contacts).where(or(isNull(contacts.linkedinUrl), eq(contacts.linkedinUrl, '')));
  console.log(`Missing LinkedIn: ${noLinkedin[0]?.cnt}/${contactTotal}`);
  
  // Calls quality
  console.log("\n=== CALLS DATA QUALITY ===");
  const totalCalls = await db.select({ cnt: count() }).from(calls);
  const callTotal = totalCalls[0]?.cnt || 0;
  
  const noAccountCall = await db.select({ cnt: count() }).from(calls).where(isNull(calls.accountId));
  console.log(`Calls without account link: ${noAccountCall[0]?.cnt}/${callTotal}`);
  
  const noTranscript = await db.select({ cnt: count() }).from(calls).where(or(isNull(calls.transcriptUrl), eq(calls.transcriptUrl, '')));
  console.log(`Calls without transcript: ${noTranscript[0]?.cnt}/${callTotal}`);
  
  process.exit(0);
}

audit();
