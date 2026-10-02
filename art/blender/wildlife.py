"""山の獣（猪・鹿・山の主）と、里山の採集もの（イナゴ・蜂の巣・山椒・マコモダケ）。人物と同じセル調と線。

獣は少し上から見た横向き（左を向いて走る4コマ）。ゲームは右へ走るときに左右を裏返して使う。
採集ものは横から見た絵（田んぼと里山の背景も横から見た絵）。
"""
import math
import os

import bpy
from mathutils import Vector

import common
import scenes
from common import bm_tube, link
from scenes import M, put, ball, cyl, toon_job


# ---------------------------------------------------------------------------
# 山の獣：左を向いて走る4コマ
# ---------------------------------------------------------------------------
ANIMALS = {
    # px = 絵の大きさ、ortho = 写す広さ、leg = 足の長さ、body = 胴の半径 (x, y, z)
    "boar":  dict(px=(36, 26), ortho=1.6, leg=0.2, body=(0.44, 0.27, 0.26), fur="#5a3218", fur2="#2e1a12", belly="#8c5228", snout="#d08a64", head="#8c5228"),
    "deer":  dict(px=(32, 28), ortho=1.75, leg=0.36, body=(0.4, 0.19, 0.21), fur="#b87838", fur2="#8c5228", belly="#f0e6d2", snout="#2e1a12"),
    "nushi": dict(px=(52, 38), ortho=2.0, leg=0.24, body=(0.6, 0.36, 0.36), fur="#2e1a12", fur2="#1c1220", belly="#5a3218", snout="#d08a64", head="#5a3218"),
}
FRAMES = 4


def _leg(x, y, z_hip, length, swing, bend, col, thick):
    """腰から下へ：swing = 前後のふり（ラジアン）、bend = ひざの曲がり"""
    knee = (x + math.sin(swing) * length * 0.5, y, z_hip - math.cos(swing) * length * 0.5)
    a = swing + bend
    foot = (knee[0] + math.sin(a) * length * 0.5, y, knee[2] - math.cos(a) * length * 0.5)
    put(bm_tube([(x, y, z_hip), knee, foot], [thick, thick * 0.85, thick * 0.7], 6), M(col), "leg")
    put(ball(thick * 0.95, (foot[0] - 0.01, y, foot[2]), 1.3, 1, 0.8), M("#1c1220"), "hoof")


def build_animal(key, f):
    S = ANIMALS[key]
    bx, by, bz = S["body"]
    ph = f / FRAMES * 2 * math.pi
    H = S["leg"] + bz * 0.8 + 0.03 * math.sin(ph * 2)   # 胴の高さ（走ると上下にゆれる）
    big = bx / 0.44
    # 胴（背中は濃い毛、おなかは明るい）
    put(ball(1.0, (0, 0, H), bx, by, bz, 3), M(S["fur"]), "body")
    put(ball(1.0, (0.02, -0.02, H - bz * 0.35), bx * 0.85, by * 0.85, bz * 0.55, 2), M(S["belly"]), "belly")
    # 足（ギャロップ：前足と後ろ足が交互に）
    thick = 0.055 * big if key != "deer" else 0.04
    for (lx, off) in ((-bx * 0.6, 0.0), (bx * 0.6, math.pi)):
        for side, d in ((-1, 0.0), (1, 0.5)):
            sw = 0.55 * math.sin(ph + off + d)
            _leg(lx, side * by * 0.55, H - bz * 0.3, S["leg"] + bz * 0.5, sw, -0.5 * (1 + math.sin(ph + off + d)) * (1 if lx > 0 else -1) * 0.6,
                 S["fur2"] if side > 0 else S["fur"], thick)
    if key == "deer":
        _deer_head(S, H, ph)
    else:
        _boar_head(S, H, big, key)
    # しっぽ
    tw = 0.3 * math.sin(ph * 2)
    if key == "deer":
        put(ball(0.07, (bx * 0.98, 0, H + bz * 0.45), 1, 0.8, 1.2), M("#fffaf0"), "tail")
        put(ball(0.13, (bx * 0.9, -0.02, H + bz * 0.1), 0.6, 1, 1.0), M("#fffaf0"), "rump")
    else:
        put(bm_tube([(bx * 0.95, 0, H + bz * 0.3), (bx * 1.12, 0, H + bz * 0.25 + 0.06 * tw), (bx * 1.2, 0, H + bz * 0.05)], [0.025 * big, 0.02 * big, 0.015 * big], 5), M(S["fur2"]), "tail")


def _eye(x, y, z, r):
    """丸い黒目と白いハイライト（こわくない顔に）"""
    put(ball(r, (x, y, z), 1, 0.6, 1.1), M("#1c1220"), "eye")
    common.noline(put(ball(r * 0.38, (x - r * 0.3, y - r * 0.55, z + r * 0.35)), M("#fffaf0"), "eye_hi"))


def _boar_head(S, H, big, key):
    bx, by, bz = S["body"]
    hx, hz = -bx * 1.02, H + bz * 0.05
    put(ball(0.23 * big, (hx, 0, hz), 1.05, 1.0, 0.95, 3), M(S["head"]), "head")
    # 鼻づら（前へのびる）と、先の桃色の鼻
    put(bm_tube([(hx - 0.12 * big, 0, hz - 0.04 * big), (hx - 0.3 * big, 0, hz - 0.08 * big)], [0.11 * big, 0.085 * big], 10), M(S["head"]), "snout")
    put(ball(0.07 * big, (hx - 0.3 * big, 0, hz - 0.08 * big), 0.6, 1.1, 1.0), M(S["snout"]), "snout_tip")
    ob = put(cyl(0.085 * big, 0.03, (0, 0, -0.015), seg=14), M(S["snout"]), "nose")
    ob.rotation_euler = (0, math.pi / 2, 0)
    ob.location = (hx - 0.31 * big, 0, hz - 0.08 * big)
    for s in (-1, 1):
        common.noline(put(ball(0.018 * big, (hx - 0.34 * big, s * 0.035 * big, hz - 0.07 * big)), M("#2e1a12"), "nostril"))
    # 牙（白く、上へ反る）
    tusk = 1.4 if key == "nushi" else 1.0
    for s in (-1, 1):
        put(bm_tube([(hx - 0.22 * big, s * 0.08 * big, hz - 0.1 * big), (hx - 0.29 * big, s * 0.1 * big, hz - 0.02 * big), (hx - 0.27 * big, s * 0.1 * big, hz + 0.06 * big * tusk)],
                    [0.028 * big * tusk, 0.022 * big * tusk, 0.008], 6), M("#fffaf0"), "tusk")
    # 耳
    for s in (-1, 1):
        put(cyl(0.07 * big, 0.12 * big, (hx + 0.07 * big, s * 0.12 * big, hz + 0.13 * big), seg=6, r2=0.01), M(S["fur2"]), "ear")
    # たてがみ（背中のとげとげ）
    for k in range(7):
        t = k / 6
        x = -bx * 0.75 + t * bx * 1.4
        z = H + bz * 0.92 - (abs(t - 0.35) ** 2) * bz * 0.6
        put(cyl(0.05 * big, 0.08 * big * (1.3 - abs(t - 0.35)), (x, 0, z), seg=5, r2=0.0), M(S["fur2"]), "mane")
    # 目
    eye_r = 0.055 * big if key != "nushi" else 0.055
    _eye(hx - 0.07 * big, -0.17 * big, hz + 0.07 * big, eye_r)
    if key == "nushi":   # 山の主：目のまわりの傷
        common.noline(put(bm_tube([(hx + 0.02, -0.19, hz + 0.16), (hx - 0.08, -0.2, hz + 0.02)], [0.012, 0.012], 4), M("#d08a64"), "scar"))


def _deer_head(S, H, ph):
    bx, by, bz = S["body"]
    nx, nz = -bx * 0.8, H + bz * 0.4
    hx, hz = -bx * 1.25, H + 0.42 + 0.02 * math.sin(ph)
    put(bm_tube([(nx, 0, nz), (hx + 0.06, 0, hz - 0.06)], [0.09, 0.07], 8), M(S["fur"]), "neck")
    put(ball(0.13, (hx, 0, hz), 1.1, 0.85, 0.9, 3), M(S["fur"]), "head")
    put(bm_tube([(hx - 0.06, 0, hz - 0.02), (hx - 0.2, 0, hz - 0.07)], [0.08, 0.055], 10), M(S["fur"]), "muzzle")
    put(ball(0.035, (hx - 0.22, 0, hz - 0.06)), M("#1c1220"), "nose")
    for s in (-1, 1):   # 大きな耳
        put(ball(0.07, (hx + 0.07, s * 0.12, hz + 0.08), 0.5, 1.4, 0.8), M(S["fur"]), "ear")
    # 角（枝分かれ）
    for s in (-1, 1):
        y = s * 0.05
        base = (hx + 0.03, y, hz + 0.1)
        top = (hx + 0.12, y + s * 0.06, hz + 0.42)
        put(bm_tube([base, (hx + 0.08, y + s * 0.03, hz + 0.26), top], [0.022, 0.018, 0.01], 5), M("#dca24a"), "antler")
        put(bm_tube([(hx + 0.08, y + s * 0.03, hz + 0.24), (hx - 0.04, y + s * 0.05, hz + 0.36)], [0.015, 0.008], 5), M("#dca24a"), "tine")
        put(bm_tube([(hx + 0.1, y + s * 0.05, hz + 0.34), (hx + 0.22, y + s * 0.07, hz + 0.44)], [0.013, 0.007], 5), M("#dca24a"), "tine")
    _eye(hx - 0.05, -0.1, hz + 0.03, 0.032)
    # 背中の白い斑点（鹿の子模様）
    for k, (x, z) in enumerate([(-0.2, 0.93), (-0.05, 0.98), (0.1, 0.96), (0.24, 0.9), (-0.12, 0.75), (0.05, 0.78), (0.2, 0.72)]):
        common.noline(put(ball(0.028, (x, -by * 0.75, H + bz * (z - 0.25)), 1.3, 0.5, 1), M("#fffaf0"), "spot"))


def _animal_camera(S):
    w, h = S["px"]
    cd = bpy.data.cameras.new("Cam")
    cd.type = "ORTHO"
    cd.ortho_scale = S["ortho"]
    cam = link(bpy.data.objects.new("Cam", cd))
    loc = Vector((-0.05, -10, 5.8))
    look = Vector((-0.05, 0, 0.42 * S["ortho"] / 1.75))
    cam.location = loc
    cam.rotation_euler = (look - loc).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam


# ---------------------------------------------------------------------------
# 里山の採集もの（横から）
# ---------------------------------------------------------------------------
FORAGE_PX = {"inago": (24, 16), "hachi": (24, 30), "sansho": (24, 24), "makomo": (20, 32)}


def _inago():
    put(ball(0.32, (0, 0, 0.2), 1.0, 0.32, 0.32, 3), M("#46b03a"), "body")
    put(ball(0.14, (-0.32, 0, 0.26), 1.0, 0.9, 1.1, 2), M("#46b03a"), "head")
    put(ball(0.26, (0.08, 0.0, 0.3), 1.2, 0.36, 0.25), M("#1f6a2c"), "wing")
    _eye(-0.38, -0.1, 0.3, 0.045)
    for s in (-1, 1):   # 触角
        put(bm_tube([(-0.38, s * 0.03, 0.38), (-0.5, s * 0.05, 0.58), (-0.62, s * 0.05, 0.62)], [0.012, 0.01, 0.006], 4), M("#1f6a2c"), "antenna")
    # 大きな後ろ足（くの字）と前足
    for s, col in ((-1, "#a8e05a"), (1, "#46b03a")):
        put(bm_tube([(0.05, s * 0.09, 0.22), (0.3, s * 0.12, 0.44), (0.42, s * 0.12, 0.04)], [0.06, 0.04, 0.02], 6), M(col), "hindleg")
        put(bm_tube([(-0.22, s * 0.08, 0.14), (-0.28, s * 0.12, 0.02)], [0.02, 0.015], 4), M(col), "foreleg")
        put(bm_tube([(-0.08, s * 0.08, 0.12), (-0.08, s * 0.13, 0.0)], [0.02, 0.015], 4), M(col), "midleg")


def _hachi():
    # 枝からさがる、紙のような蜂の巣（しま模様と、下の入口）
    put(bm_tube([(-0.6, 0.0, 0.92), (0.0, 0.0, 0.88), (0.6, 0.0, 0.95)], [0.05, 0.06, 0.04], 6), M("#5a3218"), "branch")
    put(bm_tube([(0.0, 0, 0.88), (0.0, 0, 0.72)], [0.03, 0.04], 6), M("#5a3218"), "stem")
    put(ball(0.34, (0, 0, 0.42), 1.0, 1.0, 1.15, 3), M("#d6ccb8"), "nest")
    for k, z in enumerate((0.62, 0.48, 0.34, 0.2)):
        r = 0.34 * math.sqrt(max(0.05, 1 - ((z - 0.42) / 0.39) ** 2)) + 0.01
        common.noline(put(cyl(r, 0.035, (0, 0, z), seg=20), M("#aaa292"), "band"))
    common.noline(put(ball(0.08, (0, -0.05, 0.05), 1, 1, 0.5), M("#2e1a12"), "hole"))
    # 巣のまわりの蜂（黄色と黒）
    for (x, z) in ((-0.42, 0.55), (0.4, 0.3)):
        put(ball(0.07, (x, -0.3, z), 1.4, 1, 1), M("#f4cc62"), "bee")
        ob = common.noline(put(cyl(0.072, 0.03, (0, 0, -0.015), seg=10), M("#1c1220"), "bee_stripe"))
        ob.rotation_euler = (0, math.pi / 2, 0)
        ob.location = (x + 0.02, -0.3, z)
        common.noline(put(ball(0.05, (x + 0.02, -0.33, z + 0.07), 1.2, 0.3, 0.8), M("#fffaf0"), "bee_wing"))


def _sansho():
    put(bm_tube([(-0.5, 0, 0.05), (-0.1, 0, 0.3), (0.45, 0, 0.55)], [0.035, 0.028, 0.018], 6), M("#5a3218"), "twig")
    # 羽のような葉（小葉が左右にならぶ）
    for k in range(6):
        t = 0.15 + k * 0.14
        x, z = -0.5 + t * 0.95, 0.05 + t * 0.52
        for s in (-1, 1):
            put(ball(0.08, (x + 0.03, -0.03, z + s * 0.1), 1.3, 0.4, 0.7), M("#46b03a" if s > 0 else "#1f6a2c"), "leaf")
    # 赤い実のふさ
    for k in range(9):
        a = k * 2.4
        r = 0.04 + 0.02 * (k % 3)
        put(ball(0.055, (0.05 + math.cos(a) * 0.12, -0.12 - 0.02 * (k % 2), 0.1 + math.sin(a) * 0.1 + k * 0.012)), M("#f24a2a"), "berry")


def _makomo():
    # 白くふくらんだ茎（マコモダケ）と、それを包む緑の皮・上へのびる葉
    put(ball(0.16, (0, 0, 0.42), 0.9, 0.9, 2.4, 3), M("#f0e6d2"), "shoot")
    put(bm_tube([(0, 0, 0.0), (0, 0, 0.16)], [0.13, 0.15], 10), M("#46b03a"), "sheath_low")
    for s in (-1, 1):
        put(bm_tube([(0.02 * s, -0.04, 0.12), (0.1 * s, -0.06, 0.5), (0.2 * s, -0.04, 0.98)], [0.06, 0.04, 0.008], 4), M("#46b03a" if s < 0 else "#1f6a2c"), "leaf")
    put(bm_tube([(0, 0.05, 0.6), (0.02, 0.05, 1.05)], [0.05, 0.008], 4), M("#1f6a2c"), "leaf_back")


def _forage_camera(key):
    w, h = FORAGE_PX[key]
    ortho = {"inago": 1.45, "hachi": 1.3, "sansho": 1.2, "makomo": 1.2}[key]
    cd = bpy.data.cameras.new("Cam")
    cd.type = "ORTHO"
    cd.ortho_scale = ortho
    cam = link(bpy.data.objects.new("Cam", cd))
    look = Vector((0, 0, {"inago": 0.25, "hachi": 0.5, "sansho": 0.3, "makomo": 0.52}[key]))
    loc = look + Vector((0, -10, 1.8))
    cam.location = loc
    cam.rotation_euler = (look - loc).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam


def _scene(w, h):
    common.reset_scene()
    common.set_resolution(w * 4, h * 4)
    bpy.context.scene.cycles.samples = 8
    bpy.context.scene.cycles.use_denoising = False
    common.add_night_world(strength=0.0)


def job_wildlife(out):
    common.AUTO_LINES = {}
    try:
        _job(out)
    finally:
        common.AUTO_LINES = None


@toon_job
def _job(out):
    for key, S in ANIMALS.items():
        for f in range(FRAMES):
            _scene(*S["px"])
            build_animal(key, f)
            _animal_camera(S)
            common.render_to(os.path.join(out, "animal_%s_%d.png" % (key, f)))
    for key, fn in (("inago", _inago), ("hachi", _hachi), ("sansho", _sansho), ("makomo", _makomo)):
        _scene(*FORAGE_PX[key])
        fn()
        _forage_camera(key)
        common.render_to(os.path.join(out, "forage_%s.png" % key))
