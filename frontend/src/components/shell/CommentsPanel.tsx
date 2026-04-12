import { useState } from 'react';
import { useSelectionStore } from '../../stores';

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  resolved: boolean;
}

const mockComments: Comment[] = [
  {
    id: '1',
    author: 'You',
    content: 'Need to adjust the lighting here',
    timestamp: '1 hour ago',
    resolved: false,
  },
  { id: '2', author: 'Editor', content: 'Looks good!', timestamp: '3 hours ago', resolved: true },
];

export function CommentsPanel() {
  const [newComment, setNewComment] = useState('');
  const selectedAssetId = useSelectionStore(s => s.selectedAssetId);
  const selectedShotId = useSelectionStore(s => s.selectedShotId);
  const selectedSceneId = useSelectionStore(s => s.selectedSceneId);

  const hasSelection = selectedAssetId || selectedShotId || selectedSceneId;

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    console.log('Add comment:', newComment);
    setNewComment('');
  };

  if (!hasSelection) {
    return (
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Comments</h3>
        <div className="text-sm text-slate-500">
          Select an asset, shot, or scene to view or add comments.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Comments</h3>
      <div className="flex-1 space-y-3 overflow-auto">
        {mockComments.map(comment => (
          <div key={comment.id} className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">{comment.author}</span>
              <span className="text-xs text-slate-400">{comment.timestamp}</span>
            </div>
            <p className="text-sm text-slate-600">{comment.content}</p>
            {comment.resolved && (
              <span className="inline-block mt-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                Resolved
              </span>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleAddComment} className="mt-3">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!newComment.trim()}
          className="mt-2 w-full px-3 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Comment
        </button>
      </form>
    </div>
  );
}
