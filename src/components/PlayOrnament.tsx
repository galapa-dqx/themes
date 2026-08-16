import ThemedArt from './ThemedArt';
import { Flourish } from './icons';

/**
 * Theme-owned decoration beside the Play button. The `play-ornament` control
 * supplies the mark; where a theme declares none, the default flourish shows.
 * It's tinted by the surrounding play-row colour via `currentColor`.
 */
export default function PlayOrnament({ flip = false }: { flip?: boolean }) {
  const flipStyle = flip ? { transform: 'scaleX(-1)' } : undefined;
  return (
    <ThemedArt
      part="play-ornament"
      style={flipStyle}
      fallback={<Flourish style={flipStyle} />}
    />
  );
}
