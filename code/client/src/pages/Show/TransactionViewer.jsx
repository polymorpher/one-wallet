import Table from 'antd/es/table'
import ConfigProvider from 'antd/es/config-provider'
import Typography from 'antd/es/typography'
import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { api } from '../../../../lib/api'
import config from '../../config'
import util from '../../util'

const { Text, Link } = Typography

const TransactionViewer = ({ address }) => {
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const [txList, setTxList] = useState([])
  const [loading, setLoading] = useState(true)
  const network = wallet.network

  useEffect(() => {
    if (!address) return
    async function run () {
      const txHashes = await api.explorer.getTransactionHistory(address)
      const allTxs = await Promise.all(txHashes.map(txHash => api.explorer.getTransaction(txHash)))
      const oneAddress = util.safeOneAddress(address)
      setTxList(allTxs.map(tx => ({
        key: tx.hash,
        type: tx.to === oneAddress ? 'Receive' : tx.from === oneAddress ? 'Send' : 'Unknown',
        date: new Date(tx.timestamp * 1000).toLocaleDateString(),
        value: tx.value,
        txId: tx.hash
      })))
    }
    run().finally(() => {
      setLoading(false)
    })
  }, [address])

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: 'TransactionId',
      dataIndex: 'txId',
      key: 'txId',
      render (txId) {
        if (config.networks[network].explorer) {
          const link = config.networks[network].explorer.replace(/{{txId}}/, txId)
          return <Link target='_blank' href={link} rel='noreferrer'>{txId.substr(0, 8)}</Link>
        }
      }
    },
  ]

  return (
    <ConfigProvider renderEmpty={() => (
      <Text>No transaction found for this wallet.</Text>
    )}
    >
      <Table dataSource={txList} columns={columns} pagination={{ pageSize: 10, hideOnSinglePage: true }} loading={loading} />
    </ConfigProvider>
  )
}
export default TransactionViewer
