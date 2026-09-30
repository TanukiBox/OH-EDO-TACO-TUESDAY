"""具材：唐辛子（タコスには輪切り、アイコンは丸ごと1本）"""
import math

from common import (bm_torus, bm_tube, bm_icosphere, jitter, transform_bm, drop_to_zero,
                    mesh_object, object_noise_material, cached_material)

NAME = "togarashi"
LABEL = "唐辛子"


def _materials():
    red = cached_material("togarashi_red", lambda n: object_noise_material(n, [
        (0.0, "#f04a30"), (0.5, "#d0301e"), (1.0, "#8a1a16"),
    ], scale=14.0, roughness=0.3))
    stem = cached_material("togarashi_stem", lambda n: object_noise_material(n, [
        (0.0, "#7aa048"), (1.0, "#3a5e26"),
    ], scale=20.0, roughness=0.6))
    return red, stem


def _slice(rng):
    """輪切り：ほぼ平らな赤い輪。"""
    bm = bm_torus(0.042, 0.018, 12, 6)
    transform_bm(bm, scale=(1.0, rng.uniform(0.75, 0.95), 0.7),
                 rot_x=rng.uniform(-0.3, 0.3))
    jitter(bm, 0.004, 30.0, rng.uniform(0, 100))
    drop_to_zero(bm)
    return bm


def on_taco(pile, rng):
    red, _ = _materials()
    objs = []
    for i in range(10):
        a = rng.uniform(0, 2 * math.pi)
        d = math.sqrt(rng.uniform(0.05, 1))
        x, y = 0.66 * d * math.cos(a), 0.36 * d * math.sin(a)
        bm = pile.place(_slice(rng), x, y, rot_z=rng.uniform(0, math.pi), sink=0.25)
        objs.append(mesh_object(f"togarashi_{i}", bm, red))
    return objs


def icon(rng):
    """丸ごと1本の赤唐辛子（ゆるく曲がった先細りの管 ＋ 緑のヘタ）。"""
    red, stem = _materials()
    n = 28
    pts, radii = [], []
    for i in range(n):
        t = i / (n - 1)
        pts.append((-0.26 + 0.52 * t, 0.07 * math.sin(math.pi * t) - 0.03 * t, 0.0))
        body = 0.058 * (1 - t) ** 0.65 + 0.004
        round_start = math.sqrt(min(1.0, 0.35 + t / 0.08))
        radii.append(body * round_start)
    body = bm_tube(pts, radii, 14)
    jitter(body, 0.004, 12.0, 3.0)
    cap = bm_icosphere(1.0, 2)
    transform_bm(cap, scale=(0.03, 0.055, 0.055), loc=(-0.265, 0.0, 0.0))
    stalk = bm_tube([(-0.27, 0, 0), (-0.32, 0.01, 0.01), (-0.36, 0.03, 0.03)],
                    [0.014, 0.012, 0.01], 8)
    objs = []
    for name, bm, mat in (("togarashi_icon", body, red), ("togarashi_cap", cap, stem),
                          ("togarashi_stalk", stalk, stem)):
        transform_bm(bm, rot_z=math.radians(-28), loc=(0, 0, 0.06))
        objs.append(mesh_object(name, bm, mat))
    return objs
