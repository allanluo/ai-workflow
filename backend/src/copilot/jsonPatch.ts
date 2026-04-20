type JsonPatchOperation =
  | { op: 'add' | 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string };

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
    cur = (cur as any)[key];
  }
  const last = pointer[pointer.length - 1] ?? null;
  if (last == null) return null;
  if (cur == null || typeof cur !== 'object') return null;
  return { parent: cur as any, key: last };
}

function setAt(root: any, pointer: string[], value: unknown) {
  if (pointer.length === 0) return value;
  const container = getContainer(root, pointer);
  if (!container) throw new Error(`Path not found: /${pointer.join('/')}`);
  const { parent, key } = container;

  if (Array.isArray(parent)) {
    const idx = asArrayIndex(key);
    if (!idx) throw new Error(`Invalid array index: ${key}`);
    if (idx.kind === 'append') parent.push(value);
    else {
      if (idx.index < 0 || idx.index > parent.length) throw new Error(`Index out of bounds: ${idx.index}`);
      if (idx.index === parent.length) parent.push(value);
      else parent[idx.index] = value;
    }
    return root;
  }

  parent[key] = value;
  return root;
}

function removeAt(root: any, pointer: string[]) {
  if (pointer.length === 0) throw new Error('Cannot remove the document root.');
  const container = getContainer(root, pointer);
  if (!container) throw new Error(`Path not found: /${pointer.join('/')}`);
  const { parent, key } = container;

  if (Array.isArray(parent)) {
    const idx = asArrayIndex(key);
    if (!idx || idx.kind !== 'index') throw new Error(`Invalid array index: ${key}`);
    if (idx.index < 0 || idx.index >= parent.length) throw new Error(`Index out of bounds: ${idx.index}`);
    parent.splice(idx.index, 1);
    return root;
  }

  delete parent[key];
  return root;
}

export function applyJsonPatch<T>(document: T, patch: JsonPatchOperation[]): T {
  const root = cloneJson(document) as any;
  for (const op of patch ?? []) {
    const pointer = parseJsonPointer(op.path);
    if (op.op === 'remove') {
      removeAt(root, pointer);
      continue;
    }
    if (op.op === 'add' || op.op === 'replace') {
      setAt(root, pointer, cloneJson((op as any).value));
      continue;
    }
    throw new Error(`Unsupported patch op: ${(op as any).op}`);
  }
  return root as T;
}

