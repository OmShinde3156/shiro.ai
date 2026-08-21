from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from models.database import QuizResult, FlashcardProgress, Document, User, ChatHistory
from datetime import datetime, timedelta
from typing import Dict, Any, List

class ProgressService:
    
    async def get_user_progress(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Get comprehensive user progress"""
        
        # Get user XP and Level
        user = db.query(User).filter(User.id == user_id).first()
        xp = user.xp if user else 0
        level = user.level if user else 1
        
        # Basic stats
        total_docs = db.query(Document).filter(Document.user_id == user_id).count()
        total_quizzes = db.query(QuizResult).filter(QuizResult.user_id == user_id).count()
        
        # Average quiz score
        avg_score_result = db.query(func.avg(QuizResult.score)).filter(
            QuizResult.user_id == user_id
        ).scalar()
        avg_score = float(avg_score_result) if avg_score_result else 0.0
        
        # Flashcard stats
        flashcard_count = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == user_id
        ).count()
        
        # Study streak
        study_streak = await self._calculate_study_streak(user_id, db)
        
        # Subject analysis
        weak_subjects, strong_subjects = await self._analyze_subjects(user_id, db)
        
        # Weekly activity
        weekly_activity = await self._get_weekly_activity(user_id, db)
        
        # Knowledge heatmap
        knowledge_heatmap = await self._generate_knowledge_heatmap(user_id, db)
        
        return {
            "user_id": user_id,
            "total_documents": total_docs,
            "quizzes_taken": total_quizzes,
            "average_score": round(avg_score, 2),
            "flashcards_studied": flashcard_count,
            "study_streak": study_streak,
            "xp": xp,
            "level": level,
            "weak_subjects": weak_subjects,
            "strong_subjects": strong_subjects,
            "weekly_activity": weekly_activity,
            "knowledge_heatmap": knowledge_heatmap
        }
        
    async def add_xp(self, user_id: int, xp_amount: int, db: Session) -> Dict[str, Any]:
        """Award XP to a user and handle level ups"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")
            
        user.xp = (user.xp or 0) + xp_amount
        
        # Calculate level based on simple curve (e.g., Level 1 = 0, Level 2 = 100, Level 3 = 300, Level 4 = 600)
        # Level = floor(sqrt(xp / 100)) + 1
        import math
        new_level = math.floor(math.sqrt(user.xp / 100)) + 1
        
        level_up = False
        if new_level > (user.level or 1):
            user.level = new_level
            level_up = True
            
        db.commit()
        db.refresh(user)
        
        return {
            "xp": user.xp,
            "level": user.level,
            "level_up": level_up,
            "xp_added": xp_amount
        }
    
    async def get_dashboard_data(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Get dashboard data"""
        
        # Recent performance
        recent_quizzes = db.query(QuizResult).filter(
            QuizResult.user_id == user_id
        ).order_by(desc(QuizResult.taken_at)).limit(10).all()
        
        # Study recommendations
        recommendations = await self._generate_recommendations(user_id, db)
        
        # Upcoming reviews (flashcards)
        upcoming_reviews = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.next_review <= datetime.utcnow() + timedelta(days=1)
        ).count()
        
        return {
            "recent_quiz_scores": [r.score for r in recent_quizzes],
            "recommendations": recommendations,
            "cards_due_today": upcoming_reviews,
            "total_study_time": await self._calculate_study_time(user_id, db)
        }
    
    async def update_quiz_progress(self, user_id: int, document_id: int, quiz_result: Any, db: Session):
        """Update progress after quiz completion"""
        
        # This method can be used to trigger additional analytics
        # or update user streaks, achievements, etc.
        
        # Handle both dict and Pydantic object (QuizResultResponse)
        score = quiz_result.score if hasattr(quiz_result, "score") else quiz_result.get("score", 0)
        
        # For now, just update study streak if score is above threshold
        if score >= 60:
            await self._update_study_streak(user_id, db)
    
    async def get_user_activity(self, user_id: int, db: Session) -> List[Dict[str, Any]]:
        """Get chronological user activity history"""
        
        activities = []
        
        # 1. Document Uploads
        docs = db.query(Document).filter(Document.user_id == user_id).all()
        for doc in docs:
            activities.append({
                "type": "upload",
                "title": f"Uploaded {doc.filename}",
                "timestamp": doc.upload_date,
                "details": f"Subject: {doc.subject or 'General'}"
            })
            
        # 2. Quizzes Taken
        quizzes = db.query(QuizResult).filter(QuizResult.user_id == user_id).all()
        for quiz in quizzes:
            activities.append({
                "type": "quiz",
                "title": "Completed Quiz",
                "timestamp": quiz.taken_at,
                "details": f"Score: {quiz.score}% | Total: {quiz.total_questions}"
            })
            
        # 3. Chat Sessions
        chats = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).all()
        for chat in chats:
            activities.append({
                "type": "chat",
                "title": "Chatted with Shiro",
                "timestamp": chat.timestamp,
                "details": chat.message[:50] + "..." if len(chat.message) > 50 else chat.message
            })
            
        # Sort by timestamp descending
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return activities

    async def get_cognitive_peaks(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Analyze historical quiz performance to find peak cognitive hours"""
        
        # Get all quiz results for this user
        results = db.query(QuizResult).filter(QuizResult.user_id == user_id).all()
        
        if not results:
            return {"peak_start": 9, "peak_end": 12, "efficiency": "default", "data_points": 0} # Default to morning

        # Group scores by hour
        hour_stats = {}
        for r in results:
            hour = r.taken_at.hour
            if hour not in hour_stats:
                hour_stats[hour] = []
            hour_stats[hour].append(r.score)

        # Calculate average score per hour
        hour_averages = {
            hour: sum(scores) / len(scores)
            for hour, scores in hour_stats.items()
        }

        # Find the hour with the highest average
        if not hour_averages:
            return {"peak_start": 9, "peak_end": 12, "efficiency": "default", "data_points": 0}

        best_hour = max(hour_averages, key=hour_averages.get)
        
        return {
            "peak_start": best_hour,
            "peak_end": (best_hour + 3) % 24, # 3-hour window
            "efficiency": round(hour_averages[best_hour], 2),
            "data_points": len(results)
        }

    async def _calculate_study_streak(self, user_id: int, db: Session) -> int:
        """Calculate current study streak"""
        
        # Get all quiz dates
        quiz_dates = db.query(func.date(QuizResult.taken_at)).filter(
            QuizResult.user_id == user_id
        ).distinct().order_by(desc(func.date(QuizResult.taken_at))).all()
        
        if not quiz_dates:
            return 0
        
        streak = 0
        current_date = datetime.now().date()
        
        for quiz_date_tuple in quiz_dates:
            date_val = quiz_date_tuple[0]
            if isinstance(date_val, str):
                try:
                    quiz_date = datetime.strptime(date_val, "%Y-%m-%d").date()
                except ValueError:
                    continue
            else:
                quiz_date = date_val
                
            expected_date = current_date - timedelta(days=streak)
            
            if quiz_date == expected_date:
                streak += 1
            elif quiz_date == expected_date - timedelta(days=1) and streak == 0:
                # Allow for yesterday if today hasn't been studied yet
                streak += 1
            else:
                break
        
        return streak
    
    async def _analyze_subjects(self, user_id: int, db: Session) -> tuple[List[str], List[str]]:
        """Analyze performance by subject"""
        
        # Get quiz results with document subjects
        results = db.query(QuizResult, Document.subject).join(
            Document, QuizResult.document_id == Document.id
        ).filter(QuizResult.user_id == user_id).all()
        
        subject_scores = {}
        for result, subject in results:
            if subject:
                if subject not in subject_scores:
                    subject_scores[subject] = []
                subject_scores[subject].append(result.score)
        
        # Calculate average scores per subject
        subject_averages = {
            subject: sum(scores) / len(scores)
            for subject, scores in subject_scores.items()
        }
        
        # Sort by performance
        sorted_subjects = sorted(subject_averages.items(), key=lambda x: x[1])
        
        weak_subjects = [s[0] for s in sorted_subjects[:3] if s[1] < 70]
        strong_subjects = [s[0] for s in sorted_subjects[-3:] if s[1] >= 80]
        
        return weak_subjects, strong_subjects
    
    async def _get_weekly_activity(self, user_id: int, db: Session) -> Dict[str, int]:
        """Get weekly study activity"""
        
        week_ago = datetime.now() - timedelta(days=7)
        
        # Count activities by day
        quiz_activity = db.query(
            func.date(QuizResult.taken_at).label('date'),
            func.count(QuizResult.id).label('count')
        ).filter(
            QuizResult.user_id == user_id,
            QuizResult.taken_at >= week_ago
        ).group_by(func.date(QuizResult.taken_at)).all()
        
        # Convert to dict with day names
        activity = {}
        for i in range(7):
            date = (datetime.now() - timedelta(days=i)).date()
            day_name = date.strftime("%A")
            activity[day_name] = 0
        
        for date_val, count in quiz_activity:
            if isinstance(date_val, str):
                try:
                    parsed_date = datetime.strptime(date_val, "%Y-%m-%d").date()
                except ValueError:
                    continue
            else:
                parsed_date = date_val
                
            day_name = parsed_date.strftime("%A")
            if day_name in activity:
                activity[day_name] = count
        
        return activity
    
    async def _generate_knowledge_heatmap(self, user_id: int, db: Session) -> Dict[str, float]:
        """Generate knowledge heatmap by topic/subject"""
        
        # This is a simplified version - in reality, you'd analyze
        # performance across different topics within documents
        
        results = db.query(QuizResult, Document.subject).join(
            Document, QuizResult.document_id == Document.id
        ).filter(QuizResult.user_id == user_id).all()
        
        heatmap = {}
        for result, subject in results:
            if subject:
                heatmap[subject] = heatmap.get(subject, 0) + result.score
        
        # Normalize scores
        if heatmap:
            max_score = max(heatmap.values())
            heatmap = {k: v/max_score for k, v in heatmap.items()}
        
        return heatmap
    
    async def _generate_recommendations(self, user_id: int, db: Session) -> List[str]:
        """Generate study recommendations"""
        
        recommendations = []
        
        # Check recent performance
        recent_avg = db.query(func.avg(QuizResult.score)).filter(
            QuizResult.user_id == user_id,
            QuizResult.taken_at >= datetime.now() - timedelta(days=7)
        ).scalar()
        
        if recent_avg and recent_avg < 60:
            recommendations.append("Focus on reviewing weak areas from recent quizzes")
            recommendations.append("Try studying with flashcards for better retention")
        
        # Check flashcard reviews
        overdue_cards = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.next_review < datetime.now()
        ).count()
        
        if overdue_cards > 10:
            recommendations.append(f"You have {overdue_cards} flashcards due for review")
        
        # Check study consistency
        streak = await self._calculate_study_streak(user_id, db)
        if streak == 0:
            recommendations.append("Start a study streak by taking a quiz today!")
        elif streak >= 7:
            recommendations.append("Great job maintaining your study streak!")
        
        return recommendations[:5]  # Limit to 5 recommendations
    
    async def _calculate_study_time(self, user_id: int, db: Session) -> int:
        """Estimate total study time in minutes"""
        
        # Rough estimation based on activities
        quiz_count = db.query(QuizResult).filter(QuizResult.user_id == user_id).count()
        flashcard_sessions = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == user_id
        ).count()
        chat_sessions = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id
        ).count()
        
        # Rough estimates: 5 min per quiz, 1 min per flashcard review, 3 min per chat
        total_minutes = (quiz_count * 5) + (flashcard_sessions * 1) + (chat_sessions * 3)
        
        return total_minutes
    
    async def _update_study_streak(self, user_id: int, db: Session):
        """Update study streak (called after successful quiz)"""
        # This is handled in _calculate_study_streak method
        pass
