from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import uuid

db = SQLAlchemy()

class Trade(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email = db.Column(db.String(120), nullable=True) # For user-specific filtering
    type = db.Column(db.String(10), nullable=False) # CALL / PUT
    signal = db.Column(db.String(50), nullable=False)
    entry_price = db.Column(db.Float, nullable=False)
    num_lots = db.Column(db.Integer, default=1) # Scalable lot size
    sl = db.Column(db.Float, nullable=False)
    target = db.Column(db.Float, nullable=False)
    exit_price = db.Column(db.Float)
    pnl = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default="OPEN") # OPEN, TARGET HIT, SL HIT, MANUAL EXIT
    entry_time = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    exit_time = db.Column(db.DateTime)
    
    # 🌟 Advanced Execution Management
    partial_booked = db.Column(db.Boolean, default=False)
    realized_partial_pnl = db.Column(db.Float, default=0.0)
    active_multiplier = db.Column(db.Float, default=1.0)
    trailing_sl = db.Column(db.Float, nullable=True)
    
    # 🎯 Status Tracking for UI Cells
    hit_sl = db.Column(db.Boolean, default=False)
    
    # TSL Goals (Store Trigger Prices)
    tsl_1 = db.Column(db.Float, nullable=True) # +30 pts (Partial)
    tsl_2 = db.Column(db.Float, nullable=True) # +50 pts (Trial)
    tsl_3 = db.Column(db.Float, nullable=True) # +80 pts (Runner)
    
    hit_tsl1 = db.Column(db.Boolean, default=False)
    hit_tsl2 = db.Column(db.Boolean, default=False)
    hit_tsl3 = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user_email,
            "type": self.type,
            "signal": self.signal,
            "entry": self.entry_price,
            "lots": self.num_lots,
            "sl": self.sl,
            "target": self.target,
            "exit": self.exit_price,
            "pnl": self.pnl,
            "status": self.status,
            "partial_booked": self.partial_booked,
            "trailing_sl": self.trailing_sl,
            "hit_sl": self.hit_sl,
            "tsl1": self.tsl_1,
            "tsl2": self.tsl_2,
            "tsl3": self.tsl_3,
            "hit_tsl1": self.hit_tsl1,
            "hit_tsl2": self.hit_tsl2,
            "hit_tsl3": self.hit_tsl3,
            "entry_time": self.entry_time.strftime("%H:%M:%S") if self.entry_time else None,
            "exit_time": self.exit_time.strftime("%H:%M:%S") if self.exit_time else None,
            "entry_unix": int(self.entry_time.replace(tzinfo=timezone.utc).timestamp()) if self.entry_time else None,
            "exit_unix": int(self.exit_time.replace(tzinfo=timezone.utc).timestamp()) if self.exit_time else None,
            "full_time": self.entry_time.strftime("%Y-%m-%d %H:%M:%S") if self.entry_time else None
        }
