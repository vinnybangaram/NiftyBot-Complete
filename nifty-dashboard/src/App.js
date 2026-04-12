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
import Login from './Login';


const App = () => {
  const [data, setData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [user, setUser] = useState(null);
  const [exportDate, setExportDate] = useState(new Date().toISOString().split('T')[0]);
  const [interval, setIntervalVal] = useState("5m");
  const [viewport, setViewport] = useState({ start: 0, end: 0 });
  const [showOptionChain, setShowOptionChain] = useState(false);
  const [maxTrades, setMaxTrades] = useState(3);
  const [numLots, setNumLots] = useState(1);

  const API = "http://localhost:5000";
  useEffect(() => {
    const fetchLoop = async () => {
      try {

        const res = await fetch(`${API}/data?date=${exportDate}&interval=${interval}`, {
          credentials: 'include'
        });

        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }

        setIsAuthenticated(true);
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
      } catch (err) { console.error(err); }
    };

    const fetchUser = async () => {
      try {
        const res = await fetch(`${API}/me`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setUser(json.user);
        }
      } catch (err) { console.error("User fetch failed", err); }
    };

    fetchLoop();
    if (isAuthenticated && !user) fetchUser();

    const timer = setInterval(fetchLoop, 5000);
    return () => clearInterval(timer);
  }, [exportDate, interval, viewport.end, isAuthenticated, user]);

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


  const handleLogout = async () => {
    try {
      await fetch(`${API}/logout`, { credentials: 'include' });
      setIsAuthenticated(false);
      setUser(null);
      setData(null);
    } catch (err) { console.error("Logout failed", err); }
  };

  if (!isAuthenticated) return <Login />;

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

      {/* Floating Header */}
      <div className="container-fluid pt-3 pb-2 sticky-top" style={{ zIndex: 1000 }}>
        <nav className="navbar navbar-expand-lg glass-panel px-3 py-3 shadow-lg">
          <div className="container-fluid flex-wrap flex-lg-nowrap gap-3">
            <div className="d-flex align-items-center flex-wrap gap-2">
              <span className="navbar-brand fw-black fs-3 ls-1 me-2 mb-0 text-white" style={{ letterSpacing: '2px' }}>
                NIFTY<span className="neon-text-primary fw-bold">BOT</span> <span className="fs-6 opacity-50 ms-1 fw-light d-none d-sm-inline">AI Paper Trading</span>
              </span>
              <span className={`badge rounded-pill px-3 py-2 ${data?.trading_active ? 'neon-success' : 'neon-danger'} shadow-sm`}>
                <i className={`bi ${data?.trading_active ? 'bi-radar' : 'bi-pause-circle-fill'} me-2`}></i>
                {data?.trading_active ? "LIVE" : "PAUSED"}
              </span>
            </div>

            <div className="d-flex align-items-center justify-content-between justify-content-lg-end gap-3 flex-grow-1">
              <div className="d-none d-xl-flex align-items-center gap-2 border-end border-secondary border-opacity-50 pe-3">
                <div className="text-end">
                  <span className="text-secondary x-small fw-bold d-block text-uppercase ls-2">Market</span>
                  <span className="text-white fw-bold fs-6">₹{data?.price || 0}</span>
                </div>
              </div>
              <div className="d-none d-md-flex align-items-center gap-2 border-end border-secondary border-opacity-50 pe-3">
                <div className="text-end">
                  <span className="text-secondary x-small fw-bold d-block text-uppercase ls-2">Signal</span>
                  <span className={data?.signal?.includes("WAIT") ? "text-secondary fw-bold fs-6" : "neon-text-warning fw-bold fs-6"}>{data?.signal || "N/A"}</span>
                </div>
              </div>
              <div className="pe-lg-3">
                <div className="text-secondary x-small fw-bold text-uppercase ls-2 mb-0 d-none d-sm-block">Net P&L</div>
                <div className={`h4 mb-0 fw-bold ${(data?.report?.total_pnl || 0) >= 0 ? "neon-text-success" : "neon-text-danger"}`}>
                  {(data?.report?.total_pnl || 0) >= 0 ? "+" : ""}₹{data?.report?.total_pnl || 0}
                </div>
              </div>

              {/* User Profile Dropdown */}
              <div className="ps-4 border-start border-secondary border-opacity-50">
                <div className="dropdown">
                  <button 
                    className="btn glass-btn py-2 px-3 d-flex align-items-center gap-2 rounded-pill border-0 shadow-none dropdown-toggle no-caret" 
                    type="button" 
                    data-bs-toggle="dropdown" 
                    aria-expanded="false"
                  >
                    <div className="rounded-circle bg-primary bg-opacity-20 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                      <i className="bi bi-person-fill neon-text-primary"></i>
                    </div>
                    <div className="text-start d-none d-lg-block me-2">
                      <div className="text-white small fw-bold mb-0 leading-none">{user?.name || 'Authorized User'}</div>
                      <div className="text-secondary x-small opacity-75">{user?.email || 'Administrator'}</div>
                    </div>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end glass-panel border-0 shadow-2xl p-2 mt-2" style={{ minWidth: '200px' }}>
                    <li>
                      <div className="dropdown-header text-secondary x-small fw-bold text-uppercase ls-1">Account Protocol</div>
                    </li>
                    <li><hr className="dropdown-divider border-light border-opacity-10" /></li>
                    <li>
                      <button className="dropdown-item rounded py-2 d-flex align-items-center gap-3 text-light hover-glow" onClick={() => setShowOptionChain(true)}>
                        <i className="bi bi-gear-fill opacity-50"></i> Configuration
                      </button>
                    </li>
                    <li>
                      <button className="dropdown-item rounded py-2 d-flex align-items-center gap-3 text-danger hover-glow-danger mt-1" onClick={handleLogout}>
                        <i className="bi bi-box-arrow-right"></i> Terminate Session
                      </button>
                    </li>
                  </ul>
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
                  <div className="h3 mb-0 fw-bold text-white">{data?.atm || "N/A"}</div>
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
                  <div className="h3 mb-0 fw-bold text-white">
                    {data?.trade_count_today || 0} <span className="fs-6 opacity-50 fw-normal">/ {data?.max_trades_today || 3} Today</span>
                  </div>
                </div>
              </div>
              <div className="progress mt-3" style={{ height: '4px', background: 'rgba(255,255,255,0.05)' }}>
                <div 
                  className="progress-bar bg-warning" 
                  style={{ width: `${Math.min(100, ((data?.trade_count_today || 0) / (data?.max_trades_today || 3)) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="col-md-4 col-12">
            <div className="card glass-panel h-100 border-0 p-3 shadow-lg">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="text-secondary x-small fw-bold text-uppercase ls-2">Open Positions</div>
                  <div className="h4 mb-0 fw-bold text-white">{data?.report?.active_count || 0} <span className="opacity-50">/ 1 Max</span></div>
                </div>
                <div className="rounded-circle p-2 bg-info bg-opacity-10 text-info">
                  <i className="bi bi-cpu-fill fs-5"></i>
                </div>
              </div>
              <div className="progress mt-2" style={{ height: '6px', background: 'rgba(255,255,255,0.1)' }}>
                <div className="progress-bar bg-info progress-bar-striped progress-bar-animated" style={{ width: `${((data?.report?.active_count || 0) / 1) * 100}%` }}></div>
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
              <div className="card-body p-3 d-flex flex-column flex-grow-1" style={{ minHeight: "450px" }}>
                {data?.chart_processed?.length > 0 && (
                  <div className="flex-grow-1 w-100" style={{ minHeight: '400px' }}>
                    <ResponsiveContainer width="100%" height="100%">
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
                  </div>
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
              </div>
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="x-small text-secondary fw-bold text-uppercase ls-1">Trades/Day</label>
                  <select 
                    className="form-select form-select-sm w-auto bg-dark border-secondary text-white shadow-none"
                    value={maxTrades}
                    onChange={(e) => setMaxTrades(parseInt(e.target.value))}
                    disabled={data?.trading_active}
                  >
                    {[1, 2, 3, 4, 5, 10, 20].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <label className="x-small text-secondary fw-bold text-uppercase ls-1">Number of Lots</label>
                  <input 
                    type="number"
                    min="1"
                    max="100"
                    className="form-control form-control-sm w-auto bg-dark border-secondary text-white shadow-none text-center"
                    value={numLots}
                    onChange={(e) => setNumLots(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    disabled={data?.trading_active}
                    style={{ width: '70px' }}
                  />
                </div>
                <button
                  onClick={async () => {
                    try {
                      // 1. Update settings if system is currently stopped
                      if (!data?.trading_active) {
                        const settingsRes = await fetch(`${API}/settings`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ 
                            max_trades: maxTrades,
                            lots: numLots
                          })
                        });
                        if (!settingsRes.ok) throw new Error("Settings update failed");
                      }

                      // 2. Toggle engine state
                      const toggleRes = await fetch(`${API}/${data?.trading_active ? "stop" : "start"}`, { 
                        method: "POST",
                        credentials: 'include'
                      });
                      if (!toggleRes.ok) throw new Error("Engine toggle failed");

                      // 3. Force immediate refresh of data state
                      const refreshRes = await fetch(`${API}/data`, { credentials: 'include' });
                      if (refreshRes.ok) {
                        const json = await refreshRes.json();
                        setData(prev => ({ ...prev, ...json }));
                      }
                      
                      console.log(`🚀 Engine ${data?.trading_active ? 'Stopped' : 'Ignited'} Successfully`);
                    } catch (err) {
                      console.error("📛 Engine Directive Error:", err);
                      alert(`Protocol Error: ${err.message}. Check console for telemetry.`);
                    }
                  }}
                  className={`btn btn-lg w-100 py-4 fw-black neon-btn ${data?.trading_active ? 'neon-danger' : 'neon-success'}`}
                  style={{ fontSize: '1.2rem', letterSpacing: '3px' }}
                >
                  <i className={`bi ${data?.trading_active ? 'bi-stop-fill' : 'bi-lightning-charge-fill'} me-2`}></i>
                  {data?.trading_active ? "HALT ENGINE" : "IGNITE ENGINE"}
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
                  <span className="text-white fw-bold font-monospace">{data?.price || 0}</span>
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
                <button className="btn w-100 py-3 fw-bold text-dark neon-btn" style={{ background: 'linear-gradient(45deg, #00c6fb, #005bea)' }} onClick={() => window.location.href = `${API}/export?date=${exportDate}`}>
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
                  <th className="py-3">Lots</th>
                  <th className="py-3">SL Setup</th>
                  <th className="py-3">TSL Goals (1,2,3)</th>
                  <th className="py-3">Exit Price</th>
                  <th className="py-3">Net P&L</th>
                  <th className="py-3 text-center">Protocol State</th>
                </tr>
              </thead>
              <tbody>
                {(data.report?.trades || []).length > 0 ? (
                  (data.report?.trades || []).map((t) => (
                    <tr key={t.id}>
                      <td className="ps-5 py-4 text-secondary font-monospace fw-bold" style={{ fontSize: '0.85rem' }}>{t.entry_time}</td>
                      <td>
                        <span className={`badge px-3 py-1 rounded-pill font-monospace ${t.type === "CALL" ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-10' : 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-10'}`}>
                          {t.type} @ {t.entry}
                        </span>
                      </td>
                      <td className="fw-bold text-info font-monospace">{t.lots}</td>
                      <td className={`font-monospace fw-bold ${t.hit_sl ? 'text-danger' : 'text-secondary opacity-50'}`}>
                        {t.sl}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <span className={`badge border font-monospace ${t.hit_tsl1 ? 'border-success text-success bg-success bg-opacity-10' : 'border-secondary text-secondary opacity-25'}`} style={{ fontSize: '0.7rem' }}>{t.tsl1}</span>
                          <span className={`badge border font-monospace ${t.hit_tsl2 ? 'border-success text-success bg-success bg-opacity-10' : 'border-secondary text-secondary opacity-25'}`} style={{ fontSize: '0.7rem' }}>{t.tsl2}</span>
                          <span className={`badge border font-monospace ${t.hit_tsl3 ? 'border-success text-success bg-success bg-opacity-10' : 'border-secondary text-secondary opacity-25'}`} style={{ fontSize: '0.7rem' }}>{t.tsl3}</span>
                        </div>
                      </td>
                      <td className="fw-bold font-monospace">₹{t.exit || '---'}</td>
                      <td className={`fw-black fs-5 ${t.pnl >= 0 ? "neon-text-success" : "neon-text-danger"}`}>
                        {t.pnl >= 0 ? "+" : ""}₹{t.pnl.toLocaleString('en-IN')}
                      </td>
                      <td className="text-center">
                        <span className={`badge rounded-pill px-4 py-2 fw-bold text-uppercase ls-1 ${t.status === "OPEN" ? 'bg-info bg-opacity-25 text-info border border-info border-opacity-25 glow-primary' :
                          t.status.includes('TARGET') ? 'neon-success text-white' :
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