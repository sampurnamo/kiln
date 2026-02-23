'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { resolvePaths, normalizeRuntime } = require('./paths');
const { readManifest, validateManifest } = require('./manifest');
const { removeProtocol } = require('./markers');

function resolveManifestProtocolPath(manifest) {
  if (manifest && typeof manifest.protocolTargetPath === 'string' && manifest.protocolTargetPath.length > 0) {
    return manifest.protocolTargetPath;
  }

  if (manifest && typeof manifest.claudeMdPath === 'string' && manifest.claudeMdPath.length > 0) {
    return manifest.claudeMdPath;
  }

  if (manifest && typeof manifest.agentsMdPath === 'string' && manifest.agentsMdPath.length > 0) {
    return manifest.agentsMdPath;
  }

  if (
    manifest &&
    manifest.installTarget &&
    typeof manifest.installTarget.claudeMdPath === 'string' &&
    manifest.installTarget.claudeMdPath.length > 0
  ) {
    return manifest.installTarget.claudeMdPath;
  }

  if (manifest && typeof manifest.projectPath === 'string' && manifest.projectPath.length > 0) {
    return path.join(manifest.projectPath, 'CLAUDE.md');
  }

  if (
    manifest &&
    manifest.installTarget &&
    typeof manifest.installTarget.projectPath === 'string' &&
    manifest.installTarget.projectPath.length > 0
  ) {
    return path.join(manifest.installTarget.projectPath, 'CLAUDE.md');
  }

  return null;
}

function uninstallSingleRuntime({ home, runtime }) {
  const normalizedRuntime = normalizeRuntime(runtime);
  const paths = resolvePaths(home, normalizedRuntime);
  const { commandsDir, kilntwoDir, skillsDir, templatesDir, manifestPath, platformDir } = paths;

  const manifest = readManifest({ manifestPath });
  if (manifest === null) {
    return { error: 'not-installed' };
  }

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid manifest: ${validation.errors.join('; ')}`);
  }

  const removed = [];
  const notFound = [];

  for (const file of manifest.files) {
    if (file.path.includes('..')) {
      throw new Error(`Manifest entry contains path traversal: ${file.path}`);
    }
    const absolutePath = path.resolve(platformDir, file.path);
    if (!absolutePath.startsWith(platformDir + path.sep)) {
      throw new Error(`Refusing to operate outside runtime directory: ${file.path}`);
    }
    try {
      fs.unlinkSync(absolutePath);
      removed.push(absolutePath);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        notFound.push(absolutePath);
        continue;
      }
      throw error;
    }
  }

  const protocolPath = resolveManifestProtocolPath(manifest);
  if (protocolPath !== null) {
    removeProtocol(protocolPath);
  }

  for (const dirPath of [templatesDir, skillsDir, kilntwoDir, commandsDir]) {
    try {
      fs.rmdirSync(dirPath);
    } catch (error) {
      if (
        error &&
        (error.code === 'ENOENT' ||
          error.code === 'ENOTEMPTY' ||
          error.code === 'EEXIST')
      ) {
        continue;
      }
      throw error;
    }
  }

  try {
    fs.unlinkSync(manifestPath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }

  return { removed, notFound, runtime: normalizedRuntime };
}

function uninstall({ home, runtime = 'claude' } = {}) {
  const requested = String(runtime || 'claude').toLowerCase();
  if (requested === 'hybrid') {
    const claude = uninstallSingleRuntime({ home, runtime: 'claude' });
    const codex = uninstallSingleRuntime({ home, runtime: 'codex' });
    return {
      removed: [...(claude.removed || []), ...(codex.removed || [])],
      notFound: [...(claude.notFound || []), ...(codex.notFound || [])],
      runtime: 'hybrid',
      targets: { claude, codex },
    };
  }
  return uninstallSingleRuntime({ home, runtime: normalizeRuntime(requested) });
}

module.exports = { uninstall };
