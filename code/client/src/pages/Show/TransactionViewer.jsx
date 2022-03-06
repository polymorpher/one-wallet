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
import config from '../../config'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import util from '../../util'

const { Text, Link } = Typography

// https://api.hmny.io/#290797a1-2593-44ff-b284-6a4c06b3cb77
const OperationType = {
  Gas: 'Gas', // All submitted transactions will incur an implicit gas operation. However, some on-chain effects (such as undelegation payout, or cross-shard transaction payout) will not incur gas as it was paid by the submitted transaction that caused said effect.
  NativeTransfer: 'NativeTransfer', // This operation is for transferring native ONE tokens from one account to another in the same shard. All "NativeTransfer" operations come in pairs, one operation deducting an amount from an account, and the other operation crediting said amount to an account. Moreover, the 2 operations are related in one (and only one) direction.
  NativeCrossShardTransfer: 'NativeCrossShardTransfer', // his operation is for transferring native ONE tokens between different shards. Note that cross-shard transfer operations appear in pairs, but not in the same transaction/block. The first appearance will be on the submitted transaction on the source/from shard. The second appearance will be on the destination/to shard.
  ContractCreation: 'ContractCreation', // This operation creates/instantiates a smart contract. All "ContractCreation" operations come in pairs, one operation deducting the native ONE tokens from the sender's account, the other operation crediting said amount to the contract's account (as dictated by the contract instantiation code).
  Genesis: 'Genesis', // This is a special operation that is only valid for block 0. It indicates the initial funds of the shard.
  UndelegationPayout: 'UndelegationPayout', // This is a special operation that is only present on the last block of an Epoch. It represents any delegated/locked native ONE tokens that are refunded to an account.
  CreateValidator: 'CreateValidator', // This operation creates a validator on the Harmony network for the sender's account.
  EditValidator: 'EditValidator', // This operation edits the sender's validator information or election status (i.e: validator name and/or being eligible for election).
  Delegate: 'Delegate', // This operation delegates (or re-delegates from pending undelegations) native ONE tokens from the sender's account to a validator's account.
  Undelegate: 'Undelegate', // This operation removes delegation from a validator. Note that this operation does not immediately unlock the sender's tokens.
  CollectRewards: 'CollectRewards', // This operation credits all the staking rewards to the sender's account.
}

const PAGE_SIZE = 10

function formatOneValue (val) {
  const bi = BigInt(val) / BigInt(10 ** 14)
  return parseInt(bi.toString()) / 10000
}

function getOperationInfo (tx, address) {
  if (tx.value > 0 || !tx.operations) {
    return { value: formatOneValue(tx.value) + ' ONE', type: tx.to === address ? 'Receive' : tx.from === address ? 'Send' : 'Unknown' }
  }
  let meaningfulOp
  for (const op of tx.operations) {
    if (op.type === OperationType.Gas) continue
    if (op.type === OperationType.NativeTransfer && op.account.address === address) {
      meaningfulOp = op
    }
  }
  let opType
  let amount
  if (tx.operations?.length) {
    opType = tx.operations.find(op => op.type && op.type !== OperationType.Gas)?.type
  }
  if (!meaningfulOp) {
    opType = tx.to === address ? 'Receive' : tx.from === address ? 'Send' : 'Unknown'
    amount = { value: tx.value, currency: { symbol: 'ONE' } }
  } else {
    amount = meaningfulOp.amount
  }
  if (meaningfulOp.type === OperationType.NativeTransfer) {
    opType = meaningfulOp.amount.value < 0 ? 'Send' : 'Receive'
  } else {
    opType = meaningfulOp.type
  }
  return { type: opType, value: `${formatOneValue(Math.abs(amount.value))} ${amount.currency.symbol}` }
}

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
  const [error, setError] = useState('')

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
    setError('')
    try {
      // TODO: right now some transactions are not returned from this API, like those internal ones.
      const txs = await api.explorer.getTransactionHistory(address, fetchPageOptions.pageSize, fetchPageOptions.pageIndex)
      if (txs.length < fetchPageOptions.pageSize) {
        setHasMore(false)
      }
      const allTxs = await Promise.all(txs.map(tx => api.explorer.getTransaction(tx).catch(e => {
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
    } catch (e) {}
    setLoading(false)
    setError('Some error occured while parsing transactions.')
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
      {error && <Warning style={{ marginTop: '16px' }}>{error}</Warning>}
    </ConfigProvider>
  )
}
export default TransactionViewer
