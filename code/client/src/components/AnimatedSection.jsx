import React from 'react'
import { Transition } from 'react-transition-group'
import styled from 'styled-components'
import Button from 'antd/es/button'
import Card from 'antd/es/card'
import Space from 'antd/es/space'
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

const renderTabBar = (props) => {
  const panes = props.panes
  const activeKey = props.activeKey
  const { isMobile } = useWindowDimensions()
  return (
    <Space size={isMobile ? 'small' : 'middle'} wrap style={{ marginBottom: '24px', marginTop: '16px' }}>
      {
        panes.map((pane) => (
          <Button
            key={pane.key}
            type='text'
            onClick={(e) => props.onTabClick(pane.key, e)}
            size={isMobile ? 'small' : 'large'}
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

const AnimatedSection = ({ show = true, wide, children, style, ...params }) => {
  const { isMobile } = useWindowDimensions()
  return (
    <Transition in={show} timeout={300}>
      {state => (
        <Section
          data-show={show}
          headStyle={{
            padding: isMobile && 0,
            marginTop: isMobile ? -16 : 0,
          }}
          bodyStyle={{
            padding: isMobile ? 0 : 24,
            paddingTop: isMobile ? 12 : 24,
          }}
          tabProps={{ renderTabBar }}
          style={{
            padding: isMobile ? 16 : 32,
            maxWidth: wide ? 720 : 640,
            minHeight: wide ? 320 : undefined,
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
