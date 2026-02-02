"""
Authentication router for user management endpoints.
Provides signup, login, and user info endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from datetime import timedelta

# Authentication imports
from auth.models import UserSignup, UserLogin, UserResponse, Token
from auth.crud import UserCRUD
from auth.utils import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/signup", response_model=UserResponse)
async def signup(user_data: UserSignup):
    """
    Register a new user

    Args:
        user_data: User signup data including firstName, lastName, email, password

    Returns:
        UserResponse: Created user information
    """
    try:
        user = UserCRUD.create_user(user_data)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )


@router.post("/login")
async def login(user_data: UserLogin):
    """
    Authenticate user and return JWT token

    Args:
        user_data: User login data including email and password

    Returns:
        Dict with access token and user info
    """
    try:
        user = UserCRUD.authenticate_user(user_data.email, user_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )

        # Return token and user info
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "firstName": user.firstName,
                "lastName": user.lastName,
                "organization_id": user.organization_id,
                "created_at": user.createdAt.isoformat()
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information

    Returns:
        User information
    """
    return {
        "id": str(current_user["_id"]),
        "email": current_user["email"],
        "firstName": current_user["firstName"],
        "lastName": current_user["lastName"],
        "organization_id": str(current_user.get("organization_id")) if current_user.get("organization_id") else None,
        "created_at": current_user["createdAt"].isoformat() if current_user.get("createdAt") else None
    }
