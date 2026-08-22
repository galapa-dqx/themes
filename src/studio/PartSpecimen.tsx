import { useState, type ReactNode } from 'react';
import Button from '@/components/Button';
import Carousel from '@/components/Carousel';
import NewsList from '@/components/NewsList';
import ProgressBar from '@/components/ProgressBar';
import ScrollPanel from '@/components/ScrollPanel';
import SettingRow from '@/components/SettingRow';
import Themed from '@/components/Themed';
import Switch from '@/components/Switch';
import TabBar from '@/components/TabBar';
import TextInput from '@/components/TextInput';
import TitleBar from '@/components/TitleBar';
import { useOSSettings } from '@/context/os-settings';
import { themeStyle, type ControlId, type PartState } from '@/theme';
import styles from './Studio.module.css';

const SLIDES = [
  { src: '/banners/dqx-shop.jpg', alt: 'DQX Shop banner' },
  { src: '/banners/version-update.svg', alt: 'Version update banner' },
  { src: '/banners/anniversary.svg', alt: 'Anniversary banner' },
];

function SwitchSpecimen({
  checked,
  disabled,
}: {
  checked: boolean;
  disabled: boolean;
}) {
  const [on, setOn] = useState(false);
  return (
    <Switch
      checked={checked || on}
      onChange={setOn}
      disabled={disabled}
      aria-label="Switch specimen"
    />
  );
}

function InputSpecimen({ disabled }: { disabled: boolean }) {
  const [value, setValue] = useState('anlucialuvr69');
  return (
    <TextInput
      label="Username"
      value={value}
      onChange={setValue}
      disabled={disabled}
    />
  );
}

/**
 * Renders ONLY the component the selected part belongs to, inside a themed
 * sandbox. States that are props (selected/checked/disabled) are forced;
 * hover/pressed/focused are interactive on the specimen itself.
 */
export default function PartSpecimen({
  partId,
  state,
}: {
  partId: ControlId;
  state: 'base' | PartState;
}) {
  const { compiled } = useOSSettings();
  const disabled = state === 'disabled';
  const selected = state === 'selected';
  const checked = state === 'checked';

  let node: ReactNode;
  switch (partId) {
    case 'window':
      // The window renders as a plain framed surface, not via <Themed> — so
      // the specimen shows exactly that: fill, text baseline, and border.
      node = (
        <div
          style={{
            background: 'var(--g-window-fill)',
            color: 'var(--g-window-content)',
            border: '1px solid var(--g-window-bc)',
            borderRadius: 6,
            padding: 24,
            minHeight: 72,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          Window surface — fill, text baseline and border.
        </div>
      );
      break;
    case 'button':
      node = (
        <div className={styles.IslandRow}>
          <Button disabled={disabled}>Play</Button>
        </div>
      );
      break;
    case 'switch.track':
    case 'switch.thumb':
      node = (
        <div className={styles.IslandRow}>
          <SwitchSpecimen checked={checked} disabled={disabled} />
        </div>
      );
      break;
    case 'input':
      node = <InputSpecimen disabled={disabled} />;
      break;
    case 'setting-row':
      node = (
        <SettingRow
          label="Screen Mode"
          active={selected}
          onActivate={() => {}}
        >
          Borderless Windowed
        </SettingRow>
      );
      break;
    case 'news-item':
      node = (
        <div style={{ paddingLeft: 8 }}>
          <NewsList
            items={[
              {
                id: 'demo',
                category: 'events',
                title: 'News item with category gem',
                date: 'Aug 11',
              },
            ]}
          />
        </div>
      );
      break;
    case 'tab':
      node = (
        <div style={{ height: 34 }}>
          <TabBar
            items={[
              { id: 'launcher', label: 'Launcher', to: '/' },
              { id: 'settings', label: 'Settings', to: '/' },
            ]}
            activeId={selected ? 'launcher' : ''}
          />
        </div>
      );
      break;
    case 'titlebar':
      node = <TitleBar />;
      break;
    case 'carousel':
    case 'pip':
      node = <Carousel slides={SLIDES} />;
      break;
    case 'scrollbar.track':
    case 'scrollbar.thumb':
      node = (
        <div style={{ height: 140 }}>
          <ScrollPanel>
            <div style={{ height: 400, padding: 8 }}>
              The scrollbar lives on the right; drag or scroll to see the
              thumb move.
            </div>
          </ScrollPanel>
        </div>
      );
      break;
    case 'progress.track':
    case 'progress.indicator':
      node = (
        <div className={styles.IslandColumn}>
          <ProgressBar value={0.62} aria-label="Determinate progress specimen" />
          <ProgressBar aria-label="Indeterminate progress specimen" />
        </div>
      );
      break;
    default:
      node = <Themed part={partId} style={{ height: 120 }} />;
  }

  return (
    <div
      className={`theme-scope ${styles.Island}`}
      style={compiled ? themeStyle(compiled) : undefined}
    >
      {node}
    </div>
  );
}
