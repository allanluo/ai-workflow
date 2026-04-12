import { useAppStore } from '../../stores';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const currentProjectTitle = useAppStore(s => s.currentProjectTitle);

  return (
    <nav className="flex items-center gap-1 text-sm">
      <a href="/" className="text-slate-500 hover:text-slate-700">
        Home
      </a>
      {currentProjectTitle && (
        <>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-medium">{currentProjectTitle}</span>
        </>
      )}
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          <span className="text-slate-300">/</span>
          {item.href ? (
            <a href={item.href} className="text-slate-500 hover:text-slate-700">
              {item.label}
            </a>
          ) : (
            <span className="text-slate-700 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
