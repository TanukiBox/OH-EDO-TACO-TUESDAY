"""6. 暖簾「多幸寿」：布（細かく分割した板）を風の波で動かす。

物理シミュレーションではなく「時間で周期的に変わる波」で動かすので、
6コマ目の次がぴったり1コマ目につながり、毎回まったく同じ動きになる。
"""
import math

import bpy
import bmesh
import numpy as np

from common import (mesh_object, bm_tube, new_material, object_noise_material)

PANELS = 3
PANEL_WIDTH = 0.74
PANEL_GAP = 0.04
PANEL_LENGTH = 1.30
TOP_Z = 0.68
NU, NV = 22, 40   # 布の分割数（横, 縦）


def _panel_material(i, texture_path):
    m, nt, bsdf = new_material(f"noren_{i}", roughness=0.85)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(texture_path)
    tex.interpolation = "Linear"
    tex.extension = "EXTEND"
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def _panel(i, texture_path):
    x_left = -(PANELS * PANEL_WIDTH + (PANELS - 1) * PANEL_GAP) / 2 + i * (PANEL_WIDTH + PANEL_GAP)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    grid = [[bm.verts.new((x_left + PANEL_WIDTH * u / NU, 0.0, TOP_Z - PANEL_LENGTH * v / NV))
             for u in range(NU + 1)] for v in range(NV + 1)]
    for v in range(NV):
        for u in range(NU):
            f = bm.faces.new((grid[v + 1][u], grid[v + 1][u + 1], grid[v][u + 1], grid[v][u]))
            for loop, (uu, vv) in zip(f.loops, ((u, v + 1), (u + 1, v + 1), (u + 1, v), (u, v))):
                loop[uv_layer].uv = (uu / NU, 1.0 - vv / NV)
    # 布の横位置 u（0〜1）と、上からの位置 v（0〜1）を覚えておく
    uu = np.array([u / NU for v in range(NV + 1) for u in range(NU + 1)])
    vv = np.array([v / NV for v in range(NV + 1) for u in range(NU + 1)])
    rest = np.array([tuple(vt.co) for row in grid for vt in row])
    ob = mesh_object(f"Noren_{i}", bm, _panel_material(i, texture_path))
    return ob, rest, uu, vv


def _order_check(ob, n_expected):
    assert len(ob.data.vertices) == n_expected


def wind(rest, uu, vv, panel, frame, frames):
    """frame コマ目の布の形。frames コマで1周してループする。"""
    ph = 2 * math.pi * frame / frames
    a = vv ** 1.4                      # 上は竿に留まっていて、下ほど大きく揺れる
    wave = np.sin(ph - 2.4 * vv + 1.1 * panel + 0.8 * uu)
    ripple = np.sin(2 * ph - 5.0 * uu - 1.7 * vv + 2.0 * panel)
    pleat = np.sin(2 * math.pi * 2.0 * uu + ph + 1.3 * panel)  # 縦に走る布のひだ
    dy = (-a * (0.14 + 0.09 * wave) - 0.05 * a * ripple        # 手前（カメラ側）へふくらむ
          - 0.026 * (0.3 + a) * pleat)
    dx = 0.07 * a * np.sin(ph - 1.8 * vv + 0.9 * panel)       # 左右のゆれ
    length = vv * PANEL_LENGTH + 1e-3
    dz = length * (1 - np.cos(np.arctan(np.abs(dy) / length)))  # ふくらんだ分だけ裾が上がる
    out = rest.copy()
    out[:, 0] += dx
    out[:, 1] += dy
    out[:, 2] += dz
    return out


def build(texture_paths):
    pole_mat = object_noise_material("pole", [
        (0.0, "#e4cf8a"), (0.5, "#c8a45c"), (1.0, "#8a6232"),
    ], scale=6.0, roughness=0.4)
    xs = [-1.4 + 2.8 * i / 20 for i in range(21)]
    mesh_object("Pole", bm_tube([(x, 0.01, TOP_Z) for x in xs], [0.036] * 21, 16), pole_mat)
    panels = []
    for i, path in enumerate(texture_paths):
        ob, rest, uu, vv = _panel(i, path)
        _order_check(ob, len(rest))
        panels.append((ob, rest, uu, vv))
    return panels


def pose(panels, frame, frames):
    for i, (ob, rest, uu, vv) in enumerate(panels):
        co = wind(rest, uu, vv, i, frame, frames)
        ob.data.vertices.foreach_set("co", co.astype(np.float32).ravel())
        ob.data.update()
