import { watch as fsWatch, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
export default function watchDirectory(watchPath, callback) {
    if (!existsSync(watchPath))
        throw new Error('Invalid watch path');
    const watchers = new Map();
    const debounceMap = new Map();
    const ignorePatterns = [/^\./, /node_modules/, /\$RECYCLE.BIN/, /System Volume Information/];
    function shouldIgnore(pathToCheck) {
        return ignorePatterns.some(pattern => pattern.test(basename(pathToCheck)));
    }
    function debounce(key, fn, delay = 100) {
        if (debounceMap.has(key))
            clearTimeout(debounceMap.get(key));
        debounceMap.set(key, setTimeout(() => {
            debounceMap.delete(key);
            fn();
        }, delay));
    }
    function watchDir(dirPath) {
        if (watchers.has(dirPath) || shouldIgnore(dirPath))
            return;
        try {
            const options = { persistent: true };
            const watcher = fsWatch(dirPath, options);
            watcher.on('error', () => {
                watcher.close();
                watchers.delete(dirPath);
                setTimeout(() => watchDir(dirPath), 1000);
            });
            watcher.on('change', (eventType, filename) => {
                if (!filename)
                    return;
                const fullPath = join(dirPath, filename);
                if (shouldIgnore(fullPath))
                    return;
                debounce(fullPath, () => callback(fullPath));
                if (existsSync(fullPath)) {
                    try {
                        const stat = statSync(fullPath);
                        if (stat.isDirectory())
                            watchDir(fullPath);
                    }
                    catch (e) {
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
                }
                catch (e) {
                    return false;
                }
            })
                .forEach(watchDir);
        }
        catch (error) {
            // IGNORE
        }
    }
    watchDir(watchPath);
    return function cleanup() {
        for (const watcher of watchers.values()) {
            try {
                watcher.close();
            }
            catch (e) {
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
