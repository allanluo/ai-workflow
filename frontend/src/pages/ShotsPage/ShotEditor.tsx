import { useState } from 'react';
import type { Shot } from './ShotsPage';

interface ShotEditorProps {
  shot: Shot;
}

const shotTypes = ['Wide', 'Medium', 'Close-up', 'Extreme Close-up', 'Over the Shoulder', 'POV'];
const angles = ['Eye Level', 'High', 'Low', 'Dutch', "Bird's Eye", "Worm's Eye"];
const motions = ['Static', 'Pan', 'Tilt', 'Tracking', 'Dolly', 'Zoom', 'Handheld'];

export function ShotEditor({ shot }: ShotEditorProps) {
  const [prompt, setPrompt] = useState(shot.prompt);
  const [negativePrompt, setNegativePrompt] = useState(shot.negativePrompt);
  const [shotType, setShotType] = useState(shot.shotType);
  const [angle, setAngle] = useState(shot.angle);
  const [motion, setMotion] = useState(shot.motion);
  const [duration, setDuration] = useState(shot.duration);
  const [isDirty, setIsDirty] = useState(false);

  const handleSaveDraft = () => {
    console.log('Save draft');
    setIsDirty(false);
  };

  const handleNewVersion = () => {
    console.log('New version');
    setIsDirty(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-comfy-text mb-2">Prompt</label>
        <textarea
          value={prompt}
          onChange={e => {
            setPrompt(e.target.value);
            setIsDirty(true);
          }}
          rows={5}
          className="comfy-input w-full text-sm resize-none"
          placeholder="Describe the shot..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-comfy-text mb-2">Negative Prompt</label>
        <textarea
          value={negativePrompt}
          onChange={e => {
            setNegativePrompt(e.target.value);
            setIsDirty(true);
          }}
          rows={3}
          className="comfy-input w-full text-sm resize-none"
          placeholder="What to avoid..."
        />
      </div>

      <div className="border-t border-comfy-border pt-4">
        <h4 className="text-sm font-semibold text-comfy-text mb-3">Camera Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Shot Type</label>
            <select
              value={shotType}
              onChange={e => {
                setShotType(e.target.value);
                setIsDirty(true);
              }}
              className="comfy-input w-full text-sm"
            >
              {shotTypes.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Angle</label>
            <select
              value={angle}
              onChange={e => {
                setAngle(e.target.value);
                setIsDirty(true);
              }}
              className="comfy-input w-full text-sm"
            >
              {angles.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Motion</label>
            <select
              value={motion}
              onChange={e => {
                setMotion(e.target.value);
                setIsDirty(true);
              }}
              className="comfy-input w-full text-sm"
            >
              {motions.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Duration (s)</label>
            <input
              type="number"
              value={duration}
              onChange={e => {
                setDuration(Number(e.target.value));
                setIsDirty(true);
              }}
              min={1}
              max={60}
              className="comfy-input w-full text-sm"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-comfy-border pt-4">
        <h4 className="text-sm font-semibold text-comfy-text mb-3">Continuity</h4>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Character References</label>
            <div className="flex flex-wrap gap-1.5">
              <span className="comfy-tag">John</span>
              <span className="comfy-tag">Sarah</span>
              <button className="comfy-tag-dashed">+ Add</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-comfy-muted mb-1">Environment References</label>
            <div className="flex flex-wrap gap-1.5">
              <span className="comfy-tag-success">City Street</span>
              <span className="comfy-tag-success">Office</span>
              <button className="comfy-tag-dashed">+ Add</button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-comfy-border pt-4 flex gap-2">
        <button
          onClick={handleSaveDraft}
          disabled={!isDirty}
          className="comfy-btn-secondary disabled:opacity-50"
        >
          Save Draft
        </button>
        <button onClick={handleNewVersion} className="comfy-btn">
          New Version
        </button>
        <button
          onClick={() => {
            setPrompt(shot.prompt);
            setNegativePrompt(shot.negativePrompt);
            setShotType(shot.shotType);
            setAngle(shot.angle);
            setMotion(shot.motion);
            setDuration(shot.duration);
            setIsDirty(false);
          }}
          className="px-3 py-2 text-sm text-comfy-muted hover:text-comfy-text"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
