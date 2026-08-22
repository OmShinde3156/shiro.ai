import { fetchWithAuth } from '../api/fetchWithAuth';
import API_BASE_URL from "../api/config.js";

const CHAT_API_URL = `${API_BASE_URL}/chat`; // FastAPI URL

/**
 * Send a chat message to FastAPI and get a better-formatted response
 * @param {string} prompt - User's question or topic
 * @param {string} language - selected language
 * @param {number} userId - ID of the current user
 * @param {number[]} documentIds - IDs of the selected documents
 * @returns {Promise<string>} - AI response in improved phrasing & format
 */
async function runChat(prompt, language = "en", userId = 1, documentIds = [], mode = "human") {
  try {
    // 🔥 We send the RAW prompt to let the backend's "Shiro" personality handle it naturally
    const payload = {
      user_id: userId,
      message: prompt,
      document_ids: documentIds,
      language: language,
      mode: mode
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
