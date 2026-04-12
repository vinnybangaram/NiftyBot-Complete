import os
import jwt
from datetime import datetime, timedelta, timezone
from flask import Blueprint, redirect, url_for, session, jsonify, request, current_app
from flask_dance.contrib.google import make_google_blueprint, google
from functools import wraps

# Constants (Validated in app.py)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
JWT_SECRET = os.getenv("SECRET_KEY")
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Debugging Support (Required)
print("--- [AUTH DEBUG] ---")
print(f"ADMIN_EMAIL loaded: {bool(ADMIN_EMAIL)}")
print(f"JWT_SECRET loaded: {bool(JWT_SECRET)} (Length: {len(JWT_SECRET) if JWT_SECRET else 0})")
print(f"GOOGLE_CLIENT_ID loaded: {bool(CLIENT_ID)} (Length: {len(CLIENT_ID) if CLIENT_ID else 0})")
print(f"GOOGLE_CLIENT_SECRET loaded: {bool(CLIENT_SECRET)} (Length: {len(CLIENT_SECRET) if CLIENT_SECRET else 0})")
print("--------------------")

TOKEN_EXPIRY_HOURS = 24

# Simple login tracking (Bonus)
login_stats = {
    "date": datetime.now().date(),
    "count": 0
}

def track_login():
    """Simple daily login counter"""
    today = datetime.now().date()
    if login_stats["date"] != today:
        login_stats["date"] = today
        login_stats["count"] = 0
    login_stats["count"] += 1

auth_bp = Blueprint("auth", __name__)

# Google OAuth Blueprint
google_bp = make_google_blueprint(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    scope=[
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "openid"
    ],

    redirect_to="auth.callback"
)

def create_token(user_info):
    """Generate JWT token for the user"""
    payload = {
        "email": user_info.get("email"),
        "name": user_info.get("name"),
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

@auth_bp.route("/login")
def login():
    if not google.authorized:
        return redirect(url_for("google.login"))
    return redirect(url_for("auth.callback"))

@auth_bp.route("/auth/callback")
def callback():
    # OAuth Error Handling
    if not google.authorized:
        print(f"[{datetime.now()}] OAUTH ERROR: Google authorization failed")
        error_msg = request.args.get("error")
        error_desc = request.args.get("error_description")
        return jsonify({
            "error": "OAuth Authorization Failed",
            "details": error_msg,
            "description": error_desc
        }), 401
    
    try:
        resp = google.get("/oauth2/v2/userinfo")
        if not resp.ok:
            print(f"[{datetime.now()}] LOGIN FAILED: Could not fetch Google user info. Status: {resp.status_code}")
            return jsonify({
                "error": "Failed to fetch user info from Google",
                "status": resp.status_code,
                "response": resp.text
            }), 401
    except Exception as e:
        print(f"[{datetime.now()}] OAUTH EXCEPTION: {str(e)}")
        return jsonify({
            "error": "Internal OAuth Exception",
            "details": str(e)
        }), 500
    
    user_info = resp.json()
    email = user_info.get("email")

    # Admin verification removed as per user request
    # Anyone with a valid Google account can now access the system

    # Generate JWT
    token = create_token(user_info)
    
    # Store token in session or return it
    session["jwt_token"] = token
    
    # Track success (Bonus)
    track_login()
    print(f"[{datetime.now()}] LOGIN SUCCESS: {email} (Daily logins: {login_stats['count']})")
    
    # Redirect back to the React Dashboard
    return redirect("http://localhost:3000")

@auth_bp.route("/logout")
def logout():
    session.clear()
    if 'google_oauth_token' in session:
        del session['google_oauth_token']
    return jsonify({"status": "success", "message": "Logged out successfully"})

@auth_bp.route("/me")
def me():
    # This will be protected by middleware, but we can double check here
    token = session.get("jwt_token") or request.headers.get("Authorization")
    if not token:
        return jsonify({"error": "Unauthorized"}), 401
    
    if token.startswith("Bearer "):
        token = token[7:]
        
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return jsonify({"user": data})
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401
