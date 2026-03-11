# OrbitEx — Required API Keys & Configuration

## Quick Start

1. Copy `config.example.js` → `config.js`
2. Fill in your API keys (see table below)
3. Add `<script src="config.js"></script>` in `index.html` before `src/app.jsx`
4. Open `index.html` in a browser or deploy to any static host

---

## API Keys Reference

| Key | Required | Purpose | Where to Get |
|-----|----------|---------|--------------|
| `OPENAI_API_KEY` | Optional | AI chat assistant (GPT-4o-mini) | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | Optional | AI chat fallback (Claude Haiku) | https://console.anthropic.com/account/keys |
| `DATADOG_API_KEY` | Optional | Real-time metrics ingestion | https://app.datadoghq.com/organization-settings/api-keys |
| `DATADOG_APP_KEY` | Optional | Datadog app-level access | Same page as above |
| `PROMETHEUS_URL` | Optional | Self-hosted metrics | Your Prometheus server URL |
| `KUBERNETES_API_URL` | Optional | Live cluster data | Your K8s API server |
| `KUBERNETES_TOKEN` | Optional | K8s authentication | `kubectl get secret` |
| `CLOUDWATCH_ACCESS_KEY` | Optional | AWS infrastructure metrics | https://console.aws.amazon.com/iam |
| `CLOUDWATCH_SECRET_KEY` | Optional | AWS authentication | Same as above |
| `GITHUB_TOKEN` | Optional | CI/CD pipeline data | https://github.com/settings/tokens |
| `GITHUB_ORG` | Optional | Your GitHub org name | Your GitHub organization |
| `SNYK_TOKEN` | Optional | Dependency vulnerability scanning | https://app.snyk.io/account |
| `PAGERDUTY_API_KEY` | Optional | Incident management | https://support.pagerduty.com/docs/api-access-keys |
| `ADSENSE_CLIENT` | **Required for ads** | Google AdSense monetization | https://www.google.com/adsense → Account info |
| `STRIPE_PUBLISHABLE_KEY` | Optional | Subscription billing | https://dashboard.stripe.com/apikeys |

---

## Without API Keys

OrbitEx runs **fully functional with realistic mock data** if no API keys are provided. This is perfect for:
- Demo and evaluation
- Development and testing
- Local use

The AI chat widget will use smart pre-programmed responses when no AI API key is configured.

---

## Google AdSense Setup

1. Apply for AdSense at https://www.google.com/adsense
2. Once approved, get your Publisher ID from **Account → Account info**
3. Add it to `config.js` as `ADSENSE_CLIENT: 'ca-pub-YOUR_ID_HERE'`
4. Create Ad Units in your AdSense dashboard
5. Copy the **Ad Slot IDs** and replace the placeholder values in `src/app.jsx`:
   - Line ~490: `<AdBanner slot="1234567890"` → replace with your slot ID
   - Line ~600: `<AdBanner slot="2345678901"` → replace with your slot ID  
   - Line ~680: `<AdBanner slot="3456789012"` → replace with your slot ID
   - Line ~730: `<AdBanner slot="4567890123"` → replace with your slot ID

**Note:** AdSense requires your site to be publicly accessible (not localhost) and approved. During development the ad slots will show a placeholder.

---

## Deployment

### Static hosting (recommended)
```bash
# Netlify
netlify deploy --dir . --prod

# Vercel
vercel --prod

# GitHub Pages
# Push to gh-pages branch
```

### Self-hosted
```bash
# Any web server works — it's pure static files
python3 -m http.server 3000
npx serve .
```

### With HTTPS (required for AdSense + API calls)
Use Cloudflare, Netlify, or Vercel for automatic HTTPS.

---

## Monetization Strategy

### Google AdSense (Display Ads)
- **Banner ad** below AI Activity Feed on Dashboard
- **Banner ad** at bottom of Foundation phase
- **Banner ad** at bottom of Cloud Native phase  
- **Large banner** on Landing page below features grid

### Subscription (Stripe)
Three tiers configured in Settings → Billing:
- **Starter**: Free (limited agents/clusters)
- **Growth**: $99/month (unlimited agents, 5 clusters)
- **Enterprise**: Custom (white-glove, SLA, on-premise)

To enable Stripe billing:
1. Add your `STRIPE_PUBLISHABLE_KEY` to `config.js`
2. Implement Stripe Checkout on your backend
3. Webhook your backend to update user plan in your database

---

## Security Notes

- ⚠️ Never expose secret keys in frontend code in production
- For production: proxy all API calls through your backend
- Use environment variables on your deployment platform
- Rotate keys regularly (SHIELD agent will remind you!)
