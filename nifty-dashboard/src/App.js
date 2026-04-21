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
import OptionChainModal from './OptionChainModal';


const App = () => {
  const [data, setData] = useState(null);
  const [exportDate, setExportDate] = useState(new Date().toISOString().split('T')[0]);
  const [interval, setIntervalVal] = useState("5m");
  const [viewport, setViewport] = useState({ start: 0, end: 0 });
  const [showOptionChain, setShowOptionChain] = useState(false);

  const [error, setError] = useState(null);
  const API = window.location.port === "3000" ? `http://${window.location.hostname}:5000` : "";
  useEffect(() => {
    const fetchLoop = async () => {
      try {

        const res = await fetch(`${API}/data?date=${exportDate}&interval=${interval}`);
        const json = await res.json();

        if (json.chart_data) {
          json.chart_processed = json.chart_data.map(d => ({
            ...d,
            displayTime: new Date(d.time * 1000).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
            }),
            color: d.close >= d.open ? "#20c997" : "#ff4b4b",
            body: [Math.min(d.open, d.close), Math.max(d.open, d.close)],
            wick: [d.low, d.high]
          }));

          if (viewport.end === 0) {
            const total = json.chart_processed.length;
            setViewport({ start: Math.max(0, total - 50), end: total - 1 });
          }
        }
        setData(json);
        setError(null);
      } catch (err) { 
        console.error("Connection Error:", err); 
        setError("BACKEND DISCONNECTED - Check if python app.py is running");
      }
    };

    fetchLoop();
    const timer = setInterval(fetchLoop, 5000);
    return () => clearInterval(timer);
  }, [exportDate, interval, viewport.end]);

  const visiblePrices = useMemo(() => {
    if (!data?.chart_processed) return { min: 22000, max: 23000 };
    const slice = data.chart_processed.slice(viewport.start, viewport.end + 1);
    const all = slice.flatMap(d => [d.low, d.high]);
    if (all.length === 0) return { min: 22000, max: 23000 };
    return { min: Math.min(...all) - 10, max: Math.max(...all) + 10 };
  }, [data, viewport]);

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

  const toggleEngine = async () => {
    if (data.trading_active) {
      await fetch(`${API}/stop`, { method: "POST" });
    } else {
      const defaultLots = 65;
      const lots = window.prompt(`Enter number of Lots to ignite engine (Default: ${defaultLots}):`, defaultLots);
      if (lots !== null) {
        await fetch(`${API}/start`, { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lots: parseInt(lots) || defaultLots })
        });
      }
    }
  };

  const handleClear = async () => {
    if (window.confirm("Are you sure you want to clear all trade history?")) {
      await fetch(`${API}/clear`, { method: "POST" });
      window.location.reload();
    }
  };

  if (error) return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100 text-center" style={{ background: '#020617' }}>
      <div className="rounded-circle bg-danger bg-opacity-25 p-4 mb-4">
        <i className="bi bi-wifi-off display-1 text-danger"></i>
      </div>
      <h2 className="text-white fw-bold ls-2 uppercase mb-2">SYSTEM OFFLINE</h2>
      <div className="text-danger fw-bold mb-4 px-4" style={{ maxWidth: '400px' }}>{error}</div>
      <div className="text-secondary small font-monospace">
        Attempting to reconnect in 5 seconds...<br/>
        Target: {API || "Self-Host"}/data
      </div>
    </div>
  );

  if (!data) return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100" style={{ background: '#020617' }}>
      <div className="spinner-border text-info mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
      <div className="text-secondary fw-bold ls-2 uppercase">Initializing Core Engine...</div>
    </div>
  );

  return (
    <div className="min-vh-100 font-monospace" style={{ background: 'transparent' }}>
      <OptionChainModal
        isOpen={showOptionChain}
        onClose={() => setShowOptionChain(false)}
        currentPrice={data?.price}
        oiData={data?.oi_data}
      />
      {/* Signature Modal */}
      {data.awaiting_confirmation && data.pending_trade && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: 'blur(8px)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content glass-panel border-warning shadow-lg">
              <div className="modal-header border-bottom border-warning border-opacity-25 pb-2">
                <h5 className="modal-title neon-text-warning fw-bold"><i className="bi bi-shield-lock me-2"></i>Signature Required</h5>
              </div>
              <div className="modal-body text-center py-5">
                <div className="mb-4">
                  <span className={`display-5 fw-bold ${(data.pending_trade?.signal || "").includes("CALL") ? "neon-text-success" : "neon-text-danger"}`}>
                    {data.pending_trade.signal}
                  </span>
                </div>
                <div className="p-3 bg-dark bg-opacity-50 rounded-4 border border-secondary border-opacity-25 shadow-sm">
                  <div className="d-flex justify-content-around">
                    <div><div className="text-secondary small text-uppercase">Entry</div><div className="fw-bold fs-4">₹{data.pending_trade.entry}</div></div>
                    <div className="border-start border-secondary opacity-25"></div>
                    <div><div className="text-secondary small text-uppercase">Stop Loss</div><div className="fw-bold fs-4 text-danger">₹{data.pending_trade.sl}</div></div>
                    <div className="border-start border-secondary opacity-25"></div>
                    <div><div className="text-secondary small text-uppercase">Target</div><div className="fw-bold fs-4 text-success">₹{data.pending_trade.target}</div></div>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top border-secondary border-opacity-25 justify-content-center gap-3 pt-4">
                <button onClick={() => fetch(`${API}/confirm`, { method: "POST" })} className="btn neon-success btn-lg px-5 fw-bold shadow">EXECUTE</button>
                <button onClick={() => fetch(`${API}/reject`, { method: "POST" })} className="btn neon-danger btn-lg px-5 fw-bold shadow">DISCARD</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Header */}
      <div className="container-fluid pt-3 pb-2 sticky-top" style={{ zIndex: 1000 }}>
        <nav className="navbar navbar-expand-lg glass-panel px-4 py-3 shadow-lg">
          <div className="container-fluid">
            <div className="d-flex align-items-center">
              <span className="navbar-brand fw-black fs-3 ls-1 me-4 mb-0 text-white" style={{ letterSpacing: '2px' }}>
                NIFTY<span className="neon-text-primary fw-bold">BOT</span> <span className="fs-6 opacity-50 ms-1 fw-light">AI Paper Trading</span>
              </span>
              <span className={`badge rounded-pill px-3 py-2 ms-2 ${data.trading_active ? 'neon-success' : 'neon-danger'} shadow-sm`}>
                <i className={`bi ${data.trading_active ? 'bi-radar' : 'bi-pause-circle-fill'} me-2`}></i>
                {data.trading_active ? "LIVE TRADING" : "SYSTEM PAUSED"}
              </span>
            </div>

            <div className="d-flex align-items-center gap-4 ms-auto">
              <div className="d-none d-md-flex align-items-center gap-2 border-end border-secondary border-opacity-50 pe-4">
                <div className="text-end">
                  <span className="text-secondary x-small fw-bold d-block text-uppercase ls-2">Market Price</span>
                  <span className="text-white fw-bold fs-5">₹{data.price}</span>
                </div>
              </div>
              <div className="d-none d-md-flex align-items-center gap-2 border-end border-secondary border-opacity-50 pe-4">
                <div className="text-end">
                  <span className="text-secondary x-small fw-bold d-block text-uppercase ls-2">Status Signal</span>
                  <span className={(data.signal || "").includes("WAIT") ? "text-secondary fw-bold fs-5" : "neon-text-warning fw-bold fs-5"}>{data.signal}</span>
                </div>
              </div>
              <div className="ps-2">
                <div className="text-secondary x-small fw-bold text-uppercase ls-2 mb-1">Session Net P&L</div>
                <div className={`h3 mb-0 fw-bold ${data.report.total_pnl >= 0 ? "neon-text-success" : "neon-text-danger"}`}>
                  {data.report.total_pnl >= 0 ? "+" : ""}₹{data.report.total_pnl}
                </div>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <div className="container-fluid p-4">
        {/* Metric Cards Row */}
        <div className="row g-4 mb-4">
          <div className="col-md-4 col-12">
            <div className="card glass-panel h-100 border-0 p-3 shadow-lg">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-primary bg-opacity-25 p-3 me-3">
                  <i className="bi bi-bullseye fs-4 neon-text-primary"></i>
                </div>
                <div>
                  <div className="text-secondary x-small fw-bold text-uppercase ls-2 mb-1">ATM Strike</div>
                  <div className="h3 mb-0 fw-bold text-white">{data.atm}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4 col-12">
            <div className="card glass-panel h-100 border-0 p-3 shadow-lg">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-warning bg-opacity-25 p-3 me-3">
                  <i className="bi bi-diagram-3-fill fs-4 neon-text-warning"></i>
                </div>
                <div>
                  <div className="text-secondary x-small fw-bold text-uppercase ls-2 mb-1">Trades Executed</div>
                  <div className="h3 mb-0 fw-bold text-white">{data.report.total_trades}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4 col-12">
            <div className="card glass-panel h-100 border-0 p-3 shadow-lg">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="text-secondary x-small fw-bold text-uppercase ls-2">Active Limit</div>
                  <div className="h4 mb-0 fw-bold text-white">{data.report.active_count} <span className="opacity-50">/ 5 slots</span></div>
                </div>
                <div className="rounded-circle p-2 bg-info bg-opacity-10 text-info">
                  <i className="bi bi-cpu-fill fs-5"></i>
                </div>
              </div>
              <div className="progress mt-2" style={{ height: '6px', background: 'rgba(255,255,255,0.1)' }}>
                <div className="progress-bar bg-info progress-bar-striped progress-bar-animated" style={{ width: `${(data.report.active_count / 5) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Main Chart Area */}
          <div className="col-lg-9">
            <div className="card glass-panel border-0 shadow-lg h-100">
              <div className="card-header bg-transparent border-bottom border-light border-opacity-10 py-3 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <h6 className="mb-0 fw-bold ls-1 text-light text-uppercase"><i className="bi bi-activity neon-text-primary me-2"></i>Live Metrics Matrix</h6>
                </div>
                <div className="d-flex gap-2">
                  <div className="btn-group btn-group-sm">
                    {["1m", "5m", "15m"].map(t => (
                      <button key={t} onClick={() => setIntervalVal(t)} className={`btn ${interval === t ? 'btn-primary' : 'btn-outline-light text-opacity-50'} glass-btn shadow-none`}>{t}</button>
                    ))}
                  </div>
                  <div className="btn-group btn-group-sm ms-2">
                    <button onClick={zoomIn} className="btn btn-outline-light text-opacity-50 glass-btn shadow-none"><i className="bi bi-zoom-in"></i></button>
                    <button onClick={zoomOut} className="btn btn-outline-light text-opacity-50 glass-btn shadow-none"><i className="bi bi-zoom-out"></i></button>
                  </div>
                </div>
              </div>
              <div className="card-body p-3" style={{ height: "400px" }}>
                {data?.chart_processed?.length > 0 && (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={data.chart_processed}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="displayTime" stroke="rgba(255,255,255,0.3)" fontSize={10} tickMargin={10} minTickGap={30} axisLine={false} tickLine={false} />
                      <YAxis domain={[visiblePrices.min, visiblePrices.max]} orientation="right" stroke="rgba(255,255,255,0.5)" fontSize={10} tickFormatter={(val) => Math.round(val)} allowDataOverflow={true} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "rgba(10, 15, 30, 0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", backdropFilter: "blur(10px)" }} itemStyle={{ fontSize: "12px" }} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '5 5' }} />
                      <Bar dataKey="wick" barSize={2} isAnimationActive={false}>
                        {data.chart_processed?.map((entry, index) => <Cell key={`wick-${index}`} fill={entry.color} />)}
                      </Bar>
                      <Bar dataKey="body" barSize={8} radius={[4, 4, 4, 4]} isAnimationActive={false}>
                        {data.chart_processed?.map((entry, index) => <Cell key={`body-${index}`} fill={entry.color} />)}
                      </Bar>
                      <Line type="monotone" dataKey="ema20" stroke="#00f2fe" strokeWidth={2} dot={false} isAnimationActive={false} style={{ filter: 'drop-shadow(0 0 5px rgba(0, 242, 254, 0.5))' }} />
                      <Line type="monotone" dataKey="ema50" stroke="#f093fb" strokeWidth={2} dot={false} isAnimationActive={false} style={{ filter: 'drop-shadow(0 0 5px rgba(240, 147, 251, 0.5))' }} />
                      <Brush dataKey="displayTime" height={30} stroke="rgba(255,255,255,0.1)" fill="rgba(0,0,0,0.2)" startIndex={viewport.start} endIndex={viewport.end} onChange={(e) => setViewport({ start: e.startIndex, end: e.endIndex })} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="card-footer bg-transparent border-top border-light border-opacity-10 py-3 d-flex flex-wrap gap-4 text-xs font-monospace opacity-75">
                <span className="fw-bold neon-text-primary"><i className="bi bi-record-circle-fill me-1" style={{ fontSize: '8px' }}></i> EMA-20</span>
                <span className="fw-bold" style={{ color: '#f093fb', textShadow: '0 0 8px rgba(240, 147, 251, 0.6)' }}><i className="bi bi-record-circle-fill me-1" style={{ fontSize: '8px' }}></i> EMA-50</span>
                <span className="ms-auto text-light">BUFFER: {viewport.end - viewport.start + 1} CANDLES</span>
              </div>
            </div>
          </div>

          {/* Side Controls Area */}
          <div className="col-lg-3">
            <div className="card glass-panel border-0 shadow-lg h-100 flex-column justify-content-between p-4">
              <div className="text-center mb-0">
                <h5 className="fw-bold ls-2 text-uppercase text-secondary mb-1">Engine Control</h5>
                <div className="opacity-50 small font-monospace">SYSTEM DIRECTIVE</div>
                {data.trading_active && (
                  <div className="mt-2 badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 py-2 px-3">
                    <i className="bi bi-stack me-2"></i>Active: {data.num_lots} Lots ({data.total_units} Units)
                  </div>
                )}
              </div>
              <div className="d-grid gap-4 mt-auto mb-4">
                <button
                  onClick={toggleEngine}
                  className={`btn btn-lg py-4 fw-black neon-btn ${data.trading_active ? 'neon-danger' : 'neon-success'}`}
                  style={{ fontSize: '1.2rem', letterSpacing: '3px' }}
                >
                  <i className={`bi ${data.trading_active ? 'bi-stop-fill' : 'bi-lightning-charge-fill'} me-2`}></i>
                  {data.trading_active ? "HALT ENGINE" : "IGNITE ENGINE"}
                </button>

                <button onClick={handleClear} className="btn py-2 text-danger fw-bold glass-btn border-0 shadow-none hover-glow">
                  <i className="bi bi-trash3-fill me-2"></i>PURGE MEMORY
                </button>
              </div>

              <div className="py-2 border-top border-light border-opacity-10 mb-3">
                <button
                  className="btn w-100 py-2 mb-3 fw-bold glass-btn text-info border border-info border-opacity-25"
                  onClick={() => setShowOptionChain(true)}
                >
                  <i className="bi bi-list-columns-reverse me-2"></i>OPTION CHAIN MATRIX
                </button>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-secondary small fw-bold font-monospace">SPOT PRICE</span>
                  <span className="text-white fw-bold font-monospace">{data.price}</span>
                </div>
                {data.oi_data && (
                  <>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-secondary small fw-bold font-monospace">PCR</span>
                      <span className={`fw-bold font-monospace ${parseFloat(data.oi_data.pcr) >= 1 ? 'text-success' : 'text-danger'}`}>{parseFloat(data.oi_data.pcr).toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-secondary small fw-bold font-monospace">CE : PE OI</span>
                      <span className="fw-bold text-info font-monospace">
                        {(data.oi_data.ce_oi_change / 100000).toFixed(1)}M : {(data.oi_data.pe_oi_change / 100000).toFixed(1)}M
                      </span>
                    </div>
                  </>
                )}

                <div className="mt-3 mb-2 x-small fw-bold text-uppercase text-secondary ls-2"><i className="bi bi-crosshair me-1"></i> Trailing Matrix</div>
                {data.active_trade ? (
                  <>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-secondary small font-monospace">SL</span>
                      <span className="text-danger fw-bold font-monospace">{data.active_trade.sl}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-secondary small font-monospace">TSL 1 <span className="opacity-50">(Original)</span></span>
                      <span className="text-warning fw-bold font-monospace text-opacity-75">{data.active_trade.trailing_sl || 'PENDING'}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-secondary small font-monospace">TSL 2 <span className="opacity-50">(Partial)</span></span>
                      <span className="text-info fw-bold font-monospace text-opacity-75">{data.active_trade.partial_booked ? data.active_trade.trailing_sl : 'LOCKED'}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-secondary small font-monospace">TSL 3 <span className="opacity-50">(Runner)</span></span>
                      <span className="text-success fw-bold font-monospace text-opacity-50">LOCKED</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2 text-secondary font-monospace small opacity-50 border border-secondary border-opacity-25 rounded mt-2" style={{ borderStyle: 'dashed !important' }}>
                    NO ACTIVE TRADE
                  </div>
                )}
              </div>

              <div className="border-top border-light border-opacity-10 pt-4 mt-auto">
                <div className="mb-3">
                  <label className="x-small text-secondary fw-bold text-uppercase mb-2 ls-1 d-block"><i className="bi bi-calendar-event me-2"></i>Date Pointer</label>
                  <input type="date" className="form-control form-control-lg text-white border-0 shadow-none font-monospace" value={exportDate} onChange={(e) => setExportDate(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)' }} />
                </div>
                <button className="btn w-100 py-3 fw-bold text-dark neon-btn" style={{ background: 'linear-gradient(45deg, #00c6fb, #005bea)' }} onClick={() => window.open(`${API}/export?date=${exportDate}`)}>
                  <i className="bi bi-file-earmark-excel-fill me-2"></i>EXTRACT DATA
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Log / Trade Table */}
        <div className="card glass-panel border-0 shadow-lg mt-4 overflow-hidden">
          <div className="card-header bg-transparent border-bottom border-light border-opacity-10 d-flex justify-content-between align-items-center py-4 px-4">
            <h6 className="mb-0 fw-bold ls-2 text-light text-uppercase"><i className="bi bi-hdd-network neon-text-primary me-2"></i>Execution Immutable Ledger</h6>
            <span className="badge bg-dark border border-secondary border-opacity-50 text-secondary fw-bold text-uppercase font-monospace px-3 py-2">LIVE STREAM</span>
          </div>
          <div className="table-responsive">
            <table className="table table-borderless futuristic-table align-middle mb-0">
              <thead className="bg-black bg-opacity-25">
                <tr>
                  <th className="ps-5 py-3">Timestamp</th>
                  <th className="py-3">Vector</th>
                  <th className="py-3">Execution Point</th>
                  <th className="py-3">Realized Value</th>
                  <th className="py-3 text-center">Protocol State</th>
                </tr>
              </thead>
              <tbody>
                {(data.report?.trades || []).length > 0 ? (
                  (data.report?.trades || []).map((t) => (
                    <tr key={t.id}>
                      <td className="ps-5 py-4 text-secondary font-monospace fw-bold">{new Date(t.entry_unix * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true })}</td>
                      <td>
                        <span className={`badge px-4 py-2 rounded-pill font-monospace ${t.type === "CALL" ? 'bg-success bg-opacity-25 text-success border border-success border-opacity-25' : 'bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25'}`}>
                          <i className={`bi ${t.type === "CALL" ? 'bi-arrow-up-right' : 'bi-arrow-down-right'} me-1`}></i> {t.type}
                        </span>
                      </td>
                      <td className="fw-black fs-5">₹{t.entry}</td>
                      <td className={`fw-black fs-5 ${t.pnl >= 0 ? "neon-text-success" : "neon-text-danger"}`}>
                        {t.pnl >= 0 ? "+" : ""}₹{t.pnl.toLocaleString('en-IN')}
                      </td>
                      <td className="text-center">
                        <span className={`badge rounded-pill px-4 py-2 fw-bold text-uppercase ls-1 ${t.status === "OPEN" ? 'bg-info bg-opacity-25 text-info border border-info border-opacity-25 glow-primary' :
                          t.status?.includes('TARGET') ? 'neon-success text-white' :
                            'neon-danger text-white'
                          }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-5">
                      <div className="py-5 opacity-25">
                        <i className="bi bi-modem display-1 d-block mb-4"></i>
                        <div className="text-uppercase ls-2 fw-bold text-secondary font-monospace">Awaiting Valid Market Vectors</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;