import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM, llmText, LLM_UNAVAILABLE_NOTE } from "./_core/llm";
import { wrapUntrusted } from "./_core/untrusted";
import { withRCP } from "./ai-system-prompt";
import { getCompanyConfig } from "./config";

// Target template fields for SFDC/HubSpot webinar import
const TARGET_FIELDS = [
  { name: "Recent Event", required: true, description: "Salesforce Campaign Name (e.g., 2025-09-14-EVT-PTN-GPS-Ravens-Opener-Baltimore-MD)" },
  { name: "Event/Webinar Campaign Member Status", required: true, description: "Status picklist: Attended (not MQL), Attended keynote, Attended panel session, Attended roundtable, Attended speaking session, Attended webinar, Booth Visit, Contact us request, Downloaded assets, Met with sales, On-Demand, Registered, Requested meeting" },
  { name: "Contact Owner", required: false, description: "Sales rep name for 'Met with sales' status routing (one of your configured reps). Leave blank for SDR routing." },
  { name: "Type", required: false, description: "Contact type: Influencer, Prospect, Partner, or blank" },
  { name: "First Name", required: true, description: "Contact's first name" },
  { name: "Last Name", required: true, description: "Contact's last name" },
  { name: "Company", required: true, description: "Company/organization name" },
  { name: "Revenue", required: false, description: "Company revenue as single number (higher number preferred)" },
  { name: "Number of Employees", required: false, description: "Employee count as single number" },
  { name: "Job Title", required: false, description: "Full job title (abbreviations okay)" },
  { name: "Email", required: true, description: "Primary email address (no spaces before/after)" },
  { name: "Alternate Email", required: false, description: "Secondary email address" },
  { name: "HQ Phone", required: false, description: "Headquarters phone number" },
  { name: "Phone Number", required: false, description: "Primary phone (preferred)" },
  { name: "Mobile Phone Number", required: false, description: "Mobile phone number" },
  { name: "Country", required: true, description: "Full country name (no abbreviation, e.g., United States)" },
  { name: "Street Address", required: false, description: "Street address" },
  { name: "City", required: false, description: "City name" },
  { name: "State/Region (US)", required: false, description: "US state (full name, no abbreviation). Only for United States." },
  { name: "State/Region (Canada)", required: false, description: "Canadian province (full name). Only for Canada." },
  { name: "Postal Code", required: false, description: "ZIP/postal code" },
  { name: "Workforce", required: false, description: "TRUE or FALSE - workforce segment indicator" },
  { name: "Customers", required: false, description: "TRUE or FALSE - customer segment indicator" },
  { name: "DevOps", required: false, description: "TRUE or FALSE - DevOps segment indicator" },
  { name: "Inbound Comments", required: false, description: "Notes/comments from event interaction" },
];

const STATUS_OPTIONS = [
  "Attended (not MQL)",
  "Attended keynote",
  "Attended panel session",
  "Attended roundtable",
  "Attended speaking session",
  "Attended webinar",
  "Booth Visit",
  "Contact us request",
  "Downloaded assets",
  "Met with sales",
  "On-Demand",
  "Registered",
  "Requested meeting",
];

// Valid contact owners are the configured reps (single source of truth in company config).
const CONTACT_OWNERS = getCompanyConfig().reps.map(r => r.name);

export const csvProcessorRouter = router({
  // Get target template info
  getTemplateInfo: protectedProcedure.query(() => {
    return {
      fields: TARGET_FIELDS,
      statusOptions: STATUS_OPTIONS,
      contactOwners: CONTACT_OWNERS,
    };
  }),

  // AI-powered field mapping
  analyzeAndMap: protectedProcedure
    .input(z.object({
      sourceHeaders: z.array(z.string()),
      sampleRows: z.array(z.record(z.string(), z.string())),
      eventName: z.string().optional(),
      defaultStatus: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { sourceHeaders, sampleRows, eventName, defaultStatus } = input;

      // Build the prompt for AI field mapping
      const prompt = `You are a data mapping expert. Analyze these CSV headers and sample data, then map them to the target SFDC/HubSpot webinar import template.

${wrapUntrusted(
  "uploaded CSV headers and sample rows",
  `SOURCE CSV HEADERS:
${sourceHeaders.join(", ")}

SAMPLE DATA (first 3 rows):
${sampleRows.slice(0, 3).map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`).join("\n")}`
)}

TARGET TEMPLATE FIELDS:
${TARGET_FIELDS.map(f => `- "${f.name}" (${f.required ? "REQUIRED" : "optional"}): ${f.description}`).join("\n")}

INSTRUCTIONS:
1. Match each source header to the most appropriate target field
2. For fields with no match, return null (the server normalizes any non-matching value to null anyway)
3. If multiple source fields could map to one target, pick the best one
4. Consider common variations: "email_address" -> "Email", "fname" -> "First Name", etc.
5. For country/state fields, note if data needs transformation (e.g., "US" -> "United States")

Return a JSON object with this structure:
{
  "mappings": {
    "Target Field Name": "Source Header Name or null if no match"
  },
  "transformations": [
    {
      "field": "field name",
      "type": "country_expand" | "state_expand" | "phone_format" | "boolean_convert" | "none",
      "description": "what transformation is needed"
    }
  ],
  "warnings": ["any data quality issues noticed"],
  "confidence": 0.0-1.0
}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: withRCP("You are a precise data mapping assistant. Return only valid JSON, no markdown.") },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "field_mapping",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  mappings: {
                    type: "object",
                    additionalProperties: { type: ["string", "null"] }
                  },
                  transformations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        field: { type: "string" },
                        type: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["field", "type", "description"],
                      additionalProperties: false
                    }
                  },
                  warnings: {
                    type: "array",
                    items: { type: "string" }
                  },
                  confidence: { type: "number" }
                },
                required: ["mappings", "transformations", "warnings", "confidence"],
                additionalProperties: false
              }
            }
          }
        });

        const { content, available } = llmText(response);
        // Parsing the note would yield an object with none of the expected fields and
        // silently mark every row as enriched-with-nothing.
        if (!available) throw new Error(LLM_UNAVAILABLE_NOTE);

        const result = JSON.parse(content);
        // The model is instructed to write the literal string "UNMAPPED" for fields it
        // couldn't match (see prompt above). The client's <Select> only treats `null` as
        // "not mapped" — anything else must be a real source header, or the dropdown
        // renders blank instead of showing "-- Not mapped --". Normalize here so every
        // value is either a real source header or null, regardless of what the model wrote.
        const sourceHeaderSet = new Set(sourceHeaders);
        const normalizedMappings: Record<string, string | null> = {};
        for (const [targetField, sourceField] of Object.entries(result.mappings || {})) {
          normalizedMappings[targetField] =
            typeof sourceField === "string" && sourceHeaderSet.has(sourceField) ? sourceField : null;
        }
        return {
          success: true,
          ...result,
          mappings: normalizedMappings,
          eventName: eventName || "",
          defaultStatus: defaultStatus || "Registered",
        };
      } catch (error) {
        console.error("AI mapping error:", error);
        // Fallback to basic heuristic mapping
        return {
          success: true,
          mappings: createBasicMapping(sourceHeaders),
          transformations: [],
          warnings: ["AI mapping failed, using basic heuristic matching"],
          confidence: 0.5,
          eventName: eventName || "",
          defaultStatus: defaultStatus || "Registered",
        };
      }
    }),

  // Process and transform CSV data
  processData: protectedProcedure
    .input(z.object({
      rows: z.array(z.record(z.string(), z.string())),
      mappings: z.record(z.string(), z.string().nullable()),
      transformations: z.array(z.object({
        field: z.string(),
        type: z.string(),
        description: z.string(),
      })),
      eventName: z.string(),
      defaultStatus: z.string(),
      contactOwner: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { rows, mappings, transformations, eventName, defaultStatus, contactOwner } = input;

      const processedRows = rows.map(row => {
        const newRow: Record<string, string> = {};

        // Set default values
        newRow["Recent Event"] = eventName;
        newRow["Event/Webinar Campaign Member Status"] = defaultStatus;
        if (contactOwner) {
          newRow["Contact Owner"] = contactOwner;
        }

        // Apply mappings
        for (const [targetField, sourceField] of Object.entries(mappings)) {
          if (sourceField && row[sourceField] !== undefined) {
            let value = String(row[sourceField] || "").trim();

            // Apply transformations
            const transform = transformations.find(t => t.field === targetField);
            if (transform) {
              value = applyTransformation(value, transform.type);
            }

            newRow[targetField] = value;
          }
        }

        return newRow;
      });

      // Generate CSV output
      const headers = TARGET_FIELDS.map(f => f.name);
      const csvLines = [
        headers.join(","),
        ...processedRows.map(row => 
          headers.map(h => {
            const val = row[h] || "";
            // Escape commas and quotes
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(",")
        )
      ];

      return {
        success: true,
        processedCount: processedRows.length,
        csvContent: csvLines.join("\n"),
        preview: processedRows.slice(0, 5),
      };
    }),
});

// Basic heuristic mapping when AI fails
function createBasicMapping(headers: string[]): Record<string, string | null> {
  const mappings: Record<string, string | null> = {};
      const headerLower: string[] = headers.map((h: string) => h.toLowerCase().replace(/[_\-\s]+/g, ""));

  const fieldPatterns: Record<string, string[]> = {
    "First Name": ["firstname", "fname", "first", "givenname"],
    "Last Name": ["lastname", "lname", "last", "surname", "familyname"],
    "Email": ["email", "emailaddress", "mail", "workemail", "businessemail"],
    "Company": ["company", "companyname", "organization", "org", "account", "accountname"],
    "Job Title": ["title", "jobtitle", "position", "role"],
    "Phone Number": ["phone", "phonenumber", "telephone", "tel", "workphone", "businessphone"],
    "Mobile Phone Number": ["mobile", "mobilephone", "cell", "cellphone"],
    "Country": ["country", "countryname", "nation"],
    "City": ["city", "town"],
    "State/Region (US)": ["state", "region", "province", "stateprovince"],
    "Street Address": ["street", "address", "streetaddress", "address1"],
    "Postal Code": ["zip", "zipcode", "postalcode", "postal"],
    "Number of Employees": ["employees", "employeecount", "numberofemployees", "companysize", "size"],
    "Revenue": ["revenue", "annualrevenue", "companyrevenue"],
    "Inbound Comments": ["comments", "notes", "description", "inboundcomments"],
  };

  for (const [targetField, patterns] of Object.entries(fieldPatterns)) {
    const matchIndex = headerLower.findIndex((h: string) => patterns.some((p: string) => h.includes(p)));
    if (matchIndex !== -1) {
      mappings[targetField] = headers[matchIndex];
    } else {
      mappings[targetField] = null;
    }
  }

  return mappings;
}

// Apply data transformations
function applyTransformation(value: string, type: string): string {
  switch (type) {
    case "country_expand":
      const countryMap: Record<string, string> = {
        "us": "United States",
        "usa": "United States",
        "u.s.": "United States",
        "u.s.a.": "United States",
        "united states of america": "United States",
        "ca": "Canada",
        "can": "Canada",
        "uk": "United Kingdom",
        "gb": "United Kingdom",
        "great britain": "United Kingdom",
      };
      return countryMap[value.toLowerCase()] || value;

    case "state_expand":
      const stateMap: Record<string, string> = {
        "al": "Alabama", "ak": "Alaska", "az": "Arizona", "ar": "Arkansas",
        "ca": "California", "co": "Colorado", "ct": "Connecticut", "de": "Delaware",
        "fl": "Florida", "ga": "Georgia", "hi": "Hawaii", "id": "Idaho",
        "il": "Illinois", "in": "Indiana", "ia": "Iowa", "ks": "Kansas",
        "ky": "Kentucky", "la": "Louisiana", "me": "Maine", "md": "Maryland",
        "ma": "Massachusetts", "mi": "Michigan", "mn": "Minnesota", "ms": "Mississippi",
        "mo": "Missouri", "mt": "Montana", "ne": "Nebraska", "nv": "Nevada",
        "nh": "New Hampshire", "nj": "New Jersey", "nm": "New Mexico", "ny": "New York",
        "nc": "North Carolina", "nd": "North Dakota", "oh": "Ohio", "ok": "Oklahoma",
        "or": "Oregon", "pa": "Pennsylvania", "ri": "Rhode Island", "sc": "South Carolina",
        "sd": "South Dakota", "tn": "Tennessee", "tx": "Texas", "ut": "Utah",
        "vt": "Vermont", "va": "Virginia", "wa": "Washington", "wv": "West Virginia",
        "wi": "Wisconsin", "wy": "Wyoming", "dc": "District of Columbia",
      };
      return stateMap[value.toLowerCase()] || value;

    case "phone_format":
      // Remove non-numeric except + and x for extension
      return value.replace(/[^\d+x]/gi, "");

    case "boolean_convert":
      const trueValues = ["true", "yes", "1", "y"];
      return trueValues.includes(value.toLowerCase()) ? "TRUE" : "FALSE";

    default:
      return value;
  }
}
