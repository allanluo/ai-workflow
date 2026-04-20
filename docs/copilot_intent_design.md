# Copilot Intent Recognition & Execution Design

## Problem

The current Copilot loops endlessly in "discussion mode" even when users explicitly provide directives. It treats all user inputs as starting points for conversation rather than recognizing when users are:
- Providing explicit instructions to execute
- Supplying data that should be applied directly
- Correcting previous mistakes
- Ready to commit (application phase)

## Core Concept: User Intent Modes

Users operate in distinct modes during a session. The Copilot must detect the mode and behave accordingly.

### Mode 1: Discovery/Discussion
**User signals:** Questions, exploratory language, vague requests
```
"What do you think about Allan?"
"Can you help me refine the character?"
"Suggest something for the background"
```
**Copilot behavior:**
- Engage in chat
- Ask clarifying questions (1-2 max)
- Offer suggestions
- Propose options

### Mode 2: Direction/Instruction (← CURRENT FAILURE POINT)
**User signals:** Imperative verbs, "use this", "with", "fix with", "description below", structured data
```
"Use the description below:"
"Fix Allan's Canon data with:"
"Please update with:"
[Structured character data]
```
**Copilot behavior:**
- Parse the provided data as SOURCE OF TRUTH
- Skip discussion/clarification loop
- Generate proposal directly from user data
- DO NOT suggest refinements or next steps
- DO NOT ask "do you want me to..."

### Mode 3: Correction
**User signals:** "No", "That's wrong", "Please redo", explicit rejection
```
"No, I don't like it"
"That's incorrect, please use..."
"Please don't do that, instead..."
```
**Copilot behavior:**
- Treat as direction mode (user is correcting)
- Extract the new instruction
- Discard previous proposal
- Generate new proposal from user's correction

### Mode 4: Application
**User signals:** `/apply`, `/review`, `/run`, confirmation phrases
```
"/review"
"/apply"
"Yes, proceed"
```
**Copilot behavior:**
- Execute the proposal
- No questions, no delays
- Confirm success
- Transition back to Idle

---

## Intent Detection Algorithm

### Step 1: Mode Classification

Scan user input for mode markers (in priority order):

```
IF contains ("/apply" OR "/review" OR "/run" OR "proceed" OR "yes" OR "confirm"):
  → Application Mode
  
ELSE IF contains ("no" OR "that's wrong" OR "please redo" OR "not") AND NOT recovery_message:
  → Correction Mode (parse new directive after rejection)
  
ELSE IF contains directive_marker AND contains data_marker:
  → Direction Mode
  
ELSE:
  → Discussion Mode
```

### Step 2: Direction Mode Detection (New)

**Directive markers** (imperative signals):
- `use`, `using`, `with`, `fix`, `update`, `change`, `set`, `replace`, `apply`
- `description below:`, `as follows:`, `here's the`, `please focus on`
- Punctuation patterns: `User: <directive> ... <data block>`

**Data markers** (structured content):
- Field patterns: `Face:`, `Hair:`, `Description:`, `Appearance:`
- Multi-line structured text (description blocks)
- Character name + role + description format

**Example matching:**
```
"Fix Allan's Canon data with:"          → Directive marker: "Fix...with"
                                        + Data marker: structured description follows
                                        = Direction Mode ✓
```

### Step 3: Suppress Over-Helpfulness

When in Direction Mode:
- ✗ Do NOT suggest "next steps"
- ✗ Do NOT ask "would you like to..."
- ✗ Do NOT offer "here are more ideas"
- ✗ Do NOT start a new discussion
- ✓ Only: Generate proposal from provided data
- ✓ Only: Confirm what will change

---

## Data Extraction Strategy

### Recognition of "Provided Data = Source of Truth"

When user enters Direction Mode with data, the data is NOT context—it's the specification.

**Current behavior (WRONG):**
```
User provides: "Description: Allan is 22, pale skin, brown hair..."
Copilot thinks: "Interesting, they mentioned these details. Let me use that as context
                 to generate suggestions..."
Result: Copilot asks more questions or generates NEW suggestions
```

**New behavior (CORRECT):**
```
User provides: "Description: Allan is 22, pale skin, brown hair..."
Copilot thinks: "USER HAS PROVIDED EXPLICIT SPECIFICATION.
                Extract face, hair, clothing, shoes from their text.
                Use EXACTLY what they said.
                Generate proposal from this data."
Result: Proposal directly uses user-provided values
```

### Extraction Algorithm

When Direction Mode is detected:

```
1. Extract all text after the directive marker
2. Parse for appearance fields:
   - Face: [extract sentence]
   - Hair: [extract sentence]
   - Clothing: [extract sentence]
   - Shoes: [extract sentence]
3. Create proposal patch from EXACTLY these values
4. Never ask for clarification or "fill in the blanks"
5. Never suggest alternates
```

**Example:**
```
User: "Fix with: Face: pale skin with olive undertone, medium brown arched eyebrows
                 Hair: medium-toned wavy brown, slightly messy
                 Clothing: dark olive hunting jacket, plain oversized green t-shirt
                 Shoes: simple black sneakers"

Action:
- Extract Face: "pale skin with olive undertone, medium brown arched eyebrows"
- Extract Hair: "medium-toned wavy brown, slightly messy"
- Extract Clothing: "dark olive hunting jacket, plain oversized green t-shirt"
- Extract Shoes: "simple black sneakers"
- Create patch: { op: "replace", path: "/characters/0/appearance/face", value: "pale skin..." }
- Return proposal WITHOUT discussion
```

---

## Mode Transition Guardrails

### Prevent Loop-Back to Discussion

Once in Direction → Proposal → Application flow, don't restart discussion:

```
State Machine:
┌─────────────────┐
│   Discussion    │
└────────┬────────┘
         │ [User provides directive + data]
         ▼
    ┌─────────────────┐
    │  Direction →    │
    │  Extract Data   │
    └────────┬────────┘
             │
             ▼
    ┌──────────────────┐
    │  Generate        │
    │  Proposal        │ ← Do NOT re-enter Discussion
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │  Application     │
    │  (/apply)        │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │  Confirm & Return│ ← Then can return to Discussion
    └──────────────────┘
```

### Red Flag Patterns to Avoid

If user says any of these in Direction Mode, STILL go to proposal (don't loop):
- "I don't like the previous suggestions"
- "Please focus on it with..."
- "Don't do anything extra"
- "Just fix it"

These are **emphasis markers** reinforcing Direction Mode, not reasons to revisit Discussion.

---

## Implementation Changes

### 1. Update `updateCanonSkill.execute()`

Add mode detection at entry:

```typescript
export const updateCanonSkill: Skill = {
  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    const mode = detectUserIntentMode(input);  // New function
    
    if (mode === 'application') {
      // Jump to /apply handling
      return { success: true, message: 'Proposal applied.' };
    }
    
    if (mode === 'correction') {
      // Extract new directive from rejection + guidance
      const newDirective = extractDirectiveFromCorrection(input);
      // Go straight to proposal generation
      return generateProposalFromDirective(newDirective);
    }
    
    if (mode === 'direction') {
      // Extract data and generate proposal immediately
      const extracted = extractDirectionData(input);
      // SKIP chat loop
      return generateProposalFromDirective(extracted);
    }
    
    // mode === 'discussion': Current chat flow
    return discussionFlow(context, input);
  }
};
```

### 2. New Function: `detectUserIntentMode()`

```typescript
function detectUserIntentMode(input: string): 'discussion' | 'direction' | 'correction' | 'application' {
  const lower = input.toLowerCase().trim();
  
  // Application mode
  if (/^\/apply|^\/review|^yes$|proceed|confirm/i.test(lower)) {
    return 'application';
  }
  
  // Correction mode
  if (/^no(?:\s|,|$)|wrong|redo|please don't|incorrect/i.test(lower)) {
    return 'correction';
  }
  
  // Direction mode
  const directives = /\b(use|using|with|fix|update|change|replace)\b/;
  const hasData = /\b(face|hair|clothing|shoes|description|appearance)\s*:/i;
  
  if (directives.test(lower) && hasData.test(input)) {
    return 'direction';
  }
  
  // Discussion mode
  return 'discussion';
}
```

### 3. New Function: `extractDirectionData()`

```typescript
function extractDirectionData(input: string) {
  // Find section after directive marker
  const directiveMatch = input.match(/(use|with|fix|update|change)[\s:]+(.+)/i);
  if (!directiveMatch) return null;
  
  const dataBlock = directiveMatch[2];
  
  // Extract appearance fields
  return {
    face: extractField(dataBlock, 'face'),
    hair: extractField(dataBlock, 'hair'),
    clothing: extractField(dataBlock, 'clothing'),
    shoes: extractField(dataBlock, 'shoes'),
    description: extractField(dataBlock, 'description'),
  };
}
```

### 4. Suppress Next Steps in Response

When in Direction Mode, response should be:
```
✓ "Drafted canon updates for Allan (face, hair, clothing, shoes). Type /apply to save."
✗ "Drafted canon updates. Here are some other aspects you might consider..."
✗ "Do you want me to also update..."
✗ "Next steps: expand on..."
```

---

## Summary: The Three Rules

| Rule | Current | Fixed |
|------|---------|-------|
| **Recognition** | Treats all input as discussion | Detects Direction Mode vs Discussion Mode |
| **Extraction** | Uses user data as context for suggestions | Uses user data as SOURCE OF TRUTH for patch |
| **Action** | Loops to chat after extracting data | Jumps directly to proposal generation |

This ensures the Copilot respects user autonomy and doesn't waste time in endless refinement loops.
