import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '../stores/authStore'

type Step = 'phone' | 'otp' | 'name'

export default function LoginScreen() {
  const navigation = useNavigation()
  const { requestOtp, verifyOtp, otpPhone, otpExpiresIn, clearOtpState, isLoading } = useAuthStore()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [devMode, setDevMode] = useState(false)

  // Handle OTP expiry countdown
  useEffect(() => {
    if (otpExpiresIn && otpExpiresIn > 0) {
      setCountdown(otpExpiresIn)
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [otpExpiresIn])

  // Restore phone if OTP was already requested
  useEffect(() => {
    if (otpPhone) {
      setPhone(otpPhone)
      setStep('otp')
    }
  }, [otpPhone])

  const handleRequestOtp = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number')
      return
    }
    setError('')

    try {
      const result = await requestOtp(phone)
      if (result.devMode) {
        setDevMode(true)
      }
      setStep('otp')
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to send OTP')
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }
    setError('')

    try {
      await verifyOtp(phone, otp, name || undefined)
      navigation.reset({
        index: 0,
        routes: [{ name: 'ChatList' as never }],
      })
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Verification failed'
      if (errorMsg.includes('Name is required')) {
        setStep('name')
        setError('')
      } else {
        setError(errorMsg)
      }
    }
  }

  const handleSetName = async () => {
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    setError('')

    try {
      await verifyOtp(phone, otp, name)
      navigation.reset({
        index: 0,
        routes: [{ name: 'ChatList' as never }],
      })
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed')
    }
  }

  const handleResendOtp = async () => {
    if (countdown > 0) return
    setError('')

    try {
      const result = await requestOtp(phone)
      if (result.devMode) {
        setDevMode(true)
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to resend OTP')
    }
  }

  const handleBack = () => {
    clearOtpState()
    setStep('phone')
    setOtp('')
    setName('')
    setError('')
    setDevMode(false)
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>W</Text>
          </View>
          <Text style={styles.title}>WorkChat</Text>
          <Text style={styles.subtitle}>
            {step === 'phone' && 'Enter your phone number to continue'}
            {step === 'otp' && 'Enter the verification code'}
            {step === 'name' && 'Welcome! Enter your name'}
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Dev mode notice */}
        {devMode && step === 'otp' && (
          <View style={styles.devModeContainer}>
            <Text style={styles.devModeText}>Dev mode: Use code 123456</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          {/* Step 1: Phone */}
          {step === 'phone' && (
            <>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 9876543210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                editable={!isLoading}
              />
              <Text style={styles.hint}>We'll send you a verification code via SMS</Text>

              <TouchableOpacity
                style={[styles.button, (isLoading || !phone.trim()) && styles.buttonDisabled]}
                onPress={handleRequestOtp}
                disabled={isLoading || !phone.trim()}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Verification Code</Text>
                {countdown > 0 && (
                  <Text style={styles.countdown}>Expires in {formatCountdown(countdown)}</Text>
                )}
              </View>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="Enter 6-digit code"
                value={otp}
                onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!isLoading}
              />
              <Text style={styles.hint}>Code sent to {phone}</Text>

              <TouchableOpacity
                style={[styles.button, (isLoading || otp.length !== 6) && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </TouchableOpacity>

              <View style={styles.linkRow}>
                <TouchableOpacity onPress={handleBack}>
                  <Text style={styles.linkText}>Change number</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResendOtp} disabled={countdown > 0 || isLoading}>
                  <Text style={[styles.linkText, countdown > 0 && styles.linkDisabled]}>
                    {countdown > 0 ? `Resend in ${formatCountdown(countdown)}` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Step 3: Name */}
          {step === 'name' && (
            <>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoFocus
                editable={!isLoading}
              />
              <Text style={styles.hint}>This is how others will see you in chats</Text>

              <TouchableOpacity
                style={[styles.button, (isLoading || !name.trim()) && styles.buttonDisabled]}
                onPress={handleSetName}
                disabled={isLoading || !name.trim()}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#075E54',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    textAlign: 'center',
  },
  devModeContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  devModeText: {
    color: '#93C5FD',
    textAlign: 'center',
    fontSize: 13,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countdown: {
    fontSize: 13,
    color: '#6B7280',
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 8,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#25D366',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  linkText: {
    color: '#25D366',
    fontSize: 14,
  },
  linkDisabled: {
    color: '#9CA3AF',
  },
  footerText: {
    color: '#FFFFFF',
    opacity: 0.7,
    textAlign: 'center',
    fontSize: 14,
  },
})
