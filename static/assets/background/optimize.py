from PIL import Image
from pathlib import Path
import shutil

# Huidige directory
current_dir = Path.cwd()
unoptimized_folder = current_dir / "unoptimized"
unoptimized_folder.mkdir(exist_ok=True)

for img_path in current_dir.glob("*.[jp][pn]g"):
    # Verplaats originele bestand naar 'unoptimized'
    shutil.move(str(img_path), unoptimized_folder / img_path.name)

    # Open en sla op als WebP op dezelfde locatie
    with Image.open(unoptimized_folder / img_path.name) as img:
        output_path = current_dir / f"{img_path.stem}.webp"
        img.save(output_path, format="WEBP")
        print(f"Saved WebP: {output_path.name}")
