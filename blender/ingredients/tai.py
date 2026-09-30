"""具材：焼き鯛のほぐし身"""
import math

from common import (bm_icosphere, jitter, transform_bm, drop_to_zero, mesh_object,
                    object_noise_material, cached_material, Pile)

NAME = "tai"                 # ファイル名に使う英字の名前
LABEL = "焼き鯛のほぐし身"     # 確認ページに出す日本語の名前


def _materials():
    flesh = cached_material("tai_flesh", lambda n: object_noise_material(n, [
        (0.00, "#fffaf2"), (0.50, "#f6ead6"), (0.66, "#e2b888"), (0.82, "#b07040"),
    ], scale=9.0, roughness=0.5))
    skin = cached_material("tai_skin", lambda n: object_noise_material(n, [
        (0.00, "#f2c4b0"), (0.40, "#d8866c"), (0.66, "#a85a40"), (0.85, "#6a3a24"),
    ], scale=11.0, roughness=0.4))
    return flesh, skin


def _flake(rng, size=1.0):
    """ほぐし身ひとかけら（底が z=0、中心が原点）。"""
    bm = bm_icosphere(1.0, 2)
    transform_bm(bm, scale=(rng.uniform(0.13, 0.20) * size,
                            rng.uniform(0.08, 0.11) * size,
                            rng.uniform(0.045, 0.06) * size),
                 rot_x=rng.uniform(-0.25, 0.25))
    jitter(bm, 0.022 * size, 12.0, rng.uniform(0, 100))
    drop_to_zero(bm)
    return bm


def on_taco(pile, rng):
    """開いたタコスの上に並べる。pile は具材を積み上げる高さマップ。"""
    flesh, skin = _materials()
    objs = []
    for i in range(18):
        # 背骨（x 軸）に沿った楕円の範囲に散らす
        a = rng.uniform(0, 2 * math.pi)
        d = math.sqrt(rng.uniform(0, 1))
        x, y = 0.66 * d * math.cos(a), 0.36 * d * math.sin(a)
        bm = pile.place(_flake(rng), x, y, rot_z=rng.uniform(0, math.pi))
        mat = skin if rng.random() < 0.2 else flesh
        objs.append(mesh_object(f"tai_{i}", bm, mat))
    return objs


def icon(rng):
    """アイコン用：ほぐし身の小山。"""
    flesh, skin = _materials()
    pile = Pile(0.0, extent=0.6, n=60)
    objs = []
    spots = [(-0.1, 0.06), (0.1, 0.07), (-0.12, -0.08), (0.11, -0.07), (0.0, 0.0)]
    for i, (x, y) in enumerate(spots):
        bm = pile.place(_flake(rng, 1.1), x, y, rot_z=rng.uniform(0, math.pi), sink=0.6)
        objs.append(mesh_object(f"tai_icon_{i}", bm, skin if i == 3 else flesh))
    return objs
