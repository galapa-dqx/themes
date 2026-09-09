/** A text part rendered with its resolved typography and colour. */
import type { CSSProperties, ElementType, ReactNode } from 'react';
import type { TextView } from './resolve';
import { useTextStyle } from './textStyle';

export function TextPart({
  view,
  as,
  className,
  style,
  children,
}: {
  view: TextView;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const Tag = as ?? 'span';
  const text = useTextStyle(view);
  return (
    <Tag className={className} style={{ ...text, ...style }}>
      {children}
    </Tag>
  );
}
