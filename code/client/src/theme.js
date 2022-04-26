/** Theme is only added for v2ui, for simplicity, the v1ui has no usage of theme. */
import { useSelector } from 'react-redux'

// Variables shared with ant theme system: https://ant.design/docs/react/customize-theme#Ant-Design-Less-variables
export const lightTheme = {
  primaryColor: 'red', // primary color for all components
  linkColor: '#1890ff', // link color
  successColor: '#52c41a', // success state color
  warningColor: '#faad14', // warning state color
  errorColor: '#f5222d', // error state color
  fontSizeBase: '14px', // major text font size
  headingColor: 'rgba(0, 0, 0, 0.85)', // heading text color
  textColor: 'rgba(0, 0, 0, 0.65)', // major text color
  textColorSecondary: 'rgba(0, 0, 0, 0.45)', // secondary text color
  disabledColor: 'rgba(0, 0, 0, 0.25)', // disable state color
  borderRadiusBase: '2px', // major border radius
  borderColorBase: '#d9d9d9', // major border color
  boxShadowBase: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)', // major shadow for layers
}

// TODO: define the schema for dark theme.
export const darkTheme = {
}

export function useTheme () {
  return useSelector(state => state.global.v2ui ? (state.global.theme ?? 'light') : 'dark')
}

// TODO: merge custom ones with ant variables, keep the list of custom variables as fewer as possible.
export function getColorPalette (theme) {
  return {
    ...(theme === 'dark' ? darkTheme : lightTheme),
    primaryTextColor: theme === 'dark' ? 'white' : 'black',
    secondaryTextColor: theme === 'dark' ? 'white' : '#4F5963',
    primaryBgColor: theme === 'dark' ? 'black' : 'white',
    secondaryBgColor: theme === 'dark' ? '#666' : '#fafafa',
    primaryBorderColor: theme === 'dark' ? '#fafafa' : '#555',
    secondaryBorderColor: '#d9d9d9',
    primaryButtonBgColor: theme === 'dark' ? '#666' : '#00ADE8',
    secondaryButtonBgColor: theme === 'dark' ? '#333' : '#4F5963',
    buttonTextColor: theme === 'dark' ? 'black' : 'white',
  }
}
