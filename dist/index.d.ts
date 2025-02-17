type WatchCallback = (path: string) => void;
type CleanupFunction = () => void;
export default function watchDirectory(watchPath: string, callback: WatchCallback): CleanupFunction;
export {};
