import Themed from './Themed';
import styles from './ProgressBar.module.css';

/**
 * The progress bar: a themed trough with a fill inside it.
 *
 * The split is the usual one — the `progress.track` and `progress.indicator`
 * controls own how it looks (height, corners, fill, the inset between the two,
 * which is the track's own padding), and this component owns only what the
 * theme can't know: how far along the fill is, and the sweep it runs when
 * nobody knows how far along it is.
 *
 * `value` is a fraction, 0–1. Omit it for an indeterminate bar — the sweep
 * stays inside the trough (it grows out of the left edge and shrinks into the
 * right), so no theme's art has to be clipped to contain it.
 */
export default function ProgressBar({
  value,
  'aria-label': ariaLabel,
  className,
}: {
  /** Progress as a fraction of the whole, 0–1. Omit for indeterminate. */
  value?: number;
  'aria-label'?: string;
  className?: string;
}) {
  const determinate = value !== undefined;
  const percent = determinate
    ? Math.round(Math.min(1, Math.max(0, value)) * 100)
    : 0;

  return (
    <Themed
      part="progress.track"
      className={className ? `${styles.Track} ${className}` : styles.Track}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      // An indeterminate bar is spelled as a progressbar with no value at all,
      // which is what tells a screen reader to say "busy" rather than "0%".
      aria-valuenow={determinate ? percent : undefined}
      aria-valuetext={determinate ? `${percent}%` : undefined}
      data-indeterminate={determinate ? undefined : ''}
    >
      <Themed
        part="progress.indicator"
        className={styles.Indicator}
        // The one thing the theme has no opinion on. Left to the stylesheet
        // while indeterminate, where the sweep owns the width.
        style={determinate ? { width: `${percent}%` } : undefined}
      />
    </Themed>
  );
}
