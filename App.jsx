import { useState, useMemo, useEffect } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, LogIn, Sparkles, ChevronDown, AlertCircle, Activity } from "lucide-react";

// ── Real NSE data fallback (used when backend is unavailable) ─────────────────
const FALLBACK_DATA = {
  "Reliance Industries": { price: 1327.0, change1y: -3.72 },
  "TCS":                 { price: 2210.0, change1y: -37.0 },
  "Infosys":             { price: 1130.0, change1y: -26.5 },
  "HDFC Bank":           { price: 795.0,  change1y: -20.0 },
  "Adani Ports":         { price: 1833.0, change1y: 25.0  },
};

const DISSERTATION_METRICS = {
  "Reliance Industries": { r2_c: 0.9957, r2_f: 0.9956, mape_c: 3.12, mape_f: 2.98, rmse_c: 0.38, rmse_f: 0.2682, da_c: 53.4, da_f: 56.18 },
  "TCS":                 { r2_c: 0.9769, r2_f: 0.9750, mape_c: 9.21, mape_f: 8.80, rmse_c: 8.11, rmse_f: 8.42,   da_c: 51.2, da_f: 53.1  },
  "Infosys":             { r2_c: 0.9820, r2_f: 0.9810, mape_c: 7.40, mape_f: 7.10, rmse_c: 5.21, rmse_f: 5.18,   da_c: 52.1, da_f: 54.3  },
};

const COMPANIES = [
  "Reliance Industries","TCS","HDFC Bank","Infosys","ICICI Bank",
  "Hindustan Unilever","ITC","State Bank of India","Bharti Airtel",
  "Kotak Mahindra Bank","Larsen & Toubro","Axis Bank","Bajaj Finance",
  "Asian Paints","Maruti Suzuki","HCL Technologies","Sun Pharma",
  "Titan Company","UltraTech Cement","Wipro","Nestle India",
  "Adani Enterprises","Adani Ports","Tata Motors","Tata Steel",
  "Power Grid Corp","NTPC","JSW Steel","Grasim Industries","Tech Mahindra",
  "Hindalco Industries","Dr Reddy's Labs","Cipla","Coal India",
  "Eicher Motors","Bajaj Auto","Britannia Industries","Divi's Labs",
  "Apollo Hospitals","SBI Life Insurance","HDFC Life Insurance",
  "Bajaj Finserv","Tata Consumer Products","Shree Cement","UPL",
  "ONGC","IndusInd Bank","Bharat Petroleum","Mahindra & Mahindra",
];

const BACKEND = "https://stocksense-backend-82ba.onrender.com";

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function buildHistory(years, currentPrice, change1y) {
  const months = years * 12;
  const oneYearAgoPrice = currentPrice / (1 + change1y / 100);
  const now = new Date();
  const data = [];
  for (let m = months; m >= 0; m--) {
    const t = (months - m) / months;
    const base = m <= 12
      ? oneYearAgoPrice + (currentPrice - oneYearAgoPrice) * ((12 - m) / 12)
      : oneYearAgoPrice * (0.85 + Math.random() * 0.3);
    const val = m === 0 ? currentPrice : base * (1 + (Math.random() - 0.5) * 0.03);
    const d = new Date(now);
    d.setMonth(d.getMonth() - m);
    data.push({ date: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), close: Math.round(val) });
  }
  return data;
}

function buildPrediction(history, metrics) {
  return history.map(pt => ({
    ...pt,
    centralized: Math.round(pt.close * (1 + (Math.random() - 0.5) * (metrics?.mape_c || 5) / 100 * 1.5)),
    federated:   Math.round(pt.close * (1 + (Math.random() - 0.5) * (metrics?.mape_f || 4) / 100 * 1.2)),
  }));
}

export default function StockSense() {
  const [loggedIn, setLoggedIn]   = useState(false);
  const [company, setCompany]     = useState("");
  const [years, setYears]         = useState(1);
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [tab, setTab]             = useState("history");
  const [topStocks, setTopStocks] = useState(
    Object.entries(FALLBACK_DATA).map(([name, d]) => ({ name, price: d.price, pct: d.change1y, up: d.change1y >= 0 }))
  );
  const [backendLive, setBackendLive] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/api/health`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .then(d => { if (d.status === "ok") setBackendLive(true); })
      .catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    if (!company) return;
    setLoading(true); setError(""); setResult(null);
    try {
      if (backendLive) {
        const res = await fetch(`${BACKEND}/api/stock/${encodeURIComponent(company)}?years=${years}`, { signal: AbortSignal.timeout(10000) });
        const data = await res.json();
        if (!data.error) {
          const metrics = DISSERTATION_METRICS[company] || null;
          setResult({ ...data, metrics, chartData: buildPrediction(data.history.map(h => ({ ...h, date: h.date.slice(0, 7) })), metrics), isLive: true });
          setLoading(false); return;
        }
      }
      // Fallback
      const fb = FALLBACK_DATA[company];
      const price  = fb ? fb.price  : Math.round(200 + (hashString(company) % 3000));
      const change = fb ? fb.change1y : Math.round(((hashString(company) % 600) / 10) - 30);
      const history = buildHistory(years, price, change);
      const metrics = DISSERTATION_METRICS[company] || null;
      setResult({ company, current_price: price, change_pct: change, history, metrics, chartData: buildPrediction(history, metrics), isLive: false });
    } catch (e) {
      setError("Could not load data. Showing estimated values.");
    } finally { setLoading(false); }
  };

  const bgPaths = useMemo(() => ([
    { d: "M0,260 C150,180 300,320 450,200 C600,90 750,260 900,150 C1050,60 1200,200 1350,120", color: "#2ee6a6", delay: "0s", dur: "9s" },
    { d: "M0,340 C160,400 320,260 480,360 C640,440 800,300 960,380 C1120,440 1280,320 1440,360", color: "#ff5c7a", delay: "1.2s", dur: "11s" },
    { d: "M0,180 C140,140 280,220 420,160 C580,90 740,200 900,140", color: "#2ee6a6", delay: "2.4s", dur: "10s" },
  ]), []);

  return (
    <div style={{ minHeight: "100vh", background: "#070b12", color: "#eef1f7", fontFamily: "'IBM Plex Mono', monospace", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes drift{0%{transform:translateX(0) translateY(0)}50%{transform:translateX(-2%) translateY(-1.5%)}100%{transform:translateX(0) translateY(0)}}
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(46,230,166,.35)}50%{box-shadow:0 0 0 10px rgba(46,230,166,0)}}
        .bg-path{fill:none;stroke-width:2.5;opacity:.28;animation-name:drift;animation-iteration-count:infinite;animation-timing-function:ease-in-out}
        .ticker-wrap{display:flex;gap:2.5rem;animation:ticker 28s linear infinite;white-space:nowrap}
        select,input[type=range]{accent-color:#2ee6a6}
        select{background:#0d1018;color:#eef1f7;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px 16px;width:100%;font-family:inherit;font-size:14px}
        input[type=range]{width:100%}
        .tab{padding:6px 18px;border-radius:20px;font-size:12px;cursor:pointer;border:none;transition:all .2s;font-family:inherit}
      `}</style>

      {/* Cinematic BG */}
      <svg style={{ position:"fixed", inset:0, width:"100%", height:"100%", zIndex:0, pointerEvents:"none" }} viewBox="0 0 1440 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="30%" stopColor="#070b12" stopOpacity="0"/>
            <stop offset="100%" stopColor="#070b12" stopOpacity="1"/>
          </linearGradient>
        </defs>
        {bgPaths.map((p,i) => <path key={i} d={p.d} className="bg-path" stroke={p.color} style={{animationDelay:p.delay,animationDuration:p.dur}}/>)}
        <rect x="0" y="0" width="1440" height="600" fill="url(#fade)"/>
      </svg>

      <div style={{ position:"relative", zIndex:1 }}>
        {/* HEADER */}
        <header style={{ borderBottom:"1px solid rgba(255,255,255,.08)", backdropFilter:"blur(8px)", background:"rgba(7,11,18,.7)" }}>
          <div style={{ maxWidth:1100, margin:"0 auto", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Activity size={20} color="#2ee6a6"/>
              <span style={{ fontFamily:"Fraunces,serif", fontSize:22 }}>StockSense</span>
              <span style={{ fontSize:10, color:"#2ee6a6", border:"1px solid #2ee6a6", borderRadius:4, padding:"1px 6px" }}>BETA</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:11, color: backendLive ? "#2ee6a6" : "#f4d35e" }}>
                {backendLive ? "🟢 Live Data" : "🟡 Estimated Data"}
              </span>
              <button onClick={() => setLoggedIn(!loggedIn)} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 18px", borderRadius:20, fontSize:13, cursor:"pointer", border:"1px solid #2ee6a6", background: loggedIn ? "#2ee6a6":"transparent", color: loggedIn ? "#070b12":"#2ee6a6" }}>
                <LogIn size={13}/> {loggedIn ? "Hi, Trader 👋" : "Login"}
              </button>
            </div>
          </div>

          {/* Ticker */}
          <div style={{ overflow:"hidden", borderTop:"1px solid rgba(255,255,255,.05)", padding:"8px 0", background:"rgba(255,255,255,.02)" }}>
            <div className="ticker-wrap" style={{ paddingLeft:24 }}>
              {[...topStocks,...topStocks].map((s,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                  <span style={{ opacity:.6 }}>{s.name}</span>
                  {s.up ? <TrendingUp size={12} color="#2ee6a6"/> : <TrendingDown size={12} color="#ff5c7a"/>}
                  <span>₹{s.price?.toLocaleString("en-IN")}</span>
                  <span style={{ color: s.up ? "#2ee6a6":"#ff5c7a" }}>{s.pct > 0 ? "+" : ""}{s.pct}% 1Y</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* KEY METRICS */}
        <section style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px 0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <Sparkles size={16} color="#2ee6a6"/>
            <span style={{ fontFamily:"Fraunces,serif", fontSize:16 }}>Key Metrics — Federated vs Centralized Transformer</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:12 }}>
            {[["Best R² Score","0.9976"],["Best MAPE","2.41%"],["Best RMSE","0.2682"],["Best DA","56.18%"]].map(([label,val]) => (
              <div key={label} style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, padding:"18px 20px" }}>
                <div style={{ fontSize:11, color:"#9aa3b5", letterSpacing:".08em", textTransform:"uppercase", marginBottom:6 }}>{label}</div>
                <div style={{ fontSize:28, fontWeight:600 }}>{val}</div>
                <div style={{ fontSize:11, color:"#2ee6a6", marginTop:6, display:"flex", alignItems:"center", gap:4 }}><Sparkles size={10}/> Federated Model</div>
              </div>
            ))}
          </div>
          <div style={{ background:"rgba(46,230,166,.07)", border:"1px solid rgba(46,230,166,.2)", borderRadius:10, padding:"10px 16px", fontSize:12, color:"#2ee6a6", marginBottom:8 }}>
            ✓ Federated model achieves comparable or superior performance to centralized — without sharing raw data.
          </div>
        </section>

        {/* BODY */}
        <section style={{ maxWidth:860, margin:"0 auto", padding:"24px 24px 60px" }}>
          <div style={{ background:"rgba(10,12,20,.85)", border:"1px solid rgba(255,255,255,.1)", borderRadius:20, padding:"28px 32px", backdropFilter:"blur(12px)" }}>
            <h2 style={{ fontFamily:"Fraunces,serif", fontSize:24, margin:"0 0 6px" }}>Analyse a Stock</h2>
            <p style={{ fontSize:13, opacity:.5, marginBottom:24 }}>Select a company, choose how many years to analyse, and see the trend instantly.</p>

            <label style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".08em", opacity:.6 }}>Company</label>
            <div style={{ margin:"8px 0 20px" }}>
              <select value={company} onChange={e => { setCompany(e.target.value); setResult(null); }}>
                <option value="">Select a company…</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <label style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".08em", opacity:.6 }}>
              Years of history: <span style={{ color:"#2ee6a6" }}>{years}</span>
            </label>
            <input type="range" min="1" max="5" value={years} onChange={e => { setYears(Number(e.target.value)); setResult(null); }} style={{ margin:"8px 0 24px", display:"block" }}/>

            <button onClick={handleAnalyze} disabled={!company || loading} style={{ width:"100%", padding:13, borderRadius:10, fontSize:14, fontFamily:"inherit", letterSpacing:".05em", cursor: !company ? "not-allowed":"pointer", border:"none", background: !company ? "rgba(255,255,255,.07)":"#2ee6a6", color: !company ? "rgba(255,255,255,.3)":"#070b12", animation: company && !loading ? "glow 2.5s infinite":"none" }}>
              {loading ? "Loading…" : "Analyze"}
            </button>

            {error && <div style={{ marginTop:16, color:"#f4d35e", fontSize:12 }}>⚠ {error}</div>}

            {result && (
              <div style={{ marginTop:24, borderTop:"1px solid rgba(255,255,255,.08)", paddingTop:24 }}>
                <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:20 }}>
                  <div>
                    <div style={{ fontSize:13, opacity:.6, marginBottom:4 }}>{result.company}</div>
                    <div style={{ fontSize:30, fontWeight:600 }}>₹{result.current_price?.toLocaleString("en-IN")}</div>
                    <div style={{ fontSize:13, color: result.change_pct >= 0 ? "#2ee6a6":"#ff5c7a", marginTop:2 }}>
                      {result.change_pct >= 0 ? "▲" : "▼"} {Math.abs(result.change_pct)}% over {years}y
                    </div>
                  </div>
                  <div style={{ fontSize:11, border:`1px solid ${result.isLive ? "rgba(46,230,166,.3)":"rgba(244,211,94,.3)"}`, color: result.isLive ? "#2ee6a6":"#f4d35e", borderRadius:6, padding:"4px 10px", alignSelf:"flex-start" }}>
                    {result.isLive ? "🟢 Live NSE Data" : "🟡 Estimated"}
                  </div>
                </div>

                <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                  {["history","predict"].map(t => (
                    <button key={t} className="tab" onClick={() => setTab(t)} style={{ background: tab===t ? "#2ee6a6":"rgba(255,255,255,.05)", color: tab===t ? "#070b12":"#9aa3b5" }}>
                      {t === "history" ? "Price History" : "Centralized vs Federated"}
                    </button>
                  ))}
                </div>

                {tab === "history" && (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={result.history}>
                      <defs>
                        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={result.change_pct>=0?"#2ee6a6":"#ff5c7a"} stopOpacity={.35}/>
                          <stop offset="100%" stopColor={result.change_pct>=0?"#2ee6a6":"#ff5c7a"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/>
                      <XAxis dataKey="date" tick={{fill:"#9aa3b5",fontSize:10}} interval={Math.ceil(result.history.length/5)} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:"#9aa3b5",fontSize:10}} axisLine={false} tickLine={false} width={50} tickFormatter={v=>`₹${v}`}/>
                      <Tooltip contentStyle={{background:"#0d1018",border:"1px solid rgba(255,255,255,.1)",fontSize:12}} formatter={v=>[`₹${v}`,"Close"]}/>
                      <Area type="monotone" dataKey="close" stroke={result.change_pct>=0?"#2ee6a6":"#ff5c7a"} fill="url(#ag)" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {tab === "predict" && (
                  result.metrics ? (
                    <>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
                        {[["R² Cent.",result.metrics.r2_c],["R² Fed.",result.metrics.r2_f],["MAPE Cent.",result.metrics.mape_c+"%"],["MAPE Fed.",result.metrics.mape_f+"%"]].map(([l,v],i) => (
                          <div key={i} style={{ background:"rgba(255,255,255,.03)", borderRadius:10, padding:"10px 14px", border:"1px solid rgba(255,255,255,.07)" }}>
                            <div style={{ fontSize:10, opacity:.55, marginBottom:4 }}>{l}</div>
                            <div style={{ fontSize:18, color: i%2===1?"#2ee6a6":"#eef1f7" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={result.chartData}>
                          <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/>
                          <XAxis dataKey="date" tick={{fill:"#9aa3b5",fontSize:10}} interval={Math.ceil(result.chartData.length/5)} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fill:"#9aa3b5",fontSize:10}} axisLine={false} tickLine={false} width={50} tickFormatter={v=>`₹${v}`}/>
                          <Tooltip contentStyle={{background:"#0d1018",border:"1px solid rgba(255,255,255,.1)",fontSize:12}}/>
                          <Legend wrapperStyle={{fontSize:12,paddingTop:8}}/>
                          <Line type="monotone" dataKey="close" stroke="#eef1f7" strokeWidth={2} dot={false} name="Actual Price"/>
                          <Line type="monotone" dataKey="centralized" stroke="#f4d35e" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Centralized"/>
                          <Line type="monotone" dataKey="federated" stroke="#2ee6a6" strokeWidth={1.5} dot={false} name="Federated"/>
                        </LineChart>
                      </ResponsiveContainer>
                      <p style={{ fontSize:10, opacity:.3, marginTop:8 }}>Prediction lines based on your dissertation MAPE values. Wire your real ONNX model to replace these.</p>
                    </>
                  ) : (
                    <div style={{ color:"#f4d35e", fontSize:13, display:"flex", gap:8, alignItems:"center" }}>
                      <AlertCircle size={15}/> Centralized vs Federated comparison available for Reliance, TCS and Infosys only (your dissertation stocks).
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
