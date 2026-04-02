from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import uuid

db = SQLAlchemy()

class Trade(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    type = db.Column(db.String(10), nullable=False) # CALL / PUT
    signal = db.Column(db.String(50), nullable=False)
    entry_price = db.Column(db.Float, nullable=False)
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

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "signal": self.signal,
            "entry": self.entry_price,
            "sl": self.sl,
            "target": self.target,
            "exit": self.exit_price,
            "pnl": self.pnl,
            "status": self.status,
            "entry_time": self.entry_time.strftime("%H:%M:%S") if self.entry_time else None,
            "exit_time": self.exit_time.strftime("%H:%M:%S") if self.exit_time else None,
            "entry_unix": int(self.entry_time.replace(tzinfo=timezone.utc).timestamp()) if self.entry_time else None,
            "exit_unix": int(self.exit_time.replace(tzinfo=timezone.utc).timestamp()) if self.exit_time else None,
            "full_time": self.entry_time.strftime("%Y-%m-%d %H:%M:%S") if self.entry_time else None
        }
