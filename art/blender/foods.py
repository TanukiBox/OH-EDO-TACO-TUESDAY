"""全食材の3Dモデル（形の型 × 色）。アイコン（斜め上）と、料理画面で皮の上に散らす「かけら」（真上）に使う。

新しい食材を足すときは、FOODS に1行足す（形の型は下の shape_* の名前）。
  色は [明るい, ふつう, 暗い] の3色。size はおおよその大きさ（トルティーヤの半径 = 1）。
"""
import math

import bmesh

from common import (bm_icosphere, bm_torus, bm_tube, jitter, transform_bm, drop_to_zero,
                    mesh_object, object_noise_material, cached_material, rng_for, bm_bounds, toon3)

# 食材ごとの形と色。n = タコスの上にのせるかけらの数、icon = アイコンに積むかけらの数
FOODS = {
    # --- 具：魚介 ---
    "tai":        dict(shape="flake", c=["#fffaf0", "#f0e6d2", "#f0664e"], size=0.2, n=8, icon=6),
    "kisu_ten":   dict(shape="tempura", c=["#fbe39a", "#dca24a", "#8c5228"], size=0.26, n=5, icon=4),
    "tako":       dict(shape="tako", c=["#f6c39c", "#f0664e", "#b8323a"], size=0.14, n=8, icon=6),
    "katsuo":     dict(shape="fillet", c=["#f0664e", "#b8323a", "#5a3218"], size=0.22, n=6, icon=4, sear=True),
    "aji_nanban": dict(shape="tempura", c=["#dca24a", "#b87838", "#8c5228"], size=0.22, n=6, icon=4, glaze="#f0664e"),
    "iwashi":     dict(shape="fillet", c=["#d6ccb8", "#5070b0", "#243f7a"], size=0.2, n=6, icon=4),
    "zuke":       dict(shape="fillet", c=["#c42618", "#7a1414", "#2e1a12"], size=0.2, n=6, icon=4),
    "akami":      dict(shape="fillet", c=["#f24a2a", "#c42618", "#7a1414"], size=0.2, n=5, icon=4),
    "chutoro":    dict(shape="fillet", c=["#f6c39c", "#f0664e", "#c42618"], size=0.2, n=5, icon=4, stripes=True),
    "otoro":      dict(shape="fillet", c=["#fffaf0", "#f6c39c", "#f0664e"], size=0.2, n=5, icon=4, stripes=True),
    "kabayaki":   dict(shape="kabayaki", c=["#dca24a", "#8c5228", "#2e1a12"], size=0.34, n=3, icon=2),
    "uni":        dict(shape="uni", c=["#fbe39a", "#f5b860", "#b87838"], size=0.12, n=6, icon=5),
    # 高級な材料（日本橋の大店・伊勢屋）
    "ise_ebi":    dict(shape="tempura", c=["#f0664e", "#f24a2a", "#c42618"], size=0.3, n=4, icon=3),
    "awabi":      dict(shape="disc", c=["#f0e6d2", "#d6ccb8", "#76726a"], size=0.17, n=4, icon=3, rim="#4a4658"),
    "karasumi":   dict(shape="slice", c=["#f5b860", "#dca24a", "#b87838"], size=0.13, n=6, icon=5),
    "kinpaku":    dict(shape="flake", c=["#fbe39a", "#f4cc62", "#dca24a"], size=0.07, n=9, icon=7),
    "kujira":     dict(shape="fillet", c=["#b8323a", "#7a1414", "#2e1a12"], size=0.22, n=5, icon=4, skin="#1c1220"),
    "sake":       dict(shape="fillet", c=["#f6c39c", "#f0664e", "#b8323a"], size=0.2, n=6, icon=4, stripes=True),
    # --- 具：里山・山・肉 ---
    "inago":      dict(shape="bug", c=["#dca24a", "#8c5228", "#5a3218"], size=0.1, n=10, icon=7),
    "hachinoko":  dict(shape="larva", c=["#fffaf0", "#f0e6d2", "#d6ccb8"], size=0.06, n=14, icon=10),
    "makomo":     dict(shape="slice", c=["#f0e6d2", "#d6ccb8", "#2e1a12"], size=0.12, n=7, icon=5, spots="#2e1a12"),
    "inoshishi":  dict(shape="meat", c=["#f6c39c", "#b87838", "#5a3218"], size=0.2, n=6, icon=4),
    "ino_bara":   dict(shape="meat", c=["#fffaf0", "#f6c39c", "#b87838"], size=0.2, n=6, icon=4, stripes=True),
    "ino_shita":  dict(shape="meat", c=["#f6c39c", "#f0664e", "#8c5228"], size=0.18, n=6, icon=4),
    "ino_mimi":   dict(shape="strand", c=["#f6c39c", "#b87838", "#8c5228"], size=0.2, n=12, icon=8, thick=0.03),
    "shika":      dict(shape="meat", c=["#c42618", "#7a1414", "#2e1a12"], size=0.2, n=6, icon=4, sear=True),
    "shamo":      dict(shape="meat", c=["#fbe39a", "#dca24a", "#8c5228"], size=0.18, n=6, icon=4),
    "kamo":       dict(shape="meat", c=["#f0664e", "#8c5228", "#5a3218"], size=0.2, n=6, icon=4, skin="#dca24a"),
    "kashira":    dict(shape="meat", c=["#f6c39c", "#b87838", "#5a3218"], size=0.16, n=8, icon=5),
    "ino_karaage": dict(shape="tempura", c=["#dca24a", "#8c5228", "#5a3218"], size=0.2, n=6, icon=4),
    "buta":       dict(shape="meat", c=["#fffaf0", "#f6c39c", "#b87838"], size=0.2, n=6, icon=4, stripes=True),
    "gyuniku":    dict(shape="meat", c=["#b87838", "#5a3218", "#2e1a12"], size=0.18, n=7, icon=5, glaze="#8c5228"),
    "atsuyaki":   dict(shape="cube", c=["#fbe39a", "#f4cc62", "#dca24a"], size=0.2, n=4, icon=3, sear=True),
    # --- 具：豆腐・野菜・その他 ---
    "tofu_soboro": dict(shape="crumble", c=["#fffaf0", "#f0e6d2", "#d6ccb8"], size=0.05, n=30, icon=18),
    "yakidofu":   dict(shape="cube", c=["#fffaf0", "#f0e6d2", "#b87838"], size=0.18, n=5, icon=3, sear=True),
    "nidaikon":   dict(shape="disc", c=["#fbe39a", "#f0e6d2", "#dca24a"], size=0.18, n=4, icon=3),
    "konnyaku":   dict(shape="cube", c=["#aaa292", "#76726a", "#4a4658"], size=0.16, n=5, icon=4),
    "satsumaimo": dict(shape="disc", c=["#fbe39a", "#f4cc62", "#b8323a"], size=0.16, n=5, icon=4, rim="#b8323a"),
    "satoimo":    dict(shape="blobs", c=["#fffaf0", "#f0e6d2", "#aaa292"], size=0.1, n=6, icon=5),
    "nasu":       dict(shape="disc", c=["#dca24a", "#b87838", "#172b58"], size=0.16, n=5, icon=4, rim="#243f7a"),
    "matsutake":  dict(shape="mushroom", c=["#f0e6d2", "#b87838", "#5a3218"], size=0.22, n=5, icon=3),
    "sumeshi":    dict(shape="rice", c=["#fffaf0", "#f0e6d2", "#d6ccb8"], size=0.14, n=4, icon=3),
    "pineapple":  dict(shape="cube", c=["#fbe39a", "#f4cc62", "#dca24a"], size=0.12, n=7, icon=5),
    "cheese":     dict(shape="sauce", c=["#fbe39a", "#f4cc62", "#dca24a"], size=0.2, n=3, icon=2),
    "tomato":     dict(shape="cube", c=["#f24a2a", "#c42618", "#7a1414"], size=0.09, n=9, icon=6),
    "avocado":    dict(shape="cube", c=["#a8e05a", "#46b03a", "#1f6a2c"], size=0.11, n=7, icon=5),
    # --- サルサ（とろみ・たれ） ---
    "shiraae":    dict(shape="sauce", c=["#fffaf0", "#f0e6d2", "#d6ccb8"], size=0.16, n=3, icon=1),
    "sumiso":     dict(shape="sauce", c=["#fbe39a", "#dca24a", "#b87838"], size=0.13, n=3, icon=1),
    "bainiku":    dict(shape="sauce", c=["#f0664e", "#c42618", "#7a1414"], size=0.08, n=5, icon=2),
    "irizake":    dict(shape="drops", c=["#f5b860", "#b87838", "#8c5228"], size=0.05, n=8, icon=5),
    "shichimi_miso": dict(shape="sauce", c=["#f0664e", "#b8323a", "#5a3218"], size=0.1, n=4, icon=2, flecks="#f24a2a"),
    "miso":       dict(shape="sauce", c=["#dca24a", "#b87838", "#8c5228"], size=0.1, n=4, icon=2),
    "dengaku_miso": dict(shape="sauce", c=["#b87838", "#8c5228", "#5a3218"], size=0.1, n=4, icon=2),
    "dashi":      dict(shape="drops", c=["#fbe39a", "#f5b860", "#dca24a"], size=0.06, n=8, icon=5),
    "amazu":      dict(shape="drops", c=["#f0664e", "#c42618", "#7a1414"], size=0.06, n=7, icon=5),
    "ranou":      dict(shape="yolk", c=["#fbe39a", "#f5b860", "#dca24a"], size=0.12, n=1, icon=1),
    "sato":       dict(shape="dust", c=["#fffaf0", "#f0e6d2", "#d6ccb8"], size=0.02, n=30, icon=30),
    "butter":     dict(shape="cube", c=["#fbe39a", "#f4cc62", "#dca24a"], size=0.1, n=2, icon=1, melt=True),
    "mole":       dict(shape="sauce", c=["#8c5228", "#5a3218", "#2e1a12"], size=0.14, n=4, icon=2),
    # --- 薬味 ---
    "daikon":     dict(shape="strand", c=["#fffaf0", "#f0e6d2", "#d6ccb8"], size=0.2, n=18, icon=12, thick=0.012),
    "oroshi":     dict(shape="sauce", c=["#fffaf0", "#f0e6d2", "#d6ccb8"], size=0.15, n=3, icon=1, grain=True),
    "kyuri":      dict(shape="halfmoon", c=["#d2ec9a", "#a8e05a", "#1f6a2c"], size=0.07, n=8, icon=6),
    "myoga":      dict(shape="strand", c=["#f6c39c", "#f0664e", "#b8323a"], size=0.14, n=10, icon=8, thick=0.015),
    "amazu_myoga": dict(shape="strand", c=["#f0664e", "#b8323a", "#7a1414"], size=0.14, n=10, icon=8, thick=0.016),
    "negi":       dict(shape="ring", c=["#a8e05a", "#46b03a", "#1f6a2c"], size=0.045, n=14, icon=8),
    "shiraganegi": dict(shape="strand", c=["#fffaf0", "#f0e6d2", "#a8e05a"], size=0.22, n=20, icon=14, thick=0.008),
    "yakinegi":   dict(shape="log", c=["#fffaf0", "#dca24a", "#5a3218"], size=0.16, n=5, icon=4),
    "shoga":      dict(shape="strand", c=["#fbe39a", "#f4cc62", "#dca24a"], size=0.12, n=12, icon=8, thick=0.012),
    "shiso":      dict(shape="leaf", c=["#a8e05a", "#46b03a", "#1f6a2c"], size=0.22, n=3, icon=2),
    "mitsuba":    dict(shape="leaf", c=["#a8e05a", "#46b03a", "#1f6a2c"], size=0.1, n=8, icon=6),
    "yuzu":       dict(shape="zest", c=["#fbe39a", "#f4cc62", "#dca24a"], size=0.07, n=12, icon=8),
    "goma":       dict(shape="dust", c=["#fffaf0", "#fbe39a", "#8c5228"], size=0.018, n=40, icon=30),
    "kizaminori": dict(shape="strand", c=["#1f6a2c", "#172b58", "#0d1830"], size=0.1, n=16, icon=10, thick=0.01, flat=True),
    "wasabi":     dict(shape="sauce", c=["#a8e05a", "#46b03a", "#1f6a2c"], size=0.06, n=2, icon=1, grain=True),
    "sansho":     dict(shape="dust", c=["#a8e05a", "#46b03a", "#1f6a2c"], size=0.022, n=24, icon=20),
    "shichimi":   dict(shape="dust", c=["#f24a2a", "#c42618", "#b87838"], size=0.016, n=36, icon=30),
    "togarashi":  dict(shape="ring", c=["#f24a2a", "#c42618", "#7a1414"], size=0.04, n=8, icon=6),
    "sakura":     dict(shape="flower", c=["#fffaf0", "#f6c39c", "#f0664e"], size=0.07, n=8, icon=5),
    "konbu":      dict(shape="strand", c=["#1f6a2c", "#172b58", "#0d1830"], size=0.16, n=8, icon=6, thick=0.02, flat=True),
    "kosho":      dict(shape="dust", c=["#4a4658", "#2e1a12", "#1c1220"], size=0.018, n=30, icon=24),
    "nikkei":     dict(shape="log", c=["#b87838", "#8c5228", "#5a3218"], size=0.12, n=3, icon=3, curl=True),
    "choji":      dict(shape="clove", c=["#8c5228", "#5a3218", "#2e1a12"], size=0.05, n=8, icon=6),
    "honba_chili": dict(shape="ring", c=["#f24a2a", "#c42618", "#7a1414"], size=0.05, n=7, icon=5),
    "corn":       dict(shape="kernels", c=["#fbe39a", "#f4cc62", "#dca24a"], size=0.025, n=24, icon=20),
}

# タコスの横に添えるすだち（さっぱりしたタコス以外）
GARNISH = {"sudachi": dict(shape="wedge", c=["#d2ec9a", "#46b03a", "#1f6a2c"], size=0.2)}


def _mat(key, spec):
    # セル調：c = [明るい, ふつう, 暗い] を、光の向きで3段に塗り分ける。境目は少しまだら（食材の質感）
    return toon3("food_" + key, spec["c"][0], spec["c"][1], spec["c"][2], noise=0.22, scale=14.0)


def _solid(key, color):
    from people import RAMP   # 人物と同じ「影・明るい」の組み合わせ
    sh, li, _ = RAMP.get(color, (color, color, color))
    return toon3("solid_" + color, li, color, sh)


# ---------------------------------------------------------------------------
# 形の型（どれも、底が z=0・中心が原点の bmesh を返す）
# ---------------------------------------------------------------------------
def _sphere(r, sx, sy, sz, sub=2):
    bm = bm_icosphere(r, sub)
    transform_bm(bm, scale=(sx, sy, sz))
    return bm


def shape_piece(spec, rng):
    """1つのかけらの bmesh と、追加の部品 [(bmesh, 色)] を返す。"""
    s = spec["size"]
    sh = spec["shape"]
    extra = []
    if sh in ("flake", "meat"):
        bm = _sphere(1, s * rng.uniform(0.8, 1.1), s * rng.uniform(0.5, 0.7), s * 0.28)
        jitter(bm, s * 0.12, 9.0 / s * 0.2, rng.uniform(0, 99))
    elif sh == "tempura":
        bm = _sphere(1, s * rng.uniform(0.9, 1.1), s * 0.45, s * 0.3, sub=3)
        jitter(bm, s * 0.1, 30.0, rng.uniform(0, 99))
        jitter(bm, s * 0.05, 90.0, rng.uniform(0, 99))
    elif sh in ("fillet", "kabayaki"):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
        transform_bm(bm, scale=(s * rng.uniform(0.9, 1.1), s * 0.55, s * 0.18))
        jitter(bm, s * 0.03, 12.0, rng.uniform(0, 99))
        if spec.get("skin"):
            sk = bmesh.new(); bmesh.ops.create_cube(sk, size=1.0)
            transform_bm(sk, scale=(s * 1.0, s * 0.1, s * 0.19), loc=(0, s * 0.25, 0))
            extra.append((sk, spec["skin"]))
        if sh == "kabayaki" or spec.get("sear"):
            for k in range(3):
                g = bmesh.new(); bmesh.ops.create_cube(g, size=1.0)
                transform_bm(g, scale=(s * 0.06, s * 0.56, s * 0.02), loc=(s * (k - 1) * 0.3, 0, s * 0.09), rot_z=0.3)
                extra.append((g, spec["c"][2]))
        if spec.get("stripes"):
            for k in range(3):
                g = bmesh.new(); bmesh.ops.create_cube(g, size=1.0)
                transform_bm(g, scale=(s * 0.9, s * 0.05, s * 0.02), loc=(0, s * (k - 1) * 0.16, s * 0.09), rot_z=0.15)
                extra.append((g, "#fffaf0"))
    elif sh == "tako":
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=s, radius2=s * 0.9, depth=s * 0.4)
        jitter(bm, s * 0.06, 20.0, rng.uniform(0, 99))
        for k in range(3):
            sp = _sphere(s * 0.13, 1, 1, 0.5)
            transform_bm(sp, loc=(s * 0.55 * math.cos(k * 2.1), s * 0.55 * math.sin(k * 2.1), s * 0.22))
            extra.append((sp, "#f6c39c"))
    elif sh == "uni":
        bm = _sphere(1, s * 1.0, s * 0.45, s * 0.35)
        jitter(bm, s * 0.08, 25.0, rng.uniform(0, 99))
    elif sh == "bug":
        bm = _sphere(1, s * 0.9, s * 0.3, s * 0.3)
        for k in (-1, 1):
            leg = bm_tube([(0, 0, 0), (-s * 0.5, s * 0.5 * k, s * 0.2), (-s * 0.9, s * 0.4 * k, -s * 0.1)], [s * 0.06] * 3, 5)
            extra.append((leg, spec["c"][2]))
    elif sh == "larva":
        bm = bm_tube([(-s, 0, 0), (0, s * 0.3, 0), (s, 0, 0)], [s * 0.35, s * 0.5, s * 0.3], 8)
    elif sh in ("slice", "disc", "halfmoon"):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=18, radius1=s, radius2=s, depth=s * 0.25)
        if sh == "halfmoon":
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -s * 0.05], context="VERTS")
            extra.append((_rim(s, 0.25, half=True), spec["c"][2]))
        if spec.get("rim"):
            extra.append((_rim(s, 0.27), spec["rim"]))
        if spec.get("spots"):
            for k in range(4):
                d = _sphere(s * 0.1, 1, 1, 0.4)
                transform_bm(d, loc=(rng.uniform(-0.5, 0.5) * s, rng.uniform(-0.5, 0.5) * s, s * 0.13))
                extra.append((d, spec["spots"]))
    elif sh == "cube":
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
        transform_bm(bm, scale=(s, s * rng.uniform(0.8, 1.0), s * (0.35 if spec.get("melt") else 0.7)))
        jitter(bm, s * 0.06, 8.0, rng.uniform(0, 99))
        if spec.get("sear"):
            g = bmesh.new(); bmesh.ops.create_cube(g, size=1.0)
            transform_bm(g, scale=(s * 1.01, s * 0.3, s * 0.72), loc=(0, 0, 0))
            extra.append((g, spec["c"][2]))
    elif sh == "crumble":
        bm = _sphere(1, s, s * 0.9, s * 0.7, sub=1)
        jitter(bm, s * 0.2, 30.0, rng.uniform(0, 99))
    elif sh == "blobs":
        bm = _sphere(1, s, s * 0.85, s * 0.8, sub=2)
        jitter(bm, s * 0.08, 10.0, rng.uniform(0, 99))
    elif sh == "mushroom":
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        transform_bm(bm, scale=(s * 1.1, s * 0.35, s * 0.12))
        cap = _sphere(1, s * 0.35, s * 0.4, s * 0.12)
        transform_bm(cap, loc=(s * 0.5, 0, 0))
        extra.append((cap, spec["c"][1]))
    elif sh == "rice":
        bm = bmesh.new()
        for k in range(18):
            g = _sphere(s * 0.12, 1.6, 0.8, 0.8, sub=1)
            transform_bm(g, rot_z=rng.uniform(0, 3.1), loc=(rng.uniform(-1, 1) * s * 0.6, rng.uniform(-1, 1) * s * 0.5, rng.uniform(0, s * 0.3)))
            me_tmp = __import__("bpy").data.meshes.new("t")
            g.to_mesh(me_tmp); g.free()
            bm.from_mesh(me_tmp)
            __import__("bpy").data.meshes.remove(me_tmp)
    elif sh in ("sauce", "yolk"):
        bm = _sphere(1, s, s * rng.uniform(0.8, 1.0), s * (0.45 if sh == "yolk" else 0.35), sub=3)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.001], context="VERTS")
        jitter(bm, s * (0.14 if spec.get("grain") else 0.08), 6.0 / s * 0.3, rng.uniform(0, 99))
        if spec.get("grain"):
            jitter(bm, s * 0.05, 40.0, rng.uniform(0, 99))
        if spec.get("flecks"):
            for k in range(5):
                d = _sphere(s * 0.08, 1, 1, 1, sub=1)
                transform_bm(d, loc=(rng.uniform(-0.5, 0.5) * s, rng.uniform(-0.5, 0.5) * s, s * 0.25))
                extra.append((d, spec["flecks"]))
    elif sh == "drops":
        bm = _sphere(1, s, s * 0.8, s * 0.3, sub=2)
    elif sh == "strand":
        L, t = s, spec.get("thick", 0.012)
        pts = [(L * (k / 5 - 0.5), L * 0.12 * math.sin(k * 1.3 + rng.uniform(0, 3)), 0) for k in range(6)]
        bm = bm_tube(pts, [t] * 6, 6)
        if spec.get("flat"):
            transform_bm(bm, scale=(1, 2.2, 0.4))
    elif sh == "ring":
        bm = bm_torus(s, s * 0.35, 14, 6)
        transform_bm(bm, scale=(1, 1, 0.8))
        if spec["c"][0] == "#a8e05a":
            inner = bm_torus(s * 0.62, s * 0.12, 12, 4)
            extra.append((inner, "#fffaf0"))
    elif sh == "log":
        bm = bm_tube([(-s, 0, 0), (s, 0, 0)], [s * (0.35 if not spec.get("curl") else 0.25)] * 2, 10)
        if not spec.get("curl"):
            for k in range(2):
                g = bmesh.new(); bmesh.ops.create_cube(g, size=1.0)
                transform_bm(g, scale=(s * 0.12, s * 0.72, s * 0.1), loc=(s * (k - 0.5) * 0.8, 0, s * 0.3))
                extra.append((g, spec["c"][2]))
    elif sh == "leaf":
        bm = _sphere(1, s, s * 0.55, s * 0.05, sub=2)
        jitter(bm, s * 0.05, 18.0, rng.uniform(0, 99))
        vein = bmesh.new(); bmesh.ops.create_cube(vein, size=1.0)
        transform_bm(vein, scale=(s * 1.6, s * 0.04, s * 0.04), loc=(0, 0, s * 0.04))
        extra.append((vein, spec["c"][0]))
    elif sh == "zest":
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        transform_bm(bm, scale=(s, s * 0.3, s * 0.15))
    elif sh == "dust":
        bm = _sphere(s, 1, 1, 0.8, sub=1)
    elif sh == "flower":
        bm = bmesh.new()
        for k in range(5):
            p = _sphere(s * 0.55, 1, 0.6, 0.15, sub=1)
            a = k / 5 * 2 * math.pi
            transform_bm(p, rot_z=a, loc=(math.cos(a) * s * 0.45, math.sin(a) * s * 0.45, 0))
            me_tmp = __import__("bpy").data.meshes.new("t"); p.to_mesh(me_tmp); p.free(); bm.from_mesh(me_tmp); __import__("bpy").data.meshes.remove(me_tmp)
        extra.append((_sphere(s * 0.2, 1, 1, 0.5), "#f0664e"))
    elif sh == "clove":
        bm = bm_tube([(0, 0, 0), (s * 1.4, 0, 0)], [s * 0.2, s * 0.12], 6)
        extra.append((_sphere(s * 0.35, 1, 1, 1, sub=1), spec["c"][1]))
    elif sh == "kernels":
        bm = _sphere(s, 1.0, 0.9, 0.8, sub=1)
    elif sh == "wedge":
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=s, radius2=s, depth=s * 0.5)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.001], context="VERTS")
        transform_bm(bm, rot_x=math.pi / 2)
        extra.append((_rim(s * 0.82, 0.52, half=True, vertical=True), "#d2ec9a"))
    else:
        bm = _sphere(1, s, s, s * 0.5)
    drop_to_zero(bm)
    (_, _), (_, _), (z0, _) = bm_bounds(bm) if False else ((0, 0), (0, 0), (0, 0))
    return bm, extra


def _rim(s, h, half=False, vertical=False):
    bm = bm_torus(s, s * 0.08, 20, 5)
    transform_bm(bm, scale=(1, 1, h * 1.2), loc=(0, 0, s * h * 0.5))
    if half:
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.001], context="VERTS")
    if vertical:
        transform_bm(bm, rot_x=math.pi / 2)
    return bm


def build(key, spec, rng, x=0.0, y=0.0, rot=0.0, z=0.0):
    """かけら1つを (x, y) に置いて、オブジェクトのリストを返す。"""
    bm, extra = shape_piece(spec, rng)
    objs = []
    transform_bm(bm, rot_z=rot, loc=(x, y, z))
    objs.append(mesh_object("food_" + key, bm, _mat(key, spec)))
    for ebm, col in extra:
        drop = 0.0
        transform_bm(ebm, rot_z=rot, loc=(x, y, z + drop))
        objs.append(mesh_object("food_" + key + "_x", ebm, _solid(key, col)))
    if spec.get("glaze"):
        for o in objs[:1]:
            pass
    return objs
