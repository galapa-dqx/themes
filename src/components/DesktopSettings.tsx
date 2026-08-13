import { useOSSettings } from '@/context/os-settings';
import './DesktopSettings.css';

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="settings-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function DesktopSettings() {
  const { winStyle, mode, setWinStyle, setMode } = useOSSettings();

  return (
    <aside className="desktop-settings">
      <div className="settings-row">
        <span>Window</span>
        <Segmented
          value={winStyle}
          options={[
            { value: 'win11', label: 'Win11' },
            { value: 'win10', label: 'Win10' },
          ]}
          onChange={setWinStyle}
        />
      </div>
      <div className="settings-row">
        <span>Mode</span>
        <Segmented
          value={mode}
          options={[
            { value: 'desktop', label: 'Desktop' },
            { value: 'console', label: 'Steam Deck' },
          ]}
          onChange={setMode}
        />
      </div>
    </aside>
  );
}
