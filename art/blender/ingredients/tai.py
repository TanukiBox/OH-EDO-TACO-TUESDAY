"""具材：焼き鯛のほぐし身"""
import math

import bmesh
import bpy

from common import (bm_icosphere, jitter, transform_bm, drop_to_zero, mesh_object,
                    object_noise_material, cached_material, bm_bounds, Pile)

NAME = "tai"                 # ファイル名に使う英字の名前
LABEL = "焼き鯛のほぐし身"     # 確認ページに出す日本語の名前


def _materials():
    flesh = cached_material("tai_flesh", lambda n: object_noise_material(n, [
        (0.00, "#fffcf6"), (0.50, "#f8eee0"), (0.66, "#e8bc88"), (0.82, "#b87038"),
    ], scale=9.0, roughness=0.5))
    skin = cached_material("tai_skin", lambda n: object_noise_material(n, [
        (0.00, "#ffb4a4"), (0.40, "#f2604e"), (0.66, "#c03a36"), (0.85, "#6a2a1e"),
    ], scale=11.0, roughness=0.4))
    return flesh, skin


def _flake(rng, size=1.0):
    """ほぐし身ひとかけら（底が z=0、中心が原点）。"""
    bm = bm_icosphere(1.0, 2)
    transform_bm(bm, scale=(rng.uniform(0.16, 0.24) * size,
                            rng.uniform(0.09, 0.13) * size,
                            rng.uniform(0.045, 0.06) * size),
                 rot_x=rng.uniform(-0.25, 0.25))
    jitter(bm, 0.022 * size, 12.0, rng.uniform(0, 100))
    drop_to_zero(bm)
    return bm


def bpy_mesh_from(bm):
    me = bpy.data.meshes.new("tmp")
    bm.to_mesh(me)
    return me


def bm_copy(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    return bm


def _with_skin(bm, rng):
    """身の上面に、薄い皮（桜色）を貼ったものを作る。戻り値は皮の bmesh。

    鯛の身は白く、皮は桜色。皮だけの塊にするとトマトに見えるので、
    白い身の上に薄くのせる。
    """
    (x0, x1), (y0, y1), (_, z1) = bm_bounds(bm)
    skin = bm_icosphere(1.0, 2)
    transform_bm(skin, scale=((x1 - x0) * 0.52, (y1 - y0) * 0.44, 0.012),
                 rot_z=0.0, loc=((x0 + x1) / 2 + rng.uniform(-0.02, 0.02),
                                 (y0 + y1) / 2, z1 - 0.012))
    return skin


def on_taco(pile, rng):
    """開いたタコスの上に並べる。pile は具材を積み上げる高さマップ。"""
    flesh, skin = _materials()
    objs = []
    for i in range(22):
        # 背骨（x 軸）に沿った楕円の範囲に散らす
        a = rng.uniform(0, 2 * math.pi)
        d = math.sqrt(rng.uniform(0, 1))
        x, y = 0.70 * d * math.cos(a), 0.40 * d * math.sin(a)
        piece = _flake(rng)
        skin_bm = _with_skin(piece, rng) if rng.random() < 0.35 else None
        if skin_bm is not None:
            # 身と皮を1つにまとめてから置く（いっしょに動くように）
            me_tmp = bmesh.new()
            for src in (piece, skin_bm):
                tmp = bpy_mesh_from(src)
                me_tmp.from_mesh(tmp)
                bpy.data.meshes.remove(tmp)
            n_flesh = len(piece.verts)
            piece.free()
            skin_bm.free()
            piece = me_tmp
        else:
            n_flesh = None
        bm = pile.place(piece, x, y, rot_z=rng.uniform(0, math.pi))
        ob = mesh_object(f"tai_{i}", bm, flesh)
        if n_flesh is not None:
            ob.data.materials.append(skin)
            for poly in ob.data.polygons:
                if min(poly.vertices) >= n_flesh:
                    poly.material_index = 1
        objs.append(ob)
    return objs


def icon(rng):
    """アイコン用：ほぐし身の小山。"""
    flesh, skin = _materials()
    pile = Pile(0.0, extent=0.6, n=60)
    objs = []
    spots = [(-0.1, 0.06), (0.1, 0.07), (-0.12, -0.08), (0.11, -0.07), (0.0, 0.0)]
    for i, (x, y) in enumerate(spots):
        bm = pile.place(_flake(rng, 0.95), x, y, rot_z=rng.uniform(0, math.pi), sink=0.6)
        objs.append(mesh_object(f"tai_icon_{i}", bm, flesh))
        if i in (1, 3):
            objs.append(mesh_object(f"tai_icon_skin_{i}", _with_skin(bm_copy(objs[-1]), rng), skin))
    return objs
