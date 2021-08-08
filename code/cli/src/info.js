import React from 'react'
import { Box, Text } from 'ink'
import { stringify } from './util'

const Info = ({ wallet }) => {
  const stringifiedWallet = wallet && stringify(wallet)
  return (
    <Box flexDirection='column'>
      <Text>{'-'.repeat(113)}</Text>
      {
      Object.keys(stringifiedWallet).map(k => {
        return (
          <Box key={k} flexDirection='column'>
            <Box>
              <Box width={30}><Text>{k} </Text></Box>
              <Text> | </Text>
              <Box width={80}><Text>{stringifiedWallet[k]}</Text></Box>
            </Box>
            <Text>{'-'.repeat(113)}</Text>
          </Box>
        )
      })
    }
    </Box>
  )
}

export default Info
