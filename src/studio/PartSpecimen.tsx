import { useState, type ReactNode } from 'react';
import Button from '@/components/Button';
import Carousel from '@/components/Carousel';
import NewsList from '@/components/NewsList';
import ScrollPanel from '@/components/ScrollPanel';
import SettingRow from '@/components/SettingRow';
import Skin from '@/components/Skin';
import Switch from '@/components/Switch';
import TabBar from '@/components/TabBar';
import TextInput from '@/components/TextInput';
import TitleBar from '@/components/TitleBar';
import { useOSSettings } from '@/context/os-settings';
import { themeStyle, type PartState } from '@/theme';
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
  partId: string;
  state: 'base' | PartState;
}) {
  const { theme } = useOSSettings();
  const disabled = state === 'disabled';
  const selected = state === 'selected';
  const checked = state === 'checked';

  let node: ReactNode;
  switch (partId) {
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
    default:
      node = <Skin part={partId} style={{ height: 120 }} />;
  }

  return (
    <div className={`theme-scope ${styles.Island}`} style={themeStyle(theme)}>
      {node}
    </div>
  );
}
