import type { JsonPatchOperation } from './types';

function isSafePathSegment(segment: string) {
  return segment !== '__proto__' && segment !== 'prototype' && segment !== 'constructor';
}

function decodePointerSegment(segment: string) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function parseJsonPointer(path: string): string[] {
  if (path === '') return [];
  if (!path.startsWith('/')) throw new Error(`Invalid JSON pointer: ${path}`);
  const parts = path
    .slice(1)
    .split('/')
    .map(decodePointerSegment);
  for (const p of parts) {
    if (!isSafePathSegment(p)) throw new Error(`Unsafe JSON pointer segment: ${p}`);
  }
  return parts;
}

function cloneJson<T>(value: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (globalThis as any).structuredClone as ((v: unknown) => unknown) | undefined;
  if (typeof sc === 'function') return sc(value) as T;
  return JSON.parse(JSON.stringify(value)) as T;
}

function asArrayIndex(segment: string) {
  if (segment === '-') return { kind: 'append' as const, index: -1 };
  if (!/^\d+$/.test(segment)) return null;
  const idx = Number(segment);
  if (!Number.isFinite(idx)) return null;
  return { kind: 'index' as const, index: idx };
}

function getContainer(root: unknown, pointer: string[]) {
  let cur: unknown = root;
  for (let i = 0; i < pointer.length - 1; i += 1) {
    const key = pointer[i]!;
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  const last = pointer[pointer.length - 1] ?? null;
  if (last == null) return null;
  if (cur == null || typeof cur !== 'object') return null;
  return { parent: cur as Record<string, unknown>, key: last };
}

function setAt(root: unknown, pointer: string[], value: unknown) {
  if (pointer.length === 0) return value;
  const container = getContainer(root, pointer);
  if (!container) throw new Error(`Path not found: /${pointer.join('/')}`);

  const { parent, key } = container;
  const idx = Array.isArray(parent) ? asArrayIndex(key) : null;

  if (Array.isArray(parent)) {
    if (!idx) throw new Error(`Invalid array index: ${key}`);
    const arr = parent as unknown as unknown[];
    if (idx.kind === 'append') {
      arr.push(value);
    } else {
      if (idx.index < 0 || idx.index > arr.length) throw new Error(`Index out of bounds: ${idx.index}`);
      if (idx.index === arr.length) arr.push(value);
      else arr[idx.index] = value;
    }
    return root;
  }

  (parent as Record<string, unknown>)[key] = value;
  return root;
}

function removeAt(root: unknown, pointer: string[]) {
  if (pointer.length === 0) throw new Error('Cannot remove the document root.');
  const container = getContainer(root, pointer);
  if (!container) throw new Error(`Path not found: /${pointer.join('/')}`);

  const { parent, key } = container;
  const idx = Array.isArray(parent) ? asArrayIndex(key) : null;

  if (Array.isArray(parent)) {
    if (!idx || idx.kind !== 'index') throw new Error(`Invalid array index: ${key}`);
    const arr = parent as unknown as unknown[];
    if (idx.index < 0 || idx.index >= arr.length) throw new Error(`Index out of bounds: ${idx.index}`);
    arr.splice(idx.index, 1);
    return root;
  }

  delete (parent as Record<string, unknown>)[key];
  return root;
}

export function applyJsonPatch<T>(document: T, patch: JsonPatchOperation[]): T {
  const root = cloneJson(document) as unknown;

  for (const op of patch) {
    const pointer = parseJsonPointer(op.path);
    if (op.op === 'remove') {
      removeAt(root, pointer);
      continue;
    }
    if (op.op === 'add' || op.op === 'replace') {
      setAt(root, pointer, cloneJson(op.value));
      continue;
    }
    // Exhaustive guard
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Unsupported patch op: ${(op as any).op}`);
  }

  return root as T;
}

