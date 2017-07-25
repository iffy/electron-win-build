import * as yargs from 'yargs';
import {VMBuilder} from './vm';

export function cli() {
  yargs
    .usage('$0 <cmd> [args]')
    .command('prepare', 'Prepare the Windows VM', {
    }, (argv) => {
      prepareVM();
    })
    .help()
    .argv
}