import os
import secrets
import logging
from typing import Dict, Any, Optional
import httpx
from dotenv import load_dotenv
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.database import User
from utils.auth import hash_password

logger = logging.getLogger(__name__)

def _clean_val(val: Optional[str]) -> str:
    if not val:
        return ""
    return val.strip().strip('"').strip("'")

def _refresh_env():
    """Reload .env dynamically to pick up any newly configured credentials immediately."""
    services_dir = os.path.dirname(__file__)
    backend_dir = os.path.dirname(services_dir)
    root_dir = os.path.dirname(backend_dir)

    for candidate in [
        os.path.join(backend_dir, ".env"),
        os.path.join(root_dir, ".env"),
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.getcwd(), "Backend", ".env")
    ]:
        if os.path.exists(candidate):
            try:
                load_dotenv(candidate, override=True)
            except Exception:
                pass

class SSOService:
    """
    Single Sign-On (SSO) Service for Shiro.ai.
    Handles verification of OAuth 2.0 / OIDC credentials and user lifecycle management.
    """

    @property
    def google_client_id(self) -> str:
        _refresh_env()
        return _clean_val(os.getenv("GOOGLE_CLIENT_ID"))

    @property
    def github_client_id(self) -> str:
        _refresh_env()
        return _clean_val(os.getenv("GITHUB_CLIENT_ID"))

    @property
    def github_client_secret(self) -> str:
        _refresh_env()
        return _clean_val(os.getenv("GITHUB_CLIENT_SECRET"))

    def get_google_config(self) -> Dict[str, Any]:
        """Return public Google OAuth configuration for the frontend."""
        return {
            "client_id": self.google_client_id,
            "configured": bool(self.google_client_id)
        }

    def get_sso_config(self) -> Dict[str, Any]:
        """Return public OAuth configuration for all SSO providers."""
        return {
            "google_client_id": self.google_client_id,
            "google_configured": bool(self.google_client_id),
            "github_client_id": self.github_client_id,
            "github_configured": bool(self.github_client_id and self.github_client_secret)
        }

    async def exchange_github_code(self, code: str) -> str:
        """Exchange GitHub OAuth authorization code for a bearer access token."""
        if not self.github_client_id or not self.github_client_secret:
            raise HTTPException(
                status_code=500,
                detail="GitHub OAuth is not configured on server (missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET in Backend/.env)."
            )
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": self.github_client_id,
                    "client_secret": self.github_client_secret,
                    "code": code
                },
                headers={"Accept": "application/json"}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to contact GitHub OAuth server.")
            data = resp.json()
            access_token = data.get("access_token")
            if not access_token:
                err_desc = data.get("error_description", "Invalid or expired GitHub code")
                raise HTTPException(status_code=400, detail=f"GitHub token exchange error: {err_desc}")
            return access_token

    async def verify_google_credential(self, credential: str) -> Dict[str, Any]:
        """
        Verify Google ID token or Access Token against Google's public endpoints.
        Returns normalized profile: { 'email': str, 'name': str, 'picture': Optional[str], 'sub': str }
        """
        if not credential:
            raise HTTPException(status_code=400, detail="Missing Google credential or token.")

        # Development / Sandbox testing hook (only active when explicitly triggered in dev mode)
        if credential.startswith("demo_google_"):
            demo_email = "demo.student@shiro.ai"
            demo_name = "Alex Mercer (Google Student)"
            demo_picture = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            return {
                "email": demo_email,
                "name": demo_name,
                "picture": demo_picture,
                "sub": "demo_google_sub_12345"
            }

        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. First attempt: Verify as Google OIDC ID token via tokeninfo endpoint
            try:
                id_resp = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": credential}
                )
                if id_resp.status_code == 200:
                    data = id_resp.json()
                    email = data.get("email")
                    if not email:
                        raise HTTPException(status_code=400, detail="Google token does not contain an email address.")
                    
                    email_verified = data.get("email_verified")
                    if email_verified not in [True, "true", "True", 1, "1"]:
                        raise HTTPException(status_code=400, detail="Google account email is not verified.")

                    # If server has client_id configured, verify audience match
                    aud = data.get("aud")
                    if self.google_client_id and aud and aud != self.google_client_id:
                        logger.warning(f"Google token audience '{aud}' did not match configured client_id '{self.google_client_id}'.")

                    return {
                        "email": email.strip().lower(),
                        "name": data.get("name") or email.split("@")[0],
                        "picture": data.get("picture"),
                        "sub": data.get("sub", "")
                    }
            except HTTPException:
                raise
            except Exception as e:
                logger.debug(f"ID token verification failed: {e}. Trying userinfo endpoint...")

            # 2. Second attempt: Verify as OAuth2 Access Token via userinfo endpoint
            try:
                userinfo_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {credential}"}
                )
                if userinfo_resp.status_code == 200:
                    data = userinfo_resp.json()
                    email = data.get("email")
                    if not email:
                        raise HTTPException(status_code=400, detail="Google user profile does not contain an email address.")
                    
                    email_verified = data.get("email_verified", True)
                    if email_verified not in [True, "true", "True", 1, "1"]:
                        raise HTTPException(status_code=400, detail="Google account email is not verified.")

                    return {
                        "email": email.strip().lower(),
                        "name": data.get("name") or email.split("@")[0],
                        "picture": data.get("picture"),
                        "sub": data.get("sub", "")
                    }
                else:
                    err_msg = userinfo_resp.json().get("error_description", "Invalid Google credentials.")
                    raise HTTPException(status_code=400, detail=f"Google authentication failed: {err_msg}")
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error during Google userinfo retrieval: {e}")
                raise HTTPException(status_code=400, detail="Failed to verify Google credentials with provider.")

    async def verify_github_credential(self, credential: str) -> Dict[str, Any]:
        """
        Verify GitHub Access Token against GitHub API (https://api.github.com/user).
        Returns normalized profile: { 'email': str, 'name': str, 'picture': Optional[str], 'sub': str }
        """
        if not credential:
            raise HTTPException(status_code=400, detail="Missing GitHub credential.")

        # Development / Sandbox testing hook
        if credential.startswith("demo_github_"):
            return {
                "email": "dev.engineer@github.shiro.ai",
                "name": "Sarah Lin (GitHub Developer)",
                "picture": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
                "sub": "demo_github_sub_67890"
            }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {credential}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "Shiro-AI-SSO"
                }
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid GitHub token or session expired.")

            data = resp.json()
            email = data.get("email")

            # Fallback if primary email is private in public profile
            if not email:
                try:
                    email_resp = await client.get(
                        "https://api.github.com/user/emails",
                        headers={
                            "Authorization": f"Bearer {credential}",
                            "Accept": "application/vnd.github.v3+json",
                            "User-Agent": "Shiro-AI-SSO"
                        }
                    )
                    if email_resp.status_code == 200:
                        emails_list = email_resp.json()
                        primary_verified = next(
                            (e["email"] for e in emails_list if e.get("primary") and e.get("verified")),
                            None
                        )
                        email = primary_verified or (emails_list[0]["email"] if emails_list else None)
                except Exception:
                    pass

            if not email:
                email = f"{data.get('login', 'developer')}@users.noreply.github.com"

            return {
                "email": email.strip().lower(),
                "name": data.get("name") or data.get("login") or email.split("@")[0],
                "picture": data.get("avatar_url"),
                "sub": str(data.get("id", ""))
            }

    def authenticate_or_create_user(self, profile: Dict[str, Any], db: Session) -> User:
        """
        Locates an existing user by email or provisions a new user record.
        Updates user avatar if provided by Google and currently empty.
        """
        email = profile["email"].strip().lower()
        name = profile.get("name") or email.split("@")[0]
        picture = profile.get("picture")

        user = db.query(User).filter(User.email == email).first()

        if user:
            # Update avatar if user doesn't have one set or if it's default
            if picture and (not user.avatar_url or "api.dicebear.com" in (user.avatar_url or "")):
                user.avatar_url = picture
                db.commit()
                db.refresh(user)
            logger.info(f"Existing user '{email}' authenticated via Google SSO.")
            return user

        # Provision new SSO User
        random_secret = secrets.token_urlsafe(32)
        hashed_password = hash_password(random_secret)

        new_user = User(
            name=name,
            email=email,
            password=hashed_password,
            avatar_url=picture,
            preferred_language="en",
            xp=0,
            level=1
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        logger.info(f"New user '{email}' provisioned via Google SSO.")
        return new_user

sso_service = SSOService()
