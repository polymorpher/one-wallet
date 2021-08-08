/*eslint-disable block-scoped-var, no-redeclare, no-control-regex, no-prototype-builtins*/
(function(global, factory) { /* global define, require, module */

    /* AMD */ if (typeof define === 'function' && define.amd)
        define(["protobufjs/minimal"], factory);

    /* CommonJS */ else if (typeof require === 'function' && typeof module === 'object' && module && module.exports)
        module.exports = factory(require("protobufjs/minimal"));

})(this, function($protobuf) {
    "use strict";

    // Common aliases
    var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;
    
    // Exported root namespace
    var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});
    
    $root.MigrationPayload = (function() {
    
        /**
         * Properties of a MigrationPayload.
         * @exports IMigrationPayload
         * @interface IMigrationPayload
         * @property {Array.<MigrationPayload.IOtpParameters>|null} [otpParameters] MigrationPayload otpParameters
         * @property {number|null} [version] MigrationPayload version
         * @property {number|null} [batchSize] MigrationPayload batchSize
         * @property {number|null} [batchIndex] MigrationPayload batchIndex
         * @property {number|null} [batchId] MigrationPayload batchId
         */
    
        /**
         * Constructs a new MigrationPayload.
         * @exports MigrationPayload
         * @classdesc Represents a MigrationPayload.
         * @implements IMigrationPayload
         * @constructor
         * @param {IMigrationPayload=} [properties] Properties to set
         */
        function MigrationPayload(properties) {
            this.otpParameters = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * MigrationPayload otpParameters.
         * @member {Array.<MigrationPayload.IOtpParameters>} otpParameters
         * @memberof MigrationPayload
         * @instance
         */
        MigrationPayload.prototype.otpParameters = $util.emptyArray;
    
        /**
         * MigrationPayload version.
         * @member {number} version
         * @memberof MigrationPayload
         * @instance
         */
        MigrationPayload.prototype.version = 0;
    
        /**
         * MigrationPayload batchSize.
         * @member {number} batchSize
         * @memberof MigrationPayload
         * @instance
         */
        MigrationPayload.prototype.batchSize = 0;
    
        /**
         * MigrationPayload batchIndex.
         * @member {number} batchIndex
         * @memberof MigrationPayload
         * @instance
         */
        MigrationPayload.prototype.batchIndex = 0;
    
        /**
         * MigrationPayload batchId.
         * @member {number} batchId
         * @memberof MigrationPayload
         * @instance
         */
        MigrationPayload.prototype.batchId = 0;
    
        /**
         * Creates a new MigrationPayload instance using the specified properties.
         * @function create
         * @memberof MigrationPayload
         * @static
         * @param {IMigrationPayload=} [properties] Properties to set
         * @returns {MigrationPayload} MigrationPayload instance
         */
        MigrationPayload.create = function create(properties) {
            return new MigrationPayload(properties);
        };
    
        /**
         * Encodes the specified MigrationPayload message. Does not implicitly {@link MigrationPayload.verify|verify} messages.
         * @function encode
         * @memberof MigrationPayload
         * @static
         * @param {IMigrationPayload} message MigrationPayload message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MigrationPayload.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.otpParameters != null && message.otpParameters.length)
                for (var i = 0; i < message.otpParameters.length; ++i)
                    $root.MigrationPayload.OtpParameters.encode(message.otpParameters[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.version != null && message.hasOwnProperty("version"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.version);
            if (message.batchSize != null && message.hasOwnProperty("batchSize"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.batchSize);
            if (message.batchIndex != null && message.hasOwnProperty("batchIndex"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.batchIndex);
            if (message.batchId != null && message.hasOwnProperty("batchId"))
                writer.uint32(/* id 5, wireType 0 =*/40).int32(message.batchId);
            return writer;
        };
    
        /**
         * Encodes the specified MigrationPayload message, length delimited. Does not implicitly {@link MigrationPayload.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MigrationPayload
         * @static
         * @param {IMigrationPayload} message MigrationPayload message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MigrationPayload.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a MigrationPayload message from the specified reader or buffer.
         * @function decode
         * @memberof MigrationPayload
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MigrationPayload} MigrationPayload
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MigrationPayload.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MigrationPayload();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    if (!(message.otpParameters && message.otpParameters.length))
                        message.otpParameters = [];
                    message.otpParameters.push($root.MigrationPayload.OtpParameters.decode(reader, reader.uint32()));
                    break;
                case 2:
                    message.version = reader.int32();
                    break;
                case 3:
                    message.batchSize = reader.int32();
                    break;
                case 4:
                    message.batchIndex = reader.int32();
                    break;
                case 5:
                    message.batchId = reader.int32();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };
    
        /**
         * Decodes a MigrationPayload message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MigrationPayload
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MigrationPayload} MigrationPayload
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MigrationPayload.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a MigrationPayload message.
         * @function verify
         * @memberof MigrationPayload
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        MigrationPayload.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.otpParameters != null && message.hasOwnProperty("otpParameters")) {
                if (!Array.isArray(message.otpParameters))
                    return "otpParameters: array expected";
                for (var i = 0; i < message.otpParameters.length; ++i) {
                    var error = $root.MigrationPayload.OtpParameters.verify(message.otpParameters[i]);
                    if (error)
                        return "otpParameters." + error;
                }
            }
            if (message.version != null && message.hasOwnProperty("version"))
                if (!$util.isInteger(message.version))
                    return "version: integer expected";
            if (message.batchSize != null && message.hasOwnProperty("batchSize"))
                if (!$util.isInteger(message.batchSize))
                    return "batchSize: integer expected";
            if (message.batchIndex != null && message.hasOwnProperty("batchIndex"))
                if (!$util.isInteger(message.batchIndex))
                    return "batchIndex: integer expected";
            if (message.batchId != null && message.hasOwnProperty("batchId"))
                if (!$util.isInteger(message.batchId))
                    return "batchId: integer expected";
            return null;
        };
    
        /**
         * Creates a MigrationPayload message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MigrationPayload
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MigrationPayload} MigrationPayload
         */
        MigrationPayload.fromObject = function fromObject(object) {
            if (object instanceof $root.MigrationPayload)
                return object;
            var message = new $root.MigrationPayload();
            if (object.otpParameters) {
                if (!Array.isArray(object.otpParameters))
                    throw TypeError(".MigrationPayload.otpParameters: array expected");
                message.otpParameters = [];
                for (var i = 0; i < object.otpParameters.length; ++i) {
                    if (typeof object.otpParameters[i] !== "object")
                        throw TypeError(".MigrationPayload.otpParameters: object expected");
                    message.otpParameters[i] = $root.MigrationPayload.OtpParameters.fromObject(object.otpParameters[i]);
                }
            }
            if (object.version != null)
                message.version = object.version | 0;
            if (object.batchSize != null)
                message.batchSize = object.batchSize | 0;
            if (object.batchIndex != null)
                message.batchIndex = object.batchIndex | 0;
            if (object.batchId != null)
                message.batchId = object.batchId | 0;
            return message;
        };
    
        /**
         * Creates a plain object from a MigrationPayload message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MigrationPayload
         * @static
         * @param {MigrationPayload} message MigrationPayload
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        MigrationPayload.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.otpParameters = [];
            if (options.defaults) {
                object.version = 0;
                object.batchSize = 0;
                object.batchIndex = 0;
                object.batchId = 0;
            }
            if (message.otpParameters && message.otpParameters.length) {
                object.otpParameters = [];
                for (var j = 0; j < message.otpParameters.length; ++j)
                    object.otpParameters[j] = $root.MigrationPayload.OtpParameters.toObject(message.otpParameters[j], options);
            }
            if (message.version != null && message.hasOwnProperty("version"))
                object.version = message.version;
            if (message.batchSize != null && message.hasOwnProperty("batchSize"))
                object.batchSize = message.batchSize;
            if (message.batchIndex != null && message.hasOwnProperty("batchIndex"))
                object.batchIndex = message.batchIndex;
            if (message.batchId != null && message.hasOwnProperty("batchId"))
                object.batchId = message.batchId;
            return object;
        };
    
        /**
         * Converts this MigrationPayload to JSON.
         * @function toJSON
         * @memberof MigrationPayload
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        MigrationPayload.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        /**
         * Algorithm enum.
         * @name MigrationPayload.Algorithm
         * @enum {string}
         * @property {number} ALGORITHM_UNSPECIFIED=0 ALGORITHM_UNSPECIFIED value
         * @property {number} ALGORITHM_SHA1=1 ALGORITHM_SHA1 value
         * @property {number} ALGORITHM_SHA256=2 ALGORITHM_SHA256 value
         * @property {number} ALGORITHM_SHA512=3 ALGORITHM_SHA512 value
         * @property {number} ALGORITHM_MD5=4 ALGORITHM_MD5 value
         */
        MigrationPayload.Algorithm = (function() {
            var valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "ALGORITHM_UNSPECIFIED"] = 0;
            values[valuesById[1] = "ALGORITHM_SHA1"] = 1;
            values[valuesById[2] = "ALGORITHM_SHA256"] = 2;
            values[valuesById[3] = "ALGORITHM_SHA512"] = 3;
            values[valuesById[4] = "ALGORITHM_MD5"] = 4;
            return values;
        })();
    
        /**
         * DigitCount enum.
         * @name MigrationPayload.DigitCount
         * @enum {string}
         * @property {number} DIGIT_COUNT_UNSPECIFIED=0 DIGIT_COUNT_UNSPECIFIED value
         * @property {number} DIGIT_COUNT_SIX=1 DIGIT_COUNT_SIX value
         * @property {number} DIGIT_COUNT_EIGHT=2 DIGIT_COUNT_EIGHT value
         */
        MigrationPayload.DigitCount = (function() {
            var valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "DIGIT_COUNT_UNSPECIFIED"] = 0;
            values[valuesById[1] = "DIGIT_COUNT_SIX"] = 1;
            values[valuesById[2] = "DIGIT_COUNT_EIGHT"] = 2;
            return values;
        })();
    
        /**
         * OtpType enum.
         * @name MigrationPayload.OtpType
         * @enum {string}
         * @property {number} OTP_TYPE_UNSPECIFIED=0 OTP_TYPE_UNSPECIFIED value
         * @property {number} OTP_TYPE_HOTP=1 OTP_TYPE_HOTP value
         * @property {number} OTP_TYPE_TOTP=2 OTP_TYPE_TOTP value
         */
        MigrationPayload.OtpType = (function() {
            var valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "OTP_TYPE_UNSPECIFIED"] = 0;
            values[valuesById[1] = "OTP_TYPE_HOTP"] = 1;
            values[valuesById[2] = "OTP_TYPE_TOTP"] = 2;
            return values;
        })();
    
        MigrationPayload.OtpParameters = (function() {
    
            /**
             * Properties of an OtpParameters.
             * @memberof MigrationPayload
             * @interface IOtpParameters
             * @property {Uint8Array|null} [secret] OtpParameters secret
             * @property {string|null} [name] OtpParameters name
             * @property {string|null} [issuer] OtpParameters issuer
             * @property {MigrationPayload.Algorithm|null} [algorithm] OtpParameters algorithm
             * @property {MigrationPayload.DigitCount|null} [digits] OtpParameters digits
             * @property {MigrationPayload.OtpType|null} [type] OtpParameters type
             * @property {number|Long|null} [counter] OtpParameters counter
             */
    
            /**
             * Constructs a new OtpParameters.
             * @memberof MigrationPayload
             * @classdesc Represents an OtpParameters.
             * @implements IOtpParameters
             * @constructor
             * @param {MigrationPayload.IOtpParameters=} [properties] Properties to set
             */
            function OtpParameters(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }
    
            /**
             * OtpParameters secret.
             * @member {Uint8Array} secret
             * @memberof MigrationPayload.OtpParameters
             * @instance
             */
            OtpParameters.prototype.secret = $util.newBuffer([]);
    
            /**
             * OtpParameters name.
             * @member {string} name
             * @memberof MigrationPayload.OtpParameters
             * @instance
             */
            OtpParameters.prototype.name = "";
    
            /**
             * OtpParameters issuer.
             * @member {string} issuer
             * @memberof MigrationPayload.OtpParameters
             * @instance
             */
            OtpParameters.prototype.issuer = "";
    
            /**
             * OtpParameters algorithm.
             * @member {MigrationPayload.Algorithm} algorithm
             * @memberof MigrationPayload.OtpParameters
             * @instance
             */
            OtpParameters.prototype.algorithm = 0;
    
            /**
             * OtpParameters digits.
             * @member {MigrationPayload.DigitCount} digits
             * @memberof MigrationPayload.OtpParameters
             * @instance
             */
            OtpParameters.prototype.digits = 0;
    
            /**
             * OtpParameters type.
             * @member {MigrationPayload.OtpType} type
             * @memberof MigrationPayload.OtpParameters
             * @instance
             */
            OtpParameters.prototype.type = 0;
    
            /**
             * OtpParameters counter.
             * @member {number|Long} counter
             * @memberof MigrationPayload.OtpParameters
             * @instance
             */
            OtpParameters.prototype.counter = $util.Long ? $util.Long.fromBits(0,0,false) : 0;
    
            /**
             * Creates a new OtpParameters instance using the specified properties.
             * @function create
             * @memberof MigrationPayload.OtpParameters
             * @static
             * @param {MigrationPayload.IOtpParameters=} [properties] Properties to set
             * @returns {MigrationPayload.OtpParameters} OtpParameters instance
             */
            OtpParameters.create = function create(properties) {
                return new OtpParameters(properties);
            };
    
            /**
             * Encodes the specified OtpParameters message. Does not implicitly {@link MigrationPayload.OtpParameters.verify|verify} messages.
             * @function encode
             * @memberof MigrationPayload.OtpParameters
             * @static
             * @param {MigrationPayload.IOtpParameters} message OtpParameters message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            OtpParameters.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.secret != null && message.hasOwnProperty("secret"))
                    writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.secret);
                if (message.name != null && message.hasOwnProperty("name"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
                if (message.issuer != null && message.hasOwnProperty("issuer"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.issuer);
                if (message.algorithm != null && message.hasOwnProperty("algorithm"))
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.algorithm);
                if (message.digits != null && message.hasOwnProperty("digits"))
                    writer.uint32(/* id 5, wireType 0 =*/40).int32(message.digits);
                if (message.type != null && message.hasOwnProperty("type"))
                    writer.uint32(/* id 6, wireType 0 =*/48).int32(message.type);
                if (message.counter != null && message.hasOwnProperty("counter"))
                    writer.uint32(/* id 7, wireType 0 =*/56).int64(message.counter);
                return writer;
            };
    
            /**
             * Encodes the specified OtpParameters message, length delimited. Does not implicitly {@link MigrationPayload.OtpParameters.verify|verify} messages.
             * @function encodeDelimited
             * @memberof MigrationPayload.OtpParameters
             * @static
             * @param {MigrationPayload.IOtpParameters} message OtpParameters message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            OtpParameters.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };
    
            /**
             * Decodes an OtpParameters message from the specified reader or buffer.
             * @function decode
             * @memberof MigrationPayload.OtpParameters
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {MigrationPayload.OtpParameters} OtpParameters
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            OtpParameters.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MigrationPayload.OtpParameters();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1:
                        message.secret = reader.bytes();
                        break;
                    case 2:
                        message.name = reader.string();
                        break;
                    case 3:
                        message.issuer = reader.string();
                        break;
                    case 4:
                        message.algorithm = reader.int32();
                        break;
                    case 5:
                        message.digits = reader.int32();
                        break;
                    case 6:
                        message.type = reader.int32();
                        break;
                    case 7:
                        message.counter = reader.int64();
                        break;
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };
    
            /**
             * Decodes an OtpParameters message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof MigrationPayload.OtpParameters
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {MigrationPayload.OtpParameters} OtpParameters
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            OtpParameters.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };
    
            /**
             * Verifies an OtpParameters message.
             * @function verify
             * @memberof MigrationPayload.OtpParameters
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            OtpParameters.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.secret != null && message.hasOwnProperty("secret"))
                    if (!(message.secret && typeof message.secret.length === "number" || $util.isString(message.secret)))
                        return "secret: buffer expected";
                if (message.name != null && message.hasOwnProperty("name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.issuer != null && message.hasOwnProperty("issuer"))
                    if (!$util.isString(message.issuer))
                        return "issuer: string expected";
                if (message.algorithm != null && message.hasOwnProperty("algorithm"))
                    switch (message.algorithm) {
                    default:
                        return "algorithm: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                        break;
                    }
                if (message.digits != null && message.hasOwnProperty("digits"))
                    switch (message.digits) {
                    default:
                        return "digits: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                        break;
                    }
                if (message.type != null && message.hasOwnProperty("type"))
                    switch (message.type) {
                    default:
                        return "type: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                        break;
                    }
                if (message.counter != null && message.hasOwnProperty("counter"))
                    if (!$util.isInteger(message.counter) && !(message.counter && $util.isInteger(message.counter.low) && $util.isInteger(message.counter.high)))
                        return "counter: integer|Long expected";
                return null;
            };
    
            /**
             * Creates an OtpParameters message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof MigrationPayload.OtpParameters
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {MigrationPayload.OtpParameters} OtpParameters
             */
            OtpParameters.fromObject = function fromObject(object) {
                if (object instanceof $root.MigrationPayload.OtpParameters)
                    return object;
                var message = new $root.MigrationPayload.OtpParameters();
                if (object.secret != null)
                    if (typeof object.secret === "string")
                        $util.base64.decode(object.secret, message.secret = $util.newBuffer($util.base64.length(object.secret)), 0);
                    else if (object.secret.length)
                        message.secret = object.secret;
                if (object.name != null)
                    message.name = String(object.name);
                if (object.issuer != null)
                    message.issuer = String(object.issuer);
                switch (object.algorithm) {
                case "ALGORITHM_UNSPECIFIED":
                case 0:
                    message.algorithm = 0;
                    break;
                case "ALGORITHM_SHA1":
                case 1:
                    message.algorithm = 1;
                    break;
                case "ALGORITHM_SHA256":
                case 2:
                    message.algorithm = 2;
                    break;
                case "ALGORITHM_SHA512":
                case 3:
                    message.algorithm = 3;
                    break;
                case "ALGORITHM_MD5":
                case 4:
                    message.algorithm = 4;
                    break;
                }
                switch (object.digits) {
                case "DIGIT_COUNT_UNSPECIFIED":
                case 0:
                    message.digits = 0;
                    break;
                case "DIGIT_COUNT_SIX":
                case 1:
                    message.digits = 1;
                    break;
                case "DIGIT_COUNT_EIGHT":
                case 2:
                    message.digits = 2;
                    break;
                }
                switch (object.type) {
                case "OTP_TYPE_UNSPECIFIED":
                case 0:
                    message.type = 0;
                    break;
                case "OTP_TYPE_HOTP":
                case 1:
                    message.type = 1;
                    break;
                case "OTP_TYPE_TOTP":
                case 2:
                    message.type = 2;
                    break;
                }
                if (object.counter != null)
                    if ($util.Long)
                        (message.counter = $util.Long.fromValue(object.counter)).unsigned = false;
                    else if (typeof object.counter === "string")
                        message.counter = parseInt(object.counter, 10);
                    else if (typeof object.counter === "number")
                        message.counter = object.counter;
                    else if (typeof object.counter === "object")
                        message.counter = new $util.LongBits(object.counter.low >>> 0, object.counter.high >>> 0).toNumber();
                return message;
            };
    
            /**
             * Creates a plain object from an OtpParameters message. Also converts values to other types if specified.
             * @function toObject
             * @memberof MigrationPayload.OtpParameters
             * @static
             * @param {MigrationPayload.OtpParameters} message OtpParameters
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            OtpParameters.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.secret = options.bytes === String ? "" : [];
                    object.name = "";
                    object.issuer = "";
                    object.algorithm = options.enums === String ? "ALGORITHM_UNSPECIFIED" : 0;
                    object.digits = options.enums === String ? "DIGIT_COUNT_UNSPECIFIED" : 0;
                    object.type = options.enums === String ? "OTP_TYPE_UNSPECIFIED" : 0;
                    if ($util.Long) {
                        var long = new $util.Long(0, 0, false);
                        object.counter = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.counter = options.longs === String ? "0" : 0;
                }
                if (message.secret != null && message.hasOwnProperty("secret"))
                    object.secret = options.bytes === String ? $util.base64.encode(message.secret, 0, message.secret.length) : options.bytes === Array ? Array.prototype.slice.call(message.secret) : message.secret;
                if (message.name != null && message.hasOwnProperty("name"))
                    object.name = message.name;
                if (message.issuer != null && message.hasOwnProperty("issuer"))
                    object.issuer = message.issuer;
                if (message.algorithm != null && message.hasOwnProperty("algorithm"))
                    object.algorithm = options.enums === String ? $root.MigrationPayload.Algorithm[message.algorithm] : message.algorithm;
                if (message.digits != null && message.hasOwnProperty("digits"))
                    object.digits = options.enums === String ? $root.MigrationPayload.DigitCount[message.digits] : message.digits;
                if (message.type != null && message.hasOwnProperty("type"))
                    object.type = options.enums === String ? $root.MigrationPayload.OtpType[message.type] : message.type;
                if (message.counter != null && message.hasOwnProperty("counter"))
                    if (typeof message.counter === "number")
                        object.counter = options.longs === String ? String(message.counter) : message.counter;
                    else
                        object.counter = options.longs === String ? $util.Long.prototype.toString.call(message.counter) : options.longs === Number ? new $util.LongBits(message.counter.low >>> 0, message.counter.high >>> 0).toNumber() : message.counter;
                return object;
            };
    
            /**
             * Converts this OtpParameters to JSON.
             * @function toJSON
             * @memberof MigrationPayload.OtpParameters
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            OtpParameters.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };
    
            return OtpParameters;
        })();
    
        return MigrationPayload;
    })();

    return $root;
});
