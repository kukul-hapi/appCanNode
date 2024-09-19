var fs = require("fs");
var path = require("path");

function parseIP2Arr(ip) {
    var S = [], E = [];
    var iparr = ip.split("~");
    if (iparr.length > 1) {
        var arr = iparr[0].split(".");
        for (var i in arr)
            S[i] = parseInt(arr[i]);
        arr = iparr[1].split(".");
        for (var i in arr)
            E[i] = parseInt(arr[i]);
        return [S, E];
    } else {

        var arr = iparr[0].split(".");
        for (var i in arr) {
            if (arr[i] == "*") {
                S[i] = 0;
                E[i] = 255;
            } else {
                S[i] = E[i] = parseInt(arr[i]);
            }
        }
        return [S, E];
    }
    return null;
}

function parseIP(ip) {
    var arr = ip.split(".");
    var S = [];
    for (var i in arr)
        S[i] = parseInt(arr[i]);
    return S;
}

function compareIp(a, b) {
    LOG1("[meap_rm_service_cfg][compareIp]:", a, b);
    try {
        for (var i = 0; i < 4; i++) {
            if (a[i] > b[i])
                return 1;
            else if (a[i] < b[i])
                return -1;
        }
    } catch (e) {
        _ERROR("[meap_rm_service_cfg][compareIp][ERROR]:", e.message);
    }
    return 0;
}

function parseCfg(Context) {
    var context = Context;
    try {
        var serviceconfigpath = path.join(context.workpath, "service.json");
        var result = JSON.parse(fs.readFileSync(serviceconfigpath));
        //LOG5("[SRVCFG] JSON PARSE RESULT ",result);
        LOG3("[meap_rm_service_cfg][parseCfg] JSON PARSE RESULT ", result);

        context.Services = {};
        context.Options = {};
        context.SessionPool = {};
        try {
            process.env.TMP = result.meap.tmpdir ? result.meap.tmpdir : "c:/tmp";
            context.Options.Servers = [];
        } catch (e) {
            _ERROR("[meap_rm_service_cfg][parseCfg][ERROR]:" + e.message);
        }
        {
            var settings = result.meap.service;
            var serviceName = settings.name;
            var Service = {
                protocal: "HTTP",
                port: 13000,
                host: "0.0.0.0",
                secure: false,
                ippolicy: null,
                auth: null,
                timeout: 60,
                localhost: "0.0.0.0"
            };
            {
                if (settings.timeout)
                    Service.timeout = parseInt(settings.timeout) ? parseInt(settings.timeout) : 60;
                Service.secure = settings.secure;
                Service["switch"] = settings["switch"] ? settings["switch"] : "open";
                if (settings.host)
                    Service.host = settings.host;
                if (settings.port)
                    Service.port = settings.port;
                if (Service.protocal == "HTTPS") {
                    var keypath = path.join(context.configpath, settings.certificate.key);
                    var certpath = path.join(context.configpath, settings.certificate.cert);
                    if (settings.certificate.key.indexOf("/") == 0 || settings.certificate.key.indexOf("://") > 0) {
                        keypath = settings.certificate.key;
                    }
                    if (settings.certificate.cert.indexOf("/") == 0 || settings.certificate.cert.indexOf("://") > 0) {
                        certpath = settings.certificate.cert;
                    }
                    Service.cert = {
                        key: keypath,
                        cert: certpath
                    }
                }
                if (settings.secure) {
                    var auth = {type: settings.auth.type};
                    switch (settings.auth.type) {
                        case "basic":
                            auth.username = settings.auth.username;
                            auth.password = settings.auth.password;
                            break;
                        case "ssl":
                            auth.ca = path.join(context.configpath, settings.auth.ca);
                            if (settings.auth.ca.indexOf("/") == 0 || settings.auth.ca.indexOf("://") > 0) {
                                auth.ca = settings.auth.ca;
                            }
                            break;
                        default:
                            break;
                    }
                    Service.auth = auth;
                }
                if (settings["ip-policy"]) {
                    Service.ippolicy = settings["ip-policy"].type;
                    var hosts = settings["ip-policy"].host.split(";");
                    Service.hosts = [];
                    for (var i in hosts) {
                        var iprange = parseIP2Arr(hosts[i]);
                        if (iprange)
                            Service.hosts.push(iprange);
                    }
                }
                Service.projects = settings.projects;
            }

            context.Service = Service;
            LOG3("[meap_rm_service_cfg][parseCfg] SERVICE CONFIG ", Service);
        }
    } catch (e) {
        _ERROR("[meap_rm_service_cfg][parseCfg][ERROR]: Parse service config fail. " + e.message);
    }
}

exports.Runner = parseCfg;
exports.ParseIP = parseIP;
exports.CompareIP = compareIp;
