import React, { useState } from 'react'
import { useHistory } from 'react-router'
import { api } from '../../../lib/api'
import AnimatedSection from '../components/AnimatedSection'
import Row from 'antd/es/row'
import { Heading, InputBox, InputPassword, SiderLink, Text } from '../components/Text'
import Button from 'antd/es/button'
import Spin from 'antd/es/spin'
import CheckOutlined from '@ant-design/icons/CheckOutlined'
import EmailValidator from 'email-validator'
import Table from 'antd/es/table'
import { downloadBlob } from '../util'
import { unwrapErrpr } from '../handler'
import message from '../message'
import Space from 'antd/es/space'
import WalletAddress from '../components/WalletAddress'
import Divider from 'antd/es/divider'
import Paths from '../constants/paths'

const Backup = () => {
  const [backups, setBackups] = useState([])
  const [pending, setPending] = useState(false)
  const [username, setUsername] = useState('')
  const isUserNameEmail = EmailValidator.validate(username)
  const [password, setPassword] = useState('')
  const authInfo = { password, ...(isUserNameEmail ? { email: username } : { username }) }
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadingKey, setDownloadingKey] = useState('')

  const doLookup = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    setPending(true)
    try {
      const { backups: results } = isUserNameEmail ? await api.backend.listByEmail(authInfo) : await api.backend.listByUsername(authInfo)
      console.log(results)
      setBackups(results.map(e => ({ ...e, key: e.id })))
    } catch (ex) {
      message.error(`Failed to lookup backups. Error: ${unwrapErrpr(ex)}`)
    } finally {
      setPending(false)
    }
  }

  const columns = [
    {
      title: 'Time',
      dataIndex: 'timeUpdated',
      key: 'timeUpdated',
      defaultSortOrder: 'descend',
      render: (text, record) => {
        return new Date(record.timeUpdated).toLocaleString()
      }
    },
    {
      title: 'Wallet ID',
      dataIndex: 'username',
      key: 'username',
      render: (text) => {
        return text
      }
    },
    {
      title: 'Address',
      dataIndex: 'id',
      key: 'address',
      // eslint-disable-next-line react/display-name
      render: (text) => {
        return <WalletAddress address={text} shorten addressStyle={{ padding: 0 }} alwaysShowOptions />
      }
    },
    {
      title: 'Action',
      key: 'action',
      // eslint-disable-next-line react/display-name
      render: (text, record) => {
        return (
          <Space>
            <Button
              shape='round'
              style={{ width: 96 }}
              disabled={pending || (downloadingKey === record.id)}
              onClick={async () => {
                try {
                  setDownloadingKey(record.id)
                  const onDownloadProgress = p => {
                    const perc = Number(p.loaded) / Number(p.target.getResponseHeader('Content-Length'))
                    setDownloadProgress(perc)
                  }
                  const blob = await api.backend.download({ ...authInfo, address: record.address, onDownloadProgress })
                  const filename = record.username ? `${record.address}__${record.username}.recover1wallet` : `${record.address}.recover1wallet`
                  downloadBlob(blob, filename)
                } catch (ex) {
                  message.error(`Failed to download recovery file. Error: ${unwrapErrpr(ex)}`)
                } finally {
                  setDownloadingKey('')
                  setDownloadProgress(0)
                }
              }}
            >
              {downloadingKey === record.id ? `${(downloadProgress * 100).toFixed(0)}%` : 'Download'}
            </Button>
          </Space>
        )
      }
    },
  ]

  return (
    <AnimatedSection wide>
      <Space direction='vertical' size='large' style={{ width: '100%', marginBottom: 32 }}>
        <Heading>Backups</Heading>
        <Text>Here, you can login and lookup recovery file backups you made under your account. If you use email to login, all backups associated with the email can be downloaded. If you use username (wallet id) to login, only the backup for that wallet will be available </Text>
        <Text>You can use the recovery files to <SiderLink href={Paths.restore}>restore a wallet</SiderLink> (choose second option)</Text>
      </Space>
      <form action='#' onSubmit={doLookup}>
        <Row style={{ display: 'flex', width: '100%', columnGap: 16 }}>
          <InputBox
            size='large'
            margin='8px'
            $marginBottom='0px'
            placeholder='username or email'
            style={{ flex: 1 }}
            value={username}
            autoComplete='email'
            onChange={({ target: { value } }) => setUsername(value)}
          />
          <InputPassword
            size='large'
            margin='8px'
            $marginBottom='0px'
            placeholder='password'
            autoComplete='password'
            style={{ flex: 1 }}
            value={password}
            onChange={({ target: { value } }) => setPassword(value)}
          />
        </Row>
        <Row justify='end' style={{ width: '100%', marginTop: 16, marginBottom: 16 }}>
          <Button htmlType='submit' size='large' shape='round' type='primary' onClick={doLookup} disabled={pending}>
            Lookup {pending && <Spin style={{ marginLeft: 8, marginRight: 8 }} />}
          </Button>
        </Row>
      </form>
      {/* {backups?.length > 0 && ( */}
      <Table
        style={{ marginTop: 32 }}
        dataSource={backups}
        columns={columns}
        loading={pending}
      />
      {/* )} */}
    </AnimatedSection>
  )
}

export default Backup
