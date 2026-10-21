"""Rasterize figure PDFs (e.g. the paper's images/*.pdf, or pages of the paper) to PNG for UI.figure."""
from pathlib import Path

from common import die


def run(inputs, outdir, zoom=3.0, pages=None, trim=True):
    import pymupdf as fitz
    outdir = Path(outdir).expanduser().resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    files = []
    for i in inputs:
        p = Path(i).expanduser()
        files += sorted(p.glob("*.pdf")) if p.is_dir() else [p]
    if not files:
        die("no PDF files found")
    for f in files:
        if f.stat().st_size == 0:
            print(f"skip {f} (0 bytes: an online-only cloud placeholder? make it available offline first)")
            continue
        doc = fitz.open(f)
        sel = range(len(doc)) if pages is None else [p - 1 for p in pages if 0 < p <= len(doc)]
        for k in sel:
            pix = doc[k].get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            out = outdir / (f"{f.stem}.png" if len(doc) == 1 else f"{f.stem}-p{k + 1}.png")
            pix.save(out)
            if trim:
                from PIL import Image, ImageChops
                im = Image.open(out).convert("RGB")
                bbox = ImageChops.difference(im, Image.new("RGB", im.size, (255, 255, 255))).getbbox()
                if bbox:
                    pad = int(8 * zoom)
                    im.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad))).save(out)
            w, h = __import__("PIL.Image", fromlist=["Image"]).open(out).size
            print(f"{out}  {w}x{h}")
