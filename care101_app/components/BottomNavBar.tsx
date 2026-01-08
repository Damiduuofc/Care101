import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { 
  Home, 
  BarChart3, 
  FileText, 
  Activity, 
  User,
  LucideIcon 
} from 'lucide-react-native';

// Interface for the individual navigation item props
interface NavItemProps {
  icon: LucideIcon | React.ComponentType<any>;
  label: string;
  active: boolean;
  onPress: () => void;
}

export default function BottomNavBar() {
  const router = useRouter();
  const pathname = usePathname();

  // Helper to check if a tab is active
  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path);
  };

  const handlePress = (path: string) => {
    // Cast to 'any' to bypass strict route typing for dynamic strings
    if (path === '/dashboard') {
        router.replace(path as any);
    } else {
        router.push(path as any);
    }
  };

  return (
    <View style={styles.bottomNav}>
      <NavItem 
        icon={Home} 
        label="Home" 
        active={pathname === '/dashboard' || pathname === '/dashboard'}
        onPress={() => handlePress('/dashboard')} 
      />
      <NavItem 
        icon={BarChart3} 
        label="Finance" 
        active={isActive('/dashboard/finance')}
        onPress={() => handlePress('/dashboard/finance')} 
      />
      <NavItem 
        icon={FileText} 
        label="Records" 
        active={isActive('/dashboard/records')}
        onPress={() => handlePress('/dashboard/records')} 
      />
      <NavItem 
        icon={Activity} 
        label="Instruct" 
        active={isActive('/dashboard/instructions')}
        onPress={() => handlePress('/dashboard/instructions')} 
      />
      <NavItem 
        icon={User} 
        label="Profile" 
        active={isActive('/dashboard/profile')}
        onPress={() => handlePress('/dashboard/profile')} 
      />
    </View>
  );
}

// Internal Helper Component with Types
const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, onPress }) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
    <Icon size={24} color={active ? '#06b6d4' : '#94a3b8'} strokeWidth={active ? 2.5 : 2} />
    <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  navLabel: {
    fontSize: 10,
    marginTop: 4,
    color: '#94a3b8',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#06b6d4',
    fontWeight: '700',
  },
});