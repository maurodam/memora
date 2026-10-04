import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import path from 'node:path';
const binary =
  process.env.ALBUMSCANNER_HELPER ||
  path.resolve('native/macos-scanner/.build/release/macos-scanner');
const helper = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
const responses = new Map();
const pending = new Map();
let stderr = '';
helper.stderr.on('data', (data) => {
  stderr += data;
});
createInterface({ input: helper.stdout }).on('line', (line) => {
  const value = JSON.parse(line);
  responses.set(value.requestId, value);
  pending.get(value.requestId)?.(value);
});
helper.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
const request = (command, requestId) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Helper timeout. ${stderr}`)), 15000);
    pending.set(requestId, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
    helper.stdin.write(JSON.stringify({ command, requestId }) + '\n');
  });
try {
  const list = await request('listDevices', 'list');
  assert.equal(list.success, true);
  assert.ok(Array.isArray(list.devices));
  const unknown = await request('unknown', 'unknown');
  assert.equal(unknown.success, false);
  assert.equal(unknown.code, 'UNKNOWN_COMMAND');
  const absent = await request('scan', 'missing');
  assert.equal(absent.success, false);
  assert.equal(absent.code, 'SCANNER_UNAVAILABLE');
  const cancel = await request('cancel', 'cancel');
  assert.equal(cancel.success, true);
  console.log(
    `PASS: ImageCaptureCore helper, JSON protocol, ${list.devices.length} scanner disponibili.`,
  );
  console.log(JSON.stringify({ devices: list.devices }));
} finally {
  helper.stdin.end();
  helper.kill();
}
