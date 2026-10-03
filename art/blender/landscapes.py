"""町の地図とミニゲームの背景（人物と同じセル調：光の向きで3段の塗り分け＋線）。

ゲームの座標に合わせて作る（変えるとゲームの当たり判定とずれる所）：
  ・一本釣り（横）  海面 y=40、小舟 x 8〜42、魚は y 70〜82 を泳ぐ
  ・里山（横）      木 x=28,96,164（蜂の巣は FORAGE_SPOTS の枝の下）、山椒のやぶ、あぜ道 y 60〜70、田んぼ x 0〜116、池 x 122〜192（forage.js の SPOTS と同じ）
  ・山（真上）      罠 x 78〜114 y 6〜22（下が入口）、獣は y 100〜116 から上へ走る
  ・長崎の闇商人    384×216。闇商人は x=192 に立つ（足もと y=212）。盆（白い布）の上の椀は x=132,192,252、椀の底 y=194
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
CLASSIC = False   # True のあいだは、前の塗り方（光で照らした陰影と色むら、線なし）で作り、*_classic.png に書き出す
LIGHT_MODE = "day"


def _out(out, name):
    """書き出す名前（前の塗り方のときは *_classic.png）"""
    return os.path.join(out, name.replace(".png", "_classic.png") if CLASSIC else name)


def classic_job(fn, light="day"):
    """その job を、前の塗り方で作る"""
    def run(out):
        global CLASSIC, LIGHT_MODE
        CLASSIC, LIGHT_MODE = True, light
        try:
            return fn(out)
        finally:
            CLASSIC, LIGHT_MODE = False, "day"
    return run


def T(color):
    """パレットの色 → 人物と同じ「影・地・明るい」の3段（people.RAMP）。前の塗り方なら、光で照らす色むらの材質"""
    if CLASSIC:
        from people import RAMP
        sh, li, _ = RAMP.get(color, (color, color, color))
        return common.cached_material("cl_" + color.strip("#"), lambda n: common.object_noise_material(n, [(0.0, li), (0.5, color), (1.0, sh)], scale=6.0, roughness=0.75))
    return scenes.M(color)


def T3(name, light, mid, dark, noise=0.0, scale=8.0, line=None):
    if CLASSIC:
        return common.cached_material("cl_" + name, lambda n: common.object_noise_material(n, [(0.0, light), (0.5, mid), (1.0, dark)], scale=max(2.0, scale), roughness=0.75))
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
    if CLASSIC:
        # 前の塗り方：日の光（夜は月と提灯）で照らす。線は引かない
        scene.cycles.samples = 32
        scene.cycles.use_denoising = True
        if LIGHT_MODE == "night":
            common.add_night_world(color=(0.35, 0.4, 0.6), strength=0.7)
            common.add_lantern_light(direction_from=(0.6, -1.0, 1.2), strength=0.9, color=(0.65, 0.72, 1.0))
        else:
            common.add_night_world(color=(0.75, 0.8, 0.9), strength=0.8)
            common.add_lantern_light(direction_from=(-0.8, -1.0, 1.5), strength=3.2, color=(1.0, 0.95, 0.85))
        return
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
    "kokyu": (0.6, 2.5, 0.3),   # 日本橋の大店・伊勢屋（高級な材料）
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
    common.render_to(_out(out, "map.png"))
    scene = bpy.context.scene
    pos = {}
    for k, p in PLACES.items():
        v = world_to_camera_view(scene, cam, Vector(p))
        pos[k] = [round(v.x, 4), round(1 - v.y, 4)]
    if CLASSIC:
        return   # 地名の場所は同じなので、JSON は書かない
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
    common.render_to(_out(out, "bg_fishing.png"))


# 里山の採集ものが出る場所（forage.js の SPOTS と同じにする）
FORAGE_NESTS = [(42, 50), (110, 46), (150, 50)]          # 蜂の巣（枝の先からさがる）
FORAGE_BUSHES = [12, 54, 74, 124, 140, 184]               # 山椒のやぶ（あぜ道の奥、y=54）


def _forage(out, rng):
    """田んぼと里山（横から）：青空・遠い山・里山と農家・大きな木（蜂の巣）・山椒のやぶ・あぜ道・実った田んぼ・池とマコモ"""
    bg_scene(*GAME_PX)
    fband(0, 46, "#5070b0", d=18)
    cl = (Batch(), Batch(), Batch())
    for x, y, w in ((22, 8, 26), (126, 6, 30), (184, 14, 18)):
        cloud(*cl, x, y, w, d=17, rng=rng)
    cl[0].put(FLAT("#fffaf0"), "cloud_hi", line=False)
    cl[1].put(FLAT("#fffaf0"), "cloud")
    cl[2].put(FLAT("#d6ccb8"), "cloud_lo", line=False)
    far = Batch()
    for x, w, h in ((10, 40, 16), (60, 46, 22), (120, 40, 14), (176, 50, 20)):
        far.ball(1.0, _fx(x, 44, 16), w * 0.06, 0.2, h * 0.1)
    far.put(T3("far_hills", "#5070b0", "#34569a", "#243f7a"), "far_hills")
    hills = Batch()
    for x, w, h in ((-6, 50, 18), (44, 56, 14), (110, 60, 16), (180, 50, 20)):
        hills.ball(1.0, _fx(x, 56, 14), w * 0.06, 0.2, h * 0.1)
    hills.put(T("#46b03a"), "hills")
    clumps = (Batch(), Batch(), Batch())
    for k in range(16):
        x = rng.uniform(0, 192)
        clumps[1].ball(rng.uniform(0.35, 0.6), _fx(x, rng.uniform(40, 48), 13), 1.2, 0.3, 1.0)
    clumps[1].put(T("#1f6a2c"), "clumps")
    # 農家（わらぶき）
    put(cube(2.0, 0.6, 0.9, _fx(138, 47, 12.5)), T("#d6ccb8"), "farm_wall")
    th = Batch()
    th.roof(2.6, 1.0, 0.9, _fx(138, 42.5, 12.5), hip=0.6)
    th.put(T("#b87838"), "farm_thatch")
    put(cube(0.5, 0.05, 0.5, _fx(132, 48, 12.15)), T("#2e1a12"), "farm_door")
    # 大きな木（幹・葉・蜂の巣がさがる枝）
    trunks, leaves_d, leaves_l = Batch(), Batch(), Batch()
    for tx in (28, 96, 164):
        trunks.cube(0.55, 0.5, 3.4, _fx(tx, 46, 9))
        for k in range(7):
            a = k / 7 * 6.28
            leaves_d.ball(rng.uniform(0.75, 0.95), _fx(tx + math.cos(a) * 11, 24 + math.sin(a) * 7, 8.6), 1.2, 0.4, 1.0)
        leaves_d.ball(1.1, _fx(tx, 24, 8.7), 1.4, 0.4, 1.0)
        for k in range(4):
            leaves_l.ball(0.55, _fx(tx - 6 + k * 3.5, 17 + (k % 2) * 3, 8.2), 1.2, 0.4, 0.9)
    for (nx, ny), tx in zip(FORAGE_NESTS, (28, 96, 164)):
        trunks.cube(abs(nx - tx) * 0.1 + 0.4, 0.3, 0.22, _fx((nx + tx) / 2 + (2 if nx > tx else -2), ny - 13, 8.8))
    trunks.put(T("#5a3218"), "trunks")
    leaves_d.put(T("#1f6a2c"), "leaves")
    leaves_l.put(T("#46b03a"), "leaves_hi")
    # 山椒のやぶ（あぜ道の奥）
    bush_d, bush_l = Batch(), Batch()
    for bx in FORAGE_BUSHES:
        bush_d.ball(0.9, _fx(bx, 58, 7), 1.3, 0.4, 0.75)
        bush_l.ball(0.45, _fx(bx - 3, 54, 6.8), 1.2, 0.4, 0.8)
    bush_d.put(T("#1f6a2c"), "bushes")
    bush_l.put(T("#46b03a"), "bushes_hi")
    # 草とあぜ道（池の奥も草地）
    fband(46, 96, "#46b03a", d=10)
    put(cube(19.2, 0.4, 1.0, _fx(96, 65, 6)), T3("aze_road", "#f4cc62", "#dca24a", "#b87838", noise=0.3, scale=5), "road")
    ruts = Batch()
    for y in (63, 67):
        ruts.cube(19.2, 0.05, 0.08, _fx(96, y, 5.7))
    ruts.put(FLAT("#b87838"), "ruts", line=False)
    pebbles = Batch()
    for k in range(18):
        pebbles.ball(0.12, _fx(rng.uniform(0, 192), rng.uniform(62, 69), 5.6), 1.3, 0.3, 0.7)
    pebbles.put(T("#aaa292"), "pebbles")
    lily = Batch()   # 彼岸花（あぜの赤い花）
    for k in range(10):
        x = rng.uniform(4, 188)
        lily.cube(0.04, 0.05, 0.5, _fx(x, 69, 5.4))
        lily.ball(0.16, _fx(x, 66.5, 5.3), 1.2, 0.3, 0.8)
    lily.put(T("#f24a2a"), "higanbana")
    # 田んぼ（手前・左）：泥と水の上に、実った稲の株の列
    put(cube(11.8, 0.4, 6.0, _fx(58, 99, 4.5)), T3("paddy_mud", "#b87838", "#8c5228", "#5a3218", noise=0.3, scale=4), "paddy_mud")
    for row, base in enumerate((80, 92, 104, 116, 128)):
        stalks, heads = Batch(), Batch()
        size = 0.75 + row * 0.12
        x = rng.uniform(0, 3)
        while x < 116:
            h = rng.uniform(10, 14) * size
            stalks.cube(0.08 * size, 0.05, h * 0.1, _fx(x, base - h / 2, 4.0 - row * 0.5))
            heads.ball(0.22 * size, _fx(x + 1.4 * size, base - h + 1.5, 3.95 - row * 0.5), 0.8, 0.3, 1.3)
            x += rng.uniform(2.6, 3.6) * size
        stalks.put(T("#b87838"), "stalks", line=False)
        heads.put(T("#f4cc62"), "rice_heads")
    # 田んぼと池のあいだの土手
    put(cube(0.9, 0.4, 5.0, _fx(119, 104, 4.0)), T("#46b03a"), "bank")
    # 池（手前・右）：水面・さざなみ・奥のアシ
    reeds = Batch()
    for k in range(26):
        x = rng.uniform(124, 192)
        h = rng.uniform(10, 18)
        reeds.cube(0.1, 0.05, h * 0.1, _fx(x, 90 - h / 2, 4.6))
    reeds.put(T("#1f6a2c"), "reeds")
    fband(88, 92, "#5070b0", d=4.4, x0=122, x1=192)
    fband(92, 128, "#34569a", d=4.4, x0=122, x1=192)
    rip = Batch()
    for k in range(14):
        rip.cube(rng.uniform(0.3, 0.7), 0.05, 0.06, _fx(rng.uniform(124, 190), rng.uniform(95, 126), 4.2))
    rip.put(FLAT("#5070b0"), "ripples", line=False)
    pads = Batch()
    for k in range(5):
        pads.ball(0.4, _fx(rng.uniform(128, 188), rng.uniform(100, 124), 4.1), 1.4, 0.3, 0.25)
    pads.put(T("#46b03a"), "lily_pads")
    _front_cam()
    common.render_to(_out(out, "bg_forage.png"))


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
    common.render_to(_out(out, "bg_hunt.png"))


YAMI_PX = (384, 216)


def _yx(x, y, d=0.0):
    """闇商人の場面（384×216、横から）：画面の1ドット = 0.1"""
    return (x * 0.1 - 19.2, d, -(y * 0.1 - 10.8))


def _yami_cam():
    cd = bpy.data.cameras.new("Cam")
    cd.type = "ORTHO"
    cd.ortho_scale = 38.4
    ob = common.link(bpy.data.objects.new("Cam", cd))
    ob.location = (0, -40, 0)
    ob.rotation_euler = (math.pi / 2, 0, 0)
    bpy.context.scene.camera = ob
    return ob


def _yband(y0, y1, color, d, x0=0, x1=384):
    return flat(cube((x1 - x0) * 0.1, 0.05, (y1 - y0) * 0.1, _yx((x0 + x1) / 2, (y0 + y1) / 2, d)), color, "band")


@toon_job
def job_yami(out):
    """長崎・唐人屋敷の裏の蔵：闇商人と「椀の玉当て」をする場所"""
    rng = rng_for("yami")
    # --- 奥（背景）---
    bg_scene(*YAMI_PX)
    _yband(0, 216, "#5a3218", d=20)
    planks = Batch()
    for x in range(0, 384, 16):
        planks.cube(1.5, 0.3, 21.6, _yx(x + 8, 108, 19.5))
    planks.put(T3("kura_planks", "#8c5228", "#5a3218", "#2e1a12", noise=0.1, scale=2), "planks")
    beams = Batch()
    for y in (22, 112):
        beams.cube(38.4, 0.6, 1.0, _yx(192, y, 19))
    for x in (40, 344):
        beams.cube(1.2, 0.6, 21.6, _yx(x, 108, 18.9))
    beams.put(T("#2e1a12"), "beams")
    # 円窓（夜空と月、竹の格子）
    win = bmesh.new()
    bmesh.ops.create_circle(win, cap_ends=True, segments=32, radius=2.8)
    transform_bm(win, rot_x=math.pi / 2, loc=_yx(82, 66, 18.7))
    put(win, FLAT("#172b58"), "window")
    rim = bmesh.new()
    bmesh.ops.create_circle(rim, cap_ends=True, segments=32, radius=3.2)
    transform_bm(rim, rot_x=math.pi / 2, loc=_yx(82, 66, 18.8))
    put(rim, T("#2e1a12"), "window_rim")
    moon = Batch()
    moon.ball(0.9, _yx(92, 56, 18.6), 1, 0.2, 1)
    moon.put(FLAT("#ffe6b0"), "moon", line=False)
    lattice = Batch()
    for k in (-1, 0, 1):
        lattice.cube(0.12, 0.1, 5.6, _yx(82 + k * 14, 66, 18.5))
        lattice.cube(5.6, 0.1, 0.12, _yx(82, 66 + k * 14, 18.5))
    lattice.put(T("#8c5228"), "lattice")
    # 抜け荷の山（右）：木箱・樽・俵・唐物の壺
    crates = Batch()
    for (x, y, w, h) in ((300, 130, 44, 34), (346, 130, 40, 34), (322, 98, 40, 30), (366, 100, 32, 28)):
        crates.cube(w * 0.1, 2.0, h * 0.1, _yx(x, y, 15))
    crates.put(T("#b87838"), "crates")
    ropes = Batch()
    for (x, y, w, h) in ((300, 130, 44, 34), (346, 130, 40, 34), (322, 98, 40, 30)):
        ropes.cube(w * 0.1 + 0.05, 2.05, 0.18, _yx(x, y, 15))
        ropes.cube(0.18, 2.05, h * 0.1 + 0.05, _yx(x, y, 15))
    ropes.put(T("#dca24a"), "ropes")
    jar = Batch()
    jar.ball(1.5, _yx(262, 128, 14), 1, 1, 1.15)
    jar.cone(0.7, 0.9, 0.6, _yx(262, 112, 14), seg=14)
    jar.put(T("#fffaf0"), "tsubo")
    jarpat = Batch()
    for k in range(5):
        a = -0.9 + k * 0.45
        jarpat.ball(0.3, (_yx(262, 128, 14)[0] + math.sin(a) * 1.3, _yx(262, 128, 14)[1] - 1.25, _yx(262, 128, 14)[2] + math.cos(a * 2) * 0.4), 1, 0.3, 1)
    common.noline(jarpat.put(T("#34569a"), "tsubo_pat"))
    # 俵（横に寝かせた円柱に、縄の帯）
    for (x, y) in ((26, 150), (62, 150), (44, 124)):
        b = Batch()
        b.cone(1.25, 1.25, 3.0, (0, 0, -1.5), seg=14)
        for k in (-1, 0, 1):
            b.cone(1.3, 1.3, 0.22, (0, 0, k * 0.9 - 0.11), seg=14)
        ob = b.put(T("#dca24a"), "tawara")
        ob.rotation_euler = (0, math.pi / 2, 0)
        ob.location = _yx(x, y, 15)
    # 赤い唐提灯（金のふさ）
    if CLASSIC:
        for (x, y) in ((150, 30), (306, 36)):
            scenes.point_light(_yx(x, y + 6, 11), color=(1.0, 0.55, 0.3), power=600, radius=1.5)
    for (x, y) in ((150, 30), (306, 36)):
        put(ball(1.4, _yx(x, y, 13), 1, 1, 1.15), FLAT("#f24a2a"), "lantern", smooth=True)
        put(cube(1.6, 1.6, 0.35, _yx(x, y - 15, 13)), T("#dca24a"), "lantern_top")
        put(cube(1.6, 1.6, 0.35, _yx(x, y + 15, 13)), T("#dca24a"), "lantern_bot")
        tassel = Batch()
        tassel.cube(0.2, 0.2, 1.4, _yx(x, y + 24, 13))
        tassel.put(T("#f4cc62"), "tassel")
        ribs = Batch()
        for k in (-1, 0, 1):
            ribs.cube(2.9, 0.1, 0.1, _yx(x, y + k * 6, 11.55))
        common.noline(ribs.put(FLAT("#c42618"), "ribs"))
    # 床
    _yband(160, 216, "#2e1a12", d=10)
    _yami_cam()
    common.render_to(_out(out, "bg_yami.png"))

    # --- 手前の盆（白い布をかけた台）と、端の銭 ---
    bg_scene(*YAMI_PX)
    bpy.context.scene.render.film_transparent = True
    put(cube(28.0, 0.6, 2.4, _yx(192, 190, 3)), T3("bon_cloth", "#fffaf0", "#f0e6d2", "#d6ccb8", noise=0.08, scale=3), "bon_cloth")
    put(cube(29.0, 0.8, 1.6, _yx(192, 209, 2.5)), T3("bon_wood", "#8c5228", "#5a3218", "#2e1a12", noise=0.15, scale=3), "bon_wood")
    put(cube(29.2, 0.82, 0.3, _yx(192, 202, 2.4)), T("#2e1a12"), "bon_edge")
    coins = Batch()
    for (x, n) in ((72, 4), (86, 3), (304, 5), (318, 2)):
        for k in range(n):
            coins.cube(1.0, 0.4, 0.17, _yx(x, 194 - k * 2.2, 2.6))
    coins.put(T("#f4cc62"), "zeni")
    if not CLASSIC:
        common.toon_lines(LINE, outer=True)
    _yami_cam()
    common.render_to(_out(out, "fg_yami.png"))

    # --- 伏せた椀（黒漆に朱のふち）と、賽 ---
    for name, px, build in (("yami_wan", (44, 36), _wan), ("yami_dice", (14, 14), _dice)):
        bg_scene(*px)
        bpy.context.scene.render.film_transparent = True
        build()
        cd = bpy.data.cameras.new("Cam")
        cd.type = "ORTHO"
        cd.ortho_scale = {"yami_wan": 2.3, "yami_dice": 0.8}[name]
        cam = common.link(bpy.data.objects.new("Cam", cd))
        look = Vector((0, 0, {"yami_wan": 0.62, "yami_dice": 0.12}[name]))
        loc = look + Vector((0, -10, 3.5))
        cam.location = loc
        cam.rotation_euler = (look - loc).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.camera = cam
        common.render_to(_out(out, name + ".png"))


def _wan():
    body = common.bm_lathe([(0.0, 1.1), (0.45, 1.08), (0.8, 0.95), (1.0, 0.6), (1.06, 0.2), (1.08, 0.04), (1.0, 0.0), (0.0, 0.0)], 32)
    put(body, T3("wan", "#4a4658", "#2e1a12", "#1c1220"), "wan", smooth=True)
    band = common.bm_lathe([(1.07, 0.0), (1.1, 0.02), (1.1, 0.16), (1.07, 0.18)], 32)
    put(band, T("#b8323a"), "wan_rim", smooth=True)
    foot = common.bm_lathe([(0.0, 1.1), (0.36, 1.1), (0.38, 1.22), (0.0, 1.22)], 24)
    put(foot, T("#b8323a"), "wan_foot", smooth=True)
    gold = common.bm_lathe([(1.03, 0.42), (1.05, 0.44), (1.05, 0.48), (1.03, 0.5)], 32)
    common.noline(put(gold, T("#f4cc62"), "wan_gold", smooth=True))


def _dice():
    put(cube(0.36, 0.36, 0.36, (0, 0, 0.18), rz=0.5), T("#fffaf0"), "dice")
    common.noline(put(ball(0.07, (0, 0, 0.365), 1, 1, 0.3), FLAT("#f24a2a"), "pip", smooth=True))




# 前の塗り方（光で照らした陰影と色むら）の版。どちらを使うかは config.js の ART_STYLE.map / ART_STYLE.minigames
job_map_classic = classic_job(job_map)
job_minigames_classic = classic_job(job_minigames)
job_yami_classic = classic_job(job_yami, light="night")
