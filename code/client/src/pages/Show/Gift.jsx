import { useDispatch, useSelector } from 'react-redux'
import React, { useEffect, useRef, useState, Suspense } from 'react'
import { Button, Row, Space, Typography, message, Input, Select, Spin } from 'antd'
import {
  CheckCircleOutlined,
  CloseOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { Hint, InputBox, Label } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util, { useWindowDimensions } from '../../util'
import BN from 'bn.js'
import ShowUtils from './show-util'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEUtil from '../../../../lib/util'
import { api } from '../../../../lib/api'
import ONEConstants from '../../../../lib/constants'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import humanizeDuration from 'humanize-duration'
import { useMetadata, useNFTs } from '../../components/NFTGrid'
const { Title, Text } = Typography

const SimpleNFTRow = ({ nft, amount, onClick, onAmountChange, onDelete }) => {
  const { displayName } = useMetadata(nft)
  if (!nft || !displayName) {
    return <></>
  }
  return (
    <Space onClick={onClick} style={{ width: '100%' }}>
      {!onAmountChange && amount !== undefined && <Hint>{amount} × </Hint>}
      {onAmountChange && <><InputBox margin='auto' style={{ borderBottom: '1px solid black' }} width={64} value={amount} onChange={({ target: { value } }) => onAmountChange(value)} /> <Hint> × </Hint> </>}
      <Text>{displayName}</Text>
      {onDelete && <CloseCircleOutlined style={{ marginLeft: 32 }} onClick={onDelete} />}
    </Space>
  )
}

const Gift = ({
  address,
  onSuccess, // optional
  prefilledTotalAmount, // string, ONE
  prefilledClaimLimit, // string, ONE
  prefilledClaimInterval // int, non-zero
}) => {
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const dispatch = useDispatch()
  const [stage, setStage] = useState(-1)
  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input, resetOtp } = otpState

  const [totalAmountInput, setTotalAmountInput] = useState(prefilledTotalAmount || 100) // ONEs, string
  const [claimLimitInput, setClaimLimitInput] = useState(prefilledClaimLimit || 25) // ONEs, string
  const [claimInterval, setClaimInterval] = useState(prefilledClaimInterval || 30) // seconds, int
  const [selectedNFTs, setSelectedNFTs] = useState([])
  const { nfts, nftMap, loaded } = useNFTs({ address })
  const [nftAmounts, setNftAmounts] = useState([])

  return (
    <>
      <Space direction='vertical' size='large'>
        <Text>Create a red packet with some ONEs and collectibles (NFTs) inside. You can share the red packet as a QR code or a link. Others can claim ONEs and collectibles in the red packet by scanning the QR code or visiting the link</Text>
        <Space align='baseline' size='large'>
          <Label ultraWide><Hint>Total Amount</Hint></Label>
          <InputBox margin='auto' width={200} value={totalAmountInput} onChange={({ target: { value } }) => setTotalAmountInput(value)} disabled={!!prefilledTotalAmount} suffix='ONE' />
        </Space>
        <Space align='baseline' size='large'>
          <Label ultraWide><Hint>Per Claim Limit</Hint></Label>
          <InputBox margin='auto' width={200} value={claimLimitInput} onChange={({ target: { value } }) => setClaimLimitInput(value)} disabled={!!prefilledClaimLimit} suffix='ONE' />
        </Space>
        <Space direction='vertical'>
          <Space align='baseline' size='large'>
            <Label ultraWide><Hint>Claim Interval</Hint></Label>
            <InputBox margin='auto' width={200} value={claimInterval} onChange={({ target: { value } }) => setClaimInterval(parseInt(value || 0))} disabled={!!prefilledClaimLimit} suffix='seconds' />
          </Space>
          {claimInterval > 60 &&
            <Row justify='end'>
              <Hint>≈ {humanizeDuration(claimInterval * 1000, { largest: 2, round: true })}</Hint>
            </Row>}
        </Space>
        <Space align='baseline' size='large'>
          <Label ultraWide><Hint>Add Collectibles</Hint></Label>
          <Space direction='vertical'>
            {selectedNFTs.map((key, i) => (
              <SimpleNFTRow
                key={key} nft={nftMap[key]} amount={nftAmounts[i]} onAmountChange={v => {
                  setNftAmounts(amounts => [...amounts.slice(0, i), parseInt(v || 0), ...amounts.slice(i + 1)])
                }}
                onDelete={() => {
                  setSelectedNFTs(s => [...s.slice(0, i), ...s.slice(i + 1)])
                  setNftAmounts(s => [...s.slice(0, i), ...s.slice(i + 1)])
                }}
              />
            ))}
            <Select
              placeholder={<Space><PlusCircleOutlined /><Hint>Add More...</Hint></Space>}
              labelInValue
              style={{
                width: isMobile ? '100%' : 256,
                borderBottom: '1px dashed black',
              }}
              bordered={false}
            >
              {loaded && nfts.map(nft => {
                const { key } = nft
                if (!key) {
                  return <></>
                }
                if (selectedNFTs.includes(key)) {
                  return <></>
                }
                const onClick = () => {
                  if (!key) {
                    return
                  }
                  setSelectedNFTs(s => [...s, key])
                  setNftAmounts(s => [...s, 1])
                }
                return (
                  <Select.Option key={key} value={key}>
                    <SimpleNFTRow nft={nftMap[key]} onClick={onClick} />
                  </Select.Option>
                )
              })}
            </Select>
          </Space>
        </Space>
      </Space>
    </>
  )
}

export default Gift

const GiftModule = ({
  address,
  show,
  onClose, // optional
  onSuccess, // optional
  prefilledTotalAmount, // string, ONE
  prefilledClaimLimit, // string, ONE
  prefilledClaimInterval // int, non-zero
}) => {
  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      show={show} title={<Title level={2}>Send Gift</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Gift
        address={address}
        prefilledTotalAmount={prefilledTotalAmount} prefilledClaimLimit={prefilledClaimLimit} prefilledClaimInterval={prefilledClaimInterval}
        onSuccess={onSuccess}
      />
    </AnimatedSection>
  )
}
