var CM = require("./meap_cacheman");
var util = require("util");
var crypto = require("crypto");
var qs = require("querystring");

function RBTContext(auth, Context, data) {
    //LOG1("[meap_rm_robot_context][RBTContext]:CREATE ROBOT AUTH-",auth," DATA-",data);
    var self = this;
    self.Context = Context;
    self.Auth = auth;
    self.Data = data;
    self.LogHeader = '[MAS-' + new Date().getTime() + ']:';
    return this;
}
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
RBTContext.prototype.createSession = function (Response, autoActive, expire) {
    var cookies = [];
    var m = crypto.createHash('md5');
    m.update(generateUUID());
    var session = m.digest('hex');
    cookies.push("MASSESSION=" + session + "; path=/");
    Response.setHeader("Set-Cookie", cookies);
    if (!this.Auth) {
        var _hrtime = process.hrtime();
        var _uuidstr = generateUUID() + new Date().getTime() + Math.random(1, 5);
        if (process.pid) {
            _uuidstr = process.pid + '.' + _uuidstr;
        }
        if (_hrtime) {
            _uuidstr = _uuidstr + '.' + _hrtime[1];
        }
        this.Auth = {sid: _uuidstr, session: session};
        if (autoActive != false)
            this.Context.authPush(this.Auth, expire, null);
        return _uuidstr;
    } else {
        this.Auth.session = session;
        if (autoActive != false)
            this.Context.authPush(this.Auth, expire, null);
        return this.Auth.sid;
    }
}

RBTContext.prototype.activeSession = function (expire) {
    if (this.Auth)
        this.Context.authPush(this.Auth, expire, null);
}

RBTContext.prototype.destroySession = function (req, Response) {
    if (this.Auth) {
        this.Auth.session = null;
        Response.setHeader("Set-Cookie", []);
        this.Context.authPop(this.Auth, null);
        //this.Context.CookieMan.removeCookie(this.Auth.sid);
    }

    return true;
}
RBTContext.prototype.verifySession = function (req) {
    if (!this.Auth.session) {
        return false;
    }
    //var cookies = qs.parse(req.headers.cookie,";","=");
    var cookies = qs.parse(req.headers.cookie.replace(/[ ]/g, ""), ";", "=");
    if (cookies["MASSESSION"] == this.Auth.session) {
        return true;
    }
    return false;
}

RBTContext.prototype.Set = function (key, value) {
    if (!this.Auth) return;
    LOG2("[meap_rm_robot_context][RBTContext][Set]:ROBOT SET ", key, value);
    var self = this;
    self.Context.RobotSet(self.Auth.appid, self.Auth.sid, key, value);
}
RBTContext.prototype.Get = function (key) {
    if (!this.Data) return;
    return this.Data["STORE" + key];
}
// RBTContext.prototype.resettime = function()
// {
// this.timeout = new Date((new Date()).valueOf()+7200000);
// return this;
// }
//
// RBTContext.prototype.outoftime = function()
// {
// return this.timeout.valueOf() < new Date().valueOf();
// }
RBTContext.prototype.attachCookie = function (req, cb) {
    //LOG2("[meap_rm_robot_context][RBTContext][attachCookie]:attachCookie");
    if (!this.Auth) return cb();
    this.Context.CookieMan.attachCookie(req, this.Auth.sid, cb);
}

RBTContext.prototype.getCookie = function (url, cb) {
    LOG2("[meap_rm_robot_context][RBTContext][getCookie]");
    if (!this.Auth) return cb(null);
    this.Context.CookieMan.getCookie(url, this.Auth.sid, cb);
}

RBTContext.prototype.saveCookie = function (res) {
    //LOG2("[meap_rm_robot_context][RBTContext][saveCookie]:saveCookie ");
    if (!this.Auth) return;
    this.Context.CookieMan.saveCookie(res, this.Auth.sid);
}

RBTContext.prototype.saveCookieEx = function (cookies, url) {
    //LOG2("[meap_rm_robot_context][RBTContext][saveCookieEx]:saveCookieEx ");
    if (!this.Auth) return;
    this.Context.CookieMan.saveCookieEx(cookies, url, this.Auth.sid);
}

RBTContext.prototype.getCacheCC = function (url, cb, st) {
    var self = this;

    self.Context.CacheMan.getCacheControl(url, st, function (err, obj) {
        if (!err) {
            if (obj) {
                var CC = JSON.parse(obj);
                if (CC.EXP) {
                    if ((new Date()) < (new Date(CC.EXP))) {
                        self.Context.CacheMan.getCache(url, st, function (err, obj) {
                            if (err)
                                cb("CHECK", CC);
                            else
                                cb("CACHE", obj);
                        })
                    } else
                        cb("CHECK", CC);
                } else {
                    cb("CHECK", CC);
                }
            } else
                cb("CHECK", {});
        } else {
            _ERROR("[meap_rm_robot_context][RBTContext][getCacheCC][ERROR]:", err);
        }
    });
}
RBTContext.prototype.getCache = function (url, st, cb) {
    var self = this;
    self.Context.CacheMan.getCache(url, st, function (err, obj) {
        if (err) {
            _ERROR("[meap_rm_robot_context][RBTContext][getCache][ERROR]:", err);
            cb("CHECK", {});
        } else {
            cb("CACHE", obj);
        }
    })
}
//////////////////////////////////////////////////////////////////////////////////////////////////
//
//				Manage the Public cache
//
//////////////////////////////////////////////////////////////////////////////////////////////////
RBTContext.prototype.savePublicCache = function (url, res, cache) {
    var CC = CM.CacheControl(res);
    LOG2("[meap_rm_robot_context][RBTContext][savePublicCache]:CC is ", CC);
    this.Context.CacheMan.saveCache(url, "public", CC, cache);
}
RBTContext.prototype.savePublicEXPCache = function (url, res, cache, expdate) {
    var CC = {EXP: expdate.toGMTString()};
    LOG2("[meap_rm_robot_context][RBTContext][savePublicEXPCache]:CC is ", CC);
    this.Context.CacheMan.saveCache(url, "public", CC, cache);
}
RBTContext.prototype.checkPublicCache = function (url, cb) {
    if (!cb)
        return;
    this.getCacheCC(url, cb, "public");
}
RBTContext.prototype.getPublicCache = function (url, cb) {
    if (!cb) return;
    var self = this;
    self.getCache(url, "public", cb);
}
//////////////////////////////////////////////////////////////////////////////////////////////////
//
//				Manage the Private cache
//
//////////////////////////////////////////////////////////////////////////////////////////////////
RBTContext.prototype.savePrivateCache = function (url, res, cache) {
    if (!this.Auth) return;
    if (!this.Auth.sid) return;
    var CC = CM.CacheControl(res);
    LOG2("[meap_rm_robot_context][RBTContext][savePrivateCache]:CC is ", CC, "--", this.Auth.sid);
    this.Context.CacheMan.saveCache(url, this.Auth.sid, CC, cache);
}
RBTContext.prototype.savePrivateEXPCache = function (url, res, cache, expdate) {
    if (!this.Auth) return;
    if (!this.Auth.sid) return;
    var CC = {EXP: expdate.toGMTString()};
    LOG2("[meap_rm_robot_context][RBTContext][savePrivateEXPCache]:CC is ", CC, "--", this.Auth.sid);
    this.Context.CacheMan.saveCache(url, this.Auth.sid, CC, cache);
}
RBTContext.prototype.checkPrivateCache = function (url, cb) {
    if (!this.Auth) return;
    if (!cb || !this.Auth.sid)
        return;
    LOG2("[meap_rm_robot_context][RBTContext][checkPrivateCache]:", this.Auth.sid);
    this.getCacheCC(url, cb, this.Auth.sid);
}
RBTContext.prototype.getPrivateCache = function (url, cb) {
    if (!this.Auth) return;
    if (!cb || !this.Auth.sid) return;
    var self = this;
    LOG2("[meap_rm_robot_context][RBTContext][getPrivateCache]:", this.Auth.sid);
    self.getCache(url, this.Auth.sid, cb);
}

RBTContext.prototype.Log = function () {
    if (!global.RobotLOG) return;
    console._stdout.write(this.LogHeader + '<' + new Date().toLocaleString() + '><' + this.CurrentInterface + '><LOG>:');
    console._stdout.write(util.format.apply(this, arguments) + '/>\n');
}
RBTContext.prototype.log = RBTContext.prototype.Log;

RBTContext.prototype.Info = function () {
    if (!global.RobotLOG) return;
    console._stdout.write(this.LogHeader + '<' + new Date().toLocaleString() + '><' + this.CurrentInterface + '><INFO>:');
    console._stdout.write(util.format.apply(this, arguments) + '/>\n');
}
RBTContext.prototype.info = RBTContext.prototype.Info;

RBTContext.prototype.Warn = function () {
    if (!global.RobotERR) return;
    console._stderr.write(this.LogHeader + '<' + new Date().toLocaleString() + '><' + this.CurrentInterface + '><WARNING>:');
    console._stderr.write(util.format.apply(this, arguments) + '/>\n');
}
RBTContext.prototype.warn = RBTContext.prototype.Warn;

RBTContext.prototype.Error = function () {
    if (!global.RobotERR) return;
    console._stderr.write(this.LogHeader + '<' + new Date().toLocaleString() + '><' + this.CurrentInterface + '><ERROR>:');
    console._stderr.write(util.format.apply(this, arguments) + '/>\n');
}
RBTContext.prototype.error = RBTContext.prototype.Error;

exports.RBTContext = RBTContext;
