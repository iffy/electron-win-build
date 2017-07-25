var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "child_process"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const child_process_1 = require("child_process");
    const machine_types = [
        {
            name: 'win10',
            iso_url: "https://az792536.vo.msecnd.net/vms/VMBuild_20170320/VirtualBox/MSEdge/MSEdge.Win10.RS2.VirtualBox.zip",
            user: 'IEUser',
            password: 'Passw0rd!',
        },
        {
            name: 'win8',
            iso_url: "https://az412801.vo.msecnd.net/vhd/VMBuild_20141027/VirtualBox/IE11/Windows/IE11.Win8.1.For.Windows.VirtualBox.zip",
            user: 'IEUser',
            password: 'Passw0rd!',
        },
        {
            name: 'win7',
            iso_url: "https://az412801.vo.msecnd.net/vhd/VMBuild_20141027/VirtualBox/IE10/Windows/IE10.Win7.For.Windows.VirtualBox.zip",
            user: 'IEUser',
            password: 'Passw0rd!',
        }
    ];
    let _machines = {};
    machine_types.forEach(mtype => {
        _machines[mtype.name] = mtype;
    });
    exports.MACHINES = _machines;
    exports.DEFAULT_MACHINE = exports.MACHINES['win10'];
    function run(...args) {
        return new Promise((resolve, reject) => {
            let p = child_process_1.spawn(...args);
            let stdout = '';
            let stderr = '';
            p.stdout.on('data', data => {
                stdout += data;
            });
            p.stderr.on('data', data => {
                stderr += data;
            });
            p.on('close', code => {
                resolve({
                    stdout,
                    stderr,
                    code,
                    ok: code === 0,
                });
            });
        });
    }
    class VM {
        constructor(name) {
            this.name = name;
        }
        ensureExists(ifnot) {
            return __awaiter(this, void 0, void 0, function* () {
                let result = yield run('vboxmanage', ['showvminfo', this.name]);
                if (result.ok) {
                    return true;
                }
                else {
                    yield ifnot(this);
                }
            });
        }
        ensureOn() {
        }
        ensureOff() {
        }
    }
});
//# sourceMappingURL=vm.js.map