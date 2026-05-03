from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
import os, uuid

from database.database import get_db
from services.user_service import UserService
from models.schema import UserResponse, LoginRequest, UserCreate, UserOTPRequest, OTPVerifyRequest
from models.database import User

router = APIRouter(tags=["Authentication"])

def get_user_service():
    return UserService()

@router.post("/login", response_model=UserResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Login user (Auto-creates if not exists)"""
    try:
        user = user_service.login(request, db)
        return user
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/users", response_model=UserResponse)
async def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Create new user"""
    try:
        user = user_service.create_user(request, db)
        return user
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
