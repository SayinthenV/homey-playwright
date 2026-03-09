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
│   │   └── QuoteGeneratorPage.ts     # Fee-scale driven quote builder
│   ├── payments/
│   │   └── StripePaymentPage.ts      # Stripe Elements iframe handler
│   └── kyc/
│       └── KYCDashboardPage.ts       # Thirdfort KYC/AML management
├── helpers/
│   ├── AuthHelper.ts                 # JWT auth + storage state management
│   └── ThirdfortMocker.ts            # Simulate KYC webhook callbacks
├── fixtures/
│   └── auth.setup.ts                 # Global setup: authenticates all roles once
├── tests/
│   ├── auth/login.spec.ts            # 9 login tests
│   ├── enquiries/create-enquiry.spec.ts  # Wizard + list tests
│   └── actionCenter/action-workflow.spec.ts  # Actions + Turbo Stream tests
├── playwright.config.ts              # Multi-project (per role)
├── tsconfig.json
├── package.json
└── .env.test.example
```

## Multi-Role Architecture

Tests run in parallel with 4 pre-authenticated browser projects:

| Project | Role | Auth State | Suites |
|---|---|---|---|
| chromium-agent | Estate Agent | playwright/.auth/agent.json | auth, enquiries, conveyances |
| chromium-solicitor | Solicitor | playwright/.auth/solicitor.json | actionCenter, kyc, documents |
| chromium-buyer | Buyer | playwright/.auth/buyer.json | payments, quotes |
| chromium-admin | Admin | playwright/.auth/admin.json | admin, multiTenant |

The `setup` project runs once before all others — logs in as each role and saves browser storage state. Tests start already authenticated, making them 3-5x faster.

## Hotwire / Turbo Awareness

Homey uses Turbo Drive, Turbo Frames, and Turbo Streams (ActionCable WebSocket). All page objects use helpers from BasePage:

```typescript
await this.waitForTurboStream();              // any Turbo Stream response
await this.waitForTurboFrame('quote-breakdown'); // specific Turbo Frame
await this.waitForPageLoad();                 // Turbo Drive settle
```

## Stripe Test Cards

```typescript
import { STRIPE_TEST_CARDS } from './pages/payments/StripePaymentPage';

await paymentPage.completePayment(STRIPE_TEST_CARDS.SUCCESS);       // 4242...
await paymentPage.completePayment(STRIPE_TEST_CARDS.DECLINED);      // 4000...0002
await paymentPage.completePayment(STRIPE_TEST_CARDS.THREE_D_SECURE); // 3DS
```

## KYC Mocking (Thirdfort)

```typescript
const mocker = new ThirdfortMocker();
await mocker.simulateCheckPassed(checkId);   // webhook → status = passed
await mocker.simulateCheckFailed(checkId);   // webhook → status = failed
await mocker.simulateCheckExpired(checkId);  // webhook → status = expired
```

## Environment Variables

| Variable | Description |
|---|---|
| BASE_URL | Target URL (http://localhost:3000 or https://qa.homey.app) |
| TEST_AGENT_EMAIL / PASSWORD | Agent test credentials |
| TEST_SOLICITOR_EMAIL / PASSWORD | Solicitor test credentials |
| TEST_BUYER_EMAIL / PASSWORD | Buyer test credentials |
| TEST_ADMIN_EMAIL / PASSWORD | Admin test credentials |
| TEST_CONVEYANCE_ID | Seeded conveyance ID for Action Center tests |

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 | Complete | Core POM, auth, config, base tests |
| Phase 2 | Complete | Enquiry wizard, conveyance, quotes, KYC, Stripe, helpers |
| Phase 3 | Planned | AI self-healing selectors (Turbo-aware) |
| Phase 4 | Planned | AI test data factory (UK property data) |
| Phase 5 | Planned | Natural language to test generation |
| Phase 6 | Planned | CI failure analyser (screenshot + PR fix) |

## Tech Stack

- Playwright v1.44+ — browser automation
- - TypeScript 5.4+ — type safety
  - - Node.js — runtime
    - - dotenv — env variable management
     
      - Target: Homey (Rails 7.2, Hotwire/Turbo, Devise, Stripe, Thirdfort)
