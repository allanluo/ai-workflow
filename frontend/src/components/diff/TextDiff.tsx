interface TextDiffProps {
  oldText: string;
  newText: string;
}

export function TextDiff({ oldText, newText }: TextDiffProps) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);

  const renderLine = (oldLine: string | undefined, newLine: string | undefined, index: number) => {
    const isAdded = oldLine === undefined && newLine !== undefined;
    const isRemoved = oldLine !== undefined && newLine === undefined;
    const isModified = oldLine !== undefined && newLine !== undefined && oldLine !== newLine;

    let bgClass = 'bg-white';
    if (isAdded) bgClass = 'bg-green-50';
    if (isRemoved) bgClass = 'bg-red-50';
    if (isModified) bgClass = 'bg-amber-50';

    return (
      <div key={index} className={`flex ${bgClass}`}>
        <div className="w-8 flex-shrink-0 px-2 py-0.5 text-xs text-slate-400 border-r border-slate-200 text-right">
          {index + 1}
        </div>
        <div className="w-8 flex-shrink-0 px-2 py-0.5 text-xs text-slate-400 border-r border-slate-200 text-center">
          {isAdded ? '+' : isRemoved ? '-' : ''}
        </div>
        <div className="flex-1 px-3 py-0.5 font-mono text-sm whitespace-pre-wrap">
          {isRemoved ? (
            <span className="text-red-600 line-through">{oldLine}</span>
          ) : isAdded ? (
            <span className="text-green-600">{newLine}</span>
          ) : isModified ? (
            <>
              <span className="text-red-600 line-through">{oldLine}</span>
              <br />
              <span className="text-green-600">{newLine}</span>
            </>
          ) : (
            <span className="text-slate-600">{oldLine}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-200 flex gap-4">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-400 rounded" />
          Removed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-400 rounded" />
          Added
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-400 rounded" />
          Modified
        </span>
      </div>
      <div className="font-mono text-xs">
        {Array.from({ length: maxLines }, (_, i) => renderLine(oldLines[i], newLines[i], i))}
      </div>
    </div>
  );
}
