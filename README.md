# homey-playwright

AI-Assisted Playwright POM Framework for the Homey conveyancing platform. Built with TypeScript, Playwright, and Hotwire/Turbo-aware helpers.

## Quick Start

```bash
git clone https://github.com/SayinthenV/homey-playwright.git
cd homey-playwright
npm install
npx playwright install chromium
cp .env.test.example .env.test   # Fill in credentials in .env.test
npx playwright test              # Runs against QA by default
```

## Environments

| ENV value | URL | When to use |
|---|---|---|
| `qa` (default) | `https://app.qa.homey.co.uk` | Daily regression, PRs |
| `preprod` | `https://app.preprod.homey.co.uk` | Pre-release sign-off |
| `reviewapp` | `https://homey-tv-86ev94a8a-ccl--6ewkll.herokuapp.com` | Feature branch review |
| `local` | `http://localhost:3000` | Local development |

```bash
ENV=qa npx playwright test
ENV=preprod npx playwright test
ENV=reviewapp npx playwright test tests/enquiries/
BASE_URL=https://my-branch.herokuapp.com npx playwright test  # one-off override
```

In CI — go to **Actions → Playwright Tests → Run workflow** and select the environment from the dropdown.

## Project Structure

```
homey-playwright/
├── pages/
│   ├── base/BasePage.ts
│   ├── auth/LoginPage.ts
│   ├── enquiries/  (EnquiryListPage, EnquiryDetailPage, NewEnquiryPage)
│   ├── conveyances/ (ConveyanceListPage, ConveyanceDetailPage)
│   ├── actionCenter/ActionCenterPage.ts
│   ├── quotes/QuoteGeneratorPage.ts
│   ├── payments/StripePaymentPage.ts
│   ├── kyc/KYCDashboardPage.ts
│   ├── documents/DocumentUploadPage.ts
│   └── visual/VisualBasePage.ts
├── tests/
│   ├── auth/login.spec.ts
│   ├── enquiries/create-enquiry.spec.ts
│   ├── conveyances/ (action-workflow, conveyance-detail)
│   ├── kyc/kyc-workflow.spec.ts
│   ├── quotes/quote-generator.spec.ts
│   ├── payments/stripe-payment.spec.ts
│   ├── visual/ (enquiry, conveyance, payment visual specs)
│   ├── accessibility/
│   │   └── accessibility.spec.ts   # WCAG 2.1 AA checks (Phase 8)
│   └── performance/
│       └── performance-baseline.spec.ts
├── contracts/
│   ├── enquiries.pact.spec.ts
│   ├── conveyances.pact.spec.ts
│   ├── payments.pact.spec.ts
│   └── pact.config.ts
├── helpers/
│   ├── AuthHelper.ts
│   ├── ThirdfortMocker.ts
│   ├── SelectorHealer.ts
│   ├── TestDataFactory.ts
│   ├── NLTestConverter.ts
│   ├── CIFailureAnalyser.ts
│   ├── ApiHelper.ts
│   ├── PercyHelper.ts
│   ├── AppliHelper.ts
│   ├── PactHelper.ts
│   ├── PerformanceHelper.ts
│   └── A11yHelper.ts              # axe-core WCAG helper (Phase 8)
├── ai/PageObjectGenerator.ts
├── fixtures/ (auth.setup.ts, test-data.setup.ts)
├── .github/workflows/playwright.yml
├── .env.test.example
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

## Authentication Strategy

Tests never log in through the UI during test runs. `fixtures/auth.setup.ts` runs once before all test projects and saves browser storage state for each role. The login page is `/auth` on all environments.

## Test Data Strategy

`fixtures/test-data.setup.ts` seeds reusable test data via the API and saves a `TestDataManifest` to `.test-data/manifest.json`.

## Visual Regression Testing (Phase 5)

```bash
ENV=qa PERCY_TOKEN=your_token npm run test:visual:percy
ENV=qa APPLITOOLS_API_KEY=your_key npm run test:visual
```

## API Contract Testing (Phase 6)

```bash
npm run test:contracts
npm run pact:publish
```

## Performance Baseline Assertions (Phase 7)

```bash
ENV=qa npm run test:performance
ENV=preprod npm run test:performance
```

### Default thresholds

| Metric | Threshold |
|---|---|
| LCP | ≤ 2500 ms |
| FCP | ≤ 1800 ms |
| TTFB | ≤ 800 ms |
| CLS | ≤ 0.1 |
| TBT | ≤ 200 ms |

## Accessibility Testing (Phase 8)

WCAG 2.1 Level AA compliance checks powered by [axe-core](https://github.com/dequelabs/axe-core) via `@axe-core/playwright`. No external SaaS required.

### Run locally

```bash
ENV=qa npm run test:a11y
ENV=preprod npm run test:a11y
```

### Coverage

| Page | Rule set | Notes |
|---|---|---|
| Login (/auth) | WCAG 2.1 AA | Form labels, contrast |
| Enquiry List | WCAG 2.1 AA + heading-order, landmark |  |
| Enquiry Detail | WCAG 2.1 AA | Manifest-driven |
| New Enquiry Wizard | WCAG 2.1 AA | Step 1 |
| Conveyance List | WCAG 2.1 AA + landmark regions |  |
| Conveyance Detail | WCAG 2.1 AA | Manifest-driven |
| Action Centre | WCAG 2.1 AA |  |
| Quote Generator | WCAG 2.1 AA |  |
| Payments | WCAG 2.1 AA | Stripe iframe excluded |
| KYC Dashboard | WCAG 2.1 AA | Thirdfort widget excluded |
| Document Upload | WCAG 2.1 AA |  |

### Using A11yHelper in tests

```typescript
import { A11yHelper } from '../../helpers/A11yHelper';

test('enquiry list is accessible', async ({ page }) => {
  const a11y = new A11yHelper(page);
  await page.goto('/enquiries');

  // Throws if critical/serious violations found
  await a11y.checkPage('Enquiry List');

  // Custom threshold and excludes
  await a11y.checkPage('Payments', {
    minimumImpact: 'moderate',
    exclude: ['iframe[name*="stripe"]'],
  });
});
```

### CI

The `accessibility-tests` job runs in parallel with functional tests on every push/PR. Violations at `serious` level or above fail the build.

## Available npm Scripts

| Script | Description |
|---|---|
| `npm test` | Run all functional tests |
| `npm run test:a11y` | WCAG 2.1 AA accessibility tests |
| `npm run test:visual` | Visual regression (Applitools) |
| `npm run test:visual:percy` | Visual regression (Percy) |
| `npm run test:contracts` | API contract tests (Pact) |
| `npm run pact:publish` | Publish pacts to Pact Broker |
| `npm run test:performance` | Performance baseline assertions |
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
| Contracts - Enquiries | contracts/enquiries.pact.spec.ts | List, get, create, validation, 404 |
| Contracts - Conveyances | contracts/conveyances.pact.spec.ts | List, get, quotes, status transitions |
| Contracts - Payments | contracts/payments.pact.spec.ts | Payment intent, confirm, webhooks, KYC |
| Performance | performance-baseline.spec.ts | CWV baselines across all pages |
| Accessibility | accessibility.spec.ts | WCAG 2.1 AA across all pages |

## Environment Variables

```bash
ENV=qa   # qa | preprod | reviewapp | local

TEST_AGENT_EMAIL=sale-34290@homey.co.uk
TEST_AGENT_PASSWORD=       # fill in locally or via GitHub secret
TEST_SOLICITOR_EMAIL=solicitor-27@homey.co.uk
TEST_SOLICITOR_PASSWORD=
TEST_BUYER_EMAIL=buyer@test.homey.co.uk
TEST_BUYER_PASSWORD=
TEST_SELLER_EMAIL=seller@test.homey.co.uk
TEST_SELLER_PASSWORD=
TEST_ADMIN_EMAIL=admin-16@homey.co.uk
TEST_ADMIN_PASSWORD=

OPENAI_API_KEY=sk-...
PERCY_TOKEN=...
APPLITOOLS_API_KEY=...
PACT_BROKER_BASE_URL=https://your-broker.pactflow.io
PACT_BROKER_TOKEN=...
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
| Phase 7 | Done | Performance baselines — CWV thresholds, PerformanceHelper, Turbo timing, CI job |
| Phase 8 | Done | Accessibility — WCAG 2.1 AA, axe-core, A11yHelper, CI job |
