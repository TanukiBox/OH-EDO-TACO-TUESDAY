"""タコスのモデル：2.1 トルティーヤ、2.3 皿、折りたたみ変形。"""
import math

import bmesh
import numpy as np

from common import (mesh_object, bm_lathe, new_material, noise_tex, math_node,
                    mapped, color_ramp, value_noise)

# 大きさ（Blender の 1 = トルティーヤの半径 ≒ 実物の 5cm）
# 屋台のタコスは直径10cmほどのトウモロコシのトルティーヤを2枚重ねて出すのが定番。
TORTILLA_RADIUS = 1.0
TORTILLA_THICKNESS = 0.022          # 薄い（実物で約1〜2mm）
PLATE_TOP = 0.02
UNDER_MID_Z = PLATE_TOP + 0.013     # 下の1枚の厚みの真ん中
MID_Z = UNDER_MID_Z + TORTILLA_THICKNESS  # 上の1枚の厚みの真ん中
TOP_Z = MID_Z + TORTILLA_THICKNESS / 2  # 具材を置き始める高さ
UNDER_OFFSET = (0.07, -0.08)        # 下の1枚を少しずらして、2枚重ねが見えるようにする

# 折りたたみ：中央の帯 |y| < FOLD_BAND が丸く曲がり、外側はまっすぐ立ち上がる
FOLD_BAND = 0.34
FOLD_MAX_ANGLE = math.pi * 0.9

# ---------------------------------------------------------------------------
# 2.3 皿：白い平皿（断面の形を回転させて作る）
# ---------------------------------------------------------------------------
PLATE_PROFILE = [
    (0.0, PLATE_TOP), (1.14, PLATE_TOP), (1.22, 0.034), (1.30, 0.064),
    (1.36, 0.082), (1.38, 0.082), (1.37, 0.068), (1.28, 0.042),
    (1.08, 0.012), (0.8, 0.0), (0.0, 0.0),
]


def build_plate():
    m, nt, bsdf = new_material("plate", "#eeebe4", roughness=0.25)
    return mesh_object("Plate", bm_lathe(PLATE_PROFILE, 72), m)


# ---------------------------------------------------------------------------
# 2.1 トルティーヤ（トウモロコシ）
# 調べた見た目：明るいトウモロコシの黄色に、鉄板（コマル）で焼いた
# 「こげ茶の斑点」が全体に散り、膨らんだところが濃く焦げる。
# ふちが一周焦げたり、盛り上がったりはしない（そうするとピザに見える）。
# ---------------------------------------------------------------------------
def _edge_radius(a, phase):
    """ふちを少しだけ波打たせる（手焼きの不揃いさ）。"""
    return TORTILLA_RADIUS * (1.0 + 0.012 * math.sin(3 * a + 0.7 + phase)
                              + 0.007 * math.sin(7 * a + 2.1 + phase * 2)
                              + 0.004 * math.sin(13 * a + 0.3))


def _tortilla_material(name, seed):
    m, nt, bsdf = new_material(name, roughness=0.8)
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    rad_uv = nt.nodes.new("ShaderNodeUVMap")
    rad_uv.uv_map = "Rad"
    rad = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(rad_uv.outputs["UV"], rad.inputs[0])
    vec = uv.outputs["UV"]

    # うっすらとした焼きムラ（きつね色の広いまだら）
    toast = mapped(nt, noise_tex(nt, vec, 4.0, 3.0, 0.55, w=seed).outputs["Fac"], 0.48, 0.72)
    # 膨らんで焦げたところ（中くらいの濃い斑点）
    blister = mapped(nt, noise_tex(nt, vec, 8.0, 1.0, 0.5, w=seed + 3.1).outputs["Fac"], 0.66, 0.74)
    # こげ茶の細かい斑点（コマルの焼き目）
    fleck = mapped(nt, noise_tex(nt, vec, 30.0, 1.0, 0.5, w=seed + 7.7).outputs["Fac"], 0.655, 0.72)
    # ふちは乾いて少しだけ色づく（黒い輪にはしない）
    edge = mapped(nt, math_node(nt, "ADD", rad.outputs["X"],
                                math_node(nt, "MULTIPLY", toast, 0.1)), 0.92, 1.08)

    fac = math_node(nt, "MAXIMUM", math_node(nt, "MULTIPLY", toast, 0.42),
                    math_node(nt, "MULTIPLY", edge, 0.3))
    fac = math_node(nt, "MAXIMUM", fac, math_node(nt, "MULTIPLY", blister, 0.78))
    fac = math_node(nt, "MAXIMUM", fac, fleck, clamp=True)

    cr = color_ramp(nt, [
        (0.00, "#fbe08a"), (0.20, "#f4cc62"), (0.42, "#dca24a"),
        (0.66, "#9a5a26"), (0.85, "#4e2c14"), (1.00, "#2a180e"),
    ])
    nt.links.new(fac, cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def _tortilla(name, mid_z, offset, rot, seed, droop):
    NR, NS = 28, 128
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    rad_layer = bm.loops.layers.uv.new("Rad")
    rad_of = {}
    ox, oy = offset
    c, s_ = math.cos(rot), math.sin(rot)

    center = bm.verts.new((ox, oy, mid_z))
    rad_of[center] = (0.0, 0.0, 0.0)
    rings = []
    for i in range(1, NR + 1):
        f = i / NR
        ring = []
        for s in range(NS):
            a = 2 * math.pi * s / NS
            r = f * _edge_radius(a, seed)
            lx, ly = r * math.cos(a), r * math.sin(a)
            x, y = ox + lx * c - ly * s_, oy + lx * s_ + ly * c
            # 表面のゆるい起伏と、ふちがわずかに垂れる形
            z = mid_z + 0.004 * value_noise(lx * 2.5, ly * 2.5, seed) - droop * f ** 4
            v = bm.verts.new((x, y, z))
            rad_of[v] = (f, lx, ly)
            ring.append(v)
        rings.append(ring)

    faces = []
    for s in range(NS):
        faces.append(bm.faces.new((center, rings[0][s], rings[0][(s + 1) % NS])))
    for r0, r1 in zip(rings, rings[1:]):
        for s in range(NS):
            t = (s + 1) % NS
            faces.append(bm.faces.new((r0[s], r1[s], r1[t], r0[t])))
    for face in faces:
        for loop in face.loops:
            f, lx, ly = rad_of[loop.vert]
            loop[uv_layer].uv = (lx * 0.5 + 0.5, ly * 0.5 + 0.5)
            loop[rad_layer].uv = (f, 0.0)

    ob = mesh_object(name, bm, _tortilla_material(name, seed))
    mod = ob.modifiers.new("Thickness", "SOLIDIFY")
    mod.thickness = TORTILLA_THICKNESS
    mod.offset = 0.0
    mod.use_even_offset = True
    return ob


def build_tortilla():
    """2枚重ねのトルティーヤ。戻り値は [上の1枚, 下の1枚]。"""
    top = _tortilla("Tortilla", MID_Z, (0.0, 0.0), 0.0, 1.0, droop=0.012)
    under = _tortilla("TortillaUnder", UNDER_MID_Z, UNDER_OFFSET, 2.2, 5.0, droop=0.0)
    return [top, under]


# ---------------------------------------------------------------------------
# 折りたたみ：y 方向の両側を持ち上げて U 字にする空間変形
# ---------------------------------------------------------------------------
def fold_coords(co, angle):
    """co: (N,3) の頂点座標。angle: 曲げる角度の合計（0 = 平ら）。"""
    if angle < 1e-5:
        return co.copy()
    R = FOLD_BAND / (angle / 2)
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    h = z - MID_Z                                  # トルティーヤ面からの高さ
    theta = np.clip(y / R, -angle / 2, angle / 2)  # 曲がる帯の中での角度
    extra = y - theta * R                          # 帯の外にはみ出した長さ
    sy = R * np.sin(theta) + extra * np.cos(theta)
    sz = R * (1 - np.cos(theta)) + extra * np.sin(theta)
    return np.stack([x, sy - h * np.sin(theta), MID_Z + sz + h * np.cos(theta)], axis=1)


class Folder:
    """オブジェクトの元の形を覚えておき、折りたたみ具合 t (0〜1) を適用する。"""

    def __init__(self, objects):
        self.items = []
        for ob in objects:
            me = ob.data
            co = np.empty(len(me.vertices) * 3, dtype=np.float64)
            me.vertices.foreach_get("co", co)
            self.items.append((ob, co.reshape(-1, 3)))

    def apply(self, t):
        e = t * t * (3 - 2 * t)  # ゆっくり始まり、ゆっくり終わる
        for ob, rest in self.items:
            new = fold_coords(rest, e * FOLD_MAX_ANGLE)
            ob.data.vertices.foreach_set("co", new.astype(np.float32).ravel())
            ob.data.update()
