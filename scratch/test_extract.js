
function clamp(text, max) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, '').trim();
}

function normalizeWhitespace(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function isMeaningfulFieldValue(value) {
  const v = (value || '').trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower === 'unspecified' || lower === 'unknown' || /^unspecified\b|^unknown\b/i.test(v.trim())) return false;
  if (/\bunspecified\b.*only\b|only.*\bunspecified\b/i.test(v)) return false;
  return true;
}

function extractField(text, fieldName) {
  // First try to match quoted values (handles "value" or 'value')
  const quotedRe = new RegExp(`\\b${fieldName}\\s*:\\s*["']([^"']+)["']`, 'i');
  let m = text.match(quotedRe);
  if (m?.[1]) {
    return clamp(normalizeWhitespace(m[1].trim()), 180);
  }

  // Fall back to comma-separated logic (original behavior)
  const re = new RegExp(`\\b${fieldName}\\s*:\\s*([^,\\n]+?)(?=\\s*,\\s*\\b(?:face|hair|clothing|shoes|hat|accessories|body|details|name|role|appearance)\\s*:|\\s*,\\s*$|\\n|$)`, 'i');
  m = text.match(re);
  const value = m?.[1] ? normalizeWhitespace(m[1].trim()) : '';
  
  // Clean trailing comma/punctuation/noise if present
  let cleaned = value.replace(/,\s*$/, '').trim();
  
  // Strip metadata noise like "USER: ..." or "Assistant: ..." which often gets pasted
  cleaned = cleaned.replace(/\s*\b(USER|ASSISTANT|COPILOT|SYSTEM)\s*:.*$/i, '').trim();
  
  return cleaned ? clamp(cleaned, 180) : '';
}

const input = `Please update Allan's face canon data to the one following:
face: young adult face, slightly pale, anxious/thoughtful expression`;

console.log("Extracted face:", extractField(input, 'face'));
