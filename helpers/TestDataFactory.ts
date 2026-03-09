import OpenAI from 'openai';

/**
 * TestDataFactory — AI-Generated UK Property Test Data
 *
 * Generates realistic, valid UK-specific test data for:
 * - Conveyancing enquiries (buyer/seller names, property addresses)
 * - Financial data (property values, deposits, sort codes, account numbers)
 * - KYC/AML data (NI numbers, passport numbers, DOBs)
 * - Solicitor firms and agents
 *
 * Falls back to deterministic seeded data if OpenAI is unavailable.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PersonData {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    nationalInsuranceNumber: string;
}

export interface UKAddressData {
    line1: string;
    line2?: string;
    city: string;
    county: string;
    postcode: string;
    fullAddress: string;
}

export interface PropertyData {
    address: UKAddressData;
    propertyType: 'Detached' | 'Semi-Detached' | 'Terraced' | 'Flat' | 'Bungalow';
    tenure: 'Freehold' | 'Leasehold';
    bedrooms: number;
    askingPrice: number;
    agreedPrice: number;
    depositAmount: number;
    mortgageAmount: number;
}

export interface BankData {
    bankName: string;
    sortCode: string;
    accountNumber: string;
    iban: string;
}

export interface EnquiryData {
    buyer: PersonData;
    seller: PersonData;
    property: PropertyData;
    buyerSolicitorFirm: string;
    sellerSolicitorFirm: string;
    agentName: string;
    agencyName: string;
    completionDate: string;
    exchangeDate: string;
}

// ─── Static seed data (fallback if AI unavailable) ─────────────────────────

const UK_FIRST_NAMES = [
    'James', 'Oliver', 'Harry', 'Jack', 'George', 'Noah', 'Charlie', 'Jacob',
    'Alfie', 'Freddie', 'Emma', 'Olivia', 'Sophia', 'Isabella', 'Mia', 'Ava',
    'Charlotte', 'Amelia', 'Harper', 'Evelyn',
  ];

const UK_LAST_NAMES = [
    'Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies', 'Evans', 'Wilson',
    'Thomas', 'Roberts', 'Johnson', 'Lewis', 'Walker', 'Robinson', 'Wood',
    'Thompson', 'White', 'Watson', 'Jackson', 'Wright',
  ];

const UK_CITIES = [
  { city: 'London', county: 'Greater London', postcodeArea: 'SW' },
  { city: 'Manchester', county: 'Greater Manchester', postcodeArea: 'M' },
  { city: 'Birmingham', county: 'West Midlands', postcodeArea: 'B' },
  { city: 'Leeds', county: 'West Yorkshire', postcodeArea: 'LS' },
  { city: 'Bristol', county: 'Bristol', postcodeArea: 'BS' },
  { city: 'Sheffield', county: 'South Yorkshire', postcodeArea: 'S' },
  { city: 'Edinburgh', county: 'Edinburgh', postcodeArea: 'EH' },
  { city: 'Liverpool', county: 'Merseyside', postcodeArea: 'L' },
  { city: 'Oxford', county: 'Oxfordshire', postcodeArea: 'OX' },
  { city: 'Cambridge', county: 'Cambridgeshire', postcodeArea: 'CB' },
  ];

const SOLICITOR_FIRMS = [
    'Slater & Gordon', 'Shoosmiths', 'Clarke Willmott', 'Brabners', 'Trethowans',
    'Blandy & Blandy', 'Lester Aldridge', 'Stephens Scown', 'Stephenson Smart',
    'Taylor Walton', 'Birketts LLP', 'Mills & Reeve', 'Gateley Legal',
  ];

const ESTATE_AGENTS = [
    'Savills', 'Knight Frank', 'Hamptons', 'Foxtons', 'Connells', 'Purplebricks',
    'Bairstow Eves', 'Andrews Property Group', 'Chancellors', 'Martin & Co',
  ];

const UK_BANKS = [
  { name: 'Barclays', sortPrefix: '20' },
  { name: 'HSBC', sortPrefix: '40' },
  { name: 'Lloyds Bank', sortPrefix: '30' },
  { name: 'NatWest', sortPrefix: '60' },
  { name: 'Santander UK', sortPrefix: '09' },
  { name: 'Halifax', sortPrefix: '11' },
  { name: 'Nationwide', sortPrefix: '07' },
  ];

// ─── Helper functions ────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
    return arr[randomInt(0, arr.length - 1)];
}

function padded(n: number, length: number): string {
    return String(n).padStart(length, '0');
}

function generateUKPostcode(area: string): string {
    const district = randomInt(1, 20);
    const sector = randomInt(1, 9);
    const unit = String.fromCharCode(randomInt(65, 90)) + String.fromCharCode(randomInt(65, 90));
    return `${area}${district} ${sector}${unit}`;
}

function generateNINumber(): string {
    const prefix = randomFrom(['AA', 'AB', 'AE', 'AH', 'AK', 'AL', 'AM', 'AP', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY', 'AZ',
                                   'BA', 'BB', 'BE', 'BH', 'BK', 'BL', 'BM', 'BT', 'CA', 'CB', 'CE', 'CH', 'CK', 'CL', 'CR']);
    const numbers = padded(randomInt(100000, 999999), 6);
    const suffix = randomFrom(['A', 'B', 'C', 'D']);
    return `${prefix}${numbers}${suffix}`;
}

function generateSortCode(prefix: string): string {
    return `${prefix}-${padded(randomInt(0, 99), 2)}-${padded(randomInt(0, 99), 2)}`;
}

function generateAccountNumber(): string {
    return padded(randomInt(10000000, 99999999), 8);
}

function generateIBAN(sortCode: string, accountNumber: string): string {
    const sc = sortCode.replace(/-/g, '');
    return `GB${padded(randomInt(10, 99), 2)}${randomFrom(UK_BANKS).name.slice(0, 4).toUpperCase()}${sc}${accountNumber}`;
}

function generateUKPhone(): string {
    const prefixes = ['0207', '0208', '0161', '0121', '0113', '07700', '07800', '07900'];
    const prefix = randomFrom(prefixes);
    const suffix = padded(randomInt(100000, 999999), 6);
    return `${prefix} ${suffix}`;
}

function generateDOB(minAge = 25, maxAge = 65): string {
    const year = new Date().getFullYear() - randomInt(minAge, maxAge);
    const month = padded(randomInt(1, 12), 2);
    const day = padded(randomInt(1, 28), 2);
    return `${day}/${month}/${year}`;
}

function futureDate(daysFromNow: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().split('T')[0];
}

// ─── TestDataFactory class ──────────────────────────────────────────────────

export class TestDataFactory {
    private readonly openai: OpenAI | null;
    private readonly useAI: boolean;

  constructor() {
        this.useAI = !!process.env.OPENAI_API_KEY;
        this.openai = this.useAI
          ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
                : null;
  }

  /** Generate a complete UK person record */
  person(overrides: Partial<PersonData> = {}): PersonData {
        const firstName = overrides.firstName ?? randomFrom(UK_FIRST_NAMES);
        const lastName = overrides.lastName ?? randomFrom(UK_LAST_NAMES);
        const year = new Date().getFullYear() - randomInt(25, 55);
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@testmail.homey.dev`;

      return {
              firstName,
              lastName,
              fullName: `${firstName} ${lastName}`,
              email,
              phone: generateUKPhone(),
              dateOfBirth: generateDOB(),
              nationalInsuranceNumber: generateNINumber(),
              ...overrides,
      };
  }

  /** Generate a realistic UK residential address */
  address(overrides: Partial<UKAddressData> = {}): UKAddressData {
        const location = randomFrom(UK_CITIES);
        const houseNumber = randomInt(1, 200);
        const streetNames = [
                'High Street', 'Church Lane', 'Victoria Road', 'Park Avenue', 'Mill Road',
                'Station Road', 'King Street', 'Queen Street', 'Manor Drive', 'Oak Close',
                'Elm Grove', 'Maple Avenue', 'Cedar Way', 'Birch Close', 'Willow Court',
              ];
        const line1 = `${houseNumber} ${randomFrom(streetNames)}`;
        const postcode = generateUKPostcode(location.postcodeArea);

      return {
              line1,
              city: location.city,
              county: location.county,
              postcode,
              fullAddress: `${line1}, ${location.city}, ${location.county}, ${postcode}`,
              ...overrides,
      };
  }

  /** Generate realistic UK property data */
  property(overrides: Partial<PropertyData> = {}): PropertyData {
        const propertyTypes: PropertyData['propertyType'][] = ['Detached', 'Semi-Detached', 'Terraced', 'Flat', 'Bungalow'];
        const tenures: PropertyData['tenure'][] = ['Freehold', 'Leasehold'];
        const askingPrice = randomInt(180000, 950000);
        const agreedPrice = Math.round(askingPrice * (0.97 + Math.random() * 0.05));
        const depositPct = randomFrom([0.05, 0.1, 0.15, 0.2, 0.25]);
        const depositAmount = Math.round(agreedPrice * depositPct);

      return {
              address: this.address(),
              propertyType: randomFrom(propertyTypes),
              tenure: randomFrom(tenures),
              bedrooms: randomInt(1, 5),
              askingPrice,
              agreedPrice,
              depositAmount,
              mortgageAmount: agreedPrice - depositAmount,
              ...overrides,
      };
  }

  /** Generate UK bank account details */
  bankAccount(overrides: Partial<BankData> = {}): BankData {
        const bank = randomFrom(UK_BANKS);
        const sortCode = generateSortCode(bank.sortPrefix);
        const accountNumber = generateAccountNumber();
        return {
                bankName: bank.name,
                sortCode,
                accountNumber,
                iban: generateIBAN(sortCode, accountNumber),
                ...overrides,
        };
  }

  /** Generate a complete Homey conveyancing enquiry dataset */
  enquiry(overrides: Partial<EnquiryData> = {}): EnquiryData {
        const exchangeDays = randomInt(14, 28);
        const completionDays = exchangeDays + randomInt(7, 28);

      return {
              buyer: this.person(),
              seller: this.person(),
              property: this.property(),
              buyerSolicitorFirm: randomFrom(SOLICITOR_FIRMS),
              sellerSolicitorFirm: randomFrom(SOLICITOR_FIRMS),
              agentName: `${randomFrom(UK_FIRST_NAMES)} ${randomFrom(UK_LAST_NAMES)}`,
              agencyName: randomFrom(ESTATE_AGENTS),
              exchangeDate: futureDate(exchangeDays),
              completionDate: futureDate(completionDays),
              ...overrides,
      };
  }

  /**
     * Generate AI-enhanced test data using GPT-4o.
     * Falls back to static factory if OpenAI is unavailable.
     */
  async enquiryWithAI(scenario: string = 'standard residential purchase'): Promise<EnquiryData> {
        if (!this.openai) {
                console.warn('[TestDataFactory] No OpenAI key — using static data');
                return this.enquiry();
        }

      try {
              const prompt = `Generate realistic UK property conveyancing test data for: "${scenario}".
              Return a JSON object with these exact fields (use realistic UK values):
              {
                "buyer": { "firstName": "", "lastName": "", "email": "", "phone": "", "dateOfBirth": "DD/MM/YYYY", "nationalInsuranceNumber": "AB123456C" },
                  "seller": { "firstName": "", "lastName": "", "email": "", "phone": "" },
                    "property": {
                        "address": { "line1": "", "city": "", "county": "", "postcode": "" },
                            "propertyType": "Detached|Semi-Detached|Terraced|Flat|Bungalow",
                                "tenure": "Freehold|Leasehold",
                                    "bedrooms": 3,
                                        "agreedPrice": 350000,
                                            "depositAmount": 35000
                                              },
                                                "buyerSolicitorFirm": "",
                                                  "sellerSolicitorFirm": "",
                                                    "agentName": "",
                                                      "agencyName": "",
                                                        "exchangeDate": "YYYY-MM-DD",
                                                          "completionDate": "YYYY-MM-DD"
                                                          }
                                                          Return ONLY valid JSON, no markdown.`;

          const response = await this.openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 600,
                    temperature: 0.7,
                    response_format: { type: 'json_object' },
          });

          const raw = JSON.parse(response.choices[0]?.message?.content || '{}');

          // Merge AI data with our static factory (fills in any gaps)
          const base = this.enquiry();
              return {
                        ...base,
                        buyer: { ...base.buyer, ...raw.buyer, fullName: `${raw.buyer?.firstName} ${raw.buyer?.lastName}` },
                        seller: { ...base.seller, ...raw.seller, fullName: `${raw.seller?.firstName} ${raw.seller?.lastName}` },
                        property: {
                                    ...base.property,
                                    ...raw.property,
                                    address: { ...base.property.address, ...raw.property?.address, fullAddress: [
                                                  raw.property?.address?.line1,
                                                  raw.property?.address?.city,
                                                  raw.property?.address?.county,
                                                  raw.property?.address?.postcode,
                                                ].filter(Boolean).join(', ') },
                                    mortgageAmount: (raw.property?.agreedPrice ?? base.property.agreedPrice)
                                      - (raw.property?.depositAmount ?? base.property.depositAmount),
                        },
                        buyerSolicitorFirm: raw.buyerSolicitorFirm ?? base.buyerSolicitorFirm,
                        sellerSolicitorFirm: raw.sellerSolicitorFirm ?? base.sellerSolicitorFirm,
                        agentName: raw.agentName ?? base.agentName,
                        agencyName: raw.agencyName ?? base.agencyName,
                        exchangeDate: raw.exchangeDate ?? base.exchangeDate,
                        completionDate: raw.completionDate ?? base.completionDate,
              };
      } catch (err) {
              console.error('[TestDataFactory] AI generation failed, using static data:', err);
              return this.enquiry();
      }
  }

  /** Generate multiple enquiries for bulk testing */
  bulkEnquiries(count: number): EnquiryData[] {
        return Array.from({ length: count }, () => this.enquiry());
  }

  /** Generate a unique test email to avoid conflicts */
  uniqueEmail(prefix = 'test'): string {
        return `${prefix}+${Date.now()}@testmail.homey.dev`;
  }

  /** Format price as UK GBP string */
  static formatPrice(amount: number): string {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);
  }
}

// Singleton for use across tests
export const testDataFactory = new TestDataFactory();
