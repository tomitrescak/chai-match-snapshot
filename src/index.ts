import * as path from 'path';
import * as fs from 'fs';

import { Exception, SnapshotException } from './exception';
import { config, SnapshotMode } from './config';

// setup mocha
const Runnable = require('mocha/lib/runnable');
interface Context {
  runnable: any;
  title: string;
  titleIndex: number;
  names: { [index: string]: number };
}

const currentContext: Context = {
  runnable: null,
  title: '',
  titleIndex: 0,
  names: {}
};

const runnableRun = Runnable.prototype.run;
Runnable.prototype.run = function() {
  currentContext.runnable = this;
  currentContext.title = this.title;
  currentContext.titleIndex = 0;
  currentContext.names = {
    [currentContext.title]: 1
  };
  return runnableRun.apply(this, arguments);
};

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
  const text = Object.getOwnPropertyNames(currentContent)
    .filter(n => config.omitted.indexOf(n) === -1)
    .map(c => {
      let content = currentContent[c];
      content = content.replace(/\\/g, '\\\\');
      return `exports[\`${c}\`] = \`${content}\``;
    })
    .join('\n');

  fs.writeFileSync(fileName, text);
}

function handleStyles(fileName: string, type: SnapshotMode) {
  // write styles
  if (config.getStyles) {
    let val = config.getStyles();
    let file = path.parse(fileName).name;

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

function updateSnapshots(snapshotName: string, styleName: string, currentContent: object) {
  handleStyles(styleName, config.snapshotMode);

  if (config.snapshotMode === 'both' || config.snapshotMode === 'tcp') {
    sendSnapshot(snapshotName, currentContent);
  }

  if (
    config.snapshotMode === 'both' ||
    config.snapshotMode === 'drive' ||
    config.snapshotMode === 'new'
  ) {
    writeSnapshot(snapshotName, currentContent);
  }
}

function getExistingSnaps(
  snapshotDir: string,
  snapshotFilePath: string
): { [index: string]: string } {
  let snaps = {};

  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir);
  }

  if (fs.existsSync(snapshotFilePath)) {
    snaps = require(snapshotFilePath);
  }
  return snaps;
}

type MatchOptions = {
  serializer?: (source: any) => string;
  cssClassName?: string;
  decorator?: any;
};

function matchSnapshot(
  current: any,
  snapshotName = '',
  { serializer, cssClassName, decorator }: MatchOptions = {},
  testContext: Context
) {
  let parentName = '';
  let parent = testContext.runnable.parent;
  while (parent) {
    if (parent.title) {
      parentName = parent.title + ' ' + parentName;
    }
    parent = parent.parent;
  }

  const dirName = path.dirname(testContext.runnable.file);
  const fileName = path.parse(testContext.runnable.file).name;
  const extension = path.parse(testContext.runnable.file).ext;
  const snapshotDir = path.join(dirName, config.snapshotFolder);
  let snapshotFilePath = path.join(
    snapshotDir,
    fileName + extension + '.' + config.snapshotExtension
  );

  // file could have been renamed from original source to js (e.g. in wallaby.js)
  let originalPath = snapshotFilePath;
  let testExtensions = ['.js.', '.ts.', '.tsx.', ''];
  for (let i = 0; i < testExtensions.length - 1; i++) {
    try {
      fs.statSync(snapshotFilePath);
      break;
    } catch (_a) {
      snapshotFilePath = snapshotFilePath.replace(testExtensions[i], testExtensions[i + 1]);
      if (testExtensions[i + 1] === '') {
        snapshotFilePath = originalPath;
      }
    }
  }

  const styleFilePath = path.join(snapshotDir, fileName + '.css');

  const name = testContext.title + (snapshotName ? ' ' + snapshotName : '');
  if (!testContext.names[name]) {
    testContext.names[name] = 1;
  }

  let index = testContext.names[name]++;
  const testName = parentName + name + ' ' + index;

  // in the new mode we will override all snapshots
  const snaps =
    config.snapshotMode === 'new' ? {} : getExistingSnaps(snapshotDir, snapshotFilePath);
  let snapshot: string = snaps[testName];

  try {
    let currentValue = stripComments(serializer ? serializer(current) : config.serializer(current));

    //////////////////////////////////////////
    // UPDATE SNAPSHOTS

    if (config.snapshotMode != null && config.snapshotMode !== 'test') {
      if (cssClassName) {
        snaps.cssClassName = cssClassName;
      }
      if (decorator) {
        snaps.decorator = decorator;
      }

      // add current task
      snaps[testName] = currentValue;

      // request to write snapshots
      updateSnapshots(snapshotFilePath, styleFilePath, snaps);
    } else {
      //////////////////////////////////////////
      // TEST SNAPSHOTS

      if (config.onProcessSnapshots) {
        let value = config.onProcessSnapshots(testName, name, currentValue, snapshot);
        if (value) {
          if (value.actual) {
            currentValue = value.actual;
          }
          if (value.expected) {
            snapshot = value.expected;

            // override in stored
            snaps[testName] = snapshot;
          }
        }
      }

      if (!snapshot) {
        throw new SnapshotException(
          `Snapshot '${testName}' does not exist!`,
          currentValue,
          null,
          name
        );
      }

      if (snapshot !== currentValue) {
        throw new SnapshotException(`Snapshots do not match`, currentValue, snapshot, name);
      }
    }
  } catch (ex) {
    throw ex;
  }

  return this;
}

export function chaiMatchSnapshot(chai: any, utils: any) {
  const Assertion = chai.Assertion;

  Assertion.addMethod('matchSnapshot', function(snapshotName: string, options: MatchOptions) {
    let obj = this._obj;
    try {
      matchSnapshot(obj, snapshotName, options, currentContext);
    } catch (ex) {
      if (ex.actual && ex.expected) {
        new Assertion(ex.actual).to.equal(ex.expected, 'Snapshots do not match');
      }
      throw ex;
    }
  });
}

export { config } from './config';
export { setupMocha } from './mocha';

export default chaiMatchSnapshot;
