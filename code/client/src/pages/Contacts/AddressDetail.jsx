import {Button, Col, Popconfirm, Row, Space} from 'antd'
import {DeleteOutlined, EditOutlined} from '@ant-design/icons'
import React, {useCallback, useEffect, useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'
import util, {useWindowDimensions} from '../../util'
import walletActions from '../../state/modules/wallet/actions'
import Paths from '../../constants/paths'
import {matchPath, useHistory, useLocation} from 'react-router'
import {Hint, InputBox, Label} from '../../components/Text'
import AnimatedSection from '../../components/AnimatedSection'
import {TallRow} from '../../components/Grid'
import WalletAddress from '../../components/WalletAddress'
import message from '../../message'

const AddressDetail = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const [label, setLabel] = useState()
  const [contact, setContact] = useState()
  const {isMobile} = useWindowDimensions()
  const knownAddresses = useSelector(
    (state) => state.wallet.knownAddresses || {},
  )

  const deleteKnownAddress = () => {
    dispatch(walletActions.deleteKnownAddress(contact.address))
    message.error('Address deleted')
    setTimeout(() => {
      history.goBack()
    }, 500)
    }

  const editKnownAddress = () => {
    dispatch(
      walletActions.setKnownAddress({
        ...contact,
        label: label,
      }),
    )
    message.success(`Address label updated to ${label}`)
    history.goBack()
  }

  useEffect(() => {
    const m = matchPath(location.pathname, {path: Paths.address})
    const {address} = m?.params || {}
    if (!knownAddresses[address]) {
      message.error('Address not found in local state')
      setTimeout(() => {
        history.goBack()
      }, 500);
    }
    const tempAddress = knownAddresses[address]
    setContact(tempAddress)
    setLabel(tempAddress.label)
  }, [location])

  return (
    <AnimatedSection>
      <Space direction="vertical" size="large">
        <Space align="baseline" size="large">
          <Label ultraWide>
            <Hint>Label</Hint>
          </Label>
          <InputBox
            margin="auto"
            width={200}
            value={label}
            onChange={({target: {value}}) => setLabel(value)}
          />
        </Space>
        <Space align="baseline" size="large">
          <Label ultraWide>
            <Hint>Address</Hint>
          </Label>
          <WalletAddress showLabel address={contact?.address} shorten />
        </Space>
        <Space align="baseline" size="large">
          <Label ultraWide>
            <Hint>Domain</Hint>
          </Label>
          <InputBox
            margin="auto"
            width={200}
            value={contact?.domain?.name || 'N/A'}
            disabled
          />
        </Space>
        <Row style={{marginTop: 24}} justify="start">
          <Space>
            <Popconfirm
              title="Are you sure？"
              onConfirm={deleteKnownAddress}
            >
              <Button
                type="primary"
                shape="round"
                danger
                size="large"
                icon={<DeleteOutlined />}
              >
                Delete
              </Button>
            </Popconfirm>
            <Button
              type="primary"
              shape="round"
              size="large"
              icon={<EditOutlined />}
              onClick={editKnownAddress}
            >
              Save
            </Button>
          </Space>
        </Row>
      </Space>
    </AnimatedSection>
  )
}

export default AddressDetail
