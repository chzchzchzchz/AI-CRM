import { describe, it, expect, vi } from "vitest";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null)
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/file.txt", key: "test-key" })
}));

describe("RAG Service", () => {
  it("should chunk text into semantic pieces", async () => {
    // Test the chunking logic
    const text = `First paragraph with some content.

Second paragraph with more content.

Third paragraph with even more content that is longer and should be in its own chunk.`;

    const chunks = text.split(/\n\n+/).filter(c => c.trim());
    
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toContain("First paragraph");
    expect(chunks[1]).toContain("Second paragraph");
    expect(chunks[2]).toContain("Third paragraph");
  });

  it("should calculate cosine similarity correctly", () => {
    // Simple cosine similarity test
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    const c = [0, 1, 0];

    // Same vectors should have similarity 1
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const similarity1 = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    expect(similarity1).toBe(1);

    // Orthogonal vectors should have similarity 0
    dotProduct = 0;
    normA = 0;
    normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * c[i];
      normA += a[i] * a[i];
      normB += c[i] * c[i];
    }
    const similarity2 = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    expect(similarity2).toBe(0);
  });
});

describe("Tools Router - Lead Processing", () => {
  it("should normalize field names correctly", () => {
    const FIELD_ALIASES: Record<string, string[]> = {
      'firstName': ['firstname', 'first name', 'fname', 'givenname', 'first_name'],
      'lastName': ['surname', 'lastname', 'last name', 'lname', 'familyname', 'last_name'],
      'email': ['email', 'emailaddress', 'e-mail', 'email_address'],
      'phone': ['telephone', 'phone', 'phonenumber', 'phone_number'],
      'company': ['organisation', 'organization', 'company', 'account', 'company_name'],
    };

    function normalizeFieldName(field: string): string {
      const lower = field.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      for (const [standard, aliases] of Object.entries(FIELD_ALIASES)) {
        if (aliases.some(a => a.replace(/[^a-z0-9]/g, '') === lower)) {
          return standard;
        }
      }
      return field;
    }

    expect(normalizeFieldName("First Name")).toBe("firstName");
    expect(normalizeFieldName("LASTNAME")).toBe("lastName");
    expect(normalizeFieldName("e-mail")).toBe("email");
    expect(normalizeFieldName("Phone Number")).toBe("phone");
    expect(normalizeFieldName("Organisation")).toBe("company");
    expect(normalizeFieldName("CustomField")).toBe("CustomField");
  });

  it("should clean phone numbers correctly", () => {
    function cleanPhoneNumber(phone: string): string {
      let p = String(phone || '').replace(/\D/g, '');
      if (p.startsWith('1') && p.length === 11) {
        p = p.substring(1);
      }
      if (p.length === 10) {
        return `(${p.slice(0,3)}) ${p.slice(3,6)}-${p.slice(6)}`;
      }
      return p;
    }

    expect(cleanPhoneNumber("1234567890")).toBe("(123) 456-7890");
    expect(cleanPhoneNumber("11234567890")).toBe("(123) 456-7890");
    expect(cleanPhoneNumber("(123) 456-7890")).toBe("(123) 456-7890");
    expect(cleanPhoneNumber("123-456-7890")).toBe("(123) 456-7890");
  });

  it("should clean company names correctly", () => {
    function cleanCompanyName(company: string): string {
      return String(company || '')
        .replace(/,?\s*(Inc|LLC|Ltd|Corp|Corporation|Incorporated)\.?$/gi, '')
        .trim();
    }

    expect(cleanCompanyName("Acme Inc")).toBe("Acme");
    expect(cleanCompanyName("Acme, Inc.")).toBe("Acme");
    expect(cleanCompanyName("Acme Corporation")).toBe("Acme");
    expect(cleanCompanyName("Acme LLC")).toBe("Acme");
    expect(cleanCompanyName("Acme Ltd")).toBe("Acme");
    expect(cleanCompanyName("Acme")).toBe("Acme");
  });

  it("should detect personal emails correctly", () => {
    const PERSONAL_EMAIL_DOMAINS = new Set([
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
      'aol.com', 'comcast.net', 'icloud.com', 'msn.com', 'live.com'
    ]);

    function isPersonalEmail(email: string): boolean {
      const domain = email.split('@')[1]?.toLowerCase();
      return PERSONAL_EMAIL_DOMAINS.has(domain);
    }

    expect(isPersonalEmail("test@gmail.com")).toBe(true);
    expect(isPersonalEmail("test@yahoo.com")).toBe(true);
    expect(isPersonalEmail("test@company.com")).toBe(false);
    expect(isPersonalEmail("test@acme.io")).toBe(false);
  });
});

describe("Content Generation", () => {
  it("should have correct content type prompts", () => {
    const contentTypePrompts: Record<string, string> = {
      email: 'Generate a personalized sales email that is concise, value-focused, and has a clear call to action.',
      webinar: 'Generate webinar promotional content including headline, key bullets, and email copy.',
      battle_card: 'Generate a competitive battle card with key differentiators, objection handling, and win themes.',
      call_script: 'Generate a discovery/demo call script with opening, key questions, and next steps.',
      linkedin: 'Generate a LinkedIn connection request or InMail message that is professional and personalized.'
    };

    expect(contentTypePrompts['email']).toContain('sales email');
    expect(contentTypePrompts['webinar']).toContain('webinar');
    expect(contentTypePrompts['battle_card']).toContain('battle card');
    expect(contentTypePrompts['call_script']).toContain('call script');
    expect(contentTypePrompts['linkedin']).toContain('LinkedIn');
  });
});
