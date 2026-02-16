"""
Keycloak Authentication Integration
Handles JWT token validation and user authentication via Keycloak
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from keycloak import KeycloakOpenID, KeycloakAdmin, KeycloakOpenIDConnection
from typing import Dict
from functools import lru_cache

from app.settings import settings
from app.logger import logger


# HTTP Bearer security scheme for extracting tokens from Authorization header
security = HTTPBearer()


@lru_cache()
def get_keycloak_client() -> KeycloakOpenID:
    """
    Get or create Keycloak OpenID Connect client (singleton pattern)

    This function is cached, so the Keycloak client is only created once
    and reused across all requests for better performance.

    Returns:
        KeycloakOpenID: Configured Keycloak client
    """
    try:
        keycloak_openid = KeycloakOpenID(
            server_url=settings.KEYCLOAK_SERVER_URL,
            client_id=settings.KEYCLOAK_CLIENT_ID,
            realm_name=settings.KEYCLOAK_REALM,
            client_secret_key=settings.KEYCLOAK_CLIENT_SECRET,
            verify=True  # Verify SSL certificates in production
        )

        logger.info(f"✅ Keycloak client initialized for realm: {settings.KEYCLOAK_REALM}")
        return keycloak_openid

    except Exception as e:
        logger.error(f"❌ Failed to initialize Keycloak client: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service unavailable"
        )


@lru_cache()
def get_keycloak_admin() -> KeycloakAdmin:
    """
    Get or create Keycloak Admin client (singleton pattern)

    Admin authenticates against 'master' realm but manages users in target realm.

    Returns:
        KeycloakAdmin: Configured Keycloak admin client
    """
    try:
        # Create connection - admin user is in master realm
        keycloak_connection = KeycloakOpenIDConnection(
            server_url=settings.KEYCLOAK_SERVER_URL,
            username=settings.KEYCLOAK_ADMIN_USERNAME,
            password=settings.KEYCLOAK_ADMIN_PASSWORD,
            realm_name="master",
            client_id="admin-cli",
            verify=True
        )

        # Create admin client
        keycloak_admin = KeycloakAdmin(connection=keycloak_connection)

        # Important! Call get_realm() on master first (initializes connection properly)
        keycloak_admin.get_realm("master")

        # Now switch to target realm for user management
        keycloak_admin.change_current_realm(settings.KEYCLOAK_REALM)

        logger.info(f"✅ Keycloak admin client initialized for realm: {settings.KEYCLOAK_REALM}")
        return keycloak_admin

    except Exception as e:
        logger.error(f"❌ Failed to initialize Keycloak admin client: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User management service unavailable"
        )


async def get_current_user_keycloak(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    Validate JWT token with Keycloak and return user information

    This is a FastAPI dependency that:
    1. Extracts the Bearer token from Authorization header
    2. Validates the token with Keycloak
    3. Returns user information if token is valid
    4. Raises 401 error if token is invalid/expired

    Args:
        credentials: HTTP Bearer token from Authorization header

    Returns:
        Dict with user information:
        {
            "id": "user-uuid",
            "email": "user@example.com",
            "username": "testuser",
            "firstName": "Test",
            "lastName": "User",
            "email_verified": True
        }

    Raises:
        HTTPException 401: If token is invalid, expired, or user not found
    """
    token = credentials.credentials
    keycloak_openid = get_keycloak_client()

    try:
        # Method 1: Introspect token (asks Keycloak if token is valid)
        # This is the most secure method as it checks with Keycloak in real-time
        token_info = keycloak_openid.introspect(token)

        # Check if token is active
        if not token_info.get("active"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is invalid or expired"
            )

        # Extract user information from token (including custom attributes)
        user_id = token_info.get("sub")

        # Extract organization info from custom attributes (if mapped to token)
        # These will be available if token mapper is configured in Keycloak
        organization_id = token_info.get("organization_id")
        organization_name = token_info.get("organization_name")

        user_data = {
            "id": user_id,  # User ID (unique identifier)
            "username": token_info.get("preferred_username"),
            "email": token_info.get("email"),
            "firstName": token_info.get("given_name"),
            "lastName": token_info.get("family_name"),
            "email_verified": token_info.get("email_verified", False),
            "realm_roles": token_info.get("realm_access", {}).get("roles", []),
            "organization_id": organization_id,
            "organization_name": organization_name,
        }

        if organization_id:
            logger.debug(f"✅ User authenticated: {user_data.get('username')} (org: {organization_name or organization_id})")
        else:
            logger.debug(f"✅ User authenticated: {user_data.get('username')} (no organization)")

        return user_data

    except HTTPException:
        # Re-raise HTTP exceptions (already formatted)
        raise

    except Exception as e:
        logger.error(f"❌ Token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


async def get_current_user_id_keycloak(
    current_user: Dict = Depends(get_current_user_keycloak)
) -> str:
    """
    Get current user's ID from Keycloak

    Convenience dependency for endpoints that only need the user ID.

    Args:
        current_user: User dict from get_current_user_keycloak dependency

    Returns:
        User's ID as string
    """
    return current_user["id"]


def verify_user_role(required_role: str):
    """
    Decorator to check if user has a specific role

    Usage:
        @router.get("/admin")
        async def admin_endpoint(user = Depends(verify_user_role("admin"))):
            return {"message": "Admin access granted"}

    Args:
        required_role: Role name required to access the endpoint

    Returns:
        Dependency function that validates role
    """
    async def role_checker(current_user: Dict = Depends(get_current_user_keycloak)) -> Dict:
        user_roles = current_user.get("realm_roles", [])

        if required_role not in user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have required role: {required_role}"
            )

        return current_user

    return role_checker
