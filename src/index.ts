import * as yargs from 'yargs';
import { getVMReady } from './vm';

export function cli() {
  yargs
    .usage('$0 <cmd> [args]')
    .command('build', 'Build the Windows VM', {
    }, (argv) => {
      getVMReady('win8build', 'win8');
    })
    .help()
    .argv
}