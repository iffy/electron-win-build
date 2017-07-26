(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "yargs", "./vm"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const yargs = require("yargs");
    const vm_1 = require("./vm");
    function cli() {
        yargs
            .usage('$0 <cmd> [args]')
            .command('build', 'Build the Windows VM', {}, (argv) => {
            vm_1.getVMReady('win8build', 'win8');
        })
            .help()
            .argv;
    }
    exports.cli = cli;
});
//# sourceMappingURL=index.js.map