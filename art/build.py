"""すべての画像を作り直すコマンド。

  python build.py                 … Blender でレンダリング → ドット絵化 → preview.html
  python build.py --skip-render   … レンダリングを省略（パレットだけ変えたときに速い）
  python build.py --only icons    … 一部だけレンダリング（taco / icons / noren をカンマ区切り）
"""
import argparse
import hashlib
import os
import subprocess
import sys
import time

from pipeline.blender_path import find_blender
from pipeline import noren_textures, pixelate, preview
from pipeline.palette import PALETTE

ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(ROOT, "build")        # 途中のファイル（Git には入れない）
RENDERS = os.path.join(BUILD, "renders")
TEXTURES = os.path.join(BUILD, "textures")
OUT = os.path.join(ROOT, "output")         # 完成したドット絵

TACO = (128, 128)
ICON = (32, 32)
NOREN = (240, 160)
FOLD_FRAMES = 8
NOREN_FRAMES = 6


def ingredient_list():
    """blender/ingredients/__init__.py から具材の名前を読む（Blender なしで読むため）。"""
    import ast
    import re
    names, labels = [], {}
    idir = os.path.join(ROOT, "blender", "ingredients")
    src = open(os.path.join(idir, "__init__.py"), encoding="utf-8").read()
    block = src.split("INGREDIENTS = [", 1)[1].split("]", 1)[0]
    for mod in re.findall(r"^\s*(\w+),", block, re.M):
        msrc = open(os.path.join(idir, mod + ".py"), encoding="utf-8").read()
        tree = ast.parse(msrc)
        vals = {t.targets[0].id: t.value.value for t in tree.body
                if isinstance(t, ast.Assign) and isinstance(t.value, ast.Constant)
                and isinstance(t.targets[0], ast.Name)}
        names.append(vals["NAME"])
        labels[vals["NAME"]] = vals.get("LABEL", vals["NAME"])
    return names, labels


def render(jobs):
    blender = find_blender()
    if not blender:
        sys.exit("Blender が見つかりません。README.md の「困ったとき」を見てください。")
    noren_textures.make(TEXTURES)
    cmd = [blender, "-b", "--factory-startup", "--python-exit-code", "1",
           "-P", os.path.join(ROOT, "blender", "render_all.py"), "--",
           "--out", RENDERS, "--textures", TEXTURES, "--jobs", jobs]
    print("Blender を起動します:", blender, flush=True)
    t0 = time.time()
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          text=True, encoding="utf-8", errors="replace")
    for line in proc.stdout.splitlines():
        if line.startswith(("==", "  rendered", "Traceback", "Error", "  File")) or "Error" in line:
            print(line)
    if proc.returncode != 0:
        print(proc.stdout[-4000:])
        sys.exit("Blender でエラーが起きました（上のメッセージを見てください）。")
    print(f"レンダリング完了（{time.time() - t0:.0f} 秒）")


def write_fold_js(path):
    """ゲームが具を一緒に折りたたむための数字（Blender 側と同じ値）を書き出す。"""
    import json
    import re
    src = open(os.path.join(ROOT, "blender", "taco.py"), encoding="utf-8").read()
    ra = open(os.path.join(ROOT, "blender", "render_all.py"), encoding="utf-8").read()

    def num(name, text):
        return float(re.search(rf"^{name} = ([0-9.]+)", text, re.M).group(1))

    data = {
        "size": TACO[0],
        "orthoScale": num("TOP_ORTHO_SCALE", ra),
        "foldBand": num("FOLD_BAND", src),
        "foldMaxAngle": 3.141592653589793 * float(re.search(r"^FOLD_MAX_ANGLE = math.pi \* ([0-9.]+)", src, re.M).group(1)),
        "frames": FOLD_FRAMES,
    }
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("// art/build.py が自動で書き出すファイル（手で書きかえない）\n")
        f.write("window.OT_FOLD = " + json.dumps(data) + ";\n")


def convert():
    names, labels = ingredient_list()
    os.makedirs(OUT, exist_ok=True)
    made = []

    def one(src_name, size, dst_rel):
        img = pixelate.pixelate(os.path.join(RENDERS, src_name), size)
        dst = os.path.join(OUT, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        pixelate.save_png(img, dst)
        made.append(dst_rel)
        return img

    # 5.1 / 5.2
    one("taco_top.png", TACO, "taco/taco_top.png")
    one("taco_oblique.png", TACO, "taco/taco_oblique.png")
    # 5.3
    fold = [one(f"taco_fold_{i:02d}.png", TACO, f"taco_fold/taco_fold_{i:02d}.png")
            for i in range(FOLD_FRAMES)]
    pixelate.save_gif(fold, os.path.join(OUT, "taco_fold/taco_fold_x4.gif"),
                      [700] + [110] * (FOLD_FRAMES - 2) + [900])
    made.append("taco_fold/taco_fold_x4.gif")
    # 料理画面用：空の皿と、具なしトルティーヤの折りたたみ
    one("plate_top.png", TACO, "taco_plain/plate_top.png")
    for i in range(FOLD_FRAMES):
        one(f"plain_fold_{i:02d}.png", TACO, f"taco_plain/plain_fold_{i:02d}.png")
    write_fold_js(os.path.join(OUT, "taco_plain", "fold.js"))
    made.append("taco_plain/fold.js")
    # 5.4
    for n in names:
        one(f"icon_{n}.png", ICON, f"icons/icon_{n}.png")
    # 6.3
    nor = [one(f"noren_{i:02d}.png", NOREN, f"noren/noren_{i:02d}.png")
           for i in range(NOREN_FRAMES)]
    pixelate.save_gif(nor, os.path.join(OUT, "noren/noren_x4.gif"), [120] * NOREN_FRAMES)
    made.append("noren/noren_x4.gif")

    # 同じ入力から同じ画像ができているか確かめるための指紋（SHA-256）
    with open(os.path.join(OUT, "checksums.txt"), "w", encoding="utf-8", newline="\n") as f:
        for rel in made:
            h = hashlib.sha256(open(os.path.join(OUT, rel), "rb").read()).hexdigest()
            f.write(f"{h}  {rel}\n")

    preview.write(os.path.join(ROOT, "preview.html"), names, labels,
                  FOLD_FRAMES, NOREN_FRAMES, PALETTE)
    print(f"ドット絵 {len(made)} 個を output/ に書き出しました。preview.html をダブルクリックで確認できます。")


def main():
    p = argparse.ArgumentParser(description="Oh!Edo Taco Tuesday!! のドット絵を作り直す")
    p.add_argument("--skip-render", action="store_true", help="Blender のレンダリングを省略する")
    p.add_argument("--only", default="taco,plain,icons,noren", help="レンダリングする種類")
    a = p.parse_args()
    if not a.skip_render:
        render(a.only)
    convert()


if __name__ == "__main__":
    main()
