
var xmlparser = require('./meap_xml');
var err = require("./meap_im_error");

var jsdom = null;
try {
    jsdom = global.Require("jsdom").jsdom;
} catch (e) {
    _ERROR("[meap_im_parser][ERROR]:LOAD JSDOM FAIL", e.message);
}
var xslt = require("./meap_xslt_bindings");

function parser(type, res, cb, param) {
    try {
        switch (type) {
            case "HTML": {
                LOG2("[meap_im_parser][parser]:HTML Start", (new Date()).valueOf());
                if (jsdom) {
                    var dom = jsdom(res, null, {
                        features: {
                            FetchExternalResources: false,
                            ProcessExternalResources: false,
                            SkipExternalResources: true,
                        }
                    });
                    var dt = new Date;
                    var anaobjname = "analyzeDOM-" + dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds();
                    global[anaobjname] = {};
                    analyzDOM(dom, global[anaobjname]);
                    cb(0, dom);
                } else
                    cb(-1, null);
                LOG2("[meap_im_parser][parser]:HTML end", (new Date()).valueOf());
            }
                break;
            case "XML":
                var json = xmlparser.toJson(res, {
                    object: true
                });
                LOG2("[meap_im_parser][parser]:XML TO JSON");
                cb(0, json);
                break;
            case "XSLT-H":
                try {
                    {
                        var ts = xslt.transformhtml(param, res, []);
                        LOG2("[meap_im_parser][parser]:HTML XSLT");
                        cb(0, ts);
                    }
                } catch (e) {
                    _ERROR("[meap_im_parser][parser][ERROR]: XSLT-H Transform Fail - ", e.message);
                    cb(-1, err.build(e));
                }
                break;
            case "XSLT-X":
                try {
                    {
                        var ts = xslt.transformxml(param, res, []);
                        LOG2("[meap_im_parser][parser]:XML XSLT ");
                        cb(0, ts);
                    }
                } catch (e) {
                    _ERROR("[meap_im_parser][parser][ERROR]: XSLT-X Transform Fail - ", e.message);
                    cb(-1, err.build(e));
                }
                break;
            default:
                LOG2("[meap_im_parser][parser][ERROR]: No Parser");
                cb(0, res);
                break;
        }
    } catch (e) {
        _ERROR("[meap_im_parser][parser][ERROR]:", e.message);
        cb(-1, err.build(e));
    }
}

function subString(src, start, end) {
    var s = src.indexOf(start);
    if (s < 0)
        return "";
    var e = src.indexOf(end, s) + end.length;
    if (e < 0)
        return "";
    return src.substring(s, e);
}

function analyzDOM(DOM, dest, htmlpath) {
    if (!htmlpath)
        htmlpath = "DOM";

    var attrs = DOM.attributes;
    if (attrs) {
        for (var i = 0; i < attrs.length; i++) {
            var attr = DOM.attributes[i];
            dest["attribute-" + i + "-" + attr.name] = {
                value: attr.value,
                valuePath: htmlpath + "." + "attributes[" + attr.name + "].value"
            };
        }
    }
    dest.tagName = DOM.nodeName;
    if (dest.tagName == "#text")
        dest.nodeValue = DOM.nodeValue;
    dest.nodeValuePath = htmlpath + ".nodeValue";
    var nodes = DOM.childNodes;
    if (nodes && nodes.length) {
        for (var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            dest["childNode-" + j + "-" + node.nodeName] = {};
            var p = htmlpath + ".childNodes[" + j + "]";
            analyzDOM(node, dest["childNode-" + j + "-" + node.nodeName], p);
        }
    }
}

exports.MakeXSL = xslt.readXsltString;
exports.analyzDOM = analyzDOM;
exports.Runner = parser;
exports.subString = subString;
