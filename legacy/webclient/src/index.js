import React from 'react'
import ReactDOM from 'react-dom'
import MainScreen from './MainScreen'
import './theme.scss'

function init () {
  ReactDOM.render(<MainScreen />, document.getElementById('root'))
}

init()
