import React, { useEffect, useState } from 'react'
import { useHistory, useLocation } from 'react-router'
import { api } from '../../../lib/api'
import AnimatedSection from '../components/AnimatedSection'
import Row from 'antd/es/row'
import { Heading, Hint, InputBox, InputPassword, Label, Link, SiderLink, Text } from '../components/Text'
import Button from 'antd/es/button'
import Spin from 'antd/es/spin'
import CheckOutlined from '@ant-design/icons/CheckOutlined'
import EmailValidator from 'email-validator'
import Table from 'antd/es/table'
import { downloadBlob, useWindowDimensions } from '../util'
import { unwrapErrpr } from '../handler'
import message from '../message'
import Space from 'antd/es/space'
import WalletAddress from '../components/WalletAddress'
import Divider from 'antd/es/divider'
import Paths from '../constants/paths'
import { useDispatch, useSelector } from 'react-redux'
import FieldBinaryOutlined from '@ant-design/icons/FieldBinaryOutlined'
import styled from 'styled-components'
import AddressInput from '../components/AddressInput'
import { globalActions } from '../state/modules/global'
const HoverLabel = styled(Label)`
  &:hover{
    cursor:pointer;
  }
`
const Contacts = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const knownAddresses = useSelector((state) => state.global.knownAddresses || {})
  const [contacts, setContacts] = useState(Object.values(knownAddresses).filter(e => e.address).map(a => ({ ...a, key: a.address })))
  const [useHex, setUseHex] = useState(false)
  const [showAddNewContact, setShowAddNewContact] = useState(false)

  const [label, setLabel] = useState('')
  const [newAddressObject, setNewAddressObject] = useState({ value: '', label: '' })
  const network = useSelector(state => state.global.network)

  const columns = [
    {
      title: 'Name',
      dataIndex: 'label',
      key: 'label',
      render: (text, record) => {
        return <HoverLabel onClick={() => history.push(Paths.showContact(record.address))} style={{ wordBreak: 'normal', whiteSpace: 'normal' }}>{text}</HoverLabel>
      }
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      // eslint-disable-next-line react/display-name
      render: (text, record) => {
        return (
          <WalletAddress
            onClick={() => history.push(Paths.showContact(record.address))}
            address={text} useHex={record.useHex} addressStyle={{ padding: 0 }} alwaysShowOptions
          />
        )
      }
    },
  ]

  useEffect(() => {
    setContacts(Object.values(knownAddresses).filter(e => e.address).map(a => ({ ...a, key: `${a.address}|${useHex}`, useHex })))
  }, [knownAddresses, useHex])

  const addNewContact = () => {
    const [matchedAddress] = contacts.filter(c => c.address.toLowerCase() === newAddressObject.value.toLowerCase())
    const [matchedName] = contacts.filter(c => c.label === label)
    if (matchedName) {
      message.error(`Name "${label}" is already used (address: ${matchedName.address})`)
      return
    }
    if (matchedAddress) {
      message.error(`Address "${newAddressObject.value}" is already a contact (${matchedAddress.label})`)
      return
    }

    const now = Date.now()
    dispatch(
      globalActions.setKnownAddress({
        address: newAddressObject.value,
        label,
        network,
        createTime: now,
        lastUsedTime: 0,
        numUsed: 0,
      }),
    )
    message.success(`Added new contact ${label}`)
    setShowAddNewContact(false)
    setLabel('')
    setNewAddressObject({ value: '', label: '' })
  }

  return (
    <AnimatedSection wide>
      <Space direction='vertical' size='large' style={{ width: '100%', marginBottom: 32 }}>
        <Heading>Contacts</Heading>
        <Text>Here are your saved contacts. When you are asked to provide an address, you can find them in drop down menu or type names to search</Text>
        <Link onClick={() => setUseHex(e => !e)}>
          {useHex ? 'Show Harmony Address (one1...)' : 'Show Hex Addresses (0x...)'}
        </Link>
        <Link onClick={() => setShowAddNewContact(true)}>
          Add New Contact
        </Link>
      </Space>
      {showAddNewContact && (
        <Space direction='vertical' style={{ width: '100%' }}>
          <Divider />
          <Space align='baseline' size='large'>
            <Label>
              <Hint>Name</Hint>
            </Label>
            <InputBox
              margin='auto'
              width={200}
              value={label}
              onChange={({ target: { value } }) => setLabel(value)}
            />
          </Space>
          <Space style={{ width: '100%', marginTop: 16, marginBottom: 16, flexWrap: 'nowrap' }} align='baseline' size='large'>
            <Label>
              <Hint>Address</Hint>
            </Label>
            <AddressInput addressValue={newAddressObject} setAddressCallback={setNewAddressObject} showHexHint />
          </Space>
          <Row style={{ width: '100%', marginTop: 32, marginBottom: 32 }} justify='end'>
            <Button type='primary' shape='round' onClick={addNewContact}>Add</Button>
          </Row>
          <Divider />
        </Space>
      )}
      <Table
        style={{ marginTop: 32 }}
        dataSource={contacts}
        columns={columns}
      />
    </AnimatedSection>
  )
}

export default Contacts
