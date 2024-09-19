
var parser = require("./meap_xml");
var fs = require("fs");
var path = require("path");

function buildApplication(Context, application) {
    var app = {
        name: application.name,
        id: application.id,
        policies: application.policies
    };
    Context.apps.push(app);

    Context.policies[application.id] = {};
    Context.policies[application.id].policynames = [];

    if (Object.prototype.toString.apply(application.policies.policy) === "[object Array]") {
        for (var i in application.policies.policy) {
            parsePolicyConfig(application.id, application.policies.policy[i], Context)
        }
    } else {
        parsePolicyConfig(application.id, app.policies.policy, Context);
    }
    LOG1("[meap_rm_application_cfg][buildApplication]:APP ", app);
    LOG1("[meap_rm_application_cfg][buildApplication]:POLICY ", Context.policies[application.id]);
}

function parsePolicyConfig(appid, policyname, Context) {
    var policyconfigpath = path.join(Context.workpath, "config/application/" + appid, "policy_" + policyname + ".xml");
    var result = parser.toJson(fs.readFileSync(policyconfigpath), {
        object: true
    });
    Context.policies[appid][policyname] = result.policy;
    Context.policies[appid].policynames.push(policyname);
}
function parseCfg(Context) {
    LOG1("[meap_rm_application_cfg][parseCfg]:PARSE APP CFG START");
    var context = Context;
    var appconfigpath = fs.realpathSync(path.join(context.workpath, "config/application.xml"));

    function loadApplications() {
        var result = parser.toJson(fs.readFileSync(appconfigpath), {
            object: true
        });
        LOG2("[meap_rm_application_cfg][parseCfg][loadApplications]:Parse appconfig ", result);
        if (Array.isArray(result.meap.applications.application)) {
            for (var app in result.meap.applications.application) {
                buildApplication(context, result.meap.applications.application[app]);
            }
        } else {
            buildApplication(context, result.meap.applications.application);
        }
    }

    try {
        loadApplications();
        var watcher = fs.watch(appconfigpath, function (event, fn) {
            if (event == "change") {
                Context.apps = [];
                Context.policies = {};
                loadApplications();
            }
        });
    } catch (e) {
        _ERROR("[meap_rm_application_cfg][parseCfg][ERROR]:Parse application config fail.", e.message);
    }
}

exports.Runner = parseCfg;
