import os
import jwt
from flask import request, jsonify, session, current_app

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
JWT_SECRET = os.getenv("SECRET_KEY")

# List of routes that don't require authentication
PUBLIC_ROUTES = [
    "/",
    "/login",
    "/auth/callback",
    "/logout",
    "/google",
    "/static",
    "/me",
    "/dev-bypass"
]

def check_auth():
    """
    Middleware function to check if the user is authenticated and is the admin.
    """
    path = request.path
    
    # Skip check for OPTIONS requests (CORS preflight)
    if request.method == "OPTIONS":
        return None

    # Skip check for public routes
    if any(path == route or path.startswith(route + "/") for route in PUBLIC_ROUTES):
        return None

    # Skip check if in DEV_MODE
    if os.getenv("DEV_MODE") == "1":
        return None

    # Skip check for internal Google OAuth routes
    if path.startswith("/login/google"):
        return None

    # Check for token in session or Authorization header
    token = session.get("jwt_token")
    
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    if not token:
        return jsonify({"error": "Unauthorized: No token provided"}), 401

    try:
        # Decode token
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        
        # Admin check removed as per user request - allow any verified Google user
            
        # Success - allow request to proceed
        return None
        
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Unauthorized: Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Unauthorized: Invalid token"}), 401
    except Exception as e:
        return jsonify({"error": f"Unauthorized: {str(e)}"}), 401

def init_auth_middleware(app):
    """Register the before_request hook"""
    app.before_request(check_auth)
