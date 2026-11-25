import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Card, Button } from '../components';
import { Colors, Spacing, Typography, Radius } from '../theme';
import { useAuthStore } from '../store/authStore';

export const ProfileScreen = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'E';
  const companyDisplay =
    user?.companyName ||
    (user?.companyId ? `Company ID #${user.companyId}` : 'EcoCommute Corporate Partner');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>EcoCommute</Text>
          <Text style={Typography.titleLarge}>Employee Profile</Text>
          <Text style={Typography.subtitle}>Corporate Identity & Permissions</Text>
        </View>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.userName}>{user?.fullName || 'Corporate Employee'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'N/A'}</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'EMPLOYEE'}</Text>
          </View>
          <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700', marginTop: 8 }}>
            🌱 EcoCommute Level 3 Contributor (142.8 kg CO₂ Abated)
          </Text>
        </Card>

        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Digital Pass Status</Text>
            <Text style={styles.verifiedText}>✔ Corporate Pass Active (All Zones)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Transit Preference</Text>
            <Text style={styles.infoVal}>EV Shuttle & Carpool Leg</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Corporate Verification</Text>
            <Text style={user?.corporateVerified ? styles.verifiedText : styles.pendingText}>
              {user?.corporateVerified ? '✔ Verified Corporate Email' : 'Pending Verification'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Company</Text>
            <Text style={styles.infoVal}>{companyDisplay}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Role</Text>
            <Text style={styles.infoVal}>{user?.role || 'employee'}</Text>
          </View>
        </Card>

        <Button
          title={isLoggingOut ? 'Signing Out...' : 'Sign Out'}
          variant="outline"
          onPress={handleLogout}
          isLoading={isLoggingOut}
          disabled={isLoggingOut}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgDark },
  container: { padding: Spacing.md },
  header: { marginBottom: Spacing.md },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  profileCard: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  userName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  userEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.sm },
  roleBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  roleText: { color: Colors.secondary, fontSize: 11, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoVal: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  verifiedText: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight },
  pendingText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  logoutBtn: { marginTop: Spacing.xl },
});
