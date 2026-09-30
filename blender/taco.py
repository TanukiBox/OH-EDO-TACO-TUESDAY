"""タコスのモデル：2.1 トルティーヤ、2.3 皿、折りたたみ変形。"""
import math

import bmesh
import numpy as np

from common import (mesh_object, bm_lathe, new_material, noise_tex, math_node,
                    mapped, color_ramp, value_noise)

# 大きさ（Blender の 1 = トルティーヤの半径）
TORTILLA_RADIUS = 1.0
TORTILLA_THICKNESS = 0.03
PLATE_TOP = 0.02
MID_Z = PLATE_TOP + 0.017          # トルティーヤの厚みの真ん中の高さ
TOP_Z = MID_Z + TORTILLA_THICKNESS / 2  # 具材を置き始める高さ

# 折りたたみ：中央の帯 |y| < FOLD_BAND が丸く曲がり、外側はまっすぐ立ち上がる
FOLD_BAND = 0.34
FOLD_MAX_ANGLE = math.pi * 0.9


# ---------------------------------------------------------------------------
# 2.3 皿：白い平皿（断面の形を回転させて作る）
# ---------------------------------------------------------------------------
PLATE_PROFILE = [
    (0.0, PLATE_TOP), (1.03, PLATE_TOP), (1.13, 0.036), (1.22, 0.068),
    (1.29, 0.088), (1.315, 0.088), (1.30, 0.072), (1.20, 0.045),
    (1.00, 0.012), (0.75, 0.0), (0.0, 0.0),
]


def build_plate():
    m, nt, bsdf = new_material("plate", "#eeebe4", roughness=0.25)
    return mesh_object("Plate", bm_lathe(PLATE_PROFILE, 72), m)


# ---------------------------------------------------------------------------
# 2.1 トルティーヤ：焼き色のまだら ＋ ふちの焦げ
# ---------------------------------------------------------------------------
def _edge_radius(a):
    """ふちを少しだけ波打たせる（手焼きの不揃いさ）。"""
    return TORTILLA_RADIUS * (1.0 + 0.010 * math.sin(3 * a + 0.7)
                              + 0.006 * math.sin(7 * a + 2.1)
                              + 0.004 * math.sin(13 * a + 0.3))


def _tortilla_material():
    m, nt, bsdf = new_material("tortilla", roughness=0.75)
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    rad_uv = nt.nodes.new("ShaderNodeUVMap")
    rad_uv.uv_map = "Rad"
    rad = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(rad_uv.outputs["UV"], rad.inputs[0])

    # 大きな焼きムラ（まだら）
    blotch = mapped(nt, noise_tex(nt, uv.outputs["UV"], 5.0, 3.0, 0.55).outputs["Fac"], 0.50, 0.70)
    # 小さな焼き斑点（2サイズ）
    speck = math_node(nt, "MAXIMUM",
                      mapped(nt, noise_tex(nt, uv.outputs["UV"], 26.0, 1.0, 0.5, w=1.3).outputs["Fac"], 0.64, 0.74),
                      mapped(nt, noise_tex(nt, uv.outputs["UV"], 11.0, 1.0, 0.5, w=7.1).outputs["Fac"], 0.66, 0.74))
    # ふちの焦げ（ふちまでの距離 + ノイズで不規則に）
    edge_noise = noise_tex(nt, uv.outputs["UV"], 9.0, 2.0, 0.5, w=4.2).outputs["Fac"]
    edge_val = math_node(nt, "ADD", rad.outputs["X"], math_node(nt, "MULTIPLY", edge_noise, 0.4))
    edge = mapped(nt, edge_val, 1.05, 1.26)

    toast = math_node(nt, "MAXIMUM",
                      math_node(nt, "MULTIPLY", blotch, 0.6),
                      math_node(nt, "MULTIPLY", speck, 0.72))
    fac = math_node(nt, "MAXIMUM", toast, edge, clamp=True)

    cr = color_ramp(nt, [
        (0.00, "#f4dc9e"), (0.22, "#ecc97c"), (0.45, "#d49a52"),
        (0.68, "#a0622e"), (0.86, "#5e331a"), (1.00, "#2c1a10"),
    ])
    nt.links.new(fac, cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def build_tortilla():
    NR, NS = 28, 128
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    rad_layer = bm.loops.layers.uv.new("Rad")
    rad_of = {}

    center = bm.verts.new((0, 0, MID_Z))
    rad_of[center] = 0.0
    rings = []
    for i in range(1, NR + 1):
        f = i / NR
        ring = []
        for s in range(NS):
            a = 2 * math.pi * s / NS
            r = f * _edge_radius(a)
            x, y = r * math.cos(a), r * math.sin(a)
            # 表面のゆるい起伏と、ふちの軽い反り
            z = MID_Z + 0.004 * value_noise(x * 2.5, y * 2.5, 0.7) + 0.006 * f ** 4
            v = bm.verts.new((x, y, z))
            rad_of[v] = f
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
            co = loop.vert.co
            loop[uv_layer].uv = (co.x * 0.5 + 0.5, co.y * 0.5 + 0.5)
            loop[rad_layer].uv = (rad_of[loop.vert], 0.0)

    ob = mesh_object("Tortilla", bm, _tortilla_material())
    mod = ob.modifiers.new("Thickness", "SOLIDIFY")
    mod.thickness = TORTILLA_THICKNESS
    mod.offset = 0.0
    mod.use_even_offset = True
    return ob


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
