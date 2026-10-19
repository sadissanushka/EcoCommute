import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { Card, Button } from '../components';
import { Colors, Spacing, Typography, Radius } from '../theme';
import { apiClient } from '../api/client';

export const ShuttlesScreen = () => {
  const [trips, setTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTrips = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/trips');
      if (res.data?.trips) {
        setTrips(res.data.trips);
      }
    } catch {
      // Fallback preview
      setTrips([
        {
          id: 1,
          routeName: 'Kaduwela Express',
          originName: 'Kaduwela Interchange',
          destinationName: 'Colombo Fort',
          departAt: new Date(Date.now() + 3600000 * 2).toISOString(),
          availableSeats: 24,
          vehicle: { plateNo: 'NC-8821', type: 'Toyota Coaster' },
        },
        {
          id: 2,
          routeName: 'Moratuwa Coastal Line',
          originName: 'Moratuwa Bus Stand',
          destinationName: 'Colombo Fort',
          departAt: new Date(Date.now() + 3600000 * 3).toISOString(),
          availableSeats: 8,
          vehicle: { plateNo: 'WP-6490', type: 'Toyota HiAce' },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTrips} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={Typography.titleLarge}>Corporate Shuttles</Text>
          <Text style={Typography.subtitle}>Module 2 — Fleet & Intelligent Seat Booking</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={Typography.titleMedium}>Upcoming Shuttle Runs</Text>
          <Text style={Typography.caption}>Live Seat Inventory</Text>
        </View>

        {trips.map((t) => (
          <Card key={t.id}>
            <View style={styles.tripHeader}>
              <Text style={styles.routeName}>{t.routeName}</Text>
              <View style={styles.seatBadge}>
                <Text style={styles.seatText}>{t.availableSeats} Seats Left</Text>
              </View>
            </View>

            <Text style={styles.routeStops}>{t.originName} → {t.destinationName}</Text>
            <Text style={Typography.caption}>Vehicle: {t.vehicle?.plateNo} ({t.vehicle?.type})</Text>

            <Button
              title="Select Seats & Book"
              onPress={() => {}}
              style={styles.bookBtn}
            />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgDark },
  container: { padding: Spacing.md },
  header: { marginBottom: Spacing.md },
  sectionHeader: { marginTop: Spacing.sm, marginBottom: Spacing.xs },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  routeName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  seatBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  seatText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '700' },
  routeStops: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  bookBtn: { marginTop: Spacing.sm, height: 40 },
});
