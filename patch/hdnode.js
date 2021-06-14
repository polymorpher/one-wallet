"use strict";
/**
 * @packageDocumentation
 * @module harmony-account
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HDNode = void 0;
var tslib_1 = require("tslib");
var crypto_1 = require("@harmony-js/crypto");
var utils_1 = require("@harmony-js/utils");
var network_1 = require("@harmony-js/network");
var transaction_1 = require("@harmony-js/transaction");
var account_1 = require("./account");
var HDNode = /** @class */ (function () {
    function HDNode(provider, menmonic, index, addressCount, shardID, chainType, chainId, gasLimit, gasPrice) {
        if (provider === void 0) { provider = 'http://localhost:9500'; }
        if (index === void 0) { index = 0; }
        if (addressCount === void 0) { addressCount = 1; }
        if (shardID === void 0) { shardID = 0; }
        if (chainType === void 0) { chainType = utils_1.ChainType.Harmony; }
        if (chainId === void 0) { chainId = utils_1.ChainID.Default; }
        if (gasLimit === void 0) { gasLimit = '1000000'; }
        if (gasPrice === void 0) { gasPrice = '2000000000'; }
        this.provider = this.setProvider(provider);
        this.shardID = shardID;
        this.messenger = new network_1.Messenger(this.provider, chainType, chainId);
        this.messenger.setDefaultShardID(this.shardID);
        this.hdwallet = undefined;
        this.addresses = [];
        this.wallets = {};
        this.path = chainType === utils_1.ChainType.Harmony ? utils_1.HDPath : "m/44'/60'/0'/0/";
        this.index = index;
        this.addressCount = addressCount;
        if(menmonic) {
            this.getHdWallet(menmonic || HDNode.generateMnemonic());
        }
        this.gasLimit = gasLimit;
        this.gasPrice = gasPrice;
    }
    HDNode.isValidMnemonic = function (phrase) {
        if (phrase.trim().split(/\s+/g).length < 12) {
            return false;
        }
        return crypto_1.bip39.validateMnemonic(phrase);
    };
    HDNode.generateMnemonic = function () {
        return crypto_1.bip39.generateMnemonic();
    };
    HDNode.prototype.normalizePrivateKeys = function (mnemonic) {
        if (Array.isArray(mnemonic)) {
            return mnemonic;
        }
        else if (mnemonic && !mnemonic.includes(' ')) {
            return [mnemonic];
        }
        else {
            return false;
        }
    };
    HDNode.prototype.setProvider = function (provider) {
        if (utils_1.isHttp(provider) && typeof provider === 'string') {
            return new network_1.HttpProvider(provider);
        }
        else if (provider instanceof network_1.HttpProvider) {
            return provider;
        }
        else if (utils_1.isWs(provider) && typeof provider === 'string') {
            return new network_1.WSProvider(provider);
        }
        else if (provider instanceof network_1.WSProvider) {
            return provider;
        }
        else {
            throw new Error('provider is not recognized');
        }
    };
    HDNode.prototype.getHdWallet = function (mnemonic) {
        if (!HDNode.isValidMnemonic(mnemonic)) {
            throw new Error('Mnemonic invalid or undefined');
        }
        this.hdwallet = crypto_1.hdkey.fromMasterSeed(crypto_1.bip39.mnemonicToSeed(mnemonic));
        for (var i = this.index; i < this.index + this.addressCount; i++) {
            if (!this.hdwallet) {
                throw new Error('hdwallet is not found');
            }
            var childKey = this.hdwallet.derive("" + this.path + i);
            var prv = childKey.privateKey.toString('hex');
            var account = new account_1.Account(prv);
            var addr = account.checksumAddress;
            this.addresses.push(addr);
            this.wallets[addr] = account;
        }
    };
    // tslint:disable-next-line: ban-types
    HDNode.prototype.getAccounts = function (cb) {
        if (cb) {
            cb(null, this.addresses);
        }
        return this.addresses;
    };
    // tslint:disable-next-line: ban-types
    HDNode.prototype.getPrivateKey = function (address, cb) {
        if (!cb) {
            if (!this.wallets[address]) {
                throw new Error('Account not found');
            }
            else {
                return this.wallets[address].privateKey;
            }
        }
        if (!this.wallets[address]) {
            return cb('Account not found');
        }
        else {
            cb(null, this.wallets[address].privateKey);
        }
    };
    // tslint:disable-next-line: ban-types
    HDNode.prototype.signTransaction = function (txParams) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var from, accountNonce, to, gasLimit, gasPrice, value, nonce, data, prv, signerAccount, tx, signed;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        from = txParams.from ? crypto_1.getAddress(txParams.from).checksum : '0x';
                        return [4 /*yield*/, this.messenger.send(network_1.RPCMethod.GetAccountNonce, [from, 'latest'], 'hmy', this.shardID)];
                    case 1:
                        accountNonce = _a.sent();
                        to = txParams.to ? crypto_1.getAddress(txParams.to).checksum : '0x';
                        gasLimit = new utils_1.Unit('0').asWei().toWei();
                        if (txParams.gas !== undefined && utils_1.isHex(txParams.gas)) {
                            gasLimit = new utils_1.Unit(txParams.gas)
                                .asWei()
                                .toWei()
                                .lt(new utils_1.Unit(this.gasLimit).asWei().toWei())
                                ? new utils_1.Unit(txParams.gas).asWei().toWei()
                                : new utils_1.Unit(this.gasLimit).asWei().toWei();
                        }
                        if (txParams.gasLimit !== undefined && utils_1.isHex(txParams.gasLimit)) {
                            gasLimit = new utils_1.Unit(txParams.gasLimit)
                                .asWei()
                                .toWei()
                                .lt(new utils_1.Unit(this.gasLimit).asWei().toWei())
                                ? new utils_1.Unit(txParams.gasLimit).asWei().toWei()
                                : new utils_1.Unit(this.gasLimit).asWei().toWei();
                        }
                        gasPrice = new utils_1.Unit('0').asWei().toWei();
                        if (txParams.gasPrice !== undefined && utils_1.isHex(txParams.gasPrice)) {
                            gasPrice = new utils_1.Unit(txParams.gasPrice)
                                .asWei()
                                .toWei()
                                .lt(new utils_1.Unit(this.gasPrice).asWei().toWei())
                                ? new utils_1.Unit(txParams.gasPrice).asWei().toWei()
                                : new utils_1.Unit(this.gasPrice).asWei().toWei();
                        }
                        value = txParams.value !== undefined && utils_1.isHex(txParams.value) ? txParams.value : '0';
                        nonce = txParams.nonce !== undefined && utils_1.isHex(txParams.nonce)
                            ? Number.parseInt(utils_1.hexToNumber(txParams.nonce), 10)
                            : accountNonce.result;
                        data = txParams.data !== undefined && utils_1.isHex(txParams.data) ? txParams.data : '0x';
                        prv = this.wallets[from].privateKey;
                        signerAccount = new account_1.Account(prv, this.messenger);
                        tx = new transaction_1.Transaction(tslib_1.__assign(tslib_1.__assign({}, txParams), { from: from,
                            to: to,
                            gasLimit: gasLimit,
                            gasPrice: gasPrice,
                            value: value,
                            nonce: nonce,
                            data: data, shardID: this.shardID, chainId: this.messenger.chainId }), this.messenger, transaction_1.TxStatus.INTIALIZED);
                        return [4 /*yield*/, signerAccount.signTransaction(tx)];
                    case 2:
                        signed = _a.sent();
                        return [2 /*return*/, signed.getRawTransaction()];
                }
            });
        });
    };
    HDNode.prototype.getAddress = function (idx) {
        if (!idx) {
            return this.addresses[0];
        }
        else {
            return this.addresses[idx];
        }
    };
    HDNode.prototype.getAddresses = function () {
        return this.addresses;
    };
    HDNode.prototype.addByPrivateKey = function (privateKey) {
        var account = new account_1.Account(privateKey);
        var addr = account.checksumAddress;
        this.addresses.push(addr);
        this.wallets[addr] = account;
        return addr;
    };
    HDNode.prototype.setSigner = function (address) {
        var foundIndex = this.addresses.findIndex(function (value) { return value === address; });
        this.addresses.splice(foundIndex, 1);
        this.addresses.unshift(address);
    };
    return HDNode;
}());
exports.HDNode = HDNode;
//# sourceMappingURL=hdnode.js.map
