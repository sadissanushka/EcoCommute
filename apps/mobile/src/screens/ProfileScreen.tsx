import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Card, Button } from '../components';
import { Colors, Spacing, Typography, Radius } from '../theme';
import { useAuthStore } from '../store/authStore';

export const ProfileScreen = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={Typography.titleLarge}>Employee Profile</Text>
          <Text style={Typography.subtitle}>Corporate Identity & Permissions</Text>
        </View>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.fullName?.charAt(0) || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.fullName || 'Zainy TNS'}</Text>
          <Text style={styles.userEmail}>{user?.email || '12sareefazainy@gmail.com'}</Text>
          
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'EMPLOYEE'}</Text>
          </View>
        </Card>

        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Corporate Verification</Text>
            <Text style={styles.verifiedText}>
              {user?.corporateVerified ? '✔ Verified Corporate Email' : 'Pending OTP'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Company ID</Text>
            <Text style={styles.infoVal}>Sysco LABS Sri Lanka</Text>
          </View>
        </Card>

        <Button
          title="Sign Out"
          variant="outline"
          onPress={logout}
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
  roleBadge: { backgroundColor: 'rgba(59, 130, 246, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm },
  roleText: { color: Colors.secondary, fontSize: 11, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoVal: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  verifiedText: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  logoutBtn: { marginTop: Spacing.xl },
});
