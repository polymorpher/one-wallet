import React from 'react'
import ReactDOM from 'react-dom'
import MainScreen from './MainScreen'
import 'bootstrap/dist/css/bootstrap.min.css';

function init () {
  ReactDOM.render(<MainScreen />, document.getElementById('root'))
}

init()
