import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Card, Button } from '../components';
import { Colors, Spacing, Typography, Radius } from '../theme';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

export const RidesScreen = () => {
  const [selectedCorridor, setSelectedCorridor] = useState<string>('malabe_fort');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [matchResult, setMatchResult] = useState<any | null>(null);
  const [mode, setMode] = useState<'rider' | 'driver'>('rider');

  const user = useAuthStore((state) => state.user);

  const CORRIDORS = [
    {
      id: 'malabe_fort',
      name: 'Malabe Tech Horizon ➔ Colombo Fort CBD',
      distanceKm: 14.2,
      origin: { lat: 6.9040, lng: 79.9540, name: 'Malabe' },
      destination: { lat: 6.9344, lng: 79.8428, name: 'Colombo Fort' },
    },
    {
      id: 'fort_uom',
      name: 'Colombo Fort ➔ Moratuwa UoM',
      distanceKm: 18.2,
      origin: { lat: 6.9344, lng: 79.8428, name: 'Colombo Fort' },
      destination: { lat: 6.7969, lng: 79.9018, name: 'University of Moratuwa' },
    },
    {
      id: 'kottawa_fort',
      name: 'Kottawa Interchange ➔ Colombo Fort CBD',
      distanceKm: 19.4,
      origin: { lat: 6.8410, lng: 79.9650, name: 'Kottawa' },
      destination: { lat: 6.9344, lng: 79.8428, name: 'Colombo Fort' },
    },
  ];

  const handleOpenPlanModal = (targetMode: 'rider' | 'driver') => {
    setMode(targetMode);
    setShowMatchModal(true);
  };

  const handleCalculateRouteMatch = async () => {
    setIsCalculating(true);
    const activeCorridor = CORRIDORS.find((c) => c.id === selectedCorridor) || CORRIDORS[0];

    try {
      // Call services/routing-engine (/api/route or /api/match)
      const res = await apiClient.post('/api/route', {
        origin: activeCorridor.origin,
        destination: activeCorridor.destination,
        algorithm: 'astar',
      });

      if (res.data?.data) {
        setMatchResult({
          distanceKm: res.data.data.distanceKm || activeCorridor.distanceKm,
          etaMinutes: Math.round(res.data.data.durationMinutes || (activeCorridor.distanceKm / 45) * 60),
          overlapPct: 94,
          driverName: mode === 'rider' ? 'Sunil Perera (Lead Eng)' : user?.fullName || 'You (Driver)',
          vehicle: 'Toyota Prius (Hybrid) • WP-CAR-3912',
          co2SavedKg: Number((activeCorridor.distanceKm * 0.171 * 0.72).toFixed(2)),
        });
      }
    } catch {
      // Offline fallback calculation matching Module 1 engine
      setMatchResult({
        distanceKm: activeCorridor.distanceKm,
        etaMinutes: Math.round((activeCorridor.distanceKm / 42) * 60),
        overlapPct: 92,
        driverName: mode === 'rider' ? 'Sunil Perera (Lead Eng)' : user?.fullName || 'You (Driver)',
        vehicle: 'Toyota Prius (Hybrid) • WP-CAR-3912',
        co2SavedKg: Number((activeCorridor.distanceKm * 0.171 * 0.72).toFixed(2)),
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleConfirmRide = () => {
    Alert.alert(
      mode === 'rider' ? 'Carpool Match Requested' : 'Carpool Offer Published',
      mode === 'rider'
        ? `Request sent to driver Sunil Perera along ${selectedCorridor.replace('_', ' ➔ ')}.`
        : `Your vehicle is listed for colleagues along the corridor. Detour radius: 1,500m.`
    );
    setShowMatchModal(false);
  };

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
            onPress={() => handleOpenPlanModal('rider')}
            style={styles.actionBtn}
          />
          <Button
            title="Offer a Ride (Driver)"
            variant="outline"
            onPress={() => handleOpenPlanModal('driver')}
            style={styles.actionBtn}
          />
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={Typography.titleMedium}>Active Matches</Text>
          <Text style={Typography.caption}>Colombo Metropolitan Area</Text>
        </View>

        <Card>
          <View style={styles.matchRow}>
            <View style={styles.matchInfo}>
              <Text style={styles.matchTitle}>Malabe ➔ Colombo Fort</Text>
              <Text style={Typography.caption}>Driver: Sunil Perera • Departure: 07:45 AM</Text>
            </View>
            <View style={styles.overlapBadge}>
              <Text style={styles.overlapText}>92% Route Match</Text>
            </View>
          </View>
        </Card>

        <Card>
          <View style={styles.matchRow}>
            <View style={styles.matchInfo}>
              <Text style={styles.matchTitle}>Moratuwa UoM ➔ Kollupitiya</Text>
              <Text style={Typography.caption}>Driver: Ruwan Jayawardena • Departure: 08:00 AM</Text>
            </View>
            <View style={styles.overlapBadge}>
              <Text style={styles.overlapText}>88% Route Match</Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Plan & Route Match Modal */}
      <Modal
        visible={showMatchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMatchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {mode === 'rider' ? 'Request Carpool Match' : 'Offer Driver Route'}
            </Text>
            <Text style={styles.modalSub}>
              Select your commute arterial corridor in Colombo:
            </Text>

            <View style={styles.corridorList}>
              {CORRIDORS.map((c) => {
                const isSelected = selectedCorridor === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.corridorItem, isSelected && styles.corridorItemSelected]}
                    onPress={() => {
                      setSelectedCorridor(c.id);
                      setMatchResult(null);
                    }}
                  >
                    <Text style={[styles.corridorName, isSelected && styles.corridorNameSelected]}>
                      📍 {c.name}
                    </Text>
                    <Text style={Typography.caption}>{c.distanceKm} km arterial corridor</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {matchResult ? (
              <View style={styles.resultBox}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Distance / ETA:</Text>
                  <Text style={styles.resultVal}>{matchResult.distanceKm} km (~{matchResult.etaMinutes} min)</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Overlap Score:</Text>
                  <Text style={styles.resultHighlight}>{matchResult.overlapPct}% Match</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>CO₂ Avoided:</Text>
                  <Text style={styles.resultVal}>🌱 {matchResult.co2SavedKg} kg CO₂e</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Peer Commuter:</Text>
                  <Text style={styles.resultVal}>{matchResult.driverName}</Text>
                </View>

                <Button
                  title={mode === 'rider' ? 'Confirm & Join Carpool' : 'Publish Driver Schedule'}
                  onPress={handleConfirmRide}
                  style={styles.confirmBtn}
                />
              </View>
            ) : (
              <Button
                title="Calculate Match (A* Engine)"
                onPress={handleCalculateRouteMatch}
                isLoading={isCalculating}
                style={styles.calcBtn}
              />
            )}

            <Button
              title="Close"
              variant="outline"
              onPress={() => setShowMatchModal(false)}
              style={styles.closeBtn}
            />
          </View>
        </View>
      </Modal>
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
  matchInfo: { flex: 1, marginRight: Spacing.sm },
  matchTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  overlapBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  overlapText: { color: Colors.primaryLight, fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  modalSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.md },
  corridorList: { gap: Spacing.xs, marginBottom: Spacing.md },
  corridorItem: { padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border },
  corridorItemSelected: { borderColor: Colors.primary, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  corridorName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  corridorNameSelected: { color: Colors.primaryLight },
  calcBtn: { marginTop: Spacing.xs },
  closeBtn: { marginTop: Spacing.sm },
  resultBox: { backgroundColor: Colors.bgInput, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginVertical: Spacing.xs },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  resultLabel: { fontSize: 12, color: Colors.textSecondary },
  resultVal: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  resultHighlight: { fontSize: 12, fontWeight: '800', color: Colors.primaryLight },
  confirmBtn: { marginTop: Spacing.md },
});
