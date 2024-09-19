var EventEmitter = require('events').EventEmitter;
var util = require('util');
// Only support nodejs v0.6 and on so no need to look for older module location
var Stream = require('stream').Stream;
var xml2js = require('xml2js'); // 引入 xml2js

var Parser = function (encoding) {
    // 设置默认的编码格式
    this.encoding = encoding || 'UTF-8';  // 默认使用 UTF-8 编码

    // 设置 xml2js 的解析选项
    this.options = {
        explicitArray: false,  // 配置项，根据需要进行调整
        trim: true,            // 去除文本节点的空格
        encoding: this.encoding // 添加编码选项
    };

    this.parser = new xml2js.Parser(this.options); // 使用 xml2js 的 Parser
    this.parser.on('startElement', (name, attrs) => {
        this.emit('startElement', name, attrs); // 触发自定义事件
    });

    // stream API
    this.writable = true;
    this.readable = true;
};
util.inherits(Parser, Stream);

Parser.prototype.parse = function (buf, isFinal) {
    return this.parser.parse(buf, isFinal);
};

Parser.prototype.setEncoding = function (encoding) {
    return this.parser.setEncoding(encoding);
};

Parser.prototype.getError = function () {
    return this.parser.getError();
};
Parser.prototype.stop = function () {
    return this.parser.stop();
};
Parser.prototype.pause = function () {
    return this.stop();
};
Parser.prototype.resume = function () {
    return this.parser.resume();
};

Parser.prototype.destroy = function () {
    this.parser.stop();
    this.end();
};

Parser.prototype.destroySoon = function () {
    this.destroy();
};

Parser.prototype.write = function (data) {
    var error, result;
    try {
        result = this.parse(data);
        if (!result)
            error = this.getError();
    } catch (e) {
        error = e;
    }
    if (error) {
        this.emit('error', error);
        this.emit('close');
    }
    return result;
};

Parser.prototype.end = function (data) {
    var error, result;
    try {
        result = this.parse(data || "", true);
        if (!result)
            error = this.getError();
    } catch (e) {
        error = e;
    }

    if (!error)
        this.emit('end');
    else
        this.emit('error', error);
    this.emit('close');
};

Parser.prototype.reset = function () {
    return this.parser.reset();
};
Parser.prototype.getCurrentLineNumber = function () {
    return this.parser.getCurrentLineNumber();
};
Parser.prototype.getCurrentColumnNumber = function () {
    return this.parser.getCurrentColumnNumber();
};
Parser.prototype.getCurrentByteIndex = function () {
    return this.parser.getCurrentByteIndex();
};

//Exports

exports.Parser = Parser;

exports.createParser = function (cb) {
    var parser = new Parser();
    if (cb) {
        parser.on('startElement', cb);
    }
    return parser;
};
