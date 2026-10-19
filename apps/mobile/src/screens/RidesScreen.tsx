import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Card, Button } from '../components';
import { Colors, Spacing, Typography, Radius } from '../theme';

export const RidesScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={Typography.titleLarge}>Ride Matching</Text>
          <Text style={Typography.subtitle}>Module 1 — Dijkstra & A* Navigation Engine</Text>
        </View>

        <Card style={styles.planCard}>
          <Text style={styles.cardHeader}>Plan a Carpool</Text>
          <Text style={styles.cardDesc}>
            Find optimized route matches with colleagues along your daily commute corridor.
          </Text>
          <Button
            title="Request a Ride"
            onPress={() => {}}
            style={styles.actionBtn}
          />
          <Button
            title="Offer a Ride (Driver)"
            variant="outline"
            onPress={() => {}}
            style={styles.actionBtn}
          />
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={Typography.titleMedium}>Active Matches</Text>
          <Text style={Typography.caption}>Colombo Metropolitan Area</Text>
        </View>

        <Card>
          <View style={styles.matchRow}>
            <View>
              <Text style={styles.matchTitle}>Malabe → Colombo Fort</Text>
              <Text style={Typography.caption}>Driver: Sunil Perera • Departure: 07:45 AM</Text>
            </View>
            <View style={styles.overlapBadge}>
              <Text style={styles.overlapText}>92% Route Match</Text>
            </View>
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
  planCard: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' },
  cardHeader: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.md },
  actionBtn: { marginVertical: 4 },
  sectionHeader: { marginTop: Spacing.lg, marginBottom: Spacing.xs },
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  overlapBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  overlapText: { color: Colors.primaryLight, fontSize: 11, fontWeight: '700' },
});
