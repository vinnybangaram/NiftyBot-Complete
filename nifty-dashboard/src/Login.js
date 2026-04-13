import React from 'react';

const Login = () => {
  const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const handleLogin = () => {
    window.location.href = `${API}/login/google`;
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-4" style={{ 
      background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Animated Background Elements */}
      <div className="position-absolute" style={{
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(0, 198, 251, 0.1) 0%, transparent 70%)',
        top: '-100px',
        right: '-100px',
        zIndex: 0
      }}></div>
      <div className="position-absolute" style={{
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, transparent 70%)',
        bottom: '-200px',
        left: '-200px',
        zIndex: 0
      }}></div>

      <div className="card glass-panel border-0 shadow-2xl p-5 text-center" style={{ 
        maxWidth: '450px', 
        width: '100%',
        zIndex: 1,
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.05) !important'
      }}>
        <div className="mb-5">
          <div className="d-inline-block rounded-circle p-4 mb-4" style={{ 
            background: 'linear-gradient(135deg, rgba(0, 198, 251, 0.2), rgba(0, 91, 234, 0.2))',
            boxShadow: '0 0 40px rgba(0, 198, 251, 0.2)'
          }}>
            <i className="bi bi-robot fs-1 neon-text-primary"></i>
          </div>
          <h1 className="fw-black text-white ls-2 uppercase mb-1" style={{ letterSpacing: '4px' }}>
            NIFTY<span className="neon-text-primary">BOT</span>
          </h1>
          <p className="text-secondary small fw-bold text-uppercase ls-1 opacity-75">
            Institutional AI Trading Terminal
          </p>
        </div>

        <div className="mb-5">
          <h4 className="text-white fw-bold mb-3">Welcome Back, Commander</h4>
          <p className="text-secondary small mb-4">
            Authorized personnel only. Please verify your identity to access the trading matrix and execution engine.
          </p>
        </div>

        <button 
          onClick={handleLogin}
          className="btn btn-lg w-100 py-3 mb-3 d-flex align-items-center justify-content-center gap-3 glass-btn neon-border-primary"
          style={{ 
            background: 'rgba(255, 255, 255, 0.03)',
            transition: 'all 0.3s ease'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="fw-bold text-white ls-1">Continue with Google</span>
        </button>

        <button 
          onClick={() => window.location.href = `${API}/dev-bypass`}
          className="btn btn-sm w-100 py-2 mb-4 d-flex align-items-center justify-content-center gap-2"
          style={{ 
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px dashed rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.5)',
            transition: 'all 0.3s ease'
          }}
        >
          <i className="bi bi-code-slash"></i>
          <span className="fw-bold x-small text-uppercase ls-1">Developer Bypass</span>
        </button>

        <div className="d-flex align-items-center gap-2 justify-content-center opacity-50">
          <div style={{ height: '1px', width: '30px', background: 'white' }}></div>
          <span className="x-small text-white font-monospace">SECURED BY OAUTH 2.0</span>
          <div style={{ height: '1px', width: '30px', background: 'white' }}></div>
        </div>

        <div className="mt-5 pt-4 border-top border-light border-opacity-5">
          <p className="x-small text-secondary mb-0 font-monospace uppercase ls-1">
            System Status: <span className="text-success">Encryption Active</span>
          </p>
        </div>
      </div>

      {/* Decorative Lines */}
      <div className="position-absolute w-100 h-100 overflow-hidden" style={{ zIndex: 0, pointerEvents: 'none' }}>
        <div className="position-absolute w-100" style={{ height: '1px', top: '20%', background: 'linear-gradient(90deg, transparent, rgba(0, 198, 251, 0.1), transparent)' }}></div>
        <div className="position-absolute w-100" style={{ height: '1px', top: '80%', background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.1), transparent)' }}></div>
        <div className="position-absolute h-100" style={{ width: '1px', left: '20%', background: 'linear-gradient(180deg, transparent, rgba(0, 198, 251, 0.1), transparent)' }}></div>
        <div className="position-absolute h-100" style={{ width: '1px', left: '80%', background: 'linear-gradient(180deg, transparent, rgba(168, 85, 247, 0.1), transparent)' }}></div>
      </div>
    </div>
  );
};

export default Login;
