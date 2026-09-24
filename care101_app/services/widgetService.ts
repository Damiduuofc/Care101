import { NativeModules, Platform } from 'react-native';

const { QueueWidgetModule } = NativeModules;

export interface WidgetData {
  state: 'queue' | 'upcoming' | 'completed' | 'empty';
  hospitalName?: string;
  doctorName?: string;
  room?: string;
  myToken?: number | string;
  ongoingToken?: number | string;
  peopleAhead?: number;
  estimatedWait?: number;
  isDelayed?: boolean;
  delayMessage?: string;
  formattedDate?: string;
  channelingTime?: string;
  hasUpcoming?: boolean;
  nextDoctorName?: string;
  nextHospitalName?: string;
  nextRoom?: string;
  nextToken?: number | string;
  nextDate?: string;
}

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
      await QueueWidgetModule.updateWidgetData(JSON.stringify(data));
    } catch (error) {
      console.warn('QueueWidgetModule.updateWidgetData error:', error);
    }
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
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (res.ok) {
        const payload: WidgetData = await res.json();
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
    if (Platform.OS !== 'android' || !QueueWidgetModule) return;
    try {
      await QueueWidgetModule.clearWidgetData();
    } catch (error) {
      console.warn('QueueWidgetModule.clearWidgetData error:', error);
    }
  }
};
