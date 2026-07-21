# Bake organ reference images into particle point-cloud binaries.
# Usage: python scripts/bake-organ-shapes.py
# Output: public/shapes/{heart,lung,stomach,brain}.bin  +  shots/shape-preview/{organ}.png
#
# Pipeline per organ:
#   1. saturation-based mask (drops white bg, gray labels, watermark)
#   2. hole filling + small-component removal
#   3. chamfer distance transform -> pillow-style relief depth
#   4. weighted sampling (uniform + edge boost), colors taken from the source image
# Bin layout: uint32 N | N*3 float32 xyz | N*3 uint8 rgb

from pathlib import Path
import struct
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT_BIN = ROOT / "public" / "shapes"
OUT_PREVIEW = ROOT / "shots" / "shape-preview"

N_POINTS = 6000
MAX_DIM = 1.9        # world units of the organ's largest side
MAX_Z = 0.26         # relief half-thickness at the organ's center
SAT_MIN = 0.10       # saturation threshold for the mask
VAL_MIN = 0.12       # value threshold (drop near-black text)
MIN_LUM = 95         # lift dark sampled colors so they read on black


def load_mask(path: Path) -> tuple[np.ndarray, np.ndarray]:
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img).astype(np.float32) / 255.0
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    mask = (sat > SAT_MIN) & (mx > VAL_MIN)
    return mask, (rgb * 255).astype(np.uint8)


def fill_holes(mask: np.ndarray) -> np.ndarray:
    """Flood fill background from borders; holes = unvisited non-mask pixels."""
    h, w = mask.shape
    bg = np.zeros((h, w), dtype=bool)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if not mask[y, x] and not bg[y, x]:
                bg[y, x] = True
                stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not mask[y, x] and not bg[y, x]:
                bg[y, x] = True
                stack.append((y, x))
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                stack.append((ny, nx))
    return mask | ~bg


def keep_large_components(mask: np.ndarray, min_ratio: float = 0.02) -> np.ndarray:
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    sizes = [0]
    cur = 0
    for y0 in range(h):
        row = mask[y0]
        for x0 in np.nonzero(row & (labels[y0] == 0))[0]:
            cur += 1
            sizes.append(0)
            stack = [(y0, int(x0))]
            labels[y0, x0] = cur
            while stack:
                y, x = stack.pop()
                sizes[cur] += 1
                for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and labels[ny, nx] == 0:
                        labels[ny, nx] = cur
                        stack.append((ny, nx))
    if cur == 0:
        return mask
    biggest = max(sizes[1:])
    keep = np.zeros_like(mask)
    for lbl in range(1, cur + 1):
        if sizes[lbl] >= biggest * min_ratio:
            keep |= labels == lbl
    return keep


def chamfer_distance(mask: np.ndarray) -> np.ndarray:
    """Two-pass chamfer (3-4) distance transform of mask interior."""
    h, w = mask.shape
    INF = np.float32(1e9)
    d = np.where(mask, np.float32(0), INF)
    # distance to the nearest background pixel: compute on inverted mask
    inv = ~mask
    d = np.where(inv, np.float32(0), INF)
    for y in range(h):
        for x in range(w):
            if d[y, x] == 0:
                continue
            best = d[y, x]
            if x > 0: best = min(best, d[y, x-1] + 3)
            if y > 0: best = min(best, d[y-1, x] + 3)
            if x > 0 and y > 0: best = min(best, d[y-1, x-1] + 4)
            if x < w-1 and y > 0: best = min(best, d[y-1, x+1] + 4)
            d[y, x] = best
    for y in range(h - 1, -1, -1):
        for x in range(w - 1, -1, -1):
            if d[y, x] == 0:
                continue
            best = d[y, x]
            if x < w-1: best = min(best, d[y, x+1] + 3)
            if y < h-1: best = min(best, d[y+1, x] + 3)
            if x < w-1 and y < h-1: best = min(best, d[y+1, x+1] + 4)
            if x > 0 and y < h-1: best = min(best, d[y+1, x-1] + 4)
            d[y, x] = best
    return d / 3.0


def open_mask(mask: np.ndarray, size: int = 5) -> np.ndarray:
    """Erode then dilate to remove thin leader lines / specks."""
    img = Image.fromarray(mask)
    img = img.filter(ImageFilter.MinFilter(size)).filter(ImageFilter.MaxFilter(size))
    return np.asarray(img)


def sample_organ(name: str, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    mask, rgb = load_mask(ASSETS / name)
    mask = fill_holes(mask)
    mask = open_mask(mask)
    mask = keep_large_components(mask)
    if not mask.any():
        raise RuntimeError(f"empty mask for {name}")

    dist = chamfer_distance(mask)
    max_d = float(dist.max()) or 1.0

    # sampling weights: uniform interior + crisp edge band
    edge = 1.0 - dist / max_d
    weights = np.where(mask, 0.55 + 0.75 * edge, 0.0)
    flat_w = weights.ravel()
    cum = np.cumsum(flat_w)
    total = float(cum[-1])
    draws = rng.random(N_POINTS) * total
    idx = np.searchsorted(cum, draws)
    h, w = mask.shape
    ys, xs = np.divmod(idx, w)

    # normalize to world units, centered on the mask bbox, y flipped up
    my, mx_ = np.nonzero(mask)
    x0, x1 = mx_.min(), mx_.max()
    y0, y1 = my.min(), my.max()
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    span = max(x1 - x0, y1 - y0)
    scale = MAX_DIM / span

    # jitter inside the pixel for smoother coverage
    jx = xs.astype(np.float32) + rng.random(N_POINTS) - 0.5
    jy = ys.astype(np.float32) + rng.random(N_POINTS) - 0.5
    X = (jx - cx) * scale
    Y = -(jy - cy) * scale
    relief = np.sqrt(np.clip(dist[ys, xs] / max_d, 0, 1))
    Z = (rng.random(N_POINTS) * 2 - 1) * MAX_Z * relief

    pos = np.stack([X, Y, Z], axis=1).astype(np.float32)

    col = rgb[ys, xs].astype(np.float32)
    lum = 0.3 * col[:, 0] + 0.5 * col[:, 1] + 0.2 * col[:, 2]
    lift = np.clip(MIN_LUM / np.maximum(lum, 1.0), 1.0, 3.0)
    col = np.clip(col * lift[:, None], 0, 255).astype(np.uint8)
    return pos, col


def write_bin(path: Path, pos: np.ndarray, col: np.ndarray) -> None:
    n = pos.shape[0]
    with open(path, "wb") as f:
        f.write(struct.pack("<I", n))
        f.write(pos.astype("<f4").tobytes())
        f.write(col.tobytes())


def write_preview(path: Path, pos: np.ndarray, col: np.ndarray) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(6, 6), dpi=110)
    fig.patch.set_facecolor("black")
    ax.set_facecolor("black")
    order = np.argsort(pos[:, 2])
    ax.scatter(pos[order, 0], pos[order, 1], s=1.2, c=col[order] / 255.0, linewidths=0)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.savefig(path, bbox_inches="tight", facecolor="black")
    plt.close(fig)


def main() -> None:
    OUT_BIN.mkdir(parents=True, exist_ok=True)
    OUT_PREVIEW.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(20260721)
    for name in ["heart.jpg", "lung.png", "stomach.png", "brain.png"]:
        organ = Path(name).stem
        pos, col = sample_organ(name, rng)
        write_bin(OUT_BIN / f"{organ}.bin", pos, col)
        write_preview(OUT_PREVIEW / f"{organ}.png", pos, col)
        xs = pos[:, 0]
        ys = pos[:, 1]
        print(f"{organ}: {pos.shape[0]} pts  x[{xs.min():.2f},{xs.max():.2f}] y[{ys.min():.2f},{ys.max():.2f}] z[{pos[:,2].min():.2f},{pos[:,2].max():.2f}]")


if __name__ == "__main__":
    main()
