import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image, // Import Image component
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker'; // 1. Import ImagePicker

export default function CreateRecordScreen() {
  const router = useRouter();
  
  // Form State
  const [name, setName] = useState('');
  const [nic, setNic] = useState('');
  const [hospital, setHospital] = useState('');
  const [image, setImage] = useState<string | null>(null); // 2. Image State

  // 3. Image Picker Function
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Could not pick image");
    }
  };

  const handleCreate = () => {
    if (!name.trim() || !image) {
      Alert.alert("Required", "Please provide a Patient Name and a Surgery Card Image.");
      return;
    }
    // Handle creation logic here
    console.log("Creating record:", { name, nic, hospital, image });
    router.back();
  };

  // Helper to determine if form is valid for styling
  const isFormValid = name.trim().length > 0 && image !== null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Surgery Record</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          
          {/* Section: Patient Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Patient Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter patient name"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Patient NIC (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter patient NIC"
                placeholderTextColor="#94a3b8"
                value={nic}
                onChangeText={setNic}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hospital (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter hospital name"
                placeholderTextColor="#94a3b8"
                value={hospital}
                onChangeText={setHospital}
              />
            </View>
          </View>

          {/* Section: Surgery Card Image */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Surgery Card Image *</Text>
            
            {/* 4. Conditional Rendering for Image Upload Box */}
            <TouchableOpacity 
              style={[styles.uploadBox, image && styles.uploadBoxFilled]} 
              onPress={pickImage}
              activeOpacity={0.8}
            >
              {image ? (
                <>
                  <Image source={{ uri: image }} style={styles.previewImage} />
                  <View style={styles.imageOverlay}>
                    <Camera size={24} color="#fff" />
                    <Text style={styles.changeText}>Tap to Change</Text>
                  </View>
                </>
              ) : (
                <>
                  <Camera size={40} color="#94a3b8" />
                  <Text style={styles.uploadText}>Tap to take photo or choose from gallery     </Text>
                  <Text style={styles.uploadSubText}>Surgery card image required</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Clear Image Button (Optional) */}
            {image && (
              <TouchableOpacity onPress={() => setImage(null)} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Remove Image</Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>

        {/* Footer Action Button */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.createBtn, isFormValid ? styles.createBtnActive : styles.createBtnDisabled]} 
            onPress={handleCreate}
            disabled={!isFormValid}
          >
            <Text style={[styles.createBtnText, isFormValid && styles.createBtnTextActive]}>
              Create Surgery Record
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  
  content: { padding: 20 },
  
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, color: '#334155', marginBottom: 8, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#0f172a', backgroundColor: '#fff' },

  // Upload Styles
  uploadBox: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 12, height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', overflow: 'hidden' },
  uploadBoxFilled: { borderStyle: 'solid', borderWidth: 0 },
  uploadText: { marginTop: 16, fontSize: 14, color: '#475569', textAlign: 'center', fontWeight: '500' },
  uploadSubText: { marginTop: 4, fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  
  // Image Preview Styles
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  changeText: { color: '#fff', fontWeight: '600', marginTop: 8 },
  
  clearBtn: { marginTop: 12, alignItems: 'center' },
  clearBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '500' },

  // Footer Styles
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  createBtn: { borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  createBtnDisabled: { backgroundColor: '#e2e8f0' },
  createBtnActive: { backgroundColor: '#2563eb' },
  createBtnText: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
  createBtnTextActive: { color: '#fff' },
});