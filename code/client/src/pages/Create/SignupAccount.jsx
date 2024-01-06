import { InputBox, InputPassword, Label, Text, Link } from '../../components/Text'
import React, { useState } from 'react'
import Row from 'antd/es/row'
import Col from 'antd/es/col'
import util, { isSafari, useWindowDimensions } from '../../util'
import Space from 'antd/es/space'
import Tooltip from 'antd/es/tooltip'
import QuestionCircleOutlined from '@ant-design/icons/QuestionCircleOutlined'
import Button from 'antd/es/button'
import Divider from 'antd/es/divider'
import EmailValidator from 'email-validator'
import { api } from '../../../../lib/api'
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined'
import { getQRCodeUri, OTPUriMode } from '../../components/OtpTools'
import ONENames from '../../../../lib/names'
import { useHistory } from 'react-router'
import Modal from 'antd/es/modal'
import Spin from 'antd/es/spin'

const genUsername = ({ name, address, effectiveTime }) => {
  const date = new Date(effectiveTime).toISOString().slice(2, 10)
  const prefix = `${name}_${date}`.toLowerCase().replace(' ', '_')
  const oneAddress = util.safeOneAddress(address)
  const suffix = oneAddress.slice(oneAddress.length - 4)
  return `${prefix}_${suffix}`
}

const SignupAccount = ({ seed, name, address, effectiveTime, setAllowOTPAutoFill, onSignupSuccess }) => {
  const history = useHistory()
  const { isMobile } = useWindowDimensions()
  const [username, setUsername] = useState(genUsername({ name, address, effectiveTime }))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const validPassword = password === '' || (password.length >= 8 && password.length <= 64)
  const validEmail = email === '' || EmailValidator.validate(email)
  const validUsername = username === '' || (username.length >= 4 && username.length < 64 && username.match(/[a-z0-9_-]+/))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showSetupOTP, setShowSetupOTP] = useState(false)
  const [signingUp, setSigningUp] = useState(false)

  const isSafariTest = isSafari()

  const setupCode = () => {
    isSafariTest && seed && Modal.confirm({
      title: 'Safari users',
      closable: true,
      content: (
        <Space direction='vertical' style={{ width: '100%' }}>
          <Text>iOS / macOS has OPTIONAL built-in support for verification code. To use that</Text>
          <Text>(1) Save password in browser (2) Open "System Preferences" (3) Find the new username and save the verification code</Text>
        </Space>
      ),
      onOk: () => {
        let host = encodeURIComponent(new URL(location.href).host)
        const parts = host.split('.')
        if (parts.length >= 3) {
          host = encodeURIComponent(parts[parts.length - 2] + '.' + parts[parts.length - 1])
        }
        setAllowOTPAutoFill(true)
        setShowSetupOTP(false)
        history.push(history.location.pathname + '#submitted')
        console.log(host)
        window.location.href = getQRCodeUri(seed, host + ':' + username, OTPUriMode.APPLE, host)
      },
      onCancel: () => {
        setShowSetupOTP(true)
        setAllowOTPAutoFill(false)
      }
    })
  }

  const signup = async (e) => {
    e.preventDefault()

    if (!username || !password || !email || !validUsername || !validPassword || !validEmail) {
      setError('Please check your information and resubmit')
      setTimeout(() => setError(''), 3000)
      return
    }
    setError('')
    setSigningUp(true)
    try {
      const { success, error } = await api.backend.signup({ username, password, email })
      if (!success) {
        setError(`Failed to signup. Error: ${error}`)
      } else {
        setSuccess(true)
        setError('')
        isSafariTest && setupCode()
        onSignupSuccess && onSignupSuccess()
        // window.open(getQRCodeUri(seed, otpDisplayName, OTPUriMode.APPLE, host), '_self')
      }
    } catch (ex) {
      console.error(ex)
      setError('Failed to signup. Network error.')
      setSuccess(false)
    } finally {
      setSigningUp(false)
    }
  }

  return (
    <Space style={{ width: '100%', marginTop: 16 }} direction='vertical'>
      <Divider />
      <form action='#' onSubmit={signup}>
        <Row align='middle'>
          <Col xs={isMobile ? 24 : 6}>
            <Space>
              <Label>Wallet ID</Label>
              <Tooltip title={'A unique identifier of your wallet. You don\'t need to remember this. It helps password-savers in Safari and other browsers to autofill verification code for the correct wallet'}><QuestionCircleOutlined /></Tooltip>
            </Space>
          </Col>
          <Col xs={isMobile ? 24 : 18}>
            <InputBox
              disabled
              margin='8px'
              $marginBottom='0px'
              placeholder='username'
              width='100%'
              value={username}
              autoComplete='username'
              onChange={({ target: { value } }) => setUsername(value)}
            />
            {!validUsername && <Text style={{ color: 'red', fontSize: 10 }}>Username must be at least 4 characters, from: a-z, 0-9, -, _</Text>}
          </Col>
        </Row>
        <Row align='top' gutter={8}>
          <Col xs={isMobile ? 24 : 12}>
            <InputBox
              type='email'
              margin='8px'
              $marginBottom='0px'
              placeholder='email'
              width='100%'
              value={email}
              onChange={({ target: { value } }) => setEmail(value)}
            />
            {!validEmail && <Text style={{ color: 'red', fontSize: 10 }}>Not a valid email address</Text>}
          </Col>
          <Col xs={isMobile ? 24 : 12}>
            <InputPassword
              size='large'
              margin='8px'
              $marginBottom='0px'
              placeholder='password'
              autoComplete='new-password'
              width='100%'
              value={password}
              onChange={({ target: { value } }) => setPassword(value)}
            />
            {!validPassword && <Text style={{ color: 'red', fontSize: 10 }}>Password needs to be at least 8 characters</Text>}
          </Col>
        </Row>
        <Row justify='center'>
          {!success && <Space><Button shape='round' htmlType='submit' size='large' type='primary' style={{ width: '60%', minWidth: '320px', margin: 16 }}>Sign Up {isSafariTest && '& Setup Auto-Fill'}</Button>{signingUp && <Spin />}</Space>}
          {error && <Text style={{ color: 'red', marginBottom: 24 }}>{error}</Text>}
          {success &&
            <Space direction='vertical' align='center' style={{ margin: 16 }} size='large'>
              <Space><CheckCircleOutlined style={{ color: 'green', fontSize: 16 }} /> <Text style={{ color: 'green', fontSize: 16 }}>Success!</Text> </Space>
              {showSetupOTP && <Button shape='round' onClick={setupCode} size='large' type='primary'>Save Password & Setup Verification Code</Button>}
            </Space>}
        </Row>
        <Row>
          <Space direction='vertical'>
            <Text>Signing up is optional, but you get the following benefits:</Text>
            <Text>- Sync Wallets <Tooltip title={'Backup and restore your wallets using the cloud. Cloud backups are encrypted. Even when they are compromised, hackers won\'t be able to access your wallets without verification codes from authenticators'}><QuestionCircleOutlined /></Tooltip></Text>
            <Text>- Autofill Verification Code <Tooltip title='only available in Safari on macOS / iOS. Instead of using Google Authenticator, you may setup verification codes in saved passwords, and use system built-in security (e.g. FaceID / Fingerprint) to autofill the verification code'><QuestionCircleOutlined /></Tooltip></Text>
            <Text>- Alerts (Coming Soon) <Tooltip title='You can get email alerts when your wallet makes transactions meeting your custom criteria.'><QuestionCircleOutlined /></Tooltip></Text>
            {/* <Text>These services are currently centralized, but they are open source and will be decentralized soon.</Text> */}
          </Space>
        </Row>
      </form>
      <Divider />
    </Space>
  )
}

export default SignupAccount
