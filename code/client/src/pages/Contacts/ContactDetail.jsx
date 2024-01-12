import Button from 'antd/es/button'
import Popconfirm from 'antd/es/popconfirm'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import EditOutlined from '@ant-design/icons/EditOutlined'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useWindowDimensions } from '../../util'
import Paths from '../../constants/paths'
import { globalActions } from '../../state/modules/global'
import { matchPath, useHistory, useLocation } from 'react-router'
import { Hint, InputBox, Label } from '../../components/Text'
import AnimatedSection from '../../components/AnimatedSection'
import WalletAddress from '../../components/WalletAddress'
import message from '../../message'
const { Text } = Typography

const ContactDetail = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const [label, setLabel] = useState()
  const [contact, setContact] = useState()
  const knownAddresses = useSelector(
    (state) => state.global.knownAddresses || {},
  )

  const deleteKnownAddress = () => {
    dispatch(globalActions.deleteKnownAddress(contact.address))
    message.error('Contact deleted')
    setTimeout(() => {
      history.goBack()
    }, 500)
  }

  const editKnownAddress = () => {
    dispatch(
      globalActions.setKnownAddress({
        ...contact,
        label,
      }),
    )
    message.success(`Contact label updated to ${label}`)
    history.goBack()
  }

  useEffect(() => {
    const m = matchPath(location.pathname, { path: Paths.contact })
    const { address } = m?.params || {}
    if (!knownAddresses[address]) {
      message.error('Contact not found')
      setTimeout(() => {
        history.goBack()
      }, 500)
    }
    const tempAddress = knownAddresses[address]
    setContact(tempAddress)
    setLabel(tempAddress.label)
  }, [location])

  return (
    <AnimatedSection>
      <Space direction='vertical' size='large' style={{ width: '100%' }}>
        <Space align='baseline' size='large'>
          <Label ultraWide>
            <Hint>Name</Hint>
          </Label>
          <InputBox
            margin='auto'
            width={200}
            value={label}
            onChange={({ target: { value } }) => setLabel(value)}
          />
        </Space>
        <Space align='baseline' size='large'>
          <Label ultraWide>
            <Hint>Address</Hint>
          </Label>
          <WalletAddress showLabel address={contact?.address} shorten />
        </Space>
        <Space align='baseline' size='large'>
          <Label ultraWide>
            <Hint>Domain</Hint>
          </Label>
          <Text>{contact?.domain?.name || 'None'}</Text>
        </Space>
        <Row style={{ marginTop: 24 }} justify='space-between'>
          <Popconfirm
            title='Are you sure？'
            onConfirm={deleteKnownAddress}
          >
            <Button
              type='primary'
              shape='round'
              danger
              size='large'
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
          </Popconfirm>
          <Button
            type='primary'
            shape='round'
            size='large'
            icon={<EditOutlined />}
            onClick={editKnownAddress}
          >
            Save
          </Button>
        </Row>
      </Space>
    </AnimatedSection>
  )
}

export default ContactDetail
