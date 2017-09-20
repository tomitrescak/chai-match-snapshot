export class Exception extends Error {
    public filename: string;
    public methodName: string;
    public title: string;
    public className: string;
    constructor(public message: string) {
        super(message);
    }
}

export class SnapshotException extends Exception {
    public expected: string;
    public actual: string;
    public name: string;
    constructor(public message: string, actual: string, expected: string, name: string) {
        super(message);
        this.expected = expected;
        this.actual = actual;
        this.name = name;
    }
}