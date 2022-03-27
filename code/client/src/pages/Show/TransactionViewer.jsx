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
import Tooltip from 'antd/es/tooltip'

const { Text, Link } = Typography
const getEventTypeColor = (eventType) => {
  if (eventType === 'success') {
    return 'green'
  } else if (eventType === 'error') {
    return 'red'
  }
  return undefined
}

const TransactionViewer = ({ address }) => {
  const [txList, setTxList] = useState([])
  const [loading, setLoading] = useState(true)
  const network = useSelector(state => state.global.network)
  const searchInput = useRef()

  const [pageSize] = useState(10)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [error, setError] = useState('')

  // useEffect(() => {
  //   setCurrentPage(0)
  // }, [pageSize])

  const loadMore = () => {
    setCurrentPage(e => e + 1)
    setLoading(true)
  }

  useEffect(() => {
    async function loadData () {
      setLoading(true)
      setError('')
      try {
        // TODO: right now some transactions are not returned from this API, like those internal ones.
        const txs = await api.rpc.getTransactionHistory({ address, pageSize, pageIndex: currentPage, fullTx: true })
        if (txs.length === 0) {
          console.log(currentPage, txs)
          setHasMore(false)
          return
        }
        const parsedTxs = await Promise.all(
          txs.map(tx => {
            const timestamp = ONEUtil.toBN(tx.timestamp).muln(1000).toNumber()
            return api.rpc.getTransactionReceipt(tx.hash)
              .then(receipt => {
                const events = parseTxLog(receipt.logs || [])
                return { ...tx, key: tx.hash, timestamp, events, status: receipt.status }
              })
              .catch(e => {
                console.error(tx, e)
                return { ...tx, key: tx.hash, timestamp, error: e.toString() }
              })
          })
        )
        setTxList(list => {
          console.log(parsedTxs[0].hash)
          const foundIndex = list.findIndex(e => e.hash === parsedTxs[0].hash)
          console.log(foundIndex, list.length, parsedTxs.length)
          if (foundIndex < 0) {
            return list.concat(parsedTxs)
          } else {
            const copy = list.slice()
            for (let i = 0; i < list.length; i++) {
              copy[foundIndex + i] = list[i]
            }
            return copy
          }
        })
      } catch (e) {
        console.error(e)
        setError('Failed to retrieve transactions.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [currentPage, pageSize, address])

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
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      defaultSortOrder: 'descend',
      render: (text, record) => {
        return new Date(record.timestamp).toLocaleString()
      }
    },
    {
      title: 'TxHash',
      dataIndex: 'hash',
      key: 'hash',
      render: (text) => {
        if (config.networks[network].explorer) {
          const link = config.networks[network].explorer.replace(/{{txId}}/, text)
          return <Link target='_blank' href={link} rel='noreferrer'>{text.substr(0, 8)}</Link>
        } else {
          return <Tooltip title={text}>{util.ellipsisAddress(text)}</Tooltip>
        }
      },
      ...getColumnSearchProps('txHash'),
    },
    {
      title: 'Events',
      dataIndex: 'events',
      key: 'events',
      // eslint-disable-next-line react/display-name
      render: (text, record) => {
        const { events: eventsOriginal, error, value, status, input } = record
        const events = eventsOriginal.slice()
        if (error) {
          return <Text>(failed to parse events - try refresh?)</Text>
        }
        const bnValue = ONEUtil.toBN(value)
        // we don't need to check whether `to === address`, because the wallet can never initiate a transaction by itself (therefore it cannot be `from` and can only be `to`)
        if (bnValue.gtn(0)) {
          events.unshift({ eventName: 'InboundExternalTransfer', amount: bnValue, color: 'green' })
        }
        if (ONEUtil.toBN(status).eqn(0)) {
          console.log(status, record)
          events.push({ eventName: '[Transaction Reverted]' })
        }
        if (input?.startsWith('0xe4e5b258')) {
          events.unshift({ eventName: '[Commit Transaction]' })
        }
        return (
          <Space direction='vertical'>
            {(events || []).map((e, i) => {
              let displayText = e.eventName
              if (e.message) {
                displayText += ` (${e.message})`
              }
              if (e.amount && e.eventName.includes('Token')) {
                displayText += ` (${e.amount} Token)`
              } else if (e.amount) {
                const oneAmount = ONEUtil.toOne(ONEUtil.toBN(e.amount))
                displayText += ` (${oneAmount} ONE)`
              }
              return <Text key={`${i}`} style={{ color: e.color || getEventTypeColor(e.type) }}>{displayText}</Text>
            })}
          </Space>
        )
      },
      ...getColumnSearchProps('events'),
    },
  ]

  function renderLoadMore () {
    return (
      <Space style={{ display: 'flex', justifyContent: 'center' }}>
        <Button type='link' onClick={loadMore} size='small' style={{ width: 90 }}>
          Load more
        </Button>
      </Space>
    )
  }

  return (
    <ConfigProvider renderEmpty={() => (
      <Text>No transaction found for this wallet.</Text>
    )}
    >
      <Table
        dataSource={txList}
        columns={columns}
        // pagination={{ pageSize: PAGE_SIZE, hideOnSinglePage: true }}
        pagination={false}
        loading={loading}
        footer={hasMore ? renderLoadMore : undefined}
      />
      {error && <Warning style={{ marginTop: '16px' }}>{error}</Warning>}
    </ConfigProvider>
  )
}
export default TransactionViewer
