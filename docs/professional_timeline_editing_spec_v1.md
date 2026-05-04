# Professional Timeline Editing Spec v1

## 1. Purpose
Define a professional timeline editing model for this app.

This spec is intended to replace the current placeholder timeline behavior with a real editorial surface that:
- works with actual project media
- supports sequence editing
- preserves provenance
- integrates with workflows, review, and export

Important v1 constraint:
- the first implementation should **not** use sequence versioning yet
- the timeline should use a single persisted working sequence per output/timeline asset
- versioning can be added later once the core editor is working reliably

This is not a full non-linear editor spec.
It is a practical professional timeline design for an AI-assisted movie-making app.

---

## 2. Current Problem
The current timeline page does not function as a real editorial timeline.

Observed issues in the current implementation:
- clips are derived from `scene` and `shot_plan` assets, not from real timeline sequence data
- durations are hard-coded placeholders instead of media-derived or editorial durations
- the preview area is not bound to a real sequence player
- there is no editable track model
- there is no persisted timeline sequence model in the page flow
- export is not driven by a real timeline manifest

In practice, the current page is a mock viewer, not a timeline editor.

---

## 3. Product Goal
The timeline must become the place where users:
- assemble generated media into a cut
- adjust order and duration
- align image, video, narration, voice-over, music, and SFX
- preview the cut
- save the working sequence
- export preview and final outputs

Important rule:
- the timeline is not just a report of generated outputs
- it is an editable first-class production artifact

---

## 4. Product Position
The timeline should feel like:
- a lightweight professional editorial workspace
- a sequence builder for AI-generated media
- a bridge between shot generation and final export

It should not feel like:
- a toy progress bar
- a static list of clips
- a hidden export staging area

---

## 5. Core Design Principle
The timeline should be based on a **sequence asset model**, not directly on scenes or shot plans.

That means:
- scenes and shots are planning artifacts
- images, video segments, narration audio, voice-over, SFX, and music are media artifacts
- the timeline assembles those artifacts into a persisted working sequence

This separation is necessary for professional editing.

---

## 6. Timeline as First-Class Artifact

### 6.1 Sequence Asset
The timeline should be persisted as a dedicated artifact family, for example:
- `timeline_sequence`

The v1 timeline asset should store:
- tracks
- clip placements
- timing
- mute/visibility state
- source media references
- output settings

### 6.2 Why This Matters
Without a sequence artifact:
- edits are not reproducible
- exports cannot be trusted
- comparisons are weak
- users cannot preserve a stable cut state across preview/export

Therefore:
- the timeline must at least persist a stable working sequence in v1
- full versioning should be deferred until the base editor is reliable

---

## 7. Core User Jobs
The timeline page must support these jobs:

1. assemble selected shot media into a cut  
2. review shot order and continuity  
3. align narration with stills or clips  
4. replace a clip or frame with another candidate  
5. trim durations and adjust pacing  
6. add and adjust music / SFX / captions  
7. preview the current cut  
8. save the working sequence  
9. request export preview or final export  

---

## 8. Timeline Page Structure

### 8.1 Layout
Recommended layout:

- **Top toolbar**
  - output selector
  - preview / export actions
  - save timeline

- **Left panel**
  - media bin / source list
  - scenes/shots filter
  - available assets for replacement

- **Center main area**
  - preview player
  - playhead / transport
  - timeline tracks

- **Right inspector**
  - selected clip details
  - source provenance
  - timing controls
  - replacement options

- **Bottom dock**
  - render/export jobs
  - warnings
  - logs

### 8.2 Default Focus
When opening Timeline:
- open the selected output family if one exists
- otherwise open the latest timeline sequence
- otherwise offer “Create timeline from shots”

---

## 9. Core Timeline Model

### 9.1 Sequence

```ts
interface TimelineSequence {
  id: string;
  project_id: string;
  title: string;
  status: 'draft' | 'pending_review' | 'approved';
  fps: number;
  width: number;
  height: number;
  duration_seconds: number;
  tracks: TimelineTrack[];
  markers?: TimelineMarker[];
  metadata?: Record<string, unknown>;
  updated_at: string;
  created_at: string;
}
```

### 9.2 Track

```ts
type TimelineTrackType =
  | 'video'
  | 'image'
  | 'narration'
  | 'voice_over'
  | 'dialogue'
  | 'sfx'
  | 'music'
  | 'caption';

interface TimelineTrack {
  id: string;
  type: TimelineTrackType;
  title: string;
  locked: boolean;
  muted: boolean;
  hidden: boolean;
  clips: TimelineClip[];
}
```

### 9.3 Clip

```ts
interface TimelineClip {
  id: string;
  track_id: string;
  shot_id?: string | null;
  scene_id?: string | null;
  source_asset_id?: string | null;
  source_type:
    | 'generated_image'
    | 'uploaded_image'
    | 'existing_image'
    | 'video_segment'
    | 'narration_audio'
    | 'voice_over_audio'
    | 'music_track'
    | 'sound_effect';
  start_time: number;
  duration: number;
  source_in?: number;
  source_out?: number;
  playback_rate?: number;
  volume?: number;
  opacity?: number;
  label?: string;
  metadata?: Record<string, unknown>;
}
```

### 9.4 Marker

```ts
interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  type?: 'note' | 'scene' | 'chapter' | 'warning';
}
```

---

## 10. Track Model

### 10.1 Minimum Track Types
The professional v1 timeline should support:
- visual track for stills or video
- narration/voice-over track
- music track
- sound effects track

Optional but recommended:
- captions/subtitles track

### 10.2 Track Behavior
Tracks should support:
- mute
- hide
- lock
- reorder

### 10.3 Simplification Rule
Even if the initial editor is lightweight, the internal model should still use proper tracks instead of flattening everything into one list.

That allows future growth without rewriting the data model.

---

## 11. Visual Editing Model

### 11.1 Main Operations
Users should be able to:
- select clip
- move clip
- replace clip source
- trim clip duration
- split clip
- delete clip
- duplicate clip
- mute/unmute audio clips

### 11.2 Not Required for v1
The following can be deferred:
- ripple edit
- slip/slide edit
- J/L cuts
- advanced transitions
- keyframe automation

### 11.3 Professional Minimum
For a professional-feeling v1, the following are required:
- drag reorder
- duration/trim controls
- real playhead
- source replacement
- real preview of current sequence

---

## 12. Media Bin / Source Browser

### 12.1 Purpose
The timeline needs a media bin so users can replace or add clips without leaving the page.

### 12.2 Should Include
- approved shot images
- active shot images
- generated video segments
- narration audio
- voice-over audio
- uploaded music
- uploaded SFX

### 12.3 Filters
Useful filters:
- by scene
- by shot
- by media type
- by approved/current where available

### 12.4 Replacement Rule
Replacing a clip in timeline should not mutate the underlying shot or source artifact automatically.

It changes the working timeline sequence only.

That distinction is important.

---

## 13. Preview Player

### 13.1 Purpose
The player must preview the actual sequence, not just a selected clip.

### 13.2 Required Behavior
The player should:
- follow the timeline playhead
- show the composited active visual clip(s)
- play aligned audio tracks
- allow scrub and seek
- support looping selected range later

### 13.3 v1 Strategy
For v1, the player may be driven by:
- a computed sequence preview model in the frontend for still+audio preview
- or a backend-generated preview manifest

But it must represent the real sequence order and timing.

### 13.4 Playback Truth
If the timeline says:
- image A from 0s to 4s
- narration A from 0s to 4s
- image B from 4s to 8s

the preview must play exactly that.

---

## 14. Timeline Construction Flows

### 14.1 Create Timeline from Shots
Primary entry flow:
1. user selects output family or creates new output
2. app proposes a default sequence from active shots
3. each shot becomes:
   - one visual clip
   - optional narration/voice-over clip
4. user edits from there

### 14.2 Create Timeline from Approved Content
Professional option:
- build sequence only from approved shots/audio by default

This should be optional in v1.
The simpler default is:
- build from active shots/audio

### 14.3 Rebuild from Latest Shot Plan
If upstream shots changed:
- show “Upstream changes available”
- allow merge/rebuild flow
- do not silently destroy timeline edits

---

## 15. Relationship to Scenes and Shots

### 15.1 Scenes and Shots Remain Upstream
The timeline is downstream of:
- scene planning
- shot planning
- media generation

### 15.2 Timeline Is an Editorial Interpretation
The timeline may differ from the shot plan because users may:
- reorder clips
- drop clips
- extend or shorten durations
- replace media sources
- add music and transitions

Therefore:
- the shot plan is not the timeline

### 15.3 Provenance Requirement
Each timeline clip should still link back to:
- scene id if applicable
- shot id if applicable
- source asset
- workflow run and node run where applicable

---

## 16. Replace Clip / Replace Source

### 16.1 Replace Visual Clip
Users should be able to replace a timeline visual clip with:
- another candidate image from the same shot
- an existing project image
- a generated video segment
- an uploaded image or video

### 16.2 Replace Audio Clip
Users should be able to replace:
- narration take
- voice-over take
- music track
- sound effect

### 16.3 Rule
Replacement changes the working timeline sequence, not necessarily the upstream shot’s active media.

This prevents timeline edits from unexpectedly mutating planning artifacts.

---

## 17. Timing Rules

### 17.1 Image Clips
Image clip duration may come from:
- linked narration/voice-over segment length
- explicit manual duration
- fallback default duration

### 17.2 Video Clips
Video clips use:
- source video duration
- optional trimmed subrange

### 17.3 Audio Sync
If the user creates timeline from narrated shots:
- default image duration should match linked audio segment length

This is especially important for storybook-style outputs.

### 17.4 Gaps
The timeline may permit gaps or may auto-close gaps depending on mode.

Recommended v1:
- auto-close gaps by default
- allow explicit gap insertion later

---

## 18. Save Model for v1

### 18.1 Working Sequence
The first implementation should use one persisted working sequence per timeline/output.

Recommended behavior:
- edits update local draft state
- user clicks `Save Timeline`
- the timeline asset is updated in place

### 18.2 Save Behavior
Recommended:
- local draft while editing
- explicit `Save Timeline`
- optional autosave later if stable

### 18.3 Why Not Versioning Yet
Sequence versioning should be deferred because:
- the current workflow and asset version flows already add operational complexity
- timeline editing needs to work correctly first
- adding version branching too early increases failure modes

### 18.4 Future Upgrade Path
Once the timeline editor is stable, sequence versioning can be added as:
- `timeline_sequence` asset family
- immutable sequence snapshots
- compare and approve flows

---

## 19. Review Model

### 19.1 What Can Be Reviewed
Timeline review should support:
- current sequence approval
- clip replacement review
- continuity/timing warnings
- caption timing review

### 19.2 Review UI
Should provide:
- current cut preview
- change summary
- comments
- approve/reject

### 19.3 Timeline-Specific Review Need
Even when shots are approved individually, the cut itself still needs review because:
- pacing may be wrong
- ordering may be wrong
- audio layering may be wrong

Therefore:
- timeline review must be first-class

---

## 20. Export Model

### 20.1 Export Input
Exports should be created from the saved working timeline sequence, not from ad hoc frontend state.

### 20.2 Export Types
At minimum:
- preview export
- final export

### 20.3 Preview Export
Optimized for:
- fast turnaround
- lower quality acceptable
- review sharing

### 20.4 Final Export
Optimized for:
- approved or user-confirmed working sequence
- full quality settings
- stable reproducibility

### 20.5 Export Provenance
Export records should reference:
- timeline sequence id
- output family id
- source media summary

---

## 21. Timeline Inspector

### 21.1 When a Clip Is Selected
The right inspector should show:
- clip source
- clip timing
- linked shot/scene
- source provenance
- replace actions
- trim controls
- volume controls if audio

### 21.2 When a Track Is Selected
Show:
- track type
- mute/hidden/locked state
- track-level settings

### 21.3 When Sequence Is Selected
Show:
- resolution
- FPS
- total duration
- sequence status
- output/export settings

---

## 22. Professional UX Rules

### 22.1 Real Sequence, Not Mock Data
The page must not synthesize clips from unrelated asset lists just to fill UI.

### 22.2 Stable Separation
Keep these separate:
- planning artifacts
- media artifacts
- editorial sequence artifacts

### 22.3 Visible Provenance
Users should always know:
- which shot this clip came from
- which candidate is used
- whether it is generated, uploaded, or reused

### 22.4 Safe Editing
Timeline edits should not silently rewrite upstream shot selections.

### 22.5 Export Trust
The exported file must come from the saved working sequence the user approved or explicitly exported.

---

## 23. Recommended MVP

### 23.1 Must Have
- real `timeline_sequence` asset model
- visual track
- narration/voice-over track
- music/SFX track
- active playhead
- real sequence preview
- drag reorder
- replace clip source
- trim duration
- save timeline
- export from saved timeline sequence

### 23.2 Nice to Have
- compare timeline revisions later
- caption track
- markers
- scene group headers
- review comments on the timeline

### 23.3 Defer
- advanced transitions
- keyframes
- multicam
- collaborative live editing

---

## 24. Suggested Implementation Direction

### 24.1 Backend
Add or formalize:
- `timeline_sequence` asset family
- working sequence content schema
- output linkage to timeline sequence
- export job input from saved timeline sequence

### 24.2 Frontend
Replace the current page with:
- media bin
- real preview player
- track canvas
- inspector
- save/export-aware toolbar

### 24.3 Player Strategy
Short term:
- frontend sequence preview for still/audio timing

Medium term:
- backend preview manifest / render preview generation

### 24.4 Data Flow
Recommended flow:
- Shots page chooses active media
- Timeline page assembles chosen media into sequence
- Review page approves the current saved sequence
- Export page/job renders the saved sequence

### 24.5 Future Versioning Phase
After the editor is working properly, add:
- immutable timeline snapshots
- timeline compare view
- branching from older cuts
- approved timeline versions

---

## 25. Final Design Decision
The professional timeline should be designed as:
- a first-class sequence editor
- downstream from shots but independent in editorial decisions
- initially non-versioned but persistently saveable
- reviewable
- export-driven from saved sequence state

The core rule is:
- **shots plan the material**
- **timeline edits the cut**

Without this separation, the timeline will remain a placeholder.
