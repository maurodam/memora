import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import electron from 'electron';
if (process.platform !== 'darwin') throw new Error('AlbumScanner supporta solo macOS.');
const run = (file, args) =>
  spawn(file, args, { stdio: 'inherit', env: { ...process.env, NG_CLI_ANALYTICS: 'false' } });
const initial = run(process.execPath, [
  'node_modules/@angular/cli/bin/ng.js',
  'build',
  '--configuration',
  'development',
]);
if (await new Promise((resolve) => initial.on('exit', resolve))) process.exit(1);
await import('./build-electron.mjs');
let app = run(electron, ['.', '--development']);
const angular = run(process.execPath, [
  'node_modules/@angular/cli/bin/ng.js',
  'build',
  '--watch',
  '--configuration',
  'development',
]);
// Electron/preload edits require restart; Angular output reload is handled in main.
let restartTimer;
let restarting = false;
async function restart() {
  if (closing || restarting) return;
  restarting = true;
  app.kill();
  await new Promise((resolve) => (app.exitCode !== null ? resolve() : app.once('exit', resolve)));
  try {
    await import(`./build-electron.mjs?time=${Date.now()}`);
    if (!closing) app = run(electron, ['.', '--development']);
  } catch (error) {
    console.error(error.message);
  } finally {
    restarting = false;
  }
}
const watcher = watch('electron', { recursive: true }, (_, name) => {
  if (!name?.endsWith('.ts')) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(restart, 200);
});
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  clearTimeout(restartTimer);
  watcher.close();
  angular.kill();
  app.kill();
  process.exit();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
angular.on('exit', close);
