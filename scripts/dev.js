import { spawn } from 'node:child_process';
import process from 'node:process';

const children = [];

function run(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }

    for (const current of children) {
      if (current !== child && !current.killed) {
        current.kill('SIGTERM');
      }
    }
  });

  child.on('error', (error) => {
    console.error(`[${name}]`, error);
    process.exitCode = 1;
  });

  children.push(child);
}

run('server', 'npm', ['--prefix', 'server', 'run', 'dev']);
run('client', 'npm', ['--prefix', 'client', 'run', 'dev']);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }
    process.exit();
  });
}
