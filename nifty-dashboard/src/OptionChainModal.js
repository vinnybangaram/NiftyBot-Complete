import React, { useEffect, useState } from 'react';

const OptionChainModal = ({ isOpen, onClose, currentPrice, oiData }) => {
  const [strikes, setStrikes] = useState([]);
  const [atmStrike, setAtmStrike] = useState(0);

  useEffect(() => {
    if (isOpen && currentPrice) {
      // Calculate ATM
      const interval = 50; // Nifty option contract interval
      const atm = Math.round(currentPrice / interval) * interval;
      setAtmStrike(atm);

      // Generate strikes (30 above, 30 below)
      const newStrikes = [];
      for (let i = -30; i <= 30; i++) {
        newStrikes.push(atm + i * interval);
      }
      setStrikes(newStrikes);
    }
  }, [isOpen, currentPrice]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target.id === 'oc-modal-backdrop') {
      onClose();
    }
  };

  return (
    <div 
      id="oc-modal-backdrop"
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
      style={{ zIndex: 1050, backgroundColor: 'rgba(5, 8, 15, 0.85)', backdropFilter: 'blur(8px)' }}
      onClick={handleBackdropClick}
    >
      <div 
        className="card border-0 shadow-lg"
        style={{ 
            width: '90%', 
            maxWidth: '1000px', 
            height: '85vh', 
            backgroundColor: '#0a0f1e',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 0 30px rgba(0, 198, 251, 0.1)'
        }}
      >
        <div className="card-header bg-transparent border-bottom border-light border-opacity-10 d-flex justify-content-between align-items-center p-4">
          <div className="d-flex align-items-center">
            <h5 className="mb-0 fw-bold ls-2 text-uppercase text-light">
                <i className="bi bi-list-columns-reverse neon-text-primary me-3"></i> 
                Advanced Option Chain
            </h5>
            <span className="ms-4 px-3 py-1 bg-primary bg-opacity-25 text-info border border-primary border-opacity-25 rounded font-monospace small fw-bold">
              SPOT: {currentPrice}
            </span>
          </div>
          <button 
            className="btn btn-sm text-secondary hover-glow border-0 fs-5"
            onClick={onClose}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <div className="card-body p-0" style={{ overflowY: 'auto' }}>
          <table className="table table-borderless futuristic-table text-center mb-0" style={{ fontSize: '0.85rem' }}>
            <thead className="position-sticky top-0" style={{ backgroundColor: '#0f1423', zIndex: 1, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              <tr>
                <th colSpan="3" className="border-end border-opacity-10 border-light py-3">
                    <span className="text-success fw-black text-uppercase" style={{letterSpacing: '2px'}}>CALLS (CE)</span>
                </th>
                <th rowSpan="2" className="align-middle bg-primary bg-opacity-10 text-white font-monospace fw-bold fs-6">
                    STRIKE
                </th>
                <th colSpan="3" className="border-start border-opacity-10 border-light py-3">
                    <span className="text-danger fw-black text-uppercase" style={{letterSpacing: '2px'}}>PUTS (PE)</span>
                </th>
              </tr>
              <tr className="text-secondary x-small fw-bold border-bottom border-light border-opacity-10">
                <th className="py-2">OI</th>
                <th className="py-2">VOL</th>
                <th className="border-end border-opacity-10 border-light py-2">LTP</th>
                
                <th className="border-start border-opacity-10 border-light py-2">LTP</th>
                <th className="py-2">VOL</th>
                <th className="py-2">OI</th>
              </tr>
            </thead>
            <tbody className="font-monospace">
              {strikes.map((strike, idx) => {
                const isAtm = strike === atmStrike;
                const matrixData = oiData?.matrix ? oiData.matrix[strike.toString()] : null;

                const fLTP = (val) => val ? parseFloat(val).toFixed(2) : '-';
                const fNum = (val) => val ? parseInt(val).toLocaleString('en-IN') : '-';

                return (
                  <tr key={idx} style={{ 
                      backgroundColor: isAtm ? 'rgba(0, 198, 251, 0.1)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.02)'
                  }}>
                    <td className="text-secondary opacity-75 align-middle py-2">{fNum(matrixData?.ce_oi)}</td>
                    <td className="text-secondary opacity-75 align-middle py-2">{fNum(matrixData?.ce_vol)}</td>
                    <td className="text-success border-end border-opacity-10 border-light fw-bold align-middle py-2">{fLTP(matrixData?.ce_ltp)}</td>
                    
                    <td className={`align-middle py-2 fs-6 position-relative ${isAtm ? 'text-info fw-black' : 'text-light fw-bold'}`}>
                      {strike}
                      {isAtm && (
                          <span className="position-absolute translate-middle-y badge bg-white text-dark small" style={{ right: '10px', top: '50%', fontSize: '0.65rem' }}>
                              ATM
                          </span>
                      )}
                    </td>
                    
                    <td className="text-danger border-start border-opacity-10 border-light fw-bold align-middle py-2">{fLTP(matrixData?.pe_ltp)}</td>
                    <td className="text-secondary opacity-75 align-middle py-2">{fNum(matrixData?.pe_vol)}</td>
                    <td className="text-secondary opacity-75 align-middle py-2">{fNum(matrixData?.pe_oi)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OptionChainModal;
