import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import Themed from './Themed';
import styles from './ScrollPanel.module.css';

/**
 * Scroll container with the themed 8px scrollbar, sitting 8px off the content.
 * The scrollbar's shape — a pill, or square with beveled caps — is the
 * scrollbar.track/thumb controls' business now, not a prop here.
 */
export default function ScrollPanel({
  children,
  fade = false,
  bleedLeft = 0,
  className,
}: {
  children: ReactNode;
  /** Fade the last few percent of the viewport (news list treatment). */
  fade?: boolean;
  /** Extra room (px) on the left so content decorations that straddle the
   *  edge (news gems) aren't clipped by the scroll viewport. */
  bleedLeft?: number;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 100 });

  const sync = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const { scrollTop, scrollHeight, clientHeight } = vp;
    const height = Math.max(12, (clientHeight / scrollHeight) * 100);
    const maxScroll = scrollHeight - clientHeight;
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * (100 - height) : 0;
    setThumb((prev) =>
      prev.top === top && prev.height === height ? prev : { top, height },
    );
  }, []);

  useEffect(() => {
    sync();
    const vp = viewportRef.current;
    if (!vp) return;
    const observer = new ResizeObserver(sync);
    observer.observe(vp);
    if (vp.firstElementChild) observer.observe(vp.firstElementChild);
    return () => observer.disconnect();
  }, [sync]);

  const dragThumb = (e: ReactPointerEvent) => {
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startScroll = vp.scrollTop;
    const thumbPx = track.clientHeight * (vp.clientHeight / vp.scrollHeight);
    const ratio =
      (vp.scrollHeight - vp.clientHeight) /
      Math.max(1, track.clientHeight - thumbPx);
    const move = (ev: PointerEvent) => {
      vp.scrollTop = startScroll + (ev.clientY - startY) * ratio;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const jumpToTrackPosition = (e: ReactPointerEvent) => {
    const vp = viewportRef.current;
    if (!vp || e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientY - rect.top) / rect.height;
    vp.scrollTop = fraction * (vp.scrollHeight - vp.clientHeight);
  };

  return (
    <div className={className ? `${styles.ScrollPanel} ${className}` : styles.ScrollPanel}>
      <div
        ref={viewportRef}
        className={styles.Viewport}
        data-fade={fade || undefined}
        style={
          bleedLeft
            ? { marginLeft: -bleedLeft, paddingLeft: bleedLeft }
            : undefined
        }
        onScroll={sync}
        tabIndex={0}
      >
        {children}
      </div>
      <Themed
        ref={trackRef}
        part="scrollbar.track"
        className={styles.Track}
        onPointerDown={jumpToTrackPosition}
        aria-hidden="true"
      >
        <Themed
          part="scrollbar.thumb"
          className={styles.Thumb}
          style={{ top: `${thumb.top}%`, height: `${thumb.height}%` }}
          onPointerDown={dragThumb}
        />
      </Themed>
    </div>
  );
}
