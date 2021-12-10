import protobuf from 'protobufjs/light'
const Field = protobuf.Field

export function LocalExportMessage (properties) {
  protobuf.Message.call(this, properties)
}

Field.d(1, 'string')(LocalExportMessage.prototype, 'wallet')
Field.d(2, 'bytes', 'repeated')(LocalExportMessage.prototype, 'layers')
