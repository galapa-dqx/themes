import { useState } from 'react';
import { SegmentedControl } from '@mantine/core';
import ReadOnlyBanner from './ReadOnlyBanner';
import ControlsPage from './ControlsPage';
import FontsPage from './FontsPage';
import Gallery from './Gallery';
import InfoPage from './InfoPage';
import Palette from './Palette';
import Slicer from './Slicer';
import Validator from './Validator';
import styles from './Studio.module.css';

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'palette', label: 'Palette' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'controls', label: 'Controls' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'slicer', label: 'Slicer' },
  { id: 'validator', label: 'Validator' },
] as const;

type StudioTab = (typeof TABS)[number]['id'];

/** Tabs that edit the theme and need the read-only notice. */
const EDITOR_TABS: StudioTab[] = ['info', 'palette', 'fonts', 'controls'];

/**
 * Full-page theme-development workspace. Lives OUTSIDE the themed subtree
 * and uses only hardcoded neutral styling: the theme being edited may be
 * broken, and the tools must survive that. Only the Gallery renders themed
 * content, inside an explicitly scoped sandbox.
 */
export default function StudioWorkspace() {
  const [tab, setTab] = useState<StudioTab>('palette');

  return (
    <div className={styles.Workspace}>
      <header className={styles.Head}>
        <SegmentedControl
          size="xs"
          value={tab}
          onChange={(value) => setTab(value as StudioTab)}
          data={TABS.map((t) => ({ value: t.id, label: t.label }))}
          aria-label="Studio tools"
        />
      </header>
      {EDITOR_TABS.includes(tab) && <ReadOnlyBanner />}
      {/* All tools stay mounted so switching tabs keeps work-in-progress. */}
      <div className={styles.Scroll} hidden={tab !== 'info'}>
        <InfoPage />
      </div>
      <div className={styles.Scroll} hidden={tab !== 'palette'}>
        <Palette />
      </div>
      <div className={styles.Scroll} hidden={tab !== 'fonts'}>
        <FontsPage />
      </div>
      <div className={styles.Scroll} hidden={tab !== 'controls'}>
        <ControlsPage />
      </div>
      <div className={styles.Scroll} hidden={tab !== 'gallery'}>
        <Gallery />
      </div>
      <div className={styles.Scroll} hidden={tab !== 'slicer'}>
        <Slicer />
      </div>
      <div className={styles.Scroll} hidden={tab !== 'validator'}>
        <Validator />
      </div>
    </div>
  );
}
