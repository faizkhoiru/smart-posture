import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  WebSocketMessage,
  WsStateMessage,
  WsPoseMessage,
  WsAlertMessage,
  WsAlertClearMessage,
  ConnectionStatus
} from '../types/ws';

export interface UseDeviceSocketOptions {
  onMessage?: (msg: WebSocketMessage) => void;
  onState?: (state: WsStateMessage) => void;
  onPose?: (pose: WsPoseMessage) => void;
  onAlert?: (alert: WsAlertMessage) => void;
  onAlertClear?: (clear: WsAlertClearMessage) => void;
  autoConnect?: boolean;
}

export interface UseDeviceSocketReturn {
  status: ConnectionStatus;
  latestState: WsStateMessage | null;
  latestPose: WsPoseMessage | null;
  activeAlert: WsAlertMessage | null;
  error: Event | Error | null;
  reconnectCount: number;
  reconnect: () => void;
  disconnect: () => void;
}

const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000').replace(/\/+$/, '');

export function useDeviceSocket(
  deviceId: string,
  options: UseDeviceSocketOptions = {}
): UseDeviceSocketReturn {
  const {
    onMessage,
    onState,
    onPose,
    onAlert,
    onAlertClear,
    autoConnect = true
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [latestState, setLatestState] = useState<WsStateMessage | null>(null);
  const [latestPose, setLatestPose] = useState<WsPoseMessage | null>(null);
  const [activeAlert, setActiveAlert] = useState<WsAlertMessage | null>(null);
  const [error, setError] = useState<Event | Error | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isManuallyClosedRef = useRef<boolean>(false);
  const attemptCountRef = useRef<number>(0);

  // Simpan callbacks terbaru dalam ref agar tidak memicu reconnect saat callback berubah
  const callbacksRef = useRef({ onMessage, onState, onPose, onAlert, onAlertClear });
  useEffect(() => {
    callbacksRef.current = { onMessage, onState, onPose, onAlert, onAlertClear };
  }, [onMessage, onState, onPose, onAlert, onAlertClear]);

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!deviceId) return;

    // Tutup socket sebelumnya jika ada
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    clearReconnectTimeout();
    isManuallyClosedRef.current = false;

    const wsUrl = `${WS_BASE_URL}/ws/devices/${encodeURIComponent(deviceId)}`;
    setStatus(attemptCountRef.current > 0 ? 'reconnecting' : 'connecting');

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setError(null);
        attemptCountRef.current = 0;
        setReconnectCount(0);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WebSocketMessage;
          callbacksRef.current.onMessage?.(parsed);

          switch (parsed.type) {
            case 'state':
              setLatestState(parsed);
              callbacksRef.current.onState?.(parsed);
              break;
            case 'pose':
              setLatestPose(parsed);
              callbacksRef.current.onPose?.(parsed);
              break;
            case 'alert':
              setActiveAlert(parsed);
              callbacksRef.current.onAlert?.(parsed);
              break;
            case 'alert_clear':
              setActiveAlert(null);
              callbacksRef.current.onAlertClear?.(parsed);
              break;
            default:
              break;
          }
        } catch (err) {
          console.error('[useDeviceSocket] Gagal mem-parse pesan WebSocket:', err, event.data);
        }
      };

      ws.onerror = (evt) => {
        setError(evt);
      };

      ws.onclose = () => {
        socketRef.current = null;
        if (isManuallyClosedRef.current) {
          setStatus('disconnected');
          return;
        }

        setStatus('disconnected');
        // Exponential backoff reconnect
        const currentAttempt = attemptCountRef.current;
        const nextAttempt = currentAttempt + 1;
        attemptCountRef.current = nextAttempt;
        setReconnectCount(nextAttempt);

        // Delay: min 1000ms, max 16000ms, + jitter
        const baseDelay = Math.min(1000 * Math.pow(2, currentAttempt), 16000);
        const jitter = Math.floor(Math.random() * 500);
        const delay = baseDelay + jitter;

        setStatus('reconnecting');
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus('disconnected');
    }
  }, [deviceId]);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    clearReconnectTimeout();
    attemptCountRef.current = 0;
    setReconnectCount(0);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const reconnect = useCallback(() => {
    attemptCountRef.current = 0;
    setReconnectCount(0);
    connect();
  }, [connect]);

  useEffect(() => {
    if (autoConnect && deviceId) {
      connect();
    }

    return () => {
      isManuallyClosedRef.current = true;
      clearReconnectTimeout();
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [autoConnect, deviceId, connect]);

  return {
    status,
    latestState,
    latestPose,
    activeAlert,
    error,
    reconnectCount,
    reconnect,
    disconnect
  };
}

