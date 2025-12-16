import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, ArrowLeft, Crown, XCircle, Calendar, ShieldCheck } from 'lucide-react-native';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// ✅ THEME COLORS
const THEME = {
  primary: '#0891b2', // Cyan-700
  secondary: '#06b6d4', // Cyan-500
  light: '#ecfeff', // Cyan-50
  dark: '#155e75', // Cyan-900
  text: '#0f172a',
  subtext: '#64748b',
  bg: '#f8fafc',
  white: '#ffffff',
  danger: '#ef4444',
  gold: '#f59e0b'
};

export default function SubscriptionScreen() {
  if (!STRIPE_PUBLISHABLE_KEY) return null;
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <SubscriptionContent />
    </StripeProvider>
  );
}

function SubscriptionContent() {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>({ plan: 'free' });

  useEffect(() => { fetchSubscription(); }, []);

  const fetchSubscription = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!API_URL) return;
      const res = await fetch(`${API_URL}/api/doctor/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subscription) setSubscription(data.subscription);
      }
    } catch (error) { console.error("Fetch Error:", error); }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/api/payment/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: 'premium' })
      });
      const data = await res.json();
      
      if (!res.ok || !data.clientSecret) {
        Alert.alert("Error", "Could not init payment"); setLoading(false); return; 
      }

      const { error } = await initPaymentSheet({
        merchantDisplayName: 'CareLink Health',
        paymentIntentClientSecret: data.clientSecret,
        defaultBillingDetails: { name: 'Dr. User' }
      });
      if (error) { Alert.alert("Error", error.message); setLoading(false); return; }

      const paymentResponse = await presentPaymentSheet();
      if (paymentResponse.error) {
         if(paymentResponse.error.code !== 'Canceled') Alert.alert("Failed", paymentResponse.error.message);
      } else {
         await confirmUpgrade();
      }
    } catch (err) { Alert.alert("Error", "Network Error"); } 
    finally { setLoading(false); }
  };

  const confirmUpgrade = async () => {
    const token = await SecureStore.getItemAsync('token');
    await fetch(`${API_URL}/api/payment/confirm-upgrade`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
    });
    Alert.alert("Success", "Welcome to Premium!", [{ text: "OK", onPress: fetchSubscription }]);
  };

  const handleCancel = async () => {
    Alert.alert("Cancel Subscription?", "You will keep access until the end of the billing period.", [
      { text: "Keep Plan", style: "cancel" },
      { text: "Confirm Cancel", style: "destructive", onPress: async () => {
          setLoading(true);
          try {
            const token = await SecureStore.getItemAsync('token');
            const res = await fetch(`${API_URL}/api/payment/cancel-subscription`, {
              method: 'PUT', headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) { fetchSubscription(); }
          } catch (error) { Alert.alert("Error", "Could not cancel"); } 
          finally { setLoading(false); }
        }
      }
    ]);
  };

  const formatDate = (dateString: string) => {
    if(!dateString) return "";
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription Plan</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* --- FREE PLAN CARD --- */}
        <View style={[styles.card, subscription.plan === 'free' ? styles.activeCard : styles.inactiveCard]}>
          <View style={styles.cardHeader}>
            <View>
                <Text style={styles.planName}>Basic</Text>
                <Text style={styles.planSub}>For individual practice</Text>
            </View>
            {subscription.plan === 'free' && (
                <View style={styles.currentBadge}>
                    <ShieldCheck size={12} color={THEME.dark} style={{marginRight:4}} />
                    <Text style={styles.currentText}>CURRENT</Text>
                </View>
            )}
          </View>
          
          <View style={styles.priceContainer}>
             <Text style={styles.price}>Free</Text>
             <Text style={styles.period}>/ forever</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.features}>
            <Feature text="4 Patient Records" />
            <Feature text="1 Hospital Financial Tracker" />
            <Feature text="Document Uploads Only" />
          </View>
        </View>

        {/* --- PREMIUM PLAN CARD (Hero) --- */}
        <View style={[styles.card, styles.premiumCard, subscription.plan === 'premium' && styles.activePremiumBorder]}>
          
          {/* Best Value Badge */}
          <View style={styles.bestValueBadge}>
             <Text style={styles.bestValueText}>MOST POPULAR</Text>
          </View>

          <View style={styles.cardHeader}>
            <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                <Crown size={28} color={THEME.gold} fill={THEME.gold} />
                <View>
                    <Text style={[styles.planName, {color: THEME.white}]}>Premium</Text>
                    <Text style={[styles.planSub, {color: THEME.light}]}>Unlimited possibilities</Text>
                </View>
            </View>
            {subscription.plan === 'premium' && (
                <View style={styles.premiumCurrentBadge}>
                    <Text style={styles.premiumCurrentText}>ACTIVE</Text>
                </View>
            )}
          </View>
          
          <View style={styles.priceContainer}>
             <Text style={[styles.price, {color: THEME.white}]}>4,990</Text>
             <Text style={[styles.currency, {color: THEME.light}]}>LKR</Text>
             <Text style={[styles.period, {color: THEME.light}]}>/mo</Text>
          </View>

          <View style={[styles.divider, {backgroundColor: 'rgba(255,255,255,0.2)'}]} />

          <View style={styles.features}>
            <Feature text="Unlimited Patients & Records" color={THEME.white} />
            <Feature text="Advanced Financial Analytics" color={THEME.white} />
            <Feature text="Audio, Video & Document Uploads" color={THEME.white} />
            <Feature text="Priority Support" color={THEME.white} />
          </View>

          {/* ACTION AREA */}
          <View style={styles.actionArea}>
            {subscription.plan !== 'premium' ? (
                <TouchableOpacity style={styles.upgradeBtn} onPress={handleSubscribe} disabled={loading}>
                    {loading ? <ActivityIndicator color={THEME.primary} /> : <Text style={styles.upgradeText}>Upgrade to Premium</Text>}
                </TouchableOpacity>
            ) : (
                <View>
                    <View style={styles.activeInfo}>
                        <Check size={16} color={THEME.light} />
                        <Text style={styles.activeInfoText}>
                            {subscription.autoRenew ? "Auto-renews monthly" : "Expires at end of month"}
                        </Text>
                    </View>
                    
                    {subscription.endDate && (
                        <View style={[styles.activeInfo, {marginTop: 4}]}>
                            <Calendar size={16} color={THEME.light} />
                            <Text style={styles.activeInfoText}>Valid until {formatDate(subscription.endDate)}</Text>
                        </View>
                    )}

                    {subscription.autoRenew ? (
                        <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
                            <Text style={styles.cancelLinkText}>Cancel Subscription</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.cancelledTag}>
                            <Text style={styles.cancelledText}>CANCELLATION SCHEDULED</Text>
                        </View>
                    )}
                </View>
            )}
          </View>
        </View>

        <Text style={styles.footerNote}>
            Payments are securely processed by Stripe. You can cancel at any time.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// Feature Row Component
const Feature = ({ text, color = THEME.subtext }: { text: string, color?: string }) => (
  <View style={styles.featureRow}>
    <Check size={18} color={color} style={{opacity: 0.8}} />
    <Text style={[styles.featureText, { color }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: THEME.bg },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8, borderRadius: 50 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: THEME.text },

  content: { padding: 20, paddingBottom: 40, gap: 24 },

  // Card Styles
  card: { borderRadius: 20, padding: 24, borderWidth: 1, position: 'relative' },
  activeCard: { backgroundColor: THEME.white, borderColor: THEME.primary, borderWidth: 2 },
  inactiveCard: { backgroundColor: THEME.white, borderColor: '#e2e8f0' },
  
  // Premium Card
  premiumCard: { backgroundColor: THEME.primary, borderColor: THEME.primary, shadowColor: THEME.primary, shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, marginTop: 10 },
  activePremiumBorder: { borderColor: THEME.dark, borderWidth: 3 },
  
  // Badges
  bestValueBadge: { position: 'absolute', top: -12, right: 24, backgroundColor: THEME.gold, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  bestValueText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  currentBadge: { flexDirection:'row', alignItems:'center', backgroundColor: THEME.light, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  currentText: { fontSize: 11, fontWeight: '700', color: THEME.dark },

  premiumCurrentBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  premiumCurrentText: { fontSize: 11, fontWeight: '700', color: THEME.white },

  // Content
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  planName: { fontSize: 22, fontWeight: '800', color: THEME.text, marginBottom: 4 },
  planSub: { fontSize: 13, color: THEME.subtext },

  priceContainer: { flexDirection: 'row', alignItems: 'baseline' },
  price: { fontSize: 36, fontWeight: '800', color: THEME.text },
  currency: { fontSize: 18, fontWeight: '600', color: THEME.subtext },
  period: { fontSize: 16, fontWeight: '500', color: THEME.subtext, marginLeft: 4 },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 },

  features: { gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontSize: 15, fontWeight: '500' },

  // Action Area
  actionArea: { marginTop: 28 },
  upgradeBtn: { backgroundColor: THEME.white, paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  upgradeText: { color: THEME.primary, fontWeight: '700', fontSize: 16 },

  activeInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  activeInfoText: { color: THEME.light, fontSize: 13, fontWeight: '500' },

  cancelLink: { marginTop: 16, padding: 8, alignItems: 'center' },
  cancelLinkText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  cancelledTag: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 8, alignItems: 'center' },
  cancelledText: { color: THEME.danger, fontSize: 11, fontWeight: '800' },

  footerNote: { textAlign: 'center', color: THEME.subtext, fontSize: 12, marginTop: 10, opacity: 0.7 },
});