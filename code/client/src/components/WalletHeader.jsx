import React from 'react'
// import styled from 'styled-components'
import { PageHeader } from 'antd'
import { useRouteMatch } from 'react-router'
import { titleCase } from 'title-case'
import { useSelector } from 'react-redux'

const WalletHeader = () => {
  const match = useRouteMatch('/:action')
  const { action } = match.params
  const address = useSelector(state => state.wallet.selected)

  return (
    <PageHeader
      style={{ background: '#ffffff' }}
      onBack={() => null}
      title={titleCase(action || '')}
      subTitle={address || ''}
    />
  )
}

export default WalletHeader
