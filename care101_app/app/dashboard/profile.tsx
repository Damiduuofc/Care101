import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, StatusBar, TextInput, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Lock, LogOut, Edit3, ChevronRight, CreditCard, Clock, Camera, Save, X } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import BottomNavBar from '../../components/BottomNavBar'; 

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/doctor`;

// ✅ THEME COLORS
const THEME = {
  primary: '#0891b2', // Cyan 700
  secondary: '#06b6d4', // Cyan 500
  light: '#ecfeff', // Cyan 50
  border: '#cffafe', // Cyan 100
  text: '#0f172a',
  subtext: '#64748b',
  danger: '#ef4444',
  gold: '#f59e0b',
  bg: '#fff'
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Profile Data State
  const [profile, setProfile] = useState<any>({});
  
  // Password Modal State
  const [pwdModalVisible, setPwdModalVisible] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '' });

  // Permissions
  const [permissionResponse, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---

  const pickImage = async () => {
    if (permissionResponse?.status !== 'granted') {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permission Required", "Allow access to photos to update profile picture.");
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (!result.assets[0].base64) {
          Alert.alert("Error", "Could not generate image data.");
          return;
        }
        const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProfile({ ...profile, profileImage: base64Img }); 
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile)
      });

      if (res.ok) {
        Alert.alert("Success", "Profile updated successfully!");
        setIsEditing(false);
      } else {
        Alert.alert("Error", "Failed to update profile");
      }
    } catch (error) {
      Alert.alert("Error", "Network Error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new) {
        Alert.alert("Error", "Please fill all fields");
        return;
    }
    try {
        const token = await SecureStore.getItemAsync('token');
        const res = await fetch(`${API_URL}/change-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new })
        });
        const data = await res.json();
        if (res.ok) {
            Alert.alert("Success", "Password Changed!");
            setPwdModalVisible(false);
            setPasswords({ current: '', new: '' });
        } else {
            Alert.alert("Error", data.msg || "Failed to change password");
        }
    } catch (error) {
        Alert.alert("Error", "Network Error");
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Logout", 
        style: "destructive", 
        onPress: async () => {
          try {
            await SecureStore.deleteItemAsync('token');
            router.replace('/ads' as any); 
          } catch (error) {
            router.replace('/ads' as any);
          }
        }
      }
    ]);
  };

  const getPlanName = () => {
    const plan = profile.subscription?.plan;
    if (plan === 'premium') return 'Premium Plan';
    return 'Free Plan'; 
  };

  const getPlanColor = () => {
    return profile.subscription?.plan === 'premium' ? THEME.gold : THEME.primary;
  };

  if (loading) return <ActivityIndicator style={{marginTop:50}} size="large" color={THEME.primary} />;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* --- HEADER --- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={pickImage} disabled={!isEditing} style={styles.avatarContainer}>
            {profile?.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, {justifyContent:'center', alignItems:'center'}]}>
                    <User size={40} color="#cbd5e1" />
                </View>
            )}
            {isEditing && (
                <View style={styles.editBadge}>
                    <Camera size={14} color="#fff" />
                </View>
            )}
          </TouchableOpacity>
          
          <Text style={styles.greeting}>
             {isEditing ? "Edit Profile" : `Dr. ${profile.fullName ? profile.fullName.split(' ')[0] : 'User'}`}
          </Text>
          
          {/* ✅ SPECIALIZATION IS NOW READ-ONLY */}
          <Text style={styles.specialization}>{profile.specialization || "General Practitioner"}</Text>
        </View>

         {/* --- DETAILS FORM --- */}
        <View style={styles.detailsContainer}>
          <EditableRow 
            label="Full Name" 
            value={profile.fullName || ""} 
            isEditing={isEditing} 
            onChange={(t: string) => setProfile({...profile, fullName: t})} 
          />
          <EditableRow 
            label="Name w/ Initials" 
            value={profile.nameWithInitials || ""} 
            isEditing={isEditing} 
            onChange={(t: string) => setProfile({...profile, nameWithInitials: t})} 
          />
          <EditableRow 
            label="NIC" 
            value={profile.nic || ""} 
            isEditing={isEditing} 
            onChange={(t: string) => setProfile({...profile, nic: t})} 
          />
          <EditableRow 
            label="Phone" 
            value={profile.phone || ""} 
            isEditing={isEditing} 
            onChange={(t: string) => setProfile({...profile, phone: t})} 
          />
          <DetailRow label="Email" value={profile.email || ""} /> 
        </View>

        {/* --- SUBSCRIPTION CARD --- */}
        {!isEditing && (
            <View style={styles.subCard}>
                <View style={styles.subHeader}>
                    <Clock size={20} color={getPlanColor()} style={{marginRight: 8}} />
                    <Text style={styles.subTitle}>{getPlanName()}</Text>
                </View>
                <Text style={styles.subStatus}>
                    Status: <Text style={{fontWeight:'bold', textTransform:'capitalize'}}>{profile.subscription?.status || "Active"}</Text>
                </Text>
            </View>
        )}

        {/* --- MENU OPTIONS --- */}
        {!isEditing && (
            <View style={styles.menuContainer}>
                <MenuOption 
                    icon={Lock} 
                    label="Change Password" 
                    color={THEME.primary} 
                    onPress={() => setPwdModalVisible(true)} 
                />
                <MenuOption 
                    icon={CreditCard} 
                    label="Manage Subscription" 
                    color={THEME.primary} 
                    onPress={() => router.push('/subscription')} 
                />
            </View>
        )}

        {/* --- FOOTER BUTTONS --- */}
        <View style={styles.footerActions}>
          {isEditing ? (
             <>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                    <X size={18} color={THEME.subtext} style={{marginRight: 8}} />
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <Save size={18} color="#fff" style={{marginRight: 8}} />
                            <Text style={styles.saveText}>Save Changes</Text>
                        </>
                    )}
                </TouchableOpacity>
             </>
          ) : (
             <>
                <TouchableOpacity style={styles.editProfileBtn} onPress={() => setIsEditing(true)}>
                    <Edit3 size={18} color="#fff" style={{marginRight: 8}} />
                    <Text style={styles.btnText}>Edit Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <LogOut size={18} color="#fff" style={{marginRight: 8}} />
                    <Text style={styles.btnText}>Logout</Text>
                </TouchableOpacity>
             </>
          )}
        </View>

      </ScrollView>

      {/* --- PASSWORD MODAL --- */}
      <Modal visible={pwdModalVisible} transparent animationType="fade" onRequestClose={() => setPwdModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Change Password</Text>
                
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput style={styles.modalInput} secureTextEntry value={passwords.current} onChangeText={(t) => setPasswords({...passwords, current: t})} />
                
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput style={styles.modalInput} secureTextEntry value={passwords.new} onChangeText={(t) => setPasswords({...passwords, new: t})} />

                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalCancel} onPress={() => setPwdModalVisible(false)}>
                        <Text style={{color: THEME.subtext}}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalSave} onPress={handleChangePassword}>
                        <Text style={{color: '#fff', fontWeight:'600'}}>Change</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNavBar />
    </SafeAreaView>
  );
}

// --- HELPER COMPONENTS ---

const EditableRow = ({ label, value, isEditing, onChange }: any) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailSeparator}>:</Text>
    {isEditing ? (
        <TextInput 
            style={styles.editInput} 
            value={value} 
            onChangeText={onChange} 
            placeholder={label}
        />
    ) : (
        <Text style={styles.detailValue} numberOfLines={1}>{value || "N/A"}</Text>
    )}
  </View>
);

const DetailRow = ({ label, value }: any) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailSeparator}>:</Text>
    <Text style={[styles.detailValue, {color: THEME.subtext}]} numberOfLines={1}>{value || "N/A"}</Text>
  </View>
);

const MenuOption = ({ icon: Icon, label, color, onPress }: any) => (
  <TouchableOpacity style={styles.menuOption} onPress={onPress}>
    <View style={styles.menuLeft}>
      <Icon size={20} color={color} />
      <Text style={styles.menuText}>{label}</Text>
    </View>
    <ChevronRight size={20} color={THEME.subtext} />
  </TouchableOpacity>
);

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 100 },

  // Header
  header: { alignItems: 'center', marginBottom: 30 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: THEME.primary, padding: 8, borderRadius: 20, borderWidth: 3, borderColor: '#fff' },
  greeting: { fontSize: 20, fontWeight: '700', color: THEME.text, marginBottom: 4 },
  specialization: { fontSize: 14, color: THEME.subtext },

  // Details
  detailsContainer: { marginBottom: 24 },
  detailRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'center', height: 40 },
  detailLabel: { flex: 4, fontSize: 14, color: THEME.subtext },
  detailSeparator: { flex: 1, fontSize: 14, color: THEME.subtext, textAlign: 'center' },
  detailValue: { flex: 6, fontSize: 14, color: THEME.text, fontWeight: '500' },
  editInput: { flex: 6, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, fontSize: 14, color: THEME.text, backgroundColor: '#f8fafc' },

  // Subscription
  subCard: { backgroundColor: THEME.light, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: THEME.border },
  subHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  subTitle: { fontSize: 14, fontWeight: '700', color: THEME.text },
  subStatus: { fontSize: 12, color: THEME.subtext, marginLeft: 28 },

  // Menu
  menuContainer: { gap: 12, marginBottom: 30 },
  menuOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { fontSize: 15, fontWeight: '500', color: THEME.text },

  // Footer Buttons
  footerActions: { flexDirection: 'row', gap: 12 },
  editProfileBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.primary, padding: 14, borderRadius: 10 },
  logoutBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.danger, padding: 14, borderRadius: 10 },
  
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.primary, padding: 14, borderRadius: 10 },
  cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', padding: 14, borderRadius: 10 },
  
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancelText: { color: THEME.subtext, fontWeight: '600', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#334155' },
  modalInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 },
  modalCancel: { padding: 12 },
  modalSave: { backgroundColor: THEME.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
});