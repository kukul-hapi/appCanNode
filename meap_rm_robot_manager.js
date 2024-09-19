
var cluster = require('cluster');
var numCPUs = global.single ? 1 : global.cluster;
var RBT_Man_Context = require("./meap_rm_robot_manager_context");
var MOB_Ada_Service = require("./meap_rm_mobile_adapter_service");

function run(path, mod) {
    LOG("[ROBM ]INFO: ", "************************ROBOT MANAGER START**********************************");
    {
        LOG("[ROBM ] INFO: MEAP RM WORKER RUNNING ");
        var RMContext = new RBT_Man_Context.Context(path);
        MOB_Ada_Service.Runner(RMContext);

    }
}

exports.Runner = run;
exports.Context = RBT_Man_Context.Context;
