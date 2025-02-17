import watch from './dist/index.js';
import { resolve } from 'path';

const path = resolve('./');

watch(path, (file) => {
    console.log(`File changed: ${file}`);
    console.log(`Change detected at: ${new Date().toISOString()}`);
});

console.log(`Watching directory: ${path}`);
console.log('Press Ctrl+C to stop');

process.stdin.resume();