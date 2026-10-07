const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');
const customerPortal = path.join(workspaceRoot, 'customer_portal');
const buildDirectory = path.join(customerPortal, 'build');
const privateKey = path.join(os.homedir(), '.ssh', 'pastryproject_live_deploy_ed25519');
const host = '145.79.30.228';
const port = '65002';
const username = 'u446555584';
const remoteCustomerRoot = 'domains/pastryproject.shop/public_html/customer_portal';
const sshOptions = [
  '-T',
  '-i', privateKey,
  '-p', port,
  '-o', 'IdentitiesOnly=yes',
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=yes',
  '-o', 'ConnectTimeout=15',
  '-o', 'ServerAliveInterval=10',
  '-o', 'ServerAliveCountMax=3',
];

let timer;
let activeChild;
let deployRunning = false;
let deployQueued = false;
let shuttingDown = false;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: customerPortal,
      env: { ...process.env, CI: 'false' },
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
      ...options,
    });
    activeChild = child;

    child.once('error', (error) => {
      activeChild = null;
      reject(error);
    });
    child.once('close', (code, signal) => {
      activeChild = null;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${signal || `code ${code}`}`));
      }
    });
  });
}

async function deploy(reason) {
  if (deployRunning || shuttingDown) {
    deployQueued = true;
    return;
  }

  deployRunning = true;
  deployQueued = false;
  const deploymentId = `${Date.now()}-${process.pid}`;
  const stage = `${remoteCustomerRoot}/.live-deploy-${deploymentId}`;
  const backup = `${remoteCustomerRoot}/.live-backup-${deploymentId}`;
  const remote = `${username}@${host}`;

  console.log(`Building customer website (${reason})...`);
  try {
    await run(process.execPath, [
      path.join('node_modules', 'react-scripts', 'scripts', 'build.js'),
    ]);

    if (!fs.existsSync(path.join(buildDirectory, 'index.html'))) {
      throw new Error('Build completed without customer_portal/build/index.html.');
    }

    await run('ssh', [
      ...sshOptions,
      remote,
      `mkdir -p '${stage}'`,
    ]);

    await run('scp', [
      '-r',
      '-i', privateKey,
      '-P', port,
      '-o', 'IdentitiesOnly=yes',
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=yes',
      buildDirectory,
      `${remote}:${stage}`,
    ]);

    const publishCommand = [
      'set -eu',
      `root='${remoteCustomerRoot}'`,
      `stage="$root/.live-deploy-${deploymentId}"`,
      `target="$root/build"`,
      `backup="$root/.live-backup-${deploymentId}"`,
      'test -f "$stage/build/index.html"',
      'had_previous=0',
      'rollback() {',
      '  result=$?',
      '  if [ "$had_previous" -eq 1 ] && [ ! -e "$target" ] && [ -e "$backup" ]; then mv -- "$backup" "$target"; fi',
      '  rm -rf -- "$stage"',
      '  exit "$result"',
      '}',
      'trap rollback EXIT',
      'if [ -e "$target" ]; then mv -- "$target" "$backup"; had_previous=1; fi',
      'mv -- "$stage/build" "$target"',
      'rm -rf -- "$backup" "$stage"',
      'trap - EXIT',
    ].join('\n');

    await run('ssh', [
      ...sshOptions,
      remote,
      publishCommand,
    ]);
    console.log('Live customer website updated successfully.');
  } catch (error) {
    console.error(`Live deployment failed: ${error.message}`);
    console.error('The current live build was left in place unless the final publish step had already completed.');
  } finally {
    deployRunning = false;
    if (deployQueued && !shuttingDown) {
      deployQueued = false;
      scheduleDeploy('queued file save');
    }
  }
}

function scheduleDeploy(reason) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    if (deployRunning) {
      deployQueued = true;
      return;
    }
    void deploy(reason);
  }, 1200);
}

if (!fs.existsSync(privateKey)) {
  console.error(`Dedicated Hostinger deploy key not found: ${privateKey}`);
  process.exit(1);
}

const watchDirectories = ['src', 'public'].map((directory) => path.join(customerPortal, directory));
const watchers = watchDirectories.map((directory) => {
  if (!fs.existsSync(directory)) {
    throw new Error(`Cannot watch missing customer portal directory: ${directory}`);
  }
  return fs.watch(directory, { recursive: true }, (event, filename) => {
    const changedFile = filename ? filename.toString() : 'a customer portal file';
    console.log(`Detected ${event}: ${changedFile}`);
    scheduleDeploy(changedFile);
  });
});

for (const watcher of watchers) {
  watcher.on('error', (error) => {
    console.error(`Customer portal file watcher failed: ${error.message}`);
    process.exitCode = 1;
    shutdown();
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (timer) clearTimeout(timer);
  for (const watcher of watchers) watcher.close();
  if (activeChild) activeChild.kill();
  console.log('Auto-deploy watcher stopped.');
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

console.log('Watching customer portal source and public files for live deployment.');
void deploy('initial local build');
