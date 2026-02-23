'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolvePaths, normalizeRuntime } = require('./paths.js');
const { readManifest, computeChecksum, validateManifest } = require('./manifest.js');
const { install } = require('./install.js');
const currentVersion = require('../package.json').version;

function sortPaths(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function resolveManifestProjectPath(manifest) {
  if (manifest && typeof manifest.projectPath === 'string' && manifest.projectPath.length > 0) {
    return manifest.projectPath;
  }

  if (manifest && typeof manifest.protocolTargetPath === 'string' && manifest.protocolTargetPath.length > 0) {
    return path.dirname(manifest.protocolTargetPath);
  }

  if (manifest && typeof manifest.claudeMdPath === 'string' && manifest.claudeMdPath.length > 0) {
    return path.dirname(manifest.claudeMdPath);
  }

  if (manifest && typeof manifest.agentsMdPath === 'string' && manifest.agentsMdPath.length > 0) {
    return path.dirname(manifest.agentsMdPath);
  }

  if (
    manifest &&
    manifest.installTarget &&
    typeof manifest.installTarget.projectPath === 'string' &&
    manifest.installTarget.projectPath.length > 0
  ) {
    return manifest.installTarget.projectPath;
  }

  if (
    manifest &&
    manifest.installTarget &&
    typeof manifest.installTarget.claudeMdPath === 'string' &&
    manifest.installTarget.claudeMdPath.length > 0
  ) {
    return path.dirname(manifest.installTarget.claudeMdPath);
  }

  return null;
}

function buildPreviousChecksumMap(manifest, home) {
  const previousState = new Map();
  const files = Array.isArray(manifest && manifest.files) ? manifest.files : [];
  const runtime = normalizeRuntime(manifest && manifest.runtime);
  const { platformDir } = resolvePaths(home, runtime);

  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.checksum !== 'string') {
      continue;
    }
    if (file.path.includes('..')) {
      throw new Error(`Manifest entry contains path traversal: ${file.path}`);
    }
    const absolutePath = path.resolve(platformDir, file.path);
    if (!absolutePath.startsWith(platformDir + path.sep)) {
      throw new Error(`Refusing to operate outside runtime directory: ${file.path}`);
    }
    previousState.set(absolutePath, {
      checksum: file.checksum,
      existed: fs.existsSync(absolutePath),
    });
  }

  return previousState;
}

async function updateSingleRuntime({ home, force, runtime }) {
  const manifest = readManifest({ home, runtime });

  if (!manifest) {
    return { error: 'not-installed', hint: `Run kilntwo install --runtime ${runtime} first` };
  }

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid manifest: ${validation.errors.join('; ')}`);
  }

  const previousState = buildPreviousChecksumMap(manifest, home);
  const targetProjectPath = resolveManifestProjectPath(manifest);
  const oldVersion = manifest.kilnVersion;
  const installResult = install({
    home,
    force: Boolean(force),
    projectPath: targetProjectPath || undefined,
    runtime,
  });
  const installed = sortPaths(Array.isArray(installResult.installed) ? installResult.installed : []);
  const skipped = sortPaths(Array.isArray(installResult.skipped) ? installResult.skipped : []);
  const updated = [];
  const unchanged = [];

  for (const installedPath of installed) {
    const prior = previousState.get(installedPath);
    const nextChecksum = computeChecksum(installedPath);
    if (!prior || prior.existed === false || prior.checksum !== nextChecksum) {
      updated.push(installedPath);
    } else {
      unchanged.push(installedPath);
    }
  }

  if (oldVersion === currentVersion && updated.length === 0 && skipped.length === 0) {
    return { status: 'up-to-date', version: currentVersion, unchanged, runtime };
  }

  const updates = [
    ...updated.map((filePath) => ({ path: filePath, status: 'updated' })),
    ...skipped.map((filePath) => ({ path: filePath, status: 'skipped' })),
  ].sort((a, b) => a.path.localeCompare(b.path));

  return {
    status: 'updated',
    from: oldVersion,
    to: currentVersion,
    updates,
    updated,
    skipped,
    unchanged,
    installed,
    runtime,
  };
}

async function update({ home, force, runtime = 'claude' } = {}) {
  const requested = String(runtime || 'claude').toLowerCase();
  if (requested === 'hybrid') {
    const claude = await updateSingleRuntime({ home, force, runtime: 'claude' });
    const codex = await updateSingleRuntime({ home, force, runtime: 'codex' });
    const updated = sortPaths([...(claude.updated || []), ...(codex.updated || [])]);
    const skipped = sortPaths([...(claude.skipped || []), ...(codex.skipped || [])]);
    const unchanged = sortPaths([...(claude.unchanged || []), ...(codex.unchanged || [])]);
    const installed = sortPaths([...(claude.installed || []), ...(codex.installed || [])]);
    const updates = [
      ...updated.map((p) => ({ path: p, status: 'updated' })),
      ...skipped.map((p) => ({ path: p, status: 'skipped' })),
    ];
    return {
      status: 'updated',
      from: `${claude.from || 'n/a'}|${codex.from || 'n/a'}`,
      to: `${claude.to || currentVersion}|${codex.to || currentVersion}`,
      updates,
      updated,
      skipped,
      unchanged,
      installed,
      runtime: 'hybrid',
      targets: { claude, codex },
    };
  }

  return updateSingleRuntime({
    home,
    force,
    runtime: normalizeRuntime(requested),
  });
}

module.exports = { update };
