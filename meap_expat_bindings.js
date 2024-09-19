const expat = require('node-expat');
const { EventEmitter } = require('events');
const { Writable } = require('stream');

class Parser extends Writable {
    constructor(encoding) {
        super();
        this.parser = new expat.Parser(encoding);
        this.emit = this.emit.bind(this);

        // 绑定 node-expat 解析器的事件到 this
        this.parser.on('startElement', (name, attrs) => {
            this.emit('startElement', name, attrs);
        });
        this.parser.on('endElement', (name) => {
            this.emit('endElement', name);
        });
        this.parser.on('text', (text) => {
            this.emit('text', text);
        });
        this.parser.on('error', (error) => {
            this.emit('error', error);
        });

        // 流 API 兼容
        this.writable = true;
        this.readable = true;
    }

    _write(chunk, encoding, callback) {
        try {
            this.parser.write(chunk);
            callback();
        } catch (err) {
            callback(err);
        }
    }

    _final(callback) {
        try {
            this.parser.end();
            callback();
        } catch (err) {
            callback(err);
        }
    }
}

// 导出 Parser 类
module.exports = { Parser };
