'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { resolvePaths, normalizeRuntime } = require('./paths');
const { readManifest, computeChecksum, validateManifest } = require('./manifest');

function checkCliAvailable(cliName, { platform = process.platform, exec = execSync } = {}) {
  const lookupCommand = platform === 'win32' ? `where ${cliName}` : `command -v ${cliName}`;
  try {
    exec(lookupCommand, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runRuntimeDoctor({ home, strict, platform, exec, runtime }) {
  const checks = [];
  const paths = resolvePaths(home, runtime);

  const nodeVersion = process.versions.node;
  const major = Number.parseInt(String(nodeVersion).split('.')[0], 10);
  if (major >= 18) {
    checks.push({
      name: 'node-version',
      status: 'pass',
      message: `Node.js v${nodeVersion} (major ${major} >= 18)`,
    });
  } else {
    checks.push({
      name: 'node-version',
      status: 'fail',
      message: `Node.js v${nodeVersion} is below the required v18`,
    });
  }

  if (runtime === 'claude') {
    if (checkCliAvailable('claude', { platform, exec })) {
      checks.push({ name: 'claude-cli', status: 'pass', message: 'claude CLI found' });
    } else {
      checks.push({
        name: 'claude-cli',
        status: 'fail',
        message: 'claude CLI not found — install via npm i -g @anthropic-ai/claude-code',
      });
    }
  }

  if (runtime === 'codex') {
    if (checkCliAvailable('codex', { platform, exec })) {
      checks.push({ name: 'codex-cli', status: 'pass', message: 'codex CLI found' });
    } else {
      checks.push({
        name: 'codex-cli',
        status: 'fail',
        message: 'codex CLI not found — install via npm i -g @openai/codex',
      });
    }
  }

  if (checkCliAvailable('git', { platform, exec })) {
    checks.push({ name: 'git-cli', status: 'pass', message: 'git CLI found' });
  } else {
    checks.push({
      name: 'git-cli',
      status: 'fail',
      message: 'git CLI not found — pipeline requires git for branch management',
    });
  }

  try {
    fs.accessSync(paths.platformDir, fs.constants.W_OK);
    checks.push({
      name: `${runtime}-dir`,
      status: 'pass',
      message: `${paths.platformDir} exists and is writable`,
    });
  } catch {
    checks.push({
      name: `${runtime}-dir`,
      status: 'fail',
      message: `${paths.platformDir} is missing or not writable`,
    });
  }

  if (runtime === 'claude') {
    const settingsPath = path.join(paths.platformDir, 'settings.json');
    try {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (parsed && parsed.teams) {
        checks.push({ name: 'teams-enabled', status: 'pass', message: 'teams settings found' });
      } else {
        checks.push({
          name: 'teams-enabled',
          status: 'warn',
          message: '~/.claude/settings.json not found or teams not configured (non-fatal)',
        });
      }
    } catch {
      checks.push({
        name: 'teams-enabled',
        status: 'warn',
        message: '~/.claude/settings.json not found or teams not configured (non-fatal)',
      });
    }
  }

  const manifestPath = paths.manifestPath;
  const manifest = readManifest({ manifestPath });
  if (manifest) {
    const validation = validateManifest(manifest);
    if (validation.valid) {
      checks.push({ name: 'manifest', status: 'pass', message: 'manifest found and valid' });
    } else {
      checks.push({
        name: 'manifest',
        status: 'fail',
        message: `manifest is invalid: ${validation.errors.join('; ')}`,
      });
    }
  } else {
    checks.push({
      name: 'manifest',
      status: 'warn',
      message: `manifest not found for ${runtime} runtime — run kilntwo install --runtime ${runtime} first`,
    });
  }

  if (strict) {
    const strictManifest = readManifest({ manifestPath });
    if (!strictManifest) {
      checks.push({
        name: 'checksums',
        status: 'warn',
        message: 'manifest not found — skipping checksum verification',
      });
    } else {
      const strictValidation = validateManifest(strictManifest);
      if (!strictValidation.valid) {
        checks.push({
          name: 'checksums',
          status: 'fail',
          message: `skipped — manifest is invalid: ${strictValidation.errors.join('; ')}`,
        });
      } else {
        const files = Array.isArray(strictManifest.files) ? strictManifest.files : [];
        const total = files.length;
        let mismatches = 0;

        for (const file of files) {
          const checkedPath = path.resolve(paths.platformDir, file.path);
          if (!checkedPath.startsWith(paths.platformDir + path.sep)) {
            checks.push({
              name: 'checksums',
              status: 'fail',
              message: `path escapes runtime directory: ${file.path}`,
            });
            mismatches = -1;
            break;
          }
          try {
            const actual = computeChecksum(checkedPath);
            if (actual !== file.checksum) mismatches += 1;
          } catch {
            mismatches += 1;
          }
        }

        if (mismatches === -1) {
          // fail already emitted
        } else if (mismatches === 0) {
          checks.push({
            name: 'checksums',
            status: 'pass',
            message: `all ${total} file(s) match their checksums`,
          });
        } else {
          checks.push({
            name: 'checksums',
            status: 'warn',
            message: `${mismatches} of ${total} file(s) have checksum mismatches`,
          });
        }
      }
    }
  }

  return checks;
}

function doctor({ home, strict, platform = process.platform, exec = execSync, runtime } = {}) {
  const requested = runtime == null ? 'hybrid' : String(runtime).toLowerCase();
  let checks;

  if (requested === 'hybrid') {
    checks = [
      ...runRuntimeDoctor({ home, strict, platform, exec, runtime: 'claude' }),
      ...runRuntimeDoctor({ home, strict, platform, exec, runtime: 'codex' }),
    ];
  } else {
    checks = runRuntimeDoctor({
      home,
      strict,
      platform,
      exec,
      runtime: normalizeRuntime(requested),
    });
  }

  const ok = checks.every((c) => c.status !== 'fail');
  return { ok, checks, runtime: requested };
}

module.exports = { doctor };
