import Table from 'antd/es/table'
import ConfigProvider from 'antd/es/config-provider'
import Typography from 'antd/es/typography'
import Button from 'antd/es/button'
import Input from 'antd/es/input'
import Space from 'antd/es/space'
import React, { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { api } from '../../../../lib/api'
import config from '../../config'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import util from '../../util'

const { Text, Link } = Typography

const PAGE_SIZE = 10

const TransactionViewer = ({ address }) => {
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const [txList, setTxList] = useState([])
  const [loading, setLoading] = useState(true)
  const network = wallet.network
  const searchInput = useRef()
  const fetchPageOptions = useRef({ pageSize: 10, pageIndex: 0 }).current
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [showFooter, setShowFooter] = useState(false)

  useEffect(() => {
    if (!address) return
    loadData()
  }, [address])

  useEffect(() => {
    const totalPages = Math.ceil(txList.length / PAGE_SIZE)
    setShowFooter(!loading && hasMore && currentPage === totalPages)
  }, [loading, hasMore, currentPage])

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

  async function loadData () {
    setLoading(true)
    try {
      const txHashes = await api.explorer.getTransactionHistory(address, fetchPageOptions.pageSize, fetchPageOptions.pageIndex)
      if (txHashes.length < fetchPageOptions.pageSize) {
        setHasMore(false)
      }
      const allTxs = await Promise.all(txHashes.map(txHash => api.explorer.getTransaction(txHash)))
      const oneAddress = util.safeOneAddress(address)
      setTxList(list => list.concat(allTxs.map(tx => ({
        key: tx.hash,
        type: tx.to === oneAddress ? 'Receive' : tx.from === oneAddress ? 'Send' : 'Unknown',
        date: new Date(tx.timestamp * 1000).toLocaleDateString(),
        value: tx.value,
        txId: tx.hash
      }))))
    } catch (e) {}
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
        dataSource={txList} columns={columns} pagination={{ pageSize: PAGE_SIZE, hideOnSinglePage: true }} loading={loading} onChange={onChange} footer={showFooter ? footerRenderer : undefined}
      />
    </ConfigProvider>
  )
}
export default TransactionViewer
