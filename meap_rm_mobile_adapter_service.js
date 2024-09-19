
var http = require("http");
var https = require("https");
var url = require("url");
var fs = require("fs");
var qs = require("querystring");
var formidable = require('./meap_form');
var servicename = "mobile_adapter_service";
var sessionPool = require('./meap_sessionpool').sessionPool;
var RBTContext = require("./meap_rm_robot_context").RBTContext;

var handler = {}
handler["MASAuth"] = auth;

function auth(param, Context, Response) {
    if (!NORF) {
        response.end();
        return;
    }
    //param.sid = Math.uuid(32, 16);
    param.sid = getuuid();
    LOG1("[meap_rm_mobile_adapter_service][auth]:CREATE A NEW UUID ", param.sid);
    Context.authPush(param, function (err) {
        if (!err) {
            Response.write(JSON.stringify({
                status: 0,
                uuid: param.sid
            }));
        } else {
            _ERROR("[meap_rm_mobile_adapter_service][auth][ERROR]:", e.message);
            Response.write(JSON.stringify({
                status: 17100,
                message: "Request UUID Fail"
            }));
        }
        Response.end();
    })
}

//author yinjitao  for more process service on masServer
function getuuid() {
    var _hrtime = process.hrtime();
    var _uuidstr = Math.uuid(32, 32) + new Date().getTime() + Math.random(1, 5);
    if (process.pid) {
        _uuidstr = process.pid + '.' + _uuidstr;
    }
    if (_hrtime) {
        _uuidstr = _uuidstr + '.' + _hrtime[1];
    }
    return _uuidstr;
}

function buildServer(Context, config, index) {
    LOG1("[meap_rm_mobile_adapter_service][buildServer]:START SERVICE ", config, index);

    function onRequest(request, response) {
        if (request.url == "/favicon.ico") return false;

        LOG("\r\n\r\n[MAS] *******************************A NEW REQUEST******************************************");
        var param = Context.handleReqURL(request.url, request);
        if (param) {
            var authinfo = request.headers['x-mas-auth-info'] || request.headers['x-mas-app-info']
            if (authinfo) {
                var path = authinfo.split("/");
                if (path.length == 1)
                    param.sid = path[0];
                else {
                    param.appid = path[0];
                    param.sid = path[1];
                }
            } else if (request.headers.cookie) {
                var cookies = qs.parse(request.headers.cookie.replace(/[ ]/g, ""), ";", "=");
                var authinfo = cookies['x-mas-auth-info'] || cookies['x-mas-app-info'];
                if (authinfo && authinfo != "null") {
                    var path = authinfo.split("/");
                    if (path.length == 1)
                        param.sid = path[0]
                    else {
                        param.appid = path[0];
                        param.sid = path[1];
                    }
                }
                cookies['x-mas-app-id'] ? param.appid = cookies['x-mas-app-id'] : '';
            }
            request.headers['x-mas-app-id'] ? param.appid = request.headers['x-mas-app-id'] : '';
        } else
            param = null;
        LOG3("[meap_rm_mobile_adapter_service][buildServer][onRequest]:REQ PARAM ", param);

        if (!param) {
            _ERROR("[meap_rm_mobile_adapter_service][buildServer][onRequest][ERROR]:The Request URL format is wrong");
            response.write(JSON.stringify({
                status: 14400,
                message: "The Request URL format is wrong"
            }));
            response.end();
            return;
        }
        if (config.secure && config.auth.type == "ssl") {
            if (!request.client.authorized) {
                LOG3("[meap_rm_mobile_adapter_service][buildServer][onRequest]:HTTPS AUTH FAIL");
                response.writeHead(200, {
                    "Content-Type": "application/json"
                });
                response.end('{"status":"14200","message":"Your cret is fail"}');
                return;
            } else {
                var Cert = request.client.getPeerCertificate();
                LOG3("[meap_rm_mobile_adapter_service][buildServer][onRequest]:CERT CN & APPID ", Cert.subject.CN, param.appid);
            }
        }

        if (!Context.checkBasic(servicename, request, index)) {
            LOG3("[meap_rm_mobile_adapter_service][buildServer][onRequest]:BASIC AUTH FAIL");
            response.write(JSON.stringify({
                "status": "14300",
                "message": "Your Basic Auth is permission denied!"
            }));
            response.end();
        } else {
            //LOG3("[meap_rm_mobile_adapter_service][buildServer][onRequest]:ROUTE TO INTERFACE");
            route(param, Context, request, response, index);
        }
    }

    try {
        var server;
        if (config.protocal == "HTTPS") {
            var option = {
                key: fs.readFileSync(config.cert.key),
                cert: fs.readFileSync(config.cert.cert)
            }
            if (config.secure && config.auth.type == "ssl") {
                option.requestCert = true;
                option.rejectUnauthorized = false;
                option.ca = fs.readFileSync(config.auth.ca);
            }
            LOG2("[meap_rm_mobile_adapter_service][buildServer][onRequest]:HTTPS OPTION ", option);
            server = https.createServer(option, onRequest).listen(config.port, config.host);
        } else
            server = http.createServer(onRequest).listen(config.port, config.host);
        //listener[config.port] = server;
        LOG1("[meap_rm_mobile_adapter_service][buildServer][onRequest]:Robot Manager Mobile Adapter Server has started. " + config.host + ":" + config.port);
    } catch (e) {
        _ERROR("[meap_rm_mobile_adapter_service][buildServer][onRequest][ERROR]:MAS Start Fail. ", e.message);
    }
}

function start(Context) {
    try {
        var config = Context.Service;
        buildServer(Context, config, 0);
    } catch (e) {
        _ERROR("[meap_rm_mobile_adapter_service][start][ERROR]:Start " + servicename + " Failed");
    }
}

function filter(Param, Robot, Request, Response, i_f, Context) {
    var f = Context.Filter[i_f.type];
    if (f) {
        f(Param, Robot, Request, Response, i_f, function (result) {
            result === 0 ? i_f.handle.Runner(Param, Robot, Request, Response, i_f) : '';
        });

    } else
        i_f.handle.Runner(Param, Robot, Request, Response, i_f);
}


function runCommand(i_f, Request, Response, Param, Robot, Context) {
    {
        Context.CurrentInterface = Param.cmd;
        try {
            LOG5("\r\n\r\n[MAS] *******************************RUN COMMAND******************************************");
            var robot = Robot ? Robot : (new RBTContext(null, Context, null));
            robot.CurrentInterface = Param.cmd;
            filter(Param, robot, Request, Response, i_f, Context);
        } catch (e) {
            _ERROR("[meap_rm_mobile_adapter_service][runCommand][ERROR]:Run Custom interface failed. ", e.message);
            runError(Response, 15000, "Run Custom interface failed." + e.message);
        }
    }
}

function runError(Response, Status, Message) {
    Response.end(JSON.stringify({
        status: Status,
        message: Message
    }));
}

function route(param, Context, Request, Response, index) {
    function EMSG() {
        LOG2("[meap_rm_mobile_adapter_service][route]:NO AVA SID");
        runError(Response, 14504, 'No such SID to be allowed.');
        return 0;
    }

    try {
        //LOG1("[meap_rm_mobile_adapter_service][route]:param cmd is ", param.cmd);
        var i_f = param.i_f;
        if (i_f && i_f.handle.Runner) {
            var method = (i_f.method ? i_f.method : "GET").toLowerCase();
            if (Request.method.toLowerCase() != method && method != "all") {
                LOG1("[meap_rm_mobile_adapter_service][route]:IF METHOD IS NOT MATCH ");
                runError(Response, 14508, 'Request Method is Wrong! This interface only support method ' + method);
                return;
            }
            if (Request.method.toLowerCase() == "get" || Request.method.toLowerCase() == "delete") {
                if (i_f["public"] && param.sid == "public") {
                    runCommand(i_f, Request, Response, param, new RBTContext(null, Context, null), Context);
                } else {
                    Context.BuildRobot(param.appid, param.sid, function (Robot) {
                        if (Robot) {
                            Response.Robot = Robot;
                            Robot.CurrentInterface = param.cmd;
                            runCommand(i_f, Request, Response, param, Robot, Context)
                        } else
                            return EMSG();
                    });
                }
            } else {
                Request.pause();
                Context.BuildRobot(param.appid, param.sid, function (Robot) {
                    Request.resume();
                    if (!Robot) {
                        return EMSG();
                    }
                    var form = new formidable.IncomingForm();
                    LOG1("[meap_rm_mobile_adapter_service][route] POST ANALYZE ");
                    form.parse(Request, function (err, fields, files, body) {
                        LOG2("[meap_rm_mobile_adapter_service][route] POST OVER ", err, fields, files, body);
                        if (err) {
                            runError(Response, 14590, 'Upload File Failed.');
                            return;
                        }
                        param.fields = fields;
                        param.files = files;
                        param.body = body;
                        Response.Robot = Robot;
                        Robot.CurrentInterface = param.cmd;
                        runCommand(i_f, Request, Response, param, Robot, Context);
                    });
                }, (i_f["public"] && param.sid == "public"));
            }
        } else {
            _ERROR("[meap_rm_mobile_adapter_service][route][ERROR]:No request handler found for " + param.cmd);
            runError(Response, 14500, 'No Such Command!');
            return;
        }
    } catch (e) {
        _ERROR("[meap_rm_mobile_adapter_service][route][ERROR]:Route Fail -  ", e.message);
        runError(Response, 15000, 'Command dispatch fail!');
        return;
    }
}

/*
var listener = {};
process.on("message", function(port,socket) {
    process.nextTick(function(){
	var server = listener[port];
	LOG5("[MAS] message",port,server);
        if(server && socket) {
            socket.readable = socket.writable = true;
            socket.resume();
            server.connections++;
            socket.server = server;
            server.emit("connection", socket);
            socket.emit("connect");
        }
    });
});
*/
exports.Runner = start;
