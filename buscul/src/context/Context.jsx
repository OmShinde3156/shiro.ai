import { createContext, useState } from "react";
import runChat from "../config/Gemini.js";
import API_BASE_URL from "../api/config.js";

export const Context = createContext();

export const ContextProvider = ({ children }) => {
  const [input, setInput] = useState("");
  const [recentPrompt, setRecentPrompt] = useState("");
  const [resultData, setResultData] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [prevPrompts, setPrevPrompts] = useState([]);
  const [messages, setMessages] = useState([]); // {text: string, isUser: boolean, isLoading?: boolean}
  const [isFeynmanMode, setIsFeynmanMode] = useState(false);
  const [feynmanConcept, setFeynmanConcept] = useState(null);

  const fetchDocuments = async (userId) => {
    if (userId) {
      try {
        const response = await fetch(`${API_BASE_URL}/documents/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setDocuments(data);
          return data;
        } else {
          console.error("Failed to fetch documents");
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    }
  };

  const startFeynmanChallenge = async (userId, documentIds) => {
    setLoading(true);
    setShowResults(true);
    setIsFeynmanMode(true);
    
    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('document_ids', JSON.stringify(documentIds));

      const response = await fetch(`${API_BASE_URL}/feynman/challenge`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setFeynmanConcept(data.concept_name);
      
      const shiroMsg = `Ready for the Feynman Challenge! 🎓\n\nExplain the concept of **"${data.concept_name}"** to me like I'm a student who knows nothing about it. I'll be listening and looking for any gaps in your logic!`;
      
      setMessages(prev => [...prev, { 
        text: shiroMsg, 
        isUser: false,
        thought: "Initiating Feynman active recall session." 
      }]);

    } catch (err) {
      console.error("Feynman Start Error:", err);
      setMessages(prev => [...prev, { text: `Error: ${err.message}`, isUser: false }]);
      setIsFeynmanMode(false);
    } finally {
      setLoading(false);
    }
  };

  const onSent = async (language = "en", userId = 1, documentIds = [], mode = "human", overrideInput = null) => {
    const finalInput = overrideInput || input;
    if (!finalInput.trim()) return;
    const currentInput = finalInput;
    if (!overrideInput) setInput(""); 
    setLoading(true);
    setShowResults(true);
    setRecentPrompt(currentInput);
    setPrevPrompts(prev => [...prev, currentInput]);

    setMessages(prev => [...prev, { text: currentInput, isUser: true }, { text: "", isUser: false, isLoading: true }]);

    try {
      let data;
      if (isFeynmanMode && feynmanConcept) {
        // Evaluate Feynman Explanation
        const formData = new FormData();
        formData.append('user_id', userId);
        formData.append('concept_name', feynmanConcept);
        formData.append('explanation', currentInput);

        const response = await fetch(`${API_BASE_URL}/feynman/evaluate`, {
          method: 'POST',
          body: formData,
        });
        const evalData = await response.json();
        
        data = {
          response: evalData.shiro_response,
          internal_thought: evalData.feedback
        };
        
        if (evalData.score > 80) {
           // Successfully explained!
           // We keep the mode if user wants to keep chatting or we can reset
        }
      } else {
        data = await runChat(currentInput, language, userId, documentIds, mode); 
      }

      setResultData(data.response); 

      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { 
          text: data.response, 
          thought: data.internal_thought,
          isUser: false, 
          isLoading: false 
        };
        return newMessages;
      });
      
      return data.response; 
    } catch (error) {
      console.error("Error in onSent:", error);
      setResultData("Something went wrong. Please try again.");
      
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { text: "Something went wrong. Please try again.", isUser: false, isLoading: false };
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Context.Provider
      value={{
        input,
        setInput,
        recentPrompt,
        setRecentPrompt,
        resultData,
        loading,
        showResults,
        setShowResults,
        onSent,
        documents,
        setDocuments,
        fetchDocuments,
        prevPrompts,
        setPrevPrompts,
        messages,
        setMessages,
        isFeynmanMode,
        setIsFeynmanMode,
        startFeynmanChallenge,
        feynmanConcept
      }}
    >
      {children}
    </Context.Provider>
  );
};
