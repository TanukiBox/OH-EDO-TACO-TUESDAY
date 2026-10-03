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
import people_render  # noqa: E402
import foods_render  # noqa: E402
import scenes  # noqa: E402
import landscapes  # noqa: E402
import wildlife  # noqa: E402
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


def job_plain(out):
    """料理画面用：具なしのトルティーヤ（皿つき）が折りたたまれる8コマ。
    ゲームの中で、好きな具をこの上に重ねて一緒に折りたたむ。"""
    common.reset_scene()
    common.set_resolution(TACO_SIZE * SCALE, TACO_SIZE * SCALE)
    common.add_lantern_light()
    common.add_night_world()
    taco.build_plate()
    common.top_camera(TOP_ORTHO_SCALE)
    common.render_to(os.path.join(out, "plate_top.png"))   # 皮を置く前の空の皿
    tortillas = taco.build_tortilla()
    folder = taco.Folder(tortillas)
    for f in range(FOLD_FRAMES):
        folder.apply(f / (FOLD_FRAMES - 1))
        common.render_to(os.path.join(out, f"plain_fold_{f:02d}.png"))


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
    p.add_argument("--jobs", default="taco,plain,icons,noren,people,foods,skins,stall,stall_toon,map,minigames,creatures,wildlife,yami,classic,story,kitchen,kitchen_toon,market")
    p.add_argument("--foods", default="", help="食材をしぼる（カンマ区切り）")
    p.add_argument("--people", default="", help="人物をしぼる（カンマ区切り）")
    a = p.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    jobs = a.jobs.split(",")
    if "taco" in jobs:
        print("== タコス", flush=True)
        job_taco(a.out)
    if "plain" in jobs:
        print("== 具なしトルティーヤ", flush=True)
        job_plain(a.out)
    if "icons" in jobs:
        print("== 具材アイコン", flush=True)
        job_icons(a.out)
    if "people" in jobs:
        print("== 人物", flush=True)
        people_render.job_people(a.out, [k for k in a.people.split(",") if k] or None)
    if "foods" in jobs:
        print("== 食材", flush=True)
        foods_render.job_foods(a.out, [k for k in a.foods.split(",") if k] or None)
    if "skins" in jobs:
        print("== 皮", flush=True)
        foods_render.job_skins(a.out)
    if "stall" in jobs:
        print("== 屋台", flush=True)
        scenes.job_stall(a.out)
    if "stall_toon" in jobs:
        print("== 屋台（セル調版）", flush=True)
        scenes.job_stall_toon(a.out)
    if "classic" in jobs:
        print("== 地図・ミニゲームの背景（前の塗り方の版）", flush=True)
        landscapes.job_map_classic(a.out)
        landscapes.job_minigames_classic(a.out)
        landscapes.job_yami_classic(a.out)
    if "map" in jobs:
        print("== 地図", flush=True)
        landscapes.job_map(a.out)
    if "minigames" in jobs:
        print("== ミニゲームの背景", flush=True)
        landscapes.job_minigames(a.out)
    if "creatures" in jobs:
        print("== 生き物", flush=True)
        scenes.job_creatures(a.out)
    if "wildlife" in jobs:
        print("== 山の獣と里山の採集もの", flush=True)
        wildlife.job_wildlife(a.out)
    if "yami" in jobs:
        print("== 長崎の闇商人の蔵", flush=True)
        landscapes.job_yami(a.out)
    if "story" in jobs:
        print("== 紙芝居", flush=True)
        scenes.job_story(a.out, a.textures)
    if "kitchen" in jobs:
        print("== 厨房", flush=True)
        scenes.job_kitchen(a.out)
    if "kitchen_toon" in jobs:
        print("== 厨房の焼き場（セル調版）", flush=True)
        scenes.job_kitchen_toon(a.out)
    if "market" in jobs:
        print("== 魚河岸の競り", flush=True)
        scenes.job_market(a.out)
    if "noren" in jobs:
        print("== 暖簾", flush=True)
        job_noren(a.out, a.textures)


main()
