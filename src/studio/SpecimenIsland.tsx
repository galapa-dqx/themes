import { useState } from 'react';
import Button from '@/components/Button';
import NewsList from '@/components/NewsList';
import PlayOrnament from '@/components/PlayOrnament';
import SettingRow from '@/components/SettingRow';
import Skin from '@/components/Skin';
import Switch from '@/components/Switch';
import TextInput from '@/components/TextInput';
import { useOSSettings } from '@/context/os-settings';
import { themeStyle } from '@/theme';
import styles from './Studio.module.css';

/** The live themed sandbox shared by the editor pages: every edit should be
 *  visible here immediately. The one themed subtree inside the studio. */
export default function SpecimenIsland() {
  const { theme } = useOSSettings();
  const [checked, setChecked] = useState(true);
  const [username, setUsername] = useState('anlucialuvr69');
  const [activeRow, setActiveRow] = useState('first');

  return (
    <div className={`theme-scope ${styles.Island}`} style={themeStyle(theme)}>
      <div className={styles.IslandRow}>
        <PlayOrnament />
        <Button>Play</Button>
        <PlayOrnament flip />
        <Switch checked={checked} onChange={setChecked} aria-label="Demo switch" />
      </div>
      <TextInput label="Username" value={username} onChange={setUsername} />
      <SettingRow
        label="Screen Mode"
        active={activeRow === 'first'}
        onActivate={() => setActiveRow('first')}
      >
        Borderless Windowed
      </SettingRow>
      <SettingRow
        label="Vsync"
        active={activeRow === 'second'}
        onActivate={() => setActiveRow('second')}
      >
        Idle row
      </SettingRow>
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
      <Skin part="panel" className={styles.IslandCard}>
        <span className={styles.IslandLabel}>panel surface</span>
      </Skin>
    </div>
  );
}
