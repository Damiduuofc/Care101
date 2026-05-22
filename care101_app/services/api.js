import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';


const getBaseUrl = () => {
    // Prioritize environment variable (e.g., for ngrok)
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }

    // Fallback for local development
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:5001/api';
    }
    return 'http://localhost:5001/api';
};

const api = axios.create({
    baseURL: getBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
    async (config) => {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
