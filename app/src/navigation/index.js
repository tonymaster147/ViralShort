import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

// --- Auth flow ---
const AuthStack = createNativeStackNavigator();
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

// --- Profile stack (profile + edit) ---
const ProfileStack = createNativeStackNavigator();
function ProfileNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}
    >
      <ProfileStack.Screen name="MyProfile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
    </ProfileStack.Navigator>
  );
}

// Placeholder tab screens (real ones land in later phases)
const FeedScreen = () => <PlaceholderScreen title="Feed" emoji="🎬" phase="Phase 2" />;
const SearchScreen = () => <PlaceholderScreen title="Discover" emoji="🔍" phase="Phase 4" />;
const CreateScreen = () => <PlaceholderScreen title="Create" emoji="➕" phase="Phase 2" />;
const InboxScreen = () => <PlaceholderScreen title="Inbox" emoji="💬" phase="Phase 5" />;

function tabIcon(label) {
  return ({ color }) => <Text style={{ color, fontSize: 22 }}>{label}</Text>;
}

// --- Main app tabs ---
const Tab = createBottomTabNavigator();
function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ tabBarIcon: tabIcon('🏠') }} />
      <Tab.Screen name="Discover" component={SearchScreen} options={{ tabBarIcon: tabIcon('🔍') }} />
      <Tab.Screen name="Create" component={CreateScreen} options={{ tabBarIcon: tabIcon('➕') }} />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ tabBarIcon: tabIcon('💬') }} />
      <Tab.Screen name="Profile" component={ProfileNavigator} options={{ tabBarIcon: tabIcon('👤') }} />
    </Tab.Navigator>
  );
}

export default function RootNavigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
