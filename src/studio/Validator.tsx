import { useEffect, useMemo, useState } from 'react';
import { Button, FileButton, Slider } from '@mantine/core';
import SliceGrid from '@/components/SliceGrid';
import { useOSSettings } from '@/context/os-settings';
import { parseNineSlice, type SliceSet } from '@/theme/nineSlice';
import styles from './Studio.module.css';

type ParseResult = { set?: SliceSet; error?: string };

// Pasted markup survives route switches (the validator unmounts on them).
let cachedSource = '';

export default function Validator() {
  const { theme } = useOSSettings();
  const [source, setSource] = useState(cachedSource);
  useEffect(() => {
    cachedSource = source;
  }, [source]);
  const [previewW, setPreviewW] = useState(300);
  const [previewH, setPreviewH] = useState(170);

  const result: ParseResult = useMemo(() => {
    if (!source.trim()) return {};
    try {
      return { set: parseNineSlice(source, theme.colors) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [source, theme.colors]);

  const onFile = (file: File | null) => {
    if (file) void file.text().then(setSource);
  };

  const loadExample = () => {
    void fetch('/theme-assets/aurelia/panel.9.svg')
      .then((res) => res.text())
      .then(setSource);
  };

  const track = (size: number | null) => (size === null ? '1fr' : `${size}px`);
  const [top, right, bottom, left] = result.set?.content ?? [0, 0, 0, 0];
  const [ot, orr, ob, ol] = result.set?.outset ?? [0, 0, 0, 0];

  return (
    <div className={styles.Tool}>
      <h3 className={styles.SectionTitle}>.9.svg input</h3>
      <div className={styles.Row}>
        <FileButton onChange={onFile} accept=".svg,image/svg+xml">
          {(props) => (
            <Button size="xs" variant="default" {...props}>
              Load file
            </Button>
          )}
        </FileButton>
        <Button size="xs" variant="default" onClick={loadExample}>
          Load example
        </Button>
      </div>
      <textarea
        className={styles.TextArea}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Paste a .9.svg here or load a file…"
        spellCheck={false}
        aria-label=".9.svg markup"
      />

      <h3 className={styles.SectionTitle}>Result</h3>
      {!source.trim() && <span className={styles.Meta}>Waiting for input.</span>}
      {result.error && (
        <span className={styles.Error}>✕ Invalid: {result.error}</span>
      )}
      {result.set && (
        <>
          <span className={styles.Good}>
            ✓ Valid {result.set.cols}×{result.set.rows} nine-slice
          </span>
          <span className={styles.Meta}>
            columns [{result.set.colSizes.map(track).join(', ')}] · rows [
            {result.set.rowSizes.map(track).join(', ')}] · content [{top},{' '}
            {right}, {bottom}, {left}] · outset [{ot}, {orr}, {ob}, {ol}] ·
            tokens resolved against theme "{theme.label}"
          </span>
          {result.set.warnings.map((w) => (
            <span key={w} className={styles.Error}>
              ⚠ {w}
            </span>
          ))}
          <div className={styles.Row}>
            <span className={styles.Label}>W {previewW}</span>
            <Slider w={160} size="sm" min={60} max={560} value={previewW} onChange={setPreviewW} label={null} />
            <span className={styles.Label}>H {previewH}</span>
            <Slider w={160} size="sm" min={40} max={420} value={previewH} onChange={setPreviewH} label={null} />
          </div>
          <div className={styles.PreviewBox}>
            <div
              className={styles.PreviewSurface}
              style={{ width: previewW, height: previewH }}
            >
              <SliceGrid
                set={result.set}
                style={{
                  position: 'absolute',
                  inset: `${-ot}px ${-orr}px ${-ob}px ${-ol}px`,
                }}
              />
              {ot + orr + ob + ol > 0 && <div className={styles.FrameOutline} />}
              <div
                className={styles.ContentOutline}
                style={{ top, right, bottom, left }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
