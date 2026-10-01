"""町の地図とミニゲームの背景（人物と同じセル調：光の向きで3段の塗り分け＋線）。

ゲームの座標に合わせて作る（変えるとゲームの当たり判定とずれる所）：
  ・一本釣り（横）  海面 y=40、小舟 x 8〜42、魚は y 70〜82 を泳ぐ
  ・里山（真上）    木 (28,28) (96,24) (164,32)・蜂の巣はその下、道 y 56〜68、田んぼ y 70〜115、池 x 110〜192 y 100〜128
  ・山（真上）      罠 x 78〜114 y 6〜22（下が入口）、獣は y 100〜116 から上へ走る
  ・長崎（横・夜）  役人の足もと y=56、道（マテオの足もと）y=100、船 x=172、荷車 x=22
  ・地図            PLACES（地名の場所）を絵の上に置き、画面の位置を map_places.json に書き出す
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

import common
from common import rng_for, transform_bm, mesh_object
import scenes
from scenes import cube, cyl, ball, _px, _fx, _top_cam, _front_cam, toon_job, GAME_PX, MAP_PX


LINE = 4.2   # 線の太さ（4倍で描いて縮めるので、完成で約1ドット）


def put(bm, mat, name="obj", smooth=False):
    """箱・屋根は面ごとにパキッと塗り分ける（smooth=False）。丸いものは smooth=True"""
    return mesh_object(name, bm, mat, smooth=smooth)


# ---------------------------------------------------------------------------
# 色（セル調）
# ---------------------------------------------------------------------------
def T(color):
    """パレットの色 → 人物と同じ「影・地・明るい」の3段（people.RAMP）"""
    return scenes.M(color)


def T3(name, light, mid, dark, noise=0.0, scale=8.0, line=None):
    return common.toon3("ls_" + name, light, mid, dark, noise=noise, scale=scale, line=line)


def FLAT(color):
    """影のつかない1色（空・遠景・水面の帯など）"""
    return common.toon3("flat_" + color.strip("#"), color, color, color)


def flat(bm, color, name="flat", line=False):
    ob = put(bm, FLAT(color), name)
    if not line:
        common.noline(ob)
    return ob


# ---------------------------------------------------------------------------
# 形（たくさん並べるものは1つのメッシュにまとめる）
# ---------------------------------------------------------------------------
class Batch:
    """同じ色の小物をまとめて1つの物にする（数百個でも軽い）"""

    def __init__(self):
        self.bm = bmesh.new()
        self.flat = False   # 箱・円すい・屋根を入れたら、面ごとに塗り分ける

    def cube(self, sx, sy, sz, loc, rz=0.0, ry=0.0):
        self.flat = True
        m = Matrix.Translation(loc) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Diagonal((sx, sy, sz, 1))
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)

    def cone(self, r1, r2, h, loc, seg=8, sx=1.0, sy=1.0):
        self.flat = True
        m = Matrix.Translation((loc[0], loc[1], loc[2] + h / 2)) @ Matrix.Diagonal((sx, sy, 1, 1))
        bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h, matrix=m)

    def ball(self, r, loc, sx=1.0, sy=1.0, sz=1.0, sub=1):
        m = Matrix.Translation(loc) @ Matrix.Diagonal((sx * r, sy * r, sz * r, 1))
        bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0, matrix=m)

    def roof(self, w, d, h, loc, rz=0.0, hip=0.0):
        """切妻（hip > 0 で寄棟）屋根。w = 棟の向きの長さ、d = 奥行き、h = 高さ"""
        self.flat = True
        x, y, z = loc
        c, s = math.cos(rz), math.sin(rz)

        def P(px, py, pz):
            return self.bm.verts.new((x + px * c - py * s, y + px * s + py * c, z + pz))
        a, b = w / 2, d / 2
        e = min(a * 0.9, hip)
        v = [P(-a, -b, 0), P(a, -b, 0), P(a, b, 0), P(-a, b, 0), P(-a + e, 0, h), P(a - e, 0, h)]
        f = self.bm.faces.new
        f((v[0], v[1], v[5], v[4]))
        f((v[2], v[3], v[4], v[5]))
        f((v[1], v[2], v[5]))
        f((v[3], v[0], v[4]))
        f((v[3], v[2], v[1], v[0]))

    def put(self, mat, name="batch", line=True):
        ob = mesh_object(name, self.bm, mat, smooth=not self.flat)
        if not line:
            common.noline(ob)
        return ob


def poly(points, z=0.0):
    """xy の多角形（凹でもよい）の板"""
    bm = bmesh.new()
    vs = [bm.verts.new((p[0], p[1], z)) for p in points]
    f = bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=[f])
    return bm


def ribbon(path, width, z=0.0):
    """道や川：点の列にそって、幅 width の帯"""
    bm = bmesh.new()
    left, right = [], []
    for i, p in enumerate(path):
        a = Vector(path[max(0, i - 1)]) - Vector(path[min(len(path) - 1, i + 1)])
        n = Vector((-a.y, a.x)).normalized() * (width / 2)
        left.append(bm.verts.new((p[0] + n.x, p[1] + n.y, z)))
        right.append(bm.verts.new((p[0] - n.x, p[1] - n.y, z)))
    for i in range(len(path) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    return bm


def bg_scene(w, h, samples=8, crease=True):
    common.reset_scene()
    common.set_resolution(w * 4, h * 4)
    scene = bpy.context.scene
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.render.film_transparent = False
    common.add_night_world(color=(0.05, 0.07, 0.15), strength=1.0)
    common.toon_lines(LINE, outer=True)
    ls = bpy.context.view_layer.freestyle_settings.linesets[0]
    ls.select_crease = crease        # 箱の角（石垣・瓦・板）にも線
    ls.edge_type_combination = "OR"
    bpy.context.view_layer.freestyle_settings.crease_angle = math.radians(120)


def tree(b_dark, b_mid, b_light, x, y, r, z=0.0, rng=None, trunk=True):
    """真上・斜め上から見た丸い木（3つの玉を重ねる）"""
    if trunk:
        b_dark.cone(r * 0.18, r * 0.12, r * 0.9, (x, y, z), seg=6)
    b_mid.ball(r, (x, y, z + r * 1.1), 1.0, 1.0, 0.8)
    if rng:
        for k in range(2):
            a = rng.uniform(0, 6.28)
            b_light.ball(r * 0.55, (x + math.cos(a) * r * 0.45 - r * 0.2, y + math.sin(a) * r * 0.45 - r * 0.25, z + r * 1.45), 1, 1, 0.8)


# ---------------------------------------------------------------------------
# 町の地図（斜め上から）。256×160
# ---------------------------------------------------------------------------
def river_x(y):
    """隅田川の流れの中心（北の上流 y=11 → 江戸湾 y=-3）"""
    return 5.6 + 0.9 * math.sin(y * 0.45 + 0.3)


def coast_y(x):
    """江戸湾の岸（これより下が海）"""
    return -4.9 + 0.12 * (x + 11) + 0.6 * math.sin(x * 0.5)


PLACES = {
    "uogashi": (1.4, 1.2, 0.3), "ipponzuri": (7.6, -4.6, 0.2), "satoyama": (-8.0, 5.0, 0.3), "yama": (-3.2, 7.7, 0.8),
    "nagasaki": (8.5, -3.2, 0.6), "aomono": (-2.4, -0.4, 0.3), "komeya": (-0.6, -2.0, 0.3), "tofuya": (-4.2, -1.6, 0.3),
    "toriya": (-5.0, 1.0, 0.3), "yagenbori": (3.6, -1.6, 0.3), "momonjiya": (-6.2, 2.6, 0.3), "stall": (4.6, 0.9, 0.3),
}
CASTLE = (-2.6, 4.4)


def _water_mat():
    return T3("water", "#5070b0", "#34569a", "#243f7a", noise=0.18, scale=1.6, line="#172b58")


@toon_job
def job_map(out):
    bg_scene(*MAP_PX, crease=False)   # 地図は小さいので、輪郭だけ
    rng = rng_for("map2")
    # 地面（草）と町の土
    common.noline(put(cube(30, 26, 0.1, (0, 2, -0.05)), T3("map_grass", "#a8e05a", "#46b03a", "#1f6a2c", noise=0.22, scale=0.9), "land"))
    town = [(-8.2, -3.4), (-8.6, 1.5), (-7.2, 3.2), (-4.8, 3.0), (-4.8, 6.0), (-0.4, 6.2), (0.4, 3.6), (4.4, 3.8), (5.0, -3.0), (-1.0, -3.6), (-6.0, -4.0)]
    flat(poly(town, 0.004), "#d6ccb8", "town_ground")
    east = [(river_x(4.5) + 0.8, 4.5), (11.5, 4.5), (11.5, -1.9), (river_x(-2.2) + 0.7, -2.6)]
    flat(poly(east, 0.004), "#d6ccb8", "east_ground")

    # 江戸湾（岸の砂浜 → 海）
    xs = [x * 0.5 for x in range(-24, 25)]
    shore = [(x, coast_y(x)) for x in xs]
    flat(poly([(x, y + 0.35) for x, y in shore] + [(12.5, -10), (-12.5, -10)], 0.006), "#f4cc62", "beach")
    sea = put(poly(shore + [(12.5, -10), (-12.5, -10)], 0.012), _water_mat(), "sea")
    waves = Batch()
    for k in range(70):
        x = rng.uniform(-11, 11)
        y = rng.uniform(-9, coast_y(x) - 0.4)
        waves.cube(rng.uniform(0.25, 0.6), 0.07, 0.02, (x, y, 0.03))
    waves.put(FLAT("#aaa292"), "waves", line=False)

    # 隅田川（石垣の岸 → 水）と、日本橋川
    path = [(river_x(y), y) for y in [11.5 - k * 0.25 for k in range(60)] if y > coast_y(river_x(y)) - 0.6]
    put(ribbon(path, 1.5, 0.008), T("#aaa292"), "bank")
    put(ribbon(path, 1.15, 0.014), _water_mat(), "river")
    canal = [(-1.8, 2.6), (-1.0, 2.0), (0.2, 1.1), (1.4, 0.6), (2.6, 0.2), (3.8, -0.1), (river_x(-0.2) - 0.3, -0.2)]
    put(ribbon(canal, 0.62, 0.008), T("#aaa292"), "canal_bank")
    put(ribbon(canal, 0.42, 0.014), _water_mat(), "canal")

    # 江戸城：堀・石垣・白壁・天守
    cx, cy = CASTLE
    put(cube(4.6, 3.6, 0.04, (cx, cy, 0.01)), _water_mat(), "moat")
    put(cube(3.7, 2.7, 0.35, (cx, cy, 0.17)), T3("ishigaki", "#d6ccb8", "#aaa292", "#76726a", noise=0.25, scale=6), "castle_wall")
    put(cube(3.5, 2.5, 0.05, (cx, cy, 0.37)), T("#46b03a"), "castle_lawn")
    for dx, dy, w, d in ((0, 1.2, 3.4, 0.1), (0, -1.2, 3.4, 0.1), (1.7, 0, 0.1, 2.4), (-1.7, 0, 0.1, 2.4)):
        put(cube(w, d, 0.16, (cx + dx, cy + dy, 0.45)), T("#fffaf0"), "castle_fence")
    tiers = [(1.4, 1.1, 0.42), (1.1, 0.85, 0.36), (0.85, 0.65, 0.32), (0.62, 0.48, 0.3)]
    z = 0.4
    for i, (w, d, h) in enumerate(tiers):
        put(cube(w, d, h, (cx + 0.5, cy + 0.3, z + h / 2)), T("#fffaf0"), "tenshu")
        rf = Batch()
        rf.roof(w + 0.35, d + 0.35, 0.22, (cx + 0.5, cy + 0.3, z + h), hip=0.15 if i < 3 else 0.0)
        rf.put(T("#4a4658"), "tenshu_roof")
        z += h + 0.12
    for s in (-1, 1):
        put(ball(0.06, (cx + 0.5 + s * 0.16, cy + 0.3, z + 0.06)), T("#f4cc62"), "shachi", smooth=True)
    for k in range(4):   # 御殿
        rf = Batch()
        rf.roof(0.9, 0.6, 0.25, (cx - 0.9 + (k % 2) * 0.9, cy - 0.5 + (k // 2) * 0.7, 0.55), hip=0.2)
        put(cube(0.8, 0.5, 0.18, (cx - 0.9 + (k % 2) * 0.9, cy - 0.5 + (k // 2) * 0.7, 0.46)), T("#f0e6d2"), "goten")
        rf.put(T("#76726a"), "goten_roof")
    pines = (Batch(), Batch(), Batch())
    for k in range(16):
        a = k / 16 * 6.28
        tree(*pines, cx + math.cos(a) * 2.6, cy + math.sin(a) * 2.1, 0.22, 0.02, rng)

    # 町家：碁盤の目の町に、瓦屋根と白壁
    walls, roofs_d, roofs_m, kura = Batch(), Batch(), Batch(), Batch()

    def free(x, y, pad=0.0):
        if abs(x - cx) < 2.9 + pad and abs(y - cy) < 2.4 + pad:
            return False
        if abs(x - river_x(y)) < 1.2 + pad:
            return False
        if min(math.hypot(x - p[0], y - p[1]) for p in canal) < 0.55 + pad:
            return False
        if y < coast_y(x) + 0.6:
            return False
        for k, (w, d) in (("uogashi", (1.1, 1.4)), ("stall", (0.9, 0.5))):
            px, py = PLACES[k][0], PLACES[k][1]
            if abs(x - px - 0.1) < w + pad and abs(y - py - 0.5 * (k == "uogashi")) < d + pad:
                return False
        return True

    def inside(pts, x, y):
        c = False
        for i in range(len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                c = not c
        return c

    BW, BD = 1.5, 1.0     # 1ブロック（通りをのぞく）
    for gx in range(-8, 8):
        for gy in range(-5, 7):
            bx, by = gx * 1.8 + 0.3, gy * 1.3
            for row in (-1, 1):   # 前と後ろの長屋
                y = by + row * BD / 4
                seg = 0
                x = bx - BW / 2
                while x < bx + BW / 2 - 0.1:
                    w = min(rng.uniform(0.45, 0.8), bx + BW / 2 - x)
                    px = x + w / 2
                    x += w
                    if not (inside(town, px, y) or inside(east, px, y)) or not free(px, y):
                        continue
                    if inside(east, px, y) and rng.random() < 0.3:
                        continue
                    h = rng.uniform(0.14, 0.2)
                    if rng.random() < 0.1:
                        kura.cube(w - 0.12, 0.34, 0.3, (px, y, 0.15))
                        roofs_d.roof(w - 0.04, 0.42, 0.14, (px, y, 0.3))
                    else:
                        walls.cube(w - 0.04, BD / 2 - 0.06, h, (px, y, h / 2))
                        (roofs_d if rng.random() < 0.35 else roofs_m).roof(w, BD / 2, 0.15, (px, y, h))
    walls.put(T("#f0e6d2"), "machiya")
    kura.put(T("#fffaf0"), "kura")
    roofs_d.put(T("#76726a"), "roof_dark")
    roofs_m.put(T("#aaa292"), "roof_mid")

    # 魚河岸（日本橋）：長い屋根の市場と、青いのれん、舟
    for k in range(3):
        rf = Batch()
        rf.roof(1.6, 0.42, 0.2, (PLACES["uogashi"][0] + 0.1, PLACES["uogashi"][1] + 0.05 + k * 0.48, 0.2))
        put(cube(1.5, 0.36, 0.2, (PLACES["uogashi"][0] + 0.1, PLACES["uogashi"][1] + 0.05 + k * 0.48, 0.1)), T("#34569a"), "uogashi_wall")
        rf.put(T("#8c5228"), "uogashi_roof")
    boats = Batch()
    for p in ((0.6, 1.0), (2.0, 0.38), (3.2, 0.05)):
        boats.ball(0.14, (p[0], p[1], 0.04), 2.0, 0.7, 0.4)
    boats.put(T("#8c5228"), "canal_boats")
    # 日本橋・両国橋
    nb = Batch()
    nb.cube(0.25, 0.9, 0.08, (0.75, 0.82, 0.08), rz=0.55)
    nb.put(T("#b87838"), "nihonbashi")
    rb = Batch()
    rb.cube(2.2, 0.32, 0.08, (river_x(0.85), 0.85, 0.1))
    for k in range(5):
        rb.cube(0.06, 0.4, 0.14, (river_x(0.85) - 0.9 + k * 0.45, 0.85, 0.04))
    rb.put(T("#b87838"), "ryogoku")
    # 両国の広小路：屋台の提灯
    lan = Batch()
    for k in range(5):
        lan.ball(0.07, (PLACES["stall"][0] - 0.5 + k * 0.22, PLACES["stall"][1] - 0.25 + (k % 2) * 0.12, 0.2))
    lan.put(FLAT("#f24a2a"), "stall_lanterns")
    # 回向院（川の東）
    put(cube(0.9, 0.7, 0.25, (8.0, 1.9, 0.12)), T("#b87838"), "ekoin")
    rf = Batch()
    rf.roof(1.3, 1.1, 0.45, (8.0, 1.9, 0.25), hip=0.3)
    rf.put(T("#4a4658"), "ekoin_roof")

    # 里山：田んぼ（水を張った区画）・あぜ・わらぶきの農家
    paddy = Batch()
    for i in range(5):
        for j in range(4):
            x, y = -10.4 + i * 0.95, 3.6 + j * 0.8
            if abs(x - PLACES["satoyama"][0]) < 0.6 and abs(y - PLACES["satoyama"][1]) < 0.5:
                continue
            paddy.cube(0.82, 0.66, 0.03, (x, y, 0.02))
    paddy.put(T3("paddy", "#a8e05a", "#5070b0", "#34569a", noise=0.3, scale=4), "paddies")
    rice = Batch()
    for i in range(5):
        for j in range(4):
            x0, y0 = -10.4 + i * 0.95, 3.6 + j * 0.8
            if abs(x0 - PLACES["satoyama"][0]) < 0.6 and abs(y0 - PLACES["satoyama"][1]) < 0.5:
                continue
            for k in range(4):
                rice.cube(0.7, 0.05, 0.03, (x0, y0 - 0.24 + k * 0.16, 0.04))
    rice.put(FLAT("#a8e05a"), "rice_rows", line=False)
    thatch = Batch()
    for p in ((-8.0, 5.0), (-9.6, 6.7), (-6.3, 6.4)):
        put(cube(0.5, 0.4, 0.18, (p[0], p[1], 0.09)), T("#d6ccb8"), "farmhouse")
        thatch.roof(0.72, 0.62, 0.36, (p[0], p[1], 0.18), hip=0.18)
    thatch.put(T("#b87838"), "thatch")

    # 山：奥ほど青い。手前の山は森の緑
    for k, (x, y, r, h, col) in enumerate([
            (-10.0, 10.6, 2.6, 3.4, "#34569a"), (-6.6, 11.2, 3.0, 3.0, "#34569a"), (-2.6, 11.0, 2.6, 2.4, "#34569a"), (1.6, 11.4, 2.8, 2.2, "#34569a"),
            (-8.4, 8.8, 1.9, 1.7, "#1f6a2c"), (-5.2, 9.1, 2.0, 2.0, "#1f6a2c"), (-1.6, 9.0, 1.8, 1.6, "#1f6a2c"), (2.2, 9.6, 1.6, 1.2, "#1f6a2c")]):
        m = Batch()
        m.cone(r, r * 0.12, h, (x, y, 0), seg=9, sy=0.8)
        m.put(T(col), "mountain")
    forest = (Batch(), Batch(), Batch())
    for k in range(70):
        x, y = rng.uniform(-11, 4.5), rng.uniform(6.8, 9.6)
        if x < -5.6 and y < 7.3:
            continue
        tree(*forest, x, y, rng.uniform(0.22, 0.34), 0.0, rng, trunk=False)
    for k in range(40):   # 川べり・町の木
        y = rng.uniform(-2.5, 7)
        x = river_x(y) + rng.choice((-1, 1)) * rng.uniform(0.95, 1.2)
        tree(*forest, x, y, 0.16, 0.0, rng, trunk=False)
    forest[0].put(T("#5a3218"), "trunks")
    forest[1].put(T("#1f6a2c"), "forest")
    forest[2].put(T("#46b03a"), "forest_hi")
    pines[0].put(T("#5a3218"), "pine_trunk")
    pines[1].put(T("#1f6a2c"), "pine")
    pines[2].put(T("#46b03a"), "pine_hi")

    # 江戸湾の舟：一本釣りの小舟と、長崎へ向かう弁才船
    for k, (x, y) in enumerate([(7.6, -4.6), (6.2, -5.4), (8.9, -5.9)]):
        b = Batch()
        b.ball(0.2, (x, y, 0.05), 2.2, 0.8, 0.5)
        b.put(T("#8c5228"), "fishing_boat")
    nx, ny = PLACES["nagasaki"][0], PLACES["nagasaki"][1]
    hull = Batch()
    hull.ball(0.42, (nx, ny, 0.12), 2.4, 0.9, 0.55)
    hull.put(T("#5a3218"), "bezaisen")
    put(cube(0.05, 0.05, 1.2, (nx, ny, 0.7)), T("#2e1a12"), "mast")
    put(cube(0.75, 0.06, 0.85, (nx - 0.02, ny - 0.05, 0.85)), T("#fffaf0"), "sail")

    cam = common.oblique_camera(22.0, elevation_deg=55)
    cam.location = cam.location + Vector((0, 2.0, 0))
    common.render_to(os.path.join(out, "map.png"))
    scene = bpy.context.scene
    pos = {}
    for k, p in PLACES.items():
        v = world_to_camera_view(scene, cam, Vector(p))
        pos[k] = [round(v.x, 4), round(1 - v.y, 4)]
    with open(os.path.join(out, "map_places.json"), "w", encoding="utf-8") as f:
        json.dump(pos, f)


# ---------------------------------------------------------------------------
# ミニゲームの背景（画面の1ドット = 0.1）。192×128
# ---------------------------------------------------------------------------
def fband(y0, y1, color, d=10.0, x0=0, x1=192):
    """横から見た絵の、横長の帯（y0〜y1、ゲームの座標）"""
    return flat(cube((x1 - x0) * 0.1, 0.05, (y1 - y0) * 0.1, _fx((x0 + x1) / 2, (y0 + y1) / 2, d)), color, "band")


def cloud(b_light, b_mid, b_dark, x, y, w, d=9.0, rng=None):
    """横から見た雲（下が影、上が明るい）"""
    n = max(3, int(w / 7))
    for k in range(n):
        cx = x - w / 2 + (k + 0.5) * w / n
        r = rng.uniform(0.35, 0.6) * (1.2 - abs(k - (n - 1) / 2) / n)
        b_dark.ball(r, _fx(cx, y + 2, d + 0.2), 1.3, 0.3, 0.8)
        b_mid.ball(r * 0.95, _fx(cx, y, d), 1.3, 0.3, 0.85)
        b_light.ball(r * 0.6, _fx(cx - 1.5, y - 2.5, d - 0.2), 1.3, 0.3, 0.7)


@toon_job
def job_minigames(out):
    rng = rng_for("minigames2")
    _fishing(out, rng)
    _forage(out, rng)
    _hunt(out, rng)
    _smuggle(out, rng)


def _fishing(out, rng):
    """江戸湾の一本釣り（横）：朝焼けの空・雲・富士・遠い岬・海の中・海の底"""
    bg_scene(*GAME_PX)
    # 空（上ほど青く、水平線ほど明るい朝焼け）
    for y0, y1, c in ((0, 9, "#34569a"), (9, 17, "#5070b0"), (17, 25, "#aaa292"), (25, 32, "#f6c39c"), (32, 37, "#f5b860"), (37, 41, "#ffe6b0")):
        fband(y0, y1, c, d=14)
    # 朝日（水平線から半分）
    sun = Batch()
    sun.ball(1.0, _fx(98, 40, 12), 1, 0.2, 1)
    sun.put(FLAT("#fffaf0"), "sun", line=False)
    halo = Batch()
    halo.ball(1.5, _fx(98, 40, 12.5), 1, 0.2, 1)
    halo.put(FLAT("#ffe6b0"), "halo", line=False)
    # 雲
    cl = (Batch(), Batch(), Batch())
    for x, y, w in ((30, 12, 34), (128, 8, 26), (176, 20, 30), (66, 26, 20)):
        cloud(*cl, x, y, w, rng=rng)
    cl[0].put(FLAT("#fffaf0"), "cloud_hi", line=False)
    cl[1].put(FLAT("#f6c39c"), "cloud")
    cl[2].put(FLAT("#d08a64"), "cloud_lo", line=False)
    # 富士山と遠い岬
    fuji = bmesh.new()
    bmesh.ops.create_cone(fuji, cap_ends=True, segments=24, radius1=3.0, radius2=0.45, depth=1.9)
    transform_bm(fuji, scale=(1, 0.2, 1), loc=_fx(150, 30.5, 11))
    put(fuji, T3("fuji", "#5070b0", "#34569a", "#243f7a"), "fuji")
    snow = bmesh.new()
    bmesh.ops.create_cone(snow, cap_ends=True, segments=24, radius1=1.0, radius2=0.45, depth=0.65)
    transform_bm(snow, scale=(1, 0.2, 1), loc=_fx(150, 24.5, 10.9))
    put(snow, T3("fuji_snow", "#fffaf0", "#fffaf0", "#d6ccb8"), "snow")
    capes = Batch()
    for x, w, h in ((0, 46, 4.0), (26, 22, 2.4), (178, 34, 3.0)):
        capes.ball(1.0, _fx(x, 40, 10), w * 0.05, 0.2, h * 0.1)
    capes.put(T3("cape", "#34569a", "#243f7a", "#172b58"), "capes")
    # 海（水面 → 深く暗く）
    for y0, y1, c in ((40, 47, "#5070b0"), (47, 64, "#34569a"), (64, 92, "#243f7a"), (92, 128, "#172b58")):
        fband(y0, y1, c, d=8)
    # 水面のきらめき（朝日の光の道）・白波
    glint = Batch()
    for k in range(9):
        glint.cube(rng.uniform(0.3, 0.9) * (1 - k / 12), 0.05, 0.08, _fx(98 + rng.uniform(-3, 3), 41.5 + k * 0.9, 7.5))
    glint.put(FLAT("#ffe6b0"), "glint", line=False)
    caps = Batch()
    for k in range(26):
        x = rng.uniform(0, 192)
        if 4 < x < 46:
            continue
        caps.cube(rng.uniform(0.3, 0.7), 0.05, 0.08, _fx(x, rng.uniform(41, 46), 7.4))
    caps.put(FLAT("#d6ccb8"), "whitecaps", line=False)
    # 水中の光の筋（ななめ）
    rays = Batch()
    for x in (60, 92, 128, 160):
        for k in range(4):
            rays.cube(0.16, 0.05, 1.2, _fx(x + k * 3.2, 52 + k * 11, 7.6), ry=math.radians(-14))
    rays.put(FLAT("#34569a"), "rays", line=False)
    # 底：砂・岩・海藻（魚の泳ぐ y 70〜82 はあける）
    sand = Batch()
    for k in range(14):
        sand.ball(1.0, _fx(k * 15, 128, 6), 1.2, 0.2, rng.uniform(0.6, 0.9))
    sand.put(T3("sand", "#dca24a", "#b08a4a", "#8c5228"), "sand")
    rocks = Batch()
    for x in (14, 40, 118, 150, 184):
        rocks.ball(0.7, _fx(x, 121, 5.5), rng.uniform(1.2, 1.8), 0.4, 0.9)
    rocks.put(T("#4a4658"), "rocks")
    weed_d, weed_l = Batch(), Batch()
    for x in (8, 24, 52, 70, 104, 132, 142, 170):
        h = rng.uniform(12, 22)
        for k in range(int(h / 3)):
            sway = math.sin(k * 0.9 + x) * 0.25
            (weed_d if k % 2 else weed_l).cube(0.22, 0.05, 0.36, _fx(x + sway * 10, 124 - k * 3, 5.2))
    weed_d.put(T("#1f6a2c"), "weed")
    weed_l.put(T("#46b03a"), "weed_hi")
    bub = Batch()
    for k in range(10):
        bub.ball(0.12, _fx(rng.uniform(100, 190), rng.uniform(54, 112), 5), 1, 0.3, 1)
    bub.put(FLAT("#5070b0"), "bubbles")
    _front_cam()
    common.render_to(os.path.join(out, "bg_fishing.png"))


def _forage(out, rng):
    """田んぼと里山（真上）：実った田んぼ・あぜ道の彼岸花・里山の木・池とマコモ"""
    bg_scene(*GAME_PX)
    common.noline(put(cube(19.2, 12.8, 0.1, _px(96, 64, -0.06)), T3("forage_grass", "#a8e05a", "#46b03a", "#1f6a2c", noise=0.25, scale=3), "grass"))
    # 田んぼ：区画（泥）＋ 稲の株の列（黄金色）
    plots = [(0, 70, 54, 128), (58, 70, 106, 128), (110, 70, 192, 98)]
    for x0, y0, x1, y1 in plots:
        flat(cube((x1 - x0) * 0.1, (y1 - y0) * 0.1, 0.06, _px((x0 + x1) / 2, (y0 + y1) / 2, 0.0)), "#8c5228", "paddy_mud")
        tufts_d, tufts_l = Batch(), Batch()
        for yy in range(y0 + 3, y1 - 1, 4):
            for xx in range(x0 + 3, x1 - 1, 4):
                p = _px(xx + rng.uniform(-0.4, 0.4), yy + rng.uniform(-0.4, 0.4), 0.05)
                tufts_d.ball(0.2, p, 1, 1, 0.8)
                tufts_l.ball(0.12, (p[0] - 0.05, p[1] + 0.05, p[2] + 0.14), 1, 1, 0.6)
        tufts_d.put(T("#dca24a"), "rice", line=False)
        tufts_l.put(T("#fbe39a"), "rice_hi", line=False)
    # あぜ（田んぼの間の土手）と彼岸花
    ridge = Batch()
    for x0, y0, x1, y1 in ((54, 70, 58, 128), (106, 70, 110, 128), (110, 98, 192, 100)):
        ridge.cube((x1 - x0) * 0.1, (y1 - y0) * 0.1, 0.12, _px((x0 + x1) / 2, (y0 + y1) / 2, 0.06))
    ridge.put(T("#46b03a"), "aze")
    lily = Batch()
    for k in range(22):
        x, y = rng.choice([(56, rng.uniform(72, 126)), (108, rng.uniform(72, 96)), (rng.uniform(4, 188), 69)])
        lily.ball(0.09, _px(x + rng.uniform(-0.6, 0.6), y, 0.18), 1, 1, 0.6)
    lily.put(T("#f24a2a"), "higanbana")
    # あぜ道（山椒は道ばたに出る）
    put(cube(19.2, 1.0, 0.06, _px(96, 62, 0.01)), T3("road", "#f4cc62", "#dca24a", "#b87838", noise=0.35, scale=5), "road")
    ruts = Batch()
    for y in (60, 64):
        ruts.cube(19.2, 0.08, 0.02, _px(96, y, 0.05))
    pebbles = Batch()
    for k in range(30):
        pebbles.ball(0.06, _px(rng.uniform(0, 192), rng.uniform(58, 66), 0.06), 1.3, 1, 0.5)
    ruts.put(FLAT("#b87838"), "ruts", line=False)
    pebbles.put(T("#aaa292"), "pebbles")
    # 池（マコモは池のまわりに出る）
    pond = bmesh.new()
    bmesh.ops.create_circle(pond, cap_ends=True, segments=24, radius=1.0)
    transform_bm(pond, scale=(4.6, 1.8, 1), loc=_px(152, 116, 0.07))
    put(pond, T3("pond", "#5070b0", "#34569a", "#243f7a", noise=0.2, scale=4, line="#172b58"), "pond")
    rim = Batch()
    for k in range(18):
        a = k / 18 * 6.28
        rim.ball(0.22, _px(152 + math.cos(a) * 47, 116 + math.sin(a) * 18.5, 0.08), 1.3, 1, 0.5)
    rim.put(T("#aaa292"), "pond_stones")
    pads = Batch()
    for k in range(7):
        pads.cone(0.3, 0.3, 0.02, _px(rng.uniform(124, 182), rng.uniform(108, 124), 0.09), seg=10)
    pads.put(T("#46b03a"), "lily_pads")
    reeds = Batch()
    for k in range(40):
        a = rng.uniform(3.4, 6.0)
        reeds.cone(0.05, 0.0, 0.6, _px(152 + math.cos(a) * rng.uniform(40, 50), 116 + math.sin(a) * rng.uniform(15, 21), 0.05), seg=4)
    reeds.put(T("#1f6a2c"), "reeds")
    # 里山：木（蜂の巣がさがる3本）・竹やぶ・わらぶきの家
    trees = (Batch(), Batch(), Batch())
    for tx in (28, 96, 164):
        ty = 28
        tr = Batch()
        tr.cone(0.28, 0.22, 1.0, _px(tx, 44, 0), seg=8)
        tr.cube(0.18, 1.0, 0.14, _px(tx, 38, 1.0))
        tr.put(T("#5a3218"), "trunk")
        b = Batch()
        b.ball(1.35, _px(tx, ty, 1.4), 1, 1, 0.6)
        b.put(T("#1f6a2c"), "canopy")
        hi = Batch()
        for k in range(4):
            a = k * 1.6 + 0.4
            hi.ball(0.55, _px(tx - 3 + math.cos(a) * 5, ty - 4 + math.sin(a) * 4, 2.0), 1, 1, 0.6)
        hi.put(T("#46b03a"), "canopy_hi")
    for k in range(26):
        x, y = rng.uniform(0, 192), rng.uniform(0, 14)
        if any(abs(x - tx) < 16 for tx in (28, 96, 164)) and y > 4:
            continue
        tree(*trees, *_px(x, y)[:2], rng.uniform(0.5, 0.8), 0.0, rng, trunk=False)
    trees[1].put(T("#1f6a2c"), "woods")
    trees[2].put(T("#a8e05a"), "woods_hi")
    bamboo = Batch()
    for k in range(14):
        bamboo.cone(0.06, 0.06, 1.2, _px(rng.uniform(176, 192), rng.uniform(36, 54), 0), seg=5)
        bamboo.ball(0.3, _px(rng.uniform(176, 192), rng.uniform(36, 54), 1.2), 1, 1, 0.5)
    bamboo.put(T("#a8e05a"), "bamboo")
    put(cube(1.5, 1.0, 0.4, _px(132, 47, 0.2)), T("#d6ccb8"), "farm_wall")
    th = Batch()
    th.roof(2.0, 1.4, 0.8, _px(132, 47, 0.4), hip=0.5)
    th.put(T("#b87838"), "farm_thatch")
    # かかし
    put(cube(0.1, 0.9, 0.05, _px(80, 100, 0.4)), T("#8c5228"), "kakashi_arm")
    put(ball(0.28, _px(80, 99, 0.6), 1, 1, 0.5), T("#dca24a"), "kakashi_hat", smooth=True)
    _top_cam()
    common.render_to(os.path.join(out, "bg_forage.png"))


def _hunt(out, rng):
    """山の追い込み（真上）：森にかこまれた草地、奥に柵の罠（下が入口）"""
    bg_scene(*GAME_PX)
    common.noline(put(cube(19.2, 12.8, 0.1, _px(96, 64, -0.06)), T3("hunt_grass", "#a8e05a", "#46b03a", "#1f6a2c", noise=0.3, scale=2.5), "grass"))
    # けもの道（下から罠へ）
    path = [(96 + math.sin(t * 0.12) * 6, t) for t in range(128, 18, -4)]
    put(ribbon([_px(x, y)[:2] for x, y in path], 1.4, 0.0), T3("trail", "#dca24a", "#b87838", "#8c5228", noise=0.3, scale=4), "trail")
    # 森（上と左右）。罠のまわりはあける
    woods = (Batch(), Batch(), Batch())
    for k in range(120):
        x, y = rng.uniform(-4, 196), rng.uniform(-4, 128)
        edge = y < 30 or x < 18 or x > 174
        if not edge:
            continue
        if 68 < x < 124 and y < 30:
            continue
        if x < 26 and y > 92:
            continue   # 左下（マテオが立つ所）
        tree(*woods, *_px(x, y)[:2], rng.uniform(0.6, 1.0), 0.0, rng, trunk=False)
    woods[1].put(T("#1f6a2c"), "forest")
    woods[2].put(T("#46b03a"), "forest_hi")
    # 草地の小物：岩・倒木・しげみ・花
    rocks = Batch()
    for k in range(10):
        rocks.ball(0.32, _px(rng.uniform(24, 168), rng.uniform(36, 124), 0.1), rng.uniform(1, 1.6), 1, 0.6)
    rocks.put(T("#aaa292"), "rocks")
    log = Batch()
    log.cone(0.22, 0.2, 2.6, (0, 0, 0), seg=8)
    ob = log.put(T("#8c5228"), "log")
    ob.rotation_euler = (math.pi / 2, 0, 0.5)
    ob.location = _px(40, 70, 0.2)
    bush = Batch()
    for k in range(18):
        bush.ball(0.4, _px(rng.uniform(22, 170), rng.uniform(40, 126), 0.2), 1.2, 1, 0.6)
    bush.put(T("#1f6a2c"), "bushes")
    flowers = Batch()
    for k in range(40):
        flowers.ball(0.07, _px(rng.uniform(20, 172), rng.uniform(34, 126), 0.12), 1, 1, 0.5)
    flowers.put(T("#fbe39a"), "flowers")
    # 罠：踏み固めた土・杭の柵（左右と奥）。下（y=22）が入口
    put(cube(4.0, 1.9, 0.04, _px(96, 14, 0.0)), T3("trap_floor", "#dca24a", "#b87838", "#8c5228", noise=0.3, scale=5), "trap_floor")
    stakes = Batch()
    for fx in range(72, 121, 3):
        stakes.cone(0.14, 0.08, 0.9, _px(fx, 5, 0), seg=6)
    for fy in range(8, 25, 3):
        for fx in (73, 119):
            stakes.cone(0.14, 0.08, 0.9, _px(fx, fy, 0), seg=6)
    stakes.put(T("#8c5228"), "stakes")
    rails = Batch()
    rails.cube(4.8, 0.12, 0.1, _px(96, 5, 0.6))
    for fx in (73, 119):
        rails.cube(0.12, 2.0, 0.1, _px(fx, 15, 0.6))
    rails.put(T("#5a3218"), "rails")
    _top_cam()
    common.render_to(os.path.join(out, "bg_hunt.png"))


def _smuggle(out, rng):
    """長崎の抜け荷（横・夜）：月と星・町の灯・出島の蔵・石垣の上を見回る役人・石畳の道・桟橋と唐船"""
    bg_scene(*GAME_PX)
    # 夜空と星・月・雲
    for y0, y1, c in ((0, 20, "#0d1830"), (20, 40, "#172b58")):
        fband(y0, y1, c, d=16)
    stars = Batch()
    for k in range(40):
        stars.cube(0.08, 0.05, 0.08, _fx(rng.uniform(0, 192), rng.uniform(1, 26), 15))
    stars.put(FLAT("#ffe6b0"), "stars", line=False)
    moon = Batch()
    moon.ball(0.75, _fx(152, 14, 14), 1, 0.2, 1)
    moon.put(T3("moon", "#fffaf0", "#ffe6b0", "#f5b860"), "moon")
    cl = (Batch(), Batch(), Batch())
    for x, y, w in ((40, 10, 30), (120, 22, 22), (182, 8, 18)):
        cloud(*cl, x, y, w, d=13, rng=rng)
    cl[0].put(FLAT("#34569a"), "cloud_hi", line=False)
    cl[1].put(FLAT("#243f7a"), "cloud")
    cl[2].put(FLAT("#172b58"), "cloud_lo", line=False)
    # 長崎の山と町の灯
    hills = Batch()
    for x, w, h in ((10, 50, 18), (70, 46, 14), (130, 40, 16), (186, 40, 20)):
        hills.ball(1.0, _fx(x, 42, 12), w * 0.06, 0.2, h * 0.1)
    hills.put(T3("hills", "#243f7a", "#172b58", "#0d1830"), "hills")
    town = Batch()
    for k in range(26):
        town.cube(0.1, 0.05, 0.08, _fx(rng.uniform(4, 188), rng.uniform(30, 40), 11.5))
    town.put(FLAT("#f5b860"), "town_lights", line=False)
    # 出島の蔵（役人はこの前、y=56 を見回る）
    walls, roofs, wins = Batch(), Batch(), Batch()
    x = 2
    while x < 146:
        w = rng.uniform(16, 24)
        h = rng.uniform(14, 22)
        walls.cube(w * 0.1, 0.4, h * 0.1, _fx(x + w / 2, 56 - h / 2, 4))
        rf = Batch()
        rf.roof(w * 0.1 + 0.3, 0.9, 0.5, _fx(x + w / 2, 56 - h, 4.2))
        rf.put(T("#243f7a"), "kura_roof")
        if rng.random() < 0.7:
            wins.cube(0.4, 0.05, 0.3, _fx(x + w / 2, 56 - h * 0.6, 3.7))
        x += w + rng.uniform(1, 4)
    walls.put(T("#76726a"), "kura_walls")
    wins.put(FLAT("#f5b860"), "kura_windows")
    doors = Batch()
    for x in (30, 92):
        doors.cube(0.6, 0.05, 0.8, _fx(x, 52, 3.75))
    doors.put(T("#2e1a12"), "kura_doors")
    # 石垣（上が見回りの通り）
    put(cube(14.8, 0.6, 0.35, _fx(74, 57.5, 3.0)), T("#4a4658"), "walk")
    stones = (Batch(), Batch())
    for row, y in enumerate(range(60, 89, 4)):
        x = -(row % 2) * 4.0
        while x < 148:
            w = rng.uniform(6, 10)
            (stones[0] if rng.random() < 0.55 else stones[1]).cube(w * 0.1 - 0.06, 0.4, 0.34, _fx(min(147, x + w / 2), y, 3.0))
            x += w
    stones[0].put(T("#4a4658"), "ishigaki")
    stones[1].put(T("#76726a"), "ishigaki_hi")
    # 港の海（船のまわり）と月の光
    flat(cube(4.6, 0.3, 3.4, _fx(170, 74, 3.5)), "#172b58", "harbor")
    ref = Batch()
    for k in range(8):
        ref.cube(rng.uniform(0.2, 0.6), 0.05, 0.06, _fx(152 + rng.uniform(-2, 2), 62 + k * 3.2, 3.2))
    ref.put(FLAT("#ffe6b0"), "moon_road", line=False)
    rip = Batch()
    for k in range(12):
        rip.cube(rng.uniform(0.3, 0.6), 0.05, 0.05, _fx(rng.uniform(150, 190), rng.uniform(60, 90), 3.25))
    rip.put(FLAT("#243f7a"), "ripples", line=False)
    # 唐船（x=172 に横づけ）
    hull = Batch()
    hull.cube(3.6, 0.6, 0.9, _fx(173, 82, 2.4))
    hull.cube(0.8, 0.6, 1.3, _fx(188, 78, 2.4))
    hull.put(T("#5a3218"), "hull")
    put(cube(3.6, 0.62, 0.12, _fx(173, 79, 2.35)), T("#b8323a"), "hull_band")
    put(cube(0.12, 0.2, 5.0, _fx(170, 52, 2.2)), T("#2e1a12"), "mast")
    put(cube(1.7, 0.06, 2.0, _fx(170, 43, 2.1)), T("#d6ccb8"), "sail")
    battens = Batch()
    for k in range(6):
        battens.cube(1.8, 0.04, 0.1, _fx(170, 34 + k * 4, 2.0))
    battens.put(T("#5a3218"), "battens", line=False)
    put(cube(0.5, 0.05, 0.3, _fx(173, 26, 2.1)), T("#f24a2a"), "flag")
    # 石畳の道（マテオの足もと y=100）と桟橋
    put(cube(19.2, 0.6, 2.4, _fx(96, 100, 2.0)), T("#4a4658"), "road_base")
    tiles = (Batch(), Batch())
    for row, y in enumerate(range(90, 112, 5)):
        x = -(row % 2) * 4
        while x < 192:
            w = rng.uniform(7, 10)
            (tiles[0] if rng.random() < 0.5 else tiles[1]).cube(w * 0.1 - 0.08, 0.3, 0.42, _fx(x + w / 2, y, 1.8))
            x += w
    tiles[0].put(T("#76726a"), "ishidatami")
    tiles[1].put(T("#aaa292"), "ishidatami_hi")
    planks = Batch()
    for k in range(9):
        planks.cube(0.45, 0.3, 0.5, _fx(152 + k * 5, 92, 1.7))
    planks.put(T("#8c5228"), "pier")
    # 手前の海と杭
    flat(cube(19.2, 0.3, 1.8, _fx(96, 120, 1.0)), "#0d1830", "front_sea")
    rip2 = Batch()
    for k in range(14):
        rip2.cube(rng.uniform(0.3, 0.8), 0.05, 0.05, _fx(rng.uniform(0, 192), rng.uniform(115, 127), 0.9))
    rip2.put(FLAT("#172b58"), "front_ripples", line=False)
    posts = Batch()
    for x in (10, 48, 86, 124, 162):
        posts.cube(0.3, 0.3, 1.4, _fx(x, 116, 0.8))
    posts.put(T("#2e1a12"), "posts")
    # 荷車（x=22）と、俵・樽（石垣の足もと）
    cart = Batch()
    cart.cube(2.0, 0.4, 0.25, _fx(22, 92, 1.4))
    cart.cube(1.4, 0.05, 0.08, _fx(34, 94, 1.4))
    cart.put(T("#8c5228"), "cart")
    wheels = Batch()
    wheels.cone(0.4, 0.4, 0.1, (0, 0, 0), seg=12)
    ob = wheels.put(T("#2e1a12"), "wheel")
    ob.rotation_euler = (math.pi / 2, 0, 0)
    ob.location = _fx(15, 96, 1.2)
    w2 = Batch()
    w2.cone(0.4, 0.4, 0.1, (0, 0, 0), seg=12)
    ob = w2.put(T("#2e1a12"), "wheel2")
    ob.rotation_euler = (math.pi / 2, 0, 0)
    ob.location = _fx(29, 96, 1.2)
    bales = Batch()
    for x in (18, 26):
        bales.ball(0.45, _fx(x, 87, 1.5), 1, 0.6, 0.8)
    bales.put(T("#dca24a"), "tawara")
    for i, bx in enumerate((63, 111)):
        b = Batch()
        b.cone(0.36, 0.36, 0.9, (0, 0, 0), seg=10)
        ob = b.put(T("#b87838"), "taru")
        ob.location = _fx(bx, 93, 2.6)
    crates = Batch()
    crates.cube(0.8, 0.5, 0.7, _fx(150, 85, 2.6))
    crates.cube(0.6, 0.5, 0.5, _fx(156, 87, 2.55))
    crates.put(T("#8c5228"), "crates")
    # 蔵の提灯
    lan = Batch()
    for x in (24, 86, 132):
        lan.ball(0.22, _fx(x, 46, 3.6), 1, 0.3, 1.2)
    lan.put(FLAT("#f24a2a"), "chochin")
    _front_cam()
    common.render_to(os.path.join(out, "bg_smuggle.png"))
