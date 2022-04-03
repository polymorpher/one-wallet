import React from 'react'
import { useSelector } from 'react-redux'
import util from '../../util'
import AnimatedSection from '../../components/AnimatedSection'
import { Title, Warning } from '../../components/Text'

const EnsureExecutable = (Component, title = 'Error') => ({ address, onClose, ...props }) => {
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const { forwardAddress } = wallet
  const normalizedForwardAddress = util.safeNormalizedAddress(forwardAddress)
  if (util.isCommandOnlyWallet(wallet)) {
    return (
      <AnimatedSection wide title={<Title level={2}>{title}</Title>} onClose={onClose}>
        <Warning>This operation cannot be performed on this wallet, because it was already deprecated and all its assets will be forwarded to {normalizedForwardAddress}</Warning>
      </AnimatedSection>
    )
  }
  return <Component address={address} onClose={onClose} {...props} />
}

export default EnsureExecutable
