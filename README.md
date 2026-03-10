# homey-playwright

AI-Assisted Playwright POM Framework for the Homey conveyancing platform.
Built with TypeScript, Playwright, and Hotwire/Turbo-aware helpers.

## Quick Start

```bash
git clone https://github.com/SayinthenV/homey-playwright.git
cd homey-playwright
npm install
npx playwright install chromium
cp .env.test.example .env.test
# Fill in BASE_URL and test user credentials in .env.test
npx playwright test
npx playwright test --ui
```

## Project Structure

```
homey-playwright/
├── pages/
│   ├── base/BasePage.ts              # Abstract base: nav, Turbo helpers, flash
│   ├── auth/LoginPage.ts             # Devise sign-in
│   ├── enquiries/
│   │   ├── EnquiryListPage.ts        # List with search/filter
│   │   ├── EnquiryDetailPage.ts      # Detail + convert to conveyance
│   │   └── NewEnquiryPage.ts         # 4-step wizard (Wicked gem)
│   ├── conveyances/
│   │   ├── ConveyanceListPage.ts     # Cases list
│   │   └── ConveyanceDetailPage.ts   # Detail + tabs (documents, payments, KYC)
│   ├── actionCenter/
│   │   └── ActionCenterPage.ts       # Live workflow (Turbo Streams)
│   ├── quotes/
│   │   └── QuoteGeneratorPage.ts     # Pricing engine + PDF preview
│   ├── payments/
│   │   └── StripePaymentPage.ts      # Stripe Elements iframe
│   ├── kyc/
│   │   └── KYCDashboardPage.ts       # Thirdfort KYC status
│   └── documents/
│       └── DocumentUploadPage.ts     # Active Storage drag-drop + validation
├── tests/
│   ├── auth/
│   │   └── login.spec.ts             # Login / logout
│   ├── enquiries/
│   │   └── create-enquiry.spec.ts    # Full enquiry wizard flow
│   ├── conveyances/
│   │   ├── action-workflow.spec.ts   # Action centre workflow
│   │   └── conveyance-detail.spec.ts # Detail page tabs + status
│   ├── kyc/
│   │   └── kyc-workflow.spec.ts      # KYC initiation + status polling
│   ├── quotes/
│   │   └── quote-generator.spec.ts   # Quote creation + pricing validation
│   ├── payments/
│   │   └── stripe-payment.spec.ts    # Stripe success / decline / 3DS
│   └── documents/                    # (Phase 5+)
├── helpers/
│   ├── AuthHelper.ts                 # Pre-save browser storage state
│   ├── ThirdfortMocker.ts            # Webhook simulation
│   ├── SelectorHealer.ts             # AI self-healing selectors (Phase 3)
│   ├── TestDataFactory.ts            # UK property test data (Phase 3)
│   ├── NLTestConverter.ts            # NL to Playwright test (Phase 3)
│   ├── CIFailureAnalyser.ts          # AI failure analysis (Phase 3)
│   └── ApiHelper.ts                  # REST API helper for fast setup/teardown
├── ai/
│   └── PageObjectGenerator.ts        # DOM crawler → POM generator (Phase 3)
├── fixtures/
│   ├── auth.setup.ts                 # Global auth state fixture
│   └── test-data.setup.ts            # Global test data seeding fixture
├── .github/workflows/
│   └── playwright.yml                # CI pipeline with AI analysis
├── .env.test.example
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

## Authentication Strategy

Tests never log in through the UI. Instead, `fixtures/auth.setup.ts` runs once per project and saves browser storage state (cookies + localStorage) for each role:

- `agent` → `.auth/agent.json`
- - `solicitor` → `.auth/solicitor.json`
  - - `buyer` → `.auth/buyer.json`
    - - `admin` → `.auth/admin.json`
     
      - All test specs load a saved state via `storageState` in `playwright.config.ts`.
     
      - ## Test Data Strategy (Phase 4)
     
      - `fixtures/test-data.setup.ts` seeds reusable test data via the API before any spec runs:
     
      - ```typescript
        // In your spec file, read the manifest
        import { loadManifest } from '../fixtures/test-data.setup';

        test('uses seeded enquiry', async ({ page }) => {
          const manifest = loadManifest();
          test.skip(!manifest, 'No test data manifest found');
          const enquiry = manifest!.enquiries[0];
          await page.goto(`/enquiries/${enquiry.id}`);
        });
        ```

        The manifest is written to `.test-data/manifest.json` and contains:
        - `enquiries[]` — id, reference, type (house/flat), status
        - - `conveyances[]` — id, reference, enquiryId, status
         
          - Set `CLEANUP_TEST_DATA=true` in CI to delete seeded data after the run.
         
          - ## ApiHelper — Fast Test Setup
         
          - `helpers/ApiHelper.ts` wraps the Homey REST API for programmatic test setup and teardown:
         
          - ```typescript
            const api = new ApiHelper();
            await api.init('admin');

            // Ensure an enquiry exists (create or reuse)
            const enquiry = await api.ensureEnquiryExists({
              propertyType: 'house',
              purchasePrice: 350000,
              propertyAddress: '10 Test Street, London, SW1A 1AA',
            });

            // Ensure a conveyance exists for that enquiry
            const conveyance = await api.ensureConveyanceExists(enquiry.id);

            // Cleanup after test
            await api.deleteConveyance(conveyance.id).catch(() => {});
            await api.deleteEnquiry(enquiry.id).catch(() => {});
            ```

            ## DocumentUploadPage — Active Storage

            `pages/documents/DocumentUploadPage.ts` handles Active Storage direct uploads, drag-drop zones, and document validation:

            ```typescript
            const docsPage = new DocumentUploadPage(page);
            await docsPage.goto(conveyanceId);

            // Upload a PDF
            await docsPage.uploadDocument('/path/to/test.pdf', 'Proof of ID');
            await docsPage.expectDocumentVisible('Proof of ID');

            // Drag-and-drop upload
            await docsPage.dragDropFile('/path/to/contract.pdf');
            await docsPage.expectUploadSuccess();

            // Validate document status
            await docsPage.expectDocumentStatus('Proof of ID', 'verified');
            ```

            ## AI Features (Phase 3)

            ### Self-Healing Selectors

            ```typescript
            import { SelectorHealer } from './helpers/SelectorHealer';
            const healer = new SelectorHealer(page);
            const el = await healer.find('Submit button', [
              '[data-testid="submit"]',
              'button[type="submit"]',
              'text=Submit',
            ]);
            ```

            ### Test Data Factory

            ```typescript
            import { TestDataFactory } from './helpers/TestDataFactory';
            const factory = new TestDataFactory();
            const buyer = factory.createBuyer();
            const property = factory.createProperty({ type: 'flat', price: 250000 });
            ```

            ### NL to Playwright Test

            ```bash
            npm run nl2test
            # Prompts for natural language description → outputs spec file
            ```

            ### CI Failure Analyser

            ```bash
            npm run analyse-failures
            # Reads playwright-report/, posts AI analysis to GitHub PR
            ```

            ### DOM → Page Object Generator

            ```bash
            npm run generate-pom -- --url https://staging.homey.app/enquiries/new
            # Crawls the DOM and generates a typed POM class
            ```

            ## Available npm Scripts

            | Script | Description |
            |---|---|
            | `npm test` | Run all tests |
            | `npm run test:headed` | Run with browser visible |
            | `npm run test:debug` | Debug mode |
            | `npm run test:ui` | Playwright UI mode |
            | `npm run test:enquiries` | Enquiry tests only |
            | `npm run test:conveyances` | Conveyance tests only |
            | `npm run test:kyc` | KYC workflow tests |
            | `npm run test:payments` | Stripe payment tests |
            | `npm run test:quotes` | Quote generation tests |
            | `npm run test:documents` | Document upload tests |
            | `npm run generate-pom` | Generate POM from live URL |
            | `npm run nl2test` | Convert natural language to test |
            | `npm run analyse-failures` | AI-powered failure analysis |

            ## Test Coverage

            | Area | Spec File | Scenarios |
            |---|---|---|
            | Authentication | login.spec.ts | Login, logout, invalid credentials |
            | Enquiry creation | create-enquiry.spec.ts | 4-step wizard, validation, draft save |
            | Action workflow | action-workflow.spec.ts | Status transitions, Turbo Streams |
            | Conveyance detail | conveyance-detail.spec.ts | Tabs, status badge, milestones |
            | KYC workflow | kyc-workflow.spec.ts | Initiate, status polling, completion |
            | Quote generation | quote-generator.spec.ts | Create quote, pricing, PDF preview |
            | Stripe payment | stripe-payment.spec.ts | Success, card decline, 3DS challenge |

            ## Hotwire / Turbo Notes

            Homey uses Hotwire Turbo Drive and Turbo Streams. Standard `waitForNavigation` is unreliable. Use these helpers from `BasePage`:

            ```typescript
            await this.waitForTurboStream('replace', '#flash-messages');
            await this.waitForTurboFrame('conveyance-status');
            await this.waitForPageLoad();
            ```

            ## Environment Variables

            Copy `.env.test.example` to `.env.test` and fill in:

            ```
            BASE_URL=https://staging.homey.app
            AGENT_EMAIL=agent@test.homey.app
            AGENT_PASSWORD=...
            SOLICITOR_EMAIL=solicitor@test.homey.app
            SOLICITOR_PASSWORD=...
            BUYER_EMAIL=buyer@test.homey.app
            BUYER_PASSWORD=...
            ADMIN_EMAIL=admin@test.homey.app
            ADMIN_PASSWORD=...
            OPENAI_API_KEY=sk-...          # For AI helpers (Phase 3+)
            CLEANUP_TEST_DATA=false        # Set true in CI to delete seeded data
            ```

            ## Roadmap

            | Phase | Status | Description |
            |---|---|---|
            | Phase 1 | Done | Core POM, auth helpers, base config, login spec |
            | Phase 2 | Done | Enquiry wizard, conveyance detail, quotes, KYC, Stripe |
            | Phase 3 | Done | AI self-healing, test data factory, NL2Test, CI analyser |
            | Phase 4 | Done | Document upload POM, KYC/quote/payment specs, API helper, test data seeding |
            | Phase 5 | Planned | Visual regression (Percy / Applitools) |
            | Phase 6 | Planned | API contract testing (Pact) |
            | Phase 7 | Planned | Performance baseline assertions |
