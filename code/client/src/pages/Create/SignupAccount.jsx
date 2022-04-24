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

const genUsername = ({ name, address, effectiveTime }) => {
  const date = new Date(effectiveTime).toISOString().slice(2, 10)
  const prefix = `${name}_${date}`.toLowerCase().replace(' ', '_')
  const oneAddress = util.safeOneAddress(address)
  const suffix = oneAddress.slice(oneAddress.length - 4)
  return `${prefix}_${suffix}`
}

const SignupAccount = ({ seed, name, address, effectiveTime, setAllowOTPAutoFill }) => {
  const { isMobile } = useWindowDimensions()
  const [username, setUsername] = useState(genUsername({ name, address, effectiveTime }))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const validPassword = password === '' || (password.length >= 8 && password.length <= 64)
  const validEmail = email === '' || EmailValidator.validate(email)
  const validUsername = username === '' || (username.length >= 4 && username.length < 64 && username.match(/[a-z0-9_-]+/))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const otpDisplayName = `${ONENames.nameWithTime(name, effectiveTime)} [${util.safeOneAddress(address)}]`

  const isSafariTest = isSafari()

  const signup = async (e) => {
    e.stopPropagation()
    const { success, error } = await api.backend.signup({ username, password, email })
    if (!success) {
      setError(`Failed to signup. Error: ${error}`)
    } else {
      setSuccess(true)
      let host = new URL(location.href).host
      const parts = host.split('.')
      if (parts.length >= 3) {
        host = parts[parts.length - 2] + '.' + parts[parts.length - 1]
      }
      window.location.href = getQRCodeUri(seed, otpDisplayName, OTPUriMode.APPLE, host)
      setAllowOTPAutoFill(true)
    }
    return false
  }

  return (
    <Space style={{ width: '100%', marginTop: 16 }} direction='vertical'>
      <Divider />
      <form action='#' onSubmit={signup}>
        <Row align='middle'>
          <Col xs={isMobile ? 24 : 6}>
            <Space>
              <Label>Wallet ID</Label>
              <Tooltip title={'A unique identifier of your wallet. You don\'t need to remember this. It helps password-savers in Safari and other browsers to auto-fill auth code for the correct wallet'}><QuestionCircleOutlined /></Tooltip>
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
          {!success && <Button shape='round' htmlType='submit' size='large' type='primary' style={{ width: '60%', minWidth: '320px', margin: 16 }}>Sign Up {isSafariTest && '& Setup Auto-Fill'}</Button>}
          {error && <Text style={{ color: 'red' }}>{error}</Text>}
          {success &&
            <Space direction='vertical' style={{ margin: 16 }} size='large'>
              <Space><CheckCircleOutlined style={{ color: 'green', fontSize: 16 }} /> <Text style={{ color: 'green', fontSize: 16 }}>Success!</Text> </Space>
            </Space>}
        </Row>
        <Row>
          <Space direction='vertical'>
            {isSafariTest && <Text style={{ color: 'red' }}><b>Safari Users</b>: To setup auth-code auto-fill, please allow the browser to save your password and to open "System Preferences"</Text>}
            <Text>Signing up is optional, but you get the following benefits:</Text>
            <Text>- Sync Wallets <Tooltip title={'Backup and restore your wallets using the cloud. Cloud backups are encrypted. Even when they are compromised, hackers won\'t be able to access your wallets without auth codes from authenticators'}><QuestionCircleOutlined /></Tooltip></Text>
            <Text>- Auto-fill Auth Code <Tooltip title={'only available in Safari on macOS / iOS. Instead of using Google Authenticator, you may setup auth codes as "verification codes" in saved passwords, and use FaceID / Fingerprint / Admin password to automatically fill-in the auth code'}><QuestionCircleOutlined /></Tooltip></Text>
            <Text>- Alerts (coming soon) <Tooltip title='You can get email alerts when your wallet makes transactions meeting your custom criteria.'><QuestionCircleOutlined /></Tooltip></Text>
            <Text>These services are currently centralized, but they are open source and will be decentralized soon.</Text>
          </Space>
        </Row>
      </form>
      <Divider />
    </Space>
  )
}

export default SignupAccount
