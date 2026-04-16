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

  const onSent = async (language = "en", userId = 1, documentIds = []) => {
    if (!input.trim()) return;
    const currentInput = input;
    setInput(""); 
    setLoading(true);
    setShowResults(true);
    setRecentPrompt(currentInput);
    setPrevPrompts(prev => [...prev, currentInput]);

    setMessages(prev => [...prev, { text: currentInput, isUser: true }, { text: "", isUser: false, isLoading: true }]);

    try {
      const response = await runChat(currentInput, language, userId, documentIds); 
      setResultData(response); // keeping for compatibility

      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { text: response, isUser: false, isLoading: false };
        return newMessages;
      });
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
        setMessages
      }}
    >
      {children}
    </Context.Provider>
  );
};


