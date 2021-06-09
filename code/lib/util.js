module.exports = {
  hexView: (ar) => {
    return ar.map(x => x.toString(16).padStart(2, '0')).join('')
  }
}
