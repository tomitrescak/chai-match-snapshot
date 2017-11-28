import * as path from 'path';
import * as fs from 'fs';

import { Exception, SnapshotException } from './exception';
import { config, SnapshotMode } from './config';

function stripComments(text: string) {
  text = text.replace(/<!-- react-empty: \d+ -->\n?/g, '');
  text = text.replace(/<!-- react-text: \d+ -->\n?/g, '');
  text = text.replace(/<!-- \/react-text -->\n?/g, '');
  return text;
}

let style = '';
function sendSnapshot(fileName: string, currentContent: object) {
  const socket = global['__socket'];
  if (socket) {
    try {
      socket.sendMessage({
        file: fileName,
        content: currentContent
      });
      return;
    } catch (ex) {
      console.log('Problem sending to socket: ' + ex);
    }
  }
}

function writeSnapshot(fileName: string, currentContent: object) {
  let content = '';
  try {
    fs.statSync(fileName);
    content = fs.readFileSync(fileName, { encoding: 'utf-8' }) || '';
  } catch (ex) {
    /**/
  }

  const text = JSON.stringify(currentContent, null, 2);
  if (content.length !== text.length || content !== text) {
    fs.writeFileSync(fileName, text);
  }
}

function handleStyles(fileName: string, type: SnapshotMode) {
  // write styles
  let typeStyle = require('typestyle');
  if (typeStyle) {
    let val = typeStyle.getStyles();
    if (val.length !== style.length || val !== style) {
      let file = path.basename(fileName);
      file = file.substring(0, file.lastIndexOf('.'));

      if (type === 'tcp' || type === 'both') {
        sendSnapshot(`${file}.css`, { styles: val });
      }

      if (type === 'drive' || type === 'both') {
        const dir = path.dirname(fileName);
        
        const stylePath = path.join(dir, `${file}.css`);
        fs.writeFileSync(stylePath, val);
      }
      style = val;
    }
  }
}

function updateSnapshots(fileName: string, currentContent: object) {
  handleStyles(fileName, config.snapshotMode);

  if (config.snapshotMode === 'both' || config.snapshotMode === 'tcp') {
    sendSnapshot(fileName, currentContent);
  }

  if (config.snapshotMode === 'both' || config.snapshotMode === 'drive') {
    writeSnapshot(fileName, currentContent);
  }
}

type MatchOptions = {
  serializer?: (source: any) => string;
};

function matchSnapshot(
  current: any,
  snapshotName = '',
  { serializer }: MatchOptions = {}
) {
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

    const fileName = path.join(
      snapshotDir,
      `${currentTask.className}_snapshots.${config.snapshotExtension}`
    );
    let snapshotCall = snapshotCalls.find(w => w.className === currentTask.className);

    // we either overwrite existing file or append to it
    if (snapshotCall == null) {
      snapshotCall = {
        className: currentTask.className,
        content: null,
        calls: []
      };
      snapshotCalls.push(snapshotCall);
    }

    // find function
    let call = snapshotCall.calls.find(w => w.name === currentTask.title);
    if (call == null) {
      call = { name: currentTask.title, calls: 1 };
      snapshotCall.calls.push(call);
    }

    let currentValue = stripComments(serializer ? serializer(current) : config.serializer(current));

    //////////////////////////////////////////
    // UPDATE SNAPSHOTS

    if (config.snapshotMode != null && config.snapshotMode !== 'test') {
      if (!snapshotCall.content) {
        snapshotCall.content = {};
      }

      // add possible decorator
      snapshotCall.content.cssClassName = currentTask.cssClassName;
      snapshotCall.content.decorator = currentTask.decorator;

      // make sure snapshot dir exists
      // TODO: save files to the location where tests are
      // The problem here is that I do not know how to access the root of FuseBox project
      try {
        fs.statSync(snapshotDir);
      } catch (ex) {
        fs.mkdirSync(snapshotDir);
      }

      // add current task
      snapshotCall.content[currentTask.title + ' ' + call.calls] = currentValue;

      // request to write snapshots
      config.writeSnapshots = () => updateSnapshots(fileName, snapshotCall.content);

      call.calls++;
    } else {
      // check if we have loaded the file
      if (!snapshotCall.content) {
        if (config.snapshotLoader != null) {
          snapshotCall.content = config.snapshotLoader(fileName, currentTask.className);
        } else {
          try {
            fs.statSync(fileName);
            snapshotCall.content = JSON.parse(fs.readFileSync(fileName) as any) as any;
          } catch (ex) {/**/}
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

            // override in stored
            snapshotCall.content[name] = snapshot;
          }
        }
      }

      if (!snapshotCall) {
        throw new Exception(
          `Snapshot file for ${currentTask.className} does not exist at '${fileName}'!`
        );
      }

      if (!snapshot) {
        throw new SnapshotException(`Snapshot '${currentTask.title}' does not exist!`, currentValue, null, name);
      }

      if (snapshot !== currentValue) {
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

  Assertion.addMethod('matchSnapshot', function(snapshotName: string, options: MatchOptions) {
    let obj = this._obj;
    try {
      matchSnapshot(obj, snapshotName, options);
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
