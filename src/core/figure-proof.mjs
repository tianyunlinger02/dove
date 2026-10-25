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

// A manuscript's pages at a glance: every page in one sheet, with each
// column's blank space, columns that hold almost no running text, and how
// many pages the body uses before the references. Word positions come from
// pdftotext; ink from pages rendered with pdftoppm.
const PAGE_ANALYSIS = String.raw`
import glob, html, json, os, re, sys
from PIL import Image, ImageDraw, ImageFont

spec = json.load(sys.stdin)
DPI = spec["dpi"]
SCALE = DPI / 72.0
RESAMPLE = getattr(getattr(Image, "Resampling", Image), "LANCZOS")
FONTS = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
         "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
         "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf"]

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

text = open(spec["words"], encoding="utf-8", errors="replace").read()
pages = []
for page in re.finditer(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', text, re.S):
    width, height = float(page.group(1)), float(page.group(2))
    words = []
    for word in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', page.group(3), re.S):
        x0, y0, x1, y1 = (float(word.group(i)) for i in range(1, 5))
        value = html.unescape(word.group(5)).strip()
        # Review line numbers in the margins and page numbers at the foot are not text.
        if re.fullmatch(r"\d{1,4}", value) and (x1 < width * 0.12 or x0 > width * 0.88 or y0 > height * 0.92):
            continue
        words.append((x0, y0, x1, y1, value))
    pages.append({"width": width, "height": height, "words": words})

def percentile(values, q):
    values = sorted(values)
    return values[min(len(values) - 1, max(0, int(q * (len(values) - 1))))] if values else None

all_words = [w for p in pages for w in p["words"]]
images = {}
for path in glob.glob(os.path.join(spec["images"], "*.png")):
    number = re.search(r"-(\d+)\.png$", path)
    if number:
        images[int(number.group(1))] = path

if all_words:
    left, right = percentile([w[0] for w in all_words], 0.01), percentile([w[2] for w in all_words], 0.99)
    top, bottom = percentile([w[1] for w in all_words], 0.01), percentile([w[3] for w in all_words], 0.99)
else:
    first = pages[0] if pages else {"width": 612.0, "height": 792.0}
    left, right, top, bottom = first["width"] * 0.08, first["width"] * 0.92, first["height"] * 0.07, first["height"] * 0.93

# Two columns when a vertical band near the middle is (almost) never covered by words.
columns = [(left, right)]
if all_words:
    bins = 200
    cover = [0] * bins
    span = max(1.0, right - left)
    for x0, _, x1, _, _ in all_words:
        for b in range(max(0, int((x0 - left) / span * bins)), min(bins, int((x1 - left) / span * bins) + 1)):
            cover[b] += 1
    peak = max(cover) or 1
    middle = [b for b in range(int(bins * 0.4), int(bins * 0.6)) if cover[b] <= peak * 0.08]
    if middle:
        runs, run = [], [middle[0]]
        for b in middle[1:]:
            if b == run[-1] + 1:
                run.append(b)
            else:
                runs.append(run)
                run = [b]
        runs.append(run)
        gap = max(runs, key=len)
        gap_left = left + gap[0] / bins * span
        gap_right = left + (gap[-1] + 1) / bins * span
        columns = [(left, gap_left), (gap_right, right)]
names = ["左栏", "右栏"] if len(columns) == 2 else ["正文"]

# Where the references begin: a line that holds only the heading.
heading = None
for index, page in enumerate(pages):
    for x0, y0, x1, y1, value in page["words"]:
        if value.lower().rstrip(":") in ("references", "bibliography", "参考文献"):
            column = next((c for c, (a, b) in enumerate(columns) if a - 4 <= (x0 + x1) / 2 <= b + 4), 0)
            same_line = [w for w in page["words"] if abs(w[1] - y0) < 2 and columns[column][0] - 4 <= (w[0] + w[2]) / 2 <= columns[column][1] + 4]
            if len(same_line) == 1:
                heading = {"page": index + 1, "column": column, "y": y0}
                break
    if heading:
        break

body_height = max(1.0, bottom - top)
body_pages = None
if heading:
    within = min(1.0, max(0.0, (heading["y"] - top) / body_height))
    body_pages = (heading["page"] - 1) + (heading["column"] + within) / len(columns)

report, flags = [], []
for index, page in enumerate(pages):
    number = index + 1
    path = images.get(number)
    entry = {"page": number, "columns": []}
    if not path:
        report.append(entry)
        continue
    image = Image.open(path).convert("L")
    px = image.load()
    y_from, y_to = int(top * SCALE), min(image.height - 1, int(bottom * SCALE))
    after_references = heading is not None and (number > heading["page"])
    for c, (a, b) in enumerate(columns):
        x_from, x_to = int(a * SCALE), min(image.width - 1, int(b * SCALE))
        inked = [any(px[x, y] < 200 for x in range(x_from, x_to, 2)) for y in range(y_from, y_to)]
        rows = max(1, len(inked))
        marks = [i for i, v in enumerate(inked) if v]
        blank_bottom = 1.0 - ((marks[-1] + 1) / rows if marks else 0.0)
        gap, run = 0, 0
        if marks:
            for v in inked[marks[0]:marks[-1] + 1]:
                run = 0 if v else run + 1
                gap = max(gap, run)
        words = sum(1 for w in page["words"] if a - 4 <= (w[0] + w[2]) / 2 <= b + 4 and top - 2 <= (w[1] + w[3]) / 2 <= bottom + 2)
        ink_share = len(marks) / rows
        column = {"name": names[c], "blankBottom": round(blank_bottom, 3), "largestGap": round(gap / rows, 3), "words": words, "floatOnly": bool(all_words) and ink_share > 0.3 and words < 25}
        entry["columns"].append(column)
        # Space after the body (the reference list, its last page) is not a layout problem.
        in_body = not after_references and not (heading and number == heading["page"] and c >= heading["column"]) and number < len(pages)
        if heading and number == heading["page"] and c < heading["column"]:
            in_body = True
        if not in_body:
            continue
        if blank_bottom >= 0.2:
            flags.append(f"第 {number} 页{names[c]}底部空着约 {round(blank_bottom * 100)}%")
        if gap / rows >= 0.15:
            flags.append(f"第 {number} 页{names[c]}中间有约 {round(gap / rows * 100)}% 的空白")
        if column["floatOnly"]:
            flags.append(f"第 {number} 页{names[c]}几乎没有正文，只放了图表")
    report.append(entry)

limit = spec.get("limit")
if body_pages is not None and limit:
    if body_pages > limit + 0.02:
        flags.append(f"正文约 {body_pages:.1f} 页，超出上限 {limit:g} 页")
    elif body_pages < limit - 0.25:
        flags.append(f"正文约 {body_pages:.1f} 页，上限 {limit:g} 页，还有约 {limit - body_pages:.1f} 页没用")

# The sheet: pages side by side, blank space and float-only columns marked.
thumbs = []
for number in range(1, len(pages) + 1):
    if number in images:
        thumbs.append((number, Image.open(images[number]).convert("RGB")))
if thumbs:
    per_row = spec["perRow"]
    w, h = thumbs[0][1].size
    label_h, gap_px = int(DPI * 0.35), int(DPI * 0.2)
    rows_n = (len(thumbs) + per_row - 1) // per_row
    sheet = Image.new("RGB", (per_row * w + (per_row + 1) * gap_px, rows_n * (h + label_h) + (rows_n + 1) * gap_px), "white")
    draw = ImageDraw.Draw(sheet, "RGBA")
    label = font(max(10, int(DPI * 0.22)))
    for i, (number, thumb) in enumerate(thumbs):
        x = gap_px + (i % per_row) * (w + gap_px)
        y = gap_px + (i // per_row) * (h + label_h + gap_px)
        draw.text((x, y), f"p{number}", fill="#202A35", font=label)
        sheet.paste(thumb, (x, y + label_h))
        draw.rectangle([x - 1, y + label_h - 1, x + w, y + label_h + h], outline="#C8CDD3")
        entry = report[number - 1]
        for c, column in enumerate(entry["columns"]):
            a, b = columns[c]
            if column["blankBottom"] >= 0.2 and any(f"第 {number} 页{column['name']}底部" in f for f in flags):
                y_mark = int(bottom * SCALE - column["blankBottom"] * (bottom - top) * SCALE)
                draw.rectangle([x + int(a * SCALE), y + label_h + y_mark, x + int(b * SCALE), y + label_h + int(bottom * SCALE)], fill=(214, 64, 52, 70), outline=(214, 64, 52, 200))
            if column["floatOnly"] and any(f"第 {number} 页{column['name']}几乎" in f for f in flags):
                draw.rectangle([x + int(a * SCALE), y + label_h + int(top * SCALE), x + int(b * SCALE), y + label_h + int(bottom * SCALE)], outline=(235, 140, 30, 255), width=3)
    sheet.save(spec["output"], dpi=(DPI, DPI))

json.dump({"pages": len(pages), "columns": len(columns), "referencesPage": heading["page"] if heading else None, "bodyPages": round(body_pages, 2) if body_pages is not None else None, "flags": flags, "report": report}, sys.stdout, ensure_ascii=False)
`;

/**
 * Options: pages (the compiled manuscript PDF), output, bodyPages (the main
 * text's page limit, e.g. 8), dpi (default 50), perRow (default 4).
 */
export function composePageOverview(projectRoot, options = {}) {
  const env = options.env ?? process.env;
  const root = path.resolve(projectRoot);
  if (!options.output) throw new Error("--output <file.png> is required.");
  const pdf = path.resolve(root, String(options.pages));
  if (!/\.pdf$/iu.test(pdf) || !fs.existsSync(pdf)) throw new Error(`--pages needs the compiled manuscript PDF: ${pdf}`);
  const pdftoppm = findExecutable("pdftoppm", env);
  const pdftotext = findExecutable("pdftotext", env);
  if (!pdftoppm || !pdftotext) throw new Error("pdftoppm and pdftotext (poppler) are needed to read the manuscript pages.");
  const dpi = options.dpi === undefined ? 50 : Number(options.dpi);
  if (!(dpi >= 30 && dpi <= 150)) throw new Error(`--dpi for --pages must be between 30 and 150: ${options.dpi}`);
  const limit = options.bodyPages === undefined ? null : Number(options.bodyPages);
  if (limit !== null && !(limit > 0 && limit < 200)) throw new Error(`--body-pages must be a page count: ${options.bodyPages}`);
  const python = composerPython(options);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "dove-pages-"));
  try {
    const render = spawnSync(pdftoppm, ["-png", "-r", String(dpi), pdf, path.join(scratch, "page")], { encoding: "utf8", timeout: 300000 });
    if (render.status !== 0) throw new Error(`pdftoppm could not render ${pdf}: ${(render.stderr || "").trim().slice(0, 300)}`);
    const words = path.join(scratch, "words.html");
    const text = spawnSync(pdftotext, ["-bbox", pdf, words], { encoding: "utf8", timeout: 300000 });
    if (text.status !== 0) throw new Error(`pdftotext could not read ${pdf}: ${(text.stderr || "").trim().slice(0, 300)}`);
    const output = freeOutputPath(path.resolve(root, options.output));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const run = spawnSync(python, ["-c", PAGE_ANALYSIS], {
      input: JSON.stringify({ images: scratch, words, output, dpi, limit, perRow: Number(options.perRow ?? 4) }),
      encoding: "utf8",
      maxBuffer: 32 << 20,
      timeout: 300000
    });
    if (run.status !== 0) throw new Error(`Reading the pages failed: ${(run.stderr || run.stdout || "").trim().split("\n").slice(-3).join(" ").slice(0, 400)}`);
    return { status: "composed", mode: "pages", dpi, outputPath: output, pdf, limit, ...JSON.parse(run.stdout) };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
