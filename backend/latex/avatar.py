"""Avatar preprocessing for LaTeX templates.

Frontend may already deliver a square 1:1 crop, but we treat the incoming bytes
as untrusted: re-decode, re-encode, center-crop, resize, and (for circle shape)
apply an alpha mask. The result lands in the LaTeX work directory with a fixed
basename so templates can reference it without knowing the path.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import io
from collections import OrderedDict
from pathlib import Path
from typing import Literal

from PIL import Image, ImageDraw, ImageOps

MAX_DECODED_BYTES = 5 * 1024 * 1024  # 5 MB
OUTPUT_SIZE = 600  # px, square

# In-memory LRU for processed avatar bytes keyed by fingerprint(base64+shape).
# Same avatar across many preview-debounce hits → skip Pillow entirely.
_PROCESSED_CACHE: "OrderedDict[str, tuple[str, bytes]]" = OrderedDict()
_PROCESSED_CACHE_MAX = 16


Shape = Literal["circle", "square"]


class AvatarError(ValueError):
    pass


def _decode_base64(value: str) -> bytes:
    if not value:
        raise AvatarError("Пустой аватар")
    payload = value.strip()
    if payload.startswith("data:"):
        comma = payload.find(",")
        if comma == -1:
            raise AvatarError("Невалидный data-URL аватара")
        payload = payload[comma + 1 :]
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AvatarError("Невалидный base64") from exc
    if len(raw) > MAX_DECODED_BYTES:
        raise AvatarError("Файл слишком большой (макс 5 МБ)")
    if len(raw) < 32:
        raise AvatarError("Слишком маленький файл")
    return raw


def _open_image(raw: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception as exc:  # Pillow raises a zoo of exceptions
        raise AvatarError("Не удалось прочитать изображение") from exc
    if img.format not in {"JPEG", "PNG", "WEBP"}:
        raise AvatarError(f"Формат {img.format} не поддерживается")
    return ImageOps.exif_transpose(img)


def _center_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def _apply_circle_mask(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, img.size[0], img.size[1]), fill=255)
    img.putalpha(mask)
    return img


def _fingerprint(base64_value: str, shape: Shape) -> str:
    h = hashlib.blake2s(digest_size=16)
    h.update(shape.encode("ascii"))
    h.update(b"\0")
    h.update(base64_value.encode("ascii", errors="ignore"))
    return h.hexdigest()


def _cache_get(key: str) -> tuple[str, bytes] | None:
    entry = _PROCESSED_CACHE.get(key)
    if entry is None:
        return None
    _PROCESSED_CACHE.move_to_end(key)
    return entry


def _cache_put(key: str, value: tuple[str, bytes]) -> None:
    _PROCESSED_CACHE[key] = value
    _PROCESSED_CACHE.move_to_end(key)
    while len(_PROCESSED_CACHE) > _PROCESSED_CACHE_MAX:
        _PROCESSED_CACHE.popitem(last=False)


def _process(base64_value: str, shape: Shape) -> tuple[str, bytes]:
    """Decode + center-crop + resize + (for circle) alpha-mask. Returns (basename, bytes)."""
    raw = _decode_base64(base64_value)
    img = _open_image(raw)
    img = _center_square(img)
    if img.size[0] > OUTPUT_SIZE:
        img = img.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)

    out = io.BytesIO()
    if shape == "circle":
        img = _apply_circle_mask(img)
        # optimize=False trades ~5kb for ~10x faster save on preview hot path.
        img.save(out, format="PNG", optimize=False, compress_level=3)
        return "avatar.png", out.getvalue()
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.save(out, format="JPEG", quality=88, optimize=False)
    return "avatar.jpg", out.getvalue()


def prepare_avatar(base64_value: str, shape: Shape, workdir: Path) -> str:
    """Decode + normalize avatar into workdir; return the basename to use in LaTeX.

    Pillow work is cached in memory by (base64, shape) fingerprint so repeated
    preview compiles skip the expensive decode/resize/encode path entirely.
    """
    key = _fingerprint(base64_value, shape)
    cached = _cache_get(key)
    if cached is None:
        cached = _process(base64_value, shape)
        _cache_put(key, cached)

    name, payload = cached
    workdir.mkdir(parents=True, exist_ok=True)
    (workdir / name).write_bytes(payload)
    return name
