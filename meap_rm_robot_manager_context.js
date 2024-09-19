var AJAX = require('./meap_im_req_ajax');
var Config = require("./meap_rm_service_cfg");
var AppConfig = require("./meap_rm_application_cfg");
var IFConfig = require("./meap_rm_interface_cfg");
var RBTContext = require("./meap_rm_robot_context");
var p = require('path');
var os = require("os");
var url = require("url");
var q = require("querystring");
var CookieMan = require("./meap_cookieman").CookieMan;
var CacheMan = require("./meap_cacheman").CacheMan;

function RMContext(path) {
    LOG1("[meap_rm_robot_manager_context][RMContext]:CREATE RMCONTEXT");
    this.workpath = path;
    this.Filter = [];
    this.configpath = p.join(path, "");
    this.authPool = {};
    this.policies = {};
    this.apps = [];
    this.interfaces = {};
    Config.Runner(this);
    IFConfig.Runner(this);
    this.CookieMan = new CookieMan(this);
    this.CacheMan = new CacheMan(this);
    this.AuthPool = {};
}

RMContext.prototype.authPush = function (obj, expire, cb) {
    LOG2("[meap_rm_robot_manager_context][RMContext][authPush]:REG NEW MOBILE");
    var auth = this.AuthPool["auth~" + obj.sid];
    if (!auth)
        auth = this.AuthPool["auth~" + obj.sid] = {};
    auth["DATA"] = obj;
    auth["STATUS"] = 1;
    if (cb)
        cb(0);
}
RMContext.prototype.authRresh = function (Robot, appid, newsid, oldsid, cb) {
    var self = this;
    cb(0);
}
RMContext.prototype.authPop = function (obj, cb) {
    LOG2("[meap_rm_robot_manager_context][RMContext][authPop]:DES MOBILE");
    this.AuthPool["auth~" + obj.sid] = {}
    if (cb)
        cb(0);
}
RMContext.prototype.BuildRobot = function (appid, sid, cb, pub) {
    var self = this;
    if (pub) {
        cb(new RBTContext.RBTContext(null, self, null));
        return;
    }
    if (this.AuthPool["auth~" + sid]) {
        var obj = this.AuthPool["auth~" + sid].DATA;
        cb(new RBTContext.RBTContext(obj, self, this.AuthPool["auth~" + sid]));
    } else {
        var obj = {
            sid: sid,
            appid: appid
        };
        var auth = this.AuthPool["auth~" + obj.sid] = {};
        auth["DATA"] = obj;
        auth["STATUS"] = 1;
        cb(new RBTContext.RBTContext(obj, self, auth));
    }
}
RMContext.prototype.RobotSet = function (appid, sid, key, value) {
    var auth = this.AuthPool["auth~" + sid];
    if (auth) {
        auth["STORE" + key] = value;
    }
    LOG2("[meap_rm_robot_manager_context][RMContext][RobotSet]:", appid, sid, key, value);
}


RMContext.prototype.RobotGet = function (appid, sid, key, cb) {
    var auth = this.AuthPool["auth~" + sid];
    if (auth)
        return auth["STORE" + key];
    else
        return null;
    LOG2("[meap_rm_robot_manager_context][RMContext][RobotSet]:", appid, sid, key, value);
}

RMContext.prototype.Set = function (key, value, expire) {
    LOG2("[meap_rm_robot_manager_context][RMContext][Set]:", key);
}
RMContext.prototype.Get = function (key, cb) {
    cb(0, {});
    LOG2("[meap_rm_robot_manager_context][RMContext][Get]:", key);
}

RMContext.prototype.ExistRobot = function (appid, sid, cb) {
    var self = this;
    if (this.AuthPool["auth~" + sid])
        return true;
    else
        return false;
}
RMContext.prototype.checkIP = function (ServiceName, ip, index) {
    return true;
}
RMContext.prototype.checkBasic = function (ServiceName, request, index) {
    if (!index)
        index = 0;
    var service = this.Service;
    if (service) {
        if (service.secure && service.auth.type == "basic") {
            LOG3("[meap_rm_robot_manager_context][RMContext][checkBasic]:", request.getHeader("Authorization"), ("Basic " + Buffer.alloc((service.auth.username + ':' + service.auth.password) || '').toString('base64')));
            return (request.getHeader("Authorization") == ("Basic " + Buffer.alloc((service.auth.username + ':' + service.auth.password) || '').toString('base64')));
        } else
            return true;
    } else
        return false;
}

function checkFunctionPolicy(policy, cmd) {
    return true;
}

RMContext.prototype.checkApplication = function (request, param, Robot) {
    return true;
}
RMContext.prototype.handleReqURL = function (param, request) {
    //LOG2("[meap_rm_robot_manager_context][RMContext][handleReqURL]:",param);
    try {
        var nameSpace = global.nameSpace;
        if (nameSpace && param && (param.indexOf(nameSpace) > 0)) {
            param = param.replace(nameSpace + "/", "");
        } else {
            //_WARN("[meap_rm_robot_manager_context][RMContext][handleReqURL][WARNING]:nameSpace or param is not valid");
        }
        var urlobj = url.parse(param);

        var path = urlobj.pathname.split("/");
        var res = {
            appid: path[1],
            sid: path[2],
            type: path[3],
            cmd: path.slice(3).join("/"),
            params: q.parse(urlobj.query),
            path: path.slice(4).join("/"),
            tree: path.slice(4)
        };
        if (!this.interfaces[res.type]) {
            res.appid = "";
            res.sid = "public";
            res.type = path[1];
            res.cmd = path.slice(1).join("/");
            res.path = path.slice(2).join("/");
            res.params = q.parse(urlobj.query);
            res.tree = path.slice(2);
        }
        return this.matchInterface(res, request);
    } catch (e) {
        return null;
    }
    return null;
}
RMContext.prototype.matchInterface = function (res, request) {
    var ifs = this.interfaces[res.type];
    var method = request.method.toLowerCase();
    if (ifs) {
        if (ifs[method + "~" + res.path]) {
            res.i_f = ifs[method + "~" + res.path];
            return res;
        } else if (ifs["all~" + res.path]) {
            res.i_f = ifs["all~" + res.path];
            return res;
        }
        for (var i in ifs) {
            var ipath = ifs[i].tree;
            var baas = {};
            var i_f = ifs[i];
            if (i_f.method != method && i_f.method != "all") continue;
            if (res.tree.length != ipath.length) continue;
            for (var j in res.tree) {
                try {
                    if (res.tree[j] == ipath[j]) continue;
                    if (ipath[j][0] == '$') {
                        var param = ipath[j].match(/\$\{(.+)\}$/)
                        baas[param[1]] = res.tree[j];
                        continue;
                    }
                } catch (e) {
                }
                i_f = null;
                break;
            }
            if (i_f) {
                res.i_f = i_f;
                res.baas = baas;
                return res;
            }
        }
        res.i_f = (ifs["get~default"] || ifs["post~default"] || ifs["all~default"]);
    } else {
        return {};
    }
    return res;
}
exports.Context = RMContext;
