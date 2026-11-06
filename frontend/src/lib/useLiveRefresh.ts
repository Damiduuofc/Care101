"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getAdminToken } from "@/lib/adminSession";

// Events that mean dashboard numbers may have changed
const DEFAULT_EVENTS = [
  "dashboardUpdated",
  "appointmentUpdated",
  "doctorStatusUpdated",
  "queueUpdated",
  "hospitalStatusUpdated",
  "scheduleUpdated",
  "scheduleDeleted",
  "nurseReleased",
];

const socketOrigin = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";
  try {
    return new URL(apiUrl).origin;
  } catch {
    return apiUrl;
  }
};

type Options = {
  /** Extra socket events to listen to, with their own handlers */
  on?: Record<string, (payload: any) => void>;
  /** Fallback poll in ms in case the socket is down (0 disables) */
  pollMs?: number;
};

/**
 * Keeps a page live: calls `refresh` whenever the server signals a change, after the
 * socket reconnects (events may have been missed), when the tab becomes visible again,
 * and on a slow fallback poll. Rapid bursts of events collapse into one refresh.
 */
export function useLiveRefresh(refresh: () => void, { on, pollMs = 30000 }: Options = {}) {
  const refreshRef = useRef(refresh);
  const onRef = useRef(on);
  refreshRef.current = refresh;
  onRef.current = on;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        refreshRef.current();
      }, 250);
    };

    const token = getAdminToken() || "";
    const socket: Socket = io(socketOrigin(), {
      auth: { token },
      transports: ["websocket", "polling"],
      extraHeaders: { Authorization: `Bearer ${token}`, "x-auth-token": token },
    });

    let connectedBefore = false;
    socket.on("connect", () => {
      // On a reconnect we may have missed events, so catch up
      if (connectedBefore) scheduleRefresh();
      connectedBefore = true;
    });
    DEFAULT_EVENTS.forEach((evt) => socket.on(evt, scheduleRefresh));
    Object.keys(onRef.current || {}).forEach((evt) => {
      socket.on(evt, (payload: any) => onRef.current?.[evt]?.(payload));
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const poll = pollMs > 0
      ? setInterval(() => {
          if (document.visibilityState === "visible") refreshRef.current();
        }, pollMs)
      : null;

    return () => {
      if (timer) clearTimeout(timer);
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);
}
