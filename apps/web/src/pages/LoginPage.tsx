import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

type Step = 'phone' | 'otp' | 'name'

export default function LoginPage() {
  const navigate = useNavigate()
  const { requestOtp, verifyOtp, otpPhone, otpExpiresIn, clearOtpState } = useAuthStore()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Ensure phone has + prefix for international format
    let formattedPhone = phone.trim().replace(/\s+/g, '')
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone
    }

    try {
      await requestOtp(formattedPhone)
      setPhone(formattedPhone) // Update state with formatted phone
      setStep('otp')
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // First try without name - server will tell us if it's required
      const result = await verifyOtp(phone, otp, name || undefined)
      navigate('/')
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || 'Verification failed'
      // Check if name is required for new user
      if (errorMsg.includes('Name is required')) {
        setStep('name')
        setError('')
      } else {
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    setError('')
    setLoading(true)

    try {
      await verifyOtp(phone, otp, name)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (countdown > 0) return
    setError('')
    setLoading(true)

    try {
      await requestOtp(phone)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    clearOtpState()
    setStep('phone')
    setOtp('')
    setName('')
    setError('')
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#00A884]">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#00A884] rounded-full mx-auto flex items-center justify-center mb-4">
            <svg
              className="w-12 h-12 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">WorkChat</h1>
          <p className="text-gray-500 mt-1">
            {step === 'phone' && 'Enter your phone number to continue'}
            {step === 'otp' && 'Enter the verification code'}
            {step === 'name' && 'Welcome! Enter your name to get started'}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Phone Number */}
        {step === 'phone' && (
          <form onSubmit={handleRequestOtp} className="space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00A884] focus:border-transparent outline-none"
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                We'll send you a verification code via SMS
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full bg-[#00A884] text-white py-3 rounded-lg font-medium hover:bg-[#008c6f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                {countdown > 0 && (
                  <span className="text-sm text-gray-500">
                    Expires in {formatCountdown(countdown)}
                  </span>
                )}
              </div>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00A884] focus:border-transparent outline-none text-center text-2xl tracking-widest"
                maxLength={6}
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                Code sent to {phone}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-[#00A884] text-white py-3 rounded-lg font-medium hover:bg-[#008c6f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleBack}
                className="text-gray-500 hover:text-gray-700"
              >
                Change number
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || loading}
                className={`${
                  countdown > 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-[#00A884] hover:text-[#008c6f]'
                }`}
              >
                {countdown > 0 ? `Resend in ${formatCountdown(countdown)}` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Name (for new users) */}
        {step === 'name' && (
          <form onSubmit={handleSetName} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00A884] focus:border-transparent outline-none"
                autoFocus
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                This is how others will see you in chats
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-[#00A884] text-white py-3 rounded-lg font-medium hover:bg-[#008c6f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Continue'}
            </button>
          </form>
        )}

        <p className="text-center text-gray-500 text-sm mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  )
}
