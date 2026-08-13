import SettingRow from '@/components/SettingRow';
import shared from './SettingsShared.module.css';

export default function AboutSettings() {
  return (
    <div className={shared.Section}>
      <div className={shared.Column}>
        <h2 className={shared.SectionHeading}>About</h2>
        <SettingRow label="Version">0.4.2 (stable)</SettingRow>
        <SettingRow label="Runtime">Galapa Web 26.8</SettingRow>
        <SettingRow label="Licenses">Open-source notices</SettingRow>
      </div>
    </div>
  );
}
