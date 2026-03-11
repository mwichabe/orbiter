window.ORBITEX_CONFIG = {

    // ── AI / LLM Providers (for the OrbitEx AI chat widget) ──────────────
    // Get from: https://platform.openai.com/api-keys
    OPENAI_API_KEY: '',

    // Get from: https://console.anthropic.com/account/keys
    ANTHROPIC_API_KEY: '',

    // ── Observability & Metrics ───────────────────────────────────────────
    // Get from: https://app.datadoghq.com/organization-settings/api-keys
    DATADOG_API_KEY: '',
    DATADOG_APP_KEY: '',

    // Your self-hosted Prometheus endpoint (e.g. http://prometheus.internal:9090)
    PROMETHEUS_URL: '',

    // ── Cloud Infrastructure ──────────────────────────────────────────────
    // Kubernetes API server URL (e.g. https://your-cluster.example.com)
    KUBERNETES_API_URL: '',
    // Service account bearer token (kubectl get secret ... -o yaml)
    KUBERNETES_TOKEN: '',

    // AWS CloudWatch (for AWS-hosted infrastructure)
    // Get from: https://console.aws.amazon.com/iam/home#/users
    CLOUDWATCH_ACCESS_KEY: '',
    CLOUDWATCH_SECRET_KEY: '',
    CLOUDWATCH_REGION: 'us-east-1',

    // ── CI/CD & Source Control ────────────────────────────────────────────
    // Get from: https://github.com/settings/tokens (needs repo, workflow scopes)
    GITHUB_TOKEN: '',
    // Your GitHub organization name (e.g. 'my-company')
    GITHUB_ORG: '',

    // ── Security & Compliance ─────────────────────────────────────────────
    // Get from: https://app.snyk.io/account (for dependency scanning)
    SNYK_TOKEN: '',

    // ── Incident Management ───────────────────────────────────────────────
    // Get from: https://support.pagerduty.com/docs/api-access-keys
    PAGERDUTY_API_KEY: '',

    // ── Monetization ─────────────────────────────────────────────────────
    // Google AdSense publisher ID
    // Get from: https://www.google.com/adsense → Account → Account info
    // Format: ca-pub-XXXXXXXXXXXXXXXXX
    ADSENSE_CLIENT: 'ca-pub-XXXXXXXXXXXXXXXX',

    // Stripe publishable key (for subscription billing)
    // Get from: https://dashboard.stripe.com/apikeys
    STRIPE_PUBLISHABLE_KEY: '',

};
