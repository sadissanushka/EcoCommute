import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Card, Button } from '../components';
import { Colors, Spacing, Typography, Radius } from '../theme';

export const SafetyScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={Typography.titleLarge}>Safety & Live Tracking</Text>
          <Text style={Typography.subtitle}>Module 4 — Real-time Anomaly Detection & SOS</Text>
        </View>

        {/* SOS Emergency Trigger */}
        <Card style={styles.sosCard}>
          <Text style={styles.sosTitle}>Emergency Assistance</Text>
          <Text style={styles.sosDesc}>
            Press and hold to transmit instantaneous GPS coordinates and alert the corporate crisis desk and emergency contacts.
          </Text>
          <Button
            title="TRIGGER SOS EMERGENCY"
            variant="danger"
            onPress={() => {}}
            style={styles.sosBtn}
          />
        </Card>

        {/* Safety Preferences & Anomaly Monitor */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.titleMedium}>Safety Protection Active</Text>
        </View>

        <Card>
          <View style={styles.featureRow}>
            <View>
              <Text style={styles.featureTitle}>Route Deviation Shield</Text>
              <Text style={Typography.caption}>Monitors off-route deviations greater than 500m</Text>
            </View>
            <View style={styles.activePill}><Text style={styles.activeText}>Active</Text></View>
          </View>
        </Card>

        <Card>
          <View style={styles.featureRow}>
            <View>
              <Text style={styles.featureTitle}>Women-Only Matching</Text>
              <Text style={Typography.caption}>Filters carpools to verified female colleagues only</Text>
            </View>
            <View style={styles.activePill}><Text style={styles.activeText}>Enabled</Text></View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgDark },
  container: { padding: Spacing.md },
  header: { marginBottom: Spacing.md },
  sosCard: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.4)' },
  sosTitle: { fontSize: 18, fontWeight: '800', color: '#F87171', marginBottom: 4 },
  sosDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.md },
  sosBtn: { height: 50 },
  sectionHeader: { marginTop: Spacing.lg, marginBottom: Spacing.xs },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featureTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  activePill: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  activeText: { color: Colors.primaryLight, fontSize: 11, fontWeight: '700' },
});
