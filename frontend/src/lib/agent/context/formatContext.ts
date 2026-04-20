import type { CopilotContext } from './types';

function safeTitle(item: { title?: unknown; id?: unknown }) {
  const t = typeof item.title === 'string' ? item.title.trim() : '';
  if (t) return t;
  return typeof item.id === 'string' ? item.id.slice(0, 8) : 'Untitled';
}

export function formatCopilotContext(ctx: CopilotContext) {
  const lines: string[] = [];
  const MAX_SNIPPET_CHARS = 3500;
  let snippetBudget = MAX_SNIPPET_CHARS;

  if (ctx.project) {
    lines.push(`PROJECT: ${ctx.project.title} (${ctx.project.id})`);
  } else {
    lines.push('PROJECT: (unknown)');
  }

  lines.push('SELECTION:');
  lines.push(`  workflowId: ${ctx.selection.workflowId ?? '(none)'}`);
  lines.push(`  assetId: ${ctx.selection.assetId ?? '(none)'}`);
  lines.push(`  shotPlanAssetId: ${ctx.selection.shotPlanAssetId ?? '(none)'}`);
  lines.push(`  shotId: ${ctx.selection.shotId ?? '(none)'}`);
  lines.push('');

  lines.push('PINNED_VERSIONS:');
  lines.push(`  workflowVersionId: ${ctx.pinned.workflowVersionId ?? '(none)'}`);
  lines.push(`  assetVersionId: ${ctx.pinned.assetVersionId ?? '(none)'}`);
  lines.push(`  shotPlanAssetVersionId: ${ctx.pinned.shotPlanAssetVersionId ?? '(none)'}`);
  lines.push('');

  lines.push('RELEVANT_ASSETS:');
  if (ctx.retrieval.assets.length === 0) {
    lines.push('  (none)');
  } else {
    for (const a of ctx.retrieval.assets.slice(0, 8)) {
      lines.push(`  - ${a.asset_type}: ${safeTitle(a)} (${a.id})`);
    }
  }
  lines.push('');

  const pickContent = (a: any) => a?.current_version?.content ?? a?.current_approved_version?.content ?? null;
  const toSnippet = (value: unknown, maxChars: number) => {
    if (value == null) return '';
    const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const s = raw.replace(/\s+$/g, '').trim();
    return s.length > maxChars ? s.slice(0, maxChars) + '\n…(truncated)' : s;
  };

  // Lightweight “RAG payload”: include a few clipped contents so the planner/chat can reason semantically.
  lines.push('ASSET_SNIPPETS:');
  const snippetAssets = ctx.retrieval.assets
    .filter(a => ['canon_text', 'scene', 'shot_plan'].includes(String((a as any).asset_type ?? '')))
    .slice(0, 3);
  if (snippetAssets.length === 0) {
    lines.push('  (none)');
  } else {
    for (const a of snippetAssets) {
      if (snippetBudget <= 200) break;
      const content = pickContent(a);
      const max = Math.min(1200, snippetBudget);
      const snippet = toSnippet(content, max);
      snippetBudget -= snippet.length;
      lines.push(`  - ${a.asset_type}: ${safeTitle(a)} (${a.id})`);
      for (const ln of snippet.split('\n').slice(0, 80)) {
        // indent
        lines.push(`      ${ln}`);
      }
    }
  }
  lines.push('');

  lines.push('RECENT_RUNS:');
  if (ctx.retrieval.runs.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of ctx.retrieval.runs.slice(0, 5)) {
      lines.push(`  - ${r.id.slice(0, 8)} status=${r.status} started=${r.started_at}`);
    }
  }

  lines.push('');
  lines.push('SEMANTIC_RUN_SNIPPETS:');
  const hits = (ctx.retrieval as any)?.semantic_hits as
    | Array<{ context_type: string; item_id: string; score: number; content: string }>
    | undefined;
  if (!hits || hits.length === 0) {
    lines.push('  (none)');
  } else {
    for (const h of hits.slice(0, 6)) {
      if (snippetBudget <= 200) break;
      const header = `${h.context_type}:${h.item_id.slice(0, 8)} score=${Number(h.score).toFixed(3)}`;
      lines.push(`  - ${header}`);
      const max = Math.min(700, snippetBudget);
      const snippet = (h.content || '').trim().slice(0, max);
      snippetBudget -= snippet.length;
      for (const ln of snippet.split('\n').slice(0, 40)) {
        lines.push(`      ${ln}`);
      }
    }
  }

  lines.push('');
  lines.push('RECENT_CONVERSATION:');
  if (!ctx.conversation.length) {
    lines.push('  (none)');
  } else {
    for (const m of ctx.conversation.slice(-6)) {
      const content = (m.content || '').replace(/\s+/g, ' ').trim();
      const clipped = content.length > 180 ? content.slice(0, 180) + '…' : content;
      lines.push(`  - ${m.role}: ${clipped}`);
    }
  }

  return lines.join('\n').trim();
}
