"""
Authentication router for user management endpoints.
All authentication handled via Keycloak.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from bson import ObjectId

# Keycloak Authentication imports
from auth.keycloak_auth import get_current_user_keycloak, get_keycloak_client, get_keycloak_admin
from app.logger import logger

router = APIRouter(prefix="/auth", tags=["authentication"])


# ==================== REQUEST/RESPONSE MODELS ====================

class SignupRequest(BaseModel):
    """User registration request"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    firstName: str
    lastName: str


class SignupResponse(BaseModel):
    """User registration response"""
    id: str
    username: str
    email: str
    firstName: str
    lastName: str
    organization_id: str
    organization_name: str
    message: str


class LoginRequest(BaseModel):
    """User login request"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """User login response with tokens"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str


class UserInfoResponse(BaseModel):
    """Current user information response"""
    id: str
    username: str
    email: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email_verified: bool
    roles: list[str] = []
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None


# ==================== ENDPOINTS ====================

@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: SignupRequest):
    """
    Register a new user in Keycloak with organization_id attribute

    Flow:
    1. Generate unique ObjectId for organization
    2. Create user in Keycloak with organization_id as custom attribute
    3. User can login immediately (no email verification required)
    4. Admin assigns roles individually via Keycloak UI or API

    Note: organization_name can be duplicate (just a display label)
          organization_id is the unique identifier (MongoDB ObjectId)
    """
    try:
        keycloak_admin = get_keycloak_admin()

        # Generate unique ObjectId for organization (MongoDB format)
        # Each user gets their own org by default; admin can update later to group users
        organization_id = str(ObjectId())
        organization_name = f"{user_data.firstName} {user_data.lastName}'s Organization"

        # Prepare user data
        new_user = {
            "username": user_data.username,
            "email": user_data.email,
            "firstName": user_data.firstName,
            "lastName": user_data.lastName,
            "enabled": True,
            "emailVerified": True,  # Skip email verification
            "credentials": [{
                "type": "password",
                "value": user_data.password,
                "temporary": False
            }]
        }

        # Create user in Keycloak
        user_id = keycloak_admin.create_user(new_user)
        logger.info(f"✅ User created: {user_data.username} (ID: {user_id})")

        # Fetch the complete user representation (required by Keycloak API)
        # You cannot update just attributes - must provide full user object
        try:
            user_representation = keycloak_admin.get_user(user_id)
            logger.info(f"📋 Fetched user representation for {user_id}")

            # Add attributes to the representation
            user_representation["attributes"] = {
                "organization_id": [organization_id],
                "organization_name": [organization_name]
            }
            logger.info(f"📝 Added attributes to representation: {user_representation.get('attributes')}")

            # Update with complete representation
            keycloak_admin.update_user(user_id=user_id, payload=user_representation)
            logger.info(f"✅ Organization attributes set: {organization_id}")

        except Exception as e:
            logger.error(f"❌ Failed to set attributes: {e}")
            logger.error(f"❌ Error type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            # Don't fail signup if attributes fail - user is already created
            logger.warning(f"⚠️ User created but attributes not set for {user_data.username}")

        return SignupResponse(
            id=user_id,
            username=user_data.username,
            email=user_data.email,
            firstName=user_data.firstName,
            lastName=user_data.lastName,
            organization_id=organization_id,
            organization_name=organization_name,
            message="User created successfully. You can now login."
        )

    except Exception as e:
        error_message = str(e)

        if "409" in error_message or "already exists" in error_message.lower():
            logger.warning(f"⚠️ User already exists: {user_data.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this username or email already exists"
            )

        logger.error(f"❌ Signup failed: {error_message}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user account: {error_message}"
        )


@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """
    Authenticate user and return access token
    """
    try:
        keycloak_openid = get_keycloak_client()

        # Exchange username/password for tokens
        token_response = keycloak_openid.token(
            username=credentials.username,
            password=credentials.password
        )

        logger.info(f"✅ User logged in: {credentials.username}")

        return LoginResponse(
            access_token=token_response["access_token"],
            refresh_token=token_response["refresh_token"],
            token_type="bearer",
            expires_in=token_response["expires_in"]
        )

    except Exception as e:
        logger.warning(f"⚠️ Login failed for {credentials.username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )


@router.get("/me", response_model=UserInfoResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user_keycloak)):
    """
    Get current authenticated user information
    """
    return UserInfoResponse(
        id=current_user["id"],
        username=current_user["username"],
        email=current_user["email"],
        firstName=current_user.get("firstName"),
        lastName=current_user.get("lastName"),
        email_verified=current_user.get("email_verified", False),
        roles=current_user.get("realm_roles", []),
        organization_id=current_user.get("organization_id"),
        organization_name=current_user.get("organization_name")
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(token_request: RefreshTokenRequest):
    """
    Refresh an expired access token
    """
    try:
        keycloak_openid = get_keycloak_client()

        # Exchange refresh token for new access token
        token_response = keycloak_openid.refresh_token(token_request.refresh_token)

        logger.info("✅ Token refreshed")

        return LoginResponse(
            access_token=token_response["access_token"],
            refresh_token=token_response["refresh_token"],
            token_type="bearer",
            expires_in=token_response["expires_in"]
        )

    except Exception as e:
        logger.warning(f"⚠️ Token refresh failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )


@router.post("/logout")
async def logout(token_request: RefreshTokenRequest):
    """
    Logout user and invalidate refresh token
    """
    try:
        keycloak_openid = get_keycloak_client()
        keycloak_openid.logout(token_request.refresh_token)
        logger.info("✅ User logged out")
        return {"message": "Logged out successfully"}

    except Exception as e:
        logger.error(f"❌ Logout failed: {str(e)}")
        return {"message": "Logout completed"}
