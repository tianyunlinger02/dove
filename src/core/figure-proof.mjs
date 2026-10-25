import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findExecutable, figureTools } from "./figure-generation.mjs";

// Proof sheets at the widths figures will actually print at: a before/after
// comparison of one figure, or the whole set side by side the way a two-column
// paper places it. Composed with Pillow from the Python that has python-pptx
// (Pillow comes with it); PDF figures are rasterized with pdftoppm first.

const PRINT_DPI = 300;
const DEFAULT_DPI = 150;
const RASTER = /\.(?:png|jpe?g|webp)$/iu;
const LENGTH = /^\s*(\d+(?:\.\d+)?)\s*(mm|cm|in|pt|bp)\s*$/iu;
const PER_INCH = { mm: 25.4, cm: 2.54, in: 1, pt: 72.27, bp: 72 };

/** "83.34mm", "3.28in", "236.84pt" → inches. */
export function lengthInInches(text) {
  const match = String(text ?? "").match(LENGTH);
  if (!match) throw new Error(`Give a width with its unit, such as 83.34mm, 3.28in or 236.84pt: ${text}`);
  const inches = Number(match[1]) / PER_INCH[match[2].toLowerCase()];
  if (!(inches > 0 && inches <= 40)) throw new Error(`Width out of range: ${text}`);
  return inches;
}

/** "figures/overview.pdf@174.63mm" → file and width. */
export function parseFigureSpec(text) {
  const value = String(text ?? "");
  const at = value.lastIndexOf("@");
  if (at <= 0) throw new Error(`Give each figure its printed width: --figure <file>@<width>, for example figures/overview.pdf@174.63mm (got ${value}).`);
  return { file: value.slice(0, at), inches: lengthInInches(value.slice(at + 1)) };
}

function freeOutputPath(file) {
  if (!fs.existsSync(file)) return file;
  const extension = path.extname(file);
  const stem = file.slice(0, file.length - extension.length);
  for (let index = 2; ; index += 1) {
    const candidate = `${stem}-${index}${extension}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
}

function millimetres(inches) {
  return `${Math.round(inches * 254) / 10} mm`;
}

const COMPOSER = String.raw`
import json, sys
from PIL import Image, ImageDraw, ImageFont

spec = json.load(sys.stdin)
DPI = spec["dpi"]
RESAMPLE = getattr(getattr(Image, "Resampling", Image), "LANCZOS")
FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]

def font(size):
    for candidate in FONTS:
        try:
            return ImageFont.truetype(candidate, size)
        except Exception:
            pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()

LABEL = font(max(10, round(DPI * 0.11)))
MARGIN = round(DPI * 0.15)
GUTTER = round(DPI * 0.15)
LABEL_H = round(DPI * 0.22)
INK = "#202A35"
FRAME = "#C8CDD3"

def flatten(image):
    if image.mode in ("RGBA", "LA", "PA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        base = Image.new("RGB", rgba.size, "white")
        base.paste(rgba, mask=rgba.split()[-1])
        return base
    return image.convert("RGB")

def load(item):
    image = flatten(Image.open(item["path"]))
    item["source_px"] = image.width
    width = max(1, round(item["inches"] * DPI))
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height), RESAMPLE)

def paste(canvas, draw, image, x, y, label):
    draw.text((x, y), label, fill=INK, font=LABEL)
    top = y + LABEL_H
    canvas.paste(image, (x, top))
    draw.rectangle([x - 1, top - 1, x + image.width, top + image.height], outline=FRAME)

items = spec["items"]
images = [load(item) for item in items]
if spec["mode"] == "compare":
    before, after = images
    if spec["side_by_side"]:
        width = 2 * MARGIN + before.width + GUTTER + after.width
        height = 2 * MARGIN + LABEL_H + max(before.height, after.height)
        canvas = Image.new("RGB", (width, height), "white")
        draw = ImageDraw.Draw(canvas)
        paste(canvas, draw, before, MARGIN, MARGIN, items[0]["label"])
        paste(canvas, draw, after, MARGIN + before.width + GUTTER, MARGIN, items[1]["label"])
    else:
        width = 2 * MARGIN + max(before.width, after.width)
        height = 2 * MARGIN + 2 * LABEL_H + before.height + GUTTER + after.height
        canvas = Image.new("RGB", (width, height), "white")
        draw = ImageDraw.Draw(canvas)
        paste(canvas, draw, before, MARGIN, MARGIN, items[0]["label"])
        paste(canvas, draw, after, MARGIN, MARGIN + LABEL_H + before.height + GUTTER, items[1]["label"])
else:
    page = max(image.width for image in images)
    rows, row, used = [], [], 0
    for item, image in zip(items, images):
        if row and used + GUTTER + image.width <= page:
            row.append((item, image))
            used += GUTTER + image.width
        else:
            if row:
                rows.append(row)
            row, used = [(item, image)], image.width
    rows.append(row)
    heights = [LABEL_H + max(image.height for _, image in line) for line in rows]
    canvas = Image.new("RGB", (2 * MARGIN + page, 2 * MARGIN + sum(heights) + GUTTER * (len(rows) - 1)), "white")
    draw = ImageDraw.Draw(canvas)
    y = MARGIN
    for line, line_height in zip(rows, heights):
        x = MARGIN
        for item, image in line:
            paste(canvas, draw, image, x, y, item["label"])
            x += image.width + GUTTER
        y += line_height + GUTTER
canvas.save(spec["output"], dpi=(DPI, DPI))
json.dump({"width": canvas.width, "height": canvas.height, "source_px": [item["source_px"] for item in items]}, sys.stdout)
`;

function composerPython(options) {
  const env = options.env ?? process.env;
  const candidates = [options.python, env.DOVE_FIGURE_PYTHON, figureTools(options).pptPython, findExecutable("python3", env)].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    if (spawnSync(candidate, ["-c", "import PIL"], { stdio: "ignore", timeout: 20000 }).status === 0) return candidate;
  }
  throw new Error("No Python with Pillow found: install python-pptx (it brings Pillow) where dove figure --tools can find it, or set figure.pptPython in Dove's settings.json.");
}

// PDF figures become a 300 dpi PNG of their first page.
function rasterize(file, scratch, index, env) {
  if (RASTER.test(file)) return { path: file, vector: false };
  if (!/\.pdf$/iu.test(file)) throw new Error(`Use PNG, JPEG, WebP or PDF figures (export PPTX or SVG to PDF first): ${file}`);
  const pdftoppm = findExecutable("pdftoppm", env);
  if (!pdftoppm) throw new Error(`pdftoppm is needed to read PDF figures: ${file}`);
  const stem = path.join(scratch, `figure-${index}`);
  const run = spawnSync(pdftoppm, ["-png", "-r", String(PRINT_DPI), "-f", "1", "-l", "1", "-singlefile", file, stem], { encoding: "utf8", timeout: 120000 });
  if (run.status !== 0 || !fs.existsSync(`${stem}.png`)) throw new Error(`pdftoppm could not read ${file}: ${(run.stderr || "").trim().slice(0, 300)}`);
  return { path: `${stem}.png`, vector: true };
}

/**
 * Options: compare (with before, after, width) or proof (with figure: one or
 * more "file@width"), output, dpi; files resolve against the project root.
 */
export function composeFigureProof(projectRoot, options = {}) {
  const env = options.env ?? process.env;
  const root = path.resolve(projectRoot);
  const mode = options.compare ? "compare" : options.proof ? "proof" : null;
  if (!mode) throw new Error("Choose --compare or --proof.");
  if (!options.output) throw new Error("--output <file.png> is required.");
  const dpi = options.dpi === undefined ? DEFAULT_DPI : Number(options.dpi);
  if (!(dpi >= 50 && dpi <= 600)) throw new Error(`--dpi must be between 50 and 600: ${options.dpi}`);
  let specs;
  if (mode === "compare") {
    if (!options.before || !options.after) throw new Error("--compare needs --before <file> and --after <file>.");
    const inches = lengthInInches(options.width);
    specs = [
      { file: options.before, inches, label: `Before - ${millimetres(inches)}` },
      { file: options.after, inches, label: `After - ${millimetres(inches)}` }
    ];
  } else {
    const figures = [].concat(options.figure ?? []);
    if (!figures.length) throw new Error("--proof needs one or more --figure <file>@<width>.");
    specs = figures.map((value) => {
      const spec = parseFigureSpec(value);
      return { ...spec, label: `${path.basename(spec.file)} - ${millimetres(spec.inches)}` };
    });
  }
  const python = composerPython(options);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "dove-figure-proof-"));
  try {
    const items = specs.map((spec, index) => {
      const file = path.resolve(root, spec.file);
      if (!fs.existsSync(file)) throw new Error(`Figure not found: ${file}`);
      return { ...spec, file, ...rasterize(file, scratch, index, env) };
    });
    const output = freeOutputPath(path.resolve(root, options.output));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const sideBySide = mode === "compare" && specs[0].inches <= 4;
    const run = spawnSync(python, ["-c", COMPOSER], {
      input: JSON.stringify({ mode, dpi, output, side_by_side: sideBySide, items: items.map((item) => ({ path: item.path, inches: item.inches, label: item.label })) }),
      encoding: "utf8",
      maxBuffer: 16 << 20,
      timeout: 300000
    });
    if (run.status !== 0) throw new Error(`Composing the proof failed: ${(run.stderr || run.stdout || "").trim().split("\n").slice(-3).join(" ").slice(0, 400)}`);
    const composed = JSON.parse(run.stdout);
    return {
      status: "composed",
      mode,
      dpi,
      outputPath: output,
      width: composed.width,
      height: composed.height,
      items: items.map((item, index) => {
        const neededPx = Math.round(item.inches * PRINT_DPI);
        const sourcePx = composed.source_px[index];
        // A raster figure printed below about 300 dpi looks soft; vectors are rasterized at 300 dpi here.
        return { label: item.label, file: item.file, widthMm: Math.round(item.inches * 2540) / 100, sourcePx, neededPx, vector: item.vector, enough: item.vector ? true : sourcePx >= Math.round(neededPx * 0.9) };
      })
    };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
