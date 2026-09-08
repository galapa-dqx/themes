/**
 * Exact static face compilation with fontTools on Pyodide. One face request
 * (weight, style, axes) against one font resource yields one standalone,
 * non-variable TTF/OTF with its complete glyph repertoire. Two layers share
 * the same Python program: in-process (Node tests) and a dedicated Worker.
 */
import { Context, Data, Effect, Layer } from 'effect';
import type { PyodideInterface } from 'pyodide';

export interface FaceRequest {
  readonly weight: number;
  readonly style: 'normal' | 'italic' | 'oblique';
  readonly axes: Record<string, number>;
}
export interface FontLicense {
  /** SPDX id sniffed from the name table, when recognizable. */
  readonly identifier: string | null;
  readonly copyright: string | null;
  readonly description: string | null;
  readonly url: string | null;
}
export interface Face {
  readonly bytes: Uint8Array;
  readonly extension: 'ttf' | 'otf';
  readonly license: FontLicense;
}
export class FontError extends Data.TaggedError('FontError')<{
  readonly message: string;
}> {}

const INPUT = '/tmp/galapa-font-input';
const OUTPUT = '/tmp/galapa-font-output';

/** Reads `request_json`, writes OUTPUT, evaluates to a JSON result string. */
export const PYTHON = String.raw`
import json
from fontTools.ttLib import TTFont, TTCollection
from fontTools.varLib.instancer import instantiateVariableFont

request = json.loads(request_json)

def name(font, identifier):
    table = font.get("name")
    try:
        return table.getDebugName(identifier) if table else None
    except Exception:
        return None

def style_of(font):
    selection = getattr(font.get("OS/2"), "fsSelection", 0)
    if selection & (1 << 9):
        return "oblique"
    if selection & 1 or getattr(font.get("head"), "macStyle", 0) & 2:
        return "italic"
    return "normal"

def supports(font):
    fvar = font.get("fvar")
    if fvar is None:
        weight = int(getattr(font.get("OS/2"), "usWeightClass", 400))
        return weight == request["weight"] and style_of(font) == request["style"]
    axes = {a.axisTag: a for a in fvar.axes}
    if "wght" in axes and not axes["wght"].minValue <= request["weight"] <= axes["wght"].maxValue:
        return False
    if "wght" not in axes and int(getattr(font.get("OS/2"), "usWeightClass", 400)) != request["weight"]:
        return False
    if request["style"] != style_of(font) and "ital" not in axes and "slnt" not in axes:
        return False
    return True

try:
    fonts = TTCollection("${INPUT}", lazy=False).fonts
except Exception:
    fonts = [TTFont("${INPUT}", lazy=False)]

families = {name(f, 16) or name(f, 1) for f in fonts} - {None}
if len(families) > 1:
    raise ValueError("collections with more than one family are not supported")
candidates = [f for f in fonts if supports(f)]
if len(candidates) != 1:
    raise ValueError(
        f"the source cannot provide weight {request['weight']} {request['style']} ({len(candidates)} matching faces)"
    )
font = candidates[0]

fvar = font.get("fvar")
if fvar is not None:
    axes = {a.axisTag: a for a in fvar.axes}
    for tag in request["axes"]:
        if tag not in axes:
            raise ValueError(f"the font has no {tag} axis")
    coords = {tag: a.defaultValue for tag, a in axes.items()}
    coords.update(request["axes"])
    if "wght" in coords:
        coords["wght"] = request["weight"]
    if "ital" in coords:
        coords["ital"] = 1 if request["style"] == "italic" else 0
    if "slnt" in coords:
        slnt = axes["slnt"]
        coords["slnt"] = (slnt.minValue if slnt.minValue < 0 else slnt.maxValue) if request["style"] == "oblique" else slnt.defaultValue
    for tag, value in coords.items():
        a = axes[tag]
        if not a.minValue <= value <= a.maxValue:
            raise ValueError(f"{tag}={value} is outside the supported range {a.minValue}..{a.maxValue}")
    font = instantiateVariableFont(font, coords, inplace=False)

font.flavor = None
font.save("${OUTPUT}")
description = (name(font, 13) or "").lower()
url = (name(font, 14) or "").lower()
identifier = None
if "open font license" in description or "scripts.sil.org/ofl" in url or "openfontlicense" in url:
    identifier = "OFL-1.1"
elif "apache" in description or "apache.org/licenses/license-2.0" in url:
    identifier = "Apache-2.0"
elif "ubuntu font license" in description:
    identifier = "UFL-1.0"
json.dumps({
    "extension": "otf" if font.sfntVersion == "OTTO" else "ttf",
    "license": {
        "identifier": identifier,
        "copyright": name(font, 0),
        "description": name(font, 13),
        "url": name(font, 14),
    },
})
`;

/** Runs the program on one runtime. Not concurrency-safe; callers serialize. */
export const compileFace = async (
  py: PyodideInterface,
  bytes: Uint8Array,
  request: FaceRequest,
): Promise<Face> => {
  py.FS.writeFile(INPUT, bytes);
  py.globals.set('request_json', JSON.stringify(request));
  const result = JSON.parse(String(await py.runPythonAsync(PYTHON))) as Omit<
    Face,
    'bytes'
  >;
  return { ...result, bytes: py.FS.readFile(OUTPUT) };
};

/** The last line of a Python traceback is the ValueError we raised. */
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message.trim().split('\n').at(-1)! : String(e);
const toFontError = (e: unknown) => new FontError({ message: errorMessage(e) });

export class FontTools extends Context.Tag('FontTools')<
  FontTools,
  {
    readonly compile: (
      bytes: Uint8Array,
      request: FaceRequest,
    ) => Effect.Effect<Face, FontError>;
  }
>() {
  /** Runs Pyodide on the calling thread, loading it on first use. */
  static inProcess = (load: () => Promise<PyodideInterface>) =>
    Layer.effect(
      FontTools,
      Effect.gen(function* () {
        const runtime = yield* Effect.cached(Effect.promise(load));
        const lock = yield* Effect.makeSemaphore(1);
        return {
          compile: (bytes, request) =>
            lock.withPermits(1)(
              Effect.flatMap(runtime, (py) =>
                Effect.tryPromise({
                  try: () => compileFace(py, bytes, request),
                  catch: toFontError,
                }),
              ),
            ),
        };
      }),
    );

  /** Runs Pyodide in a dedicated Worker (see fontWorker.ts); interruption terminates it. */
  static worker = (make: () => Worker) =>
    Layer.scoped(
      FontTools,
      Effect.gen(function* () {
        let worker: Worker | undefined;
        const stop = () => {
          worker?.terminate();
          worker = undefined;
        };
        yield* Effect.addFinalizer(() => Effect.sync(stop));
        const lock = yield* Effect.makeSemaphore(1);
        return {
          compile: (bytes, request) =>
            lock.withPermits(1)(
              Effect.async<Face, FontError>((resume) => {
                worker ??= make();
                worker.onmessage = (e: MessageEvent<WorkerResponse>) =>
                  resume(
                    e.data.ok
                      ? Effect.succeed(e.data.face)
                      : Effect.fail(new FontError({ message: e.data.message })),
                  );
                worker.onerror = (e) => {
                  stop();
                  resume(Effect.fail(new FontError({ message: e.message })));
                };
                worker.postMessage({ bytes, request } satisfies WorkerRequest);
                return Effect.sync(stop);
              }),
            ),
        };
      }),
    );
}

export type WorkerRequest = { bytes: Uint8Array; request: FaceRequest };
export type WorkerResponse =
  { ok: true; face: Face } | { ok: false; message: string };
