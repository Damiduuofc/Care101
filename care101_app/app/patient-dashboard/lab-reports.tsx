import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    ScrollView,
    Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, FlaskConical, FileText, X, Download, Clock, CheckCircle2, Stethoscope, ArrowUpDown } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '@/context/auth';
import PatientBottomNavBar from '@/components/PatientBottomNavBar';
import { SkeletonList } from '../../components/Skeleton';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type StatusFilter = 'all' | 'completed' | 'pending';

type LabReport = {
    _id: string;
    title: string;
    doctorName: string;
    department: string;
    tests: string[];
    status: 'pending' | 'completed';
    date: string;
    recordId?: string;
    description?: string;
};

const headersFor = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
});

export default function PatientLabReportsScreen() {
    const { user } = useAuth();

    const [reports, setReports] = useState<LabReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [department, setDepartment] = useState('All');
    const [sortMode, setSortMode] = useState<'newest' | 'az' | 'za'>('newest');
    const SORT_LABELS = { newest: 'Newest', az: 'Dept A–Z', za: 'Dept Z–A' } as const;
    const cycleSort = () => setSortMode((m) => (m === 'newest' ? 'az' : m === 'az' ? 'za' : 'newest'));

    const [selected, setSelected] = useState<any>(null);
    const [opening, setOpening] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            fetchReports();
        }, [user])
    );

    const fetchReports = async () => {
        try {
            const token = await SecureStore.getItemAsync('token');
            const patientId = (user as any)?._id || user?.id || user?.patientId;
            if (!token || !patientId) return;

            const [labRes, medRes] = await Promise.all([
                fetch(`${API_URL}/lab-requests/patient/${encodeURIComponent(patientId)}`, { headers: headersFor(token) }),
                fetch(`${API_URL}/medical-records/my-records`, { headers: headersFor(token) }),
            ]);
            const labRequests: any[] = labRes.ok ? await labRes.json() : [];
            const medicalRecords: any[] = medRes.ok ? await medRes.json() : [];

            const fromRequests: LabReport[] = labRequests.map((r) => ({
                _id: r._id,
                title: r.title || 'Lab Test',
                doctorName: r.doctorName || 'Doctor',
                department: r.doctorId?.specialization || 'General Practitioner',
                tests: (r.tests || []).map((t: any) => t.name).filter(Boolean),
                status: r.status === 'completed' ? 'completed' : 'pending',
                date: r.createdAt,
                recordId: r.recordId ? String(r.recordId?._id || r.recordId) : undefined,
                description: r.description,
            }));

            // Lab results uploaded directly (not attached to a request) still count as lab reports
            const linkedRecordIds = new Set(fromRequests.map((r) => r.recordId).filter(Boolean));
            const standalone: LabReport[] = medicalRecords
                .filter((m) => m.type === 'lab_tests' && !linkedRecordIds.has(String(m._id)))
                .map((m) => ({
                    _id: m._id,
                    title: m.title || 'Lab Report',
                    doctorName: m.doctorName || 'Lab',
                    department: m.doctorId?.specialization || 'Laboratory',
                    tests: [],
                    status: 'completed',
                    date: m.date || m.createdAt,
                    recordId: String(m._id),
                    description: m.description,
                }));

            const combined = [...fromRequests, ...standalone].sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            setReports(combined);
        } catch (error) {
            console.error('Fetch Lab Reports Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const departments = useMemo(
        () => ['All', ...Array.from(new Set(reports.map((r) => r.department))).sort((a, b) => a.localeCompare(b))],
        [reports]
    );

    const counts = useMemo(() => ({
        all: reports.length,
        completed: reports.filter((r) => r.status === 'completed').length,
        pending: reports.filter((r) => r.status === 'pending').length,
    }), [reports]);

    const visible = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const filtered = reports.filter((r) => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (department !== 'All' && r.department !== department) return false;
            if (!q) return true;
            return [r.title, r.doctorName, r.department, ...r.tests].some((v) => v?.toLowerCase().includes(q));
        });
        const byDate = (a: LabReport, b: LabReport) => new Date(b.date).getTime() - new Date(a.date).getTime();
        return [...filtered].sort((a, b) => {
            if (sortMode === 'newest') return byDate(a, b);
            const cmp = a.department.localeCompare(b.department);
            return (sortMode === 'za' ? -cmp : cmp) || byDate(a, b);
        });
    }, [reports, searchQuery, statusFilter, department, sortMode]);

    const openReport = async (report: LabReport) => {
        if (report.status !== 'completed' || !report.recordId) {
            Alert.alert('Report not ready', 'The lab has not uploaded the result for this test yet.');
            return;
        }
        setOpening(true);
        try {
            const token = await SecureStore.getItemAsync('token');
            const res = await fetch(`${API_URL}/medical-records/download/${report.recordId}`, { headers: headersFor(token || '') });
            if (!res.ok) throw new Error(String(res.status));
            setSelected({ ...(await res.json()), _report: report });
        } catch (error) {
            console.error('Open Lab Report Error:', error);
            Alert.alert('Error', 'Failed to load the lab report.');
        } finally {
            setOpening(false);
        }
    };

    const handleDownload = async (fileData: string, fileName: string, fileType: string) => {
        try {
            const base64 = fileData.includes(';base64,') ? fileData.split(';base64,')[1] : fileData;
            const ext = fileType === 'application/pdf' ? '.pdf' : fileType === 'image/png' ? '.png' : '.jpg';
            const uri = `${FileSystem.documentDirectory}${fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${ext}`;
            await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
            else Alert.alert('Success', `File saved to: ${uri}`);
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert('Error', 'Failed to download file.');
        }
    };

    const formatDate = (d: string) =>
        d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

    const renderItem = ({ item }: { item: LabReport }) => {
        const done = item.status === 'completed';
        return (
            <TouchableOpacity style={styles.card} onPress={() => openReport(item)} activeOpacity={0.7}>
                <View style={styles.cardTop}>
                    <View style={styles.iconWrap}>
                        <FlaskConical size={22} color="#0891b2" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.deptText}>{item.department.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.statusPill, done ? styles.statusDone : styles.statusPending]}>
                        {done ? <CheckCircle2 size={12} color="#047857" /> : <Clock size={12} color="#b45309" />}
                        <Text style={[styles.statusText, { color: done ? '#047857' : '#b45309' }]}>
                            {done ? 'Ready' : 'Pending'}
                        </Text>
                    </View>
                </View>

                {item.tests.length > 0 && (
                    <View style={styles.testRow}>
                        {item.tests.map((t, i) => (
                            <View key={`${t}-${i}`} style={styles.testTag}>
                                <Text style={styles.testTagText}>{t}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.cardFooter}>
                    <View style={styles.metaRow}>
                        <Stethoscope size={13} color="#64748b" />
                        <Text style={styles.metaText} numberOfLines={1}>{item.doctorName}</Text>
                    </View>
                    <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
        <TouchableOpacity
            style={[styles.chip, active && styles.chipActive]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
        >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Lab Reports</Text>
                    <Text style={styles.headerSub}>Tests your doctors ordered and their results</Text>
                </View>

                <View style={styles.filters}>
                    <View style={styles.searchRow}>
                    <View style={[styles.searchBar, { flex: 1 }]}>
                        <Search size={20} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by test, doctor or department..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <TouchableOpacity
                        style={styles.sortBtn}
                        onPress={cycleSort}
                        accessibilityRole="button"
                        accessibilityLabel={`Sort: ${SORT_LABELS[sortMode]}`}
                    >
                        <ArrowUpDown size={16} color="#0891b2" />
                        <Text style={styles.sortBtnText}>{SORT_LABELS[sortMode]}</Text>
                    </TouchableOpacity>
                    </View>

                    <View style={styles.segment}>
                        {(['all', 'completed', 'pending'] as StatusFilter[]).map((s) => {
                            const active = s === statusFilter;
                            const label = s === 'all' ? 'All' : s === 'completed' ? 'Ready' : 'Pending';
                            return (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                                    onPress={() => setStatusFilter(s)}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: active }}
                                >
                                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                                        {label} ({counts[s]})
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {departments.length > 2 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {departments.map((d) => (
                                <Chip key={d} label={d} active={d === department} onPress={() => setDepartment(d)} />
                            ))}
                        </ScrollView>
                    )}
                </View>

                {loading ? (
                    <SkeletonList rows={6} />
                ) : (
                    <FlatList
                        data={visible}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} colors={['#06b6d4']} />
                        }
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <FlaskConical size={40} color="#cbd5e1" />
                                <Text style={styles.emptyText}>
                                    {reports.length ? 'No lab reports match these filters' : 'No lab reports yet'}
                                </Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

            <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, marginRight: 16 }}>
                                <Text style={styles.modalTitle} numberOfLines={2}>{selected?._report?.title || selected?.title}</Text>
                                <Text style={styles.modalSub}>
                                    {selected?._report?.department} · {selected?._report?.doctorName}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn} accessibilityLabel="Close">
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            {selected?._report?.tests?.length ? (
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={styles.modalLabel}>Tests</Text>
                                    <Text style={styles.modalBody}>{selected._report.tests.join(', ')}</Text>
                                </View>
                            ) : null}
                            {selected?.description ? (
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={styles.modalLabel}>Notes</Text>
                                    <Text style={styles.modalBody}>{selected.description}</Text>
                                </View>
                            ) : null}
                            <Text style={styles.modalLabel}>Result</Text>
                            {selected?.fileData ? (
                                selected.fileType?.startsWith('image/') || selected.fileData.startsWith('data:image/') ? (
                                    <View style={styles.imageBox}>
                                        <Image source={{ uri: selected.fileData }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
                                    </View>
                                ) : (
                                    <View style={styles.pdfBox}>
                                        <FileText size={48} color="#94a3b8" />
                                        <Text style={styles.pdfText}>PDF Document</Text>
                                        <Text style={styles.pdfSub}>Preview not available. Please download to view.</Text>
                                    </View>
                                )
                            ) : (
                                <View style={styles.pdfBox}>
                                    <Text style={styles.pdfSub}>No file attachment available.</Text>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.modalBtnRow}>
                            {selected?.fileData && (
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: '#06b6d4' }]}
                                    onPress={() => handleDownload(selected.fileData, selected.fileName || selected.title || 'Lab_Report', selected.fileType)}
                                >
                                    <Download size={18} color="#fff" style={{ marginRight: 6 }} />
                                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Download</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f1f5f9' }]} onPress={() => setSelected(null)}>
                                <Text style={{ color: '#475569', fontSize: 15, fontWeight: '600' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {opening && (
                <View style={styles.overlay}>
                    <View style={styles.overlayBox}>
                        <ActivityIndicator size="large" color="#06b6d4" />
                        <Text style={{ marginTop: 12, color: '#0f172a', fontSize: 15, fontWeight: '600' }}>Opening report...</Text>
                    </View>
                </View>
            )}

            <PatientBottomNavBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: '#fff' },
    headerTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
    headerSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
    filters: { paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1,
        borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, height: 48,
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#0f172a' },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sortBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5, height: 48, paddingHorizontal: 12,
        borderRadius: 12, backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#a5f3fc',
    },
    sortBtnText: { fontSize: 12, fontWeight: '700', color: '#0891b2' },
    segment: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginTop: 12 },
    segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
    segmentBtnActive: { backgroundColor: '#fff', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    segmentText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    segmentTextActive: { color: '#0891b2' },
    chipRow: { gap: 8, paddingTop: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    chipActive: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
    chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    chipTextActive: { color: '#fff' },
    card: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0',
        shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ecfeff', justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    deptText: { fontSize: 12, fontWeight: '700', color: '#0891b2', marginTop: 3, letterSpacing: 0.4 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    statusDone: { backgroundColor: '#d1fae5' },
    statusPending: { backgroundColor: '#fef3c7' },
    statusText: { fontSize: 11, fontWeight: '700' },
    testRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    testTag: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    testTagText: { fontSize: 12, color: '#475569', fontWeight: '500' },
    cardFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 12, paddingTop: 10,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, marginRight: 8 },
    metaText: { fontSize: 13, color: '#64748b' },
    dateText: { fontSize: 12, color: '#94a3b8' },
    empty: { alignItems: 'center', marginTop: 60, gap: 12 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
    modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxHeight: '85%' },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 16,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    modalSub: { fontSize: 14, color: '#64748b', fontWeight: '500' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    modalLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
    modalBody: { fontSize: 15, color: '#475569', lineHeight: 22 },
    imageBox: { width: '100%', height: 300, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    pdfBox: {
        width: '100%', paddingVertical: 50, borderRadius: 16, backgroundColor: '#f8fafc',
        borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center',
    },
    pdfText: { color: '#475569', fontSize: 16, fontWeight: '600', marginTop: 16 },
    pdfSub: { color: '#94a3b8', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
    modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    modalBtn: { flex: 1, flexDirection: 'row', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
    overlayBox: { backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center' },
});
