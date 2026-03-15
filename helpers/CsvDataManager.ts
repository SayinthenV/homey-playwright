import * as fs from 'fs';
import * as path from 'path';

/**
 * CsvDataManager
 * ──────────────
 * Reads test data rows from a CSV file.
 * Auto-generates dynamic values (name, email, phone) at runtime and
 * writes them back into the CSV so every run is traceable by test case ID.
 *
 * CSV columns:
 *   test_case_id        – unique ID per row (e.g. TC-LEAD-001)
 *   lead_type           – sale | purchase | remortgage | transfer_of_equity | sale_and_purchase
 *   postcode            – property postcode for address lookup
 *   building_number     – building number/name to pick from address dropdown
 *   transaction_stage   – offer_accepted | offer_received | offer_imminent | on_market | …
 *   offer_price         – numeric (no £, no commas)
 *   agency              – agency display name to select in Step 4
 *   branch              – branch display name to select in Step 4
 *   generated_first_name – AUTO-GENERATED at runtime, written back to CSV
 *   generated_last_name  – AUTO-GENERATED at runtime, written back to CSV
 *   generated_email      – AUTO-GENERATED at runtime, written back to CSV
 *   generated_phone      – AUTO-GENERATED at runtime, written back to CSV
 *   created_case_id     – filled after successful lead creation (Case ID from app)
 *   run_timestamp       – ISO timestamp of the test run
 */

export interface LeadRow {
    test_case_id: string;
    lead_type: 'sale' | 'purchase' | 'remortgage' | 'transfer_of_equity' | 'sale_and_purchase';
    postcode: string;
    building_number: string;
    transaction_stage: string;
    offer_price: string;
    agency: string;
    branch: string;
    // Auto-generated — populated at runtime
  generated_first_name: string;
    generated_last_name: string;
    generated_email: string;
    generated_phone: string;
    // Written back after creation
  created_case_id: string;
    run_timestamp: string;
}

const CSV_PATH = path.resolve(__dirname, '../test-data/leads.csv');

// ── Helpers ───────────────────────────────────────────────────────────────
const FIRST_NAMES = ['Alice', 'Bob', 'Charlotte', 'David', 'Emily', 'Fiona', 'George', 'Hannah'];
const LAST_NAMES  = ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans'];

function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Generates a unique-enough name so repeated runs don't collide. */
function generateName(): { firstName: string; lastName: string } {
    const suffix = Date.now().toString().slice(-5);
    return {
          firstName: randomItem(FIRST_NAMES),
          lastName:  `${randomItem(LAST_NAMES)}${suffix}`,
    };
}

function generateEmail(firstName: string, lastName: string): string {
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@pw-test.homey.co.uk`;
}

function generatePhone(): string {
    // UK mobile: 07xxx xxxxxx
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
    return `07${digits}`;
}

// ── CSV parsing ───────────────────────────────────────────────────────────
function parseCSV(raw: string): LeadRow[] {
    const lines   = raw.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
          return row as unknown as LeadRow;
    });
}

function serializeCSV(rows: LeadRow[]): string {
    const headers: (keyof LeadRow)[] = [
          'test_case_id', 'lead_type', 'postcode', 'building_number',
          'transaction_stage', 'offer_price', 'agency', 'branch',
          'generated_first_name', 'generated_last_name', 'generated_email', 'generated_phone',
          'created_case_id', 'run_timestamp',
        ];
    const headerLine = headers.join(',');
    const dataLines  = rows.map(row => headers.map(h => row[h] ?? '').join(','));
    return [headerLine, ...dataLines].join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────
export class CsvDataManager {
    private rows: LeadRow[];

  constructor() {
        const raw = fs.readFileSync(CSV_PATH, 'utf-8');
        this.rows = parseCSV(raw);
  }

  /**
     * Returns all rows, auto-generating name/email/phone for any that are empty.
     * Call this once at the start of a test run to get your data set.
     */
  prepareRows(): LeadRow[] {
        this.rows = this.rows.map(row => {
                if (!row.generated_first_name || !row.generated_last_name) {
                          const { firstName, lastName } = generateName();
                          row.generated_first_name = firstName;
                          row.generated_last_name  = lastName;
                          row.generated_email      = generateEmail(firstName, lastName);
                          row.generated_phone      = generatePhone();
                }
                return row;
        });
        this._save();
        return this.rows;
  }

  /**
     * Writes the created Case ID and run timestamp back to the CSV row
     * identified by test_case_id.
     */
  updateAfterCreation(testCaseId: string, createdCaseId: string): void {
        const row = this.rows.find(r => r.test_case_id === testCaseId);
        if (!row) throw new Error(`No CSV row found for test case ID: ${testCaseId}`);
        row.created_case_id = createdCaseId;
        row.run_timestamp   = new Date().toISOString();
        this._save();
  }

  private _save(): void {
        fs.writeFileSync(CSV_PATH, serializeCSV(this.rows), 'utf-8');
  }
}
