'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BEGIN_RE = /<!-- kiln:protocol:begin v([\d.]+) -->/;
const END_RE = /<!-- kiln:protocol:end -->/;

function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function normalizeEol(text, eol) {
  return String(text).replace(/\r?\n/g, eol);
}

function buildBlock(content, version, eol = '\n') {
  const inner = normalizeEol(content, eol);
  const innerWithNewline = inner.endsWith(eol) ? inner : `${inner}${eol}`;
  return `<!-- kiln:protocol:begin v${version} -->${eol}${innerWithNewline}<!-- kiln:protocol:end -->${eol}`;
}

function findBlock(text) {
  const beginMatch = BEGIN_RE.exec(text);
  if (!beginMatch) {
    return null;
  }

  END_RE.lastIndex = 0;
  const tail = text.slice(beginMatch.index);
  const endMatch = END_RE.exec(tail);
  if (!endMatch) {
    return null;
  }

  const endStart = beginMatch.index + endMatch.index;
  let endIndex = endStart + endMatch[0].length;

  // Include one trailing line ending if present so remove/replace round-trips cleanly.
  if (text.startsWith('\r\n', endIndex)) {
    endIndex += 2;
  } else if (text.startsWith('\n', endIndex)) {
    endIndex += 1;
  }

  return {
    start: beginMatch.index,
    end: endIndex,
    version: beginMatch[1],
  };
}

function replaceProtocol(filePath, content, version) {
  const text = fs.readFileSync(filePath, 'utf8');
  const block = findBlock(text);

  if (!block) {
    throw new Error(`kiln: no protocol block found in ${filePath}`);
  }

  const eol = detectEol(text);
  const replacement = buildBlock(content, version, eol);
  const next = `${text.slice(0, block.start)}${replacement}${text.slice(block.end)}`;
  fs.writeFileSync(filePath, next, 'utf8');
}

function insertProtocol(filePath, content, version) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buildBlock(content, version), 'utf8');
    return;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  if (findBlock(text)) {
    replaceProtocol(filePath, content, version);
    return;
  }

  const eol = detectEol(text);
  const block = buildBlock(content, version, eol);
  const separator = text.length === 0 || text.endsWith('\n') || text.endsWith('\r\n') ? '' : eol;
  const next = `${text}${separator}${block}`;
  fs.writeFileSync(filePath, next, 'utf8');
}

/**
 * Removes the KilnTwo protocol block from a CLAUDE.md file.
 * No-op (does not throw) when the file does not exist or contains no protocol block,
 * as required by uninstall.js which calls this unconditionally.
 */
function removeProtocol(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const block = findBlock(text);

  if (!block) {
    return;
  }

  const next = `${text.slice(0, block.start)}${text.slice(block.end)}`;
  if (next.trim().length === 0) {
    fs.unlinkSync(filePath);
    return;
  }

  fs.writeFileSync(filePath, next, 'utf8');
}

function hasProtocol(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    return findBlock(fs.readFileSync(filePath, 'utf8')) !== null;
  } catch (_) {
    return false;
  }
}

function extractVersion(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const block = findBlock(fs.readFileSync(filePath, 'utf8'));
    return block ? block.version : null;
  } catch (_) {
    return null;
  }
}

module.exports = {
  insertProtocol,
  replaceProtocol,
  removeProtocol,
  hasProtocol,
  extractVersion,
};
