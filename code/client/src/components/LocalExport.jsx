import React, { useState } from 'react'
import message from '../message'
import storage from '../storage'
import { Button, Modal, Typography } from 'antd'
import { ExportOutlined, LoadingOutlined } from '@ant-design/icons'
import { SimpleWalletExport, InnerTree } from '../proto/wallet'
import util from '../util'
const { Text, Link, Paragraph } = Typography

const LocalExport = ({ wallet }) => {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    let element
    try {
      setLoading(true)
      const oneAddress = util.safeOneAddress(wallet.address)
      let layers
      const { localIdentificationKey, identificationKeys, oldInfos } = wallet || {}
      if (localIdentificationKey && identificationKeys) {
        const idKeyIndex = identificationKeys.findIndex(e => e === localIdentificationKey)
        if (idKeyIndex === -1) {
          message.debug('Cannot identify tree to use because of identification key mismatch. Falling back to brute force search')
          layers = await storage.getItem(wallet.root)
        } else {
          message.debug(`Identified tree via localIdentificationKey=${localIdentificationKey}`)
          if (idKeyIndex === identificationKeys.length - 1) {
            layers = await storage.getItem(wallet.root)
          } else {
            const info = oldInfos[idKeyIndex]
            layers = await storage.getItem(info.root)
          }
        }
      } else {
        layers = await storage.getItem(wallet.root)
      }

      const filename = `${wallet.name.toLowerCase().split(' ').join('-')}-${oneAddress}.1wallet`

      const innerTrees = await Promise.all(wallet.innerRoots.map(r => storage.getItem(r)))
      if (innerTrees.filter(e => e).length !== innerTrees.length) {
        message.error('Storage is corrupted. Please restore the wallet using some other way')
        return
      }
      const innerTreePB = innerTrees.map(layers => InnerTree.create({ layers }))
      const exportPB = SimpleWalletExport.create({
        name: wallet.name,
        address: wallet.address,
        expert: wallet.expert,
        layers,
        innerTrees: innerTreePB,
        state: JSON.stringify(wallet)
      })
      const bytes = SimpleWalletExport.encode(exportPB).finish()
      const blob = new Blob([bytes])

      element = document.createElement('a')
      element.download = filename
      element.href = URL.createObjectURL(blob)
      document.body.appendChild(element)
      element.click()

      message.success(`Exported ${filename} Successfully`)
    } catch (err) {
      message.error(err?.message)
    } finally {
      if (element.href) URL.revokeObjectURL(element.href)
      if (element) {
        document.body.removeChild(element)
        element = undefined
      }
      setLoading(false)
    }
  }

  const showExportModal = () => {
    Modal.confirm({
      content: <Text><Paragraph>The exported file is meant for cross-device transfer. Please do not keep the exported file on your device for longer than necessary. </Paragraph><Paragraph>Doing so would make your wallet less secure, and opens up possibilities for an attacker to hack your wallet.</Paragraph><Paragraph>For more technical details, please read <Link href='https://github.com/polymorpher/one-wallet/wiki/Client-Security' target='_blank' rel='noreferrer'>Client Security in 1wallet wiki</Link></Paragraph></Text>,
      onOk: handleExport,
    })
  }

  return (
    <Button type='primary' shape='round' size='large' icon={loading ? <LoadingOutlined /> : <ExportOutlined />} onClick={showExportModal}>Export</Button>
  )
}

export default LocalExport
