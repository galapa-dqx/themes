import { Button, FileButton, Textarea, TextInput } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { FALLBACK_THEME_ID, useOSSettings } from '@/context/os-settings';
import { compiledBundle, type ThemeMeta } from '@/theme';
import styles from './Studio.module.css';

/** Theme identity & release metadata — everything a bundled theme ships. */
export default function InfoPage() {
  const { theme, themeId, compiled, isCustomTheme, updateCustomTheme, deleteTheme } =
    useOSSettings();
  const navigate = useNavigate();
  const disabled = !isCustomTheme;

  // The compiled bundle: the theme resolved to literals, self-contained. Works
  // for built-ins too — you're downloading its rendered form, not editing it —
  // so this is the one action here that isn't gated on `disabled`.
  const downloadCompiled = () => {
    if (!compiled) return;
    const { filename, json } = compiledBundle(compiled);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setMeta = (patch: Partial<ThemeMeta>) =>
    updateCustomTheme(themeId, { meta: { ...theme.meta, ...patch } });

  const onPreviewImage = (file: File | null) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      console.warn('[studio] preview image over 1MB; storage quota may suffer');
    }
    const reader = new FileReader();
    reader.onload = () => setMeta({ previewImage: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const remove = () => {
    if (window.confirm(`Delete theme "${theme.label}"? This cannot be undone.`)) {
      deleteTheme(themeId);
      void navigate({
        to: '/themes/$themeId/editor/info',
        params: { themeId: FALLBACK_THEME_ID },
      });
    }
  };

  return (
    <div className={styles.Tool}>
      <h3 className={styles.SectionTitle}>Identity</h3>
      <div className={styles.Row}>
        <TextInput
          size="xs"
          w={200}
          label="Name"
          value={theme.label}
          disabled={disabled}
          onChange={(e) => updateCustomTheme(themeId, { label: e.target.value })}
        />
        <TextInput
          size="xs"
          w={110}
          label="Version"
          placeholder="0.1.0"
          value={theme.meta?.version ?? ''}
          disabled={disabled}
          onChange={(e) => setMeta({ version: e.target.value })}
        />
        <TextInput
          size="xs"
          w={240}
          label="Maintainer"
          placeholder="you@example.com or a name"
          value={theme.meta?.maintainer ?? ''}
          disabled={disabled}
          onChange={(e) => setMeta({ maintainer: e.target.value })}
        />
      </div>
      <TextInput
        size="xs"
        label="Update URL"
        placeholder="https://example.com/themes/mytheme.json"
        value={theme.meta?.updateUrl ?? ''}
        disabled={disabled}
        onChange={(e) => setMeta({ updateUrl: e.target.value })}
      />
      <Textarea
        size="xs"
        label="Description"
        placeholder="What's the vibe?"
        autosize
        minRows={3}
        value={theme.meta?.description ?? ''}
        disabled={disabled}
        onChange={(e) => setMeta({ description: e.target.value })}
      />

      <h3 className={styles.SectionTitle}>Preview image</h3>
      <div className={styles.Row}>
        <FileButton onChange={onPreviewImage} accept="image/*" disabled={disabled}>
          {(props) => (
            <Button size="xs" variant="default" {...props}>
              Upload image
            </Button>
          )}
        </FileButton>
        {theme.meta?.previewImage && !disabled && (
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setMeta({ previewImage: undefined })}
          >
            Remove
          </Button>
        )}
      </div>
      {theme.meta?.previewImage && (
        <img
          className={styles.Thumb}
          src={theme.meta.previewImage}
          alt={`${theme.label} preview`}
        />
      )}

      <h3 className={styles.SectionTitle}>Compiled bundle</h3>
      <span className={styles.Meta}>
        The theme resolved to literals — palette tokens, font roles and art all
        inlined — as a self-contained JSON file with nothing left to fetch.
      </span>
      <div className={styles.Row}>
        <Button
          size="xs"
          variant="default"
          disabled={!compiled}
          onClick={downloadCompiled}
        >
          Download compiled theme
        </Button>
      </div>

      {isCustomTheme && (
        <>
          <h3 className={styles.SectionTitle}>Danger zone</h3>
          <div className={styles.Row}>
            <Button size="xs" color="red" variant="light" onClick={remove}>
              Delete theme
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
