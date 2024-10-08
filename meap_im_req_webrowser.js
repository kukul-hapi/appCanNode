/**
 * @author duhui
 */

var phantomjs = Require('phantom');
var sa = require("./meap_http");
var BUF = require("buffer");
var parser = require("./meap_im_parser");
// var Iconv = process.binding("meap_iconv_bindings").Iconv;
var mime = require("./meap_im_fs_mime");


function isArray(obj) {
    return (typeof obj == 'object') && obj.constructor == Array;
}

function isString(str) {
    return (typeof str == 'string') && str.constructor == String;
}

function isObject(obj) {
    return (typeof obj == 'object') && obj.constructor == Object;
}

function buildData(obj) {
    var sdata = "";
    for (var i in obj) {
        sdata += ("" + i + "=" + obj[i] + "&");
    }
    if (sdata) {
        sdata = sdata.substring(0, sdata.length - 1);
    }
    //LOG5("buildData: "+sdata);
    return sdata;
}

function queryComp(url, val) {
    var path = url;
    if ('string' != typeof val)
        val = qs.stringify(val);
    //LOG5("queryComp val: "+val);
    if (!val.length)
        return this;
    path += (~path.indexOf('?') ? '&' : '?') + val;
    //LOG5("queryComp: "+path);
    return path;
};

function bodyComp(data) {
    var obj = isObject(data);
    var req = this.request();
    var type = req.getHeader('Content-Type');
    var _data;

    // merge
    if (obj && isObject(this._data)) {
        for (var key in data) {
            this._data[key] = data[key];
        }
        // string
    } else if ('string' == typeof data) {
        // default to x-www-form-urlencoded
        type = req.getHeader('Content-Type');

        // concat &
        if ('application/x-www-form-urlencoded' == type) {
            this._data = this._data ? this._data + '&' + data : data;
        } else {
            this._data = (this._data || '') + data;
        }
    } else {
        this._data = data;
    }

    if (!obj)
        return this;

    // default to json
    return this;
};

function extend(des, src, override) {
    if (src instanceof Array) {
        for (var i = 0, len = src.length; i < len; i++)
            extend(des, src[i], override);
    }
    for (var i in src) {
        if (override || !(i in des)) {
            des[i] = src[i];
            //LOG5("extend : "+src[i]);
        }
    }
    return des;
}

function start(option, callback, robot, pretreatment) {
    if (!callback) return;

    LOG5("[meap_im_req_webrowser][start] enter");
    var method = option.method ? option.method : "GET";
    var url = option.url;
    var header = option.Headers;
    var path = url.substr(0, 7).toLowerCase() == "http://" ? url : "http://" + url;

    var headers = {};

    phantomjs.create(function (ph) {

        ph.createPage(function (page) {

            extend(headers, header);

            if (option.method && option.method.toLowerCase() == "post") {
                if (option.Enctype) {
                    extend(headers, {
                        "Content-Type": option.Enctype
                    });
                }
                switch (option.Enctype) {
                    case "application/x-www-form-urlencoded":
                        if (option.Body) {
                            var sdata = buildData(option.Body);
                            path = queryComp(path, sdata);
                        }

                        break;
                    case "multipart/form-data":
                        for (var part in option.Body) {
                            req.field(part, option.Body[part]);
                        }

                        break;
                    case "text/plain":
                    case "application/json":
                    default:
                        if (option.Body) {
                            var sdata = buildData(option.Body);
                            path = queryComp(path, sdata);
                        }
                        break;
                }
            }

            if (option.Cookie && robot) {
                robot.getCookie(path, function (cks) {
                    if (cks) {
                        LOG5("The robot cookies is : ", JSON.stringify(cks));

                        var obj = null;
                        if (isString(cks)) {
                            obj = JSON.parse(cks);
                        } else {
                            obj = cks;
                        }

                        if (isArray(obj)) {
                            for (var ck in obj) {
                                ph.addCookie(obj[ck].name, obj[ck].value, obj[ck].domain);
                            }
                        }

                        if (isObject(obj)) {
                            ph.addCookie(obj.name, obj.value, obj.domain);
                        }

                        ph.get("cookies", function (ret) {
                            LOG5("addCookie: ", JSON.stringify(ret));
                        });
                    } else {
                        LOG5("The robot cookies is : null");
                    }

                    if (option.Params) {
                        path = queryComp(path, buildData(option.Params));
                    }

                    for (var cindex in option.CacheControl) {
                        switch (cindex) {
                            case "LM":
                                extend(headers, {
                                    "If-Modified-Since": option.CacheControl[cindex]
                                });
                                break;
                            case "ETAG":
                                extend(headers, {
                                    "If-None-Match": option.CacheControl[cindex]
                                });
                                break;
                        }
                    }

                    if (option.BasicAuth) {
                        page.set('settings.userName', option.BasicAuth.username);
                        page.set('settings.password', option.BasicAuth.password);
                    }

                    //if(option.CA)
                    //{
                    //    LOG2("[meap_im_req_ajax][run] CA ",option.CA);
                    //
                    //    var p12 = fs.readFileSync(option.CA[0]);
                    //    var pw = option.CA[1];
                    //    extend(headers, {pfx:p12, passphrase:pw});
                    //}

                    if (option.ClientAuthentication) {
                        var user = option.ClientAuthentication.pfx;
                        var pass = option.ClientAuthentication.pass;

                        var str = Buffer.alloc(user + ':' + pass).toString('base64');
                        extend(headers, {
                            "Authorization": 'Basic ' + str
                        });

                    }

                    page.set('customHeaders', headers);
                    LOG5("headers: " + JSON.stringify(headers));
                    page.get('customHeaders', function (ret) {
                        LOG5("customHeaders: " + JSON.stringify(ret));
                    });

                    LOG5("page.open with path = " + path + " method = " + method);

                    page.set('onLoadFinished', function (status) {
                        LOG5('Status: ' + status);

                        // Check for page load success
                        if (status !== "success") {
                            LOG5("Unable to access network");

                            callback(-1, status, null, null);
                            ph.exit();
                        } else {
                            //page.uploadFile('input[name=image]',fname);
                            LOG5("page load success: ");

                            // Execute some DOM inspection within the context
                            //          page.evaluate(function(){
                            //            return document.title;
                            //          }, function(ret) {});

                            function cb(cks) {
                                LOG5("The return cookies is : " + JSON.stringify(cks));
                                if (cks.length > 0)
                                    robot.saveCookieEx(cks, url);
                            }

                            page.get('cookies', cb);
                            page.get('content', function (res) {
                                //callback(null, res, null, page);

                                if (pretreatment)
                                    res = pretreatment(res, page);
                                parser.Runner(option.Parser, res, function (code, data) {
                                    if (!code) {
                                        callback(null, res, data, page);
                                    } else {
                                        callback(null, res, null, page);
                                    }

                                    LOG5("[meap_im_req_webrowser][start] exit");

                                });


                            });

                        }

                    });

                    page.exit = function () {
                        LOG5("Page.exit.");
                        ph.exit();
                    }

                    page.libraryPath = process.env.NODE_PATH + "phantom";
                    page.jquery = "jquery-2.1.1.min.js";

                    page.open(encodeURI(path), method, {}, function (status) {
                        //LOG5('page.open: ' + status);
                    });


                });

            }


        });
    }, {
        dnodeOpts: {
            weak: false
        }
    });

}


exports.Runner = start;
