"""具材：青ねぎの小口切り"""
import math

from common import (bm_torus, jitter, transform_bm, drop_to_zero, mesh_object,
                    object_noise_material, cached_material, Pile)

NAME = "negi"
LABEL = "青ねぎの小口切り"


def _materials():
    dark = cached_material("negi_dark", lambda n: object_noise_material(n, [
        (0.0, "#6cb44a"), (0.5, "#4f9a3a"), (1.0, "#2f6a2c"),
    ], scale=20.0, roughness=0.35))
    light = cached_material("negi_light", lambda n: object_noise_material(n, [
        (0.0, "#d4ec9e"), (0.5, "#a8d672"), (1.0, "#78b454"),
    ], scale=20.0, roughness=0.35))
    return dark, light


def _ring(rng, size=1.0, tilt=0.35):
    bm = bm_torus(0.048 * size, 0.022 * size, 14, 6)
    transform_bm(bm, scale=(1.0, rng.uniform(0.8, 1.0), 0.85),
                 rot_x=rng.uniform(-tilt, tilt), rot_y=rng.uniform(-tilt, tilt))
    jitter(bm, 0.004 * size, 30.0, rng.uniform(0, 100))
    drop_to_zero(bm)
    return bm


def on_taco(pile, rng):
    dark, light = _materials()
    objs = []
    for i in range(18):
        a = rng.uniform(0, 2 * math.pi)
        d = math.sqrt(rng.uniform(0, 1))
        x, y = 0.70 * d * math.cos(a), 0.38 * d * math.sin(a)
        bm = pile.place(_ring(rng), x, y, rot_z=rng.uniform(0, math.pi), sink=0.3)
        objs.append(mesh_object(f"negi_{i}", bm, light if rng.random() < 0.35 else dark))
    return objs


def icon(rng):
    dark, light = _materials()
    pile = Pile(0.0, extent=0.5, n=60)
    objs = []
    spots = [(-0.075, 0.06), (0.08, 0.07), (-0.1, -0.07), (0.07, -0.08), (0.0, 0.0)]
    for i, (x, y) in enumerate(spots):
        bm = pile.place(_ring(rng, 1.25, tilt=0.12), x, y, rot_z=rng.uniform(0, math.pi), sink=0.5)
        objs.append(mesh_object(f"negi_icon_{i}", bm, light if i % 3 == 1 else dark))
    return objs
