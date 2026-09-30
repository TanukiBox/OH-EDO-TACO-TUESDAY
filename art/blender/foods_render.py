"""食材と皮のレンダリング：アイコン（斜め上）・かけら（真上）・皮の折りたたみ8コマ。"""
import math
import os

import bmesh
import bpy

import common
import foods
import taco

PIECE_UNITS = 0.82      # かけら1枚に写す範囲（トルティーヤの半径 = 1）。タコスの絵と同じ縮尺で 36px になる
PIECE_PX = 36
VARIANTS = 3
CLUSTER = {"dust", "kernels", "crumble", "drops", "larva", "zest"}   # 小さいものは、ひとつまみずつ描く


def _base(size_px):
    common.reset_scene()
    common.set_resolution(size_px * 4, size_px * 4)
    bpy.context.scene.cycles.samples = 24
    common.add_lantern_light()
    common.add_night_world()


def render_piece(key, spec, out):
    """真上から見たかけら（VARIANTS 通り）。小さいものは、ひとつまみ分をまとめて描く。"""
    for v in range(VARIANTS):
        _base(PIECE_PX)
        rng = common.rng_for("%s_piece_%d" % (key, v))
        if spec["shape"] in CLUSTER:
            n = 7 if spec["shape"] != "larva" else 4
            for k in range(n):
                a, d = rng.uniform(0, 6.28), rng.uniform(0, 0.12)
                foods.build(key, spec, rng, x=math.cos(a) * d, y=math.sin(a) * d, rot=rng.uniform(0, 3.14))
        else:
            foods.build(key, spec, rng, rot=rng.uniform(0, 3.14))
        common.top_camera(PIECE_UNITS)
        common.render_to(os.path.join(out, "piece_%s_%d.png" % (key, v)))


def render_icon(key, spec, out):
    """斜め上から見た、ひと山のアイコン（32×32）。"""
    _base(32)
    rng = common.rng_for(key + "_icon")
    pile = common.Pile(0.0, extent=0.8, n=80)
    objs = []
    n = spec.get("icon", 4)
    spread = max(0.06, spec["size"] * 0.9)
    for k in range(n):
        a = k / max(1, n) * 6.28 + rng.uniform(-0.3, 0.3)
        d = spread * (0.35 + 0.65 * math.sqrt(rng.random())) if n > 1 else 0
        bm, extra = foods.shape_piece(spec, rng)
        x, y = math.cos(a) * d, math.sin(a) * d
        (x0, x1), (y0, y1), (_, z1) = common.bm_bounds(bm)
        z = pile.height_at(x, y, max(x1 - x0, y1 - y0) * 0.3)
        rot = rng.uniform(0, 3.14)
        common.transform_bm(bm, rot_z=rot, loc=(x, y, z))
        objs.append(common.mesh_object("icon_" + key, bm, foods._mat(key, spec)))
        for ebm, col in extra:
            common.transform_bm(ebm, rot_z=rot, loc=(x, y, z))
            objs.append(common.mesh_object("icon_x", ebm, foods._solid(key, col)))
        pile.raise_to(x, y, max(x1 - x0, y1 - y0) * 0.4, z + z1 * 0.8)
    cam = common.oblique_camera(1.0)
    common.fit_camera(cam, objs, margin=1.2)
    common.render_to(os.path.join(out, "food_%s.png" % key))


def job_foods(out, keys=None):
    for key, spec in list(foods.FOODS.items()) + list(foods.GARNISH.items()):
        if keys and key not in keys:
            continue
        print("== 食材", key, flush=True)
        render_piece(key, spec, out)
        if key in foods.FOODS:
            render_icon(key, spec, out)


# ---------------------------------------------------------------------------
# 皮：料理画面の折りたたみ8コマ（皿つき）とアイコン
# ---------------------------------------------------------------------------
def job_skins(out, keys=None, frames=8, ortho=2.9):
    for kind in taco.SKINS:
        if keys and kind not in keys:
            continue
        print("== 皮", kind, flush=True)
        common.reset_scene()
        common.set_resolution(128 * 4, 128 * 4)
        common.add_lantern_light()
        common.add_night_world()
        taco.build_plate()
        objs = taco.build_skin(kind)
        common.top_camera(ortho)
        folder = taco.Folder(objs)
        for f in range(frames):
            folder.apply(f / (frames - 1))
            common.render_to(os.path.join(out, "skin_%s_fold_%02d.png" % (kind, f)))
        # アイコン（皿なし・斜め上）
        common.reset_scene()
        common.set_resolution(128, 128)
        common.add_lantern_light()
        common.add_night_world()
        objs = taco.build_skin(kind)
        cam = common.oblique_camera(1.0)
        common.fit_camera(cam, objs, margin=1.1)
        common.render_to(os.path.join(out, "food_%s.png" % kind))
    # トルティーヤ（と本物の皮）のアイコン
    common.reset_scene()
    common.set_resolution(128, 128)
    common.add_lantern_light()
    common.add_night_world()
    objs = taco.build_tortilla()
    cam = common.oblique_camera(1.0)
    common.fit_camera(cam, objs, margin=1.1)
    for name in ("tortilla", "real_tortilla"):
        common.render_to(os.path.join(out, "food_%s.png" % name))
    # かご蒸し（作り置き）のアイコン：蒸籠
    common.reset_scene()
    common.set_resolution(128, 128)
    common.add_lantern_light()
    common.add_night_world()
    m, nt, bsdf = common.new_material("seiro", "#dca24a", 0.7)
    rim, _, _ = common.new_material("seiro_rim", "#8c5228", 0.7)
    body = common.bm_lathe([(0, 0), (0.9, 0), (0.95, 0.05), (0.95, 0.45), (0.9, 0.5), (0.0, 0.5)], 32)
    ob = common.mesh_object("seiro", body, m)
    band = common.bm_lathe([(0.96, 0.1), (0.98, 0.12), (0.98, 0.38), (0.96, 0.4)], 32)
    ob2 = common.mesh_object("band", band, rim)
    cam = common.oblique_camera(1.0)
    common.fit_camera(cam, [ob, ob2], margin=1.1)
    common.render_to(os.path.join(out, "food_kagomushi.png"))
