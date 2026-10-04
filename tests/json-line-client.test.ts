import test from 'node:test';
import assert from 'node:assert/strict';
import { JsonLineClient } from '../electron/scanner/json-line-client';
const fixture = `
let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\\n')) >= 0) {
    const input = JSON.parse(buffer.slice(0,newline)); buffer = buffer.slice(newline+1);
    if (input.command === 'crash') { process.exit(1); return; }
    if (input.command === 'wait') continue;
    if (input.command === 'bad') { process.stdout.write('not-json\\n'); continue; }
    const response = JSON.stringify({requestId:input.requestId,success:true,devices:[],command:input.command})+'\\n';
    setTimeout(() => { process.stdout.write(response.slice(0,8)); setTimeout(() => process.stdout.write(response.slice(8)), 5); }, input.command === 'slow' ? 100 : 0);
  }
});`;
test('JSON Lines: frammenti e correlazione risposte fuori ordine', async () => {
  const client = new JsonLineClient(process.execPath, ['-e', fixture]);
  try {
    const slow = client.request({ command: 'slow' });
    const fast = client.request({ command: 'fast' });
    const results = await Promise.all([slow, fast]);
    assert.equal(results[0]!.success, true);
    assert.notEqual(results[0]!.requestId, results[1]!.requestId);
  } finally {
    client.stop();
  }
});
test('protocollo invalido e crash producono errori tipizzati', async () => {
  const client = new JsonLineClient(process.execPath, ['-e', fixture]);
  try {
    await assert.rejects(client.request({ command: 'bad' }), /non valida/);
    await assert.rejects(client.request({ command: 'crash' }), /arrestato/);
  } finally {
    client.stop();
  }
});
test('timeout arresta helper e rifiuta richieste pendenti', async () => {
  const client = new JsonLineClient(process.execPath, ['-e', fixture]);
  try {
    await assert.rejects(client.request({ command: 'wait' }, 100), /non risponde/);
    const response = await client.request({ command: 'fast' });
    assert.equal(response.success, true);
  } finally {
    client.stop();
  }
});
