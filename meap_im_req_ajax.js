/**
 * @author qinghua.zhao
 */
var sa = require("./meap_http");
var BUF = require("buffer");
var parser = require("./meap_im_parser");
// var Iconv = process.binding("./meap_iconv_bindings").Iconv;
var mime = require("./meap_im_fs_mime");

function bufparser(res, fn) {
    res.data = [];
    res.on('data', function (chunk) {
        res.data.push(chunk)
    });
    res.on('end', function () {
        res.text = BUF.Buffer.concat(res.data);
        fn();
    });
};

function run(option, callback, robot, pretreatment) {
    if (!callback) return;

    var req = sa(option.method ? option.method : "GET", option.url);
    if (option.Params) {
        //LOG1("[meap_im_req_ajax][run]:SET PARAMS");
        req.query(buildData(option.Prarms));
    }

    if (option.method && option.method.toLowerCase() == "post") {
        //LOG3("[meap_im_req_ajax][run]:POST ENCTYPE " ,option.Enctype);
        if (option.Enctype) {
            LOG3("[meap_im_req_ajax][run]:", option.Enctype);
            req.set("Content-Type", option.Enctype);
            //LOG3("[meap_im_req_ajax][run]:set ook");
        }
        switch (option.Enctype) {
            case "application/x-www-form-urlencoded":
                if (option.Body) {
                    var sdata = buildData(option.Body);
                    req.send(sdata);
                    LOG4("[AJAX] BODY ", sdata);
                }

                break;
            case "multipart/form-data":
                for (var part in option.Body) {
                    req.field(part, option.Body[part]);
                }
                for (var file in option.Files) {
                    if (!option.Files[file].contentType) {
                        var ext = require("path").extname(option.Files[file].name ? option.Files[file].name : option.Files[file].path);
                        ext = ext.substr(1);
                        option.Files[file].contentType = mime.types[ext];
                    }
                    req.attach(file, option.Files[file].path, option.Files[file].name ? option.Files[file].name : null, option.Files[file].contentType);
                }
                break;
            case "text/plain":
            case "application/json":
            default:

                req.send(option.Body);
                break;
        }
    }
    if (option.Headers) {
        req._Headers = option.Headers;
        for (var hindex in option.Headers) {
            req.set(hindex, option.Headers[hindex]);
        }
        LOG2("[meap_im_req_ajax][run]:SET HEADER ", option.Headers);
    }
    if (option.CacheControl) {
        for (var cindex in option.CacheControl) {
            switch (cindex) {
                case "LM":
                    req.set("If-Modified-Since", option.CacheControl[cindex]);
                    LOG3("[meap_im_req_ajax][run]:SET CC ", option.CacheControl[cindex]);
                    break;
                case "ETAG":
                    req.set("If-None-Match", option.CacheControl[cindex]);
                    LOG3("[meap_im_req_ajax][run]:SET CC ", option.CacheControl[cindex]);
                    break;
            }
        }
    }
    if (option.BasicAuth) {
        req.auth(option.BasicAuth.username, option.BasicAuth.password);
        LOG3("[meap_im_req_ajax][run]:SET BA ", option.BasicAuth.username, option.BasicAuth.password);
    }
    if (option.Redir !== undefined) {
        LOG3("[meap_im_req_ajax][run]:REDIR ", option.Redir);
        req.redirects(option.Redir);
    }
    if (option.CA) {
        LOG3("[meap_im_req_ajax][run]:CA ", option.CA);
        req.ca(option.CA[0], option.CA[1]);
    }
    if (option.ClientAuthentication) {
        req.ca(option.ClientAuthentication.pfx, option.ClientAuthentication.pass);
        LOG3("[meap_im_req_ajax][run]:SET CA ", option.ClientAuthentication.pfx, option.ClientAuthentication.pass);
    }
    {
        req.parse(bufparser);
    }

    req.buffer(true);
    try {

        if (option.Cookie && robot) {
            robot.attachCookie(req, worker);
        } else {
            worker(null);
        }
    } catch (e) {
        _ERROR("[meap_im_req_ajax][run][ERROR]:", e.message);
        callback(-1, {});
    }

    function worker(err) {
        if (option.Stream) {
            LOG3("[meap_im_req_ajax][run][worker]:STREAM DATA TO MOBILE");
            req.pipe(option.Stream, {}, function (err, res) {
                LOG3("[meap_im_req_ajax][run][worker]:STREAM DATA PIPE END");
                callback(err, res);
            });

        } else {
            req.end(function (err, res) {
                if (!err) {
                    LOG3("[meap_im_req_ajax][run][worker]:RESPONSE BUFFER ", res.text);
                    if (option.Cookie && robot)
                        robot.saveCookie(res);

                    if (option.Charset) {
                        LOG3("[meap_im_req_ajax][run][worker]:CONVERT CODE FROM [", option.Charset, "] TO UTF-8");
                        var dest = conv(res.text, option.Charset, 'UTF-8');
                        if (dest)
                            res.text = dest.toString();
                        else
                            res.text = res.text.toString();
                    } else
                        res.text = res.text.toString();
                    if (pretreatment)
                        res.text = pretreatment(res.text);
                    parser.Runner(option.Parser, res.text, function (code, data) {
                        if (!code) {
                            callback(err, res, data);
                        } else {
                            callback(err, res, null);
                        }
                    });
                } else {
                    _ERROR("[meap_im_req_ajax][run][worker][ERROR]:RESPONSE STATUS ", err);
                    callback(-1, err);
                }
            }, option.Cookie ? robot : null);
        }
    }
}
const iconv = require('iconv-lite');
function conv(data, src, dest) {
    // try {
    //     var conv = new Iconv(src, dest);
    //     var result = conv.convert(data);
    //     delete conv;
    //     return result;
    // } catch (e) {
    //     _ERROR("[meap_im_req_ajax][conv][ERROR]:CONVERT FAIL ", e.message);
    //     return null;
    // }
    try {
        // 将输入的数据从 src 编码转换为 dest 编码
        const convertedData = iconv.decode(iconv.encode(data, src), dest);
        return convertedData;
    } catch (e) {
        console.error("[meap_im_req_ajax][conv][ERROR]: CONVERT FAIL", e.message);
        return null;
    }
}

function encodeBuffer(buffer) {
    var data = "";
    for (var i = 0; i < buffer.length; i++) {
        data += "%" + buffer[i].toString(16);
    }
    return data;
}

function buildData(obj) {
    var sdata = "";
    for (var i in obj) {
        sdata += ("" + i + "=" + obj[i] + "&");
    }
    if (sdata) {
        sdata = sdata.substring(0, sdata.length - 1);
    }
    return sdata;
}

exports.Runner = run;
exports.Convert = conv;
exports.EncodeBuffer = encodeBuffer;
