import { NativeModules, Platform, AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';

const { QueueWidgetModule } = NativeModules;

export interface WidgetData {
  state: 'queue' | 'upcoming' | 'completed' | 'empty';
  doctorId?: string | null;
  hospitalName?: string;
  doctorName?: string;
  room?: string;
  myToken?: number | string;
  ongoingToken?: number | string;
  peopleAhead?: number;
  isArrived?: boolean;
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
let appStateSubscription: any = null;

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
   * Trigger a native heads-up notification on the Android phone notification bar.
   */
  showLocalNotification: async (id: string, title: string, message: string) => {
    if (Platform.OS !== 'android' || !QueueWidgetModule || !message) return;
    try {
      await QueueWidgetModule.showLocalNotification(
        id || `${Date.now()}`,
        title || 'CareLink 101 Alert',
        message
      );
    } catch (error) {
      console.warn('QueueWidgetModule.showLocalNotification error:', error);
    }
  },

  /**
   * Directly push state data to the Android home screen widget.
   */
  updateWidgetData: async (data: WidgetData) => {
    if (Platform.OS !== 'android' || !QueueWidgetModule) return;
    try {
      lastWidgetPayload = data;
      if (data.doctorId && widgetSocket?.connected) {
        widgetSocket.emit('joinDoctorRoom', data.doctorId);
      }
      await QueueWidgetModule.updateWidgetData(JSON.stringify(data));
    } catch (error) {
      console.warn('QueueWidgetModule.updateWidgetData error:', error);
    }
  },

  /**
   * Start a persistent global Socket.IO connection + real-time sync loop dedicated to keeping
   * the Android Home Screen Widget and Phone Notification Bar updated in real-time.
   */
  startRealtimeSocket: (token: string, patientId: string) => {
    if (Platform.OS !== 'android' || !token || !patientId) return;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5002';
    WidgetService.setAuthContext(token, apiUrl, patientId);

    if (widgetSocket && activeToken === token && activePatientId === patientId) {
      if (!widgetSocket.connected) {
        widgetSocket.connect();
      }
      return;
    }

    WidgetService.stopRealtimeSocket();
    activeToken = token;
    activePatientId = patientId;

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
      reconnectionDelay: 2000,
    });

    widgetSocket.on('connect', () => {
      console.log('⚡ Widget Real-Time Socket.IO Connected');
      if (lastWidgetPayload?.doctorId) {
        widgetSocket?.emit('joinDoctorRoom', lastWidgetPayload.doctorId);
      }
      WidgetService.syncWithServer(token, patientId);
    });

    // 1. Instant optimistic update + server sync on doctor status change (Arrival / Delay / Session Start)
    widgetSocket.on('doctorStatusUpdated', async (updatedDoc: any) => {
      if (lastWidgetPayload && updatedDoc) {
        const isOurDoc =
          !lastWidgetPayload.doctorId ||
          String(lastWidgetPayload.doctorId) === String(updatedDoc._id);

        if (isOurDoc) {
          const currentServing = updatedDoc.currentQueueNumber ?? lastWidgetPayload.ongoingToken ?? 0;
          const myTokenNum = Number(lastWidgetPayload.myToken) || 0;
          const peopleAhead = Math.max(0, myTokenNum - Number(currentServing));
          const isArrived =
            updatedDoc.isArrived !== undefined
              ? !!updatedDoc.isArrived
              : !!lastWidgetPayload.isArrived;
          const channelingStatus =
            updatedDoc.channelingStatus || lastWidgetPayload.channelingStatus || 'On Time';
          const isDelayed = channelingStatus.toLowerCase() !== 'on time' && !isArrived;
          const room = updatedDoc.allocatedRoom || lastWidgetPayload.room || 'Room TBA';

          if (updatedDoc.sessionStarted && !updatedDoc.sessionEndedToday) {
            await WidgetService.updateWidgetData({
              ...lastWidgetPayload,
              state: 'queue',
              ongoingToken: currentServing,
              peopleAhead,
              isArrived: true,
              isDelayed: channelingStatus.toLowerCase() !== 'on time',
              channelingStatus,
              delayMessage:
                channelingStatus.toLowerCase() !== 'on time'
                  ? `Delayed: ${channelingStatus}`
                  : 'Session in progress',
              room,
            });
          } else if (!updatedDoc.sessionStarted && !updatedDoc.sessionEndedToday) {
            await WidgetService.updateWidgetData({
              ...lastWidgetPayload,
              state: 'upcoming',
              isArrived,
              isDelayed,
              channelingStatus,
              delayMessage: isArrived
                ? `Doctor Arrived • Ready in ${room}`
                : isDelayed
                  ? `Doctor Delayed: ${channelingStatus}`
                  : 'Doctor On Time',
              room,
            });
          }
        }
      }
      await WidgetService.syncWithServer(token, patientId);
    });

    // 2. Instant Doctor Arrival Alert -> Update Widget + Pop Phone Notification Bar
    widgetSocket.on('doctorArrivalAlert', async (payload: any) => {
      if (payload && lastWidgetPayload) {
        const isOurDoc =
          !lastWidgetPayload.doctorId ||
          String(lastWidgetPayload.doctorId) === String(payload.doctorId);

        if (isOurDoc) {
          const room = payload.allocatedRoom || lastWidgetPayload.room || 'Room TBA';
          const isArrived = !!payload.isArrived;
          await WidgetService.updateWidgetData({
            ...lastWidgetPayload,
            isArrived,
            isDelayed: isArrived ? false : lastWidgetPayload.isDelayed,
            room,
            delayMessage: isArrived
              ? `Doctor Arrived • Ready in ${room}`
              : lastWidgetPayload.delayMessage,
          });

          if (isArrived) {
            await WidgetService.showLocalNotification(
              `arrival_${payload.doctorId}_${new Date().toDateString()}`,
              'Doctor Arrived at Clinic',
              `Dr. ${payload.doctorName || lastWidgetPayload.doctorName || 'Doctor'} has arrived at ${room}. Your Token is #${lastWidgetPayload.myToken || '--'}.`
            );
          }
        }
      }
      await WidgetService.syncWithServer(token, patientId);
    });

    // 3. Instant Queue Token Update
    widgetSocket.on('queueUpdated', async (payload: any) => {
      if (lastWidgetPayload && payload && payload.currentToken !== undefined) {
        const isOurDoc =
          !lastWidgetPayload.doctorId ||
          !payload.doctorId ||
          String(lastWidgetPayload.doctorId) === String(payload.doctorId);

        if (isOurDoc) {
          const myTokenNum = Number(lastWidgetPayload.myToken) || 0;
          const peopleAhead = Math.max(0, myTokenNum - Number(payload.currentToken));
          await WidgetService.updateWidgetData({
            ...lastWidgetPayload,
            state: payload.sessionEndedToday ? 'completed' : 'queue',
            ongoingToken: payload.currentToken,
            peopleAhead,
            isArrived: true,
            room: payload.allocatedRoom || lastWidgetPayload.room,
          });
        }
      }
      await WidgetService.syncWithServer(token, patientId);
    });

    // 4. Instant Doctor Delay Alert -> Update Widget + Pop Phone Notification Bar
    widgetSocket.on('doctorDelayAlert', async (payload: any) => {
      if (payload && lastWidgetPayload) {
        const isOurDoc =
          !lastWidgetPayload.doctorId ||
          String(lastWidgetPayload.doctorId) === String(payload.doctorId);

        if (isOurDoc) {
          const status = payload.channelingStatus || payload.status || 'Delayed';
          const isDelayed = status.toLowerCase() !== 'on time';
          const room = payload.allocatedRoom || lastWidgetPayload.room || 'Room TBA';

          await WidgetService.updateWidgetData({
            ...lastWidgetPayload,
            isDelayed: isDelayed && !lastWidgetPayload.isArrived,
            channelingStatus: status,
            room,
            delayMessage: isDelayed ? `Doctor Delayed: ${status}` : 'Doctor On Time',
          });

          await WidgetService.showLocalNotification(
            `delay_${payload.doctorId}_${status}`,
            isDelayed ? 'Doctor Delay Notice' : 'Doctor Back On Schedule',
            isDelayed
              ? `Dr. ${payload.doctorName || lastWidgetPayload.doctorName || 'Doctor'} is ${status} (${room}).`
              : `Good news! Dr. ${payload.doctorName || lastWidgetPayload.doctorName || 'Doctor'} is now on schedule.`
          );
        }
      }
      await WidgetService.syncWithServer(token, patientId);
    });

    // 5. Instant Direct Notification Event -> Pop on Phone Notification Bar
    widgetSocket.on('newNotification', async (notif: any) => {
      if (notif && String(notif.userId) === String(patientId)) {
        const title =
          notif.title ||
          (notif.type === 'arrival'
            ? 'Doctor Arrived'
            : notif.type === 'doctor_status'
              ? 'Clinic Status Update'
              : notif.type === 'reminder'
                ? 'Live Queue Alert'
                : 'CareLink 101 Alert');
        await WidgetService.showLocalNotification(
          notif._id || `${Date.now()}`,
          title,
          notif.message || ''
        );
        await WidgetService.syncWithServer(token, patientId);
      }
    });

    widgetSocket.on('appointmentUpdated', () => {
      WidgetService.syncWithServer(token, patientId);
    });

    // Re-verify state when app transitions between background and foreground (Android Foreground Service keeps Socket.IO active)
    if (appStateSubscription) {
      appStateSubscription.remove();
    }
    appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if ((nextState === 'active' || nextState === 'background') && activeToken && activePatientId) {
        WidgetService.setAuthContext(
          activeToken,
          process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5002',
          activePatientId
        );
      }
    });
  },

  stopRealtimeSocket: () => {
    if (widgetSocket) {
      widgetSocket.disconnect();
      widgetSocket = null;
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
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
        if (payload.doctorId && widgetSocket?.connected) {
          widgetSocket.emit('joinDoctorRoom', payload.doctorId);
        }
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
