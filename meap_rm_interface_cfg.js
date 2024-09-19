var parser = require("./meap_xml");
var fs = require("fs");
var util = require("util");
var events = require("events");
var path = require("path");
// var path = require("../S10_PC/interface.xml");

function interfaceConfig(realpath, context, project) {
    if (this instanceof interfaceConfig) {
        var self = this;
        events.EventEmitter.call(self);

        function buildWatcher() {
            self.watcher = fs.watch(realpath, function (event, fn) {
                if (event == "change") {
                    self.watcher.close();
                    self.watcher = null;
                    self.emit("CHANGE", {});
                }
            });
        }

        const fs = require('fs');
        const xml2js = require('xml2js');

        function loadInterfaces() {
            const parser = new xml2js.Parser({ explicitArray: false }); // 设置 explicitArray: false 以简化结果

            try {
                // 读取 XML 文件内容
                const xmlData = fs.readFileSync(realpath, 'utf8');

                // 解析 XML 数据
                parser.parseString(xmlData, function (err, result) {
                    if (err) {
                        console.error("Parse Interface config fail: ", err);
                        return;
                    }

                    // 检查接口配置
                    if (Array.isArray(result.meap.interfaces["interface"])) {
                        for (const iface of result.meap.interfaces["interface"]) {
                            iface.type = project;
                            buildInterface(context, iface);
                        }
                    } else {
                        result.meap.interfaces["interface"].type = project;
                        buildInterface(context, result.meap.interfaces["interface"]);
                    }
                });
            } catch (e) {
                console.error("Failed to read or parse XML file:", e.message);
            }
        }


        self.on("CHANGE", function () {
            buildWatcher();
            for (var i in context.interfaces[project]) {
                var i_f = context.interfaces[project][i];
                {
                    i_f.watcher.close();
                    delete context.interfaces[project][i];
                }
            }
            delete context.interfaces[project];
            loadInterfaces();

        });
        buildWatcher();
        loadInterfaces();
        return self;
    }
    return new interfaceConfig(realpath, context, project);
}

util.inherits(interfaceConfig, events.EventEmitter);

buildInterface = function (Context, interf) {
    try {
        if (!interf)
            return;
        var realpath = fs.realpathSync(path.join(Context.workpath, interf.type, interf.name, "if.js"));
        interface(realpath, interf, Context);
    } catch (e) {
        _ERROR("[meap_rm_interface_cfg][buildInterface][ERROR]:Load Interface Fail -- ", e.message, interf.type, interf.name);
    }
}

function interface(realpath, interf, Context) {
    if (this instanceof interface) {
        var self = this;
        events.EventEmitter.call(self);

        function buildWatcher() {
            self.watcher = fs.watch(realpath, function (event, fn) {
                if (event == "change") {
                    self.watcher.close();
                    self.watcher = null;
                    self.emit("CHANGE", {});
                }
            });
        }

        function loadInterface() {
            var config = {};
            var if_func = global.Require(realpath);
            var i_f = {
                name: interf.name,
                path: interf.path,
                type: interf.type,
                config: config,
                sn: "",//interf.subservicename,
                method: (interf.method ? interf.method : "GET").toLowerCase(),
                handle: if_func,
                public: interf.public ? interf.public : false,
                watcher: self.watcher,
                tree: interf.path.split("/"),
            };
            return i_f;
        }

        self.on("CHANGE", function () {
            buildWatcher();
            if (global.Require.cache[realpath])
                delete global.Require.cache[realpath];
            Context.interfaces[interf.type] = (Context.interfaces[interf.type] || {});
            var i_f = loadInterface();
            Context.interfaces[interf.type][i_f.method + "~" + interf.path] = i_f;
        });
        buildWatcher();
        Context.interfaces[interf.type] = (Context.interfaces[interf.type] || {});
        var i_f = loadInterface();
        Context.interfaces[interf.type][i_f.method + "~" + interf.path] = i_f;
        LOG1("[meap_rm_interface_cfg][interface]:cmd", interf.type + "/" + interf.path);
        return self;
    }
    return new interface(realpath, interf, Context);
}

util.inherits(interface, events.EventEmitter);




function parseCfg(Context) {
    var context = Context;
    LOG1("[meap_rm_interface_cfg][parseCfg]:PARSE IF CFG START");
    for (var project in context.Service.projects) {
        var appconfigpath = fs.realpathSync(path.join(context.workpath, context.Service.projects[project], "interface.xml"));
        try {
            if (fs.existsSync(path.join(context.workpath, context.Service.projects[project], "Filter.js"))) {
                var filterConfigpath = fs.realpathSync(path.join(context.workpath, context.Service.projects[project], "Filter.js"));
                // _ERROR(appconfigpath,filterConfigpath)
                filterConfig(filterConfigpath, Context, context.Service.projects[project]);
            }
            interfaceConfig(appconfigpath, Context, context.Service.projects[project]);
        } catch (e) {
            _ERROR("[meap_rm_interface_cfg][parseCfg][ERROR]:Parse Interface config fail. " + e.message);
        }
    }
}


function filterConfig(initPath, context, project) {
    if (this instanceof filterConfig) {
        var self = this;
        events.EventEmitter.call(self);

        function buildWatcher() {
            self.watcher = fs.watch(initPath, function (event, fn) {
                if (event == "change") {
                    self.watcher.close();
                    self.watcher = null;
                    self.emit("CHANGE", {});
                }
            });
        }

        function loadInterfaces() {
            context.Filter[project] = global.Require(initPath).Runner;
        }

        self.on("CHANGE", function () {
            buildWatcher();
            if (global.Require.cache[initPath])
                delete global.Require.cache[initPath];
            delete context.Filter[project];
            loadInterfaces();
        });
        buildWatcher();
        loadInterfaces();
        return self;
    }
    return new filterConfig(initPath, context, project);
}

util.inherits(filterConfig, events.EventEmitter);

exports.Runner = parseCfg;

