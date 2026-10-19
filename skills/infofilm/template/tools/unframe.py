#!/usr/bin/env python3
"""Crop a drawn frame or paper margin off a generated illustration, keeping its size and aspect.

  python3 tools/unframe.py film-S07 film-S11     # ids in art/img; originals go to art/img/rejects/

The image model sometimes draws a border, a cream margin or rounded paper corners around a picture
(aerial and map-like views most often), even when the prompt forbids it. Regenerating often gives the
same frame again; cropping is free. Look at the result: it must not cut into the subject.
"""
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

IMG = Path(__file__).resolve().parent.parent / "art" / "img"
PAD = 14  # step inside the drawn border line


def unframe(path):
    rejects = IMG / "rejects"
    rejects.mkdir(exist_ok=True)
    keep = rejects / f"{path.stem}-framed.png"
    shutil.copy(path, keep)
    im = Image.open(keep).convert("RGB")
    a = np.asarray(im).astype(int)
    H, W, _ = a.shape
    margin = a[5:20, W // 2 - 50:W // 2 + 50].reshape(-1, 3).mean(0)  # the margin colour at the top edge
    inside = np.abs(a - margin).sum(2) > 60
    rows = np.where(inside[:, W // 4:3 * W // 4].mean(1) > 0.5)[0]
    cols = np.where(inside[H // 4:3 * H // 4, :].mean(0) > 0.5)[0]
    t, b, l, r = rows[0] + PAD, rows[-1] - PAD, cols[0] + PAD, cols[-1] - PAD
    w, h = r - l, b - t
    if w / h > W / H:  # trim the longer side to keep the aspect
        nw = int(h * W / H); l += (w - nw) // 2; r = l + nw
    else:
        nh = int(w * H / W); t += (h - nh) // 2; b = t + nh
    im.crop((l, t, r, b)).resize((W, H), Image.LANCZOS).save(path)
    print(f"{path.stem}: cropped to {r - l}×{b - t} of {W}×{H}, original in {keep.relative_to(IMG.parent.parent)}")


if __name__ == "__main__":
    for sid in sys.argv[1:]:
        unframe(IMG / f"{sid}.png")
