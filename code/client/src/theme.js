/** Theme is only added for v2ui, for simplicity, the v1ui has no usage of theme. */
import { useSelector } from 'react-redux'

// The theme colors contains:
// 1. The ant variables are supported through css variables, the list of all available ones:
// https://github.com/ant-design/ant-design/blob/master/components/style/themes/variable.less
// 2. custom variables that will be used in the jsx code.
export const lightTheme = {
  // Ant CSS variables
  primaryColor: '#1890ff',

  // custom variables
  primaryTextColor: 'black',
  secondaryTextColor: '#4F5963',
  primaryBgColor: 'white',
  secondaryBgColor: '#fafafa',
  primaryBorderColor: '#555',
  secondaryBorderColor: '#d9d9d9',
  primaryButtonBgColor: '#00ADE8',
  secondaryButtonBgColor: '#4F5963',
  buttonTextColor: 'white',
}

export const darkTheme = {
  // Ant CSS variables
  primaryColor: 'blue',

  // custom variables
  primaryTextColor: 'white',
  secondaryTextColor: 'white',
  primaryBgColor: 'black',
  secondaryBgColor: '#666',
  primaryBorderColor: '#fafafa',
  secondaryBorderColor: '#d9d9d9',
  primaryButtonBgColor: '#666',
  secondaryButtonBgColor: '#333',
  buttonTextColor: 'black',
}

export function useTheme () {
  return useSelector(state => state.global.v2ui ? (state.global.theme ?? 'light') : 'dark')
}

// TODO: merge custom ones with ant variables, keep the list of custom variables as fewer as possible.
export function getColorPalette (theme) {
  return theme === 'dark' ? darkTheme : lightTheme
}
