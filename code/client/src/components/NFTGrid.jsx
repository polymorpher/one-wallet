import { Card, Image, Row, Space, Typography, Col, Divider, Button, message } from 'antd'
import { unionWith, isNull, isUndefined, differenceBy } from 'lodash'
import walletActions from '../state/modules/wallet/actions'

import { PlusCircleOutlined } from '@ant-design/icons'
import React, { useState, useEffect } from 'react'
import { TallRow } from './Grid'
import { api } from '../../../lib/api'
import ONE from '../../../lib/onewallet'
import ONEUtil from '../../../lib/util'
import util from '../util'
import { Warning, Hint, InputBox, Heading } from './Text'
import { withKeys, HarmonyONE } from './TokenAssets'
import { useDispatch, useSelector } from 'react-redux'
import abbr from '../abbr'
import { handleAddressError } from '../handler'
import ONEConstants from '../../../lib/constants'
const { Text, Link } = Typography

const NFTGridItem = ({ style, tokenType, name, symbol, uri, contractAddress, balance, selected, onSelected }) => {
  const bech32ContractAddress = util.safeOneAddress(contractAddress)
  const abbrBech32ContractAddress = util.ellipsisAddress(bech32ContractAddress)
  uri = util.replaceIPFSLink(uri)
  const [metadata, setMetadata] = useState()
  useEffect(() => {
    const f = async function () {
      try {
        const metadata = await api.web.get({ link: uri })
        setMetadata(metadata)
      } catch (ex) {
        const identifier = name && symbol ? `${name} (${symbol}) (${uri})` : `${uri}`
        message.error(`Unable to retrieve data for token ${identifier}`)
      }
    }
    f()
  }, [])
  const imageHeight = style.height - style.infoBarHeight

  return (
    <Card.Grid style={{ ...style, ...(selected && { backgroundColor: '#fafafa' }) }} onClick={onSelected}>
      <Row style={{ height: imageHeight }}>
        <Image preview={false} src={util.replaceIPFSLink(metadata.image)} wrapperStyle={{ height: imageHeight, width: '100%' }} style={{ objectFit: 'cover' }} />
      </Row>
      <Row justify='space-between' style={{ alignItems: 'center' }} gutter={8}>
        {metadata && <Text style={{ fontSize: 24 }}>{metadata.name}</Text>}
        {!metadata && <Text copyable={{ text: abbrBech32ContractAddress }}>${util.ellipsisAddress(abbrBech32ContractAddress)}</Text>}
        <Text style={{ fontSize: 24 }}>{tokenType === ONEConstants.TokenType.ERC721 ? (balance ? 'Owned' : 'Not Owned') : `Owned: ${balance}`}</Text>
      </Row>
    </Card.Grid>
  )
}

export const NFTGrid = ({ address }) => {
  const dispatch = useDispatch()
  const wallet = useSelector(state => state.wallet.wallets[address])
  const selectedToken = util.isNFT(wallet.selectedToken) && wallet.selectedToken
  const tokenBalances = wallet.tokenBalances || {}
  const trackedTokens = (wallet.trackedTokens || []).filter(util.isNFT)
  const walletOutdated = util.isWalletOutdated(wallet)
  const [currentTrackedTokens, setCurrentTrackedTokens] = useState(trackedTokens || [])
  const [disabled, setDisabled] = useState(true)
  const [section, setSection] = useState()
  const gridItemStyle = {
    padding: 0,
    width: '296px',
    height: '296px',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    cursor: 'pointer',
    color: disabled && 'grey',
    opacity: disabled && 0.5
  }
  useEffect(() => {
    if (walletOutdated) {
      return
    }
    setDisabled(false)
    const f = async () => {
      let tts = await api.blockchain.getTrackedTokens({ address })
      tts = tts.filter(util.isNFT)
      tts = withKeys(tts)
      tts = unionWith(tts, trackedTokens, (a, b) => a.key === b.key)
      await Promise.all(tts.map(async tt => {
        // if (tt.name && tt.symbol && tt.uri) { return }
        try {
          const { name, symbol, uri } = await api.blockchain.getTokenMetadata(tt)
          Object.assign(tt, { name, symbol, uri })
        } catch (ex) {
          console.error(ex)
        }
      }))
      setCurrentTrackedTokens(tts)
    }
    f()
  }, [])

  useEffect(() => {
    (currentTrackedTokens || []).forEach(tt => {
      const { tokenType, tokenId, contractAddress, key } = tt
      dispatch(walletActions.fetchTokenBalance({ address, tokenType, tokenId, contractAddress, key }))
    })
    const newTokens = differenceBy(currentTrackedTokens, trackedTokens, e => e.key)
    dispatch(walletActions.trackTokens({ address, tokens: newTokens }))
  }, [currentTrackedTokens])

  const onSelect = (key) => () => {
    if (!key) return setSection(null)
    const token = currentTrackedTokens.find(t => t.key === key)
    dispatch(walletActions.setSelectedToken({ token, address }))
  }

  return (
    <>
      {disabled && <Warning style={{ marginTop: 32 }}>Your wallet is based on an outdated version. It cannot hold or send tokens. Please create a new wallet and migrate assets.</Warning>}
      {!section &&
        <TallRow>
          {currentTrackedTokens.map(tt => {
            const { icon, name, symbol, key, uri } = tt
            const balance = tokenBalances[key]
            return (
              <NFTGridItem
                disabled={disabled}
                selected={selectedToken.key === key}
                uri={uri}
                key={key}
                style={gridItemStyle}
                icon={icon} name={name} symbol={symbol} balance={balance}
                onSelected={onSelect(key)}
              />
            )
          })}
        </TallRow>}
    </>
  )
}
