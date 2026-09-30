"""暖簾の布の模様（藍色地に白抜き文字）を、フォントから作る。

できた画像は Blender で布に貼られます。
"""
import os

from PIL import Image, ImageDraw, ImageFont

FONT_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "YujiSyuku-Regular.ttf")
LETTERS = "多幸寿"
INDIGO = "#223a70"
WHITE = "#f6f2e6"
SIZE = (370, 650)  # 布1枚の縦横比（0.74 : 1.30）に合わせる


def make(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    font = ImageFont.truetype(FONT_PATH, 300)
    paths = []
    for i, ch in enumerate(LETTERS):
        img = Image.new("RGB", SIZE, INDIGO)
        d = ImageDraw.Draw(img)
        d.text((SIZE[0] / 2, SIZE[1] * 0.56), ch, font=font, fill=WHITE, anchor="mm")
        path = os.path.join(out_dir, f"noren_{i}.png")
        img.save(path)
        paths.append(path)
    return paths
