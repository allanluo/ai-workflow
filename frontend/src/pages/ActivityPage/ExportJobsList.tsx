import type { ExportJob } from './ActivityPage';

interface ExportJobsListProps {
  jobs: ExportJob[];
}

const statusConfig = {
  queued: { label: 'Queued', color: 'bg-slate-100 text-slate-600' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
};

export function ExportJobsList({ jobs }: ExportJobsListProps) {
  const handleRetry = (jobId: string) => {
    console.log('Retry export job:', jobId);
  };

  const handleDownload = (jobId: string) => {
    console.log('Download export:', jobId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-700">Export Jobs</h3>
        <button className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          New Export
        </button>
      </div>

      <div className="space-y-3">
        {jobs.map(job => {
          const status = statusConfig[job.status];
          return (
            <div key={job.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-700">{job.format}</span>
                <span className={`text-xs px-2 py-1 rounded ${status.color}`}>{status.label}</span>
              </div>

              {job.status === 'processing' && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progress</span>
                    <span>{job.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded">
                    <div
                      className="h-full bg-blue-500 rounded transition-all"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Created {job.createdAt}</span>
                <div className="flex gap-2">
                  {job.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(job.id)}
                      className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                    >
                      Retry
                    </button>
                  )}
                  {job.status === 'completed' && (
                    <button
                      onClick={() => handleDownload(job.id)}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Download
                    </button>
                  )}
                  {job.status === 'processing' && (
                    <button className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
