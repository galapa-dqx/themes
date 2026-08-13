import SettingRow from '@/components/SettingRow';
import shared from './SettingsShared.module.css';

/** Stand-in body for settings sections that aren't designed yet. */
export default function SettingsPlaceholder({ title }: { title: string }) {
  return (
    <div className={shared.Section}>
      <div className={shared.Column}>
        <h2 className={shared.SectionHeading}>{title}</h2>
        <SettingRow label="Coming soon">Not yet wired up</SettingRow>
      </div>
    </div>
  );
}
