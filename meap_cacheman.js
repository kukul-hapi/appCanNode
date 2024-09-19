var URL = require("url");
var Crypto = require("crypto");
global.CACHE = {};

function CacheControl(res) {
    var CC = {
        LM: res.headers["last-modified"], //If-Modified-Since
        ETAG: res.headers["etag"], //If-None-Match
        EXP: res.headers["expires"]
    }; //Expires
    return (CC.LM || CC.ETAG || CC.EXP) ? CC : null;
}

function CacheMan(Context) {
    LOG3("[meap_cacheman][CacheMan] CacheMan created ");
}

CacheMan.prototype.saveCache = function (url, st, cc, cache) {
    var m = Crypto.createHash('md5');
    m.update(url);
    var key = m.digest('hex');
    var item = {};
    item[st] = JSON.stringify(cc);
    item[st + "cache"] = cache;
    CACHE[key] = item;
    LOG3("[meap_cacheman][CacheMan][saveCache]", key, item);
}
CacheMan.prototype.getCacheControl = function (url, st, cb) {
    var self = this;
    var m = Crypto.createHash('md5');
    m.update(url);
    var key = m.digest('hex');
    if (CACHE[key])
        cb(0, CACHE[key].st);
    else
        cb(-1, null)
}
CacheMan.prototype.getCache = function (url, st, cb) {
    var self = this;
    var m = Crypto.createHash('md5');
    m.update(url);
    var key = m.digest('hex');
    if (CACHE[key])
        cb(0, CACHE[key][st + "cache"]);
    else
        cb(-1, null)
}
module.exports.CacheMan = CacheMan;
module.exports.CacheControl = CacheControl;

