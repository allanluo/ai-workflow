import { useEffect } from 'react';
import { useEventStore } from '../../stores';

export function ToastContainer() {
  const { activeToasts, removeToast } = useEventStore();

  useEffect(() => {
    activeToasts.forEach(toast => {
      const duration = toast.duration ?? 5000;
      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(toast.id);
        }, duration);
        return () => clearTimeout(timer);
      }
    });
  }, [activeToasts, removeToast]);

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {activeToasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : toast.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex-1">
            <div className="font-medium">{toast.title}</div>
            {toast.message && <div className="text-sm opacity-80 mt-0.5">{toast.message}</div>}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-current opacity-60 hover:opacity-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
