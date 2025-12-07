import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  accounts, InsertAccount,
  contacts, InsertContact,
  intentScores, InsertIntentScore,
  calls, InsertCall,
  rfps, InsertRFP,
  enrichmentLogs, InsertEnrichmentLog,
  aiContext, InsertAIContext,
  documents, InsertDocument
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== USER OPERATIONS =====
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== ACCOUNT OPERATIONS =====
export async function getAllAccounts() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(accounts).orderBy(desc(accounts.updatedAt));
}

export async function getAccountById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createAccount(account: InsertAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(accounts).values(account);
  return result;
}

export async function updateAccount(id: number, account: Partial<InsertAccount>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(accounts).set(account).where(eq(accounts.id, id));
}

export async function deleteAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(accounts).where(eq(accounts.id, id));
}

// ===== CONTACT OPERATIONS =====
export async function getAllContacts() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(contacts).orderBy(desc(contacts.updatedAt));
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getContactsByAccountId(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(contacts).where(eq(contacts.accountId, accountId));
}

export async function createContact(contact: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contacts).values(contact);
  return result;
}

export async function updateContact(id: number, contact: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(contacts).set(contact).where(eq(contacts.id, id));
}

export async function deleteContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(contacts).where(eq(contacts.id, id));
}

// ===== INTENT SCORE OPERATIONS =====
export async function getIntentScoresByAccountId(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(intentScores)
    .where(eq(intentScores.accountId, accountId))
    .orderBy(desc(intentScores.createdAt));
}

export async function createIntentScore(score: InsertIntentScore) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(intentScores).values(score);
  return result;
}

// ===== CALL OPERATIONS =====
export async function getAllCalls() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(calls).orderBy(desc(calls.callDate));
}

export async function getCallById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(calls).where(eq(calls.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getCallsByAccountId(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(calls)
    .where(eq(calls.accountId, accountId))
    .orderBy(desc(calls.callDate));
}

export async function createCall(call: InsertCall) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(calls).values(call);
  return result;
}

// ===== RFP OPERATIONS =====
export async function getAllRFPs() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(rfps).orderBy(desc(rfps.postedDate));
}

export async function getRFPById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(rfps).where(eq(rfps.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createRFP(rfp: InsertRFP) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(rfps).values(rfp);
  return result;
}

// ===== ENRICHMENT LOG OPERATIONS =====
export async function createEnrichmentLog(log: InsertEnrichmentLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(enrichmentLogs).values(log);
  return result;
}

export async function getEnrichmentLogsByEntity(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(enrichmentLogs)
    .where(and(
      eq(enrichmentLogs.entityType, entityType),
      eq(enrichmentLogs.entityId, entityId)
    ))
    .orderBy(desc(enrichmentLogs.createdAt));
}

// ===== AI CONTEXT OPERATIONS =====
export async function createAIContext(context: InsertAIContext) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(aiContext).values(context);
  return result;
}

export async function getAIContextByAccountId(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(aiContext)
    .where(eq(aiContext.accountId, accountId))
    .orderBy(desc(aiContext.createdAt));
}

// ===== DOCUMENT OPERATIONS =====
export async function createDocument(doc: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(documents).values(doc);
  return result;
}

export async function getDocumentsByAccountId(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(documents)
    .where(eq(documents.accountId, accountId))
    .orderBy(desc(documents.createdAt));
}

export async function getDocumentsByCallId(callId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(documents)
    .where(eq(documents.callId, callId))
    .orderBy(desc(documents.createdAt));
}
