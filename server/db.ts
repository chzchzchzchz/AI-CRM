import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, accounts, InsertAccount, contacts, /* people, InsertPerson, clayRequests, InsertClayRequest, gongCalls, InsertGongCall */ calls } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

// Get raw mysql2 pool for direct queries
export async function getPool(): Promise<mysql.Pool | null> {
  if (!_pool && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      _pool = mysql.createPool({
        host: url.hostname,
        port: parseInt(url.port || '3306'),
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10,
      });
    } catch (error) {
      console.warn("[Database] Failed to create pool:", error);
      _pool = null;
    }
  }
  return _pool;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = await getPool();
      if (pool) {
        _db = drizzle(pool);
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

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

// Account queries
export async function upsertAccount(account: InsertAccount) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert account: database not available");
    return;
  }

  try {
    await db.insert(accounts).values(account).onDuplicateKeyUpdate({
      set: account,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert account:", error);
    throw error;
  }
}

export async function getAllAccounts(isDemoUser: boolean = false) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get accounts: database not available");
    return [];
  }

  const allAccounts = await db.select().from(accounts).orderBy(desc(accounts.createdAt));
  
  // If demo user, only show demo accounts (those with name starting with "Demo_")
  if (isDemoUser) {
    return allAccounts.filter(a => a.name?.startsWith('Demo_'));
  }
  
  // For regular users, exclude demo accounts
  return allAccounts.filter(a => !a.name?.startsWith('Demo_'));
}

export async function getAccountById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get account: database not available");
    return undefined;
  }

  const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAccount(id: number, updates: Partial<InsertAccount>) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update account: database not available");
    return;
  }

  try {
    await db.update(accounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(accounts.id, id));
  } catch (error) {
    console.error("[Database] Failed to update account:", error);
    throw error;
  }
}

// Contacts queries (renamed from people)
export async function upsertPerson(person: any) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert person: database not available");
    return;
  }

  try {
    await db.insert(contacts).values(person).onDuplicateKeyUpdate({
      set: person,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert person:", error);
    throw error;
  }
}

export async function getAllPeople() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get people: database not available");
    return [];
  }

  // Join with accounts to get company information AND account-level engagement data
  const results = await db
    .select({
      id: contacts.id,
      accountId: contacts.accountId,
      clayRecordId: contacts.clayRecordId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      name: contacts.name,
      title: contacts.title,
      email: contacts.email,
      phone: contacts.phone,
      linkedinUrl: contacts.linkedinUrl,
      location: contacts.location,
      department: contacts.department,
      sfdcContactId: contacts.sfdcContactId,
      mobilePhone: contacts.mobilePhone,
      directPhone: contacts.directPhone,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
      // Account data
      company: accounts.name,
      companyDomain: accounts.domain,
      accountIntentScore: accounts.intentScore,
      accountIndustry: accounts.industry,
      accountRegion: accounts.region,
      accountEmployeeCount: accounts.employeeCount,
      accountTechStack: accounts.techStack,
      accountSecurityStack: accounts.securityStack,
      accountSfdcAccountId: accounts.sfdcAccountId,
    })
    .from(contacts)
    .leftJoin(accounts, eq(contacts.accountId, accounts.id))
    .orderBy(desc(contacts.createdAt));
  
  return results;
}

// Paginated version for performance
export async function getPeoplePaginated(limit: number = 100, offset: number = 0) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get people: database not available");
    return { people: [], total: 0 };
  }

  const [peopleResult, countResult] = await Promise.all([
    db
      .select({
        id: contacts.id,
        accountId: contacts.accountId,
        name: contacts.name,
        title: contacts.title,
        email: contacts.email,
        phone: contacts.phone,
        linkedinUrl: contacts.linkedinUrl,
        location: contacts.location,
        company: accounts.name,
        accountIntentScore: accounts.intentScore,
      })
      .from(contacts)
      .leftJoin(accounts, eq(contacts.accountId, accounts.id))
      .orderBy(desc(contacts.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(contacts)
  ]);

  return { 
    people: peopleResult, 
    total: countResult[0]?.count || 0 
  };
}

export async function getPeopleByCompany(companyName: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get people: database not available");
    return [];
  }

  // Company column doesn't exist - this function is deprecated
  // Use getContactsByAccountId instead
  return [];
}

export async function getContactsByAccountId(accountId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get contacts: database not available");
    return [];
  }

  // Join with accounts to get company information
  const results = await db
    .select({
      id: contacts.id,
      accountId: contacts.accountId,
      clayRecordId: contacts.clayRecordId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      name: contacts.name,
      title: contacts.title,
      email: contacts.email,
      phone: contacts.phone,
      linkedinUrl: contacts.linkedinUrl,
      location: contacts.location,
      department: contacts.department,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
      company: accounts.name,
      companyDomain: accounts.domain,
    })
    .from(contacts)
    .leftJoin(accounts, eq(contacts.accountId, accounts.id))
    .where(eq(contacts.accountId, accountId));
  
  return results;
}

// Clay request queries - COMMENTED OUT (clayRequests table not in schema)
// export async function createClayRequest(requestId: string, searchQuery: string) {
//   const db = await getDb();
//   if (!db) {
//     console.warn("[Database] Cannot create Clay request: database not available");
//     return;
//   }
// 
//   await db.insert(clayRequests).values({
//     requestId,
//     searchQuery,
//     status: "pending",
//   });
// }
// 
// export async function updateClayRequest(requestId: string, status: "completed" | "timeout" | "error", responseData?: any) {
//   const db = await getDb();
//   if (!db) {
//     console.warn("[Database] Cannot update Clay request: database not available");
//     return;
//   }
// 
//   const updateData: any = { status, updatedAt: new Date() };
//   if (responseData !== undefined) {
//     updateData.responseData = JSON.stringify(responseData);
//   }
// 
//   await db.update(clayRequests)
//     .set(updateData)
//     .where(eq(clayRequests.requestId, requestId));
// }
// 
// export async function getClayRequest(requestId: string) {
//   const db = await getDb();
//   if (!db) {
//     console.warn("[Database] Cannot get Clay request: database not available");
//     return undefined;
//   }
// 
//   const result = await db.select().from(clayRequests).where(eq(clayRequests.requestId, requestId)).limit(1);
//   return result.length > 0 ? result[0] : undefined;
// }
// 
// export async function getAllClayRequests() {
//   const db = await getDb();
//   if (!db) {
//     console.warn("[Database] Cannot get Clay requests: database not available");
//     return [];
//   }
// 
//   return await db.select().from(clayRequests).orderBy(desc(clayRequests.createdAt));
// }

// Calls queries (renamed from gongCalls)
export async function getAllGongCalls() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return [];
  }

  return await db.select().from(calls).orderBy(desc(calls.callDate));
}

// Paginated version for performance
export async function getGongCallsPaginated(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return { calls: [], total: 0 };
  }

  const [callsResult, countResult] = await Promise.all([
    db.select().from(calls).orderBy(desc(calls.callDate)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(calls)
  ]);

  return { 
    calls: callsResult, 
    total: countResult[0]?.count || 0 
  };
}

export async function getGongCallsByCompany(companyName: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return [];
  }

  // Company column doesn't exist - this function is deprecated
  // Use getGongCallsByAccountId instead
  return [];
}

export async function getGongCallsByAccountId(accountId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return [];
  }

  return await db.select().from(calls).where(eq(calls.accountId, accountId)).orderBy(desc(calls.callDate));
}

export async function getGongCallsByPersonId(personId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return [];
  }

  // personId column is now contactId
  return await db.select().from(calls).where(eq(calls.contactId, personId)).orderBy(desc(calls.callDate));
}
