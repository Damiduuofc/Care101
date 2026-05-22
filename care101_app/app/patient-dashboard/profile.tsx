import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl,
    Modal,
    TextInput,
    Alert,
    FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import PatientBottomNavBar from '../../components/PatientBottomNavBar';
import { useAuth } from '@/context/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ProfileScreen() {
    const { token, signOut } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modals State
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
    const [isNotifModalVisible, setNotifModalVisible] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);

    // Edit Form State
    const [formData, setFormData] = useState<any>({});
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });

    // --- 1. FETCH PROFILE ---
    const fetchProfile = async () => {
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setProfile(data);
                setFormData(data); 
            }
        } catch (error) {
            console.error("Failed to load profile", error);
        } finally {
            setLoading(false);
        }
    };

    // --- 2. FETCH NOTIFICATIONS ---
    const fetchNotifications = async () => {
        try {
            // Pointing to the correct /notifications endpoint
            const response = await fetch(`${API_URL}/notifications`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'x-auth-token': token 
                }
            });

            if (response.ok) {
                const data = await response.json();
                setNotifications(data);
                setNotifModalVisible(true);

                // Auto-mark as read when modal opens
                if (data.some((n: any) => !n.read)) {
                    await fetch(`${API_URL}/notifications/read-all`, {
                        method: 'PUT',
                        headers: { 
                            'Authorization': `Bearer ${token}`, 
                            'x-auth-token': token 
                        }
                    });
                }
            } else {
                Alert.alert("Notice", "No notifications found.");
            }
        } catch (error) {
            console.error("Fetch Notif Error:", error);
            Alert.alert("Error", "Could not connect to notification server");
        }
    };

    useFocusEffect(
        useCallback(() => { fetchProfile(); }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchProfile();
        setRefreshing(false);
    };

    // --- 3. IMAGE PICKER ---
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
            setFormData({ ...formData, profileImage: base64Image });
        }
    };

    // --- 4. UPDATE PROFILE HANDLER ---
    const handleUpdateProfile = async () => {
        try {
            const response = await fetch(`${API_URL}/auth/update-profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const updatedData = await response.json();
                setProfile(updatedData.patient);
                setEditModalVisible(false);
                Alert.alert("Success", "Profile updated successfully!");
            } else {
                Alert.alert("Error", "Failed to update profile.");
            }
        } catch (error) {
            Alert.alert("Error", "Server error occurred.");
        }
    };

    // --- 5. CHANGE PASSWORD HANDLER ---
    const handleChangePassword = async () => {
        if (passwordData.new !== passwordData.confirm) {
            Alert.alert("Error", "New passwords do not match.");
            return;
        }
        try {
            const response = await fetch(`${API_URL}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: passwordData.current,
                    newPassword: passwordData.new
                })
            });

            const data = await response.json();
            if (response.ok) {
                Alert.alert("Success", "Password changed successfully.");
                setPasswordModalVisible(false);
                setPasswordData({ current: '', new: '', confirm: '' });
            } else {
                Alert.alert("Error", data.msg || "Failed to change password.");
            }
        } catch (error) {
            Alert.alert("Error", "Server error.");
        }
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
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.title}>My Profile</Text>
                </View>

                <ScrollView 
                    contentContainerStyle={styles.scrollContent} 
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#06b6d4']} />}
                >
                    <View style={styles.profileCard}>
                        <View style={styles.avatarContainer}>
                            {profile?.profileImage ? (
                                <Image source={{ uri: profile.profileImage }} style={styles.avatarImage} />
                            ) : (
                                <Ionicons name="person" size={40} color="#06b6d4" />
                            )}
                        </View>
                        
                        <Text style={styles.name}>
                            {profile?.fullName || profile?.username || "Patient"}
                        </Text>
                        
                        <Text style={styles.email}>{profile?.email || ""}</Text>
                        <Text style={styles.role}>Patient</Text>

                        <TouchableOpacity style={styles.editButton} onPress={() => setEditModalVisible(true)}>
                            <Text style={styles.editButtonText}>Edit Profile</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>General</Text>
                        
                        <TouchableOpacity style={styles.settingItem} onPress={fetchNotifications}>
                            <Ionicons name="notifications-outline" size={22} color="#64748b" />
                            <Text style={styles.settingText}>Notifications</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                        </TouchableOpacity>

                        <InfoItem icon="call-outline" label="Emergency Contact" value={profile?.emergencyContact} />
                        <InfoItem icon="shield-checkmark-outline" label="Insurance Provider" value={profile?.insuranceProvider} />
                        <InfoItem icon="document-text-outline" label="Policy Number" value={profile?.policyNumber} />
                        <InfoItem icon="medkit-outline" label="Medical Conditions" value={profile?.medicalConditions} />
                        <InfoItem icon="warning-outline" label="Allergies" value={profile?.allergies} />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account & Security</Text>
                        <TouchableOpacity style={styles.settingItem} onPress={() => setPasswordModalVisible(true)}>
                            <Ionicons name="lock-closed-outline" size={22} color="#64748b" />
                            <Text style={styles.settingText}>Change Password</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.settingItem} onPress={signOut}>
                            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                            <Text style={[styles.settingText, { color: '#ef4444' }]}>Log Out</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>

            <PatientBottomNavBar />

            {/* --- EDIT PROFILE MODAL --- */}
            <Modal visible={isEditModalVisible} animationType="slide">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Edit Profile</Text>
                        <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#0f172a" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                                {formData.profileImage ? (
                                    <Image source={{ uri: formData.profileImage }} style={styles.avatarImage} />
                                ) : (
                                    <Ionicons name="camera" size={30} color="#06b6d4" />
                                )}
                            </TouchableOpacity>
                            <Text style={{ color: '#06b6d4', marginTop: 8, fontWeight: '600' }}>Change Photo</Text>
                        </View>

                        <InputLabel label="Full Name" />
                        <TextInput style={styles.input} value={formData.fullName} onChangeText={t => setFormData({...formData, fullName: t})} />

                        <InputLabel label="Mobile Number" />
                        <TextInput style={styles.input} value={formData.mobileNumber} onChangeText={t => setFormData({...formData, mobileNumber: t})} keyboardType="phone-pad"/>

                        <Text style={styles.sectionTitle}>Medical & Emergency</Text>
                        <InputLabel label="Emergency Contact" />
                        <TextInput style={styles.input} value={formData.emergencyContact} onChangeText={t => setFormData({...formData, emergencyContact: t})} placeholder="Name & Phone" />
                        <InputLabel label="Medical Conditions" />
                        <TextInput style={styles.input} value={formData.medicalConditions} onChangeText={t => setFormData({...formData, medicalConditions: t})} placeholder="e.g. Diabetes" />
                        <InputLabel label="Allergies" />
                        <TextInput style={styles.input} value={formData.allergies} onChangeText={t => setFormData({...formData, allergies: t})} placeholder="e.g. Peanuts" />

                        <Text style={styles.sectionTitle}>Insurance</Text>
                        <InputLabel label="Insurance Provider" />
                        <TextInput style={styles.input} value={formData.insuranceProvider} onChangeText={t => setFormData({...formData, insuranceProvider: t})} />
                        <InputLabel label="Policy Number" />
                        <TextInput style={styles.input} value={formData.policyNumber} onChangeText={t => setFormData({...formData, policyNumber: t})} />

                        <TouchableOpacity style={styles.saveButton} onPress={handleUpdateProfile}>
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        </TouchableOpacity>
                        <View style={{height: 50}}/>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* --- CHANGE PASSWORD MODAL --- */}
            <Modal visible={isPasswordModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.popupCard}>
                        <Text style={styles.modalTitle}>Change Password</Text>
                        <TextInput style={styles.input} placeholder="Current Password" secureTextEntry value={passwordData.current} onChangeText={t => setPasswordData({...passwordData, current: t})} />
                        <TextInput style={styles.input} placeholder="New Password" secureTextEntry value={passwordData.new} onChangeText={t => setPasswordData({...passwordData, new: t})} />
                        <TextInput style={styles.input} placeholder="Confirm New Password" secureTextEntry value={passwordData.confirm} onChangeText={t => setPasswordData({...passwordData, confirm: t})} />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPasswordModalVisible(false)}>
                                <Text style={{color: '#64748b'}}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleChangePassword}>
                                <Text style={{color: '#fff', fontWeight: 'bold'}}>Update</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- NOTIFICATIONS MODAL --- */}
            <Modal visible={isNotifModalVisible} animationType="slide">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Notifications</Text>
                        <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#0f172a" />
                        </TouchableOpacity>
                    </View>
                    
                    <FlatList 
                        data={notifications}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={{padding: 20}}
                        ListEmptyComponent={<Text style={{textAlign:'center', color:'#94a3b8', marginTop: 20}}>No notifications</Text>}
                        renderItem={({item}) => (
                            <View style={[
                                styles.notifCard, 
                                !item.read && { borderLeftColor: '#06b6d4', borderLeftWidth: 4 },
                                item.type === 'arrival' && { backgroundColor: '#f0fdf4' }
                            ]}>
                                <View style={[
                                    styles.notifIcon, 
                                    { backgroundColor: item.type === 'arrival' ? '#dcfce7' : (item.type === 'appointment' ? '#ecfeff' : '#f1f5f9') }
                                ]}>
                                    <Ionicons 
                                        name={
                                            item.type === 'arrival' ? "business" : 
                                            item.type === 'appointment' ? "calendar" : "notifications"
                                        } 
                                        size={20} 
                                        color={item.type === 'arrival' ? '#16a34a' : '#06b6d4'} 
                                    />
                                </View>
                                <View style={{flex: 1}}>
                                    <Text style={[styles.notifMessage, !item.read && { fontWeight: '700' }]}>{item.message}</Text>
                                    <Text style={styles.notifTime}>
                                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                    </Text>
                                </View>
                                {!item.read && <View style={styles.unreadDot} />}
                            </View>
                        )}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const InfoItem = ({ icon, label, value }: any) => {
    if (!value) return null;
    return (
        <View style={styles.settingItem}>
            <Ionicons name={icon} size={22} color="#64748b" />
            <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.settingLabel}>{label}</Text>
                <Text style={styles.settingValue}>{value}</Text>
            </View>
        </View>
    );
};

const InputLabel = ({ label }: { label: string }) => (
    <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 12 }}>{label}</Text>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    safeArea: { flex: 1, marginBottom: 80 },
    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
    profileCard: {
        backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 4,
    },
    avatarContainer: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#ecfeff', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16, borderWidth: 2, borderColor: '#cffafe', overflow: 'hidden'
    },
    avatarImage: { width: '100%', height: '100%' },
    name: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4, textAlign: 'center' },
    email: { fontSize: 14, color: '#64748b', marginBottom: 4 },
    role: { fontSize: 12, color: '#06b6d4', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
    editButton: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 20 },
    editButtonText: { fontSize: 14, fontWeight: '600', color: '#475569' },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', marginTop: 10 },
    settingItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10 },
    settingText: { flex: 1, marginLeft: 16, fontSize: 16, color: '#334155', fontWeight: '500' },
    settingLabel: { fontSize: 12, color: '#94a3b8' },
    settingValue: { fontSize: 15, color: '#334155', fontWeight: '500' },
    modalContainer: { flex: 1, backgroundColor: '#fff' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    popupCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, color: '#0f172a', marginBottom: 10 },
    saveButton: { backgroundColor: '#06b6d4', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
    saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 15 },
    cancelBtn: { padding: 10 },
    confirmBtn: { backgroundColor: '#06b6d4', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    notifCard: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    notifIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    notifMessage: { fontSize: 14, color: '#334155', marginBottom: 4 },
    notifTime: { fontSize: 11, color: '#94a3b8' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginLeft: 8, marginTop: 6 },
});