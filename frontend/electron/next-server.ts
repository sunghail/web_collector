import { ChildProcess, fork } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import net from 'net';

let serverProcess: ChildProcess | null = null;

/**
 * Find server.js recursively in the standalone directory.
 * Next.js standalone preserves the full project path structure,
 * so server.js may be deeply nested.
 */
function findServerJs(dir: string): string | null {
  const candidate = path.join(dir, 'server.js');
  if (fs.existsSync(candidate)) return candidate;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        const found = findServerJs(path.join(dir, entry.name));
        if (found) return found;
      }
    }
  } catch {
    // ignore read errors
  }
  return null;
}

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        server.close(() => resolve(address.port));
      } else {
        server.close(() => reject(new Error('Could not determine port')));
      }
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

function waitForServer(port: number, timeout = 30000): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Server did not start within ${timeout}ms`));
        return;
      }

      const req = http.get(`http://localhost:${port}`, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        setTimeout(check, 500);
      });

      req.end();
    };

    check();
  });
}

export async function startNextServer(): Promise<number> {
  const port = await findAvailablePort(30101);

  const standaloneDir = path.join(process.resourcesPath, 'standalone');

  // Find server.js (may be nested due to Next.js standalone path preservation)
  let serverPath = path.join(standaloneDir, 'server.js');
  if (!fs.existsSync(serverPath)) {
    const found = findServerJs(standaloneDir);
    if (found) {
      serverPath = found;
    } else {
      throw new Error(`server.js not found in ${standaloneDir}`);
    }
  }

  const serverCwd = path.dirname(serverPath);

  console.log(`Starting Next.js server on port ${port}...`);
  console.log(`Server path: ${serverPath}`);
  console.log(`Server cwd: ${serverCwd}`);

  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: 'localhost',
      NODE_ENV: 'production',
      IS_ELECTRON: 'true',
    },
    cwd: serverCwd,
    stdio: 'pipe',
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[Next.js] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[Next.js Error] ${data.toString().trim()}`);
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start Next.js server:', err);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Next.js server exited with code ${code}`);
    serverProcess = null;
  });

  await waitForServer(port);
  console.log(`Next.js server is ready on port ${port}`);

  return port;
}

export function stopNextServer(): void {
  if (serverProcess) {
    console.log('Stopping Next.js server...');
    serverProcess.kill('SIGTERM');

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }, 5000);

    serverProcess = null;
  }
}
