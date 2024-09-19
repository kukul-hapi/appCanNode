/**
 * @author qinghua.zhao
 */
var REDIS = require("./meap_redis");
var server = "127.0.0.1";
var port = 6379;
var db = 0;

function sub(channel, callback, ready, timeout) {
    if (!timeout)
        timeout = 60;
    var state = false;
    var Client = REDIS.createClient(port, server);
    var timeout = setTimeout(function () {
        callback(-2, "listen msg time out");
        Client.end();
    }, timeout * 1000);
    Client.on("ready", function () {
        Client.subscribe("meap_msg_" + channel);
    });
    Client.on("error", function (e) {
        clearTimeout(timeout);
        if (!state)
            callback(-1, e.message);
    });
    Client.on("subscribe", function (channel, count) {
        if (ready)
            ready(0, channel, count);
    });
    Client.on("message", function (ch, message) {
        LOG3("[meap_im_msg][sub]:RECV MSG", ch, message);
        state = true;
        clearTimeout(timeout);
        if (("meap_msg_" + channel) === ch) {
            callback(0, message);
        }
        Client.unsubscribe();
        Client.quit();
    });
    Client.on("end", function () {
    });

}

function listener(channel, callback, ready) {
    var state = false;
    var Client = REDIS.createClient(port, server);
    Client.on("ready", function () {
        Client.subscribe("meap_msg_" + channel);
    });
    Client.on("error", function (e) {
        if (!state)
            callback(-1, e.message);
    });
    Client.on("subscribe", function (channel, count) {
        if (ready)
            ready(0, channel, count);
    });
    Client.on("message", function (ch, message) {
        LOG3("[meap_im_msg][sub]:RECV MSG", ch, message);
        state = true;
        if (("meap_msg_" + channel) === ch) {
            callback(0, message);
        }
    });
    Client.on("end", function () {
    });
    return Client;
}

function pub(channel, message, callback) {
    var Client = REDIS.createClient(port, server);
    Client.on("ready", function () {
        LOG3("[meap_im_msg][pub]:PUB READY ", "meap_msg_" + channel);
        Client.publish("meap_msg_" + channel, message);
        Client.quit();
    });
    Client.on("error", function (e) {
        callback(-1, e.message);
    });
    Client.on("end", function () {
    });
}

function init(option) {
    server = option.server ? option.server : "127.0.0.1";
    port = option.port ? option.port : 6379;
    db = option.db ? option.db : 0;
}

function client(callback, cip, cp, cdb) {
    var ip = cip || server;
    var po = cp || port
    var cd = cdb || db;
    var Client = REDIS.createClient(po, ip);
    Client.on("ready", function () {
        Client.select(cd, function () {
            callback(0, Client);
        });
    });
    Client.on("error", function (e) {
        callback(-1, e.message);
    });
}

exports.Subscribe = sub;
exports.Publish = pub;
exports.Client = client;
exports.Listener = listener;
exports.Init = init;
