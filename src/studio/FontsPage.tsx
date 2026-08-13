import { useEffect, useState } from 'react';
import {
  Autocomplete,
  Checkbox,
  NumberInput,
  Select,
} from '@mantine/core';
import { useOSSettings } from '@/context/os-settings';
import type { LabelCase, ThemeFont, ThemeFonts } from '@/theme';
import { ensureFontLoaded, fetchGoogleFonts } from './googleFonts';
import SpecimenIsland from './SpecimenIsland';
import styles from './Studio.module.css';

const SEED_FAMILIES = [
  'Crimson Pro',
  'Source Sans 3',
  'Space Grotesk',
  'Inter',
  'Playfair Display',
];

const CASES: LabelCase[] = ['uppercase', 'lowercase', 'capitalize', 'none'];

function FontEditor({
  title,
  font,
  families,
  disabled,
  onChange,
}: {
  title: string;
  font: ThemeFont;
  families: string[];
  disabled: boolean;
  onChange: (font: ThemeFont) => void;
}) {
  return (
    <div className={styles.Row}>
      <span className={styles.Label}>{title}</span>
      <Autocomplete
        size="xs"
        w={200}
        data={families}
        limit={12}
        value={font.family}
        disabled={disabled}
        onChange={(family) => onChange({ ...font, family })}
        onOptionSubmit={(family) => void ensureFontLoaded(family)}
        onBlur={() => void ensureFontLoaded(font.family)}
        aria-label={`${title} family`}
        placeholder="Search Google Fonts…"
      />
      <Select
        size="xs"
        w={110}
        data={['serif', 'sans-serif']}
        value={font.fallback}
        disabled={disabled}
        allowDeselect={false}
        onChange={(fallback) =>
          fallback &&
          onChange({ ...font, fallback: fallback as ThemeFont['fallback'] })
        }
        aria-label={`${title} fallback`}
      />
      <NumberInput
        size="xs"
        w={90}
        min={100}
        max={900}
        step={100}
        value={font.weight}
        disabled={disabled}
        onChange={(value) =>
          onChange({ ...font, weight: typeof value === 'number' ? value : 400 })
        }
        aria-label={`${title} weight`}
      />
      <Checkbox
        size="xs"
        label="italic"
        checked={font.style === 'italic'}
        disabled={disabled}
        onChange={(e) =>
          onChange({
            ...font,
            style: e.currentTarget.checked ? 'italic' : undefined,
          })
        }
      />
    </div>
  );
}

/** Typography: font roles plus the case "filters" and size overrides. */
export default function FontsPage() {
  const { theme, themeId, isCustomTheme, updateCustomTheme } = useOSSettings();
  const disabled = !isCustomTheme;
  const [families, setFamilies] = useState<string[]>(SEED_FAMILIES);

  useEffect(() => {
    let alive = true;
    fetchGoogleFonts().then(
      (list) => {
        if (alive) setFamilies(list.map((entry) => entry.family));
      },
      () => {
        /* offline: seed list stays */
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const setFonts = (fonts: ThemeFonts) => updateCustomTheme(themeId, { fonts });
  const hasStrong = theme.fonts.strong !== undefined;

  return (
    <div className={styles.Tool}>
      <h3 className={styles.SectionTitle}>Font roles</h3>
      <span className={styles.Meta}>
        Any Google Fonts family works — it loads on pick. Weights the family
        doesn't ship render synthesized.
      </span>
      <FontEditor
        title="Heading"
        font={theme.fonts.heading}
        families={families}
        disabled={disabled}
        onChange={(heading) => setFonts({ ...theme.fonts, heading })}
      />
      <FontEditor
        title="Body"
        font={theme.fonts.body}
        families={families}
        disabled={disabled}
        onChange={(body) => setFonts({ ...theme.fonts, body })}
      />
      <div className={styles.Row}>
        <Checkbox
          size="xs"
          label="Separate emphasis font (news titles, buttons)"
          checked={hasStrong}
          disabled={disabled}
          onChange={(e) =>
            setFonts({
              ...theme.fonts,
              strong: e.currentTarget.checked
                ? { ...theme.fonts.heading, style: undefined, weight: 700 }
                : undefined,
            })
          }
        />
      </div>
      {hasStrong && theme.fonts.strong && (
        <FontEditor
          title="Strong"
          font={theme.fonts.strong}
          families={families}
          disabled={disabled}
          onChange={(strong) => setFonts({ ...theme.fonts, strong })}
        />
      )}

      <h3 className={styles.SectionTitle}>Case filters & sizes</h3>
      <div className={styles.Row}>
        <Select
          size="xs"
          w={130}
          label="Label case"
          data={CASES}
          value={theme.labelCase}
          disabled={disabled}
          allowDeselect={false}
          onChange={(value) =>
            value &&
            updateCustomTheme(themeId, { labelCase: value as LabelCase })
          }
        />
        <Select
          size="xs"
          w={130}
          label="Field labels"
          data={CASES}
          value={theme.fieldLabelCase ?? 'none'}
          disabled={disabled}
          allowDeselect={false}
          onChange={(value) =>
            value &&
            updateCustomTheme(themeId, { fieldLabelCase: value as LabelCase })
          }
        />
        <NumberInput
          size="xs"
          w={110}
          label="Tab size px"
          min={10}
          max={24}
          placeholder="16"
          value={theme.tabSize ?? ''}
          disabled={disabled}
          onChange={(value) =>
            updateCustomTheme(themeId, {
              tabSize: typeof value === 'number' ? value : undefined,
            })
          }
        />
      </div>

      <h3 className={styles.SectionTitle}>Live specimen</h3>
      <SpecimenIsland />
    </div>
  );
}
