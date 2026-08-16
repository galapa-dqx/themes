import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  FileButton,
  Select,
  Slider,
  Switch,
} from '@mantine/core';
import SliceGrid from '@/components/SliceGrid';
import EdgeInput from './EdgeInput';
import { useOSSettings } from '@/context/os-settings';
import { parseNineSlice, type SliceSet } from '@/theme/nineSlice';
import { SIDES, substituteTokens, type Side } from '@/theme';
import {
  cellName,
  cellRects,
  defaultDoc,
  extractPalette,
  importNineSliceDoc,
  innerMarkup,
  parseViewBox,
  replaceColor,
  REPEAT_MODES,
  type BuildGrid,
  type Box,
  type RepeatMode,
  type SlicerDoc,
} from './slicer/doc';
import { sliceNineSvg } from './slicer/sliceEngine';
import SlicerCanvas, { type CellSel } from './slicer/SlicerCanvas';
import styles from './Studio.module.css';

const DEMO_SOURCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect x="1" y="1" width="94" height="94" fill="var(--theme-surface)" stroke="var(--theme-border)" stroke-width="2"/>
  <rect x="6" y="6" width="84" height="84" fill="none" stroke="var(--theme-accent)" stroke-width="1"/>
  <circle cx="12" cy="12" r="5" fill="var(--theme-accent)"/>
  <circle cx="84" cy="12" r="5" fill="var(--theme-accent)"/>
  <circle cx="12" cy="84" r="5" fill="var(--theme-accent)"/>
  <circle cx="84" cy="84" r="5" fill="var(--theme-accent)"/>
  <path d="M48 1.5 L51 4 L48 6.5 L45 4 Z" fill="var(--theme-accent)"/>
  <path d="M48 89.5 L51 92 L48 94.5 L45 92 Z" fill="var(--theme-accent)"/>
  <path d="M1.5 48 L4 45 L6.5 48 L4 51 Z" fill="var(--theme-accent)"/>
  <path d="M89.5 48 L92 45 L94.5 48 L92 51 Z" fill="var(--theme-accent)"/>
</svg>`;

type BuildResult = {
  text?: string;
  set?: SliceSet;
  warnings?: string[];
  error?: string;
};

function BoxFields({
  legend,
  value,
  sides,
  min,
  onChange,
}: {
  legend: string;
  value: Box;
  sides: readonly Side[];
  min: number;
  onChange: (box: Box) => void;
}) {
  return (
    <EdgeInput
      label={legend}
      // Which side each box drives isn't guessable at a glance the way it is
      // on a padding field, and this is where you're matching numbers to art.
      hint={sides.join(' / ')}
      // A grid with only one band per axis has no meaningful edge on the
      // other, so those sides are pinned out rather than shown as zeroes.
      sides={sides}
      min={min}
      value={[value.top, value.right, value.bottom, value.left]}
      onChange={(next) => {
        const [top, right, bottom, left] = Array.isArray(next)
          ? next
          : [next ?? 0, next ?? 0, next ?? 0, next ?? 0];
        onChange({ top, right, bottom, left });
      }}
    />
  );
}

// The slicer is a route now, so it unmounts on tab/view switches; keep the
// document (the real work-in-progress) alive at module level. View prefs
// (zoom, selection, preview size) intentionally reset.
let cachedDoc: SlicerDoc | null = null;

export default function Slicer() {
  const { theme } = useOSSettings();
  const [doc, setDoc] = useState<SlicerDoc>(
    () => cachedDoc ?? defaultDoc(DEMO_SOURCE),
  );
  useEffect(() => {
    cachedDoc = doc;
  }, [doc]);
  const [selection, setSelection] = useState<CellSel | null>(null);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [previewW, setPreviewW] = useState(300);
  const [previewH, setPreviewH] = useState(170);
  const [zoom, setZoom] = useState(1);
  const [overlays, setOverlays] = useState(true);

  // The Paper.js pass is the expensive step; debounce it behind live edits
  // (canvas drags update `doc` on every pointer move).
  const [buildDoc, setBuildDoc] = useState(doc);
  useEffect(() => {
    const t = setTimeout(() => setBuildDoc(doc), 150);
    return () => clearTimeout(t);
  }, [doc]);

  const built: BuildResult = useMemo(() => {
    try {
      const { text, warnings } = sliceNineSvg(buildDoc);
      return {
        text,
        warnings,
        set: parseNineSlice(substituteTokens(text, theme.palette)),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [buildDoc, theme.palette]);

  const viewBox = useMemo(() => {
    try {
      return parseViewBox(doc.source);
    } catch {
      return null;
    }
  }, [doc.source]);

  const art = useMemo(
    () => substituteTokens(innerMarkup(doc.source), theme.palette),
    [doc.source, theme.palette],
  );

  const palette = useMemo(() => extractPalette(doc.source), [doc.source]);
  const roles = Object.keys(theme.palette);
  const roleOptions = roles.map((r) => ({ value: r, label: `--theme-${r}` }));

  const loadText = (text: string, name: string) => {
    setSelection(null);
    if (/id="\d+_\d+"/.test(text)) {
      try {
        const { doc: imported, warnings } = importNineSliceDoc(text);
        setDoc(imported);
        setLoadNote(
          `Imported sliced ${name}` +
            (warnings.length ? ` — ${warnings.join('; ')}` : ''),
        );
        return;
      } catch (err) {
        setLoadNote(
          `${name} looks pre-sliced but couldn't be imported (${
            err instanceof Error ? err.message : String(err)
          }); loaded as plain artwork`,
        );
        setDoc(defaultDoc(text));
        return;
      }
    }
    setDoc(defaultDoc(text));
    setLoadNote(`Loaded ${name} as unsliced artwork`);
  };

  const onFile = (file: File | null) => {
    if (file) void file.text().then((text) => loadText(text, file.name));
  };

  const loadExample = () => {
    void fetch('/theme-assets/aurelia/panel.9.svg')
      .then((res) => res.text())
      .then((text) => loadText(text, 'aurelia/panel.9.svg'));
  };

  const exportFile = () => {
    if (!built.text) return;
    const blob = new Blob([built.text], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'part.9.svg';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const cells = viewBox ? cellRects(doc, viewBox[2], viewBox[3]) : [];
  const selCell =
    selection &&
    cells.find((c) => c.col === selection.col && c.row === selection.row);
  const selKey = selCell ? `${selCell.col}_${selCell.row}` : '';
  const selRepeat = doc.repeat[selKey] ?? 'stretch';

  const bandSides =
    doc.grid === '3x1'
      ? (['left', 'right'] as const)
      : doc.grid === '1x3'
        ? (['top', 'bottom'] as const)
        : SIDES;

  const [ct, cr, cb, cl] = built.set?.content ?? [0, 0, 0, 0];
  const [ot, orr, ob, ol] = built.set?.outset ?? [0, 0, 0, 0];
  const warnings = [
    ...new Set([...(built.warnings ?? []), ...(built.set?.warnings ?? [])]),
  ];

  return (
    <div className={styles.Tool}>
      <h3 className={styles.SectionTitle}>Source</h3>
      <div className={styles.Row}>
        <FileButton onChange={onFile} accept=".svg,image/svg+xml">
          {(props) => (
            <Button size="xs" variant="default" {...props}>
              Load .svg / .9.svg
            </Button>
          )}
        </FileButton>
        <Button size="xs" variant="default" onClick={loadExample}>
          Import example
        </Button>
        <Button
          size="xs"
          variant="default"
          onClick={() => loadText(DEMO_SOURCE, 'demo art')}
        >
          Demo art
        </Button>
        <Select
          size="xs"
          w={90}
          aria-label="Grid"
          data={[
            { value: '3x3', label: '3×3' },
            { value: '3x1', label: '3×1' },
            { value: '1x3', label: '1×3' },
          ]}
          value={doc.grid}
          allowDeselect={false}
          onChange={(v) => v && setDoc({ ...doc, grid: v as BuildGrid })}
        />
        <Button size="xs" variant="default" onClick={exportFile} disabled={!built.text}>
          Export .9.svg
        </Button>
      </div>
      {loadNote && <span className={styles.Meta}>{loadNote}</span>}
      {built.error && <span className={styles.Error}>✕ {built.error}</span>}

      <div className={styles.EditorSplit}>
        <div className={styles.CanvasPane}>
          {viewBox ? (
            <div className={styles.CanvasBox}>
              <SlicerCanvas
                doc={doc}
                viewBox={viewBox}
                art={art}
                selection={selection}
                onSelect={setSelection}
                onChange={setDoc}
              />
            </div>
          ) : (
            <span className={styles.Error}>
              Source SVG has no usable viewBox — load a file that declares one
              (or width/height).
            </span>
          )}
          <span className={styles.Legend}>
            <span style={{ color: '#7cc4ff' }}>■ slice cuts</span>
            {' · '}
            <span style={{ color: '#ffd43b' }}>◆ frame (outset)</span>
            {' · '}
            <span style={{ color: '#86e29b' }}>● content box</span>
            {' — drag the handles; click a cell to select it'}
          </span>
        </div>

        <div className={styles.Inspector}>
          {selCell ? (
            <fieldset className={styles.Frame}>
              <legend>{cellName(selCell, doc.grid)}</legend>
              {(selCell.stretchX || selCell.stretchY) && (
                <Select
                  size="xs"
                  label="Repeat mode"
                  data={REPEAT_MODES}
                  value={doc.repeat[selKey] ?? 'stretch'}
                  allowDeselect={false}
                  onChange={(v) => {
                    if (!v) return;
                    const repeat = { ...doc.repeat };
                    const aspect = { ...doc.aspect };
                    if (v === 'stretch') {
                      delete repeat[selKey];
                    } else {
                      repeat[selKey] = v as RepeatMode;
                      // Tiled slices ignore preserveAspectRatio, so the
                      // aspect flag turns off with the switch it greys out.
                      delete aspect[selKey];
                    }
                    setDoc({ ...doc, repeat, aspect });
                  }}
                />
              )}
              {(!selCell.stretchX || !selCell.stretchY) && (
                <Switch
                  size="xs"
                  label="Scale with aspect ratio"
                  disabled={selRepeat !== 'stretch'}
                  checked={selRepeat === 'stretch' && Boolean(doc.aspect[selKey])}
                  onChange={(e) => {
                    const aspect = { ...doc.aspect };
                    if (e.currentTarget.checked) aspect[selKey] = true;
                    else delete aspect[selKey];
                    setDoc({ ...doc, aspect });
                  }}
                />
              )}
            </fieldset>
          ) : (
            <p className={styles.Hint}>
              Click a cell in the canvas to edit its repeat mode (edges) or
              aspect-ratio scaling (corners/caps).
            </p>
          )}
          <BoxFields
            legend="Slice bands"
            value={doc.bands}
            sides={bandSides}
            min={1}
            onChange={(bands) => setDoc({ ...doc, bands })}
          />
          <BoxFields
            legend="Content insets"
            value={doc.content}
            sides={SIDES}
            min={0}
            onChange={(content) => setDoc({ ...doc, content })}
          />
          <BoxFields
            legend="Outset (overdraw)"
            value={doc.outset}
            sides={SIDES}
            min={0}
            onChange={(outset) => setDoc({ ...doc, outset })}
          />
        </div>
      </div>

      <h3 className={styles.SectionTitle}>Colors</h3>
      {palette.length === 0 && (
        <span className={styles.Meta}>No colours found in the artwork.</span>
      )}
      <div className={styles.PaletteGrid}>
        {palette.map((entry) =>
          entry.kind === 'literal' ? (
            <div key={`l:${entry.value}`} className={styles.SwatchRow}>
              <span
                className={styles.TokenSwatch}
                style={{ background: entry.value }}
              />
              <code className={styles.Meta}>{entry.value}</code>
              <Select
                size="xs"
                w={160}
                placeholder="assign token…"
                data={roleOptions}
                value={null}
                onChange={(role) =>
                  role &&
                  setDoc({
                    ...doc,
                    source: replaceColor(
                      doc.source,
                      entry.value,
                      `var(--theme-${role})`,
                    ),
                  })
                }
              />
            </div>
          ) : (
            <div key={`t:${entry.role}`} className={styles.SwatchRow}>
              <span
                className={styles.TokenSwatch}
                style={{ background: theme.palette[entry.role] ?? '#ff00ff' }}
              />
              <Select
                size="xs"
                w={180}
                data={[
                  ...roleOptions,
                  { value: '__literal', label: '→ literal hex' },
                ]}
                value={entry.role}
                allowDeselect={false}
                onChange={(v) => {
                  if (!v || v === entry.role) return;
                  const to =
                    v === '__literal'
                      ? (theme.palette[entry.role] ?? '#ff00ff')
                      : `var(--theme-${v})`;
                  setDoc({
                    ...doc,
                    source: replaceColor(
                      doc.source,
                      `var(--theme-${entry.role})`,
                      to,
                    ),
                  });
                }}
              />
            </div>
          ),
        )}
      </div>

      <h3 className={styles.SectionTitle}>Preview</h3>
      <div className={styles.Row}>
        <span className={styles.Label}>W {previewW}</span>
        <Slider w={160} size="sm" min={20} max={560} value={previewW} onChange={setPreviewW} label={null} />
        <span className={styles.Label}>H {previewH}</span>
        <Slider w={160} size="sm" min={20} max={420} value={previewH} onChange={setPreviewH} label={null} />
        <span className={styles.Label}>Zoom {zoom}×</span>
        <Slider w={120} size="sm" min={0.5} max={4} step={0.25} value={zoom} onChange={setZoom} label={null} />
        <Checkbox
          size="xs"
          label="Overlays"
          checked={overlays}
          onChange={(e) => setOverlays(e.currentTarget.checked)}
        />
      </div>
      <div className={styles.PreviewBox}>
        {built.set && (
          <div
            className={styles.PreviewSurface}
            style={{ width: previewW, height: previewH, zoom }}
          >
            <SliceGrid
              set={built.set}
              style={{
                position: 'absolute',
                inset: `${-ot}px ${-orr}px ${-ob}px ${-ol}px`,
              }}
            />
            {overlays && ot + orr + ob + ol > 0 && (
              <div className={styles.FrameOutline} />
            )}
            {overlays && (
              <div
                className={styles.ContentOutline}
                style={{ top: ct, right: cr, bottom: cb, left: cl }}
              />
            )}
          </div>
        )}
      </div>
      {built.set && (
        <span className={styles.Meta}>
          {built.set.cols}×{built.set.rows} · content [{ct}, {cr}, {cb}, {cl}]
          · outset [{ot}, {orr}, {ob}, {ol}] · tokens resolved against theme
          "{theme.label}"
        </span>
      )}
      {warnings.map((w) => (
        <span key={w} className={styles.Error}>
          ⚠ {w}
        </span>
      ))}
    </div>
  );
}
