import { useEffect, useState } from 'react';
import { useOSSettings } from '@/context/os-settings';
import { substituteTokens } from '@/theme/nineSlice';
import { Flourish } from './icons';

const cache = new Map<string, Promise<string>>();

function loadSvgText(url: string): Promise<string> {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
      return res.text();
    });
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
}

/**
 * Theme-owned decoration beside the Play button. `theme.ornaments.play`:
 * undefined → default flourish, null → nothing (Kyururu), URL → inline
 * token-coloured SVG (Anlucia's swords, Kyururu's squares, ...).
 */
export default function PlayOrnament({ flip = false }: { flip?: boolean }) {
  const { theme } = useOSSettings();
  const url = theme.ornaments?.play;
  const [svg, setSvg] = useState<{ url: string; text: string } | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    loadSvgText(url).then(
      (text) => {
        if (alive) setSvg({ url, text });
      },
      (err: unknown) => console.warn('[theme] play ornament failed', err),
    );
    return () => {
      alive = false;
    };
  }, [url]);

  if (url === null) return null;
  const flipStyle = flip ? { transform: 'scaleX(-1)' } : undefined;
  if (url === undefined) return <Flourish style={flipStyle} />;
  if (!svg || svg.url !== url) return null;
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-flex', ...flipStyle }}
      dangerouslySetInnerHTML={{
        __html: substituteTokens(svg.text, theme.colors),
      }}
    />
  );
}
