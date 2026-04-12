import { HTMLAttributes } from 'react';

type BadgeVariant = 'draft' | 'running' | 'success' | 'warning' | 'error' | 'approved' | 'purple';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  variant = 'draft',
  dot = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const variantClasses: Record<BadgeVariant, string> = {
    draft: 'badge-draft',
    running: 'badge-running',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    approved: 'badge-approved',
    purple: 'badge-purple',
  };

  const dotColors: Record<BadgeVariant, string> = {
    draft: 'bg-text-muted',
    running: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
    approved: 'bg-success',
    purple: 'bg-purple',
  };

  return (
    <span className={`badge ${variantClasses[variant]} ${className}`} {...props}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}

// Icon mapping for common status indicators
export function StatusBadge({
  status,
  label,
}: {
  status: 'draft' | 'running' | 'success' | 'warning' | 'error';
  label?: string;
}) {
  const config: Record<string, { variant: BadgeVariant; icon: string }> = {
    draft: { variant: 'draft', icon: '○' },
    running: { variant: 'running', icon: '◐' },
    success: { variant: 'success', icon: '✓' },
    warning: { variant: 'warning', icon: '⚠' },
    error: { variant: 'error', icon: '✗' },
  };

  const { variant, icon } = config[status] || config.draft;

  return (
    <Badge variant={variant} dot>
      {icon} {label || status}
    </Badge>
  );
}
