import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar, Modal, Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Video, Mic, FileText, CloudUpload, QrCode, Eye, X } from 'lucide-react-native'; // Removed Lock icon
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import QRCode from 'react-native-qrcode-svg'; 

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function InstructionDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [expiresAtDate, setExpiresAtDate] = useState<string | null>(null);
  const [showExpireSelect, setShowExpireSelect] = useState(false);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [selectedSection, setSelectedSection] = useState<'preOp' | 'postOp' | null>(null);

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      // Only fetch instruction data (Profile/Plan check removed)
      const res = await fetch(`${API_URL}/instructions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const instructionData = await res.json();
      setData(instructionData);
    } catch (error) { 
        console.error(error); 
    } finally { 
        setLoading(false); 
    }
  };

  // ✅ DELETE ENTIRE INSTRUCTION
  const handleDeleteInstruction = async () => {
    Alert.alert("Delete Surgery", "Are you sure? This will delete all files inside it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          const token = await SecureStore.getItemAsync('token');
          await fetch(`${API_URL}/instructions/${id}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
          });
          router.back();
      }}
    ]);
  };

  // ✅ DELETE SPECIFIC FILE
  const handleRemoveFile = async (section: string, type: string) => {
    Alert.alert("Remove File", "Are you sure you want to remove this file?", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: async () => {
            try {
                const token = await SecureStore.getItemAsync('token');
                const res = await fetch(`${API_URL}/instructions/${id}/${section}/${type}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const updatedData = await res.json();
                    setData(updatedData); // Refresh UI
                }
            } catch (error) { Alert.alert("Error", "Could not remove file"); }
        }}
    ]);
  };

  // ✅ UPLOAD FILE (No Limits)
  const handleUpload = async (section: 'preOp' | 'postOp', type: 'video' | 'audio' | 'document') => {
    // Removed subscription check logic here

    const result = await DocumentPicker.getDocumentAsync({
      type: type === 'video' ? 'video/*' : type === 'audio' ? 'audio/*' : 'application/pdf',
      copyToCacheDirectory: true
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const file = result.assets[0];
      setUploading(true);

      try {
        const token = await SecureStore.getItemAsync('token');
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream',
        } as any);

        const res = await fetch(`${API_URL}/instructions/${id}/${section}/${type}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (res.ok) {
            const updatedData = await res.json();
            setData(updatedData);
        } else { Alert.alert("Error", "Upload failed"); }
      } catch (err) { Alert.alert("Error", "Network error"); } finally { setUploading(false); }
    }
  };

  const handleOpenLink = (url: string) => { if (url) Linking.openURL(url); };

  if (loading) return <ActivityIndicator style={{marginTop:50}} size="large" color="#0891b2" />;
  if (!data) return <Text>Not Found</Text>;
  const getFrontendUrl = () => {
    if (API_URL) {
      let url = API_URL.replace(/\/api\/?$/, '');
      // Replace any port (e.g. :5000 or :5002) with the nextjs port :9002
      url = url.replace(/:[0-9]+$/, ':9002');
      return url;
    }
    return 'http://localhost:9002';
  };

  const patientViewUrl = shareToken 
    ? `${getFrontendUrl()}/patient/instructions/${shareToken}`
    : '';

  const handleQrPress = (section: 'preOp' | 'postOp') => {
    setSelectedSection(section);
    setShowExpireSelect(true);
  };

  const handleSelectExpiry = async (days: number) => {
    setShowExpireSelect(false);
    setGeneratingShare(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/instructions/${id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ expireDays: days, section: selectedSection })
      });
      if (res.ok) {
        const shareData = await res.json();
        setShareToken(shareData.token);
        const dateObj = new Date(shareData.expiresAt);
        setExpiresAtDate(dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
        setQrVisible(true);
      } else {
        Alert.alert("Error", "Failed to generate share link");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setGeneratingShare(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <ArrowLeft size={24} color="#0f172a" />
            </TouchableOpacity>
            <View>
                <Text style={styles.headerTitle}>{data.surgeryName}</Text>
                <Text style={styles.headerSub}>Smart Care, Starts Here</Text>
            </View>
        </View>
        <TouchableOpacity onPress={handleDeleteInstruction} style={styles.deleteBtn}>
            <Trash2 size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* PRE-OP */}
        <InstructionSection 
            title="Pre-Operative" color="#3b82f6"
            onQrPress={() => handleQrPress('preOp')}
            files={data.preOp}
            onUpload={(type: any) => handleUpload('preOp', type)}
            onRemove={(type: any) => handleRemoveFile('preOp', type)}
            onView={(url: string) => handleOpenLink(url)}
        />

        {/* POST-OP */}
        <InstructionSection 
            title="Post-Operative" color="#10b981"
            onQrPress={() => handleQrPress('postOp')}
            files={data.postOp}
            onUpload={(type: any) => handleUpload('postOp', type)}
            onRemove={(type: any) => handleRemoveFile('postOp', type)}
            onView={(url: string) => handleOpenLink(url)}
        />

      </ScrollView>

      {(uploading || generatingShare) && (
        <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{color:'#fff', marginTop:10}}>{uploading ? "Uploading file..." : "Generating share code..."}</Text>
        </View>
      )}

      {/* QR Modal */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <TouchableOpacity style={styles.closeModal} onPress={() => setQrVisible(false)}>
                    <X size={24} color="#64748b" />
                </TouchableOpacity>
                <Text style={styles.qrTitle}>Patient Access Code</Text>
                <Text style={styles.qrSub}>Scan to view instructions</Text>
                <View style={styles.qrWrapper}>
                    {patientViewUrl ? <QRCode value={patientViewUrl} size={200} /> : null}
                </View>
                {expiresAtDate && (
                  <Text style={styles.expiryText}>Expires on: {expiresAtDate}</Text>
                )}
            </View>
        </View>
      </Modal>

      {/* Expiration Selection Modal */}
      <Modal visible={showExpireSelect} transparent animationType="slide" onRequestClose={() => setShowExpireSelect(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <TouchableOpacity style={styles.closeModal} onPress={() => setShowExpireSelect(false)}>
                    <X size={24} color="#64748b" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Share Instructions</Text>
                <Text style={styles.modalSub}>Select access expiration time frame for the QR code:</Text>
                
                <View style={styles.optionsWrapper}>
                  {[30, 60, 90].map((days) => (
                    <TouchableOpacity key={days} style={styles.optionBtn} onPress={() => handleSelectExpiry(days)}>
                      <Text style={styles.optionText}>{days} Days</Text>
                    </TouchableOpacity>
                  ))}
                </View>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- SUB-COMPONENTS ---

// Removed 'plan' prop
const InstructionSection = ({ title, color, onQrPress, files, onUpload, onRemove, onView }: any) => (
    <View style={styles.card}>
        <View style={styles.sectionHeader}>
            <View style={[styles.accentBar, { backgroundColor: color }]} />
            <Text style={styles.sectionTitle}>{title}</Text>
            <TouchableOpacity style={[styles.qrBtn, {backgroundColor: `${color}15`}]} onPress={onQrPress}>
                <QrCode size={20} color={color} />
            </TouchableOpacity>
        </View>
        
        {/* Removed 'isLocked' prop */}
        <MediaRow type="video" label="Video" url={files.video} onUpload={() => onUpload('video')} onRemove={() => onRemove('video')} onView={() => onView(files.video)} />
        <MediaRow type="audio" label="Audio" url={files.audio} onUpload={() => onUpload('audio')} onRemove={() => onRemove('audio')} onView={() => onView(files.audio)} />
        <MediaRow type="document" label="Document" url={files.document} onUpload={() => onUpload('document')} onRemove={() => onRemove('document')} onView={() => onView(files.document)} />
    </View>
);

const MediaRow = ({ type, label, url, onUpload, onRemove, onView }: any) => {
    const Icon = type === 'video' ? Video : type === 'audio' ? Mic : FileText;
    const color = type === 'video' ? '#3b82f6' : type === 'audio' ? '#8b5cf6' : '#64748b';
    const bg = type === 'video' ? '#eff6ff' : type === 'audio' ? '#f5f3ff' : '#f1f5f9';
    const hasFile = !!url;

    return (
        <View style={styles.mediaRow}>
            <View style={[styles.iconBox, { backgroundColor: bg }]}>
                <Icon size={20} color={color} />
            </View>
            
            <View style={{flex: 1}}>
                <Text style={styles.mediaLabel}>{label}</Text>
                <Text style={[styles.mediaStatus, hasFile && { color: '#10b981' }]}>
                    {hasFile ? "File uploaded" : "No file uploaded"}
                </Text>
            </View>

            {/* Buttons: Upload vs (View + Delete) */}
            {hasFile ? (
                <View style={{flexDirection: 'row', gap: 8}}>
                     <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={onView}>
                        <Eye size={18} color="#fff" />
                     </TouchableOpacity>
                     <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={onRemove}>
                        <Trash2 size={18} color="#ef4444" />
                     </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]} // Always blue (active)
                    onPress={onUpload}
                >
                    <CloudUpload size={20} color="#fff" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  headerSub: { fontSize: 12, color: '#64748b' },
  deleteBtn: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 8 },
  content: { padding: 20, gap: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  accentBar: { width: 4, height: 24, borderRadius: 2, marginRight: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  qrBtn: { padding: 8, borderRadius: 8 },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mediaLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  mediaStatus: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 30, alignItems: 'center' },
  closeModal: { position: 'absolute', top: 16, right: 16, padding: 8 },
  qrTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  qrSub: { fontSize: 14, color: '#64748b', marginBottom: 30 },
  qrWrapper: { padding: 10, backgroundColor: '#fff', borderRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center', paddingHorizontal: 10 },
  optionsWrapper: { width: '100%', gap: 12, marginBottom: 10 },
  optionBtn: { width: '100%', paddingVertical: 14, backgroundColor: '#0891b2', borderRadius: 12, alignItems: 'center' },
  optionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  expiryText: { fontSize: 13, color: '#ef4444', marginTop: 16, fontWeight: '600', textAlign: 'center' },
});