from sqlalchemy.orm import Session
from models.database import Document, Quiz, QuizResult
from utils.llm_client import LLMClient
from models.schema import QuizSubmissionRequest, QuizResultResponse
import uuid
import json
from typing import List, Dict, Any

class QuizService:
    def __init__(self):
        self.llm_client = LLMClient()
    
    async def generate_quiz_from_document(self, document_id: int, num_questions: int, difficulty: str, db: Session):
        """Generate quiz questions from document"""
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception("Document not found")
        
        # Generate questions using LLM
        questions = await self.llm_client.generate_quiz_questions(
            document.text_content[:4000],  # Limit content size
            num_questions,
            difficulty
        )
        
        # Add unique IDs to questions
        for i, question in enumerate(questions):
            question['id'] = f"q_{{uuid.uuid4().hex}}_{i}"
        
        # Save quiz to database
        quiz_id = str(uuid.uuid4())
        quiz = Quiz(
            id=quiz_id,
            document_id=document_id,
            questions=questions,
            difficulty=difficulty
        )
        
        db.add(quiz)
        db.commit()
        
        return {
            "quiz_id": quiz_id,
            "document_id": document_id,
            "questions": questions,
            "created_at": quiz.created_at
        }
    
    def evaluate_quiz(self, submission: QuizSubmissionRequest, db: Session) -> QuizResultResponse:
        """Evaluate quiz submission and return results"""
        
        # Get quiz
        quiz = db.query(Quiz).filter(Quiz.id == submission.quiz_id).first()
        if not quiz:
            raise Exception("Quiz not found")
        
        questions = quiz.questions
        correct_count = 0
        incorrect_answers = []
        
        # Check answers
        for question in questions:
            question_id = question['id']
            correct_answer = question['correct_answer']
            user_answer = submission.answers.get(question_id, '')
            
            if user_answer == correct_answer:
                correct_count += 1
            else:
                incorrect_answers.append({
                    "question_id": question_id,
                    "question": question['question'],
                    "user_answer": user_answer,
                    "correct_answer": correct_answer,
                    "explanation": question.get('explanation', '')
                })
        
        total_questions = len(questions)
        score = (correct_count / total_questions) * 100 if total_questions > 0 else 0
        
        # Generate suggestions based on performance
        suggestions = self._generate_suggestions(score, incorrect_answers)
        
        # Save result
        result = QuizResult(
            user_id=submission.user_id,
            document_id=submission.document_id,
            quiz_id=submission.quiz_id,
            score=score,
            total_questions=total_questions,
            answers=submission.answers
        )
        
        db.add(result)
        db.commit()
        
        return QuizResultResponse(
            quiz_id=submission.quiz_id,
            score=score,
            total_questions=total_questions,
            correct_answers=correct_count,
            incorrect_answers=incorrect_answers,
            suggestions=suggestions
        )
    
    def get_quiz_history(self, user_id: int, db: Session) -> List[Dict[str, Any]]:
        """Get quiz history for user"""
        results = db.query(QuizResult).filter(QuizResult.user_id == user_id).all()
        return [
            {
                "quiz_id": result.quiz_id,
                "document_id": result.document_id,
                "score": result.score,
                "total_questions": result.total_questions,
                "taken_at": result.taken_at
            }
            for result in results
        ]
    
    async def generate_important_questions(self, document_id: int, pyq_document_id: int, num_questions: int, db: Session):
        """Generate important questions based on content and PYQs"""
        
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception(f"Main document with ID {document_id} not found.")
        pyq_doc = db.query(Document).filter(Document.id == pyq_document_id).first() if pyq_document_id else None
        
        context = document.text_content
        if pyq_doc:
            context += f"\n\nPrevious Year Questions:\n{pyq_doc.text_content}"
        
        questions = await self.llm_client.generate_quiz_questions(
            context[:6000],
            num_questions,
            "medium"
        )
        
        return {"questions": questions}
    
    def _generate_suggestions(self, score: float, incorrect_answers: List[Dict]) -> List[str]:
        """Generate study suggestions based on performance"""
        suggestions = []
        
        if score < 40:
            suggestions.append("Review the entire material thoroughly")
            suggestions.append("Take notes while studying")
            suggestions.append("Practice more questions")
        elif score < 70:
            suggestions.extend([
                "Focus on weak areas identified in incorrect answers",
                "Review concepts you missed",
                "Try explaining concepts in your own words"
            ])
        else:
            suggestions.extend([
                "Great job! Review the few topics you missed",
                "Try advanced questions on this topic",
                "Help others to reinforce your knowledge"
            ])
        
        return suggestions