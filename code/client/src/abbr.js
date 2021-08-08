// Based on https://github.com/domharrington/js-number-abbreviate
(function (root) {
  'use strict'

  function NumberAbbreviate () {
    let units
    if (!(this instanceof NumberAbbreviate)) {
      // function usage: abbrev(n, decPlaces, units)
      const n = arguments[0]
      const decPlaces = arguments[1]
      units = arguments[2]
      const ab = new NumberAbbreviate(units)
      return ab.abbreviate(n, decPlaces)
    }
    // class usage: new NumberAbbreviate(units)
    units = arguments[0]
    this.units = units == null ? ['K', 'M', 'B', 'T'] : units
  }

  NumberAbbreviate.prototype._abbreviate = function (number, decPlaces) {
    decPlaces = Math.pow(10, decPlaces)
    for (let i = this.units.length - 1; i >= 0; i--) {
      const size = Math.pow(10, (i + 1) * 3)
      if (size <= number) {
        number = Math.round(number * decPlaces / size) / decPlaces
        if ((number === 1000) && (i < this.units.length - 1)) {
          number = 1
          i++
        }
        number += this.units[i]
        break
      }
    }
    return number
  }
  NumberAbbreviate.prototype.abbreviate = function (number, decPlaces) {
    const isNegative = number < 0
    const abbreviatedNumber = this._abbreviate(Math.abs(number), decPlaces || 0)
    return isNegative ? '-' + abbreviatedNumber : abbreviatedNumber
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NumberAbbreviate
  } else {
    root.NumberAbbreviate = NumberAbbreviate
  }
})(this)
