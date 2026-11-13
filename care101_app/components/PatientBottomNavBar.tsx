import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
    Home,
    Calendar,
    FileText,
    FlaskConical,
    User,
    LucideIcon
} from 'lucide-react-native';

interface NavItemProps {
    icon: LucideIcon | React.ComponentType<any>;
    label: string;
    active: boolean;
    onPress: () => void;
}

export default function PatientBottomNavBar() {
    const router = useRouter();
    const pathname = usePathname();

    const isActive = (path: string) => {
        return pathname === path || pathname.startsWith(path);
    };

    // Tabs behave like tabs: no duplicate screens, and Back always returns to Home
    const handlePress = (path: string) => {
        if (pathname === path) return; // already here
        if (path === '/patient-dashboard') {
            router.dismissTo(path as any); // back to the Home already in the stack
        } else if (pathname === '/patient-dashboard') {
            router.push(path as any); // Home -> tab
        } else {
            router.replace(path as any); // tab -> tab: swap instead of stacking
        }
    };

    return (
        <View style={styles.bottomNav} accessibilityRole="tablist">
            <NavItem
                icon={Home}
                label="Home"
                active={pathname === '/patient-dashboard'}
                onPress={() => handlePress('/patient-dashboard')}
            />
            <NavItem
                icon={Calendar}
                label="Booking"
                active={isActive('/patient-dashboard/appointments')}
                onPress={() => handlePress('/patient-dashboard/appointments')}
            />
            <NavItem
                icon={FileText}
                label="Records"
                active={isActive('/patient-dashboard/records')}
                onPress={() => handlePress('/patient-dashboard/records')}
            />
            <NavItem
                icon={FlaskConical}
                label="Lab"
                active={isActive('/patient-dashboard/lab-reports')}
                onPress={() => handlePress('/patient-dashboard/lab-reports')}
            />
            <NavItem
                icon={User}
                label="Profile"
                active={isActive('/patient-dashboard/profile')}
                onPress={() => handlePress('/patient-dashboard/profile')}
            />
        </View>
    );
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active, onPress }) => (
    <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }}>
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
