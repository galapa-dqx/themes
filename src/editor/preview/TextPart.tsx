/** A text part rendered with its resolved typography and colour. */
import { useContext } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import type { TextView } from './resolve';
import { useTextStyle } from './textStyle';
import { BoxesContext } from './useView';

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
  // Show boxes: the text box, so line-height and leading are visible.
  const boxes = useContext(BoxesContext);
  return (
    <Tag
      className={className}
      style={{
        ...text,
        ...style,
        ...(boxes && {
          outline: '1px dashed var(--mantine-color-teal-5)',
          outlineOffset: -1,
        }),
      }}
    >
      {children}
    </Tag>
  );
}
