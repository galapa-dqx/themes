/// <reference lib="webworker" />

import { loadPyodide, type PyodideInterface } from 'pyodide';
import type { FontWorkerRequest, FontWorkerResponse } from './fontProtocol';

const worker = self as unknown as DedicatedWorkerGlobalScope;
let runtime: Promise<PyodideInterface> | undefined;

const PYTHON = String.raw`
import io
import json
from fontTools.ttLib import TTFont, TTCollection
from fontTools.varLib.instancer import instantiateVariableFont

request = json.loads(request_json)
source = "/tmp/galapa-font-input"
output = "/tmp/galapa-font-output"

def names(font):
    table = font.get("name")
    if table is None:
        return {}
    def value(identifier):
        try:
            return table.getDebugName(identifier)
        except Exception:
            return None
    return {
        "family": value(16) or value(1),
        "copyright": value(0),
        "description": value(13),
        "url": value(14),
    }

def style_of(font):
    os2 = font.get("OS/2")
    head = font.get("head")
    selection = getattr(os2, "fsSelection", 0)
    if selection & (1 << 9):
        return "oblique"
    if selection & 1 or (getattr(head, "macStyle", 0) & 2):
        return "italic"
    return "normal"

def weight_of(font):
    os2 = font.get("OS/2")
    return int(getattr(os2, "usWeightClass", 400))

def supports(font):
    desired_style = request["style"]
    fvar = font.get("fvar")
    if fvar is None:
        return weight_of(font) == request["weight"] and style_of(font) == desired_style
    axes = {axis.axisTag: axis for axis in fvar.axes}
    weight = axes.get("wght")
    if weight and not (weight.minValue <= request["weight"] <= weight.maxValue):
        return False
    existing_style = style_of(font)
    if desired_style != existing_style and "ital" not in axes and "slnt" not in axes:
        return False
    return True

try:
    collection = TTCollection(source, lazy=False)
    fonts = collection.fonts
except Exception:
    fonts = [TTFont(source, lazy=False)]

families = {names(font).get("family") for font in fonts}
families.discard(None)
if len(families) > 1:
    raise ValueError("Font collections containing more than one family are not supported yet")

candidates = [font for font in fonts if supports(font)]
if len(candidates) != 1:
    raise ValueError(
        f"Expected one face for weight {request['weight']} {request['style']}, found {len(candidates)}"
    )
font = candidates[0]
fvar = font.get("fvar")
if fvar is not None:
    coordinates = {axis.axisTag: axis.defaultValue for axis in fvar.axes}
    coordinates.update(request.get("axes") or {})
    if "wght" in coordinates:
        coordinates["wght"] = request["weight"]
    if "ital" in coordinates:
        coordinates["ital"] = 1 if request["style"] == "italic" else 0
    if "slnt" in coordinates:
        slnt = next(axis for axis in fvar.axes if axis.axisTag == "slnt")
        coordinates["slnt"] = slnt.defaultValue if request["style"] != "oblique" else (
            slnt.minValue if slnt.minValue < 0 else slnt.maxValue
        )
    for axis in fvar.axes:
        value = coordinates[axis.axisTag]
        if not axis.minValue <= value <= axis.maxValue:
            raise ValueError(
                f"Axis {axis.axisTag} value {value} is outside {axis.minValue}–{axis.maxValue}"
            )
    font = instantiateVariableFont(font, coordinates, inplace=False)

font.flavor = None
font.save(output)
metadata = names(font)
description = (metadata.get("description") or "").lower()
url = (metadata.get("url") or "").lower()
identifier = None
if "open font license" in description or "openfontlicense" in url:
    identifier = "OFL-1.1"
elif "apache" in description or "apache.org/licenses/license-2.0" in url:
    identifier = "Apache-2.0"
elif "ubuntu font license" in description:
    identifier = "UFL-1.0"

result_json = json.dumps({
    "extension": "otf" if font.sfntVersion == "OTTO" else "ttf",
    "license": {
        "identifier": identifier,
        "copyright": metadata.get("copyright"),
        "description": metadata.get("description"),
        "url": metadata.get("url"),
    },
})
`;

async function pyodide(): Promise<PyodideInterface> {
  runtime ??= loadPyodide({
    indexURL: new URL('/pyodide/', worker.location.origin).href,
    packages: ['fonttools'],
  });
  return runtime;
}

worker.onmessage = async (event: MessageEvent<FontWorkerRequest>) => {
  const { id, bytes, request } = event.data;
  try {
    const python = await pyodide();
    python.FS.writeFile('/tmp/galapa-font-input', bytes);
    python.globals.set('request_json', JSON.stringify(request));
    const resultText = await python.runPythonAsync(PYTHON);
    const result = JSON.parse(String(resultText)) as {
      extension: 'ttf' | 'otf';
      license: FontWorkerResponse extends { ok: true; license: infer License }
        ? License
        : never;
    };
    const output = Uint8Array.from(
      python.FS.readFile('/tmp/galapa-font-output', { encoding: 'binary' }),
    );
    const response: FontWorkerResponse = {
      id,
      ok: true,
      bytes: output,
      extension: result.extension,
      license: result.license,
    };
    worker.postMessage(response, [output.buffer]);
  } catch (error) {
    const response: FontWorkerResponse = {
      id,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
    worker.postMessage(response);
  }
};

