import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  Bell,
  X,
  Info,
  Trash2,
  Calendar,
  User,
  Wallet,
  Stethoscope,
  ChevronRight,
  Activity,
  BarChart3,
  FileText
} from 'lucide-react-native';

import BottomNavBar from '../../components/BottomNavBar';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/doctor`;

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // State for Dynamic Data
  const [stats, setStats] = useState({
    name: "Doctor",
    specialization: "Specialist",
    channelingTime: "",
    channelingStatus: "On Time",
    currentQueueNumber: 0,
    allocatedRoom: "",
    isArrived: false,
    income: 0,
    records: 0
  });

  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const API_BASE = process.env.EXPO_PUBLIC_API_URL;

  const bannerImage = { uri: "https://unsplash.com/photos/black-and-gray-stethoscope-yo01Z-9HQAw" };

  const quickActions = [
    {
      id: 5,
      title: 'Today\'s Clinic',
      subtitle: stats.channelingTime 
        ? `Arrival: ${stats.channelingTime}${stats.channelingStatus !== 'On Time' ? ` (${stats.channelingStatus})` : ''} • Q: ${stats.currentQueueNumber}` 
        : 'Manage today\'s session & patients',
      icon: User,
      link: '/dashboard/patients',
      color: '#ec4899',
      bg: '#fdf2f8',
    },
    {
      id: 4,
      title: 'Appointments',
      subtitle: 'View schedule and manage bookings',
      icon: Calendar,
      link: '/dashboard/appointment',
      color: '#f59e0b',
      bg: '#fffbeb',
    },
    {
      id: 1,
      title: 'Finance Management',
      subtitle: 'Track channeling and surgical finances',
      icon: BarChart3,
      link: '/dashboard/finance',
      color: '#10b981',
      bg: '#ecfdf5',
    },
    {
      id: 2,
      title: 'Surgery Records',
      subtitle: 'Manage patient surgery records',
      icon: Activity,
      link: '/dashboard/records',
      color: '#06b6d4',
      bg: '#cffafe',
    },
    {
      id: 3,
      title: 'Surgery Instructions',
      subtitle: 'Create and manage pre/post-op instructions',
      icon: FileText,
      link: '/dashboard/instructions',
      color: '#8b5cf6',
      bg: '#f5f3ff',
    },

  ];

    const fetchDashboard = async () => {
      try {
        const token = await SecureStore.getItemAsync("token");

        if (!token) {
          console.log("No token found, redirecting to login");
          router.replace("/");
          return;
        }

        const response = await fetch(`${API_URL}/dashboard-stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.log("Failed to fetch stats, status:", response.status);
        }
      } catch (error) {
        console.error("Network Error:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchNotifications = async () => {
      if (notifications.length === 0) setNotifLoading(true);
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) {
          console.log("NOTIF ERROR: No token found");
          return;
        }
        const res = await fetch(`${API_BASE}/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          console.log("DOCTOR NOTIFS FULL DATA:", JSON.stringify(data, null, 2));
          setNotifications(data);
          const unread = data.filter((n: any) => !n.read).length;
          setUnreadCount(unread);
        }
      } catch (error) {
        console.error("Notifications Error:", error);
      } finally {
        setNotifLoading(false);
      }
    };

    const markAsRead = async (id: string) => {
      try {
        const token = await SecureStore.getItemAsync('token');
        await fetch(`${API_BASE}/notifications/read/${id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchNotifications();
      } catch (error) {
        console.error(error);
      }
    };

    const deleteNotification = async (id: string) => {
      try {
        const token = await SecureStore.getItemAsync('token');
        await fetch(`${API_BASE}/notifications/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchNotifications();
      } catch (error) {
        console.error(error);
      }
    };

    const clearAllNotifications = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        await fetch(`${API_BASE}/notifications/clear-all`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchNotifications();
      } catch (error) {
        console.error(error);
      }
    };

  // ✅ AUTO-REFRESH LOGIC
  // This runs every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
      fetchNotifications();

      // Real-time polling
      const intervalId = setInterval(fetchNotifications, 10000); // 10 seconds

      return () => clearInterval(intervalId);
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboard(), fetchNotifications()]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.headerContainer}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <User size={24} color="#06b6d4" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeText}>Welcome Doctor</Text>
              <Text style={styles.doctorName}>{stats.name}</Text>
              <Text style={styles.specialization}>{stats.specialization}</Text>
            </View>

            {/* NOTIFICATION BELL */}
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => setShowNotifModal(true)}
            >
              <Bell size={24} color="#64748b" />
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* --- HERO BANNER --- */}
        <View style={styles.heroContainer}>
          <Image source={bannerImage} style={styles.heroImage} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.heroOverlay}
          >
            <Text style={styles.heroTitle}>SMART CARE STARTS HERE</Text>
            <Text style={styles.heroSubtitle}>Your Entire Practice In One Place</Text>
          </LinearGradient>
        </View>

        {/* --- OVERVIEW SECTION --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.overviewGrid}>

            {/* INCOME CARD */}
            <View style={styles.overviewCard}>
              <View style={[styles.iconCircle, { backgroundColor: '#ecfdf5' }]}>
                <Wallet size={24} color="#10b981" />
              </View>
              <View>
                <Text style={styles.statValue}>Rs. {stats.income.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Payable Income</Text>
              </View>
            </View>

            {/* RECORDS CARD */}
            <View style={styles.overviewCard}>
              <View style={[styles.iconCircle, { backgroundColor: '#e0f2fe' }]}>
                <Stethoscope size={24} color="#0ea5e9" />
              </View>
              <View>
                <Text style={styles.statValue}>{stats.records}</Text>
                <Text style={styles.statLabel}>Total Records</Text>
              </View>
            </View>
          </View>
        </View>

        {/* --- QUICK ACTIONS SECTION --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionList}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionCard}
                onPress={() => router.push(action.link as any)}
              >
                <View style={[styles.actionIconBox, { backgroundColor: action.bg }]}>
                  <action.icon size={24} color={action.color} />
                </View>
                <View style={styles.actionDetails}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                </View>
                <ChevronRight size={20} color="#cbd5e1" />
              </TouchableOpacity>
            ))}
          </View>
        </View>



      </ScrollView>

      {/* --- NOTIFICATIONS MODAL --- */}
      <Modal
        visible={showNotifModal}
        animationType="slide"
        onRequestClose={() => setShowNotifModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Notifications</Text>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAllNotifications}>
                  <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600', marginTop: 4 }}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => setShowNotifModal(false)} style={styles.closeBtn}>
              <X size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>

          {notifLoading && notifications.length === 0 ? (
            <ActivityIndicator size="large" color="#06b6d4" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ padding: 20 }}
              ListEmptyComponent={
                <View style={styles.emptyNotif}>
                  <Bell size={48} color="#e2e8f0" />
                  <Text style={styles.emptyNotifText}>No notifications yet</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View
                  style={[styles.notifCard, !item.read && styles.notifUnread]}
                >
                  <View style={[styles.notifContent, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <TouchableOpacity 
                      onPress={() => markAsRead(item._id)}
                      style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifMsg, !item.read && { fontWeight: '700' }]}>{item.message}</Text>
                        <Text style={styles.notifTime}>{new Date(item.timestamp).toLocaleString()}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.deleteBtn} 
                    onPress={() => deleteNotification(item._id)}
                  >
                    <X size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      <BottomNavBar />
    </View>
  );
}

// Keep your existing styles...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerSafeArea: {
    backgroundColor: '#fff',
    zIndex: 10,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#cffafe',
  },
  welcomeText: {
    fontSize: 14,
    color: '#06b6d4',
    fontWeight: '700',
    marginBottom: 2,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  specialization: {
    fontSize: 13,
    color: '#64748b',
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  unreadBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  heroContainer: {
    margin: 20,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  actionList: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionDetails: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyStateCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyStateText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    elevation: 1,
    overflow: 'hidden'
  },
  notifContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  deleteBtn: {
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifUnread: {
    backgroundColor: '#f0f9ff',
    borderColor: '#e0f2fe',
  },
  notifIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifMsg: { fontSize: 14, color: '#334155', marginBottom: 4, lineHeight: 20 },
  notifTime: { fontSize: 11, color: '#94a3b8' },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0ea5e9' },
  emptyNotif: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyNotifText: { color: '#94a3b8', fontSize: 16, marginTop: 16 },
});
