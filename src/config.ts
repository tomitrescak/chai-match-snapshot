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
