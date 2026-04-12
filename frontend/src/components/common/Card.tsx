import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  header?: ReactNode;
  footer?: ReactNode;
  padding?: boolean;
}

export function Card({
  title,
  header,
  footer,
  padding = true,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div className={`card ${className}`} {...props}>
      {(title || header) && (
        <div className="card-header">
          {title && <span className="card-title">{title}</span>}
          {header}
        </div>
      )}
      <div className={padding ? '' : '!p-0'}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({ children, className = '', ...props }: CardBodyProps) {
  return (
    <div className={`card-body ${className}`} {...props}>
      {children}
    </div>
  );
}

// Simple Card without header/footer
export function SimpleCard({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}
