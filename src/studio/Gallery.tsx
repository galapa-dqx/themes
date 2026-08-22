import { useState } from 'react';
import Button from '@/components/Button';
import NewsList from '@/components/NewsList';
import PlayOrnament from '@/components/PlayOrnament';
import ProgressBar from '@/components/ProgressBar';
import SettingRow from '@/components/SettingRow';
import Themed from '@/components/Themed';
import Switch from '@/components/Switch';
import TextInput from '@/components/TextInput';
import { useOSSettings } from '@/context/os-settings';
import { themeStyle } from '@/theme';
import styles from './Studio.module.css';

/** Every themed part in one place. The studio chrome is unthemed; only the
 *  sandbox below carries the active theme's variables. */
export default function Gallery() {
  const { theme, compiled } = useOSSettings();
  const [switchOn, setSwitchOn] = useState(true);
  const [switchOff, setSwitchOff] = useState(false);
  const [username, setUsername] = useState('anlucialuvr69');
  const [activeRow, setActiveRow] = useState('first');

  return (
    <div className={styles.Tool}>
      <p className={styles.Hint}>
        Specimens render inside a sandbox scoped to the active theme (
        {theme.label}). The studio chrome around them is deliberately
        unthemed.
      </p>
      <div
        className={`theme-scope ${styles.Island}`}
        style={compiled ? themeStyle(compiled) : undefined}
      >
        <span className={styles.IslandLabel}>Button + ornament</span>
        <div className={styles.IslandRow}>
          <PlayOrnament />
          <Button>Play</Button>
          <PlayOrnament flip />
        </div>

        <span className={styles.IslandLabel}>Switch</span>
        <div className={styles.IslandRow}>
          <Switch checked={switchOn} onChange={setSwitchOn} aria-label="Demo on" />
          <Switch checked={switchOff} onChange={setSwitchOff} aria-label="Demo off" />
        </div>

        <span className={styles.IslandLabel}>Progress</span>
        <div className={styles.IslandColumn}>
          <ProgressBar value={0.62} aria-label="Demo progress, 62 percent" />
          <ProgressBar aria-label="Demo progress, indeterminate" />
        </div>

        <span className={styles.IslandLabel}>Text input</span>
        <TextInput label="Username" value={username} onChange={setUsername} />

        <span className={styles.IslandLabel}>Setting rows</span>
        <SettingRow
          label="Setting row"
          active={activeRow === 'first'}
          onActivate={() => setActiveRow('first')}
        >
          Selected state
        </SettingRow>
        <SettingRow
          label="Another row"
          active={activeRow === 'second'}
          onActivate={() => setActiveRow('second')}
        >
          Idle state
        </SettingRow>

        <span className={styles.IslandLabel}>News items</span>
        <div style={{ paddingLeft: 8 }}>
          <NewsList
            items={[
              { id: 'ev', category: 'events', title: 'Events category gem', date: 'Aug 9' },
              { id: 'up', category: 'updates', title: 'Updates category gem', date: 'Aug 8' },
              { id: 'mt', category: 'maintenance', title: 'Maintenance category gem', date: 'Aug 7' },
              { id: 'nw', category: 'news', title: 'News category gem', date: 'Aug 6' },
            ]}
          />
        </div>

        <span className={styles.IslandLabel}>Panel surface</span>
        <Themed part="panel" className={styles.IslandCard}>
          <span className={styles.IslandLabel}>panel content box</span>
        </Themed>
      </div>
    </div>
  );
}
