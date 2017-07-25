(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "yargs"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const yargs = require("yargs");
    function cli() {
        yargs
            .usage('$0 <cmd> [args]')
            .command('prepare', 'Prepare the Windows VM', {}, (argv) => {
            prepareVM();
        })
            .help()
            .argv;
    }
    exports.cli = cli;
});
//# sourceMappingURL=index.js.map