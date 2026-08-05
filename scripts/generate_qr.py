#!/usr/bin/env python3
"""Regenerate printable fallback QR PNGs after the final public URL is known."""
from __future__ import annotations

import argparse
from pathlib import Path

try:
    import qrcode
except ImportError as exc:
    raise SystemExit("Install the Python package first: python -m pip install qrcode[pil]") from exc

ACTIVITIES = {
    "frequency": "2049",
    "coverage": "5827",
    "representation": "4183",
    "context": "9672",
    "temperature": "3506",
    "challenge": "6241",
}


def save_qr(target: str, path: Path) -> None:
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=4)
    qr.add_data(target)
    qr.make(fit=True)
    qr.make_image(fill_color="black", back_color="white").save(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url", help="For example: https://outreach-talk.example.workers.dev")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    out = Path(__file__).resolve().parents[1] / "public" / "assets" / "qr"
    out.mkdir(parents=True, exist_ok=True)

    save_qr(f"{base}/", out / "audience.png")
    save_qr(f"{base}/moderator/", out / "moderator.png")
    save_qr(f"{base}/play/", out / "facilitator.png")
    save_qr(f"{base}/lab/", out / "join.png")
    save_qr(f"{base}/lab/?code=7316", out / "predictor.png")
    for name, code in ACTIVITIES.items():
        save_qr(f"{base}/lab/?code={code}", out / f"{name}.png")
    print(f"Updated QR images in {out}")


if __name__ == "__main__":
    main()
