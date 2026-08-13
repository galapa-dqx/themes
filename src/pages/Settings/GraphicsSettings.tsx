import { useState, type ReactNode } from 'react';
import ScrollPanel from '@/components/ScrollPanel';
import SettingHelp from '@/components/SettingHelp';
import SettingRow from '@/components/SettingRow';
import Switch from '@/components/Switch';
import shared from './SettingsShared.module.css';

type ToggleId = 'vsync' | 'ignore-power';

type GraphicsSetting = {
  id: string;
  label: string;
  value?: string;
  toggle?: ToggleId;
  help: { title: string; body: ReactNode };
};

const SETTINGS: GraphicsSetting[] = [
  {
    id: 'screen-mode',
    label: 'Screen Mode',
    value: 'Borderless Windowed',
    help: {
      title: 'Screen Mode',
      body: (
        <>
          <p>
            Controls how the game occupies your screen — whether it takes
            exclusive control of the display or runs as a window managed by
            your desktop.
          </p>
          <p>
            <strong>Fullscreen</strong> — The game takes exclusive control of
            the display and can set its own resolution and refresh rate.
            Lowest input latency and most reliable G-Sync/FreeSync support,
            but alt-tabbing is slow and overlays may not work.
          </p>
          <p>
            <strong>Borderless Windowed</strong> (Recommended) — A window with
            no borders filling the screen, locked to your desktop's resolution
            and refresh rate. Instant alt-tabbing and reliable overlays, with
            a slight performance cost on older systems.
          </p>
          <p>
            <strong>Windowed</strong> — A standard resizable window on your
            desktop. Easiest for multitasking, but you lose screen space to
            the title bar and desktop.
          </p>
        </>
      ),
    },
  },
  {
    id: 'resolution',
    label: 'Screen Resolution',
    value: '1920x1080',
    help: {
      title: 'Screen Resolution',
      body: (
        <>
          <p>
            The resolution the game renders at in fullscreen mode. In
            borderless and windowed modes the game follows your desktop
            resolution, and this setting only affects the internal render
            target.
          </p>
          <p>
            Higher values are sharper but cost GPU time; pick your monitor's
            native resolution unless you need the extra headroom.
          </p>
        </>
      ),
    },
  },
  {
    id: 'brightness',
    label: 'Screen Brightness',
    value: '100%',
    help: {
      title: 'Screen Brightness',
      body: (
        <>
          <p>
            Adjusts the brightness of the game image only — your monitor and
            desktop are unaffected.
          </p>
          <p>
            Calibrate so the darkest symbol on the calibration screen is just
            barely visible.
          </p>
        </>
      ),
    },
  },
  {
    id: 'vsync',
    label: 'Vsync',
    toggle: 'vsync',
    help: {
      title: 'Vsync',
      body: (
        <>
          <p>
            Synchronizes frame delivery with your monitor's refresh rate to
            eliminate tearing.
          </p>
          <p>
            Adds a small amount of input latency. If you have a G-Sync or
            FreeSync display, you may prefer to leave this off and cap the
            framerate instead.
          </p>
        </>
      ),
    },
  },
  {
    id: 'ignore-power',
    label: 'Ignore power settings while running',
    toggle: 'ignore-power',
    help: {
      title: 'Ignore power settings while running',
      body: (
        <>
          <p>
            Keeps the game running at full performance even when your device
            switches to a power-saving plan — for example when a laptop is
            unplugged.
          </p>
          <p>Uses more battery, but prevents sudden framerate drops.</p>
        </>
      ),
    },
  },
  {
    id: 'text-rendering',
    label: 'Text Rendering',
    value: 'IMM32',
    help: {
      title: 'Text Rendering',
      body: (
        <>
          <p>
            Selects the input method framework used for chat and text entry.
          </p>
          <p>
            <strong>IMM32</strong> offers the broadest compatibility with
            third-party tools; <strong>TSF</strong> enables richer language
            features on modern systems.
          </p>
        </>
      ),
    },
  },
  {
    id: 'framerate',
    label: 'Framerate Limit',
    value: '60 fps',
    help: {
      title: 'Framerate Limit',
      body: (
        <>
          <p>Caps how many frames the game renders per second.</p>
          <p>
            Matching your monitor's refresh rate keeps frame pacing smooth and
            reduces heat and fan noise. Unlimited is best left for
            benchmarking.
          </p>
        </>
      ),
    },
  },
];

export default function GraphicsSettings() {
  const [focusedId, setFocusedId] = useState(SETTINGS[0].id);
  const [toggles, setToggles] = useState<Record<ToggleId, boolean>>({
    vsync: true,
    'ignore-power': false,
  });
  const focused = SETTINGS.find((s) => s.id === focusedId) ?? SETTINGS[0];

  return (
    <div className={shared.Section}>
      <ScrollPanel rounded>
        <div className={shared.Column}>
          <h2 className={shared.SectionHeading}>Application</h2>
          {SETTINGS.map((setting) => {
            const { toggle } = setting;
            return (
              <SettingRow
                key={setting.id}
                label={setting.label}
                active={setting.id === focusedId}
                onActivate={() => setFocusedId(setting.id)}
              >
                {toggle ? (
                  <Switch
                    checked={toggles[toggle]}
                    aria-label={setting.label}
                    onChange={(next) =>
                      setToggles((prev) => ({ ...prev, [toggle]: next }))
                    }
                  />
                ) : (
                  setting.value
                )}
              </SettingRow>
            );
          })}
        </div>
      </ScrollPanel>
      <SettingHelp title={focused.help.title}>{focused.help.body}</SettingHelp>
    </div>
  );
}
