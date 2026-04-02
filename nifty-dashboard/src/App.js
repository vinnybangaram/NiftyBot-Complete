import React, { useEffect, useState, useMemo } from "react";
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Brush
} from "recharts";

const App = () => {
  const [data, setData] = useState(null);
  const [exportDate, setExportDate] = useState(new Date().toISOString().split('T')[0]);
  const [interval, setIntervalVal] = useState("5m"); // 🚀 TIMEFRAME STATE
  const [viewport, setViewport] = useState({ start: 0, end: 0 });

  // 1️⃣ DATA POLLING
  useEffect(() => {
    const fetchLoop = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/data?date=${exportDate}&interval=${interval}`);
        const json = await res.json();
        
        if (json.chart_data) {
          json.chart_processed = json.chart_data.map(d => ({
            ...d,
            displayTime: new Date(d.time * 1000).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
            }),
            color: d.close >= d.open ? "#22c55e" : "#ef4444",
            body: [Math.min(d.open, d.close), Math.max(d.open, d.close)],
            wick: [d.low, d.high]
          }));

          // Reset viewport if interval changed
          if (viewport.end === 0) {
            const total = json.chart_processed.length;
            setViewport({ start: Math.max(0, total - 50), end: total - 1 });
          }
        }
        setData(json);
      } catch (err) { console.error(err); }
    };

    fetchLoop();
    const timer = setInterval(fetchLoop, 5000);
    return () => clearInterval(timer);
  }, [exportDate, interval, viewport.end]);

  // 2️⃣ DYNAMIC SCALING
  const visiblePrices = useMemo(() => {
    if (!data?.chart_processed) return { min: 22000, max: 23000 };
    const slice = data.chart_processed.slice(viewport.start, viewport.end + 1);
    const all = slice.flatMap(d => [d.low, d.high]);
    if (all.length === 0) return { min: 22000, max: 23000 };
    return { min: Math.min(...all) - 5, max: Math.max(...all) + 5 };
  }, [data, viewport]);

  // 3️⃣ ACTIONS
  const zoomIn = () => {
    const range = viewport.end - viewport.start;
    const mid = viewport.start + Math.floor(range / 2);
    const newHalf = Math.max(5, Math.floor(range / 4));
    setViewport({ 
      start: Math.max(0, mid - newHalf), 
      end: Math.min((data?.chart_processed?.length || 0) - 1, mid + newHalf) 
    });
  };

  const zoomOut = () => {
    const range = viewport.end - viewport.start;
    const mid = viewport.start + Math.floor(range / 2);
    const newHalf = Math.min(100, Math.floor(range * 0.75));
    setViewport({ 
      start: Math.max(0, mid - newHalf), 
      end: Math.min((data?.chart_processed?.length || 0) - 1, mid + newHalf) 
    });
  };

  const handleClear = async () => {
    if (window.confirm("⚠️ Clear all trades for a fresh test? This cannot be undone.")) {
      await fetch("http://127.0.0.1:5000/clear", { method: "POST" });
      window.location.reload();
    }
  };

  if (!data) return <div style={{ color: "white", padding: "40px" }}>🚀 Readying Analysis System...</div>;

  return (
    <div style={styles.container}>
      {/* MODAL */}
      {data.awaiting_confirmation && data.pending_trade && (
        <div style={styles.modalBg}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>⚠️ Signature Required</div>
            <div style={styles.mItem}>TYPE: <b style={{color: data.pending_trade.signal.includes("CALL") ? "#22c55e" : "#ef4444"}}>{data.pending_trade.signal}</b></div>
            <div style={styles.mItem}>ENTRY: {data.pending_trade.entry}</div>
            <div style={styles.mFooter}>
              <button onClick={() => fetch("http://127.0.0.1:5000/confirm", {method: "POST"})} style={{...styles.mBtn, background: "#22c55e"}}>Execute</button>
              <button onClick={() => fetch("http://127.0.0.1:5000/reject", {method: "POST"})} style={{...styles.mBtn, background: "#1e293b"}}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* TOPBAR */}
      <nav style={styles.nav}>
        <div style={styles.logo}>NIFTY BOT <span style={{...styles.dot, background: data.trading_active ? "#22c55e" : "#ef4444"}}></span></div>
        <div style={styles.stats}>
          <div style={styles.chip}>SPOT: <span style={styles.val}>₹{data.price}</span></div>
          <div style={styles.chip}>SIGNAL: <span style={{color: data.signal.includes("WAIT") ? "#94a3b8" : "#facc15"}}>{data.signal}</span></div>
          <div style={styles.chip}>ACTIVE: <span style={{color: "#38bdf8"}}>{data.report.active_count}</span></div>
          <div style={{color: data.report.total_pnl >= 0 ? "#22c55e" : "#ef4444", paddingLeft: "20px", borderLeft: "1px solid #1e293b", fontWeight: "bold"}}>
             ₹{data.report.total_pnl}
          </div>
        </div>
      </nav>

      <div style={styles.layout}>
        <div style={styles.chartCol}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px"}}>
             <div style={styles.tabs}>
                {["1m", "5m", "15m"].map(t => (
                  <button key={t} onClick={() => setIntervalVal(t)} 
                          style={{...styles.tab, background: interval === t ? "#38bdf8" : "#1e293b", color: interval === t ? "#020617" : "#94a3b8"}}>
                    {t}
                  </button>
                ))}
             </div>
             <div style={styles.zoomControls}>
                <button onClick={zoomIn} style={styles.zoomBtn}>➕</button>
                <button onClick={zoomOut} style={styles.zoomBtn}>➖</button>
             </div>
          </div>

          <div style={{ height: "480px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.chart_processed}>
                <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="displayTime" stroke="#64748b" fontSize={10} tickMargin={10} minTickGap={40} />
                <YAxis 
                  domain={[visiblePrices.min, visiblePrices.max]} 
                  orientation="right" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickFormatter={(val) => Math.round(val)} 
                  allowDataOverflow={true}
                />
                <Tooltip 
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px" }}
                  itemStyle={{ fontSize: "12px" }}
                />
                <Bar dataKey="wick" barSize={1} isAnimationActive={false}>
                  {data.chart_processed?.map((entry, index) => (
                    <Cell key={`wick-${index}`} fill={entry.color} />
                  ))}
                </Bar>
                <Bar dataKey="body" barSize={10} isAnimationActive={false}>
                  {data.chart_processed?.map((entry, index) => (
                    <Cell key={`body-${index}`} fill={entry.color} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="ema20" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ema50" stroke="#facc15" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Brush 
                  dataKey="displayTime" height={35} stroke="#38bdf8" fill="#020617" 
                  startIndex={viewport.start} endIndex={viewport.end} onChange={(e) => setViewport({ start: e.startIndex, end: e.endIndex })}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={styles.legend}>
            <div>EMA-20 (Blue)</div>
            <div>EMA-50 (Yellow)</div>
            <div style={{marginLeft: "auto", opacity: 0.5}}>Displaying {viewport.end - viewport.start + 1} candles</div>
          </div>
        </div>

        <div style={styles.sideCol}>
          <div style={styles.pHeader}>Engine Process</div>
          <button onClick={() => fetch(`http://127.0.0.1:5000/${data.trading_active ? "stop" : "start"}`, {method: "POST"})}
                  style={{...styles.btn, background: data.trading_active ? "#ef4444" : "#22c55e"}}>
            {data.trading_active ? "STOP BOT" : "START BOT"}
          </button>
          
          <div style={styles.pHeader}>Management</div>
          <button onClick={handleClear} style={{...styles.btn, background: "#1e293b", color: "#ef4444", border: "1px solid #ef4444"}}>CLEAR HISTORY</button>
          
          <div style={styles.pHeader}>History Date Sync</div>
          <div style={styles.card}>
            <input type="date" style={styles.input} value={exportDate} onChange={(e) => setExportDate(e.target.value)} />
          </div>

          <div style={styles.pHeader}>Reporting</div>
          <button style={styles.expBtn} onClick={() => window.open(`http://127.0.0.1:5000/export?date=${exportDate}`)}>Export Trades (.xlsx)</button>
        </div>
      </div>

      <div style={styles.tableCol}>
        <div style={styles.pHeader}>Session Records (IST)</div>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tHead}><th>Time</th><th>Signal</th><th>Price</th><th>P&L</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(data.report?.trades || []).map((t) => (
              <tr key={t.id} style={styles.tRow}>
                <td>{new Date(t.entry_unix * 1000).toLocaleTimeString("en-IN", {timeZone: "Asia/Kolkata", hour12: true})}</td>
                <td style={{color: t.type === "CALL" ? "#22c55e" : "#ef4444", fontWeight: "bold"}}>{t.type}</td>
                <td>{t.entry}</td>
                <td style={{color: t.pnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: "bold"}}>₹{t.pnl}</td>
                <td><span style={{...styles.badge, background: t.status === "OPEN" ? "#38bdf8" : t.status.includes("TARGET") ? "#22c55e" : "#ef4444"}}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const styles = {
  container: { background: "#020617", minHeight: "100vh", color: "#f8fafc", fontFamily: "sans-serif" },
  nav: { display: "flex", justifyContent: "space-between", padding: "15px 30px", background: "#0f172a", borderBottom: "1px solid #1e293b" },
  logo: { fontWeight: "bold", fontSize: "18px" },
  dot: { width: "10px", height: "10px", borderRadius: "50%", display: "inline-block", marginLeft: "10px" },
  stats: { display: "flex", gap: "30px", fontWeight: "bold" },
  chip: { background: "#1e293b", padding: "4px 12px", borderRadius: "15px", fontSize: "14px" },
  val: { color: "#facc15" },
  layout: { display: "grid", gridTemplateColumns: "1fr 280px", gap: "15px", padding: "15px" },
  chartCol: { background: "#0f172a", padding: "20px", borderRadius: "15px", border: "1px solid #1e293b" },
  tabs: { display: "flex", gap: "5px" },
  tab: { padding: "6px 12px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", transition: "0.2s" },
  zoomControls: { display: "flex", gap: "8px" },
  zoomBtn: { background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", width: "32px", height: "32px", borderRadius: "6px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", fontSize: "14px" },
  sideCol: { display: "flex", flexDirection: "column", gap: "12px" },
  pHeader: { fontSize: "12px", fontWeight: "bold", opacity: 0.5, textTransform: "uppercase", marginBottom: "5px", marginTop: "10px" },
  btn: { padding: "14px", border: "none", borderRadius: "10px", color: "white", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  expBtn: { padding: "12px", background: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },
  card: { background: "#0f172a", padding: "12px", borderRadius: "10px", border: "1px solid #1e293b" },
  input: { background: "#020617", border: "1px solid #1e293b", color: "white", padding: "12px", borderRadius: "8px", width: "100%" },
  legend: { display: "flex", gap: "25px", fontSize: "11px", marginTop: "15px" },
  tableCol: { padding: "15px" },
  table: { width: "100%", borderCollapse: "collapse", background: "#0f172a", borderRadius: "12px", overflow: "hidden" },
  tHead: { textAlign: "left", background: "#1e293b", color: "#94a3b8", fontSize: "12px", padding: "15px" },
  tRow: { borderBottom: "1px solid #1e293b", fontSize: "13px" },
  badge: { padding: "4px 10px", borderRadius: "5px", color: "white", fontSize: "11px", fontWeight: "bold" },
  modalBg: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { background: "#0f172a", padding: "30px", borderRadius: "20px", width: "340px", border: "1px solid #1e293b" },
  modalHeader: { fontWeight: "bold", color: "#facc15", marginBottom: "20px" },
  mItem: { marginBottom: "10px", fontSize: "15px" },
  mFooter: { display: "flex", gap: "15px", marginTop: "25px" },
  mBtn: { flex: 1, padding: "14px", border: "none", borderRadius: "10px", color: "white", fontWeight: "bold", cursor: "pointer" }
};

export default App;