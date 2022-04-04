export function getPrimaryBorderColor (theme) {
  return theme === 'dark' ? '#fafafa' : '#555'
}

export function getPrimaryTextColor (theme) {
  return theme === 'dark' ? 'white' : 'black'
}

export function getColorPalette (theme) {
  return {
    primaryTextColor: theme === 'dark' ? 'white' : 'black',
    secondaryTextColor: theme === 'dark' ? 'white' : '#4F5963',
  }
}
