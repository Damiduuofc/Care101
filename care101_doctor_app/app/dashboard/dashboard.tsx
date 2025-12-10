import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router'; 
import * as SecureStore from 'expo-secure-store'; // ✅ CHANGED: Use SecureStore
import { 
  Clock, 
  ChevronRight, 
  Wallet, 
  Activity, 
  BarChart3, 
  FileText, 
  User,
  Stethoscope,
} from 'lucide-react-native';

import BottomNavBar from '../../components/BottomNavBar'; 

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/doctor`;
export default function DashboardScreen() {
  const router = useRouter(); 
  const [loading, setLoading] = useState(true);
  
  // State for Dynamic Data
  const [stats, setStats] = useState({
    name: "Doctor",
    specialization: "Specialist",
    income: 0,
    records: 0
  });

  const bannerImage = { uri: "https://images.unsplash.com/photo-1576091160550-2187d80a1b95?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80" };

  const quickActions = [
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

  // ✅ FETCH DATA FUNCTION
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        // ✅ FIX: Use SecureStore to match auth.tsx
        const token = await SecureStore.getItemAsync("token");
        
        if (!token) {
          console.log("No token found, redirecting to login");
          router.replace("/"); // Redirect to index (Login)
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

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
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
            <View>
              <Text style={styles.welcomeText}>Welcome Doctor</Text>
              <Text style={styles.doctorName}>{stats.name}</Text>
              <Text style={styles.specialization}>{stats.specialization}</Text>
            </View>
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

      <BottomNavBar />
    </View>
  );
}

// Keep your existing styles exactly as they were
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
});