import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminNotification } from "@shared/schema";
import { playNotificationSound } from "@/lib/notificationSound";
import { toast } from "@/hooks/use-toast";

interface WebSocketMessage {
  type: "connected" | "notification" | "pong" | string;
  data?: AdminNotification;
  message?: string;
}

const shouldDebugWebSocket = import.meta.env.DEV;

function debugWebSocket(...args: unknown[]) {
  if (shouldDebugWebSocket) {
    console.log(...args);
  }
}

function errorWebSocket(...args: unknown[]) {
  if (shouldDebugWebSocket) {
    console.error(...args);
  }
}

function getNotificationVariant(
  notification: AdminNotification,
): "success" | "warning" | "destructive" | "info" {
  const text = `${notification.title} ${notification.message}`.toLowerCase();
  const successKeywords = ["success", "completed", "approved", "created", "paid", "delivered", "updated"];
  const destructiveKeywords = ["failed", "error", "delete", "deleted", "removed", "rejected", "cancelled", "canceled"];
  const warningKeywords = ["warning", "pending", "low stock", "attention"];

  if (destructiveKeywords.some((keyword) => text.includes(keyword))) {
    return "destructive";
  }
  if (successKeywords.some((keyword) => text.includes(keyword))) {
    return "success";
  }
  if (warningKeywords.some((keyword) => text.includes(keyword))) {
    return "warning";
  }
  return "info";
}

export function useAdminWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<AdminNotification | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const queryClient = useQueryClient();

  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  const connect = useCallback(() => {
    // Determine WebSocket URL based on environment
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/admin/notifications`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        debugWebSocket("[WebSocket] Connected to admin notifications");
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Start ping interval to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);

        ws.onclose = () => {
          clearInterval(pingInterval);
          setIsConnected(false);
        };
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case "notification":
              if (message.data) {
                setLastNotification(message.data);

                // Update the React Query cache with the new notification
                queryClient.setQueryData<{ data: AdminNotification[] }>(
                  ["/api/admin/notifications"],
                  (old) => {
                    if (!old) return { data: [message.data!] };
                    return { data: [message.data!, ...old.data] };
                  }
                );

                if (message.data.isRead === 0) {
                  playNotificationSound();
                  toast({
                    title: message.data.title || "New notification",
                    description: message.data.message,
                    variant: getNotificationVariant(message.data),
                    duration: 3500,
                  });
                }
              }
              break;
              
            case "connected":
              debugWebSocket("[WebSocket] Server confirmed connection:", message.message);
              break;
              
            case "pong":
              // Heartbeat response, connection is alive
              break;
              
            default:
              debugWebSocket("[WebSocket] Unknown message type:", message.type);
          }
        } catch (err) {
          errorWebSocket("[WebSocket] Failed to parse message:", err);
        }
      };

      ws.onerror = (error) => {
        errorWebSocket("[WebSocket] Error:", error);
      };

      ws.onclose = () => {
        debugWebSocket("[WebSocket] Connection closed");
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
          debugWebSocket(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          debugWebSocket("[WebSocket] Max reconnection attempts reached");
        }
      };
    } catch (err) {
      errorWebSocket("[WebSocket] Failed to create WebSocket:", err);
    }
  }, [queryClient]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    isConnected,
    lastNotification,
    sendMessage,
    clearLastNotification: () => setLastNotification(null),
  };
}
