import React from 'react'
import { Transition } from 'react-transition-group'
import styled from 'styled-components'
import { Card } from 'antd'
import { useWindowDimensions } from '../util'

const Section = styled(Card)`
  padding: 32px;
  position: ${props => props['data-show'] ? 'relative' : 'fixed'};
`

const defaultStyle = {
  transition: 'opacity 300ms ease-in-out',
  opacity: 0,
  position: 'relative',
}

const transitionStyles = {
  entering: { opacity: 1 },
  entered: { opacity: 1, zIndex: 1 },
  exiting: { opacity: 0 },
  exited: { opacity: 0, zIndex: 0 },
}

const AnimatedSection = ({ show = true, children, style, ...params }) => {
  const { isMobile } = useWindowDimensions()
  return (
    <Transition in={show} timeout={300}>
      {state => (
        <Section data-show={show} style={{ padding: isMobile ? 16 : 32, ...defaultStyle, ...transitionStyles[state], ...style }} {...params}>
          {children}
        </Section>
      )}
    </Transition>
  )
}

export default AnimatedSection
