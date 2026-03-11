# OrbitEx — Intelligent Cloud Operations Platform

> *Your cloud, thinking for itself.*

A fully production-ready, AI-native cloud operations platform built with React. No build step required — runs directly in any modern browser via CDN.

---

## 🚀 Quick Start

```bash
# Option 1: Open directly
open index.html

# Option 2: Local server
python3 -m http.server 3000
# then visit http://localhost:3000

# Option 3: npx serve
npx serve .
```

---

## 🏗️ Architecture

```
orbitex/
├── index.html              # Entry point (React + CDN deps)
├── config.example.js       # API key template — copy → config.js
├── src/
│   └── app.jsx             # Full React application (single file)
├── docs/
│   └── API_KEYS.md         # Detailed API key setup guide
└── README.md
```

---

## 📦 What's Included

### 5 Platform Phases

| Phase | Features |
|-------|----------|
| **Foundation** | Microservices registry, live event stream, architecture health, service mesh |
| **AI Agents** | 6 autonomous agents, real-time decisions, orchestration pipeline, learning metrics |
| **Cloud Native** | Multi-region K8s clusters, CI/CD pipeline, cost analytics, availability heatmap |
| **DevSecOps** | Threat detection, compliance automation, zero-trust, security pipeline |
| **Edge** | Global node map, latency tracking, edge AI workloads, sync status |

### Platform Features
- **Landing page** with hero, features, pricing
- **Real-time dashboard** with live metrics (updates every 3s)
- **AI chat widget** (connects to OpenAI or Anthropic if configured)
- **Notification center** with intelligent alerts
- **Settings & billing** with 3-tier pricing
- **Google AdSense** integration (4 ad placements)
- **Recharts** data visualizations throughout

---

## 💰 Monetization

1. **Google AdSense** — 4 banner placements (Dashboard, Foundation, Cloud, Landing)
2. **Subscriptions** — $0 Starter / $99 Growth / Custom Enterprise (Stripe-ready)

See `docs/API_KEYS.md` for full setup instructions.

---

## 🔌 API Integrations

All optional — app runs with mock data by default:

- **OpenAI / Anthropic** — AI chat assistant
- **Datadog** — Real metrics ingestion
- **Kubernetes** — Live cluster data
- **GitHub** — CI/CD pipeline data
- **Snyk** — Security scanning
- **PagerDuty** — Incident management
- **Stripe** — Subscription billing

---

## 🎨 Tech Stack

- **React 18** (via CDN, no build step)
- **Recharts** — Data visualization
- **Babel Standalone** — JSX in browser
- **Google Fonts** — Plus Jakarta Sans + JetBrains Mono + Fraunces
- **Google AdSense** — Monetization

---

## 🌍 Deploy

Works on any static host — Netlify, Vercel, GitHub Pages, Cloudflare Pages, or your own server.

```bash
# Netlify
netlify deploy --dir . --prod

# Vercel  
vercel --prod
```

AdSense requires HTTPS and a publicly accessible domain.
# orbiter
