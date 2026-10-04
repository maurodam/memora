#!/usr/bin/env node
// Test-only JSON Lines peer. It does not use ImageCaptureCore or claim hardware support.
import { createInterface } from 'node:readline';
import { promises as fs } from 'node:fs';
import path from 'node:path';
let active;
const reply = (requestId, data) =>
  process.stdout.write(JSON.stringify({ requestId, ...data }) + '\n');
createInterface({ input: process.stdin }).on('line', async (line) => {
  const request = JSON.parse(line);
  if (request.command === 'listDevices') {
    reply(request.requestId, {
      success: true,
      devices: ['flatbed', 'unsafe', 'crash'].map((id) => ({
        id,
        name: `Fixture ${id}`,
        resolutions: [300, 600],
        formats: ['jpeg', 'png'],
      })),
    });
    return;
  }
  if (request.command === 'cancel') {
    if (active) {
      clearTimeout(active.timer);
      reply(active.requestId, { success: true, cancelled: true });
      active = undefined;
    }
    reply(request.requestId, { success: true });
    return;
  }
  if (request.command === 'scan') {
    if (request.deviceId === 'crash') process.exit(1);
    if (request.deviceId === 'unsafe') {
      reply(request.requestId, { success: true, filePath: process.env.ALBUMSCANNER_FIXTURE_IMAGE });
      return;
    }
    active = {
      requestId: request.requestId,
      timer: setTimeout(
        async () => {
          const output = path.join(request.destination, 'scan.png');
          await fs.copyFile(process.env.ALBUMSCANNER_FIXTURE_IMAGE, output);
          reply(request.requestId, { success: true, filePath: output });
          active = undefined;
        },
        request.dpi === 300 ? 2000 : 10,
      ),
    };
  }
});
