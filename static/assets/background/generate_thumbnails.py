import os

from PIL import Image

input_dir = "."
output_dir = "thumbnails"

os.makedirs(output_dir, exist_ok=True)

thumb_width = 640
thumb_height = 270

for filename in os.listdir(input_dir):
    if filename.lower().endswith((".webp")):
        input_path = os.path.join(input_dir, filename)
        output_path = os.path.join(output_dir, filename)

        with Image.open(input_path) as img:
            img.thumbnail((thumb_width, thumb_height))
            img.save(output_path)

print("Thumbnails aangemaakt in", output_dir)
