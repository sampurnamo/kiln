'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolvePaths, projectAgentsMd, normalizeRuntime } = require('./paths');
const { writeManifest, computeChecksum } = require('./manifest');
const { insertProtocol } = require('./markers');
const VERSION = require('../package.json').version;
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

function resolveInstallTarget(projectPath) {
  const resolvedProjectPath = path.resolve(projectPath || process.cwd());
  return {
    projectPath: resolvedProjectPath,
    claudeMdPath: path.join(resolvedProjectPath, 'CLAUDE.md'),
  };
}

function resolveRuntimeTargets(runtime) {
  const selected = String(runtime || 'claude').toLowerCase();
  if (selected === 'hybrid') {
    return ['claude', 'codex'];
  }
  return [normalizeRuntime(selected)];
}

function protocolSourceForRuntime(runtime) {
  if (runtime === 'codex') {
    return path.join(ASSETS_DIR, 'protocol-codex.md');
  }
  return path.join(ASSETS_DIR, 'protocol.md');
}

function protocolTargetPath(projectPath, runtime) {
  if (runtime === 'codex') {
    return projectAgentsMd(projectPath);
  }
  return path.join(projectPath, 'CLAUDE.md');
}

function installSingleRuntime({ home, force, projectPath, runtime }) {
  const paths = resolvePaths(home, runtime);
  const { agentsDir, commandsDir, dataDir, kilntwoDir, skillsDir, templatesDir } = paths;
  const installTarget = resolveInstallTarget(projectPath);

  fs.mkdirSync(agentsDir, { recursive: true });
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(kilntwoDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.mkdirSync(templatesDir, { recursive: true });

  const installed = [];
  const skipped = [];

  const copyJobs = [
    { srcDir: path.join(ASSETS_DIR, 'agents'), destDir: agentsDir, ext: '.md' },
    { srcDir: path.join(ASSETS_DIR, 'commands', 'kiln'), destDir: commandsDir, ext: '.md' },
    { srcDir: path.join(ASSETS_DIR, 'data'), destDir: dataDir, ext: '.json' },
    { srcDir: path.join(ASSETS_DIR, 'skills'), destDir: skillsDir, ext: '.md' },
    { srcDir: path.join(ASSETS_DIR, 'templates'), destDir: templatesDir, ext: '.md' },
  ];

  for (const { srcDir, destDir, ext } of copyJobs) {
    let filenames;
    try {
      filenames = fs.readdirSync(srcDir).filter((entry) => entry.endsWith(ext)).sort();
    } catch {
      continue;
    }

    for (const filename of filenames) {
      const srcPath = path.join(srcDir, filename);
      const destPath = path.join(destDir, filename);

      if (force) {
        fs.copyFileSync(srcPath, destPath);
        installed.push(destPath);
        continue;
      }

      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        installed.push(destPath);
        continue;
      }

      const destChecksum = computeChecksum(destPath);
      const srcChecksum = computeChecksum(srcPath);

      if (destChecksum === srcChecksum) {
        installed.push(destPath);
      } else {
        console.error(`[kiln] skipping ${destPath} (user-edited; use --force to overwrite)`);
        skipped.push(destPath);
      }
    }
  }

  // Remove legacy kw-* agent files from a prior naming era
  try {
    const agentFiles = fs.readdirSync(agentsDir);
    for (const file of agentFiles) {
      if (file.startsWith('kw-') && file.endsWith('.md')) {
        const legacyPath = path.join(agentsDir, file);
        try {
          fs.unlinkSync(legacyPath);
          console.error(`[kiln] removing legacy agent: ${file}`);
        } catch {
          // per-file deletion failure — not fatal, continue with remaining files
        }
      }
    }
  } catch {
    // agentsDir read failed — not fatal
  }

  // Copy names.json to kilntwoDir
  const namesSrc = path.join(ASSETS_DIR, 'names.json');
  const namesDest = path.join(kilntwoDir, 'names.json');
  if (force || !fs.existsSync(namesDest)) {
    fs.copyFileSync(namesSrc, namesDest);
    installed.push(namesDest);
  } else {
    const destChecksum = computeChecksum(namesDest);
    const srcChecksum = computeChecksum(namesSrc);
    if (destChecksum === srcChecksum) {
      installed.push(namesDest);
    } else {
      console.error(`[kiln] skipping ${namesDest} (user-edited; use --force to overwrite)`);
      skipped.push(namesDest);
    }
  }

  const protocolSrc = protocolSourceForRuntime(runtime);
  const protocolContent = fs.readFileSync(protocolSrc, 'utf8');
  const protocolTarget = protocolTargetPath(installTarget.projectPath, runtime);
  insertProtocol(protocolTarget, protocolContent, VERSION);

  const files = installed.map((destPath) => ({
    path: path.relative(paths.platformDir, destPath),
    checksum: computeChecksum(destPath),
  }));

  const manifestPayload = {
    manifestVersion: 1,
    kilnVersion: VERSION,
    installedAt: new Date().toISOString(),
    runtime,
    files,
    protocolMarkers: {
      begin: 'kiln:protocol:begin',
      end: 'kiln:protocol:end',
    },
    projectPath: installTarget.projectPath,
    protocolTargetPath: protocolTarget,
  };

  // Backward-compatible fields used by old uninstall/update flows.
  if (runtime === 'claude') {
    manifestPayload.claudeMdPath = protocolTarget;
  } else {
    manifestPayload.agentsMdPath = protocolTarget;
  }

  writeManifest(manifestPayload, home, runtime);

  return { installed, skipped };
}

/**
 * @param {object}  [opts={}]
 * @param {string}  [opts.home]        - override home directory (default: os.homedir() via resolvePaths)
 * @param {boolean} [opts.force=false] - overwrite user-edited files when true
 * @param {string}  [opts.projectPath] - project root whose CLAUDE.md receives the protocol block
 *                                       (default: process.cwd())
 * @param {string}  [opts.runtime='claude'] - runtime install target: claude, codex, or hybrid
 * @returns {{ installed: string[], skipped: string[], version: string }}
 */
function install({ home, force = false, projectPath, runtime = 'claude' } = {}) {
  const installed = [];
  const skipped = [];
  const targets = resolveRuntimeTargets(runtime);
  for (const targetRuntime of targets) {
    const result = installSingleRuntime({
      home,
      force,
      projectPath,
      runtime: targetRuntime,
    });
    installed.push(...result.installed);
    skipped.push(...result.skipped);
  }

  return {
    installed,
    skipped,
    version: VERSION,
    runtime: runtime || 'claude',
    targets,
  };
}

module.exports = {
  install, // ({ home?, force?, projectPath? }?) => { installed: string[], skipped: string[], version: string }
};
