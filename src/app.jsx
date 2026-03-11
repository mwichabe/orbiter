const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;
const {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadialBarChart, RadialBar
} = Recharts;

// ── Config (API keys injected from env or config.js) ──
const CONFIG = window.ORBITEX_CONFIG || {
  OPENAI_API_KEY: '',           // For AI assistant chat
  ANTHROPIC_API_KEY: '',        // Alternative AI provider
  DATADOG_API_KEY: '',          // Real metrics ingestion
  DATADOG_APP_KEY: '',
  PROMETHEUS_URL: '',           // Self-hosted metrics
  KUBERNETES_API_URL: '',       // K8s API server endpoint
  KUBERNETES_TOKEN: '',         // Bearer token
  PAGERDUTY_API_KEY: '',        // Incident management
  GITHUB_TOKEN: '',             // CI/CD pipeline data
  GITHUB_ORG: '',
  SNYK_TOKEN: '',               // Security scanning
  CLOUDWATCH_ACCESS_KEY: '',    // AWS metrics
  CLOUDWATCH_SECRET_KEY: '',
  CLOUDWATCH_REGION: 'us-east-1',
  ADSENSE_CLIENT: 'ca-pub-XXXXXXXXXXXXXXXX',
  STRIPE_PUBLISHABLE_KEY: '',   // Monetization
};

// ── App Context ──
const AppCtx = createContext(null);
function useApp() { return useContext(AppCtx); }

// ── Utility helpers ──
const fmt = {
  num: (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n),
  pct: (n) => n.toFixed(1) + '%',
  ms: (n) => n < 1000 ? Math.round(n) + 'ms' : (n / 1000).toFixed(2) + 's',
  ts: () => new Date().toLocaleTimeString('en-US', { hour12: false }),
};

// Generate realistic time-series data
function genSeries(points, base, variance, trend = 0) {
  return Array.from({ length: points }, (_, i) => ({
    t: `${String(i).padStart(2, '0')}:00`,
    v: Math.max(0, base + trend * i + (Math.random() - 0.5) * variance * 2)
  }));
}

// ── Real API calls (fall back to mock if keys missing) ──
const API = {
  async getMetrics() {
    if (CONFIG.DATADOG_API_KEY && CONFIG.DATADOG_APP_KEY) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const res = await fetch(`https://api.datadoghq.com/api/v1/query?from=${now - 3600}&to=${now}&query=avg:system.cpu.user{*}`, {
          headers: { 'DD-API-KEY': CONFIG.DATADOG_API_KEY, 'DD-APPLICATION-KEY': CONFIG.DATADOG_APP_KEY }
        });
        const data = await res.json();
        if (data.series?.length) return { cpu: data.series[0].pointlist.slice(-1)[0][1] };
      } catch (e) { }
    }
    // Mock fallback
    return {
      requestsTotal: 3_284_921 + Math.floor(Math.random() * 1000),
      activeSessions: 18_432 + Math.floor(Math.random() * 200 - 100),
      p99Latency: 14 + Math.random() * 8,
      uptime: 99.97,
      errorRate: 0.12 + Math.random() * 0.05,
      throughput: 8420 + Math.floor(Math.random() * 200),
      cpuAvg: 62 + Math.random() * 10,
      memAvg: 54 + Math.random() * 6,
    };
  },

  async askAI(message, history = []) {
    // Try OpenAI first
    if (CONFIG.OPENAI_API_KEY) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are OrbitEx AI, an intelligent cloud operations assistant. Be concise, technical, and helpful. Analyze infrastructure, suggest optimizations, and answer DevOps questions.' },
              ...history,
              { role: 'user', content: message }
            ],
            max_tokens: 300,
          })
        });
        const data = await res.json();
        if (data.choices?.[0]) return data.choices[0].message.content;
      } catch (e) { }
    }
    // Try Anthropic
    if (CONFIG.ANTHROPIC_API_KEY) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system: 'You are OrbitEx AI, an intelligent cloud operations assistant. Be concise and technical.',
            messages: [...history, { role: 'user', content: message }]
          })
        });
        const data = await res.json();
        if (data.content?.[0]) return data.content[0].text;
      } catch (e) { }
    }
    // Smart mock responses
    const q = message.toLowerCase();
    if (q.includes('scale') || q.includes('cpu')) return 'CPU is trending at 68% on EU-WEST-2. I recommend scaling to 3 additional pods. Expected cost: +$12/day, latency improvement: ~22%.';
    if (q.includes('secur') || q.includes('threat')) return 'Current threat score: LOW (12/100). SHIELD agent blocked 23 intrusion attempts today. Recommend rotating the 3 API keys flagged as >90 days old.';
    if (q.includes('deploy') || q.includes('release')) return 'Pipeline FLUX-v2.4.1 passed all 47 checks. Canary at 15% traffic shows p99=12ms vs baseline 16ms. Safe to promote to 100%.';
    if (q.includes('cost') || q.includes('spend')) return 'This month you\'re tracking $18,420 vs $21,200 budget — 13% under. Spot instance migration saved $6.1K. Next opportunity: migrate dev clusters to ARM64 for ~30% savings.';
    if (q.includes('error') || q.includes('incident')) return 'Error rate is 0.14% — within SLO. LENS agent detected a database connection pool saturation on US-EAST-1 at 09:47, auto-remediated in 23 seconds.';
    return 'I\'ve analyzed your infrastructure state. Everything looks healthy. Want me to run a deeper analysis on any specific service, cluster, or security domain?';
  },

  async getGitHubPipelines() {
    if (CONFIG.GITHUB_TOKEN && CONFIG.GITHUB_ORG) {
      try {
        const res = await fetch(`https://api.github.com/orgs/${CONFIG.GITHUB_ORG}/actions/runs?per_page=5`, {
          headers: { Authorization: `Bearer ${CONFIG.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });
        const data = await res.json();
        if (data.workflow_runs) {
          return data.workflow_runs.map(r => ({
            id: r.id, name: r.name, status: r.conclusion || r.status,
            branch: r.head_branch, time: new Date(r.created_at).toLocaleTimeString()
          }));
        }
      } catch (e) { }
    }
    return [
      { id: 1, name: 'api-service — main', status: 'success', branch: 'main', time: '09:18', duration: '2m 34s', tests: '847 passed' },
      { id: 2, name: 'frontend — feature/dash', status: 'success', branch: 'feature/dash', time: '09:11', duration: '1m 58s', tests: '312 passed' },
      { id: 3, name: 'ml-pipeline — release', status: 'in_progress', branch: 'release/v2.4', time: '09:22', duration: '4m 12s...', tests: 'running' },
      { id: 4, name: 'infra-terraform — main', status: 'success', branch: 'main', time: '08:55', duration: '5m 01s', tests: 'plan applied' },
      { id: 5, name: 'auth-service — hotfix', status: 'failure', branch: 'hotfix/session', time: '08:43', duration: '1m 12s', tests: '3 failed' },
    ];
  },
};

// ── SVG Icons ──
const Icon = {
  Dashboard: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="7" height="7" rx="1.5" /><rect x="11" y="2" width="7" height="7" rx="1.5" /><rect x="2" y="11" width="7" height="7" rx="1.5" /><rect x="11" y="11" width="7" height="7" rx="1.5" /></svg>,
  Layers: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="10,2 18,6.5 10,11 2,6.5" /><polyline points="2,10 10,14.5 18,10" /><polyline points="2,14 10,18.5 18,14" /></svg>,
  Bot: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="7" width="12" height="9" rx="2" /><path d="M8 11h.01M12 11h.01" /><path d="M7 7V5a3 3 0 016 0v2" /><path d="M10 4V2" /></svg>,
  Cloud: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M16.5 13.5a3.5 3.5 0 000-7 3.49 3.49 0 00-.5.04A5 5 0 005.5 9.5a3.5 3.5 0 000 7h11z" /></svg>,
  Shield: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 2L3 5.5v5c0 4.17 3 7.5 7 8 4-0.5 7-3.83 7-8v-5L10 2z" /></svg>,
  Zap: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="13,2 4,11 9,11 7,18 16,9 11,9" /></svg>,
  Settings: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="3" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" /></svg>,
  Bell: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z" /><path d="M8 16a2 2 0 004 0" /></svg>,
  Search: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="9" r="6" /><path d="M14 14l4 4" /></svg>,
  TrendUp: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="2,14 7,9 11,13 18,6" /><polyline points="14,6 18,6 18,10" /></svg>,
  TrendDown: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="2,6 7,11 11,7 18,14" /><polyline points="14,14 18,14 18,10" /></svg>,
  Play: (p) => <svg {...p} viewBox="0 0 20 20" fill="currentColor"><path d="M5 4l12 6-12 6z" /></svg>,
  Pause: (p) => <svg {...p} viewBox="0 0 20 20" fill="currentColor"><rect x="4" y="4" width="4" height="12" rx="1" /><rect x="12" y="4" width="4" height="12" rx="1" /></svg>,
  Globe: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="8" /><path d="M2 10h16M10 2c-2 2.5-3 5-3 8s1 5.5 3 8M10 2c2 2.5 3 5 3 8s-1 5.5-3 8" /></svg>,
  X: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l12 12M16 4L4 16" /></svg>,
  Check: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 10l5 5 8-8" /></svg>,
  Refresh: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 8A8 8 0 103 12" /><path d="M17 4v4h-4" /></svg>,
  ExternalLink: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11 3h6v6M17 3l-9 9M9 5H4a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-5" /></svg>,
  Send: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M18 2L11 9M18 2L12 18l-4-7-7-4 18-5z" /></svg>,
  Home: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10L10 3l7 7" /><path d="M5 8v9a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8" /></svg>,
  DollarSign: (p) => <svg {...p} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 2v16M7 5h4.5a2.5 2.5 0 010 5H7m0 0h5a2.5 2.5 0 010 5H7" /></svg>,
};

// ══════════════════════════
//  AdSense Banner Component
// ══════════════════════════
function AdBanner({ slot, format = 'auto', className = '' }) {
  const ref = useRef();
  useEffect(() => {
    try {
      if (window.adsbygoogle && ref.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) { }
  }, []);
  return (
    <div className={`ad-strip ${className}`}>
      <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }}
        data-ad-client={CONFIG.ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true" />
      {!CONFIG.ADSENSE_CLIENT.includes('XXXXXX') ? null : (
        <div className="ad-label">📢 Advertisement — Configure your AdSense publisher ID</div>
      )}
    </div>
  );
}

// ══════════════════════════
//  AI Chat Widget
// ══════════════════════════
function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: 'Hi! I\'m OrbitEx AI. Ask me anything about your infrastructure, security, deployments, or cost optimization.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgsRef = useRef();

  useEffect(() => { if (msgsRef.current) msgsRef.current.scrollTop = 9999; }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const txt = input;
    setInput('');
    setMsgs(m => [...m, { role: 'usr', text: txt }]);
    setLoading(true);
    const history = msgs.slice(-6).map(m => ({ role: m.role === 'usr' ? 'user' : 'assistant', content: m.text }));
    const reply = await API.askAI(txt, history);
    setMsgs(m => [...m, { role: 'bot', text: reply }]);
    setLoading(false);
  };

  return (
    <div className="ai-chat-fab">
      {open && (
        <div className="ai-panel fade-in">
          <div className="ai-panel-head">
            <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.Bot width={18} height={18} style={{ color: 'white' }} />
            </div>
            <div>
              <div className="ai-panel-title">OrbitEx AI</div>
              <div className="ai-panel-sub">Powered by GPT-4 / Claude</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
              <Icon.X width={16} height={16} />
            </button>
          </div>
          <div className="ai-msgs" ref={msgsRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>{m.text}</div>
            ))}
            {loading && <div className="ai-msg bot" style={{ color: 'var(--c-text3)' }}>Thinking…</div>}
          </div>
          <div className="ai-input-row">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about infra, security, cost…" />
            <button className="ai-send" onClick={send}><Icon.Send width={14} height={14} /></button>
          </div>
        </div>
      )}
      <button className="ai-fab-btn" onClick={() => setOpen(o => !o)}>
        <Icon.Bot width={22} height={22} />
      </button>
    </div>
  );
}

// ══════════════════════════
//  Notification Panel
// ══════════════════════════
const NOTIFICATIONS = [
  { id: 1, type: 'warn', icon: '⚠️', title: 'EU-WEST-2 CPU at 81%', sub: '2 minutes ago · Auto-scaling triggered', color: '#fffbeb', border: '#fcd34d' },
  { id: 2, type: 'ok', icon: '✅', title: 'Deploy v2.4.1 succeeded', sub: '14 minutes ago · 47 tests passed', color: '#ecfdf5', border: '#6ee7b7' },
  { id: 3, type: 'err', icon: '🚨', title: 'Unusual API access detected', sub: '31 minutes ago · SHIELD investigating', color: '#fef2f2', border: '#fca5a5' },
  { id: 4, type: 'info', icon: '📊', title: 'Weekly cost report ready', sub: '1 hour ago · $18,420 / $21,200 budget', color: '#eff4ff', border: '#93c5fd' },
];

function NotifPanel({ onClose }) {
  return (
    <div className="notif-panel fade-in">
      <div className="notif-header">
        Notifications
        <span style={{ fontSize: 11, color: 'var(--c-text3)', fontWeight: 400, cursor: 'pointer' }} onClick={onClose}>Mark all read</span>
      </div>
      {NOTIFICATIONS.map(n => (
        <div key={n.id} className="notif-item">
          <div className="notif-icon-wrap" style={{ background: n.color, border: `1px solid ${n.border}` }}>
            <span style={{ fontSize: 14 }}>{n.icon}</span>
          </div>
          <div>
            <div className="notif-title">{n.title}</div>
            <div className="notif-sub">{n.sub}</div>
          </div>
        </div>
      ))}
      <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, color: 'var(--c-accent)', cursor: 'pointer', fontWeight: 600 }}>
        View all alerts →
      </div>
    </div>
  );
}

// ══════════════════════════
//  Stat Card
// ══════════════════════════
function StatCard({ label, value, sub, change, changeType, color, icon, suffix = '' }) {
  return (
    <div className="stat-card fade-in" style={{ '--stat-color': color }}>
      {icon && (
        <div className="stat-icon" style={{ background: color + '18' }}>
          {React.createElement(icon, { width: 18, height: 18, style: { color } })}
        </div>
      )}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}{suffix}</div>
      {change && (
        <div className={`stat-change ${changeType}`}>
          {changeType === 'up' ? <Icon.TrendUp width={12} height={12} /> : changeType === 'down' ? <Icon.TrendDown width={12} height={12} /> : null}
          {change}
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════
//  DASHBOARD
// ══════════════════════════
function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [series, setSeries] = useState({ req: [], err: [], latency: [] });

  useEffect(() => {
    const load = async () => {
      const m = await API.getMetrics();
      setMetrics(m);
    };
    load();
    const iv = setInterval(load, 3000);

    // Build chart series
    setSeries({
      req: genSeries(24, 8000, 2000, 80),
      err: genSeries(24, 0.15, 0.08),
      latency: genSeries(24, 18, 6),
    });
    return () => clearInterval(iv);
  }, []);

  if (!metrics) return <div style={{ padding: 32, color: 'var(--c-text3)' }}>Loading metrics…</div>;

  const CLUSTERS = [
    { name: 'US-EAST-1', pods: 48, cpu: 67, mem: 54, status: 'healthy', region: '🇺🇸' },
    { name: 'EU-WEST-2', pods: 36, cpu: 81, mem: 72, status: 'warn', region: '🇬🇧' },
    { name: 'AP-SOUTH-1', pods: 24, cpu: 43, mem: 39, status: 'healthy', region: '🇸🇬' },
  ];

  return (
    <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div className="stat-grid">
        <StatCard label="Total Requests" value={fmt.num(metrics.requestsTotal)} change="+8.4% vs yesterday" changeType="up" color="#2563eb" icon={Icon.TrendUp} />
        <StatCard label="Active Sessions" value={fmt.num(metrics.activeSessions)} change={`P99: ${fmt.ms(metrics.p99Latency)}`} changeType="neutral" color="#059669" icon={Icon.Globe} />
        <StatCard label="Error Rate" value={fmt.pct(metrics.errorRate)} change="SLO: < 0.5%" changeType={metrics.errorRate < 0.5 ? 'up' : 'down'} color={metrics.errorRate < 0.5 ? '#059669' : '#dc2626'} icon={Icon.Shield} />
        <StatCard label="Uptime" value={fmt.pct(metrics.uptime)} change="47-day streak" changeType="up" color="#7c3aed" icon={Icon.Layers} />
      </div>

      {/* Charts Row */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Request Volume <span className="live-indicator"><span className="live-dot" />LIVE</span></div>
            <span className="badge badge-blue">24h</span>
          </div>
          <div className="chart-wrap" style={{ height: 160 }}>
            <ResponsiveContainer>
              <AreaChart data={series.req} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f4f9" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#8994b0' }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: '#8994b0' }} tickFormatter={v => fmt.num(v)} />
                <Tooltip formatter={v => [fmt.num(v), 'Requests']} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2} fill="url(#gReq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">P99 Latency</div>
            <span className="badge badge-green">Target: 50ms</span>
          </div>
          <div className="chart-wrap" style={{ height: 160 }}>
            <ResponsiveContainer>
              <LineChart data={series.latency} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f4f9" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#8994b0' }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: '#8994b0' }} tickFormatter={v => v + 'ms'} />
                <Tooltip formatter={v => [fmt.ms(v), 'Latency']} contentStyle={{ fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="v" stroke="#059669" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={() => 50} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cluster Status + AdSense */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Cluster Health</div>
            <button className="btn btn-secondary btn-sm">View All</button>
          </div>
          {CLUSTERS.map(c => (
            <div key={c.name} style={{ padding: '12px 0', borderBottom: '1px solid var(--c-border)' }} className="flex items-center gap-3">
              <span style={{ fontSize: 18 }}>{c.region}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="font-bold text-sm">{c.name}</span>
                  <span className={`badge ${c.status === 'healthy' ? 'badge-green' : 'badge-amber'}`}>{c.status === 'healthy' ? '● Healthy' : '⚠ High Load'}</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span className="text-xs text-muted">CPU</span>
                      <span className="text-xs font-mono">{c.cpu}%</span>
                    </div>
                    <div className="prog"><div className="prog-fill" style={{ width: c.cpu + '%', background: c.cpu > 75 ? 'var(--c-amber)' : 'var(--c-accent)' }} /></div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span className="text-xs text-muted">MEM</span>
                      <span className="text-xs font-mono">{c.mem}%</span>
                    </div>
                    <div className="prog"><div className="prog-fill" style={{ width: c.mem + '%' }} /></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <div className="card-title">AI Activity Feed</div>
              <span className="badge badge-purple">6 agents</span>
            </div>
            {[
              { a: 'ARIA', msg: 'Scaled EU-WEST-2 ×2 pods', t: '2m', ok: true },
              { a: 'SHIELD', msg: 'Blocked 3 intrusion attempts', t: '8m', ok: true },
              { a: 'NOVA', msg: 'Churn risk cluster #7 flagged', t: '15m', warn: true },
              { a: 'FLUX', msg: 'Canary v2.4.1 → 25% traffic', t: '18m', ok: true },
              { a: 'LENS', msg: 'Trace anomaly auto-resolved', t: '31m', ok: true },
            ].map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: e.ok ? 'var(--c-green-light)' : 'var(--c-amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: e.ok ? 'var(--c-green)' : 'var(--c-amber)', fontWeight: 700 }}>{e.a[0]}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span className="font-bold text-xs">{e.a}</span>
                  <span style={{ fontSize: 12, color: 'var(--c-text2)', marginLeft: 6 }}>{e.msg}</span>
                </div>
                <span className="text-xs text-muted">{e.t} ago</span>
              </div>
            ))}
          </div>
          <AdBanner slot="1234567890" className="fade-in" />
        </div>
      </div>

      {/* Resource usage radial */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Platform Resource Usage</div>
          <div className="live-indicator"><span className="live-dot" />Real-time</div>
        </div>
        <div className="grid-4">
          {[
            { label: 'CPU (avg)', val: Math.round(metrics.cpuAvg), color: '#2563eb' },
            { label: 'Memory', val: Math.round(metrics.memAvg), color: '#7c3aed' },
            { label: 'Network I/O', val: 38, color: '#0891b2' },
            { label: 'Disk I/O', val: 22, color: '#059669' },
          ].map(r => (
            <div key={r.label} style={{ textAlign: 'center' }}>
              <ResponsiveContainer width="100%" height={100}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={10} data={[{ value: r.val, fill: r.color }]}>
                  <RadialBar dataKey="value" cornerRadius={5} background={{ fill: '#f1f4f9' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="font-mono font-bold" style={{ fontSize: 20, color: r.color, marginTop: -8 }}>{r.val}%</div>
              <div className="text-xs text-muted" style={{ marginTop: 3 }}>{r.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════
//  PHASE 1: Foundation
// ══════════════════════════
function Foundation() {
  const [events, setEvents] = useState([
    { cls: 't-ok', txt: '✓ [09:14:02] auth.login → user.session.created (3ms)' },
    { cls: 't-cmd', txt: '→ [09:14:03] user.profile → ai.recommendation.trigger' },
    { cls: 't-ok', txt: '✓ [09:14:04] ai.inference → response.streamed (11ms)' },
    { cls: 't-hi', txt: '→ [09:14:05] edge.sync → cache.warmed (EU-LON-1)' },
    { cls: 't-warn', txt: '⚠ [09:14:07] recommendation-svc → retry #1 (timeout 5s)' },
    { cls: 't-ok', txt: '✓ [09:14:09] recommendation-svc → retry success' },
  ]);
  const logRef = useRef();

  const addEvent = () => {
    const pool = [
      { cls: 't-ok', txt: `✓ [${fmt.ts()}] payment.processed → ledger.updated (4ms)` },
      { cls: 't-hi', txt: `→ [${fmt.ts()}] ai.model.retrained → v5.1.3 deployed` },
      { cls: 't-warn', txt: `⚠ [${fmt.ts()}] cache.eviction → db.fallback (US-EAST-1)` },
      { cls: 't-ok', txt: `✓ [${fmt.ts()}] circuit.breaker → reset (auth-service)` },
    ];
    setEvents(e => [...e, pool[Math.floor(Math.random() * pool.length)]]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = 9999; }, 50);
  };

  const SERVICES = [
    { name: 'auth-service', ver: 'v3.2.1', inst: 4, healthy: true, latency: '4ms', rpm: '12.4K' },
    { name: 'user-profile-svc', ver: 'v2.8.0', inst: 6, healthy: true, latency: '8ms', rpm: '9.1K' },
    { name: 'ai-inference-svc', ver: 'v5.1.2', inst: 8, healthy: true, latency: '11ms', rpm: '28.7K' },
    { name: 'event-router', ver: 'v1.9.4', inst: 3, healthy: true, latency: '1ms', rpm: '44.2K' },
    { name: 'recommendation-svc', ver: 'v4.0.0', inst: 5, healthy: false, latency: '210ms', rpm: '5.3K' },
    { name: 'edge-coordinator', ver: 'v2.1.0', inst: 4, healthy: true, latency: '6ms', rpm: '18.9K' },
  ];

  const ARCH = [
    { layer: 'AI Inference Layer', tech: 'ONNX · TensorRT · vLLM', pct: 95, color: '#7c3aed' },
    { layer: 'API Gateway', tech: 'Kong · GraphQL · gRPC', pct: 100, color: '#2563eb' },
    { layer: 'Event Streaming', tech: 'Kafka · NATS · RabbitMQ', pct: 88, color: '#0891b2' },
    { layer: 'Data Platform', tech: 'ClickHouse · Redis · S3', pct: 92, color: '#059669' },
    { layer: 'Observability', tech: 'OTel · Jaeger · Grafana', pct: 97, color: '#d97706' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="stagger">
      <div className="phase-header">
        <div className="phase-num">01</div>
        <div>
          <div className="phase-title">Foundation & AI-Native Architecture</div>
          <div className="phase-desc">Microservices mesh · Event-driven backbone · AI-first design patterns</div>
        </div>
        <div className="phase-actions">
          <span className="badge badge-green">● 147 Services</span>
          <span className="badge badge-blue">38 Event Streams</span>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Services Registered" value="147" change="+12 this sprint" changeType="up" color="#2563eb" icon={Icon.Layers} />
        <StatCard label="Event Streams" value="38" change="All consuming" changeType="up" color="#059669" icon={Icon.Zap} />
        <StatCard label="API Endpoints" value="892" change="99.97% uptime" changeType="up" color="#7c3aed" icon={Icon.Globe} />
        <StatCard label="Messages/sec" value="44.2K" change="↑ 8% vs baseline" changeType="up" color="#0891b2" icon={Icon.TrendUp} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">Architecture Health</div></div>
          {ARCH.map(a => (
            <div key={a.layer} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{a.layer}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>{a.tech}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: a.color, fontWeight: 700 }}>{a.pct}%</span>
                </div>
              </div>
              <div className="prog"><div className="prog-fill" style={{ width: a.pct + '%', background: a.color }} /></div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Live Event Stream</div>
            <button className="btn btn-secondary btn-sm" onClick={addEvent}>Simulate Event</button>
          </div>
          <div className="terminal" ref={logRef}>
            {events.map((e, i) => <div key={i} className={e.cls}>{e.txt}</div>)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Service Registry</div>
          <div className="flex gap-2">
            <span className="badge badge-green">5 healthy</span>
            <span className="badge badge-red">1 degraded</span>
          </div>
        </div>
        <table className="tbl">
          <thead><tr><th>Service</th><th>Version</th><th>Instances</th><th>Latency</th><th>RPM</th><th>Health</th></tr></thead>
          <tbody>
            {SERVICES.map(s => (
              <tr key={s.name}>
                <td><span className="font-mono text-accent">{s.name}</span></td>
                <td><span className="badge badge-gray">{s.ver}</span></td>
                <td><span className="font-mono">{s.inst}</span></td>
                <td><span className="font-mono" style={{ color: parseFloat(s.latency) > 100 ? 'var(--c-amber)' : 'var(--c-green)' }}>{s.latency}</span></td>
                <td><span className="font-mono">{s.rpm}</span></td>
                <td><span className={`badge ${s.healthy ? 'badge-green' : 'badge-amber'}`}>{s.healthy ? '● Healthy' : '⚠ Degraded'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdBanner slot="2345678901" />
    </div>
  );
}

// ══════════════════════════
//  PHASE 2: AI Agents
// ══════════════════════════
function Agents() {
  const [agents, setAgents] = useState([
    { id: 'aria', name: 'ARIA', role: 'Orchestration Agent', emoji: '🧠', bg: '#eff4ff', status: 'running', task: 'Optimizing database query patterns across 3 clusters', progress: 78, decisions: 284, accuracy: 96.2 },
    { id: 'nova', name: 'NOVA', role: 'Analytics Agent', emoji: '📊', bg: '#f5f0ff', status: 'running', task: 'Analyzing behavioral clusters — 14 segments identified', progress: 45, decisions: 193, accuracy: 94.8 },
    { id: 'shield', name: 'SHIELD', role: 'Security Agent', emoji: '🛡️', bg: '#ecfdf5', status: 'running', task: 'Active CVE-2025 pattern scan on 147 services', progress: 91, decisions: 421, accuracy: 99.1 },
    { id: 'flux', name: 'FLUX', role: 'Deployment Agent', emoji: '🚀', bg: '#fff7ed', status: 'idle', task: 'Awaiting next deployment window (03:00 UTC)', progress: 0, decisions: 156, accuracy: 98.4 },
    { id: 'lens', name: 'LENS', role: 'Observability Agent', emoji: '🔍', bg: '#ecfeff', status: 'running', task: 'Aggregating distributed traces across 38 streams', progress: 62, decisions: 347, accuracy: 97.3 },
    { id: 'edge', name: 'EDGE', role: 'Edge Coordinator', emoji: '⚡', bg: '#fffbeb', status: 'warn', task: 'Reconnecting to EU-WEST-3 node (attempt 3/5)', progress: 33, decisions: 89, accuracy: 91.7 },
  ]);

  const toggle = (id) => {
    setAgents(a => a.map(x => x.id === id ? { ...x, status: x.status === 'running' ? 'idle' : 'running', progress: x.status === 'idle' ? Math.floor(Math.random() * 60 + 20) : 0 } : x));
  };

  const [decisionLog, setDecisionLog] = useState([
    { agent: 'ARIA', msg: 'Detected 23% CPU spike → auto-scaled EU-WEST-2 ×2 pods', ok: true },
    { agent: 'NOVA', msg: 'User cluster #7 showing churn signals → alert dispatched to CRM', ok: true },
    { agent: 'SHIELD', msg: 'CVE-2025-1337 pattern blocked · 0 services compromised', ok: true },
    { agent: 'LENS', msg: 'Trace anomaly in payment-svc → root cause: DB pool exhaustion', warn: true },
    { agent: 'FLUX', msg: 'Canary v2.4.1 at 25% traffic — p99=12ms vs baseline 16ms ✓', ok: true },
    { agent: 'EDGE', msg: 'EU-3 node latency +18ms — traffic rerouted to EU-2 automatically', warn: true },
  ]);

  const addDecision = () => {
    const pool = [
      { agent: 'ARIA', msg: 'Cost model suggests rightsizing 6 pods → saving $340/mo', ok: true },
      { agent: 'SHIELD', msg: 'API key rotation enforced for 3 stale credentials', ok: true },
      { agent: 'NOVA', msg: 'A/B test winner detected — variant B +12% conversion', ok: true },
      { agent: 'FLUX', msg: 'Dependency update ready: 4 CVE fixes, 0 breaking changes', ok: true },
    ];
    setDecisionLog(d => [pool[Math.floor(Math.random() * pool.length)], ...d].slice(0, 12));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="stagger">
      <div className="phase-header">
        <div className="phase-num">02</div>
        <div>
          <div className="phase-title">Autonomous AI Agents</div>
          <div className="phase-desc">Self-directed agents that observe, reason, plan, and act — continuously learning</div>
        </div>
        <div className="phase-actions">
          <span className="badge badge-green">● {agents.filter(a => a.status === 'running').length} Active</span>
          <button className="btn btn-primary btn-sm">+ Deploy Agent</button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Active Agents" value={agents.filter(a => a.status === 'running').length} change="All reporting" changeType="up" color="#2563eb" />
        <StatCard label="Tasks Completed" value="3,847" change="+284 today" changeType="up" color="#059669" />
        <StatCard label="Automation Rate" value="89%" change="+4% this week" changeType="up" color="#7c3aed" />
        <StatCard label="Avg Accuracy" value="96.3%" change="↑ learning" changeType="up" color="#0891b2" />
      </div>

      <div className="agent-grid">
        {agents.map(a => (
          <div key={a.id} className={`agent-card ${a.status}`}>
            <div className="agent-head">
              <div className="agent-ava" style={{ background: a.bg }}>{a.emoji}</div>
              <span className={`badge ${a.status === 'running' ? 'badge-green' : a.status === 'warn' ? 'badge-amber' : 'badge-gray'}`}>
                {a.status === 'running' ? '● Running' : a.status === 'warn' ? '⚠ Warning' : '○ Idle'}
              </span>
            </div>
            <div className="agent-name">{a.name}</div>
            <div className="agent-role">{a.role}</div>
            <div className="agent-task">{a.task}</div>
            {a.progress > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="text-xs text-muted">Progress</span>
                  <span className="font-mono text-xs text-accent">{a.progress}%</span>
                </div>
                <div className="prog"><div className="prog-fill" style={{ width: a.progress + '%' }} /></div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--c-text3)', marginBottom: 10 }}>
              <span>Decisions: <strong style={{ color: 'var(--c-text2)' }}>{a.decisions}</strong></span>
              <span style={{ marginLeft: 'auto' }}>Accuracy: <strong style={{ color: 'var(--c-green)' }}>{a.accuracy}%</strong></span>
            </div>
            <div className="agent-footer">
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm">Logs</button>
                <button className="btn btn-secondary btn-sm">Config</button>
              </div>
              <button className={`btn btn-sm ${a.status === 'running' ? 'btn-danger' : 'btn-primary'}`} onClick={() => toggle(a.id)}>
                {a.status === 'running' ? <><Icon.Pause width={12} height={12} /> Pause</> : <><Icon.Play width={12} height={12} /> Resume</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Orchestration Pipeline</div>
          </div>
          {['User Signal / Event', 'ARIA Orchestrator', 'Specialist Agent Pool', 'Tool & API Execution', 'Learning & Feedback Loop'].map((s, i) => (
            <div key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: ['#eff4ff', '#f5f0ff', '#ecfdf5', '#fff7ed', '#ecfeff'][i], border: `2px solid ${['#bfdbfe', '#ddd6fe', '#6ee7b7', '#fed7aa', '#a5f3fc'][i]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {['👤', '🧠', '⚙️', '🔧', '📈'][i]}
                </div>
                <div style={{ flex: 1, padding: '10px 14px', background: 'var(--c-bg)', borderRadius: 8, border: '1px solid var(--c-border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{s}</span>
                </div>
              </div>
              {i < 4 && <div style={{ width: 2, height: 12, background: 'var(--c-border)', marginLeft: 15 }} />}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Real-time Decision Log</div>
            <button className="btn btn-secondary btn-sm" onClick={addDecision}><Icon.Refresh width={12} height={12} /> Simulate</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
            {decisionLog.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: d.ok ? 'var(--c-green-light)' : 'var(--c-amber-light)', borderRadius: 8, borderLeft: `3px solid ${d.ok ? 'var(--c-green)' : 'var(--c-amber)'}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: d.ok ? 'var(--c-green)' : 'var(--c-amber)', minWidth: 40 }}>{d.agent}</span>
                <span style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>{d.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════
//  PHASE 3: Cloud Native
// ══════════════════════════
function CloudNative() {
  const [pipelines, setPipelines] = useState(null);
  useEffect(() => { API.getGitHubPipelines().then(setPipelines); }, []);

  const costData = [
    { month: 'Oct', spend: 22400, budget: 25000 },
    { month: 'Nov', spend: 21800, budget: 25000 },
    { month: 'Dec', spend: 20100, budget: 25000 },
    { month: 'Jan', spend: 19800, budget: 22000 },
    { month: 'Feb', spend: 19200, budget: 22000 },
    { month: 'Mar', spend: 18420, budget: 22000 },
  ];

  const heatData = Array.from({ length: 24 }, (_, i) => ({
    h: i,
    val: i === 3 ? 35 : i === 14 ? 60 : Math.floor(90 + Math.random() * 10)
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="stagger">
      <div className="phase-header">
        <div className="phase-num">03</div>
        <div>
          <div className="phase-title">Cloud Native Scalability</div>
          <div className="phase-desc">Kubernetes autoscaling · Multi-cloud federation · GitOps CI/CD · AI cost optimization</div>
        </div>
        <div className="phase-actions">
          <span className="badge badge-blue">Multi-cloud</span>
          <span className="badge badge-green">● 99.98% SLA</span>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Pods" value="108" change="Auto-scaled: 14 today" changeType="up" color="#2563eb" />
        <StatCard label="Deployments/day" value="47" change="+12% MoM" changeType="up" color="#059669" />
        <StatCard label="Monthly Spend" value="$18.4K" change="13% under budget" changeType="up" color="#7c3aed" />
        <StatCard label="Cost Saved" value="$14.8K" change="AI rightsizing" changeType="up" color="#0891b2" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">Monthly Cloud Spend vs Budget</div></div>
          <div className="chart-wrap" style={{ height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={costData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f4f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8994b0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8994b0' }} tickFormatter={v => '$' + v / 1000 + 'K'} />
                <Tooltip formatter={v => ['$' + v.toLocaleString()]} contentStyle={{ fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 8 }} />
                <Bar dataKey="spend" fill="#2563eb" radius={[4, 4, 0, 0]} name="Actual Spend" />
                <Bar dataKey="budget" fill="#e4e9f2" radius={[4, 4, 0, 0]} name="Budget" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">CI/CD Pipelines</div><span className="badge badge-blue">{pipelines ? pipelines.length : '…'} runs</span></div>
          {pipelines ? pipelines.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--c-border)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: p.status === 'success' ? 'var(--c-green-light)' : p.status === 'failure' ? 'var(--c-red-light)' : 'var(--c-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.status === 'success' ? <Icon.Check width={12} height={12} style={{ color: 'var(--c-green)', strokeWidth: 3 }} /> : p.status === 'failure' ? <Icon.X width={12} height={12} style={{ color: 'var(--c-red)' }} /> : <Icon.Refresh width={12} height={12} style={{ color: 'var(--c-accent)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{p.duration} · {p.tests}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>{p.time}</span>
            </div>
          )) : <div style={{ padding: 20, textAlign: 'center', color: 'var(--c-text3)', fontSize: 13 }}>Loading pipelines…</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">24-Hour Availability Heatmap</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 4, margin: '4px 0 8px' }}>
          {heatData.map(h => (
            <div key={h.h} title={`${String(h.h).padStart(2, '0')}:00 — ${h.val}% uptime`}
              style={{ height: 36, borderRadius: 4, background: `rgba(37,99,235,${h.val / 100})`, cursor: 'pointer', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.target.style.transform = 'scaleY(1.2)'}
              onMouseLeave={e => e.target.style.transform = ''} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span>
        </div>
      </div>

      <AdBanner slot="3456789012" />
    </div>
  );
}

// ══════════════════════════
//  PHASE 4: Security
// ══════════════════════════
function Security() {
  const ALERTS = [
    { sev: 'HIGH', title: 'Unusual API access pattern detected', src: 'EU-WEST-2', time: '2m ago', status: 'investigating' },
    { sev: 'MEDIUM', title: 'Container escape attempt — blocked', src: 'US-EAST-1', time: '14m ago', status: 'mitigated' },
    { sev: 'LOW', title: 'TLS 1.0 usage on legacy endpoint', src: 'AP-SOUTH-1', time: '1h ago', status: 'open' },
    { sev: 'MEDIUM', title: 'Brute-force attempt: 47 failed logins', src: 'EU-WEST-2', time: '2h ago', status: 'blocked' },
  ];
  const COMPLIANCE = [
    { name: 'SOC 2 Type II', score: 98, status: 'Compliant', color: '#059669' },
    { name: 'ISO 27001', score: 96, status: 'Compliant', color: '#059669' },
    { name: 'GDPR / DPDP', score: 94, status: 'Compliant', color: '#059669' },
    { name: 'PCI DSS v4', score: 91, status: 'In Review', color: '#d97706' },
    { name: 'HIPAA', score: 87, status: 'In Progress', color: '#2563eb' },
  ];

  const [scanLog, setScanLog] = useState([
    { cls: 't-ok', txt: '✓ SAST: 0 critical findings (semgrep + eslint-security)' },
    { cls: 't-ok', txt: '✓ DAST: 892 endpoints scanned — clean (OWASP ZAP)' },
    { cls: 't-ok', txt: '✓ Container: base images patched (Trivy v0.51)' },
    { cls: 't-ok', txt: '✓ Secrets: no exposed credentials (TruffleHog)' },
    { cls: 't-warn', txt: '⚠ Dependency: lodash 4.17.19 → update to 4.17.21' },
    { cls: 't-ok', txt: '✓ OPA policies: 18/18 gates passed' },
    { cls: 't-ok', txt: '✓ SBOM generated: 247 components catalogued' },
  ]);

  const triggerScan = () => {
    setScanLog(l => [...l, { cls: 't-hi', txt: `→ [${fmt.ts()}] Re-running full DevSecOps scan...` }]);
    setTimeout(() => setScanLog(l => [...l, { cls: 't-ok', txt: `✓ [${fmt.ts()}] All gates passed — safe to deploy (0 blockers)` }]), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="stagger">
      <div className="phase-header">
        <div className="phase-num">04</div>
        <div>
          <div className="phase-title">DevSecOps & Cybersecurity Intelligence</div>
          <div className="phase-desc">Zero-trust · AI threat detection · Automated remediation · Compliance automation</div>
        </div>
        <div className="phase-actions">
          <span className="badge badge-green">● SHIELD Active</span>
          <span className="badge badge-blue">Score: 12 LOW</span>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Threat Score" value="12" sub="LOW RISK" change="Below threshold" changeType="up" color="#059669" />
        <StatCard label="Threats Blocked" value="1,247" change="+23 today" changeType="up" color="#2563eb" />
        <StatCard label="Open Vulnerabilities" value="7" change="−15 this week" changeType="up" color="#d97706" />
        <StatCard label="Compliance Score" value="97%" change="SOC2 + ISO27001" changeType="up" color="#7c3aed" />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Active Security Alerts</div>
            <button className="btn btn-secondary btn-sm">Export</button>
          </div>
          {ALERTS.map((a, i) => (
            <div key={i} style={{ padding: '12px 0', borderBottom: i < ALERTS.length - 1 ? '1px solid var(--c-border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span className={`badge ${a.sev === 'HIGH' ? 'badge-red' : a.sev === 'MEDIUM' ? 'badge-amber' : 'badge-gray'}`}>{a.sev}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3 }}>Source: {a.src} · {a.time}</div>
                </div>
                <span className={`badge ${a.status === 'mitigated' || a.status === 'blocked' ? 'badge-green' : a.status === 'investigating' ? 'badge-amber' : 'badge-gray'}`}>{a.status}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Compliance Automation</div></div>
          {COMPLIANCE.map(c => (
            <div key={c.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: c.color }}>{c.score}%</span>
                  <span className={`badge ${c.status === 'Compliant' ? 'badge-green' : c.status === 'In Review' ? 'badge-amber' : 'badge-blue'}`}>{c.status}</span>
                </div>
              </div>
              <div className="prog"><div className="prog-fill" style={{ width: c.score + '%', background: c.color }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Security Pipeline — Shift Left</div>
            <button className="btn btn-secondary btn-sm" onClick={triggerScan}><Icon.Refresh width={12} height={12} /> Scan</button>
          </div>
          <div className="terminal">
            {scanLog.map((s, i) => <div key={i} className={s.cls}>{s.txt}</div>)}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Zero Trust Architecture</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Identity Verification', 'Device Posture', 'Network Segmentation', 'Application Access', 'Data Classification'].map((layer, i) => (
              <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--c-bg)', borderRadius: 8, border: '1px solid var(--c-border)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--c-green)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, flex: 1 }}>{layer}</span>
                <span className="badge badge-green">Enforced</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════
//  PHASE 5: Edge
// ══════════════════════════
function Edge() {
  const NODES = [
    { id: 'en1', name: 'EDGE-NYC', region: '🇺🇸 New York', lat: 40.7, lng: -74, latency: 4, load: 62, status: 'online', inferences: '124K/min', model: 'BERT-tiny' },
    { id: 'en2', name: 'EDGE-LON', region: '🇬🇧 London', lat: 51.5, lng: -0.1, latency: 7, load: 55, status: 'online', inferences: '89K/min', model: 'CollaFilter-v2' },
    { id: 'en3', name: 'EDGE-TOK', region: '🇯🇵 Tokyo', lat: 35.7, lng: 139.7, latency: 12, load: 78, status: 'online', inferences: '56K/min', model: 'LSTM-Edge' },
    { id: 'en4', name: 'EDGE-SGP', region: '🇸🇬 Singapore', lat: 1.3, lng: 103.8, latency: 9, load: 44, status: 'degraded', inferences: '34K/min', model: 'MobileNet-v3' },
  ];

  const latencyTrend = genSeries(24, 8, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="stagger">
      <div className="phase-header">
        <div className="phase-num">05</div>
        <div>
          <div className="phase-title">Edge Computing & Global Intelligence</div>
          <div className="phase-desc">Process at the source · Sub-10ms latency · Intelligent sync to cloud</div>
        </div>
        <div className="phase-actions">
          <span className="badge badge-green">● {NODES.filter(n => n.status === 'online').length}/{NODES.length} Nodes Online</span>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Edge Nodes" value={NODES.length} change={NODES.filter(n => n.status === 'online').length + " online"} changeType="up" color="#2563eb" />
        <StatCard label="Avg Latency" value="8ms" change="−40ms vs cloud-only" changeType="up" color="#059669" />
        <StatCard label="Edge Inferences" value="303K" change="per minute" changeType="neutral" color="#7c3aed" />
        <StatCard label="Bandwidth Saved" value="62%" change="vs cloud-only" changeType="up" color="#d97706" />
      </div>

      <div className="grid-2">
        {/* Edge nodes visual */}
        <div className="card">
          <div className="card-header"><div className="card-title">Global Edge Network</div></div>
          <svg viewBox="0 0 480 240" style={{ width: '100%', border: '1px solid var(--c-border)', borderRadius: 8, background: '#f8f9fc' }}>
            {/* Grid lines */}
            {[40, 80, 120, 160, 200].map(y => <line key={y} x1="0" y1={y} x2="480" y2={y} stroke="#e4e9f2" strokeWidth="1" />)}
            {[80, 160, 240, 320, 400].map(x => <line key={x} x1={x} y1="0" x2={x} y2="240" stroke="#e4e9f2" strokeWidth="1" />)}
            {/* Cloud center */}
            <circle cx="240" cy="120" r="22" fill="#eff4ff" stroke="#bfdbfe" strokeWidth="2" />
            <text x="240" y="116" textAnchor="middle" fontSize="9" fill="#2563eb" fontFamily="var(--font-mono)" fontWeight="700">CLOUD</text>
            <text x="240" y="128" textAnchor="middle" fontSize="8" fill="#60a5fa" fontFamily="var(--font-mono)">CORE</text>
            {/* Nodes */}
            {NODES.map((n, i) => {
              const positions = [{ x: 80, y: 60 }, { x: 160, y: 80 }, { x: 380, y: 70 }, { x: 360, y: 170 }];
              const pos = positions[i];
              const color = n.status === 'online' ? '#059669' : '#d97706';
              return (
                <g key={n.id}>
                  <line x1="240" y1="120" x2={pos.x} y2={pos.y} stroke={color} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.4" />
                  <circle cx={pos.x} cy={pos.y} r="16" fill="white" stroke={color} strokeWidth="2" />
                  <circle cx={pos.x} cy={pos.y} r="24" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3" />
                  <text x={pos.x} y={pos.y - 4} textAnchor="middle" fontSize="9" fill={color} fontFamily="var(--font-mono)" fontWeight="700">{n.name.replace('EDGE-', '')}</text>
                  <text x={pos.x} y={pos.y + 7} textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="var(--font-mono)">{n.latency}ms</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Latency trend */}
        <div className="card">
          <div className="card-header"><div className="card-title">Edge Latency Trend — 24h</div></div>
          <div className="chart-wrap" style={{ height: 180 }}>
            <ResponsiveContainer>
              <AreaChart data={latencyTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gEdge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f4f9" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#8994b0' }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: '#8994b0' }} tickFormatter={v => v + 'ms'} />
                <Tooltip formatter={v => [v.toFixed(1) + 'ms', 'Latency']} contentStyle={{ fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="v" stroke="#059669" strokeWidth={2} fill="url(#gEdge)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Edge Node Details</div></div>
        <table className="tbl">
          <thead><tr><th>Node</th><th>Region</th><th>Latency</th><th>Load</th><th>AI Model</th><th>Inferences</th><th>Status</th></tr></thead>
          <tbody>
            {NODES.map(n => (
              <tr key={n.id}>
                <td><span className="font-mono font-bold text-accent">{n.name}</span></td>
                <td><span style={{ fontSize: 13 }}>{n.region}</span></td>
                <td><span className="font-mono" style={{ color: n.latency > 10 ? 'var(--c-amber)' : 'var(--c-green)' }}>{n.latency}ms</span></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="prog" style={{ width: 70 }}><div className="prog-fill" style={{ width: n.load + '%', background: n.load > 70 ? 'var(--c-amber)' : 'var(--c-accent)' }} /></div>
                    <span className="font-mono text-xs">{n.load}%</span>
                  </div>
                </td>
                <td><span className="badge badge-purple">{n.model}</span></td>
                <td><span className="font-mono text-sm">{n.inferences}</span></td>
                <td><span className={`badge ${n.status === 'online' ? 'badge-green' : 'badge-amber'}`}>{n.status === 'online' ? '● Online' : '⚠ Degraded'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════
//  SETTINGS
// ══════════════════════════
function Settings() {
  const [toggles, setToggles] = useState({
    autoscale: true, autoRemediate: true, costOpt: true, autoPatch: false,
    edgeUpdate: true, weeklyReport: true, aiReview: true, anomalyAlert: true,
  });
  const flip = k => setToggles(t => ({ ...t, [k]: !t[k] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="stagger">
      <div className="phase-header">
        <div className="phase-num">⚙</div>
        <div>
          <div className="phase-title">Settings & Personalization</div>
          <div className="phase-desc">Configure AI behavior, integrations, API keys, and billing</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">AI Behavior Policies</div></div>
          {[
            { key: 'autoscale', label: 'Auto-scale on CPU > 75%', desc: 'Kubernetes HPA triggers automatically' },
            { key: 'autoRemediate', label: 'Autonomous incident remediation', desc: 'ARIA resolves known failure patterns' },
            { key: 'costOpt', label: 'Proactive cost optimization', desc: 'Rightsize pods during off-peak hours' },
            { key: 'autoPatch', label: 'Security auto-patching', desc: 'Apply low-risk patches automatically' },
            { key: 'edgeUpdate', label: 'Edge model auto-update', desc: 'Sync new model versions to edge nodes' },
            { key: 'weeklyReport', label: 'Weekly AI summary report', desc: 'Email digest of key platform events' },
          ].map(t => (
            <div key={t.key} className="toggle-row">
              <div className="toggle-info">
                <div className="toggle-label">{t.label}</div>
                <div className="toggle-desc">{t.desc}</div>
              </div>
              <button className={`toggle-sw ${toggles[t.key] ? 'on' : ''}`} onClick={() => flip(t.key)} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">API Key Configuration</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'OpenAI API Key', env: 'OPENAI_API_KEY', placeholder: 'sk-...', configured: !!CONFIG.OPENAI_API_KEY },
                { label: 'Anthropic API Key', env: 'ANTHROPIC_API_KEY', placeholder: 'sk-ant-...', configured: !!CONFIG.ANTHROPIC_API_KEY },
                { label: 'Datadog API Key', env: 'DATADOG_API_KEY', placeholder: 'dd-...', configured: !!CONFIG.DATADOG_API_KEY },
                { label: 'GitHub Token', env: 'GITHUB_TOKEN', placeholder: 'ghp_...', configured: !!CONFIG.GITHUB_TOKEN },
                { label: 'Snyk Token', env: 'SNYK_TOKEN', placeholder: 'snyk_...', configured: !!CONFIG.SNYK_TOKEN },
                { label: 'PagerDuty Key', env: 'PAGERDUTY_API_KEY', placeholder: 'pd_...', configured: !!CONFIG.PAGERDUTY_API_KEY },
                { label: 'AdSense Client ID', env: 'ADSENSE_CLIENT', placeholder: 'ca-pub-...', configured: CONFIG.ADSENSE_CLIENT && !CONFIG.ADSENSE_CLIENT.includes('XXXX') },
              ].map(k => (
                <div key={k.env}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text2)' }}>{k.label}</label>
                    <span className={`badge ${k.configured ? 'badge-green' : 'badge-gray'}`}>{k.configured ? '● Configured' : '○ Not set'}</span>
                  </div>
                  <input type="password" placeholder={k.configured ? '••••••••••••' : k.placeholder}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--c-bg)', color: 'var(--c-text)', outline: 'none' }} />
                </div>
              ))}
              <button className="btn btn-primary" style={{ marginTop: 4 }}>Save API Keys</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Billing & Monetization</div></div>
        <div className="grid-3">
          {[
            { plan: 'Starter', price: '$0', desc: 'Up to 3 agents, 1 cluster, community support', features: ['3 AI agents', '1 cluster', 'Basic observability', 'Community support'], cta: 'Current Plan', featured: false },
            { plan: 'Growth', price: '$99/mo', desc: 'Unlimited agents, 5 clusters, priority support', features: ['Unlimited agents', '5 clusters', 'Advanced analytics', 'Priority support', 'Edge nodes'], cta: 'Upgrade', featured: true },
            { plan: 'Enterprise', price: 'Custom', desc: 'Unlimited everything, SLA, dedicated CSM', features: ['Everything in Growth', 'Unlimited clusters', 'Custom SLA', 'Dedicated CSM', 'On-premise option'], cta: 'Contact Sales', featured: false },
          ].map(p => (
            <div key={p.plan} style={{ padding: 20, border: `1px solid ${p.featured ? 'var(--c-accent)' : 'var(--c-border)'}`, borderRadius: 12, background: p.featured ? 'var(--c-accent-light)' : 'var(--c-bg)' }}>
              {p.featured && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-accent)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Most Popular</div>}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{p.plan}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, color: 'var(--c-text)', marginBottom: 6 }}>{p.price}</div>
              <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 14 }}>{p.desc}</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
                {p.features.map(f => (
                  <li key={f} style={{ fontSize: 12, color: 'var(--c-text2)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--c-green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon.Check width={9} height={9} style={{ color: 'var(--c-green)', strokeWidth: 3 }} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`btn ${p.featured ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'center' }}>{p.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════
//  LANDING PAGE (public)
// ══════════════════════════
function Landing({ onEnter }) {
  return (
    <div className="landing" style={{ height: '100%', overflowY: 'auto' }}>
      <nav className="land-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 28, height: 28, background: 'var(--c-accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon.Cloud width={16} height={16} style={{ color: 'white' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900 }}>Orbit<em style={{ color: 'var(--c-accent)', fontStyle: 'normal' }}>Ex</em></span>
        </div>
        <div className="land-nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="docs/API_KEYS.md" target="_blank">Docs</a>
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 16 }} onClick={onEnter}>Open Platform →</button>
      </nav>

      <div className="hero">
        <div className="hero-badge"><Icon.Zap width={12} height={12} />AI-Native Cloud Intelligence Platform</div>
        <h1 className="hero-title">Your cloud, <em>thinking</em><br />for itself.</h1>
        <p className="hero-sub">OrbitEx is an autonomous cloud operations platform powered by AI agents that observe, decide, and act — so your team can focus on what matters.</p>
        <div className="hero-btns">
          <button className="btn btn-primary" style={{ fontSize: 15, padding: '11px 28px' }} onClick={onEnter}>Start Free →</button>
          <button className="btn btn-secondary" style={{ fontSize: 15, padding: '11px 28px' }}>Watch Demo</button>
        </div>
        <div className="hero-stats">
          {[['99.98%', 'Uptime SLA'], ['47/day', 'Deployments'], ['89%', 'Automation rate'], ['$14.8K', 'Monthly saved']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div className="hero-stat-val">{v}</div>
              <div className="hero-stat-lbl">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="features-grid" id="features">
        {[
          { icon: '🧠', color: '#eff4ff', title: 'AI Agent Fleet', desc: '6 specialized autonomous agents handle orchestration, security, deployments, analytics, observability, and edge coordination.' },
          { icon: '☁️', color: '#ecfdf5', title: 'Cloud Native', desc: 'Kubernetes-native autoscaling across AWS, GCP, and Azure. GitOps pipelines with ArgoCD and Buildkite.' },
          { icon: '🛡️', color: '#fef2f2', title: 'DevSecOps', desc: 'Shift-left security with SAST, DAST, container scanning, OPA policies, and automated compliance (SOC2, ISO27001, GDPR).' },
          { icon: '⚡', color: '#fffbeb', title: 'Edge Intelligence', desc: 'Global edge network with sub-10ms latency. Run AI inference at the source — 62% bandwidth saved vs cloud-only.' },
          { icon: '📊', color: '#f5f0ff', title: 'Deep Observability', desc: 'Full-stack traces with OpenTelemetry, Jaeger, and Prometheus. AI-powered anomaly detection and root cause analysis.' },
          { icon: '💰', color: '#ecfeff', title: 'Cost Intelligence', desc: 'AI rightsizing, spot instance optimization, and storage tiering save an average of 34% on monthly cloud spend.' },
        ].map(f => (
          <div key={f.title} className="feature-card">
            <div className="feature-icon" style={{ background: f.color }}><span style={{ fontSize: 22 }}>{f.icon}</span></div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto 40px', padding: '0 24px' }}>
        <AdBanner slot="4567890123" />
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto 60px', padding: '0 24px' }}>
        <div className="cta-section">
          <div className="cta-title">Ready to let your cloud think?</div>
          <div className="cta-sub">Join 500+ teams running smarter operations with OrbitEx AI.</div>
          <button className="btn btn-white" style={{ fontSize: 15, padding: '11px 28px' }} onClick={onEnter}>Get Started Free →</button>
        </div>
      </div>

      <div className="pricing-section" id="pricing">
        <div className="pricing-title">Simple, transparent pricing</div>
        <div className="pricing-sub">Start free. Scale as you grow. No hidden fees.</div>
        <div className="pricing-grid">
          {[
            { plan: 'Starter', price: '$0', period: '/month', desc: 'For individuals and small teams getting started.', features: ['3 AI agents', '1 cluster', 'Basic observability', '1GB logs/day', 'Community support'], cta: 'Get Started' },
            { plan: 'Growth', price: '$99', period: '/month', desc: 'For teams scaling their cloud operations.', features: ['Unlimited AI agents', '5 clusters', 'Advanced analytics', '50GB logs/day', 'Priority support', 'Edge nodes', 'SSO'], cta: 'Start Growth Trial', featured: true },
            { plan: 'Enterprise', price: 'Custom', period: '', desc: 'For organizations with advanced needs.', features: ['Everything in Growth', 'Unlimited clusters', 'Custom SLA (99.99%)', 'Dedicated CSM', 'On-premise option', 'Custom AI models'], cta: 'Contact Sales' },
          ].map(p => (
            <div key={p.plan} className={`pricing-card ${p.featured ? 'featured' : ''}`}>
              {p.featured && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-accent)', marginBottom: 8, textTransform: 'uppercase' }}>Most Popular</div>}
              <div className="pricing-plan">{p.plan}</div>
              <div className="pricing-price">{p.price}<span className="pricing-period">{p.period}</span></div>
              <div className="pricing-desc">{p.desc}</div>
              <ul className="pricing-features">
                {p.features.map(f => (
                  <li key={f}>
                    <div className="check-icon"><Icon.Check width={9} height={9} style={{ color: 'var(--c-green)', strokeWidth: 3 }} /></div>
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`btn ${p.featured ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'center' }}>{p.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════
//  SIDEBAR
// ══════════════════════════
function Sidebar({ page, setPage, onLanding }) {
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: Icon.Dashboard, badge: null },
    { id: 'foundation', label: 'Foundation', icon: Icon.Layers, badge: '01' },
    { id: 'agents', label: 'AI Agents', icon: Icon.Bot, badge: '6', badgeCls: 'green' },
    { id: 'cloud', label: 'Cloud Native', icon: Icon.Cloud, badge: '03' },
    { id: 'security', label: 'DevSecOps', icon: Icon.Shield, badge: '7', badgeCls: 'red' },
    { id: 'edge', label: 'Edge Computing', icon: Icon.Zap, badge: '04' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <div className="brand-icon"><Icon.Cloud width={18} height={18} style={{ color: 'white' }} /></div>
          <div>
            <div className="brand-name">Orbit<em>Ex</em></div>
            <div className="brand-tag">Cloud Intelligence Platform</div>
          </div>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-ai-badge">
          <div className="ai-dot" />
          <div>
            <div className="ai-badge-text">AI Engine Active</div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 1 }}>6 agents running</div>
          </div>
        </div>

        <div className="nav-group-label">Platform</div>
        {nav.map(n => (
          <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
            <n.icon width={16} height={16} />
            {n.label}
            {n.badge && <span className={`nav-badge ${n.badgeCls || ''}`}>{n.badge}</span>}
          </button>
        ))}

        <div className="nav-group-label" style={{ marginTop: 8 }}>Account</div>
        <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}>
          <Icon.Settings width={16} height={16} />Settings
        </button>
        <button className="nav-item" onClick={onLanding}>
          <Icon.Home width={16} height={16} />Landing Page
        </button>
        <button className="nav-item">
          <Icon.ExternalLink width={16} height={16} />Documentation
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-ava">OE</div>
          <div>
            <div className="user-name">Admin User</div>
            <div className="user-plan">Growth Plan</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════
//  TOPBAR
// ══════════════════════════
function TopBar({ page }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState('');

  const TITLES = {
    dashboard: 'Command Center', foundation: 'Foundation & Architecture',
    agents: 'AI Agent Fleet', cloud: 'Cloud Native Scalability',
    security: 'DevSecOps & Security', edge: 'Edge Computing', settings: 'Settings',
  };

  return (
    <div className="topbar" style={{ position: 'relative' }}>
      <div>
        <div className="topbar-title">{TITLES[page] || page}</div>
        <div className="topbar-breadcrumb">OrbitEx / {TITLES[page]}</div>
      </div>
      <div className="topbar-actions">
        <div className="search-wrap">
          <Icon.Search width={14} height={14} style={{ color: 'var(--c-text3)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search anything…" />
        </div>
        <button className="icon-btn" style={{ position: 'relative' }} onClick={() => setNotifOpen(o => !o)}>
          <Icon.Bell width={16} height={16} />
          <span className="badge-dot" />
        </button>
        <div className="user-ava" style={{ cursor: 'pointer' }}>OE</div>
      </div>
      {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} />}
    </div>
  );
}

// ══════════════════════════
//  ROOT APP
// ══════════════════════════
function App() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('landing'); // 'landing' | 'app'
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true);
      const splash = document.getElementById('splash');
      if (splash) { splash.style.opacity = '0'; setTimeout(() => { splash.style.display = 'none'; }, 400); }
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;

  if (mode === 'landing') return (
    <>
      <Landing onEnter={() => setMode('app')} />
      <AIChatWidget />
    </>
  );

  const PAGES = { dashboard: Dashboard, foundation: Foundation, agents: Agents, cloud: CloudNative, security: Security, edge: Edge, settings: Settings };
  const PageComponent = PAGES[page] || Dashboard;

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} onLanding={() => setMode('landing')} />
      <div className="main-area">
        <TopBar page={page} />
        <div className="content-area">
          <PageComponent />
        </div>
      </div>
      <AIChatWidget />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
