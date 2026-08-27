import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE_URL } from '../api/config';

/**
 * Resilient Auto-Reconnecting WebSocket Hook with State Sync (FE-02).
 * Features:
 * 1. Exponential backoff with jitter (1s, 2s, 4s, 8s, 16s... max 30s).
 * 2. Strict non-retryable 1008 close code rejection (auth/policy failure).
 * 3. Reconnect state resynchronization (sync_messages using last_sequence).
 * 4. Offline message buffering & automatic draining on reconnect.
 * 5. Heartbeat ping/pong health checks.
 */
export const useWebSocket = (roomId, token) => {
  const [status, setStatus] = useState('CONNECTING'); // CONNECTING, CONNECTED, RECONNECTING, OFFLINE
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const offlineQueueRef = useRef([]);
  const lastSequenceRef = useRef(0);
  const isManuallyClosedRef = useRef(false);

  const connect = useCallback(() => {
    if (!roomId || !token) return;

    const wsUrl = `${WS_BASE_URL}/rooms/ws/${roomId}?token=${encodeURIComponent(token)}`;
    setStatus(reconnectAttemptsRef.current > 0 ? 'RECONNECTING' : 'CONNECTING');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('CONNECTED');
      const hadPreviousConnection = reconnectAttemptsRef.current > 0;
      reconnectAttemptsRef.current = 0;

      // 1. If reconnecting, request missed messages since last sequence
      if (hadPreviousConnection && lastSequenceRef.current > 0) {
        ws.send(JSON.stringify({
          type: 'sync_messages',
          last_sequence: lastSequenceRef.current
        }));
      }

      // 2. Drain any messages queued while offline
      while (offlineQueueRef.current.length > 0) {
        const queuedMsg = offlineQueueRef.current.shift();
        ws.send(JSON.stringify(queuedMsg));
      }

      // 3. Start 25s heartbeat ping interval
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Handle pong heartbeat
        if (payload.type === 'pong') {
          return;
        }

        // Handle Reconnection Message Sync
        if (payload.type === 'sync_response') {
          if (payload.messages && payload.messages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = payload.messages.filter(m => !existingIds.has(m.id));
              return [...prev, ...newMsgs];
            });
            lastSequenceRef.current = payload.last_sequence || lastSequenceRef.current;
          }
          return;
        }

        // Handle Room Members List
        if (payload.type === 'members_update') {
          setMembers(payload.members || []);
          return;
        }

        // Handle Real-Time Chat Message
        if (payload.type === 'chat' && payload.message) {
          if (payload.message.sequence) {
            lastSequenceRef.current = Math.max(lastSequenceRef.current, payload.message.sequence);
          }
          setMessages((prev) => [...prev, payload.message]);
          return;
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = (event) => {
      clearInterval(pingIntervalRef.current);
      
      // Stop reconnecting on Authorization / Policy Violation (1008)
      if (event.code === 1008) {
        setStatus('OFFLINE');
        console.warn('WebSocket closed due to policy/authorization violation (1008). Reconnect aborted.');
        return;
      }

      if (!isManuallyClosedRef.current) {
        setStatus('RECONNECTING');
        const attempt = reconnectAttemptsRef.current;
        // Exponential backoff: min(30s, 1s * 2^attempt + jitter)
        const delay = Math.min(30000, 1000 * Math.pow(2, attempt) + Math.random() * 500);
        reconnectAttemptsRef.current += 1;

        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setStatus('OFFLINE');
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket encountered error:', err);
      ws.close();
    };
  }, [roomId, token]);

  useEffect(() => {
    isManuallyClosedRef.current = false;
    connect();

    return () => {
      isManuallyClosedRef.current = true;
      clearInterval(pingIntervalRef.current);
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect]);

  // Send message with unique client message ID
  const sendMessage = useCallback((content) => {
    const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
      type: 'chat',
      client_message_id: clientMessageId,
      content
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      // Buffer in offline queue
      offlineQueueRef.current.push(payload);
    }
  }, []);

  return {
    status,
    messages,
    members,
    sendMessage
  };
};

export default useWebSocket;
