"""人物：部品（体・着物・顔・髪・小物）を組み立て、ポーズと表情を変えてレンダリングする。

1人の人物は CHARACTERS の設定（色・髪型・服・小物）から作る。
動き：walk（歩く4コマ）/ wait（待つ2コマ）/ worry（待ちくたびれ2コマ）/ eat（食べる2コマ）/ happy（喜ぶ2コマ）/ angry（怒る2コマ）
"""
import math

import bpy
import bmesh
from mathutils import Vector, Euler

from common import (link, new_material, bm_icosphere, bm_tube, transform_bm, hex_rgb)

# ---------------------------------------------------------------------------
# 色（パレットの色に近いものを使う。最後はパレットに置き換わる）
# ---------------------------------------------------------------------------
SKIN = "#f6c39c"
SKIN_OLD = "#e8b48c"
HAIR = "#2e1a12"
GRAY_HAIR = "#d6ccb8"

# 人物の設定。body: 'kimono' 着物 / 'happi' 法被とももひき / 'samurai' 裃と袴 / 'sumo' 力士 / 'robe' 僧衣 / 'modern' 現代の服
CHARACTERS = {
    # 客の種類（それぞれ2通りの色）
    "chonin_a":   dict(body="kimono", cloth="#b87838", cloth2="#8c5228", obi="#5a3218", hair="mage", extra=["tenugui"]),
    "chonin_b":   dict(body="kimono", cloth="#34569a", cloth2="#243f7a", obi="#dca24a", hair="mage"),
    "shokunin_a": dict(body="happi", cloth="#34569a", cloth2="#fffaf0", obi="#c42618", hair="mage", extra=["hachimaki"]),
    "shokunin_b": dict(body="happi", cloth="#8c5228", cloth2="#f0e6d2", obi="#243f7a", hair="mage", extra=["hachimaki"]),
    "samurai_a":  dict(body="samurai", cloth="#243f7a", cloth2="#aaa292", obi="#f0e6d2", hair="mage", extra=["swords"]),
    "samurai_b":  dict(body="samurai", cloth="#5a3218", cloth2="#76726a", obi="#f0e6d2", hair="mage", extra=["swords"]),
    "bozu_a":     dict(body="robe", cloth="#2e1a12", cloth2="#dca24a", obi="#dca24a", hair="bald", extra=["juzu"]),
    "bozu_b":     dict(body="robe", cloth="#4a4658", cloth2="#b87838", obi="#b87838", hair="bald", extra=["juzu"]),
    "rikishi_a":  dict(body="sumo", cloth="#5070b0", cloth2="#34569a", obi="#243f7a", hair="oicho", scale=1.12),
    "rikishi_b":  dict(body="sumo", cloth="#b8323a", cloth2="#7a1414", obi="#7a1414", hair="oicho", scale=1.12),
    "tsujin_a":   dict(body="kimono", cloth="#76726a", cloth2="#4a4658", obi="#dca24a", hair="mage_gray", extra=["haori", "fan"], old=True),
    "tsujin_b":   dict(body="kimono", cloth="#5a3218", cloth2="#2e1a12", obi="#f5b860", hair="mage_gray", extra=["haori", "fan"], old=True),
    # 常連
    "yokichi":    dict(body="happi", cloth="#dca24a", cloth2="#fffaf0", obi="#34569a", hair="mage", extra=["tenugui", "pole"]),
    "genpachi":   dict(body="happi", cloth="#243f7a", cloth2="#fffaf0", obi="#f24a2a", hair="mage", extra=["hachimaki_red"], brows="thick"),
    "hotta":      dict(body="samurai", cloth="#34569a", cloth2="#d6ccb8", obi="#f0e6d2", hair="mage", extra=["swords", "crest"]),
    "jonen":      dict(body="robe", cloth="#2e1a12", cloth2="#f5b860", obi="#f5b860", hair="bald", extra=["juzu"], old=True, eyes="calm"),
    "ikazuchi":   dict(body="sumo", cloth="#dca24a", cloth2="#b87838", obi="#8c5228", hair="oicho", scale=1.22, brows="thick"),
    "sessai":     dict(body="kimono", cloth="#4a4658", cloth2="#2e1a12", obi="#f0664e", hair="mage_gray", extra=["haori", "fan"], old=True),
    # ライバル・VIP・旅の客
    "tatsu":      dict(body="happi", cloth="#fffaf0", cloth2="#d6ccb8", obi="#243f7a", hair="mage", extra=["hachimaki_twist"], brows="angry"),
    "chin":       dict(body="robe", cloth="#c42618", cloth2="#dca24a", obi="#dca24a", hair="short", extra=["chefhat"]),
    "ransai":     dict(body="kimono", cloth="#76726a", cloth2="#243f7a", obi="#2e1a12", hair="mage", extra=["haori", "glasses", "book"]),
    "raizo":      dict(body="kimono", cloth="#f0664e", cloth2="#fffaf0", obi="#243f7a", hair="mage_big", extra=["kumadori"], brows="angry"),
    "uesama":     dict(body="samurai", cloth="#5070b0", cloth2="#34569a", obi="#f5b860", hair="mage", extra=["crest_gold", "swords"]),
    "tabibito":   dict(body="kimono", cloth="#aaa292", cloth2="#76726a", obi="#5a3218", hair="mage", extra=["kasa", "cape"]),
    # 会話にだけ出る人
    "okane":      dict(body="kimono", cloth="#8c5228", cloth2="#5a3218", obi="#f0e6d2", hair="bun_gray", extra=["apron"], old=True),
    "kumazo":     dict(body="happi", cloth="#5a3218", cloth2="#8c5228", obi="#2e1a12", hair="wild", extra=["fur"], brows="thick"),
    "gonta":      dict(body="happi", cloth="#243f7a", cloth2="#34569a", obi="#f0e6d2", hair="mage", extra=["hachimaki"]),
    "genba":      dict(body="kimono", cloth="#fffaf0", cloth2="#d6ccb8", obi="#76726a", hair="mage", extra=["eboshi"], old=True, brows="thick"),
    "messenger":  dict(body="samurai", cloth="#2e1a12", cloth2="#4a4658", obi="#f0e6d2", hair="mage", extra=["swords"]),
    # 主人公
    "mateo":      dict(body="modern", cloth="#2e1a12", cloth2="#fffaf0", obi="#c42618", hair="short", extra=["bandana", "apron_modern"]),
    "mateo_happi": dict(body="happi", cloth="#c42618", cloth2="#fffaf0", obi="#243f7a", hair="short", extra=["hachimaki_red", "crest_taco"]),
    "pon":        dict(body="tanuki", cloth="#8c5228", cloth2="#5a3218", obi="#f0e6d2", hair="none"),
}

# 動きのコマ数
ANIMS = {"walk": 4, "wait": 2, "worry": 2, "eat": 2, "happy": 2, "angry": 2}
# マテオだけの動き：cook 調理中の手元 / greet いらっしゃい / pose 決めポーズ / spin 着替えの回転
MATEO_ANIMS = {"cook": 2, "greet": 2, "pose": 2, "spin": 2, "wait": 2, "happy": 2, "walk": 4}
PON_ANIMS = {"wait": 2, "happy": 2}


# ---------------------------------------------------------------------------
# 部品づくりの道具
# ---------------------------------------------------------------------------
_mats = {}


def mat(color, rough=0.7, emit=0.0):
    name = "m_%s_%d_%d" % (color.strip("#"), int(rough * 10), int(emit * 10))
    found = bpy.data.materials.get(name)   # シーンを作り直すと消えるので、名前で探す
    if found:
        return found
    m, nt, bsdf = new_material(name, color, roughness=rough)
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(color), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit
    return m


def obj(name, bm, material, parent=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
    me.materials.append(material)
    ob = link(bpy.data.objects.new(name, me))
    if parent is not None:
        ob.parent = parent
    return ob


def empty(name, loc, parent=None):
    e = link(bpy.data.objects.new(name, None))
    e.location = loc
    if parent is not None:
        e.parent = parent
    return e


def sphere(r, sx=1, sy=1, sz=1, loc=(0, 0, 0), sub=2):
    bm = bm_icosphere(r, sub)
    transform_bm(bm, scale=(sx, sy, sz), loc=loc)
    return bm


def box(sx, sy, sz, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    transform_bm(bm, scale=(sx, sy, sz), rot_z=rz, rot_x=rx, rot_y=ry, loc=loc)
    return bm


def cone(r0, r1, h, loc=(0, 0, 0), seg=20, sx=1.0, sy=1.0):
    """下の半径 r0、上の半径 r1、高さ h の筒（z 方向）。"""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r0, radius2=r1, depth=h)
    transform_bm(bm, scale=(sx, sy, 1), loc=(loc[0], loc[1], loc[2] + h / 2))
    return bm


def capsule(p0, p1, r, seg=10):
    pts = [Vector(p0).lerp(Vector(p1), t / 6) for t in range(7)]
    radii = [r * (0.85 + 0.15 * math.sin(math.pi * t / 6)) for t in range(7)]
    return bm_tube([tuple(p) for p in pts], radii, seg)


# ---------------------------------------------------------------------------
# 人物を組み立てる
# ---------------------------------------------------------------------------
class Person:
    def __init__(self, key):
        self.key = key
        c = CHARACTERS[key]
        self.c = c
        sc = c.get("scale", 1.0)
        self.root = empty(key + "_root", (0, 0, 0))
        self.root.scale = (sc, sc, sc)
        self.parts = {}
        self.faces = {}
        self.build()

    # --- 体 ---
    def build(self):
        c = self.c
        skin = mat(SKIN_OLD if c.get("old") else SKIN, 0.6)
        cloth, cloth2, obi = mat(c["cloth"]), mat(c["cloth2"]), mat(c["obi"])
        body = c["body"]
        R = self.root
        self.hips = empty("hips", (0, 0, 0.55), R)
        self.chest = empty("chest", (0, 0, 0.42), self.hips)          # 胸（z = 0.97）
        self.headp = empty("head", (0, 0, 0.08), self.chest)           # 首（z = 1.05）
        self.headp.scale = (1.14, 1.14, 1.14)                          # 頭を大きめに（表情が読めるように）
        self.arm = {s: empty("arm%d" % s, (0.25 * s, 0, 0.0), self.chest) for s in (-1, 1)}
        self.leg = {s: empty("leg%d" % s, (0.09 * s, 0, -0.27), self.hips) for s in (-1, 1)}

        # 足（脚と履物）
        foot_mat = mat("#fffaf0") if body not in ("modern", "sumo") else (mat("#243f7a") if body == "modern" else skin)
        geta = mat("#8c5228") if body != "modern" else mat("#f0e6d2")
        for s in (-1, 1):
            obj("shin", capsule((0, 0, 0), (0, 0, -0.22), 0.055), foot_mat if body != "happi" else mat(c["cloth"] if False else "#2e1a12"), self.leg[s])
            obj("foot", box(0.09, 0.15, 0.04, loc=(0, -0.03, -0.26)), geta, self.leg[s])

        if body == "tanuki":
            self.tanuki()
            return
        if body == "sumo":
            # 大きなお腹とまわし
            obj("belly", sphere(0.34, 1.05, 0.9, 1.0, loc=(0, 0, 0.12)), skin, self.hips)
            obj("mawashi", cone(0.34, 0.33, 0.14, loc=(0, 0, -0.12), sx=1.02, sy=0.92), obi, self.hips)
            obj("mawashi_front", box(0.14, 0.04, 0.12, loc=(0, -0.3, -0.12)), obi, self.hips)
            obj("chest", sphere(0.3, 1.0, 0.85, 0.7, loc=(0, 0, 0.0)), skin, self.chest)
        elif body == "modern":
            obj("pants", cone(0.2, 0.2, 0.3, loc=(0, 0, -0.28)), mat("#243f7a"), self.hips)
            obj("shirt", cone(0.22, 0.23, 0.45, loc=(0, 0, -0.02)), cloth, self.hips)
        elif body == "happi":
            obj("pants", cone(0.19, 0.2, 0.26, loc=(0, 0, -0.24)), mat("#2e1a12"), self.hips)
            obj("coat", cone(0.25, 0.23, 0.5, loc=(0, 0, -0.08)), cloth, self.hips)
            obj("coat_hem", cone(0.255, 0.255, 0.05, loc=(0, 0, -0.08)), cloth2, self.hips)
            obj("obi", cone(0.235, 0.235, 0.07, loc=(0, 0, 0.02)), obi, self.hips)
        elif body == "samurai":
            obj("hakama", cone(0.33, 0.22, 0.52, loc=(0, 0, -0.52)), cloth2, self.hips)
            obj("kimono", cone(0.22, 0.23, 0.45, loc=(0, 0, -0.02)), cloth, self.hips)
            for s in (-1, 1):   # 肩衣
                obj("kataginu", box(0.2, 0.2, 0.05, loc=(0.2 * s, 0, 0.02), ry=-0.35 * s), cloth2, self.chest)
            obj("obi", cone(0.235, 0.235, 0.06, loc=(0, 0, 0.0)), obi, self.hips)
        elif body == "robe":
            obj("robe", cone(0.3, 0.22, 0.95, loc=(0, 0, -0.52)), cloth, self.hips)
            obj("kesa", box(0.08, 0.5, 0.62, loc=(0.02, -0.02, 0.14), rx=0.0, ry=0.55), cloth2, self.hips)
        else:   # 着物
            obj("kimono", cone(0.28, 0.22, 0.95, loc=(0, 0, -0.52)), cloth, self.hips)
            obj("obi", cone(0.235, 0.235, 0.09, loc=(0, 0, 0.0)), obi, self.hips)
        if body not in ("sumo", "modern"):
            # 襟（白い下襟が V の字に見える）
            for s in (-1, 1):
                obj("collar", box(0.05, 0.03, 0.3, loc=(0.05 * s, -0.215, 0.32), ry=0.35 * s), mat("#fffaf0"), self.hips)
        if body == "modern":
            obj("collar", box(0.14, 0.03, 0.04, loc=(0, -0.2, 0.38)), skin, self.hips)

        # 腕（袖）と手
        sleeve = cloth if body not in ("sumo",) else skin
        for s in (-1, 1):
            a = self.arm[s]
            if body in ("kimono", "robe", "samurai") :
                obj("sleeve", box(0.15, 0.17, 0.34, loc=(0.03 * s, 0, -0.18)), sleeve, a)
            elif body == "sumo":
                obj("upper", capsule((0, 0, 0), (0.05 * s, 0, -0.34), 0.1), skin, a)
            else:
                obj("sleeve", capsule((0, 0, 0), (0.04 * s, 0, -0.3), 0.085), sleeve, a)
            obj("hand", sphere(0.065, loc=(0.04 * s, -0.02, -0.38)), skin, a)

        # 頭
        H = self.headp
        obj("neck", capsule((0, 0, -0.05), (0, 0, 0.06), 0.07), skin, H)
        obj("head", sphere(0.27, 1.0, 0.95, 1.0, loc=(0, 0, 0.27), sub=3), skin, H)
        for s in (-1, 1):
            obj("ear", sphere(0.055, 0.6, 1, 1, loc=(0.265 * s, 0.02, 0.25)), skin, H)
        self.hair(c.get("hair"), H)
        self.face(c, H)
        self.extras(c, H)

    # --- たぬき（ポン吉） ---
    def tanuki(self):
        fur, dark, belly = mat("#8c5228", 0.9), mat("#2e1a12", 0.9), mat("#f0e6d2", 0.9)
        R = self.root
        self.hips = empty("hips", (0, 0, 0.55), R)
        self.chest = empty("chest", (0, 0, 0.06), self.hips)
        self.headp = empty("head", (0, 0, 0.02), self.chest)   # 頭を体に少し沈めて、すき間ができないように
        self.arm = {s: empty("arm%d" % s, (0.24 * s, -0.02, 0.0), self.chest) for s in (-1, 1)}
        self.leg = {s: empty("leg%d" % s, (0.13 * s, 0, -0.42), self.hips) for s in (-1, 1)}
        obj("body", sphere(0.36, 1.0, 0.9, 1.0, loc=(0, 0, -0.12)), fur, self.hips)
        obj("belly", sphere(0.26, 1.0, 0.5, 1.1, loc=(0, -0.17, -0.14)), belly, self.hips)
        obj("tail", capsule((0, 0.25, -0.35), (0.2, 0.5, -0.2), 0.12), fur, self.hips)
        obj("tail_ring", capsule((0.12, 0.4, -0.27), (0.16, 0.46, -0.24), 0.125), dark, self.hips)
        for s in (-1, 1):
            obj("leg", capsule((0, 0, 0.05), (0, -0.02, -0.12), 0.09), dark, self.leg[s])
            obj("arm", capsule((0, 0, 0), (0.05 * s, -0.05, -0.22), 0.07), dark, self.arm[s])
        H = self.headp
        obj("head", sphere(0.3, 1.1, 0.95, 0.95, loc=(0, 0, 0.25), sub=3), fur, H)
        for s in (-1, 1):
            obj("ear", sphere(0.09, 1, 0.6, 1, loc=(0.2 * s, 0.03, 0.5)), dark, H)
            obj("mask", sphere(0.11, 1.2, 0.4, 0.8, loc=(0.12 * s, -0.24, 0.26)), dark, H)
        obj("muzzle", sphere(0.12, 1.2, 0.8, 0.8, loc=(0, -0.24, 0.16)), belly, H)
        obj("nose", sphere(0.04, loc=(0, -0.34, 0.2)), dark, H)
        obj("leaf", sphere(0.13, 1.0, 0.25, 0.55, loc=(0.05, 0.0, 0.58)), mat("#46b03a", 0.6), H)
        obj("leaf_stem", capsule((0.0, 0.0, 0.52), (-0.04, 0.0, 0.47), 0.012), mat("#1f6a2c"), H)
        self.face({"eyes": None}, H)
        # 目の位置を、たぬきの黒いふちの上に合わせる
        for k in ("eyes_open", "eyes_happy", "eyes_closed"):
            for o in self.faces[k]:
                o.location.y -= 0.035
        for o in self.faces.get("mouth_ok", []) + self.faces.get("mouth_smile", []) + self.faces.get("mouth_open", []):
            o.location.y -= 0.07
            o.location.z -= 0.02
        self.taco = obj("taco", sphere(0.1, 1.2, 0.6, 0.55, loc=(0.0, -0.08, -0.25)), mat("#f4cc62"), self.arm[1])
        self.taco_fill = obj("taco_fill", sphere(0.07, 1.1, 0.5, 0.5, loc=(0.0, -0.1, -0.2)), mat("#46b03a"), self.arm[1])

    # --- 髪 ---
    def hair(self, style, H):
        hair = mat(GRAY_HAIR if style in ("mage_gray", "bun_gray") else HAIR, 0.5)
        if style == "bald":
            return
        if style in ("mage", "mage_gray", "mage_big"):
            # 月代（そった頭のてっぺん）＋ まわりの髪 ＋ まげ
            b = sphere(0.285, 1.0, 1.0, 0.8, loc=(0, 0.035, 0.26), sub=3)
            bmesh.ops.delete(b, geom=[v for v in b.verts if v.co.z > 0.43 or v.co.y < 0.02], context="VERTS")
            obj("hair_side", b, hair, H)
            big = 1.5 if style == "mage_big" else 1.0
            obj("mage", capsule((0, 0.14, 0.55), (0, -0.1 * big, 0.6), 0.045 * big), hair, H)
            obj("mage_tie", sphere(0.05, loc=(0, 0.1, 0.56)), mat("#f0e6d2"), H)
        elif style == "oicho":
            b = sphere(0.285, 1.0, 1.0, 0.85, loc=(0, 0.035, 0.28), sub=3)
            bmesh.ops.delete(b, geom=[v for v in b.verts if v.co.y < -0.14 and v.co.z > 0.18], context="VERTS")
            obj("hair", b, hair, H)
            obj("oicho", sphere(0.14, 1.3, 0.5, 0.6, loc=(0, 0.02, 0.58)), hair, H)
        elif style == "short":
            b = sphere(0.29, 1.0, 1.0, 0.9, loc=(0, 0.03, 0.3), sub=3)
            bmesh.ops.delete(b, geom=[v for v in b.verts if v.co.y < -0.15 and v.co.z < 0.45], context="VERTS")
            obj("hair", b, hair, H)
        elif style == "wild":
            b = sphere(0.31, 1.05, 1.05, 0.95, loc=(0, 0.03, 0.3), sub=2)
            bmesh.ops.delete(b, geom=[v for v in b.verts if v.co.y < -0.16 and v.co.z < 0.45], context="VERTS")
            obj("hair", b, hair, H)
        elif style == "bun_gray":
            b = sphere(0.29, 1.0, 1.0, 0.9, loc=(0, 0.03, 0.3), sub=3)
            bmesh.ops.delete(b, geom=[v for v in b.verts if v.co.y < -0.15 and v.co.z < 0.47], context="VERTS")
            obj("hair", b, hair, H)
            obj("bun", sphere(0.12, loc=(0, 0.12, 0.58)), hair, H)

    # --- 顔（表情ごとに部品を用意して、見せる・隠すで切りかえる） ---
    def face(self, c, H):
        dark = mat("#1c1220", 0.3)
        white = mat("#fffaf0", 0.3)
        red = mat("#7a1414", 0.5)
        pink = mat("#f0664e", 0.6)
        ey, fy = 0.26, -0.255
        F = {}
        calm = c.get("eyes") == "calm"
        # 目
        e_open = []
        for s in (-1, 1):
            if calm:
                e_open.append(obj("eye_calm", box(0.07, 0.02, 0.015, loc=(0.1 * s, fy, ey)), dark, H))
            else:
                e_open.append(obj("eye_white", sphere(0.06, 0.95, 0.45, 1.15, loc=(0.1 * s, fy + 0.012, ey)), white, H))
                e_open.append(obj("eye", sphere(0.046, 0.85, 0.5, 1.15, loc=(0.1 * s + 0.008, fy - 0.004, ey - 0.005)), dark, H))
                e_open.append(obj("eye_hi", sphere(0.016, loc=(0.1 * s - 0.01, fy - 0.03, ey + 0.02)), white, H))
        F["eyes_open"] = e_open
        e_happy = []
        for s in (-1, 1):   # ^ ^ の目
            for k in (-1, 1):
                e_happy.append(obj("eye_happy", box(0.05, 0.02, 0.015, loc=(0.1 * s + 0.02 * k, fy, ey + 0.012), ry=0.6 * k), dark, H))
        F["eyes_happy"] = e_happy
        e_closed = [obj("eye_closed", box(0.07, 0.02, 0.013, loc=(0.1 * s, fy, ey - 0.01)), dark, H) for s in (-1, 1)]
        F["eyes_closed"] = e_closed
        # 眉
        thick = 1.6 if c.get("brows") == "thick" else 1.0
        bc = mat(GRAY_HAIR if c.get("hair") in ("mage_gray", "bun_gray") else HAIR, 0.5)
        F["brows_ok"] = [obj("brow", box(0.08, 0.02, 0.018 * thick, loc=(0.1 * s, fy + 0.005, ey + 0.08), ry=0.12 * s if c.get("brows") != "angry" else 0.3 * s), bc, H) for s in (-1, 1)]
        F["brows_worry"] = [obj("brow_w", box(0.08, 0.02, 0.018 * thick, loc=(0.1 * s, fy + 0.005, ey + 0.09), ry=-0.35 * s), bc, H) for s in (-1, 1)]
        F["brows_angry"] = [obj("brow_a", box(0.09, 0.02, 0.022 * thick, loc=(0.1 * s, fy + 0.005, ey + 0.07), ry=0.5 * s), bc, H) for s in (-1, 1)]
        # 口
        my = 0.105
        F["mouth_ok"] = [obj("mouth", box(0.07, 0.02, 0.014, loc=(0, fy + 0.01, my)), red, H)]
        smile = sphere(0.08, 1.0, 0.35, 0.8, loc=(0, fy + 0.005, my + 0.01))
        bmesh.ops.delete(smile, geom=[v for v in smile.verts if v.co.z > my + 0.005], context="VERTS")
        F["mouth_smile"] = [obj("mouth_smile", smile, red, H)]
        F["mouth_open"] = [obj("mouth_open", sphere(0.05, 1.2, 0.35, 0.55, loc=(0, fy + 0.012, my - 0.01)), red, H)]
        F["mouth_angry"] = [obj("mouth_angry", box(0.1, 0.02, 0.04, loc=(0, fy + 0.01, my)), red, H),
                            obj("teeth", box(0.08, 0.021, 0.012, loc=(0, fy, my + 0.012)), white, H)]
        F["mouth_worry"] = [obj("mouth_w", box(0.05, 0.02, 0.012, loc=(0.01, fy + 0.01, my - 0.005), ry=0.3), red, H)]
        F["mouth_chew"] = [obj("mouth_chew", sphere(0.035, 1.3, 0.35, 0.6, loc=(0, fy + 0.01, my)), red, H)]
        # ほっぺ・汗・湯気・怒りの赤
        F["blush"] = [obj("blush", sphere(0.04, 1.2, 0.3, 0.6, loc=(0.16 * s, fy + 0.03, ey - 0.08)), pink, H) for s in (-1, 1)]
        F["sweat"] = [obj("sweat", sphere(0.035, 0.8, 0.6, 1.2, loc=(0.25, fy + 0.05, ey + 0.1)), mat("#5070b0", 0.2), H)]
        F["steam"] = [obj("steam", sphere(0.08 + 0.02 * k, loc=(0.18 * (1 if k % 2 else -1), 0.0, 0.62 + 0.06 * k)), mat("#fffaf0", 0.9), H) for k in range(3)]
        F["angry_face"] = [obj("angry_mark", box(0.06, 0.02, 0.06, loc=(0.2, fy + 0.04, ey + 0.15), ry=0.785), mat("#f24a2a"), H)]
        self.faces = F

    def set_face(self, expr, frame=0):
        show = {
            "ok": ["eyes_open", "brows_ok", "mouth_ok"],
            "blink": ["eyes_closed", "brows_ok", "mouth_ok"],
            "worry": ["eyes_open", "brows_worry", "mouth_worry", "sweat"],
            "happy": ["eyes_happy", "brows_ok", "mouth_smile", "blush"],
            "eat": ["eyes_happy", "brows_ok", "mouth_chew" if frame else "mouth_open", "blush"],
            "angry": ["eyes_open", "brows_angry", "mouth_angry", "angry_face"] + (["steam"] if frame else []),
            "talk": ["eyes_open", "brows_ok", "mouth_open"],
        }[expr]
        for k, objs in self.faces.items():
            for o in objs:
                o.hide_render = k not in show

    # --- 小物 ---
    def extras(self, c, H):
        ex = c.get("extra", [])
        if "tenugui" in ex:
            obj("tenugui", box(0.24, 0.1, 0.05, loc=(0, 0.06, 0.53), rx=0.2), mat("#f0e6d2"), H)
        if "hachimaki" in ex or "hachimaki_red" in ex or "hachimaki_twist" in ex:
            col = "#f24a2a" if "hachimaki_red" in ex else "#fffaf0"
            b = bm_tube([(0.28 * math.cos(a), 0.28 * math.sin(a) + 0.03, 0.42) for a in [i * math.pi / 12 for i in range(25)]], [0.03 if "hachimaki_twist" in ex else 0.025] * 25, 8, cap=False)
            obj("hachimaki", b, mat(col), H)
            obj("knot", sphere(0.05, loc=(0.18, 0.2, 0.44)), mat(col), H)
        if "bandana" in ex:
            b = sphere(0.3, 1.0, 1.0, 0.72, loc=(0, 0.03, 0.34), sub=3)
            bmesh.ops.delete(b, geom=[v for v in b.verts if v.co.z < 0.38], context="VERTS")
            obj("bandana", b, mat("#c42618"), H)
        if "chefhat" in ex:
            obj("chefhat", cone(0.22, 0.25, 0.22, loc=(0, 0.02, 0.46)), mat("#fffaf0"), H)
        if "eboshi" in ex:
            obj("eboshi", cone(0.2, 0.12, 0.34, loc=(0, 0.06, 0.44)), mat("#1c1220"), H)
        if "kasa" in ex:
            obj("kasa", cone(0.5, 0.02, 0.2, loc=(0, 0.02, 0.44), seg=24), mat("#dca24a"), H)
        if "glasses" in ex:
            for s in (-1, 1):
                b = bm_tube([(0.1 * s + 0.05 * math.cos(a), -0.27, 0.26 + 0.045 * math.sin(a)) for a in [i * math.pi / 8 for i in range(17)]], [0.01] * 17, 6, cap=False)
                obj("glasses", b, mat("#dca24a", 0.3), H)
        if "kumadori" in ex:
            for s in (-1, 1):
                obj("kuma", box(0.12, 0.02, 0.018, loc=(0.1 * s, -0.262, 0.33), ry=0.5 * s), mat("#f24a2a"), H)
                obj("kuma2", box(0.1, 0.02, 0.018, loc=(0.13 * s, -0.26, 0.18), ry=-0.4 * s), mat("#f24a2a"), H)
        chest = self.chest
        if "haori" in ex:
            obj("haori", cone(0.29, 0.27, 0.7, loc=(0, 0.01, -0.62)), mat(c["cloth2"]), chest)
        if "cape" in ex:
            obj("cape", cone(0.31, 0.26, 0.4, loc=(0, 0.01, -0.3)), mat("#dca24a"), chest)
        if "fur" in ex:
            obj("fur", cone(0.27, 0.25, 0.35, loc=(0, 0, -0.32)), mat("#76726a", 0.9), chest)
        if "apron" in ex:
            obj("apron", box(0.34, 0.03, 0.5, loc=(0, -0.24, -0.5)), mat("#f0e6d2"), chest)
        if "apron_modern" in ex:
            obj("apron", box(0.36, 0.03, 0.62, loc=(0, -0.235, -0.5)), mat("#fffaf0"), chest)
            obj("apron_line", box(0.37, 0.035, 0.04, loc=(0, -0.24, -0.25)), mat("#c42618"), chest)
        if "crest" in ex or "crest_gold" in ex or "crest_taco" in ex:
            col = "#f5b860" if "crest_gold" in ex else "#fffaf0"
            for s in (-1, 1):
                obj("crest", sphere(0.04, 1, 0.3, 1, loc=(0.14 * s, -0.215, -0.06)), mat(col), chest)
            if "crest_taco" in ex:
                obj("crest_big", sphere(0.08, 1, 0.3, 0.6, loc=(0, -0.24, -0.25)), mat("#f4cc62"), chest)
        if "swords" in ex:
            for k in range(2):
                obj("sword", capsule((0.25, -0.05 + 0.04 * k, 0.05), (0.2, 0.35 + 0.06 * k, -0.12), 0.028), mat("#1c1220", 0.3), self.hips)
        if "juzu" in ex:
            b = bm_tube([(0.06 * math.cos(a), -0.3 + 0.06 * math.sin(a) * 0.5, 0.03 * math.sin(a)) for a in [i * math.pi / 8 for i in range(17)]], [0.016] * 17, 6, cap=False)
            obj("juzu", b, mat("#8c5228"), self.arm[1])
        if "fan" in ex:
            obj("fan", box(0.03, 0.15, 0.2, loc=(0.07, -0.08, -0.46), rx=0.3), mat("#fffaf0"), self.arm[1])
            obj("fan_top", box(0.035, 0.16, 0.04, loc=(0.07, -0.1, -0.36), rx=0.3), mat("#f24a2a"), self.arm[1])
        if "pole" in ex:
            obj("pole", capsule((-0.7, 0.05, 0.1), (0.7, 0.05, 0.1), 0.025), mat("#b87838"), chest)
        if "book" in ex:
            obj("book", box(0.14, 0.04, 0.18, loc=(0.02, -0.05, -0.45)), mat("#5070b0"), self.arm[-1])
        # 食べるときに持つタコス（ふだんは隠す）
        self.taco = obj("taco", sphere(0.1, 1.2, 0.6, 0.55, loc=(0.0, -0.08, -0.4)), mat("#f4cc62"), self.arm[1])
        self.taco_fill = obj("taco_fill", sphere(0.07, 1.1, 0.5, 0.5, loc=(0.0, -0.1, -0.35)), mat("#46b03a"), self.arm[1])

    # --- ポーズ ---
    def pose(self, anim, frame):
        """anim のコマ frame のポーズにする（向き・体のゆれ・腕・脚・表情）。"""
        R, hips = self.root, self.hips
        c = self.c
        # 基本の姿勢（正面から少し右を向く）
        R.rotation_euler = Euler((0, 0, math.radians(-12)))
        hips.location = (0, 0, 0.55)
        hips.rotation_euler = Euler((0, 0, 0))
        self.headp.rotation_euler = Euler((0, 0, 0))
        for s in (-1, 1):
            self.arm[s].rotation_euler = Euler((0, 0.12 * s, 0))
            self.leg[s].rotation_euler = Euler((0, 0, 0))
        self.taco.hide_render = self.taco_fill.hide_render = True
        bob = 0.0
        if anim == "walk":
            R.rotation_euler = Euler((0, 0, math.radians(-38)))    # 右へ歩く（顔が見えるように少し正面寄り）
            ph = frame / 4 * 2 * math.pi
            for s in (-1, 1):
                self.leg[s].rotation_euler = Euler((0.5 * math.sin(ph) * s, 0, 0))
                self.arm[s].rotation_euler = Euler((-0.45 * math.sin(ph) * s, 0.1 * s, 0))
            bob = 0.03 * abs(math.cos(ph))
            self.set_face("ok")
        elif anim in ("wait", "worry"):
            bob = -0.012 * frame
            self.headp.rotation_euler = Euler((0, 0.05 * (frame * 2 - 1), 0))
            if anim == "worry":
                self.arm[1].rotation_euler = Euler((-1.2, 0.3, 0.3))   # 腕組みぎみ
                self.set_face("worry")
            else:
                self.set_face("blink" if frame == 1 and c.get("eyes") != "calm" else "ok")
        elif anim == "eat":
            self.arm[1].rotation_euler = Euler((-1.9 - 0.2 * frame, 0.2, 0.6))
            self.taco.hide_render = self.taco_fill.hide_render = False
            self.headp.rotation_euler = Euler((0.12 * frame, 0, 0))
            self.set_face("eat", frame)
        elif anim == "happy":
            bob = 0.08 * frame
            for s in (-1, 1):
                self.arm[s].rotation_euler = Euler((0, 2.4 * s, 0))
            self.headp.rotation_euler = Euler((-0.12, 0, 0))
            self.set_face("happy")
        elif anim == "cook":
            for s in (-1, 1):
                self.arm[s].rotation_euler = Euler((-1.1 - 0.25 * ((frame + (s > 0)) % 2), 0.15 * s, 0.25 * s))
            self.headp.rotation_euler = Euler((0.25, 0, 0))
            self.set_face("ok")
        elif anim == "greet":
            self.arm[1].rotation_euler = Euler((0, 2.5, 0.3 * (frame * 2 - 1)))
            self.set_face("talk" if frame == 0 else "happy")
        elif anim == "pose":
            self.arm[1].rotation_euler = Euler((-0.3, 2.2, 0))
            self.arm[-1].rotation_euler = Euler((-0.9, -0.5, -0.4))
            hips.rotation_euler = Euler((0, 0.08, 0))
            bob = 0.03 * frame
            self.set_face("happy")
        elif anim == "spin":
            R.rotation_euler = Euler((0, 0, math.radians(-12 + 120 * (frame + 1))))
            bob = 0.1
            for s in (-1, 1):
                self.arm[s].rotation_euler = Euler((0, 1.2 * s, 0))
            self.set_face("happy")
        elif anim == "angry":
            for s in (-1, 1):
                self.arm[s].rotation_euler = Euler((-0.5, 0.5 * s, 0.4 * s))
            hips.rotation_euler = Euler((0, 0.04 * (frame * 2 - 1), 0))
            self.set_face("angry", frame)
        hips.location = (0, 0, 0.55 + bob)
        bpy.context.view_layer.update()
