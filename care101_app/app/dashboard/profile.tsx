import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, StatusBar, TextInput, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User, Lock, LogOut, Pencil, ChevronRight, Camera, X, Phone, Mail, CreditCard,
  Stethoscope, Building2, BadgeCheck, Eye, EyeOff, ChevronDown, Check
} from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import BottomNavBar from '../../components/BottomNavBar';
import { departments, departmentLabel } from '../lib/data';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/doctor`;

const THEME = {
  primary: '#06B6D4',
  primaryDark: '#0891b2',
  light: '#ecfeff',
  text: '#0f172a',
  subtext: '#64748b',
  muted: '#94a3b8',
  border: '#e2e8f0',
  surface: '#f8fafc',
  danger: '#ef4444',
};

type EditableFields = {
  fullName: string;
  nameWithInitials: string;
  nic: string;
  phone: string;
  specialization: string;
  profileImage: string | null;
};

// The API returns "N/A" for empty values; treat those as blank when editing
const clean = (v?: string | null) => (!v || v === 'N/A' ? '' : v);

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<any>({});
  const [form, setForm] = useState<EditableFields>({
    fullName: '', nameWithInitials: '', nic: '', phone: '', specialization: '', profileImage: null,
  });
  const [deptPickerVisible, setDeptPickerVisible] = useState(false);

  // Password Modal State
  const [pwdModalVisible, setPwdModalVisible] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

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

  const startEditing = () => {
    setForm({
      fullName: clean(profile.fullName),
      nameWithInitials: clean(profile.nameWithInitials),
      nic: clean(profile.nic),
      phone: clean(profile.phone),
      specialization: profile.specialization || '',
      profileImage: profile.profileImage || null,
    });
    setIsEditing(true);
  };

  const hasChanges =
    form.fullName !== clean(profile.fullName) ||
    form.nameWithInitials !== clean(profile.nameWithInitials) ||
    form.nic !== clean(profile.nic) ||
    form.phone !== clean(profile.phone) ||
    form.specialization !== (profile.specialization || '') ||
    form.profileImage !== (profile.profileImage || null);
  const formValid = form.fullName.trim().length > 0;

  const cancelEditing = () => {
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }
    Alert.alert("Discard changes?", "Your edits will not be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => setIsEditing(false) },
    ]);
  };

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
        setForm(f => ({ ...f, profileImage: base64Img }));
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSaveProfile = async () => {
    if (!formValid || !hasChanges) return;
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      // Only the doctor-editable fields are sent; email/SLMC stay with the hospital
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          nameWithInitials: form.nameWithInitials.trim(),
          nic: form.nic.trim(),
          phone: form.phone.trim(),
          specialization: form.specialization,
          profileImage: form.profileImage,
        })
      });

      if (res.ok) {
        setProfile({ ...profile, ...form });
        setIsEditing(false);
        Alert.alert("Saved", "Your profile has been updated.");
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert("Not saved", data.msg || "Failed to update profile");
      }
    } catch (error) {
      Alert.alert("Error", "Network Error");
    } finally {
      setSaving(false);
    }
  };

  const closePasswordModal = () => {
    setPwdModalVisible(false);
    setPasswords({ current: '', new: '', confirm: '' });
    setShowPasswords(false);
  };

  const pwdMismatch = passwords.confirm.length > 0 && passwords.new !== passwords.confirm;
  const pwdTooShort = passwords.new.length > 0 && passwords.new.length < 6;
  const canChangePwd =
    !!passwords.current && passwords.new.length >= 6 && passwords.new === passwords.confirm && !changingPwd;

  const handleChangePassword = async () => {
    if (!canChangePwd) return;
    setChangingPwd(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        Alert.alert("Done", "Your password has been changed.");
        closePasswordModal();
      } else {
        Alert.alert("Not changed", data.msg || "Failed to change password");
      }
    } catch (error) {
      Alert.alert("Error", "Network Error");
    } finally {
      setChangingPwd(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
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

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color={THEME.primary} />;

  const avatarUri = isEditing ? form.profileImage : profile.profileImage;
  const department = departmentLabel(profile.specialization) || 'General Practitioner';
  // Keep the doctor's current value selectable even if it isn't in the signup list
  const deptOptions = departments.map(d => d.name);
  const currentDept = departmentLabel(form.specialization);
  if (currentDept && !deptOptions.includes(currentDept)) deptOptions.unshift(currentDept);

  // ─── EDIT MODE ───────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        <View style={styles.topBar}>
          <TouchableOpacity onPress={cancelEditing} style={styles.topBarSide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={24} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Edit profile</Text>
          <View style={styles.topBarSide} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.editAvatarWrap} onPress={pickImage} accessibilityLabel="Change photo">
              <Avatar uri={avatarUri} size={104} />
              <View style={styles.cameraBadge}>
                <Camera size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickImage}>
              <Text style={styles.changePhotoText}>Change photo</Text>
            </TouchableOpacity>

            <Field
              label="Full name"
              value={form.fullName}
              onChangeText={(t: string) => setForm(f => ({ ...f, fullName: t }))}
              error={!formValid ? 'Full name is required' : undefined}
              autoCapitalize="words"
            />
            <Field
              label="Name with initials"
              value={form.nameWithInitials}
              onChangeText={(t: string) => setForm(f => ({ ...f, nameWithInitials: t }))}
              autoCapitalize="words"
            />
            <Field
              label="NIC"
              value={form.nic}
              onChangeText={(t: string) => setForm(f => ({ ...f, nic: t }))}
              autoCapitalize="characters"
            />
            <Field
              label="Phone"
              value={form.phone}
              onChangeText={(t: string) => setForm(f => ({ ...f, phone: t.replace(/[^0-9+ ]/g, '') }))}
              keyboardType="phone-pad"
            />

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Department</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setDeptPickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={`Department, ${departmentLabel(form.specialization) || 'not set'}`}
              >
                <Text style={[styles.selectValue, !form.specialization && { color: THEME.muted }]} numberOfLines={1}>
                  {departmentLabel(form.specialization) || 'Choose department'}
                </Text>
                <ChevronDown size={18} color={THEME.subtext} />
              </TouchableOpacity>
            </View>

            <LockedField label="Email" value={profile.email} />
            {!!profile.slmcReg && <LockedField label="SLMC number" value={profile.slmcReg} />}
            <Text style={styles.lockedNote}>Locked fields can only be changed by the hospital.</Text>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* DEPARTMENT PICKER */}
        <Modal visible={deptPickerVisible} transparent animationType="slide" onRequestClose={() => setDeptPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setDeptPickerVisible(false)} accessibilityLabel="Close" />
            <View style={[styles.sheet, { maxHeight: '70%' }]}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.sheetTitle, { marginBottom: 12 }]}>Department</Text>
              <ScrollView>
                {deptOptions.map(name => {
                  const selected = name === currentDept;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[styles.optionRow, selected && styles.optionRowSelected]}
                      onPress={() => {
                        setForm(f => ({ ...f, specialization: name }));
                        setDeptPickerVisible(false);
                      }}
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{departmentLabel(name)}</Text>
                      {selected && <Check size={18} color={THEME.primaryDark} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <View style={styles.saveBar}>
          <TouchableOpacity
            style={[styles.saveBtn, (!hasChanges || !formValid || saving) && styles.saveBtnDisabled]}
            onPress={handleSaveProfile}
            disabled={!hasChanges || !formValid || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.saveText, (!hasChanges || !formValid) && styles.saveTextDisabled]}>
                {hasChanges ? 'Save changes' : 'No changes yet'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── VIEW MODE ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.light} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* HERO */}
        <View style={styles.hero}>
          <TouchableOpacity style={styles.heroEdit} onPress={startEditing} accessibilityLabel="Edit profile">
            <Pencil size={16} color={THEME.primaryDark} />
            <Text style={styles.heroEditText}>Edit</Text>
          </TouchableOpacity>

          <Avatar uri={avatarUri} size={96} ring />
          <Text style={styles.name} numberOfLines={2}>Dr. {clean(profile.fullName) || 'Doctor'}</Text>
          <View style={styles.deptPill}>
            <Stethoscope size={14} color={THEME.primaryDark} />
            <Text style={styles.deptPillText}>{department}</Text>
          </View>
          {!!profile.hospital && <Text style={styles.hospital}>{profile.hospital}</Text>}
        </View>

        {/* PERSONAL */}
        <Text style={styles.groupTitle}>Personal</Text>
        <View style={styles.card}>
          <InfoRow icon={User} label="Name with initials" value={clean(profile.nameWithInitials)} />
          <InfoRow icon={CreditCard} label="NIC" value={clean(profile.nic)} />
          <InfoRow icon={Phone} label="Phone" value={clean(profile.phone)} />
          <InfoRow icon={Mail} label="Email" value={profile.email} last />
        </View>

        {/* WORK */}
        <Text style={styles.groupTitle}>Work</Text>
        <View style={styles.card}>
          <InfoRow icon={Stethoscope} label="Department" value={department} />
          {!!profile.slmcReg && <InfoRow icon={BadgeCheck} label="SLMC number" value={profile.slmcReg} locked />}
          <InfoRow icon={Building2} label="Hospital" value={profile.hospital} last />
        </View>

        {/* ACCOUNT */}
        <Text style={styles.groupTitle}>Account</Text>
        <View style={styles.card}>
          <ActionRow icon={Lock} label="Change password" onPress={() => setPwdModalVisible(true)} />
          <ActionRow icon={LogOut} label="Log out" onPress={handleLogout} danger last />
        </View>
      </ScrollView>

      {/* PASSWORD MODAL */}
      <Modal visible={pwdModalVisible} transparent animationType="slide" onRequestClose={closePasswordModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Change password</Text>
              <TouchableOpacity onPress={() => setShowPasswords(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {showPasswords ? <EyeOff size={20} color={THEME.subtext} /> : <Eye size={20} color={THEME.subtext} />}
              </TouchableOpacity>
            </View>

            <Field
              label="Current password"
              value={passwords.current}
              onChangeText={(t: string) => setPasswords(p => ({ ...p, current: t }))}
              secureTextEntry={!showPasswords}
            />
            <Field
              label="New password"
              value={passwords.new}
              onChangeText={(t: string) => setPasswords(p => ({ ...p, new: t }))}
              secureTextEntry={!showPasswords}
              error={pwdTooShort ? 'At least 6 characters' : undefined}
            />
            <Field
              label="Confirm new password"
              value={passwords.confirm}
              onChangeText={(t: string) => setPasswords(p => ({ ...p, confirm: t }))}
              secureTextEntry={!showPasswords}
              error={pwdMismatch ? 'Passwords do not match' : undefined}
            />

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancel} onPress={closePasswordModal}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSave, !canChangePwd && styles.saveBtnDisabled]}
                onPress={handleChangePassword}
                disabled={!canChangePwd}
              >
                {changingPwd ? <ActivityIndicator color="#fff" /> : (
                  <Text style={[styles.saveText, !canChangePwd && styles.saveTextDisabled]}>Change</Text>
                )}
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

const Avatar = ({ uri, size, ring }: { uri?: string | null; size: number; ring?: boolean }) => (
  <View style={[ring && styles.avatarRing, { borderRadius: size }]}>
    {uri ? (
      <Image source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
    ) : (
      <View style={[styles.avatar, styles.avatarEmpty, { width: size, height: size, borderRadius: size / 2 }]}>
        <User size={size * 0.42} color={THEME.muted} />
      </View>
    )}
  </View>
);

const InfoRow = ({ icon: Icon, label, value, locked, last }: any) => (
  <View style={[styles.infoRow, !last && styles.rowDivider]}>
    <View style={styles.rowIcon}>
      <Icon size={18} color={THEME.primaryDark} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, !value && styles.infoValueEmpty]} numberOfLines={1}>
        {value || 'Not added'}
      </Text>
    </View>
    {locked && <Lock size={14} color={THEME.muted} />}
  </View>
);

const ActionRow = ({ icon: Icon, label, onPress, danger, last }: any) => (
  <TouchableOpacity style={[styles.infoRow, !last && styles.rowDivider]} onPress={onPress}>
    <View style={[styles.rowIcon, danger && { backgroundColor: '#fef2f2' }]}>
      <Icon size={18} color={danger ? THEME.danger : THEME.primaryDark} />
    </View>
    <Text style={[styles.actionLabel, danger && { color: THEME.danger }]}>{label}</Text>
    {!danger && <ChevronRight size={20} color={THEME.muted} />}
  </TouchableOpacity>
);

const Field = ({ label, error, ...inputProps }: any) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, !!error && styles.fieldInputError]}
      placeholderTextColor={THEME.muted}
      {...inputProps}
    />
    {!!error && <Text style={styles.fieldError}>{error}</Text>}
  </View>
);

const LockedField = ({ label, value }: { label: string; value?: string }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.lockedInput}>
      <Text style={styles.lockedValue} numberOfLines={1}>{value || '—'}</Text>
      <Lock size={14} color={THEME.muted} />
    </View>
  </View>
);

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.surface },
  content: { paddingBottom: 110 },

  // Hero
  hero: {
    alignItems: 'center',
    backgroundColor: THEME.light,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroEdit: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  heroEditText: { fontSize: 14, fontWeight: '600', color: THEME.primaryDark },
  avatarRing: { padding: 4, backgroundColor: '#fff' },
  avatar: { backgroundColor: '#f1f5f9' },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '700', color: THEME.text, marginTop: 14, textAlign: 'center' },
  deptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  deptPillText: { fontSize: 13, fontWeight: '600', color: THEME.primaryDark },
  hospital: { fontSize: 12, color: THEME.subtext, marginTop: 8 },

  // Groups
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 16,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: 12, color: THEME.subtext },
  infoValue: { fontSize: 15, fontWeight: '600', color: THEME.text, marginTop: 2 },
  infoValueEmpty: { color: THEME.muted, fontWeight: '500' },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: THEME.text },

  // Edit mode
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  topBarSide: { width: 40 },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: THEME.text },
  editContent: { padding: 20, paddingBottom: 40 },
  editAvatarWrap: { alignSelf: 'center', marginTop: 8 },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: THEME.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: THEME.surface,
  },
  changePhotoText: {
    alignSelf: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primaryDark,
    marginTop: 10,
    marginBottom: 24,
  },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  fieldInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: THEME.text,
  },
  fieldInputError: { borderColor: THEME.danger },
  fieldError: { fontSize: 12, color: THEME.danger, marginTop: 4 },
  lockedInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  lockedValue: { flex: 1, fontSize: 16, color: THEME.subtext },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  selectValue: { flex: 1, fontSize: 16, color: THEME.text },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  optionRowSelected: { backgroundColor: THEME.light },
  optionText: { fontSize: 16, color: THEME.text },
  optionTextSelected: { fontWeight: '700', color: THEME.primaryDark },
  lockedNote: { fontSize: 12, color: THEME.muted, textAlign: 'center', marginTop: 4 },

  saveBar: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  saveBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: THEME.border },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  saveTextDisabled: { color: THEME.muted },

  // Password sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: THEME.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: THEME.text },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  sheetCancel: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  sheetCancelText: { fontSize: 16, fontWeight: '600', color: THEME.subtext },
  sheetSave: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: THEME.primary,
  },
});
