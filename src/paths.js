const path = require('node:path');
const os = require('node:os');

function normalizeRuntime(runtime) {
  const value = String(runtime || 'claude').toLowerCase();
  if (value === 'claude' || value === 'codex') {
    return value;
  }
  return 'claude';
}

function joinByStyle(base, ...segments) {
  const value = String(base || '');
  if (value.includes('\\')) {
    return path.win32.join(value, ...segments);
  }
  if (value.includes('/')) {
    return path.posix.join(value, ...segments);
  }
  return path.join(value, ...segments);
}

function resolvePaths(homeOverride, runtime = 'claude') {
  const home = homeOverride || os.homedir();
  const selectedRuntime = normalizeRuntime(runtime);
  const platformDir = selectedRuntime === 'codex' ? joinByStyle(home, '.codex') : joinByStyle(home, '.claude');
  const kilntwoDir = joinByStyle(platformDir, 'kilntwo');
  const agentsDir = selectedRuntime === 'codex'
    ? joinByStyle(kilntwoDir, 'agents')
    : joinByStyle(platformDir, 'agents');
  const commandsDir = selectedRuntime === 'codex'
    ? joinByStyle(kilntwoDir, 'commands', 'kiln')
    : joinByStyle(platformDir, 'commands', 'kiln');

  return {
    runtime: selectedRuntime,
    home,
    platformDir,
    // Backward-compatible alias used by existing tests and modules.
    claudeDir: platformDir,
    codexDir: joinByStyle(home, '.codex'),
    agentsDir,
    commandsDir,
    kilntwoDir,
    dataDir: joinByStyle(kilntwoDir, 'data'),
    skillsDir: joinByStyle(kilntwoDir, 'skills'),
    templatesDir: joinByStyle(kilntwoDir, 'templates'),
    manifestPath: joinByStyle(kilntwoDir, 'manifest.json'),
  };
}

// WARNING: This encoding is lossy — different absolute paths can produce the
// same encoded result (e.g. '/a/b-c' and '/a-b/c' both become '-a-b-c').
// A collision-resistant encoding is deferred to v0.2.0.
function encodeProjectPath(absolutePath) {
  return String(absolutePath)
    .replace(/[\\/]+/g, '-')
    .replace(/[:*?"<>|]/g, '-')
    .replace(/-+/g, '-');
}

function projectMemoryDir(homeOverride, projectPath) {
  const home = homeOverride || os.homedir();
  return joinByStyle(
    home,
    '.claude',
    'projects',
    encodeProjectPath(projectPath),
    'memory'
  );
}

function projectClaudeMd(projectPath) {
  return joinByStyle(projectPath, 'CLAUDE.md');
}

function projectAgentsMd(projectPath) {
  return joinByStyle(projectPath, 'AGENTS.md');
}

module.exports = {
  normalizeRuntime,
  resolvePaths,
  encodeProjectPath,
  projectMemoryDir,
  projectClaudeMd,
  projectAgentsMd,
};
