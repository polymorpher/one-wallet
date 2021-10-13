import { useDispatch } from 'react-redux'
import React, { useEffect, useState } from 'react'
import ONEConstants from '../../../lib/constants'
import util, { useWindowDimensions } from '../util'
import { handleAddressError } from '../handler'
import { Button, message, Select, Space } from 'antd'
import BN from 'bn.js'
import ONEUtil from '../../../lib/util'
import ONE from '../../../lib/onewallet'
import walletActions from '../state/modules/wallet/actions'
import { api } from '../../../lib/api'
import { TallRow } from './Grid'
import { Heading, Hint, InputBox, Label, LabeledRow } from './Text'

const TrackNewNFT = ({ onClose, onTracked, address }) => {
  const dispatch = useDispatch()
  const [newContractAddress, setNewContractAddress] = useState('')
  const [tokenTypeInput, setTokenTypeInput] = useState({ value: ONEConstants.TokenType.ERC1155, label: ONEConstants.TokenType[ONEConstants.TokenType.ERC1155] })
  const [tokenIdInput, setTokenIdInput] = useState('')
  const { isMobile } = useWindowDimensions()

  useEffect(() => {
    if (!newContractAddress || newContractAddress.length < 42) {
      return
    }
    const contractAddress = util.safeExec(util.normalizedAddress, [newContractAddress], handleAddressError)
    if (!contractAddress) {
      return
    }
    const f = async () => {
      try {
        const nftType = await api.tokens.getNFTType(contractAddress)
        if (nftType !== ONEConstants.TokenType.NONE) {
          setTokenTypeInput({ value: nftType, label: ONEConstants.TokenType[nftType] })
        } else {
          message.error('Cannot determine collectible type for the given address')
        }
      } catch (ex) {
        message.error(`Unexpected error in querying collectible contract: ${ex.toString()}`)
        console.error(ex)
      }
    }
    f()
  }, [newContractAddress])
  const addToken = async function () {
    const contractAddress = util.safeExec(util.normalizedAddress, [newContractAddress], handleAddressError)
    if (!contractAddress) {
      return
    }
    let tokenId = tokenIdInput
    try {
      if (tokenIdInput.startsWith('0x')) {
        tokenId = new BN(tokenIdInput.slice(2), 16).toString()
      } else {
        tokenId = new BN(tokenIdInput).toString()
      }
    } catch (ex) {
      message.error('Invalid token ID. It must be either in hex (0x...) or integer format.')
      console.error(ex)
      return
    }
    const tokenType = tokenTypeInput.value
    const tt = { tokenType, tokenId, contractAddress }
    const key = ONEUtil.hexView(ONE.computeTokenKey(tt).hash)
    dispatch(walletActions.fetchTokenBalance({ address, ...tt, key }))
    tt.key = key
    try {
      if (tt) {
        const { name, symbol, uri } = await api.blockchain.getTokenMetadata(tt)
        tt.name = name
        tt.symbol = symbol
        tt.uri = uri
        dispatch(walletActions.trackTokens({ address, tokens: [tt] }))
        message.success('New collectible tracked')
        onTracked && onTracked(tt)
        onClose && onClose()
      }
    } catch (ex) {
      console.error(ex)
    }
  }

  return (
    <TallRow style={{ width: '100%' }}>
      <Space direction='vertical' size='large' style={{ width: '100%' }}>
        <Heading>Track Another Collectible</Heading>
        <LabeledRow isMobile={isMobile} label='Contract' align='middle'>
          <InputBox margin='auto' width='100%' value={newContractAddress} onChange={({ target: { value } }) => setNewContractAddress(value)} placeholder='one1...' />
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='ID' align='middle'>
          <InputBox margin='auto' width='100%' value={tokenIdInput} onChange={({ target: { value } }) => setTokenIdInput(value)} placeholder='0x... or 123...' />
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='Type' align='middle'>
          <Select value={tokenTypeInput} labelInValue onChange={v => setTokenTypeInput(v)}>
            <Select.Option value={ONEConstants.TokenType.ERC1155}>{ONEConstants.TokenType[ONEConstants.TokenType.ERC1155]}</Select.Option>
            <Select.Option value={ONEConstants.TokenType.ERC721}>{ONEConstants.TokenType[ONEConstants.TokenType.ERC721]}</Select.Option>
          </Select>
        </LabeledRow>
        <TallRow justify='space-between'>
          <Button size='large' type='text' onClick={() => onClose(null)} danger>Cancel</Button>
          <Button type='primary' size='large' shape='round' disabled={!newContractAddress || !tokenTypeInput || !tokenIdInput} onClick={addToken}>Confirm</Button>
        </TallRow>
      </Space>
    </TallRow>
  )
}

export default TrackNewNFT
