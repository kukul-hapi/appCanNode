/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */
"use strict";

function findKey(obj, val) {
    for (var n in obj)
        if (obj[n] === val)
            return n;
}

var url = require('url'),
    compress = null;

try {
    compress = require("compress");
} catch (e) {
}

var Server = function (server, path, services, wsdl) {
    var self = this;
    this.services = services;
    this.wsdl = wsdl;

    return this;

    this.services = services;
    this.wsdl = wsdl;

    if (path[path.length - 1] !== '/')
        path += '/';
    wsdl.onReady(function (err) {
        var listeners = server.listeners('request').slice();

        server.removeAllListeners('request');
        server.addListener('request', function (req, res) {
            if (typeof self.authorizeConnection === 'function') {
                if (!self.authorizeConnection(req.connection.remoteAddress)) {
                    res.end();
                    return;
                }
            }
            var reqPath = url.parse(req.url).pathname;
            if (reqPath[reqPath.length - 1] !== '/')
                reqPath += '/';
            if (path === reqPath) {
                self._requestListener(req, res);
            } else {
                for (var i = 0, len = listeners.length; i < len; i++) {
                    listeners[i].call(this, req, res);
                }
            }
        });
    });
};

Server.prototype._requestListener = function (req, res) {
    var self = this;
    var reqParse = url.parse(req.url);
    var reqPath = reqParse.pathname;
    var reqQuery = reqParse.search;

    if (typeof self.log === 'function') {
        self.log("info", "Handling " + req.method + " on " + req.url);
    }

    if (req.method === 'GET') {
        if (reqQuery && reqQuery.toLowerCase() === '?wsdl') {
            if (typeof self.log === 'function') {
                self.log("info", "Wants the WSDL");
            }
            res.setHeader("Content-Type", "application/xml");
            res.write(self.wsdl.toXML());
        }
        res.end();
    } else if (req.method === 'POST') {
        res.setHeader('Content-Type', req.headers['content-type']);
        var chunks = [], gunzip;
        if (compress && req.headers["content-encoding"] === "gzip") {
            gunzip = new compress.Gunzip();
            gunzip.init();
        }
        req.on('data', function (chunk) {
            if (gunzip)
                chunk = gunzip.inflate(chunk, "binary");
            chunks.push(chunk);
        });
        req.on('end', function () {
            var xml = chunks.join('');
            var result;
            var error;
            if (gunzip) {
                gunzip.end();
                gunzip = null;
            }
            try {
                self._process(xml, req.url, function (result) {
                    res.write(result);
                    res.end();
                    if (typeof self.log === 'function') {
                        self.log("received", xml);
                        self.log("replied", result);
                    }
                });
            } catch (err) {
                error = err.stack || err;
                res.write(error);
                res.end();
                if (typeof self.log === 'function') {
                    self.log("error", error);
                }
            }
        });
    } else {
        res.end();
    }
};

Server.prototype._process = function (input, URL, callback, context) {
    var self = this,
        pathname = url.parse(URL).pathname.replace(/\/$/, ''),
        obj = this.wsdl.xmlToObject(input),
        body = obj.Body,
        bindings = this.wsdl.definitions.bindings, binding,
        methods, method, methodName,
        serviceName, portName;

    if (typeof self.authenticate === 'function') {
        if (!obj.Header || !obj.Header.Security) {
            throw new Error('[meap_soap_server][Server][_process][ERROR]:No security header');
        }
        if (!self.authenticate(obj.Header.Security)) {
            throw new Error('[meap_soap_server][Server][_process][ERROR]:Invalid username or password');
        }
    }

    if (typeof self.log === 'function') {
        self.log("info", "Attempting to bind to " + pathname);
    }

    // use port.location and current url to find the right binding
    binding = (function (self) {
        var services = self.wsdl.definitions.services;
        var firstPort;
        var name;
        for (name in services) {
            serviceName = name;
            var service = services[serviceName];
            var ports = service.ports;
            for (name in ports) {
                portName = name;
                var port = ports[portName];
                var portPathname = url.parse(port.location).pathname.replace(/\/$/, '');

                if (typeof self.log === 'function') {
                    self.log("info", "Trying " + portName + " from path " + portPathname);
                }

                if (portPathname === pathname)
                    return port.binding;

                // The port path is almost always wrong for genrated WSDLs
                if (!firstPort) {
                    firstPort = port;
                }
            }
        }
        return !firstPort ? void 0 : firstPort.binding;
    })(this);

    if (!binding) {
        throw new Error('Failed to bind to WSDL');
    }

    methods = binding.methods;

    if (binding.style === 'rpc') {
        methodName = Object.keys(body)[0];
        self._executeMethod({
            serviceName: serviceName,
            portName: portName,
            methodName: methodName,
            outputName: methodName + 'Response',
            args: body[methodName],
            style: 'rpc'
        }, callback, context);
    } else {
        var messageElemName = Object.keys(body)[0];
        var pair = binding.topElements[messageElemName];
        self._executeMethod({
            serviceName: serviceName,
            portName: portName,
            methodName: pair.methodName,
            outputName: pair.outputName,
            args: body[messageElemName],
            style: 'document'
        }, callback, context);
    }
};

Server.prototype._executeMethod = function (options, callback, context) {
    options = options || {};
    var self = this,
        method, body,
        serviceName = options.serviceName,
        portName = options.portName,
        methodName = options.methodName,
        outputName = options.outputName,
        args = options.args,
        style = options.style,
        handled = false;

    try {
        method = this.services[serviceName][portName][methodName];
    } catch (e) {
        return callback(this._envelope(''));
    }

    function handleResult(result) {
        if (handled)
            return;
        handled = true;

        if (style === 'rpc') {
            body = self.wsdl.objectToRpcXML(outputName, result, '', self.wsdl.definitions.$targetNamespace);
        } else {
            var element = self.wsdl.definitions.services[serviceName].ports[portName].binding.methods[methodName].output;
            body = self.wsdl.objectToDocumentXML(outputName, result, element.targetNSAlias, element.targetNamespace);
        }
        callback(self._envelope(body));
    }

    var result = method(args, handleResult, context);
    if (typeof result !== 'undefined') {
        handleResult(result);
    }
};

Server.prototype._envelope = function (body) {
    var defs = this.wsdl.definitions,
        ns = defs.$targetNamespace,
        encoding = '',
        alias = findKey(defs.xmlns, ns);
    var xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
        "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
        encoding +
        this.wsdl.xmlnsInEnvelope + '>' +
        "<soap:Body>" +
        body +
        "</soap:Body>" +
        "</soap:Envelope>";
    return xml;
};

Server.prototype.Runner = function (req, res, data, cb, context) {

    var self = this;
    var xml = data.toString();
    try {
        self._process(xml, req.url, function (result) {
            cb(0, result);
        }, context);
    } catch (e) {
        cb(-1, e.message);
    }

}

exports.Server = Server;
