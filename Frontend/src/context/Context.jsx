import { fetchWithAuth } from '../api/fetchWithAuth';
import { createContext, useState, useEffect, useRef } from "react";
import runChat, { streamChat } from "../api/chatStream.js";
import API_BASE_URL from "../api/config.js";
import { translations } from "../utils/translations.js";

export const Context = createContext();

export const ContextProvider = ({ children }) => {
  const [input, setInput] = useState("");
  const [recentPrompt, setRecentPrompt] = useState("");
  const [resultData, setResultData] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [prevPrompts, setPrevPrompts] = useState([]);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('shiro_chat_messages');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem('shiro_chat_messages', JSON.stringify(messages.slice(-50)));
      }
    } catch (e) {}
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('shiro_chat_messages');
    setShowResults(false);
    setInput("");
  };
  const [isFeynmanMode, setIsFeynmanMode] = useState(false);
  const [feynmanConcept, setFeynmanConcept] = useState(null);
  const [language, setLanguageState] = useState(localStorage.getItem('shiro_language') || "en");
  const [studyStats, setStudyStats] = useState({ streak: 1, avgScore: 75, xp: 140, level: 2 });
  const [activeHandoffContext, setActiveHandoffContext] = useState(null);

  const abortControllerRef = useRef(null);

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem('shiro_language', lang);
  };

  const t = (key, fallback = "") => {
    return translations[language]?.[key] || translations['en']?.[key] || fallback || key;
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const triggerStudyTool = (tool, handoffObject) => {
    setActiveHandoffContext(handoffObject);
    return tool;
  };

  const fetchUserStats = async (userId) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/progress`);
      if (response.ok) {
        const data = await response.json();
        setStudyStats({
          streak: data.study_streak || 1,
          avgScore: data.average_score || 75,
          xp: data.xp || 140,
          level: data.level || 2,
        });
      }
    } catch (err) {
      console.error("Error fetching study stats:", err);
    }
  };

  const fetchDocuments = async (userId) => {
    if (userId) {
      fetchUserStats(userId);
      try {
        const response = await fetchWithAuth(`${API_BASE_URL}/documents`);
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

      const response = await fetchWithAuth(`${API_BASE_URL}/feynman/challenge`, {
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

  const onSent = async (
    language = "en",
    userId = 1,
    documentIds = [],
    mode = "human",
    overrideInput = null,
    contextScope = "GLOBAL",
    activeDocumentId = null,
    roomId = null,
    selectedText = null,
    toolRequest = null
  ) => {
    const finalInput = overrideInput || input;
    if (!finalInput.trim()) return;
    const currentInput = finalInput;
    setInput(""); 
    setLoading(true);
    setShowResults(true);
    setRecentPrompt(currentInput);
    setPrevPrompts(prev => [...prev, currentInput]);

    // Append user message + initial streaming placeholder
    setMessages(prev => [
      ...prev,
      { text: currentInput, isUser: true },
      { 
        text: "", 
        isUser: false, 
        isLoading: true, 
        statusText: contextScope === "DOCUMENT" ? "Analyzing document context..." : "Consulting Shiro Tutor...",
        citations: [],
        sources: [],
        suggestedAction: null,
        actionHandoff: null,
        contextScope: contextScope
      }
    ]);

    try {
      if (isFeynmanMode && feynmanConcept) {
        const formData = new FormData();
        formData.append('user_id', userId);
        formData.append('concept_name', feynmanConcept);
        formData.append('explanation', currentInput);

        const response = await fetchWithAuth(`${API_BASE_URL}/feynman/evaluate`, {
          method: 'POST',
          body: formData,
        });
        const evalData = await response.json();
        
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = {
            text: evalData.shiro_response,
            thought: evalData.feedback,
            score: evalData.score,
            isUser: false,
            isLoading: false
          };
          return next;
        });
        setResultData(evalData.shiro_response);
      } else {
        // SSE Real-Time Streaming
        abortControllerRef.current = new AbortController();

        await streamChat({
          prompt: currentInput,
          language,
          userId,
          documentIds,
          activeDocumentId,
          contextScope,
          roomId,
          selectedText,
          toolRequest,
          mode,
          abortSignal: abortControllerRef.current.signal,
          onStatus: (statusPayload) => {
            setMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && !last.isUser) {
                last.statusText = statusPayload.step;
              }
              return next;
            });
          },
          onCitation: (citation) => {
            setMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && !last.isUser) {
                const existing = last.citations || [];
                if (!existing.some(c => c.id === citation.id)) {
                  last.citations = [...existing, citation];
                  last.sources = last.citations;
                }
              }
              return next;
            });
          },
          onToken: (tokenDelta) => {
            setMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && !last.isUser) {
                last.text = (last.text || "") + tokenDelta;
                last.isLoading = false;
              }
              return next;
            });
          },
          onAction: (actionHandoff) => {
            setMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && !last.isUser) {
                last.suggestedAction = actionHandoff.tool || actionHandoff.action;
                last.actionHandoff = actionHandoff;
              }
              return next;
            });
          },
          onError: (err) => {
            setMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && !last.isUser && !last.text) {
                last.text = `Error: ${err.message || "Failed to generate response."}`;
                last.isLoading = false;
              }
              return next;
            });
          },
          onDone: (donePayload) => {
            setMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && !last.isUser) {
                last.isLoading = false;
                last.status = donePayload.status || "completed";
              }
              return next;
            });
          }
        });
      }
    } catch (error) {
      console.error("Error in onSent:", error);
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && !last.isUser && !last.text) {
          last.text = "Something went wrong. Please try again.";
          last.isLoading = false;
        }
        return next;
      });
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
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
        stopGeneration,
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
        feynmanConcept,
        language,
        setLanguage,
        studyStats,
        setStudyStats,
        fetchUserStats,
        activeHandoffContext,
        setActiveHandoffContext,
        triggerStudyTool,
        clearChat,
        t
      }}
    >
      {children}
    </Context.Provider>
  );
};
