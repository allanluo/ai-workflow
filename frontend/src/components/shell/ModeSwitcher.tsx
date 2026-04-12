import { useAppStore, type UserMode } from '../../stores';

const modes: { id: UserMode; label: string; icon: string; description: string }[] = [
  {
    id: 'advanced',
    label: 'Advanced',
    icon: '●',
    description: 'Primary workflow authoring mode',
  },
];

export function ModeSwitcher() {
  const userMode = useAppStore(s => s.userMode);
  const setUserMode = useAppStore(s => s.setUserMode);

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
      {modes.map(mode => (
        <button
          key={mode.id}
          onClick={() => setUserMode(mode.id)}
          title={mode.description}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            userMode === mode.id
              ? 'bg-white text-slate-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
