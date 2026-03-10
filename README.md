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
│   ├── base/BasePage.ts                # Abstract base: nav, Turbo helpers, flash
│   ├── auth/LoginPage.ts               # Devise sign-in
│   ├── enquiries/
│   │   ├── EnquiryListPage.ts          # List with search/filter
│   │   ├── EnquiryDetailPage.ts        # Detail + convert to conveyance
│   │   └── NewEnquiryPage.ts           # 4-step wizard (Wicked gem)
│   ├── conveyances/
│   │   ├── ConveyanceListPage.ts       # Cases list
│   │   └── ConveyanceDetailPage.ts     # Detail + tabs (documents, payments, KYC)
│   ├── actionCenter/
│   │   └── ActionCenterPage.ts         # Live workflow (Turbo Streams)
│   ├── quotes/
│   │   └── QuoteGeneratorPage.ts       # Pricing engine + PDF preview
│   ├── payments/
│   │   └── StripePaymentPage.ts        # Stripe Elements iframe
│   ├── kyc/
│   │   └── KYCDashboardPage.ts         # Thirdfort KYC status
│   ├── documents/
│   │   └── DocumentUploadPage.ts       # Active Storage drag-drop + validation
│   └── visual/
│       └── VisualBasePage.ts           # Turbo-aware snapshot base (Phase 5)
├── tests/
│   ├── auth/login.spec.ts
│   ├── enquiries/create-enquiry.spec.ts
│   ├── conveyances/
│   │   ├── action-workflow.spec.ts
│   │   └── conveyance-detail.spec.ts
│   ├── kyc/kyc-workflow.spec.ts
│   ├── quotes/quote-generator.spec.ts
│   ├── payments/stripe-payment.spec.ts
│   ├── visual/
│   │   ├── enquiry-visual.spec.ts      # Enquiry list/detail/wizard snapshots
│   │   ├── conveyance-visual.spec.ts   # Conveyance + Action Centre snapshots
│   │   └── payment-visual.spec.ts      # Stripe, Quote, KYC snapshots
│   └── contracts/
│       ├── enquiries.pact.spec.ts      # Enquiries API consumer contracts (Phase 6)
│       ├── conveyances.pact.spec.ts    # Conveyances API consumer contracts (Phase 6)
│       └── payments.pact.spec.ts       # Payments API consumer contracts (Phase 6)
├── helpers/
│   ├── AuthHelper.ts                   # Pre-save browser storage state
│   ├── ThirdfortMocker.ts              # Webhook simulation
│   ├── SelectorHealer.ts               # AI self-healing selectors (Phase 3)
│   ├── TestDataFactory.ts              # UK property test data (Phase 3)
│   ├── NLTestConverter.ts              # NL to Playwright test (Phase 3)
│   ├── CIFailureAnalyser.ts            # AI failure analysis (Phase 3)
│   ├── ApiHelper.ts                    # REST API helper for fast setup/teardown
│   ├── PercyHelper.ts                  # Percy snapshot wrapper (Phase 5)
│   ├── AppliHelper.ts                  # Applitools Eyes wrapper (Phase 5)
│   └── PactHelper.ts                   # Pact consumer config + response shapes (Phase 6)
├── ai/
│   └── PageObjectGenerator.ts          # DOM crawler → POM generator (Phase 3)
├── contracts/
│   └── pact.config.ts                  # Jest + Pact configuration (Phase 6)
├── fixtures/
│   ├── auth.setup.ts                   # Global auth state fixture
│   └── test-data.setup.ts              # Global test data seeding fixture
├── .github/workflows/
│   └── playwright.yml                  # CI with functional + visual + contract jobs
├── .env.test.example
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

## Authentication Strategy

Tests never log in through the UI. `fixtures/auth.setup.ts` runs once per project and saves browser storage state for each role: agent, solicitor, buyer, admin.

## Test Data Strategy

`fixtures/test-data.setup.ts` seeds reusable test data via the API before any spec runs and saves a `TestDataManifest` to `.test-data/manifest.json`.

```typescript
import { loadManifest } from '../fixtures/test-data.setup';

test('uses seeded enquiry', async ({ page }) => {
  const manifest = loadManifest();
  test.skip(!manifest, 'No test data manifest found');
  const enquiry = manifest!.enquiries[0];
  await page.goto(`/enquiries/${enquiry.id}`);
});
```

## Visual Regression Testing (Phase 5)

Supports two providers — Percy and Applitools — both are no-ops without their env vars.

### Percy

```bash
# Install
npm install --save-dev @percy/cli @percy/playwright

# Run locally (requires PERCY_TOKEN)
PERCY_TOKEN=your_token npm run test:visual:percy

# In CI — runs automatically on PRs when PERCY_TOKEN secret is set
```

### Applitools Eyes (Ultrafast Grid)

```bash
# Install
npm install --save-dev @applitools/eyes-playwright

# Run locally (requires APPLITOOLS_API_KEY)
APPLITOOLS_API_KEY=your_key npm run test:visual
```

### Using in test files

```typescript
import { PercyHelper } from '../../helpers/PercyHelper';
import { AppliHelper } from '../../helpers/AppliHelper';

test('enquiry list visual', async ({ page }) => {
  const percy = new PercyHelper(page);
  const appli = new AppliHelper(page, { testName: 'Enquiry List' });

  await listPage.goto();
  await appli.open();

  // Full page Percy snapshot (masks timestamps automatically)
  await percy.snapshot({
    name: 'Enquiry List - Full Page',
    fullPage: true,
    hideSelectors: ['time', '[datetime]'],
  });

  // Responsive snapshot across 4 widths
  await percy.responsiveSnapshot('Enquiry List - Responsive');

  // Applitools cross-browser check
  await appli.checkWindow('Enquiry List', true);
  await appli.close(false);
});
```

### Visual test stabilisation

`VisualBasePage` and both helpers wait for Turbo Drive to settle, mask timestamps/avatars, and scroll to trigger lazy-loaded images before every snapshot. No flaky diffs from dynamic content.

### CI workflow

The workflow runs three parallel jobs after test data setup: `functional-tests`, `visual-percy`, and `visual-applitools`. Percy runs on all PRs automatically; Applitools runs when `APPLITOOLS_ENABLED=true` is set in repository variables.

## API Contract Testing (Phase 6)

Consumer-driven contract testing with [Pact](https://pact.io). The consumer (this repo) defines expectations; the Homey API (provider) verifies them via a Pact Broker.

### Install

```bash
npm install --save-dev @pact-foundation/pact jest ts-jest @types/jest
```

### Run locally

```bash
# Run all contract specs
npm run test:contracts

# Publish pacts to a broker (optional)
PACT_BROKER_BASE_URL=https://your-broker.pactflow.io \
PACT_BROKER_TOKEN=your_token \
PACT_CONSUMER_VERSION=$(git rev-parse HEAD) \
npm run pact:publish
```

### Using PactHelper

```typescript
import { pactConfig, homeyHeaders, enquiryShape, getMatchers } from '../../helpers/PactHelper';
import { PactV3 } from '@pact-foundation/pact';

const provider = new PactV3(pactConfig('HomeyFrontend', 'HomeyAPI'));

test('GET /enquiries returns paginated list', async () => {
  const M = await getMatchers();
  await provider
    .given('enquiries exist')
    .uponReceiving('a request for all enquiries')
    .withRequest({ method: 'GET', path: '/api/v1/enquiries', headers: homeyHeaders })
    .willRespondWith({
      status: 200,
      body: { data: M.eachLike(enquiryShape(M)) },
    })
    .executeTest(async (mockServer) => {
      const res = await fetch(`${mockServer.url}/api/v1/enquiries`, { headers: homeyHeaders });
      expect(res.status).toBe(200);
    });
});
```

### CI workflow

The `contract-tests` job runs in parallel with functional and visual jobs. Pacts are published to the Pact Broker automatically when `PACT_BROKER_BASE_URL` is configured as a repository secret.

## Available npm Scripts

| Script | Description |
|---|---|
| `npm test` | Run all tests |
| `npm run test:visual` | Visual regression (Applitools) |
| `npm run test:visual:percy` | Visual regression with Percy wrapper |
| `npm run test:contracts` | API contract tests (Pact) |
| `npm run pact:publish` | Publish pacts to Pact Broker |
| `npm run test:enquiries` | Enquiry tests |
| `npm run test:conveyances` | Conveyance tests |
| `npm run test:kyc` | KYC workflow tests |
| `npm run test:payments` | Stripe payment tests |
| `npm run test:quotes` | Quote generation tests |
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
| Stripe payment | stripe-payment.spec.ts | Success, decline, 3DS challenge |
| Visual - Enquiries | enquiry-visual.spec.ts | List, detail, wizard, responsive |
| Visual - Conveyances | conveyance-visual.spec.ts | List, detail tabs, action centre |
| Visual - Payments | payment-visual.spec.ts | Stripe, quotes, KYC dashboard |
| Contracts - Enquiries | enquiries.pact.spec.ts | List, get, create, validation, 404 |
| Contracts - Conveyances | conveyances.pact.spec.ts | List, get, quotes, status transitions |
| Contracts - Payments | payments.pact.spec.ts | Payment intent, confirm, webhooks |

## Environment Variables

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
OPENAI_API_KEY=sk-...
PERCY_TOKEN=...
APPLITOOLS_API_KEY=...
PACT_BROKER_BASE_URL=https://your-broker.pactflow.io
PACT_BROKER_TOKEN=...
CLEANUP_TEST_DATA=false
```

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 | Done | Core POM, auth helpers, base config, login spec |
| Phase 2 | Done | Enquiry wizard, conveyance detail, quotes, KYC, Stripe |
| Phase 3 | Done | AI self-healing, test data factory, NL2Test, CI analyser |
| Phase 4 | Done | Document upload POM, KYC/quote/payment specs, API helper, test data seeding |
| Phase 5 | Done | Visual regression — Percy + Applitools Ultrafast Grid, Turbo stabilisation |
| Phase 6 | Done | API contract testing — Pact consumer specs, PactHelper, CI job, Pact Broker publish |
| Phase 7 | Planned | Performance baseline assertions |
