import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
from datetime import datetime
from dotenv import load_dotenv

# Load .env file explicitly
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from database.database import get_db, init_db, Base, engine
from routers import (
    auth_router, 
    documents_router, 
    features_router, 
    important_questions_router
)

# ✅ Initialize App
app = FastAPI(title="Shiro AI: Personalized Study Guide Generator", version="0.2.7")

# ✅ Database Setup
Base.metadata.create_all(bind=engine) 

# ✅ Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Static Files
app.mount("/static", StaticFiles(directory="static"), name="static") 

# ✅ Include Routers
app.include_router(features_router.router)
app.include_router(auth_router.router)
app.include_router(documents_router.router)
app.include_router(important_questions_router.router)

# ✅ Startup Event
@app.on_event("startup")
async def startup_event():
    init_db()
    db = next(get_db())
    try:
        from models.database import User
        guest = db.query(User).filter(User.id == 1).first()
        if not guest:
            guest = User(id=1, name="Guest User", email="guest@study.ai", password="password123")
            db.add(guest)
            db.commit()
            print("Created default Guest User (ID: 1)")
    except Exception as e:
        print(f"Error creating guest user: {e}")
    finally:
        db.close()

# ✅ Health Check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": "2.5.0"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
