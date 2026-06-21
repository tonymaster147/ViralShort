import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import FeedScreen from '../screens/FeedScreen';
import CreateScreen from '../screens/CreateScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import HashtagScreen from '../screens/HashtagScreen';
import VideoScreen from '../screens/VideoScreen';
import InboxScreen from '../screens/InboxScreen';
import ChatScreen from '../screens/ChatScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import WalletScreen from '../screens/WalletScreen';
import BuyCoinsScreen from '../screens/BuyCoinsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ContestScreen from '../screens/ContestScreen';
import DraftsScreen from '../screens/DraftsScreen';
import CameraScreen from '../screens/CameraScreen';
import EditorScreen from '../screens/EditorScreen';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../theme/ThemeContext';

const mkStackOpts = (c) => ({ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, headerShadowVisible: false });

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
  const { colors } = useTheme();
  return (
    <ProfileStack.Navigator screenOptions={mkStackOpts(colors)}>
      <ProfileStack.Screen name="MyProfile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <ProfileStack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStack.Screen name="Hashtag" component={HashtagScreen} options={{ title: 'Hashtag' }} />
      <ProfileStack.Screen name="Video" component={VideoScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <ProfileStack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <ProfileStack.Screen name="BuyCoins" component={BuyCoinsScreen} options={{ title: 'Buy Coins' }} />
      <ProfileStack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
      <ProfileStack.Screen name="Contest" component={ContestScreen} options={{ title: 'Weekly Contest' }} />
    </ProfileStack.Navigator>
  );
}


// Shared routes added to multiple stacks (so UserProfile/Chat/Video work anywhere).
function discoveryScreens(Stack) {
  return (
    <>
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="Hashtag" component={HashtagScreen} options={{ title: 'Hashtag' }} />
      <Stack.Screen name="Video" component={VideoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
      <Stack.Screen name="Contest" component={ContestScreen} options={{ title: 'Weekly Contest' }} />
    </>
  );
}

// Feed stack
const FeedStack = createNativeStackNavigator();
function FeedNavigator() {
  const { colors } = useTheme();
  return (
    <FeedStack.Navigator screenOptions={mkStackOpts(colors)}>
      <FeedStack.Screen name="FeedHome" component={FeedScreen} options={{ headerShown: false }} />
      {discoveryScreens(FeedStack)}
    </FeedStack.Navigator>
  );
}

// Discover stack
const DiscoverStack = createNativeStackNavigator();
function DiscoverNavigator() {
  const { colors } = useTheme();
  return (
    <DiscoverStack.Navigator screenOptions={mkStackOpts(colors)}>
      <DiscoverStack.Screen name="DiscoverHome" component={DiscoverScreen} options={{ headerShown: false }} />
      {discoveryScreens(DiscoverStack)}
    </DiscoverStack.Navigator>
  );
}

// Create stack (creator + drafts)
const CreateStack = createNativeStackNavigator();
function CreateNavigator() {
  const { colors } = useTheme();
  return (
    <CreateStack.Navigator screenOptions={mkStackOpts(colors)}>
      <CreateStack.Screen name="CreateMain" component={CreateScreen} options={{ headerShown: false }} />
      <CreateStack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false }} />
      <CreateStack.Screen name="Editor" component={EditorScreen} options={{ headerShown: false }} />
      <CreateStack.Screen name="Drafts" component={DraftsScreen} options={{ title: 'Drafts' }} />
    </CreateStack.Navigator>
  );
}

// Inbox stack (conversations + chat + tappable profiles/videos)
const InboxStack = createNativeStackNavigator();
function InboxNavigator() {
  const { colors } = useTheme();
  return (
    <InboxStack.Navigator screenOptions={mkStackOpts(colors)}>
      <InboxStack.Screen name="InboxHome" component={InboxScreen} options={{ headerShown: false }} />
      {discoveryScreens(InboxStack)}
    </InboxStack.Navigator>
  );
}

// Vector tab icon (filled when focused).
function tabIcon(name) {
  return ({ color, focused, size }) => (
    <Ionicons name={focused ? name : `${name}-outline`} size={size ?? 24} color={color} />
  );
}

// Tab icon with an unread-count badge.
function badgedIcon(name, count) {
  return ({ color, focused, size }) => (
    <View>
      <Ionicons name={focused ? name : `${name}-outline`} size={size ?? 24} color={color} />
      {count > 0 && (
        <View style={badgeStyle.dot}>
          <Text style={badgeStyle.dotText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </View>
  );
}

// The center "Create" button gets a distinct pill look.
function createIcon() {
  return ({ focused }) => (
    <View style={badgeStyle.createBtn}>
      <Ionicons name="add" size={26} color="#fff" />
    </View>
  );
}

// --- Main app tabs ---
const Tab = createBottomTabNavigator();
function MainNavigator() {
  const { unreadMessages, unreadNotifications } = useSocket();
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 58, paddingTop: 6 },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen name="Feed" component={FeedNavigator} options={{ tabBarIcon: tabIcon('home') }} />
      <Tab.Screen name="Discover" component={DiscoverNavigator} options={{ tabBarIcon: tabIcon('search') }} />
      <Tab.Screen name="Create" component={CreateNavigator} options={{ tabBarIcon: createIcon() }} />
      <Tab.Screen
        name="Inbox"
        component={InboxNavigator}
        options={{ tabBarIcon: badgedIcon('chatbubble', unreadMessages) }}
      />
      <Tab.Screen name="Profile" component={ProfileNavigator} options={{ tabBarIcon: tabIcon('person') }} />
    </Tab.Navigator>
  );
}

const badgeStyle = StyleSheet.create({
  dot: { position: 'absolute', top: -6, right: -10, backgroundColor: colors.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  createBtn: { width: 44, height: 30, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});

export default function RootNavigation() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

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
