import React from 'react'
import { Transition } from 'react-transition-group'
import styled from 'styled-components'
import { Button, Card, Space } from 'antd'
import { useWindowDimensions } from '../util'

const Section = styled(Card)`
  padding: 32px;
  position: ${props => props['data-show'] ? 'relative' : 'fixed'};
`

const defaultStyle = {
  transition: 'opacity 300ms ease-in-out',
  opacity: 0,
}

const transitionStyles = {
  entering: { opacity: 1 },
  entered: { opacity: 1, zIndex: 1 },
  exiting: { opacity: 0 },
  exited: { opacity: 0, zIndex: 0 },
}

const mobileTabBar = (props) => {
  const panes = props.panes
  const activeKey = props.activeKey

  return (
    <Space size='small' wrap style={{ marginBottom: '20px', marginTop: '10px' }}>
      {
        panes.map((pane) => (
          <Button
            key={pane.key}
            type='text'
            onClick={(e) => props.onTabClick(pane.key, e)}
            size='small'
            style={{
              color: activeKey === pane.key ? '#1890ff' : '#000000',
              borderBottom: activeKey === pane.key ? '1px solid #1890ff' : 'none',
              background: 'none',
              boxShadow: 'none'
            }}
          >
            {pane.props.tab}
          </Button>
        ))
      }
    </Space>
  )
}

const AnimatedSection = ({ show = true, children, style, ...params }) => {
  const { isMobile } = useWindowDimensions()
  return (
    <Transition in={show} timeout={300}>
      {state => (
        <Section
          data-show={show}
          bodyStyle={{
            padding: isMobile ? 8 : 24
          }}
          tabProps={{
            renderTabBar: isMobile ? mobileTabBar : undefined
          }}
          style={{
            padding: isMobile ? 24 : 32,
            ...defaultStyle,
            ...transitionStyles[state],
            ...style
          }}
          {...params}
        >
          {children}
        </Section>
      )}
    </Transition>
  )
}

export default AnimatedSection
