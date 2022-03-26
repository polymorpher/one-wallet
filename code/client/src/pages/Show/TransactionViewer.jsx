import Table from 'antd/es/table'
import ConfigProvider from 'antd/es/config-provider'
import Typography from 'antd/es/typography'
import Button from 'antd/es/button'
import Input from 'antd/es/input'
import Space from 'antd/es/space'
import React, { useEffect, useRef, useState } from 'react'
import { Warning } from '../../components/Text'
import { useSelector } from 'react-redux'
import { api } from '../../../../lib/api'
import ONEUtil from '../../../../lib/util'
import { parseTxLog } from '../../../../lib/parser'
import config from '../../config'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import util from '../../util'

const { Text, Link } = Typography

const PAGE_SIZE = 10

function getOperationInfo (tx, address) {
  if (tx.value > 0) {
    return {
      value: ONEUtil.toOne(ONEUtil.toBN(tx.value || 0)) + ' ONE',
      type: tx.to === address ? 'PaymentReceived' : tx.from === address ? 'PaymentSent' : 'Unknown'
    }
  }
  if (!tx.logs?.length) {
    return { value: '', type: 'Unknown' }
  }

  return { value: tx.displayEventValue, type: tx.displayEvent }
}

const TransactionViewer = ({ address }) => {
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const [txList, setTxList] = useState([])
  const [loading, setLoading] = useState(true)
  const network = wallet.network
  const searchInput = useRef()
  const fetchPageOptions = useRef({ pageSize: 10, pageIndex: 0 }).current

  const [pageSize, setPageSize] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFooter, setShowFooter] = useState(false)
  const [error, setError] = useState('')
  const [fetchedAddresses, setFetchedAddresses] = useState([])
  const [fetchingAddress, setFetchingAddress] = useState(address)

  useEffect(() => {
    if (!address) return
    loadData()
  }, [address])

  useEffect(() => {
    setCurrentPage(0)
  }, [pageSize])

  function onChange (pagination) {
    setCurrentPage(pagination.current)
  }

  function footerRenderer () {
    return (
      <Space style={{ display: 'flex', justifyContent: 'center' }}>
        <Button type='link' onClick={loadMore} size='small' style={{ width: 90 }}>
          Load more
        </Button>
      </Space>
    )
  }

  // TODO: add proper cache
  async function loadData () {
    setLoading(true)
    setError('')
    try {
      // TODO: right now some transactions are not returned from this API, like those internal ones.
      const txs = await api.rpc.getTransactionHistory(fetchingAddress, fetchPageOptions.pageSize, fetchPageOptions.pageIndex)
      const allTxs = await Promise.all(txs.map(tx => api.rpc.getTransactionReceipt(tx).catch(e => {
        console.error(e)
        setError('Some error occured while fetching transactions, you may only see partial data here.')
        return tx
      })))
      setTxList(list => list.concat(allTxs.map(tx => {
        const { type, value } = getOperationInfo(tx, util.safeOneAddress(address))
        return {
          key: tx.hash,
          type,
          value,
          date: new Date(tx.timestamp * 1000).toLocaleDateString(),
          txId: tx.hash
        }
      })))
    } catch (e) {
      console.error(e)
      setError('Some error occured while parsing transactions.')
    }
    setLoading(false)
  }

  function loadMore () {
    fetchPageOptions.pageIndex++
    loadData()
  }

  function getColumnSearchProps (dataIndex) {
    return {
      filterDropdown ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) {
        return (
          <div style={{ padding: 8 }}>
            <Input
              ref={searchInput}
              placeholder={`Search ${dataIndex}`}
              value={selectedKeys[0]}
              onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
              onPressEnter={() => confirm()}
              style={{ marginBottom: 8, display: 'block' }}
            />
            <Space>
              <Button
                type='primary'
                onClick={() => confirm()}
                icon={<SearchOutlined />}
                size='small'
                style={{ width: 90 }}
              >
                Search
              </Button>
              <Button onClick={() => clearFilters()} size='small' style={{ width: 90 }}>
                Reset
              </Button>
            </Space>
          </div>
        )
      },
      filterIcon (filtered) { return <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} /> },
      onFilter (value, record) {
        return record[dataIndex]
          ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase())
          : ''
      },
      onFilterDropdownVisibleChange (visible) {
        if (visible) {
          setTimeout(() => searchInput.current.select(), 100)
        }
      },
    }
  }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      ...getColumnSearchProps('date'),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      ...getColumnSearchProps('type'),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      ...getColumnSearchProps('value'),
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
      },
      ...getColumnSearchProps('txId'),
    },
  ]

  return (
    <ConfigProvider renderEmpty={() => (
      <Text>No transaction found for this wallet.</Text>
    )}
    >
      <Table
        dataSource={txList}
        columns={columns}
        pagination={{ pageSize: PAGE_SIZE, hideOnSinglePage: true }}
        loading={loading}
        onChange={onChange}
        footer={showFooter ? footerRenderer : undefined}
      />
      {error && <Warning style={{ marginTop: '16px' }}>{error}</Warning>}
    </ConfigProvider>
  )
}
export default TransactionViewer
