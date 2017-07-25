import { spawn } from 'child_process';

interface MachineType {
  name: string;
  iso_url: string;
  user: string;
  password: string;
}
const machine_types:MachineType[] = [
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

function run(...args):Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    let p = spawn(...args);
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', data => {
      stdout += data;
    })
    p.stderr.on('data', data => {
      stderr += data;
    })
    p.on('close', code => {
      resolve({
        stdout,
        stderr,
        code,
        ok: code === 0,
      })
    })
  })
}


class VM {
  constructor(readonly name:string) {

  }
  async ensureExists(ifnot:(vm:VM)=>void) {
    let result = await run('vboxmanage', ['showvminfo', this.name]);
    if (result.ok) {
      return true;
    } else {
      await ifnot(this);
    }
  }
  ensureOn() {

  }
  ensureOff() {

  }
}


function create(name)