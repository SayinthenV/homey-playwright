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
│   │   └── QuoteGeneratorPage.ts     # Quote builder
│   ├── payments/
│   │   └── StripePaymentPage.ts      # Stripe Elements iframe
│   └── kyc/
│       └── KYCDashboardPage.ts       # Thirdfort KYC integration
├── helpers/
│   ├── AuthHelper.ts                 # Devise auth + storage state
│   ├── ThirdfortMocker.ts            # KYC webhook simulation
│   ├── SelectorHealer.ts             # AI self-healing selectors (Phase 3)
│   ├── TestDataFactory.ts            # AI UK property test data (Phase 3)
│   ├── NLTestConverter.ts            # Natural language to test code (Phase 3)
│   └── CIFailureAnalyser.ts          # AI failure analysis + PR comments (Phase 3)
├── ai/
│   └── PageObjectGenerator.ts        # DOM crawler → POM generator (Phase 3)
├── fixtures/
│   └── auth.setup.ts                 # Multi-role auth state setup
├── tests/
│   ├── auth/login.spec.ts
│   ├── enquiries/
│   │   └── create-enquiry.spec.ts
│   ├── conveyances/
│   │   └── conveyance-detail.spec.ts
│   └── actionCenter/
│       └── action-workflow.spec.ts
├── .github/
│   └── workflows/
│       └── playwright.yml            # CI: parallel execution + AI failure analysis
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

## Multi-Role Architecture

| Role | Auth File | Project Key | Permissions |
|------|-----------|-------------|-------------|
| Agent | `.auth/agent.json` | `agent-chromium` | Enquiries, quotes, client management |
| Solicitor | `.auth/solicitor.json` | `solicitor-chromium` | Conveyances, tasks, documents, KYC |
| Buyer | `.auth/buyer.json` | `buyer-chromium` | Portal access, payment, document upload |
| Admin | `.auth/admin.json` | `admin-chromium` | Full system access |

## Hotwire / Turbo Patterns

Homey uses Rails + Hotwire (Turbo Streams + Turbo Frames). Standard `waitForNavigation()` is unreliable. Always use:

```typescript
// After a form submit or button click that triggers Turbo
await this.waitForTurboStream();

// For Turbo Frame updates (partial page refresh)
await this.waitForTurboFrame('enquiries-list');

// Full Turbo page load
await this.waitForPageLoad();
```

## Phase 3 AI Features

### SelectorHealer — Self-Healing Selectors

When a selector breaks after a UI update, `SelectorHealer` automatically detects the breakage, takes a screenshot, sends it to GPT-4o with the DOM context, and suggests new selectors:

```typescript
import { selectorHealer } from '../helpers/SelectorHealer';

// Instead of: page.locator('[data-testid="submit-btn"]')
const { locator, wasHealed } = await selectorHealer.heal(
  page,
  '[data-testid="submit-btn"]',
  'Submit enquiry button',
  'NewEnquiryPage'
);
await locator.click();
if (wasHealed) console.log('Selector was auto-healed!');

// Generate a patch report
console.log(selectorHealer.generateReport());
```

Patches are cached in `ai/selector-patches.json` so healed selectors persist across runs.

### TestDataFactory — UK Property Test Data

Generates realistic, valid UK conveyancing test data. Works without OpenAI (static fallback) and with OpenAI for scenario-specific data:

```typescript
import { testDataFactory } from '../helpers/TestDataFactory';

// Static generation (no API needed)
const enquiry = testDataFactory.enquiry();
console.log(enquiry.buyer.fullName);       // "James Smith"
console.log(enquiry.property.address.postcode); // "SW14 7AB"
console.log(TestDataFactory.formatPrice(enquiry.property.agreedPrice)); // "£350,000"

// AI-enhanced generation (requires OPENAI_API_KEY)
const aiEnquiry = await testDataFactory.enquiryWithAI('first-time buyer purchasing a flat in London');

// Specific data generators
const buyer = testDataFactory.person();
const address = testDataFactory.address();
const bankAccount = testDataFactory.bankAccount();
```

### NLTestConverter — Natural Language to Test Code

Convert plain English into executable Playwright TypeScript tests, mapped to the Homey POM library:

```typescript
import { NLTestConverter } from '../helpers/NLTestConverter';

const converter = new NLTestConverter();

// Single test
const result = await converter.convert(
  'Login as solicitor, open the first conveyance, complete all pending tasks, verify action center updates',
  { role: 'solicitor', outputPath: 'tests/generated/complete-tasks.spec.ts' }
);
console.log(result.code);        // Full TypeScript spec file
console.log(result.steps);       // Extracted test steps
console.log(result.warnings);    // Validation warnings

// Full test suite
await converter.generateSuite(
  'Enquiry Management',
  'All enquiry list and detail operations for agents',
  { role: 'agent', outputPath: 'tests/generated/enquiry-suite.spec.ts' }
);
```

Or use the CLI directly:
```bash
npx ts-node helpers/NLTestConverter.ts "Create new enquiry for 45 Oak Street, verify it appears in list"
```

### CIFailureAnalyser — AI Failure Investigation

Automatically analyses test failures using GPT-4o vision (screenshot + error + stack trace):

```typescript
import { CIFailureAnalyser } from '../helpers/CIFailureAnalyser';

const analyser = new CIFailureAnalyser();

const analysis = await analyser.analyse({
  testTitle: 'should create new enquiry',
  errorMessage: 'TimeoutError: locator not found after 30000ms',
  screenshotPath: 'test-results/enquiry-create/screenshot.png',
  retryCount: 2,
});

console.log(analysis.category);      // 'selector_broken'
console.log(analysis.rootCause);     // '2-3 sentence explanation'
console.log(analysis.suggestedFix);  // Actionable fix
console.log(analysis.isFlaky);       // true/false
console.log(analysis.codeChange);    // TypeScript fix snippet
```

Failure categories: `selector_broken`, `timing_turbo`, `auth_expired`, `stripe_iframe`, `thirdfort_webhook`, `network_error`, `assertion_failed`, `test_data_invalid`, `environment_config`, `genuine_bug`, `unknown`

### PageObjectGenerator — Auto-Generate POMs from Live Pages

Crawl a live URL and auto-generate a typed TypeScript Page Object class:

```bash
# Generate a POM for any Homey page
npx ts-node ai/PageObjectGenerator.ts \
  --url http://localhost:3000/enquiries \
  --name EnquiryListPage \
  --output pages/enquiries/EnquiryListPage.ts \
  --role agent

# With description
npx ts-node ai/PageObjectGenerator.ts \
  --url http://localhost:3000/conveyances/123 \
  --name ConveyanceDetailPage \
  --output pages/conveyances/ConveyanceDetailPage.ts \
  --role solicitor \
  --description "Conveyance detail with pipeline stages and task management"
```

## Stripe Test Cards

| Scenario | Card Number | Expiry | CVC |
|----------|-------------|--------|-----|
| Success | `4242 4242 4242 4242` | `12/28` | `123` |
| Decline | `4000 0000 0000 0002` | `12/28` | `123` |
| 3D Secure | `4000 0025 0000 3155` | `12/28` | `123` |
| Insufficient funds | `4000 0000 0000 9995` | `12/28` | `123` |

## Thirdfort KYC Mocking

```typescript
import { ThirdfortMocker } from '../helpers/ThirdfortMocker';

const mocker = new ThirdfortMocker(page);

// Simulate a passed KYC check
await mocker.simulateWebhook({ status: 'passed', buyerEmail: 'buyer@test.com' });

// Simulate a failed check
await mocker.simulateWebhook({ status: 'failed', reason: 'document_expired' });
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BASE_URL` | Homey application URL | Yes |
| `TEST_AGENT_EMAIL` | Agent test user email | Yes |
| `TEST_AGENT_PASSWORD` | Agent test user password | Yes |
| `TEST_SOLICITOR_EMAIL` | Solicitor test user email | Yes |
| `TEST_SOLICITOR_PASSWORD` | Solicitor test user password | Yes |
| `TEST_BUYER_EMAIL` | Buyer test user email | Yes |
| `TEST_BUYER_PASSWORD` | Buyer test user password | Yes |
| `TEST_ADMIN_EMAIL` | Admin test user email | Yes |
| `TEST_ADMIN_PASSWORD` | Admin test user password | Yes |
| `STRIPE_TEST_KEY` | Stripe test publishable key | For payment tests |
| `THIRDFORT_TEST_WEBHOOK_SECRET` | Thirdfort webhook secret | For KYC tests |
| `OPENAI_API_KEY` | OpenAI API key | For AI features (Phase 3) |

## CI / GitHub Actions

The `.github/workflows/playwright.yml` pipeline:

1. **Setup Auth** — Creates browser storage states for all 4 roles, caches them
2. 2. **Test (parallel)** — Runs all 4 role projects simultaneously across 4 Ubuntu runners
   3. 3. **AI Failure Analysis** — On PR failures, analyses each failure with GPT-4o and posts a formatted comment
      4. 4. **Merge Reports** — Combines all Playwright HTML reports, uploads as artifact, posts job summary
        
         5. Configure secrets in your repo: `HOMEY_STAGING_URL`, `TEST_AGENT_EMAIL`, `TEST_AGENT_PASSWORD`, etc.
        
         6. Manual trigger with specific suite:
         7. ```
            Actions → Playwright Tests → Run workflow → test_suite: "tests/enquiries/"
            ```

            ## Roadmap

            | Phase | Status | Description |
            |-------|--------|-------------|
            | Phase 1 | Done | Core POM, auth, config, base tests |
            | Phase 2 | Done | Enquiry wizard, conveyance detail, KYC, Stripe, quotes |
            | Phase 3 | Done | AI self-healing, test data factory, NL2Test, CI failure analyser, POM generator |
            | Phase 4 | Planned | Visual regression testing with Percy/Applitools |
            | Phase 5 | Planned | API contract testing (Homey REST endpoints) |
            | Phase 6 | Planned | Performance baseline assertions |

            ## Tech Stack

            - **Playwright** 1.48 — browser automation
            - - **TypeScript** 5.x — type safety throughout
              - - **Hotwire/Turbo** — Turbo-aware wait helpers (custom)
                - - **OpenAI GPT-4o** — vision-based healing, test generation, failure analysis
                  - - **Stripe Elements** — FrameLocator-based payment testing
                    - - **Thirdfort** — webhook mocking for KYC flows
                      - - **GitHub Actions** — parallel CI with auth state caching
                        - 
