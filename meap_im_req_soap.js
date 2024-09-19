/**
 * @author qinghua.zhao
 */
var soap = require("./meap_soap");
var net = require("net");
function run(option, callback, robot){
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
    LOG1("[meap_im_req_soap][run]:SOAP OPTION ",option , sec);
    soap.createClient(option.wsdl, function(err, client) {
        if (sec) {
            try {
                client.setSecurity(sec);
            } catch(e) {
                _ERROR("[meap_im_req_soap][run][ERROR]:SET SEC Fail " + e.message);
            }
        }
        if(option.soapHeader)
        {
            client.addSoapHeader(option.soapHeader);
        }

        //supportCookie
        client.setRobot(robot);
        client.setCookie(option.Cookie);
        //
        var fn = eval("client." + option.func);
        LOG3("[meap_im_req_soap][run]:RUN FUNCTION " , option.func,client.describe());
        if (fn) {
            fn(option.Params, function(err, data) {
                if(err)
                {
                    _ERROR("[meap_im_req_soap][run][ERROR]:RUNNING RESULT ", err);
                    callback(-1, {
                        'status' : '15200',
                        'message' : err
                    });
                }
                else
                {
                    LOG3("[meap_im_req_soap][run]:RUNNING RESULT DATA ", data);
                    callback(0, null, data);
                }
            });
        }
    });
}
function server(option,callback)
{
    soap.createServer(option.wsdl,option.Service,function(err,server){
        callback(err,server);
    });
}
exports.Runner = run;
exports.Server = server;
