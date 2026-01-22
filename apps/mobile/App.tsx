import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'

import LoginScreen from './src/screens/LoginScreen'
import ChatListScreen from './src/screens/ChatListScreen'
import ChatScreen from './src/screens/ChatScreen'
import TasksScreen from './src/screens/TasksScreen'
import UpdatesScreen from './src/screens/UpdatesScreen'
import Header from './src/components/ui/Header'
import { useAuthStore } from './src/stores/authStore'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const queryClient = new QueryClient()

// Tab icon components
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Chats: '💬',
    Tasks: '📋',
    Updates: '🔔',
  }
  return (
    <Text style={{ fontSize: focused ? 26 : 24, opacity: focused ? 1 : 0.7 }}>
      {icons[name]}
    </Text>
  )
}

// Screen wrapper with Header
function ScreenWithHeader({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Header />
      {children}
    </View>
  )
}

// Wrapped screens for tabs
function ChatsTab() {
  return (
    <ScreenWithHeader>
      <ChatListScreen />
    </ScreenWithHeader>
  )
}

function TasksTab() {
  return (
    <ScreenWithHeader>
      <TasksScreen />
    </ScreenWithHeader>
  )
}

function UpdatesTab() {
  return (
    <ScreenWithHeader>
      <UpdatesScreen />
    </ScreenWithHeader>
  )
}

// Bottom Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#128C7E',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen name="Chats" component={ChatsTab} />
      <Tab.Screen name="Tasks" component={TasksTab} />
      <Tab.Screen name="Updates" component={UpdatesTab} />
    </Tab.Navigator>
  )
}

function RootNavigator() {
  const { user, isInitialized, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [])

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#25D366" />
      </View>
    )
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="light" />
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#075E54',
  },
})
