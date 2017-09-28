import { Exception, SnapshotException } from './exception';
import { config } from './config';

import * as path from 'path';
import * as fs from 'fs';

function stripComments(text: string) {
  text = text.replace(/<!-- react-empty: \d+ -->\n?/g, '');
  text = text.replace(/<!-- react-text: \d+ -->\n?/g, '');
  text = text.replace(/<!-- \/react-text -->\n?/g, '');
  return text;
}

let style = '';
function writeSnapshot(fileName: string, currentContent: object) {
  let content = '';
  try {
    fs.statSync(fileName);
    content = fs.readFileSync(fileName, { encoding: 'utf-8' }) || '';
  } catch (ex) { /**/ }

  const text = JSON.stringify(currentContent, null, 2);

  if (content.length !== text.length || content !== text) {
    fs.writeFileSync(fileName, text);
  }

  // write styles
  let typeStyle = require('typestyle');
  if (typeStyle) {
    let getStyles = typeStyle.getStyles;
    let val = getStyles();
    if (val.length !== style.length || val !== style) {
      const dir = path.dirname(fileName);
      const stylePath = path.join(dir, 'generated.css');
      fs.writeFileSync(stylePath, val);
    }
  }
}

function matchSnapshot(current: any, snapshotName = '', createDiff = false) {
  const snapshotDir = path.resolve(config.snapshotDir);

  if (!config.snapshotCalls) {
    config.snapshotCalls = [];
  }
  const { currentTask, snapshotCalls } = config;
  const currentTitle = currentTask.title;

  try {
    if (snapshotName) {
      currentTask.title = snapshotName;
    }

    const fileName = path.join(snapshotDir, `${currentTask.className}_snapshots.${config.snapshotExtension}`);
    let snapshotCall = snapshotCalls.find(w => w.className === currentTask.className);

    // we either overwrite existing file or append to it
    if (snapshotCall == null) {
      snapshotCall = { className: currentTask.className, content: process.env.UPDATE_SNAPSHOTS ? {} : null, calls: [] };
      snapshotCalls.push(snapshotCall);
    }

    // find function
    let call = snapshotCall.calls.find(w => w.name === currentTask.title);
    if (call == null) {
      call = { name: currentTask.title, calls: 1 };
      snapshotCall.calls.push(call);
    }

    // we can update all snapshots or match against current one
    if (process.env.UPDATE_SNAPSHOTS) {
      // make sure snapshot dir exists
      // TODO: save files to the location where tests are
      // The problem here is that I do not know how to access the root of FuseBox project
      try {
        fs.statSync(snapshotDir);
      } catch (ex) {
        fs.mkdirSync(snapshotDir);
      }

      // add current task
      snapshotCall.content[currentTask.title + ' ' + call.calls] = stripComments(config.serializer(current));
      if (!process.env.SNAPSHOT || currentTask.title.match(process.env.SNAPSHOT)) {
        // compare files if they exist
        config.writeSnapshots = () => writeSnapshot(fileName, snapshotCall.content);
      }
      call.calls++;
    } else {
      let currentValue = stripComments(config.serializer(current));

      // check if we have loaded the file
      if (!snapshotCall.content) {
        if (config.snapshotLoader != null) {
          snapshotCall.content = config.snapshotLoader(fileName, currentTask.className);
        } else {
          try {
            fs.statSync(fileName);
            snapshotCall.content = JSON.parse(fs.readFileSync(fileName) as any) as any;
          } catch (ex) {}
        }
      }

      const name = currentTask.title + ' ' + call.calls++;
      let snapshot = snapshotCall.content ? snapshotCall.content[name] : null;

      if (config.onProcessSnapshots) {
        let value = config.onProcessSnapshots(currentTask.title, name, currentValue, snapshot);
        if (value) {
          if (value.actual) {
            currentValue = value.actual;
          }
          if (value.expected) {
            snapshot = value.expected;
          }
        }
      }

      if (!snapshotCall) {
        throw new Exception(`Snapshot file for ${currentTask.className} does not exist at '${fileName}'!`);
      }

      if (!snapshot) {
        throw new SnapshotException(`Snapshot does not exist!`, currentValue, null, name);
      }

      if (snapshot !== currentValue) {
        if (createDiff) {
          // use jsdiff to compare
          //   let message = '';
          //   var diff = jsdiff.diffChars(snapshot, currentValue);
          //   diff.forEach(function(part) {
          //     if (
          //       typeof window === 'undefined' ||
          //       window.location == null ||
          //       window.location.href == null ||
          //       window.location.href == 'about:blank'
          //     ) {
          //       if (part.added) {
          //         message += '\x1b[32m' + part.value;
          //       } else if (part.removed) {
          //         message += '\x1b[31m' + part.value;
          //       } else if (message) {
          //         message += '\x1b[37m' + part.value.substring(0, 30) + '\n';
          //       } else {
          //         message += '\x1b[37m' + part.value.substring(part.value.length - 30);
          //       }
          //     } else {
          //       if (part.added) {
          //         message += '<span class="diffadded">' + part.value + '</span>';
          //       } else if (part.removed) {
          //         message += '<span class="diffremoved">' + part.value + '</span>';
          //       } else if (message) {
          //         message += part.value.substring(0, 30) + '<br />';
          //       } else {
          //         message += part.value.substring(part.value.length - 30);
          //       }
          //     }
          //   });
          let message = `${currentValue}\n\n\n===================\n\n\n${snapshot}`;
          throw new SnapshotException(`Snapshots do not match: \n${message}`, currentValue, snapshot, name);
        }
        throw new SnapshotException(`Snapshots do not match`, currentValue, snapshot, name);
      }
    }
  } catch (ex) {
    throw ex;
  } finally {
    currentTask.title = currentTitle;
  }

  return this;
}

export function chaiMatchSnapshot(chai: any, utils: any) {
  const Assertion = chai.Assertion;

  Assertion.addMethod('matchSnapshot', function(snapshotName: string, useDiff: boolean) {
    let obj = this._obj;
    try {
      matchSnapshot(obj, snapshotName, useDiff);
    } catch (ex) {
      if (ex.actual && ex.expected) {
        new Assertion(ex.actual).to.equal(ex.expected);
      }
      throw ex;
    }
  });
}

export { config } from './config';
export { setupMocha } from './mocha';

export default chaiMatchSnapshot;
