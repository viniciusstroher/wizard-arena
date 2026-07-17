import { spawn } from 'child_process';

const PORT = process.env.PORT || 3080;

const children = [];

function start(command, args, name) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] stopped (${signal})`);
    } else if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
    }
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`Starting Wizard Arena + ngrok on port ${PORT}...`);
start('node', ['server/index.js'], 'server');
start('ngrok', ['http', String(PORT), '--log=stdout'], 'ngrok');
