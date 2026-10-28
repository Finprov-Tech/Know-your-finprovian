"""One-time: resize the original posters in Assets/ into web-sized pages + seed data/finprovians.json."""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "Assets"), os.path.join(ROOT, "public", "pages")

# (source file, display name) in booklet order
POSTERS = [
    ("Know your Finprovian.jpg.jpeg", "Francis Sonu"),
    ("Know your Finprovian- Alan.jpg.jpeg", "Alan Xavier"),
    ("Know your Finprovian- Aromal.jpg.jpeg", "Aromal"),
    ("Know your Finprovian Sinchana.jpg.jpeg", "Sinchana"),
    ("Know your Finprovian-Lisha.jpg.jpeg", "Lisha"),
    ("Know your Finprovian-Nandana.jpg.jpeg", "Nandana"),
    ("Know your Finprovian-Sreelakshmi.jpg.jpeg", "Sreelakshmi"),
    ("WhatsApp Image 2026-10-27 at 9.42.08 AM.jpeg", "Abhay Katti"),
    ("WhatsApp Image 2026-10-27 at 9.42.09 AM.jpeg", "Anjali Jaimon"),
    ("WhatsApp Image 2026-10-27 at 9.42.10 AM.jpeg", "Austin Johns"),
    ("WhatsApp Image 2026-10-27 at 9.42.12 AM (1).jpeg", "Akshay Das"),
    ("WhatsApp Image 2026-10-27 at 9.42.12 AM.jpeg", "Aditya"),
    ("WhatsApp Image 2026-10-27 at 9.42.13 AM.jpeg", "Anna"),
    ("WhatsApp Image 2026-10-27 at 9.42.14 AM.jpeg", "Arsha"),
    ("WhatsApp Image 2026-10-27 at 9.42.15 AM.jpeg", "Aysha"),
    ("WhatsApp Image 2026-10-27 at 9.42.16 AM.jpeg", "Josmy Joseph"),
    ("WhatsApp Image 2026-10-27 at 9.42.17 AM (1).jpeg", "Rahul K. U."),
    ("WhatsApp Image 2026-10-27 at 9.42.17 AM.jpeg", "Bhoomadevi S"),
    ("WhatsApp Image 2026-10-27 at 9.42.18 AM (1).jpeg", "Aruna Ashokan"),
    ("WhatsApp Image 2026-10-27 at 9.42.18 AM.jpeg", "Arathy"),
    ("WhatsApp Image 2026-10-27 at 9.42.19 AM.jpeg", "Aswathy"),
    ("WhatsApp Image 2026-10-27 at 9.42.20 AM.jpeg", "Athira Murali K"),
    ("WhatsApp Image 2026-10-27 at 9.42.21 AM (1).jpeg", "Fazil Mohammed"),
    ("WhatsApp Image 2026-10-27 at 9.42.21 AM (2).jpeg", "Naheema"),
    ("WhatsApp Image 2026-10-27 at 9.42.21 AM (3).jpeg", "Surya Kumar P S"),
]

def slug(s):
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-").replace("--", "-")

entries = []
for i, (src, name) in enumerate(POSTERS, 1):
    im = Image.open(os.path.join(SRC, src)).convert("RGB")
    if im.height > 1600:
        im = im.resize((round(im.width * 1600 / im.height), 1600), Image.LANCZOS)
    fname = f"{i:02d}-{slug(name)}.jpg"
    im.save(os.path.join(OUT, fname), "JPEG", quality=84, optimize=True, progressive=True)
    entries.append({"id": f"seed-{i:02d}", "name": name, "role": "", "type": "poster",
                    "image": f"/pages/{fname}", "createdAt": "2026-10-27T00:00:00.000Z"})

data_file = os.path.join(ROOT, "data", "finprovians.json")
if not os.path.exists(data_file) or "--force" in sys.argv:
    with open(data_file, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)
print(len(entries), "pages written")
