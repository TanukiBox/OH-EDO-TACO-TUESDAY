"""具材：大根おろし"""
from common import (bm_icosphere, jitter, transform_bm, drop_to_zero, mesh_object,
                    object_noise_material, cached_material)

NAME = "daikon"
LABEL = "大根おろし"


def _material():
    return cached_material("daikon", lambda n: object_noise_material(n, [
        (0.00, "#ffffff"), (0.40, "#f4f6f0"), (0.52, "#d8ded4"), (0.70, "#b8c2b6"),
    ], scale=34.0, roughness=0.55, detail=1.0))


def _mound(rng, sx, sy, sz):
    """ふんわり盛った大根おろしの山。"""
    bm = bm_icosphere(1.0, 3)
    transform_bm(bm, scale=(sx, sy, sz))
    jitter(bm, 0.035, 5.0, rng.uniform(0, 100))   # 大きなデコボコ
    jitter(bm, 0.016, 24.0, rng.uniform(0, 100))  # おろしのザラザラ
    drop_to_zero(bm)
    return bm


def on_taco(pile, rng):
    m = _material()
    objs = []
    for i, (x, y, s) in enumerate([(0.16, 0.03, 1.0), (-0.38, -0.05, 0.8)]):
        bm = pile.place(_mound(rng, 0.32 * s, 0.24 * s, 0.12 * s), x, y, rot_z=0.2, sink=0.5)
        objs.append(mesh_object(f"daikon_{i}", bm, m))
    return objs


def icon(rng):
    bm = _mound(rng, 0.28, 0.24, 0.13)
    return [mesh_object("daikon_icon", bm, _material())]
