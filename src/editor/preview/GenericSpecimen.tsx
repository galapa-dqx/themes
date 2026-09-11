/**
 * The fallback specimen: composes the kind renderers from the catalog shape
 * alone. A control's port replaces it with a faithful one in the registry.
 */
import type { ReactNode } from 'react';
import { controlLabel } from '@/editor/tokensUtil';
import { Frame } from './Frame';
import { ImagePart } from './ImagePart';
import type { ControlView, FocusRingView } from './resolve';
import { TextPart } from './TextPart';
import { SAMPLE } from './textStyle';

function Node({
  view,
  ring,
}: {
  view: ControlView;
  ring: FocusRingView;
}): ReactNode {
  const name = view.id.split('.').pop()!;
  const parts = Object.entries(view.parts);
  switch (view.kind) {
    case 'frame': {
      // A text part named `label` on a control with a left inset is the seated label.
      const seated = parts.find(
        ([n, p]) =>
          n === 'label' && p.kind === 'text' && p.text.leftInset !== undefined,
      );
      const seatedText =
        seated?.[1].kind === 'text' ? seated[1].text : undefined;
      return (
        <Frame
          view={view.frame}
          ring={view.showRing ? ring : undefined}
          label={
            seated && seatedText ? (
              <TextPart view={seatedText} style={{ paddingInline: 5 }}>
                {SAMPLE[seated[1].id] ?? controlLabel(seated[0])}
              </TextPart>
            ) : undefined
          }
          leftInset={seatedText?.leftInset}
          style={{
            gap: 8,
            // A bare surface (panel) gets main's 120px specimen box.
            minWidth: parts.length || view.frame.size ? undefined : 200,
            minHeight: parts.length || view.frame.size ? undefined : 120,
          }}
        >
          {parts
            .filter(([n]) => n !== seated?.[0])
            .map(([n, p]) => (
              <Node key={n} view={p} ring={ring} />
            ))}
        </Frame>
      );
    }
    case 'text':
      return (
        <TextPart view={view.text}>
          {SAMPLE[view.id] ?? controlLabel(name)}
        </TextPart>
      );
    case 'paint':
      return (
        <span
          style={{
            display: 'inline-block',
            width: 2,
            height: '1em',
            background: view.paint.color,
            opacity: view.paint.opacity,
          }}
        />
      );
    case 'image':
      return (
        <ImagePart view={view.image} ring={view.showRing ? ring : undefined} />
      );
    case 'variant-image':
      return (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          {Object.keys(view.variant.assets).map((v) => (
            <ImagePart key={v} view={view.variant} variant={v} />
          ))}
        </span>
      );
    case 'window':
      return (
        <div
          style={{
            width: '100%',
            height: 80,
            borderRadius: 8,
            background: view.window.fill,
            border: `1px solid ${view.window.borderColor === 'none' ? 'transparent' : view.window.borderColor}`,
            boxShadow:
              '0 25px 50px -12px rgb(0 0 0/45%), 0 2px 8px rgb(0 0 0/20%)',
          }}
        />
      );
    case 'focus-ring':
      return (
        <div
          style={{
            width: 120,
            height: 36,
            borderRadius: 4,
            outline: `${view.ring.width}px solid ${view.ring.color}`,
            outlineOffset: view.ring.offset,
            border: '1px solid #8884',
          }}
        />
      );
    case 'composite':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          {parts.map(([n, p]) => (
            <Node key={n} view={p} ring={ring} />
          ))}
        </span>
      );
  }
}

export function GenericSpecimen({
  view,
  ring,
}: {
  view: ControlView;
  ring: FocusRingView;
}) {
  return <Node view={view} ring={ring} />;
}
