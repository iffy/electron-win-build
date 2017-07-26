import * as execa from 'execa';
import * as fs from 'fs-extra-promise';
import * as os from 'os';
import * as Path from 'path';
import * as winston from 'winston';
import * as https from 'https';
import * as extract_zip from 'extract-zip';
import * as ora from 'ora';

interface MachineType {
  name: string;
  zip_url: string;
  user: string;
  password: string;
  admin_user: string;
  admin_password: string;
}
const machine_types:MachineType[] = [
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
]

let _machines = {};
machine_types.forEach(mtype => {
  _machines[mtype.name] = mtype;
})
export const MACHINES = _machines;
export const DEFAULT_MACHINE = MACHINES['win10'];

interface ExecutionResult {
  stdout: string;
  stderr: string;
  code: number;
  ok: boolean;
}

async function run(cmd, args, opts={}):Promise<ExecutionResult> {
  try {
    let res = await execa(cmd, args, opts)
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      ok: res.code === 0,
      code: res.code,
    }
  } catch(err) {
    return {
      stdout: err.stdout,
      stderr: err.stderr,
      ok: err.code === 0,
      code: err.code,
    }
  }
}
async function okrun(cmd, args):Promise<ExecutionResult> {
  let res = await run(cmd, args);
  if (!res.ok) {
    throw new Error(`Error executing ${cmd} ${args}:
    stdout: ${res.stdout}
    stderr: ${res.stderr}`);
  }
  return res;
}

async function spinnerRun<T>(message:string, fn:()=>T):Promise<T> {
  let spinner = ora(message);
  spinner.color = 'yellow';
  spinner.start();
  try {
    let ret = await fn();
    spinner.succeed();
    return ret;
  } catch(err) {
    spinner.fail();
    throw err;
  }
}


class VM {
  public config: MachineType;
  public iso_dir: string;
  constructor(readonly name:string, config:string | MachineType) {
    if (typeof config === 'string') {
      this.config = MACHINES[config];
    } else {
      this.config = config;
    }
    this.iso_dir = Path.join(os.homedir(), '.electron-win-build', 'iso');
  }
  async ensureReady() {
    console.log('ensureReady');
    await this.ensureBareVM(); 
    console.log('have bareVM');
    await this.ensureSnapshot('genesis');
    console.log('genesis');
    await this.ensureSnapshot('guestadditions', 'genesis', () => {
      return installGuestAdditions(this);
    });
  }

  async ensureBareVM():Promise<any> {
    let result = await run('vboxmanage', ['showvminfo', this.name]);
    if (result.ok) {
      return;
    }
    
    let ova_path = Path.join(this.iso_dir, `${this.config.name}.ova`);
    fs.ensureDirSync(this.iso_dir);
    if (!fs.existsSync(ova_path)) {
      winston.info('Need .ova', {ova_path});
      let zip_path = Path.join(this.iso_dir, `${this.config.name}.zip`);
      if (!fs.existsSync(zip_path)) {
        winston.info('Need .zip', {zip_path});
        winston.info('Downloading', {url:this.config.zip_url})
        await spinnerRun(`download big zip: ${zip_path}`, () => {
          return new Promise((resolve, reject) => {
            let zip_stream = fs.createWriteStream(zip_path)
            .on('error', err => {
              winston.error('Error opening file', {err, zip_path})
              reject(err);
            })
            
            https.get(this.config.zip_url, res => {
              res.pipe(zip_stream);
              res.on('end', () => {
                resolve(zip_path);  
              })
            })
            .on('error', err => {
              winston.error('Error downloading zip', {err});
              reject(err);
            })
          })  
        });
        winston.info('Have .zip', {zip_path});
      }
      let filename:string;
      await spinnerRun(`unzip ${zip_path}`, () => {
        return new Promise((resolve, reject) => {
          extract_zip(zip_path, {
            dir: this.iso_dir,
            onEntry: (entry, zipfile) => {
              filename = entry.fileName;
            }}, err => {
              if (err) {
                reject(err);
              } else {
                resolve(filename);  
              }
            })
          });
      })
      fs.renameSync(Path.join(this.iso_dir, filename), ova_path);
      winston.info('Have .ova', {ova_path});
    }

    await spinnerRun(`import ${ova_path} -> ${this.name}`, () => {
      return okrun('vboxmanage', ['import', ova_path, '--vsys', '0', '--vmname', this.name])
    });
  }
  async ensureSnapshot(snapname:string, basesnap?:string, func?:()=>any) {
    console.log('ensureSnapshot', snapname, basesnap);
    return spinnerRun(`snapshot: ${snapname}`, async () => {
      let res = await run('vboxmanage', ['snapshot', this.name, 'showvminfo', snapname]);
      if (res.ok) {
        // snapshot exists
        return;
      }
      console.log('snapshot does not exist');
      if (basesnap) {
        console.log('restore');
        await this.restore(basesnap);
      }
      console.log('waiting for it to turn on');
      await this.ensureOn();
      if (func) {
        await func();
      }
      console.log('done running business for snapshot', snapname);
      await this.ensureOff();
      await okrun('vboxmanage', ['snapshot', this.name, 'take', snapname]);
    })
  }
  async restore(snapname:string) {
    winston.info('restoring to snapshot', {snapname});
    await this.ensureOff();
    await okrun('vboxmanage', ['snapshot', this.name, 'restore', snapname]);
  }
  async ensureOn() {
    let sent_start = false;
    await waitFor(async () => {
      let res = await okrun('vboxmanage', ['showvminfo', this.name]);
      if (res.stdout.indexOf('running') !== -1) {
        winston.info('vm on');
        return true;
      } else if (!sent_start) {
        await okrun('vboxmanage', ['startvm', this.name, '--type', 'headless'])
        sent_start = true;
      }
      return false;
    });
  }
  async ensureBooted() {
    console.log('ensureBooted');
    await this.ensureOn();
    console.log('it is on');
    await waitFor(async () => {
      let ret = await this.cmd(['echo', 'hello'], {
        timeout: 10 * 1000,
      });
      console.log('ret', ret.ok, ret.stdout.indexOf('hello'), ret.stdout, ret.stderr);
      return ret.ok && ret.stdout.indexOf('hello') !== -1;
    })
    console.log('waitFor is done');
    winston.info('vm booted');
  }
  async ensureOff() {
    let stopped = false;
    let timeout = setTimeout(() => {
      okrun('vboxmanage', ['controlvm', this.name, 'poweroff'])
    }, 30 * 1000);
    return waitFor(async() => {
      let res = await okrun('vboxmanage', ['showvminfo', this.name]);
      if (res.stdout.indexOf('powered off') === -1) {
        if (!stopped) {
          stopped = true;
          okrun('vboxmanage', ['controlvm', this.name, 'acpipowerbutton'])
        }
      } else {
        // it has stopped
        clearTimeout(timeout);
        winston.info('vm off');
        return true;
      }
    })
  }
  cmd(args:string[], opts?: {
      admin?:boolean,
      timeout?:number,
    }) {
    let username = this.config.user;
    let password = this.config.password;
    if (opts.admin) {
      username = this.config.admin_user;
      password = this.config.admin_password;
    }
    let params = ['guestcontrol', this.name, 'run', '--wait-stdout', '--wait-stderr', '--exe', "cmd.exe", '--username', username, '--password', password, '--', '/c'].concat(args)
    return run('vboxmanage', params, {
      timeout: opts.timeout,
    })
  }
}


async function waitFor(testfunc:()=>boolean|Promise<boolean>) {
  return new Promise((resolve, reject) => {
    async function check():Promise<boolean> {
      try {
        let result = await testfunc();
        if (result) {
          resolve(result);
          return true;
        } else {
          return false;
        }
      } catch(err) {
        reject(err);
      }
      return false;
    }
    function checkagain() {
      check().then(worked => {
        console.log('waitfor worked', worked);
        if (!worked) {
          setTimeout(() => {
            checkagain();
          }, 2000)
        }
      })
    }
    checkagain();
  })
}

async function installGuestAdditions(vm:VM) {
  console.log(`

***** USER INTERACTION MAYBE REQUIRED *****

If Guest Additions aren't installed on this image,
open VirtualBox and install them on the vm:

  ${vm.name}

This step will automatically complete once Guest Additions
are detected.

***** USER INTERACTION MAYBE REQUIRED *****
`);
  await vm.ensureBooted();
  winston.info('Guest Additions appear to be installed');
}


export async function getVMReady(name, config:string|MachineType):Promise<VM> {
  let vm = new VM(name, config);
  console.log('made vm', vm);
  await vm.ensureReady();
  return vm;
}