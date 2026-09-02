import { fetchWithAuth } from './fetchWithAuth';
import API_BASE_URL from "./config.js";

const CHAT_API_URL = `${API_BASE_URL}/chat`;
const CHAT_STREAM_URL = `${API_BASE_URL}/chat/stream`;

/**
 * Real-Time Server-Sent Events (SSE) Stream Reader with typed event handlers across all context scopes.
 */
export async function streamChat({
  prompt,
  language = "en",
  userId = 1,
  documentIds = [],
  activeDocumentId = null,
  contextScope = "GLOBAL",
  roomId = null,
  selectedText = null,
  toolRequest = null,
  mode = "human",
  abortSignal = null,
  onStatus = () => {},
  onCitation = () => {},
  onToken = () => {},
  onAction = () => {},
  onError = () => {},
  onDone = () => {}
}) {
  try {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token") || localStorage.getItem("shiro_token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };

    const defaultMode = localStorage.getItem('shiro_default_mode') || 'tutor';
    const effectiveMode = mode || (defaultMode === 'exam' ? 'surgical' : defaultMode);

    const payload = {
      user_id: userId,
      message: prompt,
      document_ids: documentIds,
      active_document_id: activeDocumentId,
      context_scope: contextScope,
      room_id: roomId,
      selected_text: selectedText,
      tool_request: toolRequest,
      language: language || localStorage.getItem('shiro_language') || "en",
      mode: effectiveMode,
      response_style: localStorage.getItem('shiro_response_style') || 'balanced',
      use_examples: localStorage.getItem('shiro_style_examples') !== 'false',
      explain_terms: localStorage.getItem('shiro_style_terms') !== 'false',
      ask_followups: localStorage.getItem('shiro_style_followups') !== 'false',
      learning_goal: localStorage.getItem('shiro_learning_goal') || 'University',
      current_level: localStorage.getItem('shiro_current_level') || 'Intermediate'
    };

    const response = await fetch(CHAT_STREAM_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: abortSignal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Stream connection failed (${response.status}): ${errText}`);
    }

    if (!response.body) {
      throw new Error("ReadableStream not supported by browser response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    let currentEvent = null;
    let currentData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (currentEvent && currentData) {
            try {
              const parsed = JSON.parse(currentData);
              if (currentEvent === "status") onStatus(parsed);
              else if (currentEvent === "citation") onCitation(parsed.citation || parsed);
              else if (currentEvent === "token") onToken(parsed.delta || "");
              else if (currentEvent === "action") onAction(parsed.handoff || parsed);
              else if (currentEvent === "error") onError(parsed);
              else if (currentEvent === "done") onDone(parsed);
            } catch (err) {
              console.warn("Failed to parse SSE JSON chunk:", err, currentData);
            }
          }
          currentEvent = null;
          currentData = null;
          continue;
        }

        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.substring(6).trim();
        } else if (trimmed.startsWith("data:")) {
          currentData = trimmed.substring(5).trim();
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log("Chat stream aborted by user.");
      onDone({ status: "stopped" });
      return;
    }
    console.error("StreamChat error:", error);
    onError({ message: error.message });
    throw error;
  }
}

/**
 * Send a chat message to FastAPI with dynamic context scopes (Fallback)
 */
export async function runChat(
  prompt,
  language = "en",
  userId = 1,
  documentIds = [],
  mode = "human",
  contextScope = "GLOBAL",
  activeDocumentId = null,
  roomId = null,
  selectedText = null
) {
  try {
    const defaultMode = localStorage.getItem('shiro_default_mode') || 'tutor';
    const effectiveMode = mode || (defaultMode === 'exam' ? 'surgical' : defaultMode);

    const payload = {
      user_id: userId,
      message: prompt,
      document_ids: documentIds,
      active_document_id: activeDocumentId,
      context_scope: contextScope,
      room_id: roomId,
      selected_text: selectedText,
      language: language || localStorage.getItem('shiro_language') || "en",
      mode: effectiveMode,
      response_style: localStorage.getItem('shiro_response_style') || 'balanced',
      use_examples: localStorage.getItem('shiro_style_examples') !== 'false',
      explain_terms: localStorage.getItem('shiro_style_terms') !== 'false',
      ask_followups: localStorage.getItem('shiro_style_followups') !== 'false',
      learning_goal: localStorage.getItem('shiro_learning_goal') || 'University',
      current_level: localStorage.getItem('shiro_current_level') || 'Intermediate'
    };

    const response = await fetchWithAuth(CHAT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`FastAPI error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.response || typeof data.response !== "string") {
      throw new Error("Invalid response format from FastAPI");
    }

    return data;
  } catch (error) {
    console.error("Error while running chat:", error);
    throw error;
  }
}

export default runChat;
