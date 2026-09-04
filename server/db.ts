import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, accounts, InsertAccount, contacts, /* people, InsertPerson, clayRequests, InsertClayRequest, gongCalls, InsertGongCall */ calls, opportunities, Opportunity, InsertOpportunity } from "../drizzle/schema";
import { ENV } from './_core/env';

import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _pool: mysql.Pool | null = null;

// Overridable so tests (and anyone running several instances) get their own store instead
// of mutating the demo dataset the product ships with.
const DEMO_DB_PATH = process.env.DEMO_DB_PATH
  ? path.resolve(process.env.DEMO_DB_PATH)
  : path.join(process.cwd(), 'demo-db.json');
// Pristine, version-controlled seed. Copied to DEMO_DB_PATH on first boot so a fresh
// clone gets the full demo dataset (16 accounts, 40 contacts, etc.) while the working
// demo-db.json stays gitignored and mutable at runtime.
const DEMO_SEED_PATH = path.join(process.cwd(), 'demo-db.seed.json');

// Helper to get table name from Drizzle table object
function getTableName(table: any): string {
  if (!table) return '';
  if (typeof table === 'string') return table;
  const name = table._?.name || table.name;
  if (name && typeof name === 'string') return name;

  // Search all symbols on the object (for local Symbol keys)
  const symbols = Object.getOwnPropertySymbols(table);
  for (const sym of symbols) {
    const desc = sym.description;
    if (desc === 'drizzle:Name' || desc === 'drizzle:OriginalName') {
      const val = table[sym];
      if (val && typeof val === 'string') {
        return val;
      }
    }
  }
  return '';
}

// Initial demo dataset
function getInitialDemoData() {
  return {
    users: [
      {
        id: 1,
        openId: "demo-user",
        name: "Demo User",
        email: "demo@sovereign-gtm.ai",
        role: "admin",
        isApproved: true,
        loginMethod: "demo",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSignedIn: new Date().toISOString()
      }
    ],
    access_requests: [],
    accounts: [
      {
        id: 1,
        name: "Stark Industries",
        domain: "starkindustries.com",
        industry: "Defense & Technology",
        employeeCount: 15000,
        revenue: "$10B+",
        location: "New York, NY",
        region: "North America",
        intentScore: 95,
        relationship: "Prospect",
        description: "Advanced technology, robotics, and defense solutions provider.",
        website: "https://starkindustries.com",
        linkedinUrl: "https://linkedin.com/company/stark-industries",
        techStack: JSON.stringify(["Salesforce", "AWS", "Snowflake", "Jira"]),
        securityStack: JSON.stringify(["Okta", "Duo", "CrowdStrike", "Splunk"]),
        triggerEvents: JSON.stringify(["CISO transition", "Cloud migration"]),
        sixsenseBuyingStage: "Purchase",
        sixsenseProfileFit: "Strong",
        sfdcAccountId: "acc_stark_001",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 2,
        name: "Wayne Enterprises",
        domain: "wayneenterprises.com",
        industry: "Conglomerate & Aerospace",
        employeeCount: 22000,
        revenue: "$15B+",
        location: "Gotham City, NJ",
        region: "North America",
        intentScore: 88,
        relationship: "Customer",
        description: "Diversified multinational conglomerate with defense, shipping, and tech divisions.",
        website: "https://wayneenterprises.com",
        linkedinUrl: "https://linkedin.com/company/wayne-enterprises",
        techStack: JSON.stringify(["Salesforce", "ServiceNow", "Datadog"]),
        securityStack: JSON.stringify(["Ping Identity", "Microsoft Entra ID", "SentinelOne"]),
        triggerEvents: JSON.stringify(["Infrastructure upgrade"]),
        sixsenseBuyingStage: "Decision",
        sixsenseProfileFit: "Strong",
        sfdcAccountId: "acc_wayne_002",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 3,
        name: "Acme Corp",
        domain: "acme.com",
        industry: "Manufacturing & Retail",
        employeeCount: 3000,
        revenue: "$500M",
        location: "Chicago, IL",
        region: "North America",
        intentScore: 45,
        relationship: "Prospect",
        description: "Leading manufacturer of diverse tools, gadgets, and roadrunner traps.",
        website: "https://acme.com",
        linkedinUrl: "https://linkedin.com/company/acme",
        techStack: JSON.stringify(["HubSpot", "Google Workspace"]),
        securityStack: JSON.stringify(["Auth0", "Duo"]),
        triggerEvents: JSON.stringify(["Compliance audit"]),
        sixsenseBuyingStage: "Awareness",
        sixsenseProfileFit: "Medium",
        sfdcAccountId: "acc_acme_003",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    contacts: [
      {
        id: 1,
        accountId: 1,
        firstName: "Pepper",
        lastName: "Potts",
        name: "Pepper Potts",
        title: "CEO",
        email: "pepper@starkindustries.com",
        phone: "555-0199",
        linkedinUrl: "https://linkedin.com/in/pepper-potts",
        location: "New York, NY",
        department: "Executive",
        sfdcContactId: "con_pepper_001",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 2,
        accountId: 1,
        firstName: "Happy",
        lastName: "Hogan",
        name: "Happy Hogan",
        title: "Head of Security",
        email: "happy@starkindustries.com",
        phone: "555-0122",
        linkedinUrl: "https://linkedin.com/in/happy-hogan",
        location: "New York, NY",
        department: "Security",
        sfdcContactId: "con_happy_002",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 3,
        accountId: 2,
        firstName: "Lucius",
        lastName: "Fox",
        name: "Lucius Fox",
        title: "CEO & President",
        email: "lfox@wayneenterprises.com",
        phone: "555-0244",
        linkedinUrl: "https://linkedin.com/in/lucius-fox",
        location: "Gotham City, NJ",
        department: "Executive",
        sfdcContactId: "con_lucius_003",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    calls: [
      {
        id: 1,
        accountId: 1,
        contactId: 2,
        title: "Stark Industries Intro & MFA Pain Points Discussion",
        duration: 1800,
        recordingUrl: "https://gong.io/calls/stark-intro",
        transcriptUrl: "https://gong.io/transcripts/stark-intro",
        gongCallId: "call_stark_001",
        sentiment: "positive",
        keyTopics: JSON.stringify(["MFA bypass", "Okta complexity", "compliance"]),
        actionItems: JSON.stringify(["Send proposal", "Book follow-up demo"]),
        callDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    opportunities: [
      {
        id: 1,
        accountId: 1,
        name: "Stark Industries - Global Enterprise Upgrade",
        amount: "500000.00",
        stage: "Discovery",
        probability: 20,
        status: "Open",
        expectedCloseDate: new Date("2026-09-30").toISOString(),
        sfdcOpportunityId: "opp_stark_001",
        aiSuccessScore: 78,
        aiInsights: "Highly active buying signs. Security champion wants to move away from legacy MFA.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 2,
        accountId: 2,
        name: "Wayne Enterprises - Expansion Opportunity",
        amount: "250000.00",
        stage: "Validation",
        probability: 60,
        status: "Open",
        expectedCloseDate: new Date("2026-07-15").toISOString(),
        sfdcOpportunityId: "opp_wayne_002",
        aiSuccessScore: 85,
        aiInsights: "Lucius Fox is supportive. Procurement process is ready.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    contextStore: []
  };
}

// Read/write from JSON database
function loadDemoDb(): any {
  if (!fs.existsSync(DEMO_DB_PATH)) {
    // Prefer the version-controlled seed; fall back to the minimal built-in dataset.
    let initial: any;
    if (fs.existsSync(DEMO_SEED_PATH)) {
      try {
        initial = JSON.parse(fs.readFileSync(DEMO_SEED_PATH, 'utf-8'));
      } catch (e) {
        console.error("[Database] Error reading demo-db.seed.json, using built-in seed", e);
        initial = getInitialDemoData();
      }
    } else {
      initial = getInitialDemoData();
    }
    fs.writeFileSync(DEMO_DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    // mtime-validated in-memory cache: a dashboard page fires many batched queries, and
    // re-reading + re-parsing the whole JSON store for each one dominated request time.
    // The mtime check keeps the cache correct when another process (tests, scripts)
    // rewrites the file.
    const mtime = fs.statSync(DEMO_DB_PATH).mtimeMs;
    if (demoDbCache && demoDbCacheMtime === mtime && demoDbCachePath === DEMO_DB_PATH) {
      return demoDbCache;
    }
    const data = JSON.parse(fs.readFileSync(DEMO_DB_PATH, 'utf-8'));
    demoDbCache = data;
    demoDbCacheMtime = mtime;
    demoDbCachePath = DEMO_DB_PATH;
    return data;
  } catch (e) {
    console.error("[Database] Error reading demo-db.json", e);
    return getInitialDemoData();
  }
}

let demoDbCache: any = null;
let demoDbCacheMtime = 0;
let demoDbCachePath = "";

function saveDemoDb(data: any): void {
  try {
    fs.writeFileSync(DEMO_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    // Keep the read cache coherent with what we just wrote.
    demoDbCache = data;
    demoDbCacheMtime = fs.statSync(DEMO_DB_PATH).mtimeMs;
    demoDbCachePath = DEMO_DB_PATH;
  } catch (e) {
    console.error("[Database] Error saving demo-db.json", e);
  }
}

// Query builder for local JSON DB
/**
 * Merge an upsert into an existing demo row.
 *
 * Only the fields the caller actually passed, plus whatever the ON DUPLICATE KEY
 * UPDATE set named. Never the schema-padded record.
 *
 * The insert path fills every column the caller omitted with `null` before writing,
 * which is right for a genuinely new row and catastrophic for an existing one. Spread
 * over a match it nulled everything unmentioned — and the one upsert that runs on
 * every authenticated request passes only { openId, lastSignedIn }.
 *
 * So the seeded demo user lost its email, password hash, role and approval on the
 * first request after signing in, and the credentials in the README stopped working
 * before anyone had finished looking at the dashboard. `id` is held fixed so a merge
 * can never renumber a row other things point at.
 */
function mergeExisting(existing: any, passed: any, duplicateUpdate: any): any {
  const merged: any = { ...existing };
  for (const [k, v] of Object.entries(passed || {})) {
    if (v === undefined || k === "id") continue;
    merged[k] = v instanceof Date ? v.toISOString() : v;
  }
  for (const [k, v] of Object.entries(duplicateUpdate || {})) {
    if (v === undefined || k === "id") continue;
    merged[k] = v instanceof Date ? v.toISOString() : v;
  }
  merged.updatedAt = new Date().toISOString();
  return merged;
}

class MockDrizzleQueryBuilder {
  private operation: 'select' | 'insert' | 'update' | 'delete';
  private tableName: string = '';
  private tableSchema: any = null;
  private filters: Array<{ field: string; value: any; op?: string; values?: any[] }> = [];
  private limitCount: number = 0;
  private offsetCount: number = 0;
  private insertValues: any = null;
  private duplicateUpdate: any = null;
  private updateValues: any = null;
  private orderByField: string = '';
  private orderDirection: 'asc' | 'desc' = 'asc';
  public selectFields: any = null;

  constructor(operation: 'select' | 'insert' | 'update' | 'delete') {
    this.operation = operation;
  }

  from(table: any) {
    this.tableName = getTableName(table);
    this.tableSchema = table;
    return this;
  }

  where(condition: any) {
    this.parseCondition(condition);
    return this;
  }

  private parseCondition(condition: any) {
    if (!condition) return;

    if (condition.queryChunks && Array.isArray(condition.queryChunks)) {
      // Check for nested SQL / logical compound conditions
      const sqlChunks = condition.queryChunks.filter((chunk: any) => chunk && chunk.queryChunks);
      if (sqlChunks.length > 0) {
        for (const subCond of sqlChunks) {
          this.parseCondition(subCond);
        }
        return;
      }

      // Simple binary operator condition
      const column = condition.queryChunks.find((chunk: any) => chunk && chunk.table && chunk.name);
      // A scalar param is a Param object (has `.value`) that is NOT itself an array and is
      // NOT a StringChunk (whose `.value` is an array like [""] / [" in "]).
      const scalarParam = condition.queryChunks.find(
        (chunk: any) => chunk && !Array.isArray(chunk) && 'value' in chunk && !Array.isArray(chunk.value)
      );
      // inArray(col, [...]) renders as: col, " in ", [Param, Param, ...]. The values live in a
      // nested Array of Param objects. Support it so multi-id fetches (e.g.
      // outreach.generateEmail) work in demo mode instead of silently matching nothing.
      const inValues = condition.queryChunks.find((chunk: any) => Array.isArray(chunk));

      if (column) {
        const field = column.name;
        if (inValues) {
          this.filters.push({
            field,
            value: null,
            op: 'in',
            values: inValues.map((p: any) => (p && typeof p === 'object' && 'value' in p ? p.value : p)),
          });
        } else if (scalarParam) {
          this.filters.push({ field, value: scalarParam.value });
        } else {
          // No literal value chunk — either an isNotNull()/isNull() condition (a text
          // chunk carries "is not null" / "is null", no Param) or a column-to-column
          // comparison this mock cannot evaluate (eq(col, col) — observed live as a
          // copy-paste self-compare meant to mean "has a value", which instead matched
          // every row with a value and none without, since both sides read identically).
          // This used to fall through to `value: null` unconditionally, which reads as
          // "field equals the literal string 'null'" — excluding every real row on an
          // IS NOT NULL check, the opposite of the intended filter.
          const text = condition.queryChunks
            .filter((c: any) => c && Array.isArray(c.value))
            .map((c: any) => c.value.join(''))
            .join(' ')
            .toLowerCase();
          if (text.includes('is not null')) {
            this.filters.push({ field, value: null, op: 'is_not_null' });
          } else if (text.includes('is null')) {
            this.filters.push({ field, value: null, op: 'is_null' });
          }
          else if (field === 'orgId') {
            // The one filter where "too many rows" is not the safe direction.
            //
            // Everywhere else in this mock, a condition it cannot evaluate is dropped:
            // returning extra rows surfaces as a wrong count, which someone notices,
            // rather than a confidently empty result, which reads as "no data". An org
            // filter inverts that. Dropping it returns EVERY tenant's rows to whichever
            // tenant asked — a silent cross-customer read that looks exactly like a
            // correct answer. Fail closed instead, and loudly: a demo-mode query whose
            // org filter could not be parsed must match nothing.
            console.error(
              '[MockDrizzle] could not evaluate an orgId filter; matching no rows rather ' +
                'than returning every org\'s data. This is a bug in the mock, not in the caller.'
            );
            this.filters.push({ field, value: '__unevaluable_org_filter__' });
          }
          // Otherwise: a comparison the mock cannot evaluate. Adding no filter returns
          // too many rows rather than too few — the safer failure direction for a
          // count/status query, and it surfaces as a wrong number instead of a
          // confidently wrong empty result.
        }
      }
    } else {
      const sqlStr = String(condition);
      if (sqlStr.includes('IS NOT NULL')) {
        const match = sqlStr.match(/"([^"]+)"\."([^"]+)"\s+IS\s+NOT\s+NULL/i) || sqlStr.match(/`([^`]+)`\.`([^`]+)`\s+IS\s+NOT\s+NULL/i);
        if (match) {
          this.filters.push({ field: match[2], value: null, op: 'is_not_null' });
        } else if (sqlStr.includes('accountId')) {
          this.filters.push({ field: 'accountId', value: null, op: 'is_not_null' });
        }
      }
    }
  }

  set(values: any) {
    this.updateValues = values;
    return this;
  }

  values(values: any) {
    this.insertValues = values;
    return this;
  }

  /**
   * Remember the ON DUPLICATE KEY UPDATE set.
   *
   * This used to discard it and return `this`, which is why a sparse upsert wiped
   * a row: the insert path below merged the schema-padded record — every column the
   * caller never mentioned, filled with null — over the existing one.
   */
  onDuplicateKeyUpdate(options: any) {
    this.duplicateUpdate = options?.set ?? null;
    return this;
  }

  orderBy(orderExpr: any) {
    if (orderExpr) {
      this.orderByField = orderExpr.name || orderExpr.fieldName || '';
      this.orderDirection = orderExpr.direction || 'asc';
    }
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  offset(count: number) {
    this.offsetCount = count;
    return this;
  }

  leftJoin(table: any, condition: any) {
    return this;
  }

  async execute() {
    const dbData = loadDemoDb();
    if (!dbData[this.tableName]) {
      dbData[this.tableName] = [];
    }
    const tableData = dbData[this.tableName];

    if (this.operation === 'select') {
      // A row written before the orgId column existed belongs to the default org —
      // the same thing MySQL's `DEFAULT 1` does for existing rows when the column is
      // added. Applied before filtering, because a filter comparing String(undefined)
      // against "1" matches nothing: the demo dataset would go blank the moment the
      // first query started scoping, and "no accounts" reads as an empty book rather
      // than a bug.
      const hasOrgColumn = Boolean(this.tableSchema?.orgId);
      let results: any[] = hasOrgColumn
        ? tableData.map((r: any) => (r.orgId === undefined || r.orgId === null ? { ...r, orgId: 1 } : r))
        : [...tableData];

      // Apply filters
      for (const filter of this.filters) {
        if (filter.op === 'is_not_null') {
          results = results.filter((item: any) => item[filter.field] !== null && item[filter.field] !== undefined);
        } else if (filter.op === 'is_null') {
          results = results.filter((item: any) => item[filter.field] === null || item[filter.field] === undefined);
        } else if (filter.op === 'in') {
          const set = new Set((filter.values || []).map((v: any) => String(v)));
          results = results.filter((item: any) => set.has(String(item[filter.field])));
        } else if (filter.value !== undefined) {
          results = results.filter((item: any) => String(item[filter.field]) === String(filter.value));
        }
      }

      // Handle sorting
      if (this.orderByField) {
        results.sort((a, b) => {
          const valA = a[this.orderByField];
          const valB = b[this.orderByField];
          if (valA < valB) return this.orderDirection === 'asc' ? -1 : 1;
          if (valA > valB) return this.orderDirection === 'asc' ? 1 : -1;
          return 0;
        });
      }

      // Handle pagination
      if (this.offsetCount > 0) {
        results = results.slice(this.offsetCount);
      }
      if (this.limitCount > 0) {
        results = results.slice(0, this.limitCount);
      }

      // Parse fields back (e.g. string to Date)
      if (this.tableSchema) {
        results = results.map((item: any) => {
          const newItem = { ...item };
          for (const key of Object.keys(this.tableSchema)) {
            const col = this.tableSchema[key];
            if (col && col.dataType === 'date' && typeof newItem[key] === 'string') {
              newItem[key] = new Date(newItem[key]);
            }
          }
          return newItem;
        });
      }

      // Handle leftJoin decoration for contacts
      if (this.tableName === 'contacts') {
        const accountsData = dbData['accounts'] || [];
        results = results.map(contact => {
          const acc = accountsData.find((a: any) => a.id === contact.accountId);
          if (acc) {
            return {
              ...contact,
              company: acc.name,
              companyDomain: acc.domain,
              accountIntentScore: acc.intentScore,
              accountIndustry: acc.industry,
              accountRegion: acc.region,
              accountEmployeeCount: acc.employeeCount,
              accountTechStack: acc.techStack,
              accountSecurityStack: acc.securityStack,
              accountSfdcAccountId: acc.sfdcAccountId,
              accountBuyingStage: acc.sixsenseBuyingStage,
            };
          }
          return contact;
        });
      }

      // Handle count query projection
      if (this.selectFields && typeof this.selectFields === 'object' && 'count' in this.selectFields) {
        return [{ count: results.length }];
      }

      return results;
    }

    if (this.operation === 'insert') {
      const records = Array.isArray(this.insertValues) ? this.insertValues : [this.insertValues];
      const inserted: any[] = [];

      for (const record of records) {
        const nextId = tableData.length > 0 ? Math.max(...tableData.map((r: any) => r.id || 0)) + 1 : 1;
        const newRecord: any = {
          id: nextId,
          ...record
        };

        if (this.tableSchema) {
          for (const key of Object.keys(this.tableSchema)) {
            const col = this.tableSchema[key];
            if (!col) continue;

            if (newRecord[key] === undefined) {
              if (col.hasDefault) {
                if (col.default !== undefined && !(typeof col.default === 'object' && col.default !== null && 'queryChunks' in col.default)) {
                  newRecord[key] = col.default;
                } else if (col.dataType === 'date') {
                  newRecord[key] = new Date().toISOString();
                }
              } else {
                newRecord[key] = null;
              }
            } else if (newRecord[key] instanceof Date) {
              newRecord[key] = newRecord[key].toISOString();
            }
          }
        }

        if (newRecord.createdAt === undefined) {
          newRecord.createdAt = new Date().toISOString();
        }
        if (newRecord.updatedAt === undefined) {
          newRecord.updatedAt = new Date().toISOString();
        }

        // Enforce unique constraints dynamically for demo
        if (this.tableName === 'users' && record.openId) {
          const idx = tableData.findIndex((r: any) => r.openId === record.openId);
          if (idx !== -1) {
            tableData[idx] = mergeExisting(tableData[idx], record, this.duplicateUpdate);
            inserted.push(tableData[idx]);
            continue;
          }
        }

        if (this.tableName === 'accounts' && record.sfdcAccountId) {
          const idx = tableData.findIndex((r: any) => r.sfdcAccountId === record.sfdcAccountId);
          if (idx !== -1) {
            tableData[idx] = mergeExisting(tableData[idx], record, this.duplicateUpdate);
            inserted.push(tableData[idx]);
            continue;
          }
        }

        if (this.tableName === 'contacts' && record.sfdcContactId) {
          const idx = tableData.findIndex((r: any) => r.sfdcContactId === record.sfdcContactId);
          if (idx !== -1) {
            tableData[idx] = mergeExisting(tableData[idx], record, this.duplicateUpdate);
            inserted.push(tableData[idx]);
            continue;
          }
        }

        // Upsert-by-primary-key for tables whose upsert passes an existing id
        // (e.g. opportunities). Without this the insert appends a duplicate row
        // sharing the same id instead of updating in place.
        if (this.tableName === 'opportunities' && record.id != null) {
          const idx = tableData.findIndex((r: any) => r.id === record.id);
          if (idx !== -1) {
            tableData[idx] = mergeExisting(tableData[idx], record, this.duplicateUpdate);
            inserted.push(tableData[idx]);
            continue;
          }
        }

        tableData.push(newRecord);
        inserted.push(newRecord);
      }

      saveDemoDb(dbData);
      const insertedHeaders = inserted.map(newRec => {
        const header: any = {
          insertId: newRec.id,
          affectedRows: 1,
          ...newRec
        };
        return header;
      });
      return insertedHeaders;
    }

    if (this.operation === 'update') {
      let updatedCount = 0;
      const serializedUpdates = { ...this.updateValues };
      if (this.tableSchema) {
        for (const key of Object.keys(serializedUpdates)) {
          if (serializedUpdates[key] instanceof Date) {
            serializedUpdates[key] = serializedUpdates[key].toISOString();
          }
        }
      }

      for (let i = 0; i < tableData.length; i++) {
        const item = tableData[i];
        let matches = true;
        for (const filter of this.filters) {
          if (filter.op === 'is_not_null') {
            if (item[filter.field] === null || item[filter.field] === undefined) {
              matches = false;
              break;
            }
          } else if (filter.value !== undefined) {
            if (String(item[filter.field]) !== String(filter.value)) {
              matches = false;
              break;
            }
          }
        }
        if (matches) {
          tableData[i] = {
            ...item,
            ...serializedUpdates,
            updatedAt: new Date().toISOString()
          };
          updatedCount++;
        }
      }
      if (updatedCount > 0) {
        saveDemoDb(dbData);
      }
      return { affectedRows: updatedCount };
    }

    if (this.operation === 'delete') {
      const originalLength = tableData.length;
      const newTableData = tableData.filter((item: any) => {
        let matches = true;
        for (const filter of this.filters) {
          if (filter.op === 'is_not_null') {
            if (item[filter.field] === null || item[filter.field] === undefined) {
              matches = false;
              break;
            }
          } else if (filter.value !== undefined) {
            if (String(item[filter.field]) !== String(filter.value)) {
              matches = false;
              break;
            }
          }
        }
        return !matches;
      });
      const deletedCount = originalLength - newTableData.length;
      if (deletedCount > 0) {
        dbData[this.tableName] = newTableData;
        saveDemoDb(dbData);
      }
      return { affectedRows: deletedCount };
    }

    return [];
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}

class MockDrizzle {
  select(fields?: any) {
    const builder = new MockDrizzleQueryBuilder('select');
    builder.selectFields = fields;
    return builder;
  }
  insert(table: any) {
    const builder = new MockDrizzleQueryBuilder('insert');
    builder.from(table);
    return builder;
  }
  update(table: any) {
    const builder = new MockDrizzleQueryBuilder('update');
    builder.from(table);
    return builder;
  }
  delete(table: any) {
    const builder = new MockDrizzleQueryBuilder('delete');
    builder.from(table);
    return builder;
  }
}

// Get raw mysql2 pool for direct queries
export async function getPool(): Promise<mysql.Pool | null> {
  if (process.env.DEMO_MODE === "true") {
    return null;
  }
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
  if (process.env.DEMO_MODE === "true") {
    if (!_db) {
      _db = new MockDrizzle() as any;
    }
    return _db;
  }

  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = await getPool();
      if (pool) {
        _db = drizzle(pool) as any;
      }
    } catch (error) {
      console.warn("[Database] Failed to connect, falling back to local JSON database:", error);
      _db = new MockDrizzle() as any;
    }
  } else if (!_db) {
    console.warn("[Database] No DATABASE_URL found, falling back to local JSON database");
    _db = new MockDrizzle() as any;
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
export async function upsertAccount(orgId: number, account: InsertAccount) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert account: database not available");
    return;
  }

  try {
    const owned = { ...account, orgId };
    await db.insert(accounts).values(owned).onDuplicateKeyUpdate({
      set: owned,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert account:", error);
    throw error;
  }
}

export async function getAllAccounts(orgId: number, isDemoUser: boolean = false) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get accounts: database not available");
    return [];
  }

  const allAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.orgId, orgId))
    .orderBy(desc(accounts.createdAt));

  // If demo user, only show demo accounts (those with name starting with "Demo_")
  if (isDemoUser && allAccounts.some((a: any) => a.name?.startsWith('Demo_'))) {
    return allAccounts.filter((a: any) => a.name?.startsWith('Demo_'));
  }
  
  // For regular users, exclude demo accounts
  return allAccounts.filter((a: any) => !a.name?.startsWith('Demo_'));
}

export async function getAccountById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get account: database not available");
    return undefined;
  }

  // The org half is not decoration: an account id is a small integer a caller can
  // simply guess, so without it "give me account 42" reaches whichever tenant owns 42.
  const result = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.id, id)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAccount(orgId: number, id: number, updates: Partial<InsertAccount>) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update account: database not available");
    return;
  }

  try {
    // orgId is deliberately not settable through `updates` — moving a row between
    // tenants is not an edit, and the caller's own org is the only one it may write to.
    const { orgId: _ignored, ...safe } = updates as Partial<InsertAccount> & { orgId?: number };
    await db.update(accounts)
      .set({ ...safe, updatedAt: new Date() })
      .where(and(eq(accounts.orgId, orgId), eq(accounts.id, id)));
  } catch (error) {
    console.error("[Database] Failed to update account:", error);
    throw error;
  }
}

// Contacts queries (renamed from people)
export async function upsertPerson(orgId: number, person: any) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert person: database not available");
    return;
  }

  try {
    const owned = { ...person, orgId };
    await db.insert(contacts).values(owned).onDuplicateKeyUpdate({
      set: owned,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert person:", error);
    throw error;
  }
}

export async function getAllPeople(orgId: number) {
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
    .where(eq(contacts.orgId, orgId))
    .orderBy(desc(contacts.createdAt));

  return results;
}

// Paginated version for performance
export async function getPeoplePaginated(orgId: number, limit: number = 100, offset: number = 0) {
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
      .where(eq(contacts.orgId, orgId))
      .orderBy(desc(contacts.createdAt))
      .limit(limit)
      .offset(offset),
    // The count is scoped too. A page of this org's contacts under another org's total
    // is a pager that promises pages which come back empty — and quietly discloses how
    // many contacts the other tenant has.
    db.select({ count: sql<number>`count(*)` }).from(contacts).where(eq(contacts.orgId, orgId))
  ]);

  return { 
    people: peopleResult, 
    total: countResult[0]?.count || 0 
  };
}

export async function getPeopleByCompany(orgId: number, companyName: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get people: database not available");
    return [];
  }

  // Company column doesn't exist - this function is deprecated
  // Use getContactsByAccountId instead
  return [];
}

export async function getPersonById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get person: database not available");
    return null;
  }

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
      company: accounts.name,
      companyDomain: accounts.domain,
      accountIntentScore: accounts.intentScore,
      accountIndustry: accounts.industry,
      accountBuyingStage: accounts.sixsenseBuyingStage,
    })
    .from(contacts)
    .leftJoin(accounts, eq(contacts.accountId, accounts.id))
    .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)))
    .limit(1);
  
  return results[0] || null;
}

export async function getContactsByAccountId(orgId: number, accountId: number) {
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
    .where(and(eq(contacts.orgId, orgId), eq(contacts.accountId, accountId)));
  
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
export async function getAllGongCalls(orgId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return [];
  }

  return await db.select().from(calls).where(eq(calls.orgId, orgId)).orderBy(desc(calls.callDate));
}

// Paginated version for performance
export async function getGongCallsPaginated(orgId: number, limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return { calls: [], total: 0 };
  }

  const [callsResult, countResult] = await Promise.all([
    db.select().from(calls).where(eq(calls.orgId, orgId)).orderBy(desc(calls.callDate)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(calls).where(eq(calls.orgId, orgId))
  ]);

  return { 
    calls: callsResult, 
    total: countResult[0]?.count || 0 
  };
}

export async function getGongCallsByCompany(orgId: number, companyName: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return [];
  }
  // Calls have no company column, so resolve the company name to its account(s) and return
  // their calls. Previously this returned [] unconditionally, so gong.getByCompany was dead.
  if (!companyName) return [];
  const matched = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.name, companyName)));
  const ids = (matched as any[]).map((a) => a.id);
  if (ids.length === 0) return [];
  const all: any[] = [];
  for (const id of ids) {
    all.push(...(await getGongCallsByAccountId(orgId, id)));
  }
  return all;
}

export async function getGongCallsByAccountId(orgId: number, accountId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return [];
  }

  return await db
    .select()
    .from(calls)
    .where(and(eq(calls.orgId, orgId), eq(calls.accountId, accountId)))
    .orderBy(desc(calls.callDate));
}

export async function getGongCallsByPersonId(orgId: number, personId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get calls: database not available");
    return [];
  }

  // personId column is now contactId
  return await db
    .select()
    .from(calls)
    .where(and(eq(calls.orgId, orgId), eq(calls.contactId, personId)))
    .orderBy(desc(calls.callDate));
}


// ============================================
// SALESFORCE SYNC FUNCTIONS
// ============================================

/**
 * Bulk upsert accounts from Salesforce
 * Uses sfdcAccountId as the unique key for matching
 */
export async function bulkUpsertAccountsFromSalesforce(orgId: number, accountsData: Array<{
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  region: string;
  website: string | null;
  sfdcAccountId: string;
  description: string | null;
  phone: string | null;
  type: string | null;
}>) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot bulk upsert accounts: database not available");
    return { inserted: 0, updated: 0, errors: 0 };
  }

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const account of accountsData) {
    try {
      // Check if account exists by sfdcAccountId
      // Matching on sfdcAccountId ALONE would find another tenant's row for the same
      // Salesforce account — two customers can legitimately both track it — and the
      // update below would then rewrite their data with this sync's values.
      const existing = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.sfdcAccountId, account.sfdcAccountId)))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db.update(accounts)
          .set({
            name: account.name,
            domain: account.domain,
            industry: account.industry,
            employeeCount: account.employeeCount,
            region: account.region,
            website: account.website,
            description: account.description,
            phone: account.phone,
            type: account.type,
            updatedAt: new Date(),
          })
          .where(and(eq(accounts.orgId, orgId), eq(accounts.sfdcAccountId, account.sfdcAccountId)));
        updated++;
      } else {
        // Insert new
        await db.insert(accounts).values({
          orgId,
          name: account.name,
          domain: account.domain,
          industry: account.industry,
          employeeCount: account.employeeCount,
          region: account.region,
          website: account.website,
          sfdcAccountId: account.sfdcAccountId,
          description: account.description,
          phone: account.phone,
          type: account.type,
        });
        inserted++;
      }
    } catch (error) {
      console.error(`[Database] Failed to upsert account ${account.name}:`, error);
      errors++;
    }
  }

  return { inserted, updated, errors };
}

/**
 * Bulk upsert contacts from Salesforce
 * Uses sfdcContactId as the unique key for matching
 * Links to accounts via sfdcAccountId
 */
export async function bulkUpsertContactsFromSalesforce(orgId: number, contactsData: Array<{
  name: string;
  email: string | null;
  title: string | null;
  phone: string | null;
  sfdcContactId: string;
  sfdcAccountId: string | null;
  linkedinUrl: string | null;
  location: string | null;
}>) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot bulk upsert contacts: database not available");
    return { inserted: 0, updated: 0, linked: 0, errors: 0 };
  }

  let inserted = 0;
  let updated = 0;
  let linked = 0;
  let errors = 0;

  // Build a map of sfdcAccountId -> accountId for linking
  const accountMap = new Map<string, number>();
  const allAccounts = await db
    .select({ id: accounts.id, sfdcAccountId: accounts.sfdcAccountId })
    .from(accounts)
    .where(eq(accounts.orgId, orgId));
  for (const acc of allAccounts) {
    if (acc.sfdcAccountId) {
      accountMap.set(acc.sfdcAccountId, acc.id);
    }
  }

  for (const contact of contactsData) {
    try {
      // Find the account ID from sfdcAccountId
      const accountId = contact.sfdcAccountId ? accountMap.get(contact.sfdcAccountId) : null;
      
      // Check if contact exists by sfdcContactId
      const existing = await db
        .select({ id: contacts.id, linkedinUrl: contacts.linkedinUrl })
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.sfdcContactId, contact.sfdcContactId)))
        .limit(1);

      if (existing.length > 0) {
        // Update existing. Salesforce's SOQL does not fetch LinkedIn, so contact.linkedinUrl
        // is always null here — writing it blindly would wipe a URL enriched from Clay or
        // entered by hand. Only overwrite when Salesforce actually supplies a value.
        await db.update(contacts)
          .set({
            name: contact.name,
            email: contact.email,
            title: contact.title,
            phone: contact.phone,
            linkedinUrl: contact.linkedinUrl ?? (existing[0] as any).linkedinUrl ?? null,
            location: contact.location,
            accountId: accountId || null,
            updatedAt: new Date(),
          })
          .where(and(eq(contacts.orgId, orgId), eq(contacts.sfdcContactId, contact.sfdcContactId)));
        updated++;
        if (accountId) linked++;
      } else {
        // Insert new
        await db.insert(contacts).values({
          orgId,
          name: contact.name,
          email: contact.email,
          title: contact.title,
          phone: contact.phone,
          sfdcContactId: contact.sfdcContactId,
          linkedinUrl: contact.linkedinUrl,
          location: contact.location,
          accountId: accountId || null,
        });
        inserted++;
        if (accountId) linked++;
      }
    } catch (error) {
      console.error(`[Database] Failed to upsert contact ${contact.name}:`, error);
      errors++;
    }
  }

  return { inserted, updated, linked, errors };
}

/**
 * Get sync status - counts of accounts and contacts
 */
export async function getSyncStatus(orgId: number) {
  const db = await getDb();
  if (!db) {
    return { accounts: 0, contacts: 0, linkedContacts: 0 };
  }

  const [accountCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts)
    .where(eq(accounts.orgId, orgId));
  const [contactCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(eq(contacts.orgId, orgId));
  const [linkedCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), sql`${contacts.accountId} IS NOT NULL`));

  return {
    accounts: accountCount?.count || 0,
    contacts: contactCount?.count || 0,
    linkedContacts: linkedCount?.count || 0,
  };
}

// ============================================
// OPPORTUNITIES FUNCTIONS
// ============================================

export async function getAllOpportunities(orgId: number) {
  const db = await getDb();
  if (!db) {
    if (process.env.DEMO_MODE === 'true') {
      return MOCK_DATA.opportunities;
    }
    return [];
  }
  return await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.orgId, orgId))
    .orderBy(desc(opportunities.createdAt));
}

export async function getOpportunityById(orgId: number, id: number) {
  const db = await getDb();
  if (!db) {
    if (process.env.DEMO_MODE === 'true') {
      return MOCK_DATA.opportunities.find(o => o.id === id);
    }
    return undefined;
  }
  const result = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.orgId, orgId), eq(opportunities.id, id)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOpportunitiesByAccountId(orgId: number, accountId: number) {
  const db = await getDb();
  if (!db) {
    if (process.env.DEMO_MODE === 'true') {
      return MOCK_DATA.opportunities.filter(o => o.accountId === accountId);
    }
    return [];
  }
  return await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.orgId, orgId), eq(opportunities.accountId, accountId)))
    .orderBy(desc(opportunities.createdAt));
}

export async function upsertOpportunity(orgId: number, opportunity: InsertOpportunity) {
  const db = await getDb();
  if (!db) return;

  const owned = { ...opportunity, orgId };
  await db.insert(opportunities).values(owned).onDuplicateKeyUpdate({
    set: owned,
  });
}

// Mock data for high-fidelity demo
const MOCK_DATA = {
  opportunities: [
    {
      id: 1,
      accountId: 1, // Tesla
      name: "Tesla - FSD Enterprise Expansion",
      amount: "500000.00",
      stage: "Validation",
      probability: 60,
      status: "Open",
      expectedCloseDate: new Date("2026-06-30"),
      aiSuccessScore: 85,
      aiInsights: "Strong alignment with Tesla's move towards localized compute. Champion is highly engaged.",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      accountId: 2, // Snowflake
      name: "Snowflake - Global Security Upsell",
      amount: "250000.00",
      stage: "Negotiation",
      probability: 80,
      status: "Open",
      expectedCloseDate: new Date("2026-05-15"),
      aiSuccessScore: 92,
      aiInsights: "Procurement has already approved the vendor. Technical validation passed with flying colors.",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]
};
