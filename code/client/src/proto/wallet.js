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
    
    $root.InnerTree = (function() {
    
        /**
         * Properties of an InnerTree.
         * @exports IInnerTree
         * @interface IInnerTree
         * @property {Array.<Uint8Array>|null} [layers] InnerTree layers
         */
    
        /**
         * Constructs a new InnerTree.
         * @exports InnerTree
         * @classdesc Represents an InnerTree.
         * @implements IInnerTree
         * @constructor
         * @param {IInnerTree=} [properties] Properties to set
         */
        function InnerTree(properties) {
            this.layers = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }
    
        /**
         * InnerTree layers.
         * @member {Array.<Uint8Array>} layers
         * @memberof InnerTree
         * @instance
         */
        InnerTree.prototype.layers = $util.emptyArray;
    
        /**
         * Creates a new InnerTree instance using the specified properties.
         * @function create
         * @memberof InnerTree
         * @static
         * @param {IInnerTree=} [properties] Properties to set
         * @returns {InnerTree} InnerTree instance
         */
        InnerTree.create = function create(properties) {
            return new InnerTree(properties);
        };
    
        /**
         * Encodes the specified InnerTree message. Does not implicitly {@link InnerTree.verify|verify} messages.
         * @function encode
         * @memberof InnerTree
         * @static
         * @param {IInnerTree} message InnerTree message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InnerTree.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.layers != null && message.layers.length)
                for (var i = 0; i < message.layers.length; ++i)
                    writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.layers[i]);
            return writer;
        };
    
        /**
         * Encodes the specified InnerTree message, length delimited. Does not implicitly {@link InnerTree.verify|verify} messages.
         * @function encodeDelimited
         * @memberof InnerTree
         * @static
         * @param {IInnerTree} message InnerTree message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InnerTree.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };
    
        /**
         * Decodes an InnerTree message from the specified reader or buffer.
         * @function decode
         * @memberof InnerTree
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {InnerTree} InnerTree
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InnerTree.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.InnerTree();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    if (!(message.layers && message.layers.length))
                        message.layers = [];
                    message.layers.push(reader.bytes());
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };
    
        /**
         * Decodes an InnerTree message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof InnerTree
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {InnerTree} InnerTree
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InnerTree.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };
    
        /**
         * Verifies an InnerTree message.
         * @function verify
         * @memberof InnerTree
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        InnerTree.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.layers != null && message.hasOwnProperty("layers")) {
                if (!Array.isArray(message.layers))
                    return "layers: array expected";
                for (var i = 0; i < message.layers.length; ++i)
                    if (!(message.layers[i] && typeof message.layers[i].length === "number" || $util.isString(message.layers[i])))
                        return "layers: buffer[] expected";
            }
            return null;
        };
    
        /**
         * Creates an InnerTree message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof InnerTree
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {InnerTree} InnerTree
         */
        InnerTree.fromObject = function fromObject(object) {
            if (object instanceof $root.InnerTree)
                return object;
            var message = new $root.InnerTree();
            if (object.layers) {
                if (!Array.isArray(object.layers))
                    throw TypeError(".InnerTree.layers: array expected");
                message.layers = [];
                for (var i = 0; i < object.layers.length; ++i)
                    if (typeof object.layers[i] === "string")
                        $util.base64.decode(object.layers[i], message.layers[i] = $util.newBuffer($util.base64.length(object.layers[i])), 0);
                    else if (object.layers[i].length)
                        message.layers[i] = object.layers[i];
            }
            return message;
        };
    
        /**
         * Creates a plain object from an InnerTree message. Also converts values to other types if specified.
         * @function toObject
         * @memberof InnerTree
         * @static
         * @param {InnerTree} message InnerTree
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        InnerTree.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.layers = [];
            if (message.layers && message.layers.length) {
                object.layers = [];
                for (var j = 0; j < message.layers.length; ++j)
                    object.layers[j] = options.bytes === String ? $util.base64.encode(message.layers[j], 0, message.layers[j].length) : options.bytes === Array ? Array.prototype.slice.call(message.layers[j]) : message.layers[j];
            }
            return object;
        };
    
        /**
         * Converts this InnerTree to JSON.
         * @function toJSON
         * @memberof InnerTree
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        InnerTree.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };
    
        return InnerTree;
    })();
    
    $root.SimpleWalletExport = (function() {
    
        /**
         * Properties of a SimpleWalletExport.
         * @exports ISimpleWalletExport
         * @interface ISimpleWalletExport
         * @property {string|null} [address] SimpleWalletExport address
         * @property {boolean|null} [expert] SimpleWalletExport expert
         * @property {string|null} [state] SimpleWalletExport state
         * @property {Array.<Uint8Array>|null} [layers] SimpleWalletExport layers
         * @property {Array.<IInnerTree>|null} [innerTrees] SimpleWalletExport innerTrees
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
            this.layers = [];
            this.innerTrees = [];
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
         * SimpleWalletExport layers.
         * @member {Array.<Uint8Array>} layers
         * @memberof SimpleWalletExport
         * @instance
         */
        SimpleWalletExport.prototype.layers = $util.emptyArray;
    
        /**
         * SimpleWalletExport innerTrees.
         * @member {Array.<IInnerTree>} innerTrees
         * @memberof SimpleWalletExport
         * @instance
         */
        SimpleWalletExport.prototype.innerTrees = $util.emptyArray;
    
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
            if (message.expert != null && Object.hasOwnProperty.call(message, "expert"))
                writer.uint32(/* id 2, wireType 0 =*/16).bool(message.expert);
            if (message.state != null && Object.hasOwnProperty.call(message, "state"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.state);
            if (message.layers != null && message.layers.length)
                for (var i = 0; i < message.layers.length; ++i)
                    writer.uint32(/* id 4, wireType 2 =*/34).bytes(message.layers[i]);
            if (message.innerTrees != null && message.innerTrees.length)
                for (var i = 0; i < message.innerTrees.length; ++i)
                    $root.InnerTree.encode(message.innerTrees[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
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
                    message.expert = reader.bool();
                    break;
                case 3:
                    message.state = reader.string();
                    break;
                case 4:
                    if (!(message.layers && message.layers.length))
                        message.layers = [];
                    message.layers.push(reader.bytes());
                    break;
                case 5:
                    if (!(message.innerTrees && message.innerTrees.length))
                        message.innerTrees = [];
                    message.innerTrees.push($root.InnerTree.decode(reader, reader.uint32()));
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
            if (message.expert != null && message.hasOwnProperty("expert"))
                if (typeof message.expert !== "boolean")
                    return "expert: boolean expected";
            if (message.state != null && message.hasOwnProperty("state"))
                if (!$util.isString(message.state))
                    return "state: string expected";
            if (message.layers != null && message.hasOwnProperty("layers")) {
                if (!Array.isArray(message.layers))
                    return "layers: array expected";
                for (var i = 0; i < message.layers.length; ++i)
                    if (!(message.layers[i] && typeof message.layers[i].length === "number" || $util.isString(message.layers[i])))
                        return "layers: buffer[] expected";
            }
            if (message.innerTrees != null && message.hasOwnProperty("innerTrees")) {
                if (!Array.isArray(message.innerTrees))
                    return "innerTrees: array expected";
                for (var i = 0; i < message.innerTrees.length; ++i) {
                    var error = $root.InnerTree.verify(message.innerTrees[i]);
                    if (error)
                        return "innerTrees." + error;
                }
            }
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
            if (object.expert != null)
                message.expert = Boolean(object.expert);
            if (object.state != null)
                message.state = String(object.state);
            if (object.layers) {
                if (!Array.isArray(object.layers))
                    throw TypeError(".SimpleWalletExport.layers: array expected");
                message.layers = [];
                for (var i = 0; i < object.layers.length; ++i)
                    if (typeof object.layers[i] === "string")
                        $util.base64.decode(object.layers[i], message.layers[i] = $util.newBuffer($util.base64.length(object.layers[i])), 0);
                    else if (object.layers[i].length)
                        message.layers[i] = object.layers[i];
            }
            if (object.innerTrees) {
                if (!Array.isArray(object.innerTrees))
                    throw TypeError(".SimpleWalletExport.innerTrees: array expected");
                message.innerTrees = [];
                for (var i = 0; i < object.innerTrees.length; ++i) {
                    if (typeof object.innerTrees[i] !== "object")
                        throw TypeError(".SimpleWalletExport.innerTrees: object expected");
                    message.innerTrees[i] = $root.InnerTree.fromObject(object.innerTrees[i]);
                }
            }
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
            if (options.arrays || options.defaults) {
                object.layers = [];
                object.innerTrees = [];
            }
            if (options.defaults) {
                object.address = "";
                object.expert = false;
                object.state = "";
            }
            if (message.address != null && message.hasOwnProperty("address"))
                object.address = message.address;
            if (message.expert != null && message.hasOwnProperty("expert"))
                object.expert = message.expert;
            if (message.state != null && message.hasOwnProperty("state"))
                object.state = message.state;
            if (message.layers && message.layers.length) {
                object.layers = [];
                for (var j = 0; j < message.layers.length; ++j)
                    object.layers[j] = options.bytes === String ? $util.base64.encode(message.layers[j], 0, message.layers[j].length) : options.bytes === Array ? Array.prototype.slice.call(message.layers[j]) : message.layers[j];
            }
            if (message.innerTrees && message.innerTrees.length) {
                object.innerTrees = [];
                for (var j = 0; j < message.innerTrees.length; ++j)
                    object.innerTrees[j] = $root.InnerTree.toObject(message.innerTrees[j], options);
            }
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
