import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { UserError } from '../files/file-store';
export interface HelperResponse {
  requestId: string;
  success: boolean;
  code?: string;
  message?: string;
  devices?: unknown;
  filePath?: string;
  cancelled?: boolean;
}
export class JsonLineClient {
  private child?: ChildProcessWithoutNullStreams;
  private buffer = '';
  private readonly pending = new Map<
    string,
    {
      resolve: (value: HelperResponse) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  constructor(
    private executable: string,
    private args: string[] = [],
  ) {}
  request(command: Record<string, unknown>, timeoutMs = 15000): Promise<HelperResponse> {
    this.start();
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.stop(new UserError('SCANNER_TIMEOUT', 'Lo scanner non risponde. Riprova.')),
        timeoutMs,
      );
      this.pending.set(requestId, { resolve, reject, timer });
      this.child!.stdin.write(JSON.stringify({ ...command, requestId }) + '\n', (error) => {
        if (error)
          this.stop(new UserError('HELPER_CRASH', 'Comunicazione con lo scanner interrotta.'));
      });
    });
  }
  private start(): void {
    if (this.child) return;
    this.buffer = '';
    const child = spawn(this.executable, this.args, { stdio: 'pipe', shell: false });
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (this.child !== child) return;
      this.buffer += chunk;
      if (this.buffer.length > 1_048_576) {
        this.stop(new UserError('HELPER_PROTOCOL', 'Risposta scanner non valida.'));
        return;
      }
      let newline: number;
      while ((newline = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          this.stop(new UserError('HELPER_PROTOCOL', 'Risposta scanner non valida.'));
          return;
        }
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          !('requestId' in parsed) ||
          typeof parsed.requestId !== 'string' ||
          !('success' in parsed) ||
          typeof parsed.success !== 'boolean'
        ) {
          this.stop(new UserError('HELPER_PROTOCOL', 'Risposta scanner non valida.'));
          return;
        }
        const response = parsed as HelperResponse;
        const waiter = this.pending.get(response.requestId);
        if (!waiter) continue;
        clearTimeout(waiter.timer);
        this.pending.delete(response.requestId);
        waiter.resolve(response);
      }
    });
    // Never forward native diagnostics or stack traces into Angular.
    child.stderr.on('data', () => undefined);
    child.on('error', () => {
      if (this.child === child)
        this.stop(
          new UserError(
            'HELPER_UNAVAILABLE',
            'Helper scanner non disponibile. Esegui npm run scanner:build.',
          ),
        );
    });
    child.on('exit', () => {
      if (this.child === child)
        this.stop(new UserError('HELPER_CRASH', 'Helper scanner arrestato. Riprova.'));
    });
    child.stdin.on('error', () => {
      if (this.child === child)
        this.stop(new UserError('HELPER_CRASH', 'Comunicazione con lo scanner interrotta.'));
    });
  }
  stop(reason: Error = new UserError('HELPER_STOPPED', 'Helper scanner arrestato.')): void {
    const child = this.child;
    this.child = undefined;
    this.buffer = '';
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(reason);
    }
    this.pending.clear();
    child?.kill();
  }
}
