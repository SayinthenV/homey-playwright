─────────────────────────────────────────────────────────────import path from 'path';

// Output directories
export const PACT_OUTPUT_DIR = path.resolve(__dirname, '../pacts');
export const PACT_LOG_DIR = path.resolve(__dirname, '../logs');

// Consumer / provider metadata
export const CONSUMER_NAME = 'HomeyUI';

export const PROVIDERS = {
    enquiries: 'HomeyEnquiriesAPI',
    conveyances: 'HomeyConveyancesAPI',
    payments: 'HomeyPaymentsAPI',
    kyc: 'HomeyKycAPI',
} as const;

export type ProviderName = (typeof PROVIDERS)[keyof typeof PROVIDERS];
  
  // Broker configuration
  export const pactBrokerConfig = {
    brokerUrl: process.env.PACT_BROKER_URL ?? '',
    brokerToken: process.env.PACT_BROKER_TOKEN ?? '',
    consumerVersion:
          process.env.PACT_CONSUMER_VERSION ?? process.env.npm_package_version ?? '0.0.1',
    publishVerificationResults: process.env.PACT_PUBLISH_RESULTS === 'true',
    tags: buildVersionTags(),
};

function buildVersionTags(): string[] {
    const branch = process.env.GITHUB_REF_NAME ?? process.env.GIT_BRANCH ?? 'local';
    const tags = [branch];
    if (branch === 'main') tags.push('latest');
    return tags;
}

// Jest / test runner settings
export const PACT_DEFAULT_TIMEOUT_MS = 30_000;

export const PACT_LOG_LEVEL = (process.env.PACT_LOG_LEVEL ?? 'ERROR') as
    | 'TRACE'
    | 'DEBUG'
    | 'INFO'
    | 'WARN'
    | 'ERROR'
    | 'OFF';

// Provider verification shared config
export function makeProviderVerifierConfig(providerName: ProviderName) {
    return {
          provider: providerName,
          providerBaseUrl: process.env.HOMEY_APP_URL ?? 'http://localhost:3000',
          pactBrokerUrl: pactBrokerConfig.brokerUrl,
          pactBrokerToken: pactBrokerConfig.brokerToken,
          publishVerificationResults: pactBrokerConfig.publishVerificationResults,
          providerVersion: process.env.HOMEY_PROVIDER_VERSION ?? '0.0.1',
          consumerVersionSelectors: [{ mainBranch: true }, { deployedOrReleased: true }],
          logLevel: PACT_LOG_LEVEL,
          stateHandlers: {},
    };
}────────────────–––––─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────—────────────────────────────────────────—
