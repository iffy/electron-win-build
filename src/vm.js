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
        define(["require", "exports", "execa", "fs-extra-promise", "os", "path", "winston", "https", "extract-zip", "ora"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const execa = require("execa");
    const fs = require("fs-extra-promise");
    const os = require("os");
    const Path = require("path");
    const winston = require("winston");
    const https = require("https");
    const extract_zip = require("extract-zip");
    const ora = require("ora");
    const machine_types = [
        {
            name: 'win10',
            zip_url: "https://az792536.vo.msecnd.net/vms/VMBuild_20170320/VirtualBox/MSEdge/MSEdge.Win10.RS2.VirtualBox.zip",
            user: 'IEUser',
            password: 'Passw0rd!',
            admin_user: 'Administrator',
            admin_password: 'admin',
        },
        {
            name: 'win8',
            zip_url: "https://az412801.vo.msecnd.net/vhd/VMBuild_20141027/VirtualBox/IE11/Windows/IE11.Win8.1.For.Windows.VirtualBox.zip",
            user: 'IEUser',
            password: 'Passw0rd!',
            admin_user: 'Administrator',
            admin_password: 'admin',
        },
        {
            name: 'win7',
            zip_url: "https://az412801.vo.msecnd.net/vhd/VMBuild_20141027/VirtualBox/IE10/Windows/IE10.Win7.For.Windows.VirtualBox.zip",
            user: 'IEUser',
            password: 'Passw0rd!',
            admin_user: 'Administrator',
            admin_password: 'admin',
        }
    ];
    let _machines = {};
    machine_types.forEach(mtype => {
        _machines[mtype.name] = mtype;
    });
    exports.MACHINES = _machines;
    exports.DEFAULT_MACHINE = exports.MACHINES['win10'];
    function run(cmd, args, opts = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let res = yield execa(cmd, args, opts);
                return {
                    stdout: res.stdout,
                    stderr: res.stderr,
                    ok: res.code === 0,
                    code: res.code,
                };
            }
            catch (err) {
                return {
                    stdout: err.stdout,
                    stderr: err.stderr,
                    ok: err.code === 0,
                    code: err.code,
                };
            }
        });
    }
    function okrun(cmd, args) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield run(cmd, args);
            if (!res.ok) {
                throw new Error(`Error executing ${cmd} ${args}:
    stdout: ${res.stdout}
    stderr: ${res.stderr}`);
            }
            return res;
        });
    }
    function spinnerRun(message, fn) {
        return __awaiter(this, void 0, void 0, function* () {
            let spinner = ora(message);
            spinner.color = 'yellow';
            spinner.start();
            try {
                let ret = yield fn();
                spinner.succeed();
                return ret;
            }
            catch (err) {
                spinner.fail();
                throw err;
            }
        });
    }
    class VM {
        constructor(name, config) {
            this.name = name;
            if (typeof config === 'string') {
                this.config = exports.MACHINES[config];
            }
            else {
                this.config = config;
            }
            this.iso_dir = Path.join(os.homedir(), '.electron-win-build', 'iso');
        }
        ensureReady() {
            return __awaiter(this, void 0, void 0, function* () {
                console.log('ensureReady');
                yield this.ensureBareVM();
                console.log('have bareVM');
                yield this.ensureSnapshot('genesis');
                console.log('genesis');
                yield this.ensureSnapshot('guestadditions', 'genesis', () => {
                    return installGuestAdditions(this);
                });
            });
        }
        ensureBareVM() {
            return __awaiter(this, void 0, void 0, function* () {
                let result = yield run('vboxmanage', ['showvminfo', this.name]);
                if (result.ok) {
                    return;
                }
                let ova_path = Path.join(this.iso_dir, `${this.config.name}.ova`);
                fs.ensureDirSync(this.iso_dir);
                if (!fs.existsSync(ova_path)) {
                    winston.info('Need .ova', { ova_path });
                    let zip_path = Path.join(this.iso_dir, `${this.config.name}.zip`);
                    if (!fs.existsSync(zip_path)) {
                        winston.info('Need .zip', { zip_path });
                        winston.info('Downloading', { url: this.config.zip_url });
                        yield spinnerRun(`download big zip: ${zip_path}`, () => {
                            return new Promise((resolve, reject) => {
                                let zip_stream = fs.createWriteStream(zip_path)
                                    .on('error', err => {
                                    winston.error('Error opening file', { err, zip_path });
                                    reject(err);
                                });
                                https.get(this.config.zip_url, res => {
                                    res.pipe(zip_stream);
                                    res.on('end', () => {
                                        resolve(zip_path);
                                    });
                                })
                                    .on('error', err => {
                                    winston.error('Error downloading zip', { err });
                                    reject(err);
                                });
                            });
                        });
                        winston.info('Have .zip', { zip_path });
                    }
                    let filename;
                    yield spinnerRun(`unzip ${zip_path}`, () => {
                        return new Promise((resolve, reject) => {
                            extract_zip(zip_path, {
                                dir: this.iso_dir,
                                onEntry: (entry, zipfile) => {
                                    filename = entry.fileName;
                                }
                            }, err => {
                                if (err) {
                                    reject(err);
                                }
                                else {
                                    resolve(filename);
                                }
                            });
                        });
                    });
                    fs.renameSync(Path.join(this.iso_dir, filename), ova_path);
                    winston.info('Have .ova', { ova_path });
                }
                yield spinnerRun(`import ${ova_path} -> ${this.name}`, () => {
                    return okrun('vboxmanage', ['import', ova_path, '--vsys', '0', '--vmname', this.name]);
                });
            });
        }
        ensureSnapshot(snapname, basesnap, func) {
            return __awaiter(this, void 0, void 0, function* () {
                console.log('ensureSnapshot', snapname, basesnap);
                return spinnerRun(`snapshot: ${snapname}`, () => __awaiter(this, void 0, void 0, function* () {
                    let res = yield run('vboxmanage', ['snapshot', this.name, 'showvminfo', snapname]);
                    if (res.ok) {
                        return;
                    }
                    console.log('snapshot does not exist');
                    if (basesnap) {
                        console.log('restore');
                        yield this.restore(basesnap);
                    }
                    console.log('waiting for it to turn on');
                    yield this.ensureOn();
                    if (func) {
                        yield func();
                    }
                    console.log('done running business for snapshot', snapname);
                    yield this.ensureOff();
                    yield okrun('vboxmanage', ['snapshot', this.name, 'take', snapname]);
                }));
            });
        }
        restore(snapname) {
            return __awaiter(this, void 0, void 0, function* () {
                winston.info('restoring to snapshot', { snapname });
                yield this.ensureOff();
                yield okrun('vboxmanage', ['snapshot', this.name, 'restore', snapname]);
            });
        }
        ensureOn() {
            return __awaiter(this, void 0, void 0, function* () {
                let sent_start = false;
                yield waitFor(() => __awaiter(this, void 0, void 0, function* () {
                    let res = yield okrun('vboxmanage', ['showvminfo', this.name]);
                    if (res.stdout.indexOf('running') !== -1) {
                        winston.info('vm on');
                        return true;
                    }
                    else if (!sent_start) {
                        yield okrun('vboxmanage', ['startvm', this.name, '--type', 'headless']);
                        sent_start = true;
                    }
                    return false;
                }));
            });
        }
        ensureBooted() {
            return __awaiter(this, void 0, void 0, function* () {
                console.log('ensureBooted');
                yield this.ensureOn();
                console.log('it is on');
                yield waitFor(() => __awaiter(this, void 0, void 0, function* () {
                    let ret = yield this.cmd(['echo', 'hello'], {
                        timeout: 10 * 1000,
                    });
                    console.log('ret', ret.ok, ret.stdout.indexOf('hello'), ret.stdout, ret.stderr);
                    return ret.ok && ret.stdout.indexOf('hello') !== -1;
                }));
                console.log('waitFor is done');
                winston.info('vm booted');
            });
        }
        ensureOff() {
            return __awaiter(this, void 0, void 0, function* () {
                let stopped = false;
                let timeout = setTimeout(() => {
                    okrun('vboxmanage', ['controlvm', this.name, 'poweroff']);
                }, 30 * 1000);
                return waitFor(() => __awaiter(this, void 0, void 0, function* () {
                    let res = yield okrun('vboxmanage', ['showvminfo', this.name]);
                    if (res.stdout.indexOf('powered off') === -1) {
                        if (!stopped) {
                            stopped = true;
                            okrun('vboxmanage', ['controlvm', this.name, 'acpipowerbutton']);
                        }
                    }
                    else {
                        clearTimeout(timeout);
                        winston.info('vm off');
                        return true;
                    }
                }));
            });
        }
        cmd(args, opts) {
            let username = this.config.user;
            let password = this.config.password;
            if (opts.admin) {
                username = this.config.admin_user;
                password = this.config.admin_password;
            }
            let params = ['guestcontrol', this.name, 'run', '--wait-stdout', '--wait-stderr', '--exe', "cmd.exe", '--username', username, '--password', password, '--', '/c'].concat(args);
            return run('vboxmanage', params, {
                timeout: opts.timeout,
            });
        }
    }
    function waitFor(testfunc) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                function check() {
                    return __awaiter(this, void 0, void 0, function* () {
                        try {
                            let result = yield testfunc();
                            if (result) {
                                resolve(result);
                                return true;
                            }
                            else {
                                return false;
                            }
                        }
                        catch (err) {
                            reject(err);
                        }
                        return false;
                    });
                }
                function checkagain() {
                    check().then(worked => {
                        console.log('waitfor worked', worked);
                        if (!worked) {
                            setTimeout(() => {
                                checkagain();
                            }, 2000);
                        }
                    });
                }
                checkagain();
            });
        });
    }
    function installGuestAdditions(vm) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`

***** USER INTERACTION MAYBE REQUIRED *****

If Guest Additions aren't installed on this image,
open VirtualBox and install them on the vm:

  ${vm.name}

This step will automatically complete once Guest Additions
are detected.

***** USER INTERACTION MAYBE REQUIRED *****
`);
            yield vm.ensureBooted();
            winston.info('Guest Additions appear to be installed');
        });
    }
    function getVMReady(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            let vm = new VM(name, config);
            console.log('made vm', vm);
            yield vm.ensureReady();
            return vm;
        });
    }
    exports.getVMReady = getVMReady;
});
//# sourceMappingURL=vm.js.map