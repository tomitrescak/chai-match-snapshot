export type Task = {
    method?: string;
    title: string;
    fn?: Function;
    fileName?: string;
    className: string;
};

export type TestFunctionCall = {
  name: string;
  calls: number;
};

export type SnapshotItem = {
  className: string;
  content: object;
  calls: TestFunctionCall[]
};

export type Config = {
  snapshotDir: string;
  serializer: (obj: any) => string;
  currentTask: Task;
  snapshotCalls: SnapshotItem[];
  snapshotLoader(path: string, className: string): object;
  onProcessSnapshots(taskName: string, snapshotName: string, current: string, expected: string): void;
  snapshotExtension: string;
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
  snapshotExtension: 'json',
  onProcessSnapshots: null
};
