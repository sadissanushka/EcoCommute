import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Card, Button } from '../components';
import { Colors, Spacing, Typography, Radius } from '../theme';

export const WalletScreen = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // In production, loaded via apiClient from /wallet/balance and /carbon/summary
  const [balanceMinor] = useState(1450000); // 14,500.00 LKR in cents
  const [co2SavedKg] = useState(48.6);     // 48.6 kg CO2 avoided
  const [totalKmCommuted] = useState(214); // 214 km

  const recentTransactions = [
    {
      id: 'tx-1',
      reason: 'trip_share',
      direction: 'DEBIT',
      amount_minor: 45000, // 450.00 LKR
      title: 'Kaduwela Carpool Share (3 passengers)',
      date: 'Today, 08:45 AM',
    },
    {
      id: 'tx-2',
      reason: 'fuel_reimbursement',
      direction: 'CREDIT',
      amount_minor: 120000, // 1,200.00 LKR
      title: 'Corporate Shuttle Fuel Settlement',
      date: 'Yesterday, 06:15 PM',
    },
    {
      id: 'tx-3',
      reason: 'topup',
      direction: 'CREDIT',
      amount_minor: 2000000, // 20,000.00 LKR
      title: 'Company Transit Allowance Top-Up',
      date: '15 Oct 2026',
    },
  ];

  const onRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const formatLkr = (minor: number) => {
    const lkr = (minor / 100).toFixed(2);
    return `LKR ${Number(lkr).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={Typography.titleLarge}>Wallet & Carbon</Text>
          <Text style={Typography.subtitle}>Fair-split ledger and ESG emissions tracker</Text>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{formatLkr(balanceMinor)}</Text>
          <View style={styles.balanceActions}>
            <Button
              title="Top Up"
              onPress={() => {}}
              style={styles.topupBtn}
            />
            <Button
              title="Export Scope 3 GRI"
              onPress={() => {}}
              variant="outline"
              style={styles.exportBtn}
            />
          </View>
        </Card>

        {/* Carbon Impact Card */}
        <Card style={styles.carbonCard}>
          <View style={styles.carbonHeader}>
            <View>
              <Text style={styles.carbonTitle}>ESG Carbon Avoided</Text>
              <Text style={Typography.caption}>DEFRA 2024 Category 7 Standard</Text>
            </View>
            <View style={styles.leafBadge}>
              <Text style={styles.leafText}>🌱 Active</Text>
            </View>
          </View>
          
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{co2SavedKg} kg</Text>
              <Text style={Typography.caption}>CO₂e Avoided</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{totalKmCommuted} km</Text>
              <Text style={Typography.caption}>Shared Travel</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>78.2%</Text>
              <Text style={Typography.caption}>Efficiency</Text>
            </View>
          </View>
        </Card>

        {/* Append-Only Ledger Activity */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.titleMedium}>Recent Ledger Entries</Text>
          <Text style={Typography.caption}>Append-Only Audit Trail</Text>
        </View>

        {recentTransactions.map((tx) => (
          <Card key={tx.id} style={styles.txCard}>
            <View style={styles.txRow}>
              <View style={styles.txInfo}>
                <Text style={styles.txTitle}>{tx.title}</Text>
                <Text style={Typography.caption}>{tx.date}</Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  tx.direction === 'CREDIT' ? styles.txCredit : styles.txDebit,
                ]}
              >
                {tx.direction === 'CREDIT' ? '+' : '-'} {formatLkr(tx.amount_minor)}
              </Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  container: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.md,
  },
  balanceCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  balanceLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: Spacing.sm,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  topupBtn: {
    flex: 1,
    height: 42,
  },
  exportBtn: {
    flex: 1.4,
    height: 42,
  },
  carbonCard: {
    backgroundColor: Colors.bgCard,
  },
  carbonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  carbonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  leafBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  leafText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  txCard: {
    marginVertical: 4,
    paddingVertical: Spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txCredit: {
    color: Colors.primaryLight,
  },
  txDebit: {
    color: Colors.textPrimary,
  },
});
