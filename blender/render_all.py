"""Blender の中で実行される入口。モデルを作り、高解像度の元画像をレンダリングする。

build.py が次のように呼び出します（手で実行する必要はありません）:
  blender -b --factory-startup -P blender/render_all.py -- --out build/renders --textures build/textures
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import common  # noqa: E402
import taco  # noqa: E402
import noren  # noqa: E402
from ingredients import INGREDIENTS  # noqa: E402

# 元画像は完成サイズの 4 倍で描き、あとで縮小する
SCALE = 4
TACO_SIZE = 128
ICON_SIZE = 32
NOREN_SIZE = (240, 160)
FOLD_FRAMES = 8
NOREN_FRAMES = 6
TOP_ORTHO_SCALE = 2.9


def job_taco(out):
    common.reset_scene()
    common.set_resolution(TACO_SIZE * SCALE, TACO_SIZE * SCALE)
    common.add_lantern_light()
    common.add_night_world()

    plate = taco.build_plate()
    tortillas = taco.build_tortilla()
    pile = common.Pile(taco.TOP_Z)
    toppings = []
    for ing in INGREDIENTS:
        toppings += ing.on_taco(pile, common.rng_for(ing.NAME))

    # 5.1 真上
    common.top_camera(TOP_ORTHO_SCALE)
    common.render_to(os.path.join(out, "taco_top.png"))

    # 5.2 斜め上（45度）
    cam = common.oblique_camera(1.0)
    common.fit_camera(cam, [plate] + tortillas + toppings, margin=1.05)
    common.render_to(os.path.join(out, "taco_oblique.png"))

    # 5.3 折りたたみアニメ（真上）
    common.top_camera(TOP_ORTHO_SCALE)
    folder = taco.Folder(tortillas + toppings)
    for f in range(FOLD_FRAMES):
        folder.apply(f / (FOLD_FRAMES - 1))
        common.render_to(os.path.join(out, f"taco_fold_{f:02d}.png"))


def job_icons(out):
    for ing in INGREDIENTS:
        common.reset_scene()
        common.set_resolution(ICON_SIZE * SCALE, ICON_SIZE * SCALE)
        common.add_lantern_light()
        common.add_night_world()
        objs = ing.icon(common.rng_for(ing.NAME + "_icon"))
        cam = common.oblique_camera(1.0)
        common.fit_camera(cam, objs, margin=1.18)
        common.render_to(os.path.join(out, f"icon_{ing.NAME}.png"))


def job_noren(out, textures):
    common.reset_scene()
    common.set_resolution(NOREN_SIZE[0] * SCALE, NOREN_SIZE[1] * SCALE)
    common.add_lantern_light(direction_from=(-1.8, -0.7, 1.1), strength=5.0,
                             color=(1.0, 0.93, 0.84))
    common.add_night_world(strength=0.5)
    common.add_ortho_camera("CamFront", (0, -10, 0), ortho_scale=2.4, up="Z")
    paths = [os.path.join(textures, f"noren_{i}.png") for i in range(noren.PANELS)]
    panels = noren.build(paths)
    for f in range(NOREN_FRAMES):
        noren.pose(panels, f, NOREN_FRAMES)
        common.render_to(os.path.join(out, f"noren_{f:02d}.png"))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--textures", required=True)
    p.add_argument("--jobs", default="taco,icons,noren")
    a = p.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    jobs = a.jobs.split(",")
    if "taco" in jobs:
        print("== タコス", flush=True)
        job_taco(a.out)
    if "icons" in jobs:
        print("== 具材アイコン", flush=True)
        job_icons(a.out)
    if "noren" in jobs:
        print("== 暖簾", flush=True)
        job_noren(a.out, a.textures)


main()
