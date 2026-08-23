import type { CSSProperties } from 'react';
import type {
  CompiledControl,
  CompiledPaint,
  CompiledPathControl,
  CompiledTextControl,
  CompiledTheme,
  CornerShape,
  Edges,
  ResolvedType,
} from './types';
import { CONTROL_IDS } from './types';

/**
 * The theme compiler: a *compiled* theme in, the custom properties the browser
 * renders from out. Every colour it reads is already a literal — the resolver
 * did the palette/derivation/art work — so this module holds no colour logic
 * at all. It is the browser adapter the Skia engine won't need: it turns the
 * literal control model into `--g-<control>-*` variables and the focus ring
 * into `--app-focus-*`. Nothing else is emitted; no theme value escapes a
 * control any more.
 *
 * An unspecified property still compiles to its *unstyled* value — transparent
 * fill, no stroke, square corners, inherited content colour, full opacity —
 * never to some component's idea of a nice default. Consumers read the vars
 * bare, with no `var(x, fallback)`, because the compiler already resolved
 * "unspecified" to "unstyled". (The two documented exceptions — a seated
 * label's lead, and the app's type floor — are absence-means-absent, handled
 * with a fallback at the reader.)
 */

const px = (n: number) => `${n}px`;

const edgesOf = (v: number | Edges): Edges =>
  typeof v === 'number' ? [v, v, v, v] : v;

/**
 * Corners whose outline bends back into the box instead of cutting across it.
 * <Themed> draws the top corners in a band of their own, and a concave corner
 * in a band exactly its own radius tall consumes the whole band — there's no
 * material left to stroke. One extra stroke of height leaves the straight run
 * the neighbouring pieces butt against.
 */
const CONCAVE_CORNERS: readonly CornerShape[] = ['scoop', 'notch'];

export function compileControls(theme: CompiledTheme): Record<string, string> {
  const vars: Record<string, string> = {};

  const emitEdges = (prefix: string, value: number | Edges) => {
    const [t, r, b, l] = edgesOf(value);
    vars[prefix] = [t, r, b, l].map(px).join(' ');
    vars[`${prefix}-t`] = px(t);
    vars[`${prefix}-r`] = px(r);
    vars[`${prefix}-b`] = px(b);
    vars[`${prefix}-l`] = px(l);
  };

  // Fill, stroke, content colour and opacity for one scope, resolved to the
  // unstyled default where the paint is silent. `corner` decides how much
  // extra top-band height a concave corner needs, and thickens with the
  // scope's own top stroke — so it is emitted per scope, not once.
  const emitPaint = (prefix: string, p: CompiledPaint, corner?: CornerShape) => {
    vars[`${prefix}-fill`] = p.fill ?? 'transparent';
    vars[`${prefix}-content`] = p.content ?? 'inherit';
    vars[`${prefix}-bc`] = p.borderColor ?? 'transparent';
    const thickness = p.borderThickness ?? 0;
    const [top] = edgesOf(thickness);
    emitEdges(`${prefix}-bw`, thickness);
    vars[`${prefix}-corner-pad`] = px(
      corner && CONCAVE_CORNERS.includes(corner) ? top : 0,
    );
    vars[`${prefix}-opacity`] = `${p.opacity ?? 1}`;
  };

  const emitSize = (prefix: string, size?: { width?: number; height?: number }) => {
    if (size?.width !== undefined) vars[`${prefix}-w`] = px(size.width);
    if (size?.height !== undefined) vars[`${prefix}-h`] = px(size.height);
  };

  const emitType = (prefix: string, t?: ResolvedType) => {
    if (!t) return;
    if (t.family) vars[`${prefix}-font`] = `'${t.family}', ${t.fallback}`;
    if (t.weight !== undefined) vars[`${prefix}-weight`] = `${t.weight}`;
    if (t.style) vars[`${prefix}-style`] = t.style;
    if (t.size !== undefined) vars[`${prefix}-size`] = px(t.size);
    if (t.letterSpacing !== undefined)
      vars[`${prefix}-tracking`] = px(t.letterSpacing);
    if (t.case) vars[`${prefix}-case`] = t.case;
  };

  const emitPath = (prefix: string, c: CompiledPathControl) => {
    emitPaint(prefix, c, c.corner);
    vars[`${prefix}-radius`] = c.radius === 'pill' ? '999px' : px(c.radius ?? 0);
    vars[`${prefix}-corner`] = c.corner ?? 'round';
    // The one property that stays optional: undeclared padding is silence, not
    // zero, so a control the theme doesn't inset keeps its host's layout.
    if (c.padding !== undefined) emitEdges(`${prefix}-pad`, c.padding);
    emitSize(prefix, c.size);
    emitType(prefix, c.text);
    // Each state is the base paint with its override laid over, so consumers
    // never chain a fallback back to the base value.
    for (const [state, override] of Object.entries(c.states ?? {})) {
      emitPaint(`${prefix}-${state}`, { ...paintOf(c), ...override }, c.corner);
    }
  };

  const emitText = (prefix: string, c: CompiledTextControl) => {
    if (c.content !== undefined) vars[`${prefix}-content`] = c.content;
    if (c.borderColor !== undefined) vars[`${prefix}-bc`] = c.borderColor;
    emitType(prefix, c.text);
    // The seated label's lead: `--g-input-label-lead`, read by <Themed part=
    // "input"> as `--g-input-label-lead`. Absence is meaningful, so it's a
    // reader-side fallback rather than a value emitted here.
    if (c.leftInset !== undefined) vars[`${prefix}-lead`] = px(c.leftInset);
  };

  for (const id of CONTROL_IDS) {
    const control: CompiledControl = theme.controls[id];
    const prefix = `--g-${id.replaceAll('.', '-')}`;
    if (control.shape === 'Path') {
      emitPath(prefix, control);
    } else if (control.shape === 'Asset') {
      // The slices paint the surface (see usePartSkin); only the things the
      // art can't carry are vars.
      vars[`${prefix}-content`] = control.content ?? 'inherit';
      vars[`${prefix}-opacity`] = `${control.opacity ?? 1}`;
      emitSize(prefix, control.size);
      emitType(prefix, control.text);
    } else if (control.shape === 'Window') {
      // The whole surface, read by AppShell (fill, content) and the OS window
      // frame (border) — nothing else, since a native window has nothing else.
      vars[`${prefix}-fill`] = control.fill ?? 'transparent';
      vars[`${prefix}-content`] = control.content ?? 'inherit';
      vars[`${prefix}-bc`] = control.borderColor ?? 'transparent';
    } else {
      emitText(prefix, control);
    }
  }

  return vars;
}

/** The paint fields of a compiled control, for merging a state over its base. */
const paintOf = (c: CompiledPaint): CompiledPaint => ({
  fill: c.fill,
  content: c.content,
  borderColor: c.borderColor,
  borderThickness: c.borderThickness,
  opacity: c.opacity,
});

/**
 * Every custom property a themed scope needs: the compiled controls, and the
 * focus ring. That's the whole surface now — no palette, no type, no chrome
 * scalars. When the theme opts out of the ring (`focusRing: null`), the
 * `--app-focus-*` vars are simply absent and the outline that reads them
 * becomes invalid-at-computed-value, i.e. no ring.
 */
export function themeStyle(theme: CompiledTheme): CSSProperties {
  const vars = compileControls(theme);
  if (theme.focusRing) {
    vars['--app-focus-color'] = theme.focusRing.color;
    vars['--app-focus-width'] = px(theme.focusRing.width);
    vars['--app-focus-offset'] = px(theme.focusRing.offset);
  }
  return vars as CSSProperties;
}
