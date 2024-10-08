

/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

"use strict";

var Client = require('./meap_soap_client').Client,
    Server = require('./meap_soap_server').Server,
    open_wsdl = require('./meap_soap_wsdl').open_wsdl,
    crypto = require('crypto'),
    WSDL = require('./meap_soap_wsdl').WSDL,
    https = require('https'),
    fs = require('fs');

var WSDL = require('./meap_soap_wsdl').WSDL;
var _wsdlCache = {};

function _requestWSDL(url, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    var wsdl = _wsdlCache[url];
    if (wsdl) {
        callback(null, wsdl);
    } else {
        open_wsdl(url, options, function (err, wsdl) {
            if (err)
                return callback(err);
            else
                _wsdlCache[url] = wsdl;
            callback(null, wsdl);
        });
    }
}

function createClient(url, options, callback, endpoint) {
    if (typeof options === 'function') {
        endpoint = callback;
        callback = options;
        options = {};
    }
    endpoint = options.endpoint || endpoint;
    _requestWSDL(url, options, function (err, wsdl) {
        callback(err, wsdl && new Client(wsdl, endpoint));
    });
}

function listen(server, pathOrOptions, services, xml) {
    var options = {},
        path = pathOrOptions;

    if (typeof pathOrOptions === 'object') {
        options = pathOrOptions;
        path = options.path;
        services = options.services;
        xml = options.xml;
    }

    var wsdl = new WSDL(xml || services, null, options);
    return new Server(server, path, services, wsdl);
}

function createServer(fpath, services, callback) {
    open_wsdl(fpath, {}, function (err, wsdl) {
        if (err)
            return callback(err);
        else
            _wsdlCache[fpath] = wsdl;
        callback(null, new Server(null, null, services, wsdl));
    });
}

function BasicAuthSecurity(username, password) {
    this._username = username;
    this._password = password;
}

BasicAuthSecurity.prototype.addHeaders = function (headers) {
    headers.Authorization = "Basic " + Buffer.alloc((this._username + ':' + this._password) || '').toString('base64');
};

BasicAuthSecurity.prototype.toXML = function () {
    return "";
};

function ClientSSLSecurity(pfx, pass) {
    this.passphrase = pass;
    this.pfx = fs.readFileSync(pfx);
}

ClientSSLSecurity.prototype.toXML = function (headers) {
    return "";
};

ClientSSLSecurity.prototype.addOptions = function (options) {
    options.pfx = this.pfx;
    options.passphrase = this.passphrase;
    options.agent = new https.Agent(options);
};

function WSSecurity(username, password, passwordType) {
    this._username = username;
    this._password = password;
    this._passwordType = passwordType || 'PasswordText';
}

var passwordDigest = function (nonce, created, password) {
    // digest = base64 ( sha1 ( nonce + created + password ) )
    var pwHash = crypto.createHash('sha1');
    var rawNonce = Buffer.alloc(nonce || '', 'base64').toString('binary');
    pwHash.update(rawNonce + created + password);
    var passwordDigest = pwHash.digest('base64');
    return passwordDigest;
};

WSSecurity.prototype.toXML = function () {
    // avoid dependency on date formatting libraries
    function getDate(d) {
        function pad(n) {
            return n < 10 ? '0' + n : n;
        }

        return d.getUTCFullYear() + '-'
            + pad(d.getUTCMonth() + 1) + '-'
            + pad(d.getUTCDate()) + 'T'
            + pad(d.getUTCHours()) + ':'
            + pad(d.getUTCMinutes()) + ':'
            + pad(d.getUTCSeconds()) + 'Z';
    }

    var now = new Date();
    var created = getDate(now);
    var expires = getDate(new Date(now.getTime() + (1000 * 600)));

    // nonce = base64 ( sha1 ( created + random ) )
    var nHash = crypto.createHash('sha1');
    nHash.update(created + Math.random());
    var nonce = nHash.digest('base64');

    return "<wsse:Security xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\">" +
        /*"<wsu:Timestamp wsu:Id=\"Timestamp-" + created + "\">" +
    "<wsu:Created>" + created + "</wsu:Created>" +
    "<wsu:Expires>" + expires + "</wsu:Expires>" +
    "</wsu:Timestamp>" +*/
        "<wsse:UsernameToken xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\" wsu:Id=\"SecurityToken-" + created + "\">" +
        "<wsse:Username>" + this._username + "</wsse:Username>" +
        (this._passwordType === 'PasswordText' ?
                "<wsse:Password>" + this._password + "</wsse:Password>"
                :
                "<wsse:Password Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest\">" + passwordDigest(nonce, created, this._password) + "</wsse:Password>"
        ) +
        "<wsse:Nonce EncodingType=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary\">" + nonce + "</wsse:Nonce>" +
        "<wsu:Created>" + created + "</wsu:Created>" +
        "</wsse:UsernameToken>" +
        "</wsse:Security>";
};

function run(option, callback, robot) {
    var sec = null;
    if (option.BasicAuth) {
        sec = new soap.BasicAuthSecurity(option.BasicAuth.username, option.BasicAuth.password);
    }
    if (option.ClientAuthentication) {
        sec = new soap.ClientSSLSecurity(option.ClientAuthentication.pfx, option.ClientAuthentication.pass);
    }
    if (option.WSSecurity) {
        sec = new soap.WSSecurity(option.WSSecurity.username, option.WSSecurity.password, option.WSSecurity.passtype);
    }
    LOG1("[meap_im_req_soap][run]:SOAP OPTION ", option, sec);
    soap.createClient(option.wsdl, function (err, client) {
        if (sec) {
            try {
                client.setSecurity(sec);
            } catch (e) {
                _ERROR("[meap_im_req_soap][run][ERROR]:SET SEC Fail " + e.message);
            }
        }
        if (option.soapHeader) {
            client.addSoapHeader(option.soapHeader);
        }

        //supportCookie
        client.setRobot(robot);
        client.setCookie(option.Cookie);
        //
        var fn = eval("client." + option.func);
        LOG3("[meap_im_req_soap][run]:RUN FUNCTION ", option.func, client.describe());
        if (fn) {
            fn(option.Params, function (err, data) {
                if (err) {
                    _ERROR("[meap_im_req_soap][run][ERROR]:RUNNING RESULT ", err);
                    callback(-1, {
                        'status': '15200',
                        'message': err
                    });
                } else {
                    LOG3("[meap_im_req_soap][run]:RUNNING RESULT DATA ", data);
                    callback(0, null, data);
                }
            });
        }
    });
}



exports.BasicAuthSecurity = BasicAuthSecurity;
exports.WSSecurity = WSSecurity;
exports.ClientSSLSecurity = ClientSSLSecurity;
exports.createClient = createClient;
exports.passwordDigest = passwordDigest;
exports.listen = listen;
exports.createServer = createServer;
exports.WSDL = WSDL;

exports.Runner = run;
