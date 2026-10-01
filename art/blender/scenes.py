"""背景と生き物：夜の屋台（奥の町並み・手前のカウンター・行事の飾り）、町の地図、ミニゲームの背景、魚・獣・虫。"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

import common
from common import (link, new_material, hex_rgb, bm_icosphere, bm_tube, transform_bm, mesh_object, rng_for)


# ---------------------------------------------------------------------------
# 小さな道具
# ---------------------------------------------------------------------------
def M(color, rough=0.7, emit=0.0, name=None):
    name = name or "sc_%s_%d_%d" % (color.strip("#"), int(rough * 10), int(emit * 10))
    m = bpy.data.materials.get(name)
    if m:
        return m
    m, nt, bsdf = new_material(name, color, roughness=rough)
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(color), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit
    return m


def noiseM(name, stops, scale=6.0):
    return common.cached_material(name, lambda n: common.object_noise_material(n, stops, scale=scale, roughness=0.8))


def put(bm, mat, name="obj"):
    return mesh_object(name, bm, mat)


def cube(sx, sy, sz, loc, rz=0.0, rx=0.0, ry=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    transform_bm(bm, scale=(sx, sy, sz), rot_z=rz, rot_x=rx, rot_y=ry, loc=loc)
    return bm


def cyl(r, h, loc, seg=16, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    transform_bm(bm, loc=(loc[0], loc[1], loc[2] + h / 2))
    return bm


def ball(r, loc, sx=1, sy=1, sz=1, sub=2):
    bm = bm_icosphere(r, sub)
    transform_bm(bm, scale=(sx, sy, sz), loc=loc)
    return bm


def point_light(loc, color=(1.0, 0.7, 0.4), power=80, radius=0.2):
    ld = bpy.data.lights.new("P", "POINT")
    ld.energy = power
    ld.color = color
    ld.shadow_soft_size = radius
    ld.use_shadow = False   # 提灯の影が壁に線のように映らないように
    ob = link(bpy.data.objects.new("P", ld))
    ob.location = loc
    return ob


def persp_camera(loc, look, lens=30):
    cd = bpy.data.cameras.new("Cam")
    cd.lens = lens
    ob = link(bpy.data.objects.new("Cam", cd))
    ob.location = loc
    ob.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = ob
    return ob


def night_world(strength=0.35, color=(0.3, 0.36, 0.6)):
    common.add_night_world(color=color, strength=strength)


def lantern(x, y, z, label_mat=None):
    """赤い提灯（光る）＋ 明かり。"""
    put(ball(0.26, (x, y, z), 1, 1, 1.3, 3), M("#f24a2a", 0.5, 2.2), "chochin")
    put(cyl(0.2, 0.06, (x, y, z + 0.3)), M("#1c1220"), "chochin_top")
    put(cyl(0.2, 0.06, (x, y, z - 0.38)), M("#1c1220"), "chochin_bot")
    for k in (-1, 0, 1):
        put(cyl(0.268, 0.012, (x, y, z + k * 0.14)), M("#b8323a"), "rib")
    put(cyl(0.012, 0.5, (x, y, z + 0.33)), M("#1c1220"), "cord")
    point_light((x, y - 0.35, z - 0.1), power=120, radius=0.3)


# ---------------------------------------------------------------------------
# 夜の屋台：奥の町並み（bg）と手前のカウンター（fg）。customers は間に立つ
# ---------------------------------------------------------------------------
STALL_PX = (256, 144)


def build_street(fest=None):
    rng = rng_for("street")
    wood, dark = noiseM("wood_dark", [(0, "#5a3218"), (0.6, "#2e1a12"), (1, "#1c1220")], 3), M("#1c1220")
    roof = noiseM("roof", [(0, "#4a4658"), (1, "#172b58")], 8)
    # 地面（土の道）
    put(cube(40, 30, 0.1, (0, 12, -0.05)), noiseM("dirt", [(0, "#76726a"), (0.5, "#4a4658"), (1, "#2e1a12")], 2), "ground")
    # 向かいの町家
    for i in range(-5, 6):
        x = i * 2.3
        h = 2.6 + rng.uniform(-0.2, 0.3)
        put(cube(2.2, 1.6, h, (x, 8.0, h / 2)), wood, "house")
        put(cube(2.5, 2.0, 0.25, (x, 7.7, h + 0.05), rx=0.35), roof, "roof")
        put(cube(2.4, 0.2, 0.2, (x, 7.0, h * 0.62)), roof, "eave")
        # 障子の明かり
        if rng.random() < 0.75:
            put(cube(1.1, 0.05, 0.8, (x + rng.uniform(-0.3, 0.3), 7.19, h * 0.35)), M("#ffe6b0", 0.5, 1.4 + rng.random()), "shoji")
            for k in range(3):
                put(cube(0.03, 0.06, 0.8, (x - 0.35 + k * 0.35, 7.17, h * 0.35)), dark, "kumiko")
        if rng.random() < 0.4:
            put(cube(0.9, 0.05, 0.7, (x + 0.2, 7.15, h * 0.72)), M("#243f7a"), "noren_house")
    # 遠くの両国橋
    for k in range(14):
        a = k / 13
        put(cube(1.6, 0.3, 0.2, (-14 + k * 1.6, 20, 2.2 + math.sin(a * math.pi) * 1.8)), M("#172b58"), "bridge")
        if k % 2 == 0:
            put(cube(0.15, 0.2, 2.2 + math.sin(a * math.pi) * 1.8, (-14 + k * 1.6, 20, (2.2 + math.sin(a * math.pi) * 1.8) / 2)), M("#172b58"), "pier")
    # 柳
    put(cyl(0.12, 3.0, (-4.8, 5.5, 0)), wood, "willow")
    for k in range(9):
        a = k / 9 * 2 * math.pi
        pts = [(-4.8 + math.cos(a) * 0.2 * t, 5.5 + math.sin(a) * 0.2 * t, 3.2 - t * 0.55) for t in range(5)]
        put(bm_tube(pts, [0.08] * 5, 5), M("#1f6a2c"), "willow_leaf")
    # 月と星
    moon_big = fest == "tsukimi"
    put(ball(1.5 if moon_big else 0.8, (4.5, 26, 8.2 if moon_big else 12)), M("#ffe6b0", 0.4, 3.0), "moon")
    for k in range(40):
        put(ball(0.05, (rng.uniform(-18, 18), 30, rng.uniform(6, 16)), sub=1), M("#fffaf0", 0.4, 2.0), "star")


def build_stall_frame():
    wood = noiseM("wood_stall", [(0, "#b87838"), (0.6, "#8c5228"), (1, "#5a3218")], 4)
    for s in (-1, 1):
        put(cyl(0.12, 3.6, (2.7 * s, -1.2, 0)), wood, "post")
    put(cube(6.2, 0.3, 0.3, (0, -1.2, 3.35)), wood, "beam")
    put(cube(6.8, 1.6, 0.12, (0, -1.6, 3.6), rx=-0.25), noiseM("roof_stall", [(0, "#5a3218"), (1, "#2e1a12")], 6), "roof")
    for s in (-1, 1):
        lantern(1.95 * s, -1.05, 2.72)


def build_counter():
    top = noiseM("counter_top", [(0, "#dca24a"), (0.5, "#b87838"), (1, "#8c5228")], 3)
    front = noiseM("counter_front", [(0, "#8c5228"), (1, "#5a3218")], 3)
    put(cube(6.4, 0.9, 0.12, (0, -1.35, 0.98)), top, "counter_top")
    put(cube(6.4, 0.1, 1.0, (0, -0.92, 0.46)), front, "counter_front")
    for k in range(-3, 4):
        put(cube(0.04, 0.12, 0.98, (k * 0.9, -0.87, 0.46)), M("#5a3218"), "plank")
    # 七味の壺と箸立て、小皿
    put(cyl(0.14, 0.26, (2.2, -1.25, 1.04), r2=0.1), M("#b8323a"), "shichimi")
    put(cyl(0.12, 0.3, (-2.3, -1.3, 1.04)), M("#dca24a"), "hashi")
    for k in range(5):
        put(cyl(0.012, 0.35, (-2.33 + (k % 3) * 0.03, -1.3 + (k // 3) * 0.03, 1.2)), M("#f0e6d2"), "hashi_s")


def build_festival(fest):
    rng = rng_for("fest_" + fest)
    if fest == "hanami":
        for s in (-1, 1):
            pts = [(3.4 * s - 1.2 * s * t, -0.6 + t * 0.4, 3.5 - t * 0.35) for t in range(5)]
            put(bm_tube(pts, [0.07, 0.06, 0.05, 0.04, 0.03], 6), M("#5a3218"), "branch")
            for k in range(26):
                t = rng.uniform(0, 4)
                col = "#fffaf0" if k % 3 else "#f6c39c"
                put(ball(0.13, (3.4 * s - 1.2 * s * t + rng.uniform(-0.3, 0.3), -0.6 + t * 0.4, 3.5 - t * 0.35 + rng.uniform(-0.3, 0.2)), sub=1), M(col, 0.6, 1.2), "blossom")
        for k in range(30):
            put(ball(0.05, (rng.uniform(-3, 3), rng.uniform(0, 5), rng.uniform(0.5, 3)), 1, 1, 0.3, 1), M("#fffaf0", 0.6, 1.2), "petal")
    elif fest == "hatsugatsuo":
        put(cyl(0.05, 3.2, (-3.3, 1.0, 0)), M("#8c5228"), "pole")
        put(cube(0.9, 0.05, 2.0, (-2.8, 1.0, 2.1)), M("#f24a2a"), "banner")
        put(ball(0.35, (-2.8, 0.96, 2.4), 1.8, 0.4, 0.6), M("#34569a"), "bonito_mark")
    elif fest == "kawabiraki":
        for (cx, cz, col) in ((-5, 8.5, "#f5b860"), (3, 9.5, "#f24a2a"), (8, 7.5, "#a8e05a")):
            for k in range(28):
                a = k / 28 * 2 * math.pi
                for r in (0.8, 1.6, 2.2):
                    put(ball(0.1, (cx + math.cos(a) * r, 22, cz + math.sin(a) * r), sub=1), M(col, 0.4, 5.0), "spark")
    elif fest == "doyo":
        put(cyl(0.05, 3.2, (3.3, 1.0, 0)), M("#8c5228"), "pole")
        put(cube(0.9, 0.05, 2.0, (2.8, 1.0, 2.1)), M("#c42618"), "banner")
        cu = bpy.data.curves.new("u", "FONT")
        cu.body = "う"
        font_path = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "YujiSyuku-Regular.ttf")
        cu.font = bpy.data.fonts.load(font_path)
        cu.size = 1.2
        cu.align_x = "CENTER"
        ob = link(bpy.data.objects.new("u", cu))
        ob.location = (2.8, 0.97, 1.8)
        ob.rotation_euler = (math.pi / 2, 0, 0)
        ob.data.materials.append(M("#fffaf0", 0.5, 0.5))
    elif fest == "tsukimi":
        # 三方にのせた月見団子とすすき
        put(cube(0.6, 0.6, 0.25, (2.3, -1.2, 1.16)), M("#f0e6d2"), "sanbo")
        for lv, n in ((0, 3), (1, 2), (2, 1)):
            for k in range(n):
                put(ball(0.1, (2.3 - (n - 1) * 0.1 + k * 0.2, -1.2, 1.4 + lv * 0.17)), M("#fffaf0", 0.6), "dango")
        for k in range(9):
            a = rng.uniform(-0.5, 0.5)
            pts = [(-2.7 + a * t * 0.3, -0.9, 0.3 + t * 0.55) for t in range(6)]
            put(bm_tube(pts, [0.02] * 6, 4), M("#dca24a"), "susuki")
            put(ball(0.1, (pts[-1][0], -0.9, pts[-1][2]), 0.5, 0.5, 1.6), M("#f0e6d2", 0.8), "susuki_top")


def job_stall(out):
    fests = [None, "hanami", "hatsugatsuo", "kawabiraki", "doyo", "tsukimi"]
    for fest in fests:
        common.reset_scene()
        common.set_resolution(STALL_PX[0] * 4, STALL_PX[1] * 4)
        bpy.context.scene.cycles.samples = 48
        night_world()
        ld = bpy.data.lights.new("Moon", "SUN")
        ld.energy = 0.6
        ld.color = (0.6, 0.7, 1.0)
        moon = link(bpy.data.objects.new("Moon", ld))
        moon.rotation_euler = (math.radians(50), 0, math.radians(150))
        build_street(fest)
        build_stall_frame()
        if fest:
            build_festival(fest)
        persp_camera((0, -5.4, 2.1), (0, 2.5, 1.35), lens=28)
        name = "stall_bg" + ("_" + fest if fest else "")
        common.render_to(os.path.join(out, name + ".png"))
        if fest is None:
            # 手前のカウンターだけ（ほかは隠す）
            for ob in bpy.data.objects:
                if ob.type == "MESH":
                    ob.hide_render = True
            build_counter()
            common.render_to(os.path.join(out, "stall_fg.png"))


# ---------------------------------------------------------------------------
# 町の地図（仕入れ先）。地名の位置を JSON に書き出す
# ---------------------------------------------------------------------------
MAP_PX = (256, 160)
PLACES = {
    "uogashi": (1.5, 1.5, 0.3), "ipponzuri": (7.5, -4.0, 0.2), "satoyama": (-7.5, 5.0, 0.6), "yama": (-3.0, 8.0, 1.6),
    "nagasaki": (9.0, 6.5, 0.2), "aomono": (-2.0, 0.2, 0.3), "komeya": (-0.6, -1.5, 0.3), "tofuya": (-3.6, -1.2, 0.3),
    "toriya": (-4.5, 1.2, 0.3), "yagenbori": (2.8, -1.4, 0.3), "momonjiya": (-5.8, 3.0, 0.3), "stall": (4.0, 0.8, 0.3),
}


def job_map(out):
    common.reset_scene()
    common.set_resolution(MAP_PX[0] * 4, MAP_PX[1] * 4)
    bpy.context.scene.cycles.samples = 32
    common.add_lantern_light(direction_from=(-1, -0.6, 1.6), strength=3.2, color=(1.0, 0.93, 0.8))
    night_world(strength=0.9, color=(0.6, 0.65, 0.8))
    rng = rng_for("map")
    put(cube(26, 20, 0.2, (0, 2, -0.1)), noiseM("map_ground", [(0, "#a8e05a"), (0.5, "#46b03a"), (1, "#1f6a2c")], 1.5), "land")
    # 隅田川（ななめ）と江戸湾
    for k in range(30):
        t = k / 29
        put(cube(1.3, 1.3, 0.05, (6.5 - t * 3.5 + math.sin(t * 5) * 0.6, 10 - t * 14, 0.02), rz=0.4), M("#34569a", 0.3), "river")
    put(cube(14, 6, 0.06, (7, -7, 0.02)), noiseM("sea", [(0, "#5070b0"), (1, "#243f7a")], 3), "bay")
    # 両国橋
    put(cube(3.2, 0.5, 0.15, (4.3, 0.8, 0.25), rz=0.35), M("#b87838"), "bridge")
    # 町（家の固まり）
    for k in range(70):
        x, y = rng.uniform(-6.5, 3.5), rng.uniform(-3.5, 3.5)
        if (x - 4) ** 2 + (y - 0.8) ** 2 < 1.5:
            continue
        put(cube(0.7, 0.5, 0.35, (x, y, 0.17)), M("#f0e6d2"), "house")
        put(cube(0.8, 0.6, 0.12, (x, y, 0.42), rx=0.2), M("#4a4658"), "roof")
    # 里山と山
    for k in range(9):
        put(ball(1.4, (-8 + k * 0.7, 5.5 + (k % 3) * 0.9, 0.0), 1.2, 1.0, 0.6), M("#1f6a2c"), "hill")
    for k in range(4):
        put(cyl(1.4, 2.4, (-4.5 + k * 1.6, 9.0, 0), seg=10, r2=0.1), M("#172b58"), "mountain")
    # 田んぼ
    for k in range(6):
        put(cube(1.1, 0.8, 0.05, (-8.5 + (k % 3) * 1.3, 2.2 + (k // 3) * 1.0, 0.03)), M("#dca24a"), "paddy")
    # 長崎行きの船
    put(cube(1.2, 0.4, 0.3, (9.0, 6.5, 0.15)), M("#8c5228"), "ship")
    put(cube(0.05, 0.6, 0.9, (9.0, 6.5, 0.7)), M("#fffaf0"), "sail")
    cam = common.oblique_camera(22.0, elevation_deg=55)
    cam.location = cam.location + Vector((0, 2.0, 0))
    common.render_to(os.path.join(out, "map.png"))
    # 地名の画面上の位置（0〜1）
    scene = bpy.context.scene
    pos = {}
    for k, p in PLACES.items():
        v = world_to_camera_view(scene, cam, Vector(p))
        pos[k] = [round(v.x, 4), round(1 - v.y, 4)]
    with open(os.path.join(out, "map_places.json"), "w", encoding="utf-8") as f:
        json.dump(pos, f)


# ---------------------------------------------------------------------------
# ミニゲームの背景（ゲームの座標と合わせる：画面の1ドット = 0.1）
# ---------------------------------------------------------------------------
GAME_PX = (192, 128)


def _px(x, y, z=0.0):
    """ゲームの座標（左上が 0,0、下が +y）→ Blender の座標（真上から見る）。"""
    return (x * 0.1 - 9.6, -(y * 0.1 - 6.4), z)


def _top_cam():
    cd = bpy.data.cameras.new("Cam")
    cd.type = "ORTHO"
    cd.ortho_scale = 19.2
    ob = link(bpy.data.objects.new("Cam", cd))
    ob.location = (0, 0, 20)
    bpy.context.scene.camera = ob
    return ob


def _front_cam():
    """横から見る（x = 右、z = 上）。ゲームの y が下向きなので、z = -(y * 0.1 - 6.4)"""
    cd = bpy.data.cameras.new("Cam")
    cd.type = "ORTHO"
    cd.ortho_scale = 19.2
    ob = link(bpy.data.objects.new("Cam", cd))
    ob.location = (0, -30, 0)
    ob.rotation_euler = (math.pi / 2, 0, 0)
    bpy.context.scene.camera = ob
    return ob


def _fx(x, y, d=0.0):
    return (x * 0.1 - 9.6, d, -(y * 0.1 - 6.4))


def _game_scene(samples=24):
    common.reset_scene()
    common.set_resolution(GAME_PX[0] * 4, GAME_PX[1] * 4)
    bpy.context.scene.cycles.samples = samples


def job_minigames(out):
    rng = rng_for("minigames")
    # --- 魚河岸の競り（正面）：板の間・木箱・のれん ---
    _game_scene()
    common.add_lantern_light(direction_from=(-0.8, -1.5, 1.2), strength=3.0, color=(1.0, 0.9, 0.75))
    night_world(strength=0.6, color=(0.7, 0.7, 0.8))
    put(cube(20, 1, 14, (0, 4, 0)), noiseM("auc_wall", [(0, "#8c5228"), (1, "#5a3218")], 1.2), "wall")
    for k in range(-4, 5):
        put(cube(0.15, 0.2, 14, (k * 2.2, 3.4, 0)), M("#2e1a12"), "beam")
    for k in range(-3, 4):
        put(cube(1.6, 0.2, 1.2, (k * 2.6, 3.2, 4.0)), M("#fffaf0"), "sign")
        put(cube(0.12, 0.25, 0.8, (k * 2.6, 3.1, 4.0)), M("#1c1220"), "sign_ink")
    put(cube(20, 6, 0.3, (0, 1, -4.2)), noiseM("auc_floor", [(0, "#dca24a"), (1, "#8c5228")], 2), "floor")
    for s in (-1, 1):
        for k in range(3):
            put(cube(1.8, 1.2, 0.9, (7.2 * s, -1 + k * 0.2, -3.4 + k * 1.0)), noiseM("crate", [(0, "#b87838"), (1, "#5a3218")], 3), "crate")
            put(cube(1.7, 1.1, 0.1, (7.2 * s, -1.05 + k * 0.2, -2.9 + k * 1.0)), M("#d6ccb8", 0.3), "ice")
    put(cube(9, 3, 0.4, (0, -0.5, -2.2)), noiseM("board", [(0, "#dca24a"), (1, "#b87838")], 2), "board")
    for s in (-1, 1):
        lantern(5.5 * s, 1.0, 4.8)
    _front_cam()
    common.render_to(os.path.join(out, "bg_auction.png"))

    # --- 江戸湾の一本釣り（横）：朝焼けの空・富士山・海 ---
    _game_scene()
    common.add_lantern_light(direction_from=(-0.5, -1.2, 0.8), strength=3.0, color=(1.0, 0.85, 0.7))
    night_world(strength=1.0, color=(0.9, 0.75, 0.7))
    put(cube(19.2, 0.5, 4.0, _fx(96, 20, 10)), noiseM("sky", [(0, "#ffe6b0"), (0.6, "#f5b860"), (1, "#5070b0")], 0.6), "sky")
    fuji = bmesh.new()
    bmesh.ops.create_cone(fuji, cap_ends=True, segments=24, radius1=3.2, radius2=0.5, depth=2.2)
    transform_bm(fuji, scale=(1, 0.3, 1), loc=_fx(150, 29, 8))
    put(fuji, M("#34569a"), "fuji")
    snow = bmesh.new()
    bmesh.ops.create_cone(snow, cap_ends=True, segments=24, radius1=1.1, radius2=0.5, depth=0.7)
    transform_bm(snow, scale=(1, 0.3, 1), loc=_fx(150, 23, 7.9))
    put(snow, M("#fffaf0"), "snow")
    put(cube(19.2, 0.5, 8.8, _fx(96, 84, 6)), noiseM("sea_side", [(0, "#34569a"), (0.5, "#243f7a"), (1, "#0d1830")], 2), "sea")
    for k in range(20):
        put(cube(rng.uniform(0.3, 0.8), 0.1, 0.06, _fx(rng.uniform(0, 192), rng.uniform(44, 120), 5)), M("#5070b0", 0.3), "wave")
    _front_cam()
    common.render_to(os.path.join(out, "bg_fishing.png"))

    # --- 田んぼと里山（真上）：forage.js の座標に合わせる ---
    _game_scene()
    common.add_lantern_light(direction_from=(-1, 0.5, 1.5), strength=3.2, color=(1.0, 0.95, 0.85))
    night_world(strength=1.0, color=(0.8, 0.85, 0.9))
    put(cube(19.2, 12.8, 0.1, _px(96, 64, -0.05)), M("#dca24a"), "field")
    put(cube(19.2, 3.0, 0.3, _px(96, 15, 0)), noiseM("hills", [(0, "#46b03a"), (1, "#1f6a2c")], 2), "hills")
    put(cube(19.2, 1.2, 0.15, _px(96, 62, 0)), noiseM("path", [(0, "#dca24a"), (1, "#b87838")], 3), "path")
    for k in range(60):
        put(cube(0.08, 0.3, 0.2, _px(rng.uniform(2, 190), rng.uniform(70, 126), 0.1)), M("#f4cc62"), "rice")
    put(cube(8.2, 2.8, 0.1, _px(151, 114, 0.02)), noiseM("pond", [(0, "#5070b0"), (1, "#243f7a")], 3), "pond")
    for tx in (28, 96, 164):
        put(cyl(0.2, 1.5, _px(tx, 44, 0)), M("#5a3218"), "trunk")
        put(ball(1.3, _px(tx, 28, 1.5), 1.0, 0.8, 0.6), noiseM("canopy", [(0, "#a8e05a"), (0.5, "#46b03a"), (1, "#1f6a2c")], 4), "canopy")
    _top_cam()
    common.render_to(os.path.join(out, "bg_forage.png"))

    # --- 山の追い込み（真上）：hunt.js の罠 x 78〜114, y 6〜22 ---
    _game_scene()
    common.add_lantern_light(direction_from=(-1, 0.6, 1.5), strength=3.0, color=(1.0, 0.95, 0.85))
    night_world(strength=1.0, color=(0.8, 0.85, 0.9))
    put(cube(19.2, 12.8, 0.1, _px(96, 64, -0.05)), noiseM("grass", [(0, "#a8e05a"), (0.5, "#46b03a"), (1, "#1f6a2c")], 3), "grass")
    for k in range(26):
        x, y = rng.uniform(0, 192), rng.uniform(0, 24)
        if 70 < x < 122:
            continue
        put(ball(rng.uniform(0.6, 1.0), _px(x, y, 0.8)), noiseM("forest", [(0, "#46b03a"), (1, "#1f6a2c")], 4), "tree")
    for k in range(8):
        put(ball(0.5, _px(rng.uniform(0, 192), rng.uniform(110, 128), 0.4), 1, 1, 0.5), M("#1f6a2c"), "bush")
    put(cube(3.6, 1.6, 0.05, _px(96, 14, 0.01)), M("#dca24a"), "trap_floor")
    for fx in range(72, 121, 4):
        if 78 < fx < 114:
            continue
        put(cyl(0.12, 1.0, _px(fx, 14, 0)), M("#8c5228"), "fence")
    put(cube(4.8, 0.15, 0.15, _px(96, 6, 1.0)), M("#8c5228"), "fence_top")
    _top_cam()
    common.render_to(os.path.join(out, "bg_hunt.png"))

    # --- 長崎の抜け荷（横・夜）：smuggle.js の道 y=100、船 x=172、荷車 x=22 ---
    _game_scene(32)
    night_world(strength=0.9, color=(0.35, 0.42, 0.75))
    ld = bpy.data.lights.new("Moon", "SUN"); ld.energy = 1.2; ld.color = (0.6, 0.7, 1.0)
    moonl = link(bpy.data.objects.new("Moon", ld)); moonl.rotation_euler = (math.radians(60), 0, math.radians(20))
    put(ball(0.7, _fx(150, 18, 12)), M("#ffe6b0", 0.4, 3.0), "moon")
    put(cube(19.2, 0.5, 6.0, _fx(96, 30, 10)), M("#0d1830"), "sky")
    put(cube(19.2, 0.5, 3.0, _fx(96, 75, 8)), noiseM("harbor", [(0, "#243f7a"), (1, "#0d1830")], 3), "sea")
    put(cube(7, 0.5, 1.6, _fx(75, 52, 7)), M("#172b58"), "dejima")
    for k in range(5):
        put(cube(0.6, 0.3, 0.4, _fx(50 + k * 12, 45, 6.9)), M("#ffe6b0", 0.5, 1.5), "window")
    put(cube(19.2, 0.5, 2.0, _fx(96, 104, 3)), noiseM("stone", [(0, "#76726a"), (1, "#4a4658")], 4), "path")
    put(cube(3.2, 0.5, 0.8, _fx(172, 80, 2)), M("#5a3218"), "ship")
    put(cube(0.1, 0.5, 2.4, _fx(174, 64, 1.9)), M("#76726a"), "mast")
    put(cube(1.2, 0.3, 1.6, _fx(168, 64, 1.8)), M("#d6ccb8"), "sail")
    put(cube(1.8, 0.5, 0.8, _fx(22, 95, 1)), M("#8c5228"), "cart")
    for bx in (60, 108, 150):
        put(cyl(0.35, 0.9, _fx(bx + 3, 92, 1)), M("#b87838"), "barrel") if False else put(cube(0.7, 0.5, 0.9, _fx(bx + 3, 89, 1)), M("#b87838"), "barrel")
    point_light(_fx(80, 50, 2), color=(1.0, 0.8, 0.5), power=40)
    _front_cam()
    common.render_to(os.path.join(out, "bg_smuggle.png"))


# ---------------------------------------------------------------------------
# 生き物（競りの魚・一本釣りの魚・山の獣・里山の虫と草）
# ---------------------------------------------------------------------------
FISH = {
    # 競りの魚（まな板の上、斜め上から）96×64
    "a_tai":    dict(L=1.0, H=0.45, W=0.18, c=["#f6c39c", "#f0664e", "#b8323a"], fin="#f0664e"),
    "a_kisu":   dict(L=1.1, H=0.2, W=0.12, c=["#fffaf0", "#d6ccb8", "#aaa292"], fin="#f6c39c"),
    "a_katsuo": dict(L=1.1, H=0.34, W=0.2, c=["#d6ccb8", "#34569a", "#172b58"], fin="#243f7a", stripes=True),
    # 一本釣りの魚（横から）
    "s_aji":    dict(L=0.6, H=0.18, W=0.08, c=["#d6ccb8", "#aaa292", "#5070b0"], fin="#f4cc62"),
    "s_iwashi": dict(L=0.5, H=0.12, W=0.06, c=["#fffaf0", "#5070b0", "#243f7a"], fin="#aaa292"),
    "s_maguro": dict(L=1.1, H=0.34, W=0.2, c=["#d6ccb8", "#243f7a", "#0d1830"], fin="#f4cc62"),
    "s_unagi":  dict(L=1.1, H=0.08, W=0.07, c=["#dca24a", "#5a3218", "#2e1a12"], fin="#5a3218", eel=True),
    "s_nushi":  dict(L=1.8, H=0.6, W=0.34, c=["#d6ccb8", "#172b58", "#0d1830"], fin="#f4cc62"),
}


def build_fish(spec, wag=0.0):
    L, H, W = spec["L"], spec["H"], spec["W"]
    mat = common.cached_material("fish_%s" % spec["c"][1], lambda n: common.object_noise_material(n, [(0, spec["c"][0]), (0.5, spec["c"][1]), (1, spec["c"][2])], scale=3, roughness=0.3))
    objs = []
    if spec.get("eel"):
        pts = [(L * (t / 10 - 0.5), 0, math.sin(t * 0.9 + wag * 3) * H * 0.8) for t in range(11)]
        objs.append(put(bm_tube(pts, [H * (0.9 if t < 9 else 0.5) for t in range(11)], 8), mat, "eel"))
        objs.append(put(ball(H * 0.3, (-L * 0.45, -W * 0.8, H * 0.3)), M("#1c1220"), "eye"))
        return objs
    body = bm_icosphere(1, 3)
    transform_bm(body, scale=(L / 2, W / 2, H / 2))
    objs.append(put(body, mat, "body"))
    tail = bmesh.new()
    v = [tail.verts.new(p) for p in [(L * 0.45, 0, 0), (L * 0.72, 0, H * 0.45), (L * 0.72, 0, -H * 0.45)]]
    tail.faces.new(v)
    transform_bm(tail, rot_z=wag * 0.4, loc=(0, 0, 0))
    objs.append(put(tail, M(spec["fin"]), "tail"))
    dorsal = bmesh.new()
    v = [dorsal.verts.new(p) for p in [(-L * 0.15, 0, H * 0.45), (L * 0.2, 0, H * 0.4), (0.0, 0, H * 0.75)]]
    dorsal.faces.new(v)
    objs.append(put(dorsal, M(spec["fin"]), "dorsal"))
    if spec.get("stripes"):
        for k in range(4):
            objs.append(put(cube(0.03, W * 0.52, H * 0.3, (-L * 0.2 + k * 0.12, 0, -H * 0.12)), M("#aaa292"), "stripe"))
    objs.append(put(ball(H * 0.13, (-L * 0.36, -W * 0.45, H * 0.08)), M("#fffaf0", 0.2), "eye"))
    objs.append(put(ball(H * 0.08, (-L * 0.37, -W * 0.5, H * 0.08)), M("#1c1220", 0.2), "pupil"))
    return objs


def job_creatures(out):
    # 競りの魚：まな板にのせて斜め上から 96×64
    for key in ("a_tai", "a_kisu", "a_katsuo"):
        common.reset_scene()
        common.set_resolution(96 * 4, 64 * 4)
        common.add_lantern_light(direction_from=(-1, -1, 1.4), strength=3.4)
        night_world(strength=0.8, color=(0.7, 0.7, 0.8))
        objs = build_fish(FISH[key])
        for o in objs:
            o.rotation_euler = (math.pi / 2, 0, 0)   # 横向きに寝かせる
        cam = common.oblique_camera(1.6, elevation_deg=60)
        common.render_to(os.path.join(out, "fish_%s.png" % key[2:]))
    # 蛸・雲丹・鯨
    common.reset_scene(); common.set_resolution(96 * 4, 64 * 4)
    common.add_lantern_light(direction_from=(-1, -1, 1.4), strength=3.4); night_world(strength=0.8, color=(0.7, 0.7, 0.8))
    put(ball(0.28, (0, 0.05, 0.3), 1, 0.9, 1.1), M("#f0664e", 0.4), "head")
    for k in range(8):
        a = k / 8 * 2 * math.pi
        pts = [(math.cos(a) * (0.15 + t * 0.12), math.sin(a) * (0.15 + t * 0.12), 0.08 + 0.05 * math.sin(t + k)) for t in range(6)]
        put(bm_tube(pts, [0.07 - t * 0.01 for t in range(6)], 6), M("#b8323a", 0.4), "arm")
    for s in (-1, 1):
        put(ball(0.045, (0.1 * s, -0.22, 0.34)), M("#1c1220"), "eye")
    common.oblique_camera(1.6, elevation_deg=60)
    common.render_to(os.path.join(out, "fish_tako.png"))
    common.reset_scene(); common.set_resolution(96 * 4, 64 * 4)
    common.add_lantern_light(direction_from=(-1, -1, 1.4), strength=3.4); night_world(strength=0.8, color=(0.7, 0.7, 0.8))
    put(ball(0.32, (0, 0, 0.2), 1, 1, 0.7), M("#172b58", 0.4), "uni")
    rng = rng_for("uni")
    for k in range(70):
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0, 1))).normalized()
        p0 = Vector((0, 0, 0.2)) + d * 0.28
        put(bm_tube([tuple(p0), tuple(p0 + d * 0.2)], [0.015, 0.004], 4), M("#0d1830"), "spine")
    put(ball(0.14, (0, -0.05, 0.36), 1.2, 1, 0.4), M("#f5b860", 0.4), "roe")
    common.oblique_camera(1.6, elevation_deg=60)
    common.render_to(os.path.join(out, "fish_uni.png"))
    common.reset_scene(); common.set_resolution(96 * 4, 64 * 4)
    common.add_lantern_light(direction_from=(-1, -1, 1.4), strength=3.4); night_world(strength=0.8, color=(0.7, 0.7, 0.8))
    put(ball(0.7, (0, 0, 0.3), 1.0, 0.45, 0.4), M("#243f7a", 0.4), "whale")
    put(ball(0.6, (0.05, -0.02, 0.2), 0.95, 0.4, 0.25), M("#d6ccb8", 0.4), "belly")
    tail = bmesh.new(); v = [tail.verts.new(p) for p in [(0.65, 0, 0.3), (0.95, 0.3, 0.35), (0.95, -0.3, 0.35)]]; tail.faces.new(v)
    put(tail, M("#243f7a"), "fluke")
    put(ball(0.035, (-0.45, -0.2, 0.38)), M("#1c1220"), "eye")
    common.oblique_camera(1.9, elevation_deg=55)
    common.render_to(os.path.join(out, "fish_kujira.png"))

    # 一本釣りの魚（横から、しっぽを振る2コマ）
    sizes = {"s_aji": (24, 12), "s_iwashi": (20, 10), "s_maguro": (44, 18), "s_unagi": (44, 12), "s_nushi": (72, 28)}
    for key, (w, h) in sizes.items():
        for f in range(2):
            common.reset_scene()
            common.set_resolution(w * 4, h * 4)
            common.add_lantern_light(direction_from=(-0.6, -1, 1.2), strength=3.4)
            night_world(strength=0.8, color=(0.7, 0.75, 0.9))
            build_fish(FISH[key], wag=-1 if f else 1)
            cd = bpy.data.cameras.new("Cam"); cd.type = "ORTHO"; cd.ortho_scale = FISH[key]["L"] * 1.6
            cam = link(bpy.data.objects.new("Cam", cd)); cam.location = (0.1 * FISH[key]["L"], -10, 0); cam.rotation_euler = (math.pi / 2, 0, 0)
            bpy.context.scene.camera = cam
            common.render_to(os.path.join(out, "sea_%s_%d.png" % (key[2:], f)))

    # 山の獣（真上から、歩く2コマ）
    for key, (w, h, col, big) in {"boar": (24, 18, "#5a3218", 1.0), "deer": (24, 18, "#b87838", 1.0), "nushi": (40, 30, "#2e1a12", 1.7)}.items():
        for f in range(2):
            common.reset_scene()
            common.set_resolution(w * 4, h * 4)
            common.add_lantern_light(direction_from=(-1, 0.6, 1.5), strength=3.2)
            night_world(strength=0.9, color=(0.8, 0.85, 0.9))
            b = big
            put(ball(0.5 * b, (0, 0, 0.3), 1.0, 0.6, 0.55), noiseM("fur_" + key, [(0, col), (1, "#1c1220")], 6), "body")
            put(ball(0.25 * b, (-0.5 * b, 0, 0.35), 1.2, 0.8, 0.8), noiseM("fur_" + key, [(0, col), (1, "#1c1220")], 6), "head")
            if key == "deer":
                for s in (-1, 1):
                    put(bm_tube([(-0.6, 0.1 * s, 0.5), (-0.7, 0.3 * s, 0.9), (-0.8, 0.4 * s, 1.0)], [0.03] * 3, 4), M("#dca24a"), "antler")
            else:
                for s in (-1, 1):
                    put(bm_tube([(-0.75 * b, 0.08 * s, 0.25), (-0.85 * b, 0.14 * s, 0.35)], [0.03 * b, 0.015 * b], 4), M("#fffaf0"), "tusk")
            for s in (-1, 1):
                for k in (-1, 1):
                    put(ball(0.1 * b, (0.25 * k * b + (0.08 * s * (1 if f else -1)), 0.28 * s * b, 0.08)), M("#1c1220"), "leg")
            cd = bpy.data.cameras.new("Cam"); cd.type = "ORTHO"; cd.ortho_scale = 1.9 * b
            cam = link(bpy.data.objects.new("Cam", cd)); cam.location = (0, 0, 10); bpy.context.scene.camera = cam
            common.render_to(os.path.join(out, "animal_%s_%d.png" % (key, f)))

    # 里山：イナゴ・蜂の巣・山椒・マコモダケ（真上）16×16
    items = {
        "inago": lambda: [put(ball(0.25, (0, 0, 0.1), 1.0, 0.35, 0.3), M("#46b03a")), put(bm_tube([(0.1, 0.1, 0.1), (0.3, 0.25, 0.15), (0.45, 0.2, 0.0)], [0.03] * 3, 4), M("#1f6a2c")),
                          put(bm_tube([(0.1, -0.1, 0.1), (0.3, -0.25, 0.15), (0.45, -0.2, 0.0)], [0.03] * 3, 4), M("#1f6a2c"))],
        "hachi": lambda: [put(ball(0.35, (0, 0, 0.3), 0.8, 0.8, 1.1), noiseM("hive", [(0, "#dca24a"), (0.5, "#b87838"), (1, "#5a3218")], 12))],
        "sansho": lambda: [put(ball(0.18, (math.cos(k * 1.26) * 0.25, math.sin(k * 1.26) * 0.25, 0.1), 1, 0.6, 0.3), M("#46b03a")) for k in range(5)] + [put(ball(0.05, (0.05 * k - 0.1, 0.0, 0.2)), M("#f24a2a")) for k in range(5)],
        "makomo": lambda: [put(ball(0.12, (0, 0, 0.1), 3.0, 1.0, 1.0), M("#f0e6d2")), put(ball(0.08, (-0.35, 0, 0.1), 3.0, 0.5, 0.5), M("#46b03a")), put(ball(0.03, (0.05, 0, 0.2)), M("#2e1a12"))],
    }
    for key, fn in items.items():
        common.reset_scene()
        common.set_resolution(24 * 4, 24 * 4)
        common.add_lantern_light(direction_from=(-1, 0.6, 1.5), strength=3.2)
        night_world(strength=0.9, color=(0.8, 0.85, 0.9))
        fn()
        cd = bpy.data.cameras.new("Cam"); cd.type = "ORTHO"; cd.ortho_scale = 1.1
        cam = link(bpy.data.objects.new("Cam", cd)); cam.location = (0, 0, 10); bpy.context.scene.camera = cam
        common.render_to(os.path.join(out, "forage_%s.png" % key))


# ---------------------------------------------------------------------------
# オープニングの紙芝居（5枚）
# ---------------------------------------------------------------------------
STORY_PX = (240, 160)


def _truck():
    """現代のキッチンカー「TACO TUESDAY」。"""
    put(cube(3.2, 1.6, 1.6, (0.3, 1.0, 1.25)), M("#f4cc62", 0.4), "truck_body")
    put(cube(1.2, 1.5, 1.2, (-1.9, 1.0, 1.05)), M("#f4cc62", 0.4), "truck_cab")
    put(cube(0.9, 1.52, 0.5, (-2.0, 1.0, 1.35)), M("#34569a", 0.2, 0.3), "window")
    put(cube(2.0, 0.05, 0.8, (0.4, 0.19, 1.35)), M("#1c1220", 0.3), "service")
    put(cube(2.4, 0.9, 0.06, (0.4, -0.2, 2.0), rx=0.35), M("#f24a2a"), "awning")
    for k in range(5):
        put(cube(0.2, 0.92, 0.07, (-0.5 + k * 0.45, -0.2, 2.01), rx=0.35), M("#fffaf0"), "stripe")
    put(cube(2.6, 0.05, 0.4, (0.3, 0.17, 2.3)), M("#c42618", 0.4, 0.6), "sign")
    for x in (-1.9, 1.2):
        put(cyl(0.35, 0.3, (x, 0.2, 0.35)), M("#1c1220"), "wheel")
    point_light((0.4, -0.3, 1.8), color=(1.0, 0.85, 0.6), power=150, radius=0.4)


def _tokyo():
    rng = rng_for("tokyo")
    put(cube(40, 30, 0.1, (0, 10, -0.05)), M("#4a4658"), "road")
    for i in range(-6, 7):
        h = rng.uniform(4, 9)
        put(cube(2.6, 2.0, h, (i * 3.0, 14, h / 2)), M("#172b58"), "bldg")
        for k in range(int(h / 0.8)):
            for j in range(3):
                if rng.random() < 0.45:
                    put(cube(0.35, 0.05, 0.3, (i * 3.0 - 0.8 + j * 0.8, 12.98, 0.6 + k * 0.8)), M("#ffe6b0", 0.5, 1.5), "win")
    point_light((0, -3, 4), color=(0.6, 0.7, 1.0), power=300, radius=1.0)


def _smoke(center, n=14, scale=1.0):
    rng = rng_for("smoke")
    for k in range(n):
        put(ball(rng.uniform(0.3, 0.6) * scale, (center[0] + rng.uniform(-1, 1) * scale, center[1], center[2] + rng.uniform(-0.6, 0.9) * scale)), M("#fffaf0", 0.9, 0.4), "smoke")


def job_story(out, textures):
    import people
    import noren
    panels = []

    def begin():
        common.reset_scene()
        common.set_resolution(STORY_PX[0] * 4, STORY_PX[1] * 4)
        bpy.context.scene.cycles.samples = 32
        night_world(strength=0.5)
        common.add_lantern_light(direction_from=(-1.0, -1.4, 1.3), strength=2.4)

    def person(key, loc, anim="wait", frame=0, face=None, rot=0.0, scale=1.0):
        p = people.Person(key)
        p.pose(anim, frame)
        if face:
            p.set_face(face)
        p.root.location = loc
        p.root.rotation_euler.z += rot
        s = p.root.scale[0] * scale
        p.root.scale = (s, s, s)
        return p

    # 1. 東京・両国、火曜日の夜。キッチンカーのマテオ
    begin(); _tokyo(); _truck()
    person("mateo", (1.8, -0.2, 0), "greet", 0)
    persp_camera((0.5, -7.5, 2.0), (0.2, 1.0, 1.5), lens=32)
    common.render_to(os.path.join(out, "story_1.png"))
    # 2. 最後の客（男の子に化けたポン吉）がタコスを食べる
    begin(); _tokyo(); _truck()
    person("mateo", (1.9, 0.0, 0), "wait", 0, face="happy")
    person("pon", (-0.6, -0.6, 0), "eat", 1, rot=0.5, scale=1.1)
    persp_camera((0.4, -6.0, 1.7), (0.4, 0.5, 1.2), lens=35)
    common.render_to(os.path.join(out, "story_2.png"))
    # 3. 頭に葉っぱ、どろん！
    begin(); _tokyo()
    person("pon", (0.0, -0.3, 0), "happy", 1, scale=1.3)
    _smoke((0.0, 0.2, 1.1), 22, 1.4)
    persp_camera((0.0, -6.0, 1.6), (0.0, 0.5, 1.3), lens=35)
    common.render_to(os.path.join(out, "story_3.png"))
    # 4. 江戸・両国広小路。屋台と「多幸寿」ののれん
    begin()
    build_street()
    build_stall_frame()
    paths = [os.path.join(textures, "noren_%d.png" % i) for i in range(3)]
    panels_ = noren.build(paths)
    for ob, rest, uu, vv in panels_:
        ob.location = (0, -1.25, 2.55)
        ob.scale = (1.15, 1.0, 0.55)
    for ob in bpy.data.objects:
        if ob.name.startswith("Pole"):
            ob.location = (0, -1.25, 2.55); ob.scale = (1.15, 1.0, 1.0)
    person("mateo", (-0.9, -2.2, 0), "worry", 0, face="worry", rot=0.3)
    person("pon", (0.9, -2.3, 0), "happy", 0, rot=-0.3)
    persp_camera((0, -8.0, 2.0), (0, 0.0, 1.6), lens=30)
    common.render_to(os.path.join(out, "story_4.png"))
    # 5. トウモロコシ粉は、残りわずか
    begin()
    build_street()
    build_stall_frame()
    build_counter()
    person("mateo", (0.0, -2.0, 0), "cook", 0, face="worry")
    put(cube(0.5, 0.35, 0.5, (0.9, -1.4, 1.3)), M("#f0e6d2", 0.9), "flour_bag")
    put(cube(0.3, 0.37, 0.12, (0.9, -1.4, 1.35)), M("#dca24a"), "bag_label")
    person("pon", (-1.4, -1.9, 0), "wait", 0, face="worry", scale=0.9)
    persp_camera((0, -6.2, 2.2), (0, -1.0, 1.4), lens=35)
    common.render_to(os.path.join(out, "story_5.png"))


# ---------------------------------------------------------------------------
# 夜の厨房：焼き場は3つの画面に分ける
#   七輪（丸い珪藻土の七輪を2つ、斜め上から）・油鍋（天ぷら鍋と油切りの網）・藁焼き（鉄の火鉢に藁、横から）
#   それぞれの置き場所（画面の 0〜1）は kitchen_slots.json に書き出し、ゲームはそれを使う
#   ほか：藁焼きの炎・木札・紐・捨て桶・薬味の鉢・たれの徳利
# ---------------------------------------------------------------------------
KVIEW_PX = (256, 160)


def _small_scene(w, h, samples=24):
    common.reset_scene()
    common.set_resolution(w * 4, h * 4)
    bpy.context.scene.cycles.samples = samples
    common.add_lantern_light(direction_from=(-1.0, -1.2, 1.4), strength=3.2)
    night_world(strength=0.7, color=(0.7, 0.72, 0.85))


def _proj(cam, p):
    v = world_to_camera_view(bpy.context.scene, cam, Vector(p))
    return [round(v.x, 4), round(1 - v.y, 4)]


def _counter(rng, w=16.0, d=9.0, z=0.0, tag="k"):
    """手前の板の台と、奥の屋台の板壁"""
    for k in range(10):
        put(cube(w, d / 10 * 0.98, 0.3, (0, -d / 2 + d / 10 * (k + 0.5), z - 0.15)),
            noiseM("%s_board%d" % (tag, k % 2), [(0, "#b87838"), (0.6, "#8c5228"), (1, "#5a3218")], 3 + k % 2), "board")
    put(cube(w, 0.3, 8.0, (0, d / 2 + 0.1, z + 3.8)), noiseM("%s_wall" % tag, [(0, "#5a3218"), (1, "#2e1a12")], 2), "wall")
    for k in range(-4, 5):
        put(cube(0.12, 0.2, 8.0, (k * 1.9, d / 2 - 0.05, z + 3.8)), M("#2e1a12"), "wall_beam")


def _shichirin(cx, rng, lit=True):
    """丸い七輪：珪藻土の胴・上下の金具・下の空気窓・炭・丸い焼き網"""
    clay = noiseM("k_keisodo", [(0, "#f0e6d2"), (0.5, "#d6ccb8"), (1, "#b08a4a")], 6)
    prof = [(0.0, 0.0), (1.05, 0.0), (1.12, 0.15), (1.18, 1.4), (1.2, 1.55), (1.0, 1.55), (0.98, 1.2), (0.0, 1.2)]
    body = common.bm_lathe(prof, 40)
    transform_bm(body, loc=(cx, 0, 0))
    put(body, clay, "shichirin")
    for z, h, r in ((1.38, 0.1, 1.205), (0.1, 0.12, 1.135)):   # 帯（ふたにならないよう、輪の形に）
        band = common.bm_lathe([(r, z), (r + 0.02, z), (r + 0.02, z + h), (r, z + h)], 40)
        transform_bm(band, loc=(cx, 0, 0))
        put(band, M("#1c1220", 0.35), "kanagu")
    # 空気窓（手前の下）と、半分あいた小窓の戸
    put(cube(0.62, 0.2, 0.42, (cx, -1.08, 0.48)), M("#2e1a12"), "mado")
    if lit:
        put(cube(0.5, 0.1, 0.3, (cx, -1.12, 0.46)), M("#f24a2a", 0.8, 2.0), "mado_hi")
    put(cube(0.36, 0.08, 0.46, (cx + 0.26, -1.2, 0.48)), M("#76726a", 0.35), "mado_to")
    # 炭（光る）：下の熾火（おきび）が、炭のすき間から赤く見える
    if lit:
        put(cyl(0.96, 0.04, (cx, 0, 1.22), seg=40), M("#c42618", 0.8, 1.2), "okibi")
    for k in range(30):
        a, d = rng.uniform(0, math.pi * 2), math.sqrt(rng.random()) * 0.82
        hot = lit and rng.random() < 0.35
        put(ball(rng.uniform(0.17, 0.26), (cx + math.cos(a) * d, math.sin(a) * d, 1.32), 1.3, 0.9, 0.7, 1),
            M("#f5b860" if hot and rng.random() < 0.2 else "#f24a2a" if hot else "#1c1220", 0.8, 2.0 if hot else 0), "sumi")
    if lit:
        point_light((cx, 0, 1.9), color=(1.0, 0.45, 0.2), power=90, radius=0.8)
    # 丸い焼き網（ふちの輪と、格子の針金）
    R = 1.08
    rim = common.bm_torus(R, 0.035, 48, 6)
    transform_bm(rim, loc=(cx, 0, 1.6))
    put(rim, M("#aaa292", 0.3), "ami_fuchi")
    for k in range(-6, 7):
        t = k * 0.16
        half = math.sqrt(max(0.0, R * R - t * t))
        if half < 0.05:
            continue
        put(cube(half * 2, 0.025, 0.025, (cx, t, 1.6)), M("#76726a", 0.3), "ami")
        put(cube(0.025, half * 2, 0.025, (cx + t, 0, 1.61)), M("#76726a", 0.3), "ami")


def _kview_cam(scale, elev):
    cam = common.oblique_camera(scale, elevation_deg=elev)
    return cam


def job_kitchen(out):
    rng = rng_for("kitchen")
    slots = {}

    # --- 七輪（2つ。斜め上から）---
    _small_scene(*KVIEW_PX, samples=32)
    _counter(rng)
    for i, cx in enumerate((-1.75, 1.75)):
        _shichirin(cx, rng, lit=True)
    # 団扇（うちわ）と火箸
    put(cube(0.9, 1.1, 0.04, (-4.1, -1.6, 0.05), rz=0.4), M("#f0e6d2", 0.5), "uchiwa")
    put(cube(0.1, 0.9, 0.06, (-3.6, -2.4, 0.05), rz=0.4), M("#8c5228"), "uchiwa_e")
    for s in (0, 0.12):
        put(cube(0.05, 2.0, 0.05, (3.9 + s, -1.8, 0.05), rz=0.25), M("#76726a", 0.3), "hibashi")
    cam = _kview_cam(6.6, 52)
    cam.location = cam.location + Vector((0, 0, 0.9))
    common.render_to(os.path.join(out, "k_shichirin.png"))
    slots["grill"] = [_proj(cam, (cx + dx, 0, 1.66)) for cx in (-1.75, 1.75) for dx in (-0.5, 0.5)]

    # --- 油鍋（天ぷら鍋。斜め上から）---
    _small_scene(*KVIEW_PX, samples=32)
    _counter(rng, tag="f")
    # かまど（土の台）
    put(cyl(2.0, 1.0, (-0.9, 0.2, 0), seg=40, r2=1.9), noiseM("k_kamado", [(0, "#d6ccb8"), (0.5, "#b08a4a"), (1, "#8c5228")], 5), "kamado")
    put(cube(0.8, 0.2, 0.5, (-0.9, -1.85, 0.4)), M("#2e1a12"), "kamado_mado")
    put(cube(0.6, 0.1, 0.34, (-0.9, -1.9, 0.38)), M("#f24a2a", 0.8, 2.0), "kamado_hi")
    # 鉄の天ぷら鍋（厚いふち・両耳）
    pot = common.bm_lathe([(0.0, 0.0), (1.4, 0.0), (1.85, 0.45), (2.05, 0.95), (2.1, 1.0), (1.98, 1.0), (1.92, 0.9), (1.32, 0.12), (0.0, 0.12)], 48)
    transform_bm(pot, loc=(-0.9, 0.2, 1.0))
    put(pot, M("#4a4658", 0.35), "nabe")
    for s in (-1, 1):
        put(cube(0.5, 0.3, 0.12, (-0.9 + s * 2.2, 0.2, 1.9)), M("#1c1220", 0.4), "nabe_mimi")
    # 油（ごま油の琥珀色。まん中が明るく、ふちが暗い）
    for r, z, col in ((1.92, 1.74, "#8c5228"), (1.7, 1.76, "#b87838"), (1.25, 1.77, "#dca24a"), (0.7, 1.78, "#f5b860")):
        put(cyl(r, 0.03, (-0.9, 0.2, z), seg=48), M(col, 0.08), "abura")
    put(ball(0.25, (-1.6, 0.9, 1.84), 1.6, 0.6, 0.1, 1), M("#ffe6b0", 0.1, 0.6), "tsuya")   # 照り返し
    # 油切りの網とバット、菜箸、衣の鉢
    put(cube(2.6, 1.8, 0.12, (3.4, -0.4, 0.06)), M("#aaa292", 0.3), "batto")
    put(cube(2.3, 1.5, 0.04, (3.4, -0.4, 0.16)), M("#fffaf0", 0.6), "tengami")
    for k in range(6):
        put(cube(2.3, 0.03, 0.03, (3.4, -1.1 + k * 0.28, 0.24)), M("#76726a", 0.3), "ami")
    for s in (0, 0.14):
        put(cube(0.06, 3.2, 0.06, (2.0 + s, 1.6, 0.1), rz=-0.5), M("#dca24a"), "saibashi")
    put(cyl(0.7, 0.5, (3.6, 2.0, 0), seg=28, r2=0.85), M("#5070b0", 0.3), "koromo_hachi")
    put(cyl(0.72, 0.04, (3.6, 2.0, 0.48), seg=28), M("#fbe39a", 0.5), "koromo")
    point_light((-0.9, 0.2, 3.0), color=(1.0, 0.75, 0.45), power=60, radius=1.0)
    cam = _kview_cam(8.6, 58)
    cam.location = cam.location + Vector((0.2, 0, 1.4))
    common.render_to(os.path.join(out, "k_fryer.png"))
    slots["fry"] = [_proj(cam, (-0.9 + dx, 0.2, 1.8)) for dx in (-0.85, 0.85)]
    c0 = _proj(cam, (-0.9, 0.2, 1.8)); ex = _proj(cam, (-0.9 + 1.9, 0.2, 1.8)); ey = _proj(cam, (-0.9, 0.2 + 1.9, 1.8))
    slots["oil"] = [c0[0], c0[1], round(ex[0] - c0[0], 4), round(c0[1] - ey[1], 4)]

    # --- 藁焼き（鉄の火鉢に藁。横から少し見下ろす）---
    _small_scene(*KVIEW_PX, samples=32)
    common.add_lantern_light(direction_from=(1.0, -1.0, 0.8), strength=1.2, color=(0.6, 0.7, 1.0))
    # 地面（石畳）と奥の板塀
    put(cube(18, 10, 0.2, (0, 2, -0.1)), noiseM("w_ground2", [(0, "#5a3218"), (0.5, "#2e1a12"), (1, "#1c1220")], 3), "ground")
    put(cube(18, 0.3, 9, (0, 5.5, 4.4)), noiseM("w_wall", [(0, "#5a3218"), (1, "#2e1a12")], 2), "wall")
    for k in range(-5, 6):
        put(cube(0.1, 0.2, 9, (k * 1.6, 5.3, 4.4)), M("#1c1220"), "wall_beam")
    # 鉄の火鉢（大きく浅い鉄の器・脚つき）
    bowl = common.bm_lathe([(0.0, 0.3), (2.0, 0.3), (2.9, 1.1), (3.0, 1.25), (2.88, 1.25), (1.95, 0.42), (0.0, 0.42)], 48)
    put(bowl, noiseM("w_tetsu", [(0, "#4a4658"), (0.6, "#2e1a12"), (1, "#5a3218")], 4), "tetsu")
    for k in range(3):
        a = k / 3 * 2 * math.pi + 0.5
        put(cube(0.18, 0.18, 0.5, (math.cos(a) * 1.6, math.sin(a) * 1.6, 0.1)), M("#1c1220"), "ashi")
    # 藁（黄色い茎を山に。ところどころ焦げて赤い）
    for k in range(160):
        a, d = rng.uniform(0, math.pi * 2), math.sqrt(rng.random()) * 2.5
        z = 0.5 + (1 - d / 2.6) * 0.7 * rng.random()
        c = rng.random()
        mt = M("#7a1414", 0.8, 1.5) if c < 0.08 else M("#2e1a12") if c < 0.18 else M(rng.choice(["#f4cc62", "#dca24a", "#fbe39a", "#b08a4a"]))
        put(cube(rng.uniform(0.6, 1.4), 0.05, 0.05, (math.cos(a) * d, math.sin(a) * d, z), rz=rng.uniform(0, math.pi), ry=rng.uniform(-0.4, 0.4)), mt, "wara")
    # わきの藁束と、水の桶
    for k in range(9):
        put(cube(0.06, 0.06, 2.2, (5.0 + (k % 3) * 0.12, 1.2 + (k // 3) * 0.12, 1.1), ry=0.08 * (k % 3 - 1)), M("#f4cc62"), "taba")
    put(cube(0.5, 0.5, 0.2, (5.12, 1.32, 1.2)), M("#b8323a"), "taba_himo")
    put(cyl(0.8, 0.9, (-5.0, 0.6, 0), seg=28, r2=0.9), noiseM("w_oke", [(0, "#b87838"), (1, "#8c5228")], 4), "oke")
    put(cyl(0.82, 0.03, (-5.0, 0.6, 0.85), seg=28), M("#5070b0", 0.2), "mizu")
    point_light((0, -0.5, 1.5), color=(1.0, 0.45, 0.2), power=70, radius=1.2)
    cam = _kview_cam(8.6, 28)
    cam.location = cam.location + Vector((0, 0, 1.4))
    common.render_to(os.path.join(out, "k_wara.png"))
    slots["sear"] = [_proj(cam, (0, -0.4, 2.6))]
    slots["searHandle"] = _proj(cam, (3.4, -2.6, 2.2))

    with open(os.path.join(out, "kitchen_slots.json"), "w", encoding="utf-8") as f:
        json.dump(slots, f)

    # --- 藁焼きの炎（横から・3コマ）48×48 ---
    for fr in range(3):
        _small_scene(48, 48)
        r2 = rng_for("flame%d" % fr)
        for k in range(9):
            x = r2.uniform(-1.4, 1.4)
            h = r2.uniform(1.6, 3.6) * (1 - abs(x) / 2.2)
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r2.uniform(0.4, 0.7), radius2=0.02, depth=h)
            transform_bm(bm, loc=(x, 0, -2.0 + h / 2), rot_y=r2.uniform(-0.25, 0.25))
            put(bm, M(["#f24a2a", "#f5b860", "#c42618"][k % 3], 0.5, 1.2), "flame")
        cd = bpy.data.cameras.new("Cam"); cd.type = "ORTHO"; cd.ortho_scale = 4.8
        ob = link(bpy.data.objects.new("Cam", cd)); ob.location = (0, -20, 0); ob.rotation_euler = (math.pi / 2, 0, 0)
        bpy.context.scene.camera = ob
        common.render_to(os.path.join(out, "k_flame%d.png" % fr))

    # --- 木札（注文の札）56×72 と、紐 128×12 ---
    _small_scene(56, 72)
    put(cube(4.8, 6.4, 0.3, (0, -0.2, 0)), noiseM("k_fuda", [(0, "#fbe39a"), (0.5, "#f4cc62"), (1, "#dca24a")], 3), "fuda")
    put(cube(4.8, 0.3, 0.32, (0, 2.9, 0.02)), M("#b87838"), "fuda_top")
    put(cyl(0.3, 0.4, (0, 2.6, 0)), M("#2e1a12"), "ana")
    _top_cam_px(56, 72)
    common.render_to(os.path.join(out, "k_ticket.png"))
    _small_scene(128, 12)
    for k in range(20):
        put(ball(0.36, (-6.2 + k * 0.66, 0, 0), 1.3, 0.8, 0.8, 1), M("#dca24a" if k % 2 else "#b87838"), "nawa")
    _top_cam_px(128, 12)
    common.render_to(os.path.join(out, "k_rope.png"))

    # --- 捨て桶 40×40（斜め上から） ---
    _small_scene(40, 40)
    put(cyl(1.3, 1.6, (0, 0, -0.8), seg=28, r2=1.5), noiseM("k_oke", [(0, "#b87838"), (1, "#8c5228")], 5), "oke")
    put(cyl(1.3, 1.62, (0, 0, -0.78), seg=28, r2=1.4), M("#2e1a12"), "oke_in")
    for z in (0.35, 1.25):
        put(cyl(1.42 + z * 0.08, 0.14, (0, 0, z - 0.8), seg=28), M("#34569a", 0.4), "taga")
    common.oblique_camera(4.0, elevation_deg=40)
    common.render_to(os.path.join(out, "k_trash.png"))

    # --- 薬味の鉢と、たれの徳利 32×32 ---
    _small_scene(32, 32)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=0.7, radius2=1.3, depth=0.8)
    transform_bm(bm, loc=(0, 0, 0.4))
    put(bm, M("#5070b0", 0.3), "hachi")
    put(cyl(1.15, 0.05, (0, 0, 0.78), seg=28), M("#fffaf0"), "hachi_in")
    for k in range(10):
        put(ball(0.18, (rng.uniform(-0.7, 0.7), rng.uniform(-0.7, 0.7), 0.86), 1, 1, 0.5, 1), M("#46b03a"), "yakumi")
    common.oblique_camera(3.2, elevation_deg=45)
    common.render_to(os.path.join(out, "k_bowl.png"))
    _small_scene(32, 32)
    prof = [(0.0, 0.0), (0.7, 0.0), (0.85, 0.5), (0.8, 1.2), (0.35, 1.8), (0.25, 2.3), (0.35, 2.5), (0.0, 2.5)]
    bm = common.bm_lathe(prof, 28)
    transform_bm(bm, loc=(0, 0, -1.25))
    put(bm, M("#fffaf0", 0.3), "tokkuri")
    put(cyl(0.83, 0.3, (0, 0, -0.55), seg=28), M("#34569a", 0.4), "tokkuri_obi")
    common.oblique_camera(3.2, elevation_deg=20)
    common.render_to(os.path.join(out, "k_jug.png"))


def _top_cam_px(w_px, h_px):
    cd = bpy.data.cameras.new("Cam")
    cd.type = "ORTHO"
    cd.ortho_scale = max(w_px, h_px) * 0.1
    ob = link(bpy.data.objects.new("Cam", cd))
    ob.location = (0, 0, 30)
    bpy.context.scene.camera = ob
    return ob
