import { NativeModules, Platform, AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';

const { QueueWidgetModule } = NativeModules;

export interface WidgetData {
  state: 'queue' | 'upcoming' | 'completed' | 'empty';
  hospitalName?: string;
  doctorName?: string;
  room?: string;
  myToken?: number | string;
  ongoingToken?: number | string;
  peopleAhead?: number;
  isDelayed?: boolean;
  delayMessage?: string;
  channelingStatus?: string;
  formattedDate?: string;
  channelingTime?: string;
  hasUpcoming?: boolean;
  nextDoctorName?: string;
  nextHospitalName?: string;
  nextRoom?: string;
  nextToken?: number | string;
  nextDate?: string;
}

let widgetSocket: Socket | null = null;
let activeToken: string | null = null;
let activePatientId: string | null = null;
let lastWidgetPayload: WidgetData | null = null;

export const WidgetService = {
  /**
   * Save auth and server details so Android native widget can self-refresh via background network calls.
   */
  setAuthContext: async (token: string, apiUrl: string, patientId: string) => {
    if (Platform.OS !== 'android' || !QueueWidgetModule) return;
    try {
      await QueueWidgetModule.setAuthContext(token, apiUrl, patientId);
    } catch (error) {
      console.warn('QueueWidgetModule.setAuthContext error:', error);
    }
  },

  /**
   * Directly push state data to the Android home screen widget.
   */
  updateWidgetData: async (data: WidgetData) => {
    if (Platform.OS !== 'android' || !QueueWidgetModule) return;
    try {
      lastWidgetPayload = data;
      await QueueWidgetModule.updateWidgetData(JSON.stringify(data));
    } catch (error) {
      console.warn('QueueWidgetModule.updateWidgetData error:', error);
    }
  },

  /**
   * Start a persistent global Socket.IO connection dedicated to keeping the Android Home Screen Widget
   * updated in real-time across all app screens and background states.
   */
  startRealtimeSocket: (token: string, patientId: string) => {
    if (Platform.OS !== 'android' || !token || !patientId) return;

    if (widgetSocket && activeToken === token && activePatientId === patientId) {
      if (!widgetSocket.connected) {
        widgetSocket.connect();
      }
      return;
    }

    WidgetService.stopRealtimeSocket();
    activeToken = token;
    activePatientId = patientId;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5002';
    let socketUrl = apiUrl;
    try {
      const urlObj = new URL(apiUrl);
      socketUrl = urlObj.origin;
    } catch (e) {
      console.warn('Invalid API URL for widget socket:', e);
    }

    widgetSocket = io(socketUrl, {
      extraHeaders: {
        'ngrok-skip-browser-warning': 'true',
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionInterval: 3000,
    });

    widgetSocket.on('connect', () => {
      console.log('⚡ Widget Real-Time Socket.IO Connected');
      WidgetService.syncWithServer(token, patientId);
    });

    // Instant optimistic update + server sync on doctor status change
    widgetSocket.on('doctorStatusUpdated', async (updatedDoc: any) => {
      if (lastWidgetPayload && updatedDoc) {
        const currentServing = updatedDoc.currentQueueNumber ?? lastWidgetPayload.ongoingToken ?? 0;
        const myTokenNum = Number(lastWidgetPayload.myToken) || 0;
        const peopleAhead = Math.max(0, myTokenNum - Number(currentServing));
        const channelingStatus = updatedDoc.channelingStatus || lastWidgetPayload.channelingStatus || 'On Time';
        const isDelayed = channelingStatus.toLowerCase() !== 'on time';

        if (updatedDoc.sessionStarted && !updatedDoc.sessionEndedToday) {
          await WidgetService.updateWidgetData({
            ...lastWidgetPayload,
            state: 'queue',
            ongoingToken: currentServing,
            peopleAhead,
            isDelayed,
            channelingStatus,
            delayMessage: isDelayed ? `Delayed: ${channelingStatus}` : 'Session in progress',
            room: updatedDoc.allocatedRoom || lastWidgetPayload.room,
          });
        } else if (!updatedDoc.sessionStarted && !updatedDoc.sessionEndedToday) {
          await WidgetService.updateWidgetData({
            ...lastWidgetPayload,
            state: 'upcoming',
            isDelayed,
            channelingStatus,
            delayMessage: isDelayed ? `Doctor Delayed: ${channelingStatus}` : 'Doctor On Time',
            room: updatedDoc.allocatedRoom || lastWidgetPayload.room,
          });
        }
      }
      await WidgetService.syncWithServer(token, patientId);
    });

    widgetSocket.on('queueUpdated', async (payload: any) => {
      if (lastWidgetPayload && payload && payload.currentToken !== undefined) {
        const myTokenNum = Number(lastWidgetPayload.myToken) || 0;
        const peopleAhead = Math.max(0, myTokenNum - Number(payload.currentToken));
        await WidgetService.updateWidgetData({
          ...lastWidgetPayload,
          state: 'queue',
          ongoingToken: payload.currentToken,
          peopleAhead,
        });
      }
      await WidgetService.syncWithServer(token, patientId);
    });

    widgetSocket.on('doctorDelayAlert', () => {
      WidgetService.syncWithServer(token, patientId);
    });

    widgetSocket.on('appointmentUpdated', () => {
      WidgetService.syncWithServer(token, patientId);
    });

    // Also sync whenever app transitions between background and foreground
    AppState.addEventListener('change', (nextState) => {
      if ((nextState === 'active' || nextState === 'background') && activeToken && activePatientId) {
        WidgetService.syncWithServer(activeToken, activePatientId);
      }
    });
  },

  stopRealtimeSocket: () => {
    if (widgetSocket) {
      widgetSocket.disconnect();
      widgetSocket = null;
    }
    activeToken = null;
    activePatientId = null;
    lastWidgetPayload = null;
  },

  /**
   * Fetch latest widget data from backend and update the widget.
   */
  syncWithServer: async (token: string, patientId: string) => {
    if (Platform.OS !== 'android' || !token || !patientId) return;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5002';
    try {
      // 1. Ensure widget has auth credentials for independent background refresh
      if (QueueWidgetModule) {
        await QueueWidgetModule.setAuthContext(token, apiUrl, patientId);
      }

      // 2. Fetch widget status payload
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      const res = await fetch(`${cleanUrl}/appointments/widget-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (res.ok) {
        const payload: WidgetData = await res.json();
        lastWidgetPayload = payload;
        if (QueueWidgetModule) {
          await QueueWidgetModule.updateWidgetData(JSON.stringify(payload));
        }
      } else {
        console.warn('Widget sync error: HTTP', res.status);
      }
    } catch (error) {
      console.warn('Failed to sync Android widget with server:', error);
    }
  },

  /**
   * Reset widget to the empty state (app logo on white background).
   */
  clearWidget: async () => {
    WidgetService.stopRealtimeSocket();
    if (Platform.OS !== 'android' || !QueueWidgetModule) return;
    try {
      await QueueWidgetModule.clearWidgetData();
    } catch (error) {
      console.warn('QueueWidgetModule.clearWidgetData error:', error);
    }
  },
};
