import React, { useState, useEffect } from 'react';
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ActivityIndicator,
Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Calendar, ArrowLeft } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL =
process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

export default function PatientsScreen() {
const router = useRouter();
const [loading, setLoading] = useState(true);
const [channelingStatus, setChannelingStatus] = useState('On Time');
const [isArrived, setIsArrived] = useState(false);

useFocusEffect(
React.useCallback(() => {
fetchStats();
}, [])
);

const fetchStats = async () => {
try {
const token = await SecureStore.getItemAsync('token');

const response = await fetch(`${API_URL}/doctor/dashboard-stats`, {
headers: { Authorization: `Bearer ${token}` },
});

if (response.ok) {
const data = await response.json();
setChannelingStatus(data.channelingStatus || 'On Time');
setIsArrived(data.isArrived || false);
}
} catch (error) {
console.error('Fetch Stats Error:', error);
} finally {
setLoading(false);
}
};

const updateDelayStatus = async (status) => {
try {
const token = await SecureStore.getItemAsync('token');

const response = await fetch(`${API_URL}/doctor/delay-status`, {
method: 'PUT',
headers: {
Authorization: `Bearer ${token}`,
'Content-Type': 'application/json',
},
body: JSON.stringify({ status }),
});

if (response.ok) {
const data = await response.json();
setChannelingStatus(data.status);
Alert.alert('Success', `Status updated to: ${data.status}`);
} else {
Alert.alert('Error', 'Failed to update status');
}
} catch (err) {
console.error('Delay update error:', err);
}
};

const updateArrivalStatus = async (arrived) => {
try {
const token = await SecureStore.getItemAsync('token');

const response = await fetch(`${API_URL}/doctor/arrival-status`, {
method: 'PUT',
headers: {
Authorization: `Bearer ${token}`,
'Content-Type': 'application/json',
},
body: JSON.stringify({ isArrived: arrived }),
});

if (response.ok) {
const data = await response.json();
setIsArrived(data.isArrived);
Alert.alert('Success', arrived ? 'Marked as arrived' : 'Marked as not arrived');
} else {
Alert.alert('Error', 'Failed to update arrival status');
}
} catch (err) {
console.error('Arrival update error:', err);
}
};

if (loading) {
return (
<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
<ActivityIndicator size="large" color="#06B6D4" />
</View>
);
}

return (
<View style={styles.container}>
<SafeAreaView style={styles.safeArea}>

{/* HEADER */}
<View style={styles.header}>

<TouchableOpacity
style={styles.backButton}
onPress={() => router.push('/dashboard')}
activeOpacity={0.8}
>
<ArrowLeft size={22} color="#0f172a" />
</TouchableOpacity>

<View>
<Text style={styles.title}>Today's Clinic</Text>
<Text style={styles.subtitle}>Manage your current queue</Text>

<View style={styles.statusBadge}>
<Text style={styles.statusText}>{channelingStatus}</Text>
</View>
</View>

</View>

<View style={styles.divider} />

{/* ARRIVAL SECTION */}
<View style={styles.section}>
<Text style={styles.sectionTitle}>Arrival Status</Text>
<Text style={styles.sectionDesc}>
Mark yourself as arrived to notify patients.
</Text>

<TouchableOpacity
style={[
styles.arrivalButton,
isArrived && styles.arrivedButton
]}
onPress={() => updateArrivalStatus(!isArrived)}
activeOpacity={0.8}
>
<Text style={[
styles.arrivalButtonText,
isArrived && styles.arrivedButtonText
]}>
{isArrived ? '✓ Arrived' : 'Mark as Arrived'}
</Text>
</TouchableOpacity>
</View>

<View style={styles.divider} />

{/* STATUS SECTION */}
<View style={styles.section}>

<Text style={styles.sectionTitle}>Status Update</Text>

<Text style={styles.sectionDesc}>
Notify reception and patients if you are running late.
</Text>

<View style={styles.delayGrid}>

{[
{ id: 'on-time', label: 'On Time', value: 'On Time', color: '#06B6D4', bg: '#d1fae5' },
{ id: '10-min', label: 'Late by 10 mins', value: 'Delayed 10 mins', color: '#f59e0b', bg: '#fef3c7' },
{ id: '20-min', label: 'Late by 20 mins', value: 'Delayed 20 mins', color: '#f97316', bg: '#ffedd5' },
{ id: '1-hr', label: 'Late by 1 hour', value: 'Delayed 1 hour', color: '#ef4444', bg: '#fee2e2' },
].map((delay) => (

<TouchableOpacity
key={delay.id}
activeOpacity={0.8}
style={[
styles.delayCard,
channelingStatus === delay.value && styles.activeCard
]}
onPress={() => updateDelayStatus(delay.value)}
>

<View style={[styles.delayIconBox, { backgroundColor: delay.bg }]}>
<Calendar size={22} color={delay.color} />
</View>

<Text
style={[
styles.delayText,
channelingStatus === delay.value && styles.activeText
]}
>
{delay.label}
</Text>

</TouchableOpacity>

))}

</View>

</View>

</SafeAreaView>
</View>
);
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:'#f8fafc'
},

safeArea:{
flex:1
},

header:{
flexDirection:'row',
alignItems:'center',
paddingHorizontal:20,
paddingTop:20,
paddingBottom:14,
gap:14
},

backButton:{
width:40,
height:40,
borderRadius:20,
backgroundColor:'#f1f5f9',
alignItems:'center',
justifyContent:'center'
},

title:{
fontSize:26,
fontWeight:'700',
color:'#0f172a'
},

subtitle:{
fontSize:15,
color:'#64748b',
marginTop:2
},

statusBadge:{
marginTop:8,
backgroundColor:'#ecfeff',
paddingHorizontal:12,
paddingVertical:6,
borderRadius:20,
alignSelf:'flex-start'
},

statusText:{
color:'#06B6D4',
fontWeight:'600',
fontSize:13
},

divider:{
height:1,
backgroundColor:'#e2e8f0',
marginHorizontal:20,
marginBottom:12
},

section:{
paddingHorizontal:20,
marginTop:10
},

sectionTitle:{
fontSize:18,
fontWeight:'700',
color:'#0f172a',
marginBottom:4
},

sectionDesc:{
fontSize:14,
color:'#64748b',
marginBottom:14,
lineHeight:20
},

delayGrid:{
flexDirection:'row',
flexWrap:'wrap',
gap:12
},

delayCard:{
width:'48%',
backgroundColor:'#ffffff',
paddingVertical:18,
paddingHorizontal:10,
borderRadius:18,
alignItems:'center',
borderWidth:1,
borderColor:'#f1f5f9',

shadowColor:'#000',
shadowOffset:{width:0,height:6},
shadowOpacity:0.06,
shadowRadius:8,
elevation:4
},

activeCard:{
borderColor:'#06B6D4',
backgroundColor:'#ecfeff'
},

delayIconBox:{
width:48,
height:48,
borderRadius:24,
alignItems:'center',
justifyContent:'center',
marginBottom:10
},

delayText:{
fontSize:14,
color:'#475569',
textAlign:'center',
fontWeight:'500'
},

activeText:{
color:'#0f172a',
fontWeight:'700'
},

arrivalButton:{
backgroundColor:'#ffffff',
paddingVertical:16,
paddingHorizontal:24,
borderRadius:12,
alignItems:'center',
borderWidth:2,
borderColor:'#06B6D4',

shadowColor:'#000',
shadowOffset:{width:0,height:4},
shadowOpacity:0.1,
shadowRadius:6,
elevation:4
},

arrivedButton:{
backgroundColor:'#10b981',
borderColor:'#10b981'
},

arrivalButtonText:{
fontSize:16,
color:'#06B6D4',
fontWeight:'600'
},

arrivedButtonText:{
color:'#ffffff'
}

});