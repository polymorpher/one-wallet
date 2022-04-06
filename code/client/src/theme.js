export function getColorPalette (theme) {
  return {
    primaryTextColor: theme === 'dark' ? 'white' : 'black',
    secondaryTextColor: theme === 'dark' ? 'white' : '#4F5963',
    primaryBgColor: theme === 'dark' ? 'black' : 'white',
    secondaryBgColor: theme === 'dark' ? '#666' : '#fafafa',
    primaryBorderColor: theme === 'dark' ? '#fafafa' : '#555',
    secondaryBorderColor: '#d9d9d9'
  }
}
