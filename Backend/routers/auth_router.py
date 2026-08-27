from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
import os, uuid

from database.database import get_db
from services.user_service import UserService
from models.schema import UserResponse, LoginRequest, UserCreate, UserOTPRequest, OTPVerifyRequest, UserUpdate
from models.database import User
from utils.auth import create_access_token, get_current_user

router = APIRouter(tags=["Authentication"])

def get_user_service():
    return UserService()

@router.post("/login")
async def login(
     request: LoginRequest,
     response: Response,
     db: Session = Depends(get_db),
     user_service: UserService = Depends(get_user_service)
 ):
     """Login user and return JWT token"""
     try:
         user = user_service.login(request, db)
         access_token = create_access_token(data={"sub": str(user.id)})
         return {
             "access_token": access_token,
             "token_type": "bearer",
             "user": user
         }
     except Exception as e:
         raise HTTPException(status_code=401, detail=str(e))

@router.post("/guest")
async def guest_login(
     db: Session = Depends(get_db)
):
    """Instant guest login providing a session for unauthenticated visitors"""
    from utils.auth import get_guest_user
    guest = get_guest_user(db)
    access_token = create_access_token(data={"sub": str(guest.id), "is_guest": True})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": guest
    }


@router.post("/logout")
async def logout(response: Response):
    """Logout user"""
    return {"message": "Logged out successfully"}


@router.get("/users/me", response_model=UserResponse)
async def get_current_logged_in_user(current_user: User = Depends(get_current_user)):
    """Get the currently logged in user based on JWT cookie"""
    return current_user

@router.put("/users/me", response_model=UserResponse)
async def update_current_user(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Update the current user's profile information"""
    update_dict = {}
    if update_data.name is not None:
        update_dict["name"] = update_data.name.strip()
    if update_data.preferred_language is not None:
        pref_lang = update_data.preferred_language
        if hasattr(pref_lang, "value"):
            pref_lang = pref_lang.value
        update_dict["preferred_language"] = str(pref_lang)
    
    if not update_dict:
        return current_user
        
    updated_user = user_service.update_user(current_user.id, update_dict, db)
    return updated_user


@router.post("/users")
async def create_user(
    request: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Create new user and return token"""
    try:
        user = user_service.create_user(request, db)
        access_token = create_access_token(data={"sub": str(user.id)})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Get user details"""
    user = user_service.get_user(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/upload-avatar/{user_id}")
async def upload_avatar(
    user_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload custom profile picture"""
    avatar_dir = os.path.join("static", "avatars")
    os.makedirs(avatar_dir, exist_ok=True)
    
    file_ext = image.filename.split(".")[-1]
    filename = f"avatar_{user_id}_{uuid.uuid4().hex}.{file_ext}"
    filepath = os.path.join(avatar_dir, filename)
    
    try:
        content = await image.read()
        with open(filepath, "wb") as f:
            f.write(content)
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        base_url = os.getenv("BASE_URL", "http://127.0.0.1:8000")
        avatar_url = f"{base_url}/static/avatars/{filename}"
        user.avatar_url = avatar_url
        db.commit()
        
        return {"avatar_url": avatar_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/request-otp")
async def request_otp(request: UserOTPRequest):
    """Request login OTP (Simulated)"""
    return {"message": "OTP sent successfully (Simulated)"}

@router.post("/verify-otp", response_model=UserResponse)
async def verify_otp(
    request: OTPVerifyRequest,
    db: Session = Depends(get_db)
):
    """Verify OTP and login (Simulated)"""
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
