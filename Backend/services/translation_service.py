from utils.llm_client import LLMClient

class TranslationService:
    def __init__(self):
        self.llm_client = LLMClient()
    
    async def translate_content(self, content: str, target_language: str, content_type: str):
        """Translate content to target language"""
        
        language_names = {
            "en": "English",
            "hi": "Hindi", 
            "mr": "Marathi"
        }
        
        target_lang_name = language_names.get(target_language, target_language)
        
        prompt = f"""
        Translate the following {content_type} content to {target_lang_name}.
        Maintain the original meaning and context.
        
        Content to translate:
        {content}
        """
        
        translated_content = await self.llm_client.generate_response(prompt)
        
        return {
            "original_content": content[:100] + "..." if len(content) > 100 else content,
            "translated_content": translated_content,
            "source_language": "auto-detected",
            "target_language": target_language,
            "content_type": content_type
        }

