var DailyLimit = artifacts.require('DailyLimit')
var Guardians = artifacts.require('Guardians')
var Recovery = artifacts.require('Recovery')

module.exports = function (deployer) {
  deployer.deploy(DailyLimit)
  deployer.deploy(Guardians)
  deployer.deploy(Recovery)
}
