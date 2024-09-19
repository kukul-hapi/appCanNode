global.LOG = global.LOG1 = global.LOG2 = global.LOG3 = global.LOG4 = global.LOG5 = global.LOGP = function () {
};
global._INFO = console.info;
global._WARN = console.warn;
global._ERROR = console.error;
global.cluster = 1;
process.argv.forEach(function (val, index, array) {
    var param = val.substr(0, 2);
    var value = val.substr(2);
    switch (param == '-c' ? param : val) {
        case "-L":
            global.LOG = global.LOG1 = global.LOG2 = global.LOG3 = global.LOG4 = global.LOG5 = console.log;
            break;
        case "-l":
            global.LOG = console.log;
            break;
        case "-l1":
            global.LOG1 = console.log;
            break;
        case "-l2":
            global.LOG2 = console.log;
            break;
        case "-l3":
            global.LOG3 = console.log;
            break;
        case "-l4":
            global.LOG4 = console.log;
            break;
        case "-l5":
            global.LOG5 = console.log;
            break;
        case "-s":
            global.single = 1;
            break;
        case "-c":
            global.cluster = value ? value : require('os').cpus().length;
            /*if(global.cluster > require('os').cpus().length)
			global.cluster = require('os').cpus().length;
		*/
            break;
        case "-n":
            global.NORF = 1;
            break;
        case "-p":
            global.LOGP = console.log;
            break;
        case "-d":
            global.DEBUG = true;
            break;
        case "-w":
            global.Worker = true;
            break;
        case "-nomam":
            global.noMAM = true;
            break;
        case "-rl":
            global.RobotLOG = true;
            break;
        case "-re":
            global.RobotERR = true;
            break;
    }
});
try {
    var RM = require("./meap_rm");
    exports.ROBOT_MANAGER = RM.ROBOT_MANAGER;
} catch (e) {
    //LOG("[MEAP RM require error]:",e);
    _ERROR("[meap][RM][ERROR]:", e);
}

try {
    var IM = require("./meap_im");
    exports.AJAX = IM.AJAX;
    exports.WEBRW = IM.WEBRW;
    exports.SOAP = IM.SOAP;
    //exports.MYSQL = IM.MYSQL;
    exports.SFS = IM.SFS;
    exports.PARSER = IM.PARSER;
    exports.REQPOOL = IM.REQPOOL;
    exports.ODBC = IM.ODBC;
    exports.LDAP = IM.LDAP;
    exports.MSG = IM.MSG;
    exports.TMPL = IM.TMPL;
    exports.GBK = IM.GBK;
} catch (e) {
    //LOG("[MEAP IM require error]:",e);
    _ERROR("[meap][IM][ERROR]:", e);
}

if (!global.DEBUG) {
    process.on('uncaughtException', function (err) {
        //LOG("[PROCESS ----- ]Caught exception : ", err);
        _ERROR("[meap][ERROR]:", err);
    });
}

console.log("-----------------------------------------[MAS] IDE VERSION 3.0.0build0024---------------------------------------------");
