import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, accounts, InsertAccount, contacts, /* people, InsertPerson, clayRequests, InsertClayRequest, gongCalls, InsertGongCall */ calls } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
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

export async function getAllAccounts() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get accounts: database not available");
    return [];
  }

  return await db.select().from(accounts).orderBy(desc(accounts.createdAt));
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

  return await db.select().from(contacts).orderBy(desc(contacts.createdAt));
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

  return await db.select().from(contacts).where(eq(contacts.accountId, accountId));
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

export async function getGongCallsByCompany(companyName: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return [];
  }

  return await db.select().from(calls).where(eq(calls.company, companyName)).orderBy(desc(calls.callDate));
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

  return await db.select().from(calls).where(eq(calls.personId, personId)).orderBy(desc(calls.callDate));
}
