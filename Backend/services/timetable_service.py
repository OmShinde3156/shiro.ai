from sqlalchemy.orm import Session
from models.database import StudyTimetable, TimetableProgress
from models.schema import TimetableRequest, TimetableProgressRequest
from datetime import datetime, timedelta, timezone
import uuid
from typing import Dict, Any, List

class TimetableService:
    
    async def create_timetable(self, request: TimetableRequest, db: Session):
        """Create personalized study timetable"""
        
        # Calculate days until exam
        days_until_exam = (request.exam_date - datetime.now(timezone.utc)).days
        
        if days_until_exam <= 0:
            raise Exception("Exam date must be in the future")
        
        # Calculate total available hours
        total_hours_available = days_until_exam * request.study_hours_per_day
        
        # Calculate total hours needed
        total_hours_needed = sum(subject.get('hours_needed', 10) for subject in request.subjects)
        
        if total_hours_needed > total_hours_available and not request.crash_course:
            raise Exception("Not enough time for all subjects. Consider crash course mode.")
        
        # Generate daily schedule
        daily_schedule = {}
        current_date = datetime.now(timezone.utc).date()
        
        # Distribute subjects across days
        for day_offset in range(days_until_exam):
            study_date = current_date + timedelta(days=day_offset)
            date_str = study_date.strftime("%Y-%m-%d")
            
            daily_tasks = self._generate_daily_tasks(
                request.subjects,
                request.study_hours_per_day,
                day_offset,
                days_until_exam,
                request.crash_course
            )
            
            daily_schedule[date_str] = daily_tasks
        
        # Save timetable
        timetable_id = str(uuid.uuid4())
        timetable = StudyTimetable(
            id=timetable_id,
            user_id=request.user_id,
            exam_date=request.exam_date,
            daily_schedule=daily_schedule,
            subjects=request.subjects,
            crash_course=request.crash_course
        )
        
        db.add(timetable)
        db.commit()
        
        return {
            "timetable_id": timetable_id,
            "user_id": request.user_id,
            "exam_date": request.exam_date,
            "daily_schedule": daily_schedule,
            "created_at": timetable.created_at
        }
    
    def get_user_timetable(self, user_id: int, db: Session):
        """Get user's current timetable"""
        
        # Get most recent active timetable
        timetable = db.query(StudyTimetable).filter(
            StudyTimetable.user_id == user_id,
            StudyTimetable.exam_date > datetime.now(timezone.utc)
        ).order_by(StudyTimetable.created_at.desc()).first()
        
        if not timetable:
            return {"message": "No active timetable found"}
        
        # Get today's schedule
        today = datetime.now(timezone.utc).date().strftime("%Y-%m-%d")
        today_schedule = timetable.daily_schedule.get(today, [])
        
        # Get progress for today's tasks
        today_progress = db.query(TimetableProgress).filter(
            TimetableProgress.user_id == user_id,
            TimetableProgress.timetable_id == timetable.id
        ).all()
        
        progress_dict = {p.task_id: {"completed": p.completed, "hours_studied": p.hours_studied} 
                        for p in today_progress}
        
        # Add progress info to tasks
        for task in today_schedule:
            task_id = task.get("task_id")
            if task_id in progress_dict:
                task.update(progress_dict[task_id])
        
        return {
            "timetable_id": timetable.id,
            "exam_date": timetable.exam_date,
            "today_schedule": today_schedule,
            "crash_course": timetable.crash_course,
            "days_remaining": (timetable.exam_date - datetime.now(timezone.utc)).days
        }
    
    def update_task_progress(self, request: TimetableProgressRequest, db: Session):
        """Update progress on timetable tasks"""
        
        # Get or create progress record
        progress = db.query(TimetableProgress).filter(
            TimetableProgress.user_id == request.user_id,
            TimetableProgress.timetable_id == request.timetable_id,
            TimetableProgress.task_id == request.task_id
        ).first()
        
        if not progress:
            progress = TimetableProgress(
                user_id=request.user_id,
                timetable_id=request.timetable_id,
                task_id=request.task_id
            )
            db.add(progress)
        
        progress.completed = request.completed
        progress.hours_studied = request.hours_studied
        
        if request.completed:
            progress.completion_date = datetime.now(timezone.utc)
        
        db.commit()
        
        return {
            "task_id": request.task_id,
            "completed": progress.completed,
            "hours_studied": progress.hours_studied
        }
    
    def _generate_daily_tasks(self, subjects: List[Dict], hours_per_day: int, day_offset: int, total_days: int, crash_course: bool) -> List[Dict[str, Any]]:
        """Generate tasks for a specific day"""
        
        tasks = []
        
        # Sort subjects by priority (higher priority first)
        sorted_subjects = sorted(subjects, key=lambda x: x.get('priority', 1))
        
        if crash_course:
            # In crash course mode, focus on high-priority subjects
            subjects_for_day = sorted_subjects[:2]
        else:
            # Normal mode - rotate subjects
            subjects_for_day = [sorted_subjects[day_offset % len(sorted_subjects)]]
        
        hours_allocated = 0
        
        for subject in subjects_for_day:
            if hours_allocated >= hours_per_day:
                break
            
            # Calculate hours for this subject today
            subject_hours = min(
                hours_per_day - hours_allocated,
                2 if crash_course else 3  # Max hours per subject per day
            )
            
            # Generate tasks for this subject
            if day_offset < total_days * 0.7:  # First 70% of time - learning
                task_type = "study"
                task_description = f"Study {subject['name']} - New concepts"
            elif day_offset < total_days * 0.9:  # Next 20% - practice
                task_type = "practice"
                task_description = f"Practice {subject['name']} - Problems & Questions"
            else:  # Last 10% - revision
                task_type = "revision"
                task_description = f"Revise {subject['name']} - Quick review"
            
            tasks.append({
                "task_id": f"{subject['name']}_{day_offset}_{task_type}",
                "subject": subject['name'],
                "type": task_type,
                "description": task_description,
                "estimated_hours": subject_hours,
                "priority": subject.get('priority', 1),
                "completed": False,
                "hours_studied": 0.0
            })
            
            hours_allocated += subject_hours
        
        return tasks

