/**
 * Universal Data Parser
 * 
 * Accepts data in multiple formats and intelligently parses it:
 * - CSV (comma-separated)
 * - TSV (tab-separated, from Excel/Sheets copy-paste)
 * - JSON
 * - Raw text with any delimiter
 */

interface ParsedRow {
  [key: string]: any;
}

export function parseUniversalData(rawData: string): ParsedRow[] {
  const trimmed = rawData.trim();
  
  // Try JSON first
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.log('Not valid JSON, trying other formats...');
    }
  }
  
  // Split into lines
  const lines = trimmed.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('No data found');
  }
  
  // Detect delimiter (tab, comma, pipe, semicolon)
  const firstLine = lines[0];
  const delimiters = ['\t', ',', '|', ';'];
  let delimiter = ',';
  let maxColumns = 0;
  
  for (const delim of delimiters) {
    const columns = firstLine.split(delim).length;
    if (columns > maxColumns) {
      maxColumns = columns;
      delimiter = delim;
    }
  }
  
  console.log(`Detected delimiter: ${delimiter === '\t' ? 'TAB' : delimiter}, ${maxColumns} columns`);
  
  // Parse headers
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  // Parse rows
  const rows: ParsedRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = parseLine(line, delimiter);
    
    if (values.length === 0) continue;
    
    const row: ParsedRow = {};
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j] || '';
      
      // Try to parse JSON values
      row[header] = parseValue(value);
    }
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse a single line respecting quoted values
 */
function parseLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' || char === "'") {
      if (inQuotes && nextChar === char) {
        // Escaped quote
        current += char;
        i++; // Skip next
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  
  return values.map(v => v.replace(/^["']|["']$/g, ''));
}

/**
 * Intelligently parse a value (JSON, number, boolean, or string)
 */
function parseValue(value: string): any {
  const trimmed = value.trim();
  
  if (!trimmed) return null;
  
  // Try JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // Not JSON, continue
    }
  }
  
  // Try number
  if (/^-?\d+\.?\d*$/.test(trimmed)) {
    const num = parseFloat(trimmed);
    if (!isNaN(num)) return num;
  }
  
  // Try boolean
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  if (trimmed.toLowerCase() === 'null') return null;
  
  // Return as string
  return trimmed;
}

/**
 * Map parsed data to account schema
 */
export function mapToAccountSchema(rows: ParsedRow[]): Array<{
  name: string;
  domain: string;
  stack?: Record<string, any>;
  research?: Record<string, any>;
  trigger?: Record<string, any>;
  rawData?: Record<string, any>;
}> {
  return rows.map(row => {
    const account: any = {
      name: '',
      domain: '',
      stack: {},
      research: {},
      trigger: {},
      rawData: {}
    };
    
    // Map fields intelligently
    for (const [key, value] of Object.entries(row)) {
      const keyLower = key.toLowerCase();
      
      // Name field
      if (keyLower.includes('name') || keyLower.includes('company')) {
        account.name = String(value || '');
      }
      // Domain field
      else if (keyLower.includes('domain') || keyLower.includes('website') || keyLower.includes('url')) {
        account.domain = String(value || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      }
      // Tech stack fields
      else if (keyLower.includes('tech') || keyLower.includes('stack') || keyLower.includes('tool')) {
        if (typeof value === 'object' && value !== null) {
          account.stack[key] = value;
        } else if (value) {
          account.stack[key] = value;
        }
      }
      // Research fields
      else if (keyLower.includes('research') || keyLower.includes('insight') || 
               keyLower.includes('security') || keyLower.includes('incident') ||
               keyLower.includes('job') || keyLower.includes('decision')) {
        if (typeof value === 'object' && value !== null) {
          account.research[key] = value;
        } else if (value) {
          account.research[key] = value;
        }
      }
      // Trigger/signal fields
      else if (keyLower.includes('trigger') || keyLower.includes('signal') || 
               keyLower.includes('buying') || keyLower.includes('intent')) {
        if (typeof value === 'object' && value !== null) {
          account.trigger[key] = value;
        } else if (value) {
          account.trigger[key] = value;
        }
      }
      // Everything else goes to rawData
      else {
        account.rawData[key] = value;
      }
    }
    
    return account;
  });
}
