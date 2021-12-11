/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
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
    
    $root.SimpleWalletExport = (function() {
    
        /**
         * Properties of a SimpleWalletExport.
         * @exports ISimpleWalletExport
         * @interface ISimpleWalletExport
         * @property {string|null} [address] SimpleWalletExport address
         * @property {Uint8Array|null} [layers] SimpleWalletExport layers
         * @property {boolean|null} [expert] SimpleWalletExport expert
         * @property {string|null} [state] SimpleWalletExport state
         */
    
        /**
         * Constructs a new SimpleWalletExport.
         * @exports SimpleWalletExport
         * @classdesc Represents a SimpleWalletExport.
         * @implements ISimpleWalletExport
         * @constructor
         * @param {ISimpleWalletExport=} [properties] Properties to set
         */
        function SimpleWalletExport(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * SimpleWalletExport address.
         * @member {string} address
         * @memberof SimpleWalletExport
         * @instance
         */
        SimpleWalletExport.prototype.address = "";
    
        /**
         * SimpleWalletExport layers.
         * @member {Uint8Array} layers
         * @memberof SimpleWalletExport
         * @instance
         */
        SimpleWalletExport.prototype.layers = $util.newBuffer([]);
    
        /**
         * SimpleWalletExport expert.
         * @member {boolean} expert
         * @memberof SimpleWalletExport
         * @instance
         */
        SimpleWalletExport.prototype.expert = false;
    
        /**
         * SimpleWalletExport state.
         * @member {string} state
         * @memberof SimpleWalletExport
         * @instance
         */
        SimpleWalletExport.prototype.state = "";
    
        /**
         * Creates a new SimpleWalletExport instance using the specified properties.
         * @function create
         * @memberof SimpleWalletExport
         * @static
         * @param {ISimpleWalletExport=} [properties] Properties to set
         * @returns {SimpleWalletExport} SimpleWalletExport instance
         */
        SimpleWalletExport.create = function create(properties) {
            return new SimpleWalletExport(properties);
        };
    
        /**
         * Encodes the specified SimpleWalletExport message. Does not implicitly {@link SimpleWalletExport.verify|verify} messages.
         * @function encode
         * @memberof SimpleWalletExport
         * @static
         * @param {ISimpleWalletExport} message SimpleWalletExport message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SimpleWalletExport.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.address != null && Object.hasOwnProperty.call(message, "address"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.address);
            if (message.layers != null && Object.hasOwnProperty.call(message, "layers"))
                writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.layers);
            if (message.expert != null && Object.hasOwnProperty.call(message, "expert"))
                writer.uint32(/* id 3, wireType 0 =*/24).bool(message.expert);
            if (message.state != null && Object.hasOwnProperty.call(message, "state"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.state);
            return writer;
        };
    
        /**
         * Encodes the specified SimpleWalletExport message, length delimited. Does not implicitly {@link SimpleWalletExport.verify|verify} messages.
         * @function encodeDelimited
         * @memberof SimpleWalletExport
         * @static
         * @param {ISimpleWalletExport} message SimpleWalletExport message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SimpleWalletExport.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes a SimpleWalletExport message from the specified reader or buffer.
         * @function decode
         * @memberof SimpleWalletExport
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {SimpleWalletExport} SimpleWalletExport
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SimpleWalletExport.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.SimpleWalletExport();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.address = reader.string();
                    break;
                case 2:
                    message.layers = reader.bytes();
                    break;
                case 3:
                    message.expert = reader.bool();
                    break;
                case 4:
                    message.state = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };
    
        /**
         * Decodes a SimpleWalletExport message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof SimpleWalletExport
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {SimpleWalletExport} SimpleWalletExport
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SimpleWalletExport.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies a SimpleWalletExport message.
         * @function verify
         * @memberof SimpleWalletExport
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SimpleWalletExport.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.address != null && message.hasOwnProperty("address"))
                if (!$util.isString(message.address))
                    return "address: string expected";
            if (message.layers != null && message.hasOwnProperty("layers"))
                if (!(message.layers && typeof message.layers.length === "number" || $util.isString(message.layers)))
                    return "layers: buffer expected";
            if (message.expert != null && message.hasOwnProperty("expert"))
                if (typeof message.expert !== "boolean")
                    return "expert: boolean expected";
            if (message.state != null && message.hasOwnProperty("state"))
                if (!$util.isString(message.state))
                    return "state: string expected";
            return null;
        };
    
        /**
         * Creates a SimpleWalletExport message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof SimpleWalletExport
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {SimpleWalletExport} SimpleWalletExport
         */
        SimpleWalletExport.fromObject = function fromObject(object) {
            if (object instanceof $root.SimpleWalletExport)
                return object;
            var message = new $root.SimpleWalletExport();
            if (object.address != null)
                message.address = String(object.address);
            if (object.layers != null)
                if (typeof object.layers === "string")
                    $util.base64.decode(object.layers, message.layers = $util.newBuffer($util.base64.length(object.layers)), 0);
                else if (object.layers.length)
                    message.layers = object.layers;
            if (object.expert != null)
                message.expert = Boolean(object.expert);
            if (object.state != null)
                message.state = String(object.state);
            return message;
        };
    
        /**
         * Creates a plain object from a SimpleWalletExport message. Also converts values to other types if specified.
         * @function toObject
         * @memberof SimpleWalletExport
         * @static
         * @param {SimpleWalletExport} message SimpleWalletExport
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SimpleWalletExport.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.address = "";
                if (options.bytes === String)
                    object.layers = "";
                else {
                    object.layers = [];
                    if (options.bytes !== Array)
                        object.layers = $util.newBuffer(object.layers);
                }
                object.expert = false;
                object.state = "";
            }
            if (message.address != null && message.hasOwnProperty("address"))
                object.address = message.address;
            if (message.layers != null && message.hasOwnProperty("layers"))
                object.layers = options.bytes === String ? $util.base64.encode(message.layers, 0, message.layers.length) : options.bytes === Array ? Array.prototype.slice.call(message.layers) : message.layers;
            if (message.expert != null && message.hasOwnProperty("expert"))
                object.expert = message.expert;
            if (message.state != null && message.hasOwnProperty("state"))
                object.state = message.state;
            return object;
        };
    
        /**
         * Converts this SimpleWalletExport to JSON.
         * @function toJSON
         * @memberof SimpleWalletExport
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SimpleWalletExport.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        return SimpleWalletExport;
    })();

    return $root;
});
