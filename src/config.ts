export type Task = {
    title: string;
    className: string;
    cssClassName: string;
    decorator: string;
};

export type TestFunctionCall = {
  name: string;
  calls: number;
};

export type SnapshotItem = {
  className: string;
  content: any;
  calls: TestFunctionCall[]
};

export type SnapshotMode = 'tcp' | 'drive' | 'both' | 'test';

export type Config = {
  currentTask: Task;
  snapshotCalls: SnapshotItem[];
  snapshotDir: string;
  snapshotExtension: string;
  snapshotMode: SnapshotMode;
  onProcessSnapshots(taskName: string, snapshotName: string, current: string, expected: string): { actual?: string, expected?: string };
  replacer(key: string, value: any): any;
  serializer(obj: any): string;
  snapshotLoader(path: string, className: string): object;
  writeSnapshots(): void;
};

export function parseStoryName(longName: string) {
  let fileName = longName;
  let folder = null;
  let story = longName;

  const parts = longName.split('/');
  if (parts.length > 1) {
    folder = parts.slice(0, parts.length - 1).join('/');
    story = parts[parts.length - 1];
    fileName = parts.join('_');
  }

  // remove white spaced from file
  fileName = fileName.replace(/\s/g, '');

  return {
    fileName,
    folder,
    story
  };
}

export const config: Config = {
  snapshotDir: '',
  serializer(obj: any): string {
    throw new Error('Please create your initialiser');
  },
  currentTask: null,
  snapshotCalls: null,
  snapshotLoader: null,
  replacer: null,
  snapshotMode: 'test',
  snapshotExtension: 'json',
  onProcessSnapshots: null,
  writeSnapshots: null
};
