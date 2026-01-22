import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

class NotificationService {
  private expoPushToken: string | null = null

  async initialize() {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted')
      return null
    }

    // Get push token for physical devices
    if (Device.isDevice) {
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId
        const token = await Notifications.getExpoPushTokenAsync({
          projectId,
        })
        this.expoPushToken = token.data
        console.log('[Notifications] Push token:', this.expoPushToken)
      } catch (error) {
        console.log('[Notifications] Error getting push token:', error)
      }
    } else {
      console.log('[Notifications] Push notifications only work on physical devices')
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#128C7E',
        sound: 'default',
      })
    }

    return this.expoPushToken
  }

  getExpoPushToken() {
    return this.expoPushToken
  }

  // Show a local notification (for when we receive a socket message)
  async showLocalNotification({
    title,
    body,
    data,
  }: {
    title: string
    body: string
    data?: Record<string, any>
  }) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // Show immediately
    })
  }

  // Add listener for notification received (while app is foregrounded)
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(callback)
  }

  // Add listener for notification response (user tapped notification)
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback)
  }

  // Get badge count
  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync()
  }

  // Set badge count
  async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count)
  }

  // Clear all notifications
  async clearAll() {
    await Notifications.dismissAllNotificationsAsync()
    await this.setBadgeCount(0)
  }
}

export const notificationService = new NotificationService()
