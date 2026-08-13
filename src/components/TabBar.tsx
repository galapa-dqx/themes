import { Link, type LinkProps } from '@tanstack/react-router';
import {
  GamepadBumperLeft,
  GamepadBumperRight,
  GamepadTriggerLeft,
  GamepadTriggerRight,
} from './icons';
import styles from './TabBar.module.css';

export type TabItem = {
  id: string;
  label: string;
  to: LinkProps['to'];
};

const HINTS = {
  bumper: [GamepadBumperLeft, GamepadBumperRight],
  trigger: [GamepadTriggerLeft, GamepadTriggerRight],
} as const;

export default function TabBar({
  items,
  activeId,
  size = 'md',
  hints,
}: {
  items: TabItem[];
  activeId: string;
  /** md = window tabs (16px), sm = section tabs (14px). */
  size?: 'md' | 'sm';
  /** Which gamepad hint icons flank the tabs, if any. */
  hints?: keyof typeof HINTS;
}) {
  const [HintLeft, HintRight] = hints ? HINTS[hints] : [null, null];

  return (
    <nav className={styles.TabBar} data-size={size}>
      {HintLeft && <HintLeft className={styles.Hint} />}
      <div className={styles.Tabs}>
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className={styles.Tab}
            data-active={item.id === activeId || undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {HintRight && <HintRight className={styles.Hint} />}
    </nav>
  );
}
