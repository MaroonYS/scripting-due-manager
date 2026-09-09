# SPDX-FileCopyrightText: 2026 MaroonYS
# SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
"""Read-only PNG analysis and contact sheets; never modifies source artwork."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys

root = Path(__file__).resolve().parents[1]
assets = root / "到期管家" / "assets" / "icons8"
out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
icons = json.loads((assets / "sources.json").read_text())["icons"]
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
report = []
for icon in icons:
    path = assets / (icon["vendorID"] + ".png")
    with Image.open(path) as check:
        check.verify()
    with Image.open(path) as opened:
        im = opened.convert("RGBA")
        if im.size != (96, 96) or not im.getbbox():
            raise ValueError(f"Empty or invalid icon: {icon['id']}")
        visible = [p for p in im.getdata() if p[3] >= 128]
        def linear(v):
            v /= 255
            return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
        luminance = [sum(w * linear(c) for c, w in zip(p[:3], (.2126, .7152, .0722))) for p in visible]
        dark_fraction = sum(l < .12 for l in luminance) / max(1, len(luminance))
        light_fraction = sum(l > .7 for l in luminance) / max(1, len(luminance))
        report.append({"id": icon["id"], "label": icon["label"], "darkFraction": round(dark_fraction, 3), "lightFraction": round(light_fraction, 3)})
for page in range((len(icons) + 79) // 80):
    subset = icons[page * 80:(page + 1) * 80]
    sheet = Image.new("RGB", (1600, 1240), "#eef0f3")
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 10), f"Icons8 Windows 11 Color - source PNG QA - sheet {page+1}", fill="#17202b", font=font)
    for index, icon in enumerate(subset):
        x, y = (index % 8) * 200, 45 + (index // 8) * 119
        draw.rounded_rectangle((x+5, y+3, x+194, y+114), radius=9, fill="#ffffff")
        draw.rounded_rectangle((x+101, y+8, x+185, y+83), radius=9, fill="#1c1c1e")
        with Image.open(assets / (icon["vendorID"] + ".png")) as opened:
            im = opened.convert("RGBA").resize((56, 56), Image.Resampling.LANCZOS)
            sheet.paste(im, (x+24, y+18), im)
            if icon.get("lightBackplate"):
                draw.rounded_rectangle((x+115, y+18, x+171, y+74), radius=11, fill="#ffffff")
            sheet.paste(im, (x+115, y+18), im)
        label = icon["label"]
        draw.text((x+10, y+91), label if len(label) <= 23 else label[:21]+"…", font=small, fill="#243245")
    sheet.save(out / f"icons8-qa-{page+1:02}.png")
(out / "contrast-report.json").write_text(json.dumps(report, indent=2))
print(json.dumps({"verified": len(icons), "sheets": (len(icons)+79)//80, "darkOnly": [r for r in report if r['darkFraction'] > .92], "lightOnly": [r for r in report if r['lightFraction'] > .92]}))
