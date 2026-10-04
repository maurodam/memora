import { spawn } from 'node:child_process';
if (process.platform !== 'darwin') throw new Error('Il helper richiede macOS.');
const build = spawn('swift', ['build', '--package-path', 'native/macos-scanner', '-c', 'release'], {
  stdio: 'inherit',
});
const code = await new Promise((resolve) => {
  build.on('exit', resolve);
  build.on('error', (e) => {
    console.error(e.message);
    resolve(1);
  });
});
process.exit(Number(code) || 0);
