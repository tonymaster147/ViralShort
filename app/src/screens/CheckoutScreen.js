import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { checkoutUrl, verifyDiamondPayment } from '../api/economy';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

// Hosts the Razorpay Standard Web Checkout inside a WebView. The page posts the
// payment result back via window.ReactNativeWebView.postMessage; we then verify
// server-side (which credits the diamonds) and report the outcome back to Wallet.
export default function CheckoutScreen({ route, navigation }) {
  const { refreshUser } = useAuth();
  const { orderId, keyId, amount, packName, diamonds } = route.params;
  const [stage, setStage] = useState('loading'); // loading | paying | verifying
  const handled = useRef(false);

  const finish = useCallback((result) => {
    if (handled.current) return;
    handled.current = true;
    // Hand the result to the Wallet screen via navigation params.
    navigation.navigate('Wallet', { paymentResult: result });
  }, [navigation]);

  // Treat hardware back as a cancel.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finish({ status: 'cancelled' });
      return true;
    });
    return () => sub.remove();
  }, [finish]));

  const onMessage = async (e) => {
    let data;
    try { data = JSON.parse(e.nativeEvent.data); } catch (_) { return; }

    if (data.status === 'success') {
      setStage('verifying');
      try {
        const res = await verifyDiamondPayment({
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        });
        await refreshUser();
        finish({ status: 'success', credited: res.credited, diamonds: res.diamonds, packName });
      } catch (err) {
        finish({ status: 'verify_failed', error: err.response?.data?.error || 'Verification failed' });
      }
    } else if (data.status === 'dismissed' || data.status === 'cancelled') {
      finish({ status: 'cancelled' });
    } else {
      finish({ status: 'failed', error: data.error || 'Payment failed' });
    }
  };

  const uri = checkoutUrl({ orderId, keyId, amount, name: 'ViralShort', desc: `${packName} · ${diamonds} 💎` });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => finish({ status: 'cancelled' })} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Secure checkout</Text>
        <View style={{ width: 36 }} />
      </View>

      <WebView
        source={{ uri }}
        onMessage={onMessage}
        onLoadEnd={() => setStage((s) => (s === 'loading' ? 'paying' : s))}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        originWhitelist={['*']}
        style={styles.web}
      />

      {stage === 'verifying' && (
        <View style={styles.overlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.overlayText}>Confirming your payment…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  web: { flex: 1, backgroundColor: '#0b0b0f' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', gap: 14 },
  overlayText: { color: '#fff', fontWeight: '700' },
});
