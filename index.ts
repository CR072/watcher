import { watch as fsWatch, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import type { FSWatcher, WatchOptions } from 'fs';

type WatchCallback = (path: string) => void;
type CleanupFunction = () => void;

export default function watchDirectory(watchPath: string, callback: WatchCallback): CleanupFunction {
    if (!existsSync(watchPath)) throw new Error('Invalid watch path');

    const watchers = new Map<string, FSWatcher>();
    const debounceMap = new Map<string, NodeJS.Timeout>();
    const ignorePatterns = [/^\./, /node_modules/, /\$RECYCLE.BIN/, /System Volume Information/];

    function shouldIgnore(pathToCheck: string): boolean {
        return ignorePatterns.some(pattern => pattern.test(basename(pathToCheck)));
    }

    function debounce(key: string, fn: () => void, delay = 100): void {
        if (debounceMap.has(key)) clearTimeout(debounceMap.get(key)!);
        debounceMap.set(key, setTimeout(() => {
            debounceMap.delete(key);
            fn();
        }, delay));
    }

    function watchDir(dirPath: string): void {
        if (watchers.has(dirPath) || shouldIgnore(dirPath)) return;

        try {
            const options: WatchOptions = { persistent: true };
            const watcher = fsWatch(dirPath, options);
            
            watcher.on('error', () => {
                watcher.close();
                watchers.delete(dirPath);
                setTimeout(() => watchDir(dirPath), 1000);
            });

            watcher.on('change', (eventType: string, filename: string | null) => {
                if (!filename) return;
                const fullPath = join(dirPath, filename);
                if (shouldIgnore(fullPath)) return;
                
                debounce(fullPath, () => callback(fullPath));

                if (existsSync(fullPath)) {
                    try {
                        const stat = statSync(fullPath);
                        if (stat.isDirectory()) watchDir(fullPath);
                    } catch (e) {
                        // IGNORE
                    }
                }
            });

            watchers.set(dirPath, watcher);

            readdirSync(dirPath)
                .filter(entry => !shouldIgnore(entry))
                .map(entry => join(dirPath, entry))
                .filter(fullPath => {
                    try {
                        return statSync(fullPath).isDirectory();
                    } catch (e) {
                        return false;
                    }
                })
                .forEach(watchDir);
        } catch (error) {
            // IGNORE
        }
    }

    watchDir(watchPath);

    return function cleanup(): void {
        for (const watcher of watchers.values()) {
            try {
                watcher.close();
            } catch (e) {
                // IGNORE
            }
        }
        watchers.clear();
        for (const timeoutId of debounceMap.values()) {
            clearTimeout(timeoutId);
        }
        debounceMap.clear();
    };
}
