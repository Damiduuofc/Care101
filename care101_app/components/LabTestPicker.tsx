import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

// Lets doctors pick lab tests from the admin-configured catalog; prices come from the catalog
export default function LabTestPicker({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
    const [tests, setTests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const token = await SecureStore.getItemAsync('token');
                const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/lab-tests`, {
                    headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
                });
                if (res.ok) setTests(await res.json());
            } catch (err) {
                console.error('Fetch Lab Tests Error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const toggle = (id: string) => {
        onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
    };

    const filtered = tests.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()));
    const total = tests.filter(t => selectedIds.includes(t._id)).reduce((sum, t) => sum + Number(t.price || 0), 0);

    if (loading) return <ActivityIndicator style={{ marginVertical: 16 }} color="#0891b2" />;

    if (tests.length === 0) {
        return <Text style={styles.empty}>No lab tests are configured yet. Ask the system administrator to add lab tests and prices.</Text>;
    }

    return (
        <View style={{ marginBottom: 12 }}>
            <TextInput style={styles.search} placeholder="Search tests..." value={search} onChangeText={setSearch} />
            <ScrollView style={styles.list} nestedScrollEnabled>
                {filtered.map(test => {
                    const checked = selectedIds.includes(test._id);
                    return (
                        <TouchableOpacity key={test._id} style={[styles.row, checked && styles.rowChecked]} onPress={() => toggle(test._id)}>
                            <View style={[styles.box, checked && styles.boxChecked]}>
                                {checked && <Check size={12} color="#fff" />}
                            </View>
                            <Text style={styles.name} numberOfLines={1}>{test.name}</Text>
                            <Text style={styles.price}>LKR {Number(test.price).toLocaleString()}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
            <View style={styles.totalRow}>
                <Text style={styles.totalText}>{selectedIds.length} selected</Text>
                <Text style={styles.totalText}>Total: LKR {total.toLocaleString()}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    empty: { fontSize: 13, color: '#d97706', fontWeight: '600', marginVertical: 12 },
    search: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginBottom: 8, backgroundColor: '#fff' },
    list: { maxHeight: 220, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    rowChecked: { backgroundColor: '#ecfeff' },
    box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
    boxChecked: { backgroundColor: '#0891b2', borderColor: '#0891b2' },
    name: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' },
    price: { fontSize: 12, color: '#475569', fontWeight: '700' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2 },
    totalText: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
});
