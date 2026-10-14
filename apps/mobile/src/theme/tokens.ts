export const Colors = {
  // Brand Primary & Accents
  primary: '#10B981',       // Emerald
  primaryLight: '#34D399',
  primaryDark: '#059669',
  secondary: '#3B82F6',     // Electric Blue
  
  // Backgrounds (Dark Mode First)
  bgDark: '#090D16',
  bgCard: '#131B2E',
  bgCardHover: '#1E293B',
  bgInput: '#1E293B',
  
  // Text Hierarchies
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  
  // Status Colors
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  
  // Borders & Separators
  border: 'rgba(255, 255, 255, 0.08)',
  borderActive: 'rgba(16, 185, 129, 0.4)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = {
  titleLarge: { fontSize: 26, fontWeight: '700' as const, color: Colors.textPrimary },
  titleMedium: { fontSize: 20, fontWeight: '700' as const, color: Colors.textPrimary },
  subtitle: { fontSize: 15, fontWeight: '500' as const, color: Colors.textSecondary },
  body: { fontSize: 14, fontWeight: '400' as const, color: Colors.textPrimary },
  caption: { fontSize: 12, fontWeight: '500' as const, color: Colors.textMuted },
  button: { fontSize: 15, fontWeight: '600' as const, color: '#FFFFFF' },
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};
