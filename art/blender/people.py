"""人物：部品（体・着物・腕と手・顔・髪・小物）を組み立て、ポーズと表情を変えてレンダリングする。

絵づくり（ドット絵らしく、くっきりと）
  ・セル調の塗り：光の向きで「影・地の色・明るい色」の3段に塗り分ける（toon）。3色ともパレットの色なので、
    ドット絵にしたときに色がにじまない。影は少し色相をずらした色（肌の影は赤み、白の影は灰色）。
  ・内側の線：腕が体に重なる所などに、その部品の色を暗くした線を引く（people_render.py の Freestyle）。
    外側の輪郭は、これまでどおりドット絵にする段階（pipeline/pixelate.py）で引く。

1人の人物は CHARACTERS の設定（色・模様・髪型・服・小物）から作る。
動き：walk（歩く4コマ）/ wait（待つ2コマ）/ worry（待ちくたびれ2コマ）/ eat（食べる2コマ）/ happy（喜ぶ2コマ）/ angry（怒る2コマ）
"""
import math

import bpy
import bmesh
from mathutils import Vector, Euler

from common import (link, bm_icosphere, bm_tube, bm_lathe, transform_bm, hex_rgb)

# ---------------------------------------------------------------------------
# 色（すべてパレットの色）。セル調の「影・明るい色」の組み合わせ
# ---------------------------------------------------------------------------
SKIN = "#f6c39c"
SKIN_OLD = "#f6c39c"
HAIR = "#2e1a12"
GRAY_HAIR = "#d6ccb8"

RAMP = {   # 地の色: (影, 明るい色, 線)
    "#f6c39c": ("#d08a64", "#ffe6b0", "#8c5228"),
    "#d08a64": ("#b87838", "#f6c39c", "#5a3218"),
    "#2e1a12": ("#1c1220", "#5a3218", "#1c1220"),
    "#5a3218": ("#2e1a12", "#8c5228", "#1c1220"),
    "#8c5228": ("#5a3218", "#b87838", "#2e1a12"),
    "#b87838": ("#8c5228", "#dca24a", "#5a3218"),
    "#dca24a": ("#b87838", "#f4cc62", "#5a3218"),
    "#f4cc62": ("#dca24a", "#fbe39a", "#8c5228"),
    "#fbe39a": ("#f4cc62", "#fffaf0", "#b87838"),
    "#f5b860": ("#dca24a", "#ffe6b0", "#8c5228"),
    "#ffe6b0": ("#f5b860", "#fffaf0", "#b87838"),
    "#fffaf0": ("#d6ccb8", "#fffaf0", "#76726a"),
    "#f0e6d2": ("#d6ccb8", "#fffaf0", "#76726a"),
    "#d6ccb8": ("#aaa292", "#f0e6d2", "#4a4658"),
    "#aaa292": ("#76726a", "#d6ccb8", "#4a4658"),
    "#76726a": ("#4a4658", "#aaa292", "#1c1220"),
    "#4a4658": ("#1c1220", "#76726a", "#1c1220"),
    "#1c1220": ("#1c1220", "#4a4658", "#1c1220"),
    "#f24a2a": ("#c42618", "#f0664e", "#7a1414"),
    "#c42618": ("#7a1414", "#f24a2a", "#2e1a12"),
    "#b8323a": ("#7a1414", "#f0664e", "#2e1a12"),
    "#f0664e": ("#b8323a", "#f6c39c", "#7a1414"),
    "#7a1414": ("#2e1a12", "#b8323a", "#1c1220"),
    "#a8e05a": ("#46b03a", "#fbe39a", "#1f6a2c"),
    "#46b03a": ("#1f6a2c", "#a8e05a", "#172b58"),
    "#1f6a2c": ("#172b58", "#46b03a", "#0d1830"),
    "#5070b0": ("#34569a", "#aaa292", "#172b58"),
    "#34569a": ("#243f7a", "#5070b0", "#0d1830"),
    "#243f7a": ("#172b58", "#34569a", "#0d1830"),
    "#172b58": ("#0d1830", "#243f7a", "#0d1830"),
}
LIGHT = Vector((-0.45, -0.7, 0.55)).normalized()   # 光の来る向き（左上・手前から）

# 人物の設定。body: 'kimono' 着物 / 'happi' 法被とももひき / 'samurai' 裃と袴 / 'sumo' 力士 / 'robe' 僧衣 / 'modern' 現代の服
#   pattern: 着物の模様 'stripe' 縞 / 'check' 格子 / 'kasuri' 絣（点）  pat: 模様の色
CHARACTERS = {
    # 客の種類（それぞれ2通りの色）
    "chonin_a":   dict(body="kimono", cloth="#b87838", cloth2="#8c5228", obi="#5a3218", hair="mage", extra=["tenugui"], pattern="stripe", pat="#8c5228", eyes='big', nose='round', face='round'),
    "chonin_b":   dict(body="kimono", cloth="#34569a", cloth2="#243f7a", obi="#dca24a", hair="mage", pattern="check", pat="#243f7a", eyes='droopy', face='long', build='thin', size=1.04),
    "shokunin_a": dict(body="happi", cloth="#34569a", cloth2="#fffaf0", obi="#c42618", hair="mage", extra=["hachimaki"], eyes='sharp', face='square', build='stout', nose='big'),
    "shokunin_b": dict(body="happi", cloth="#8c5228", cloth2="#f0e6d2", obi="#243f7a", hair="mage", extra=["hachimaki"], nose='big', hige='mustache', size=0.96),
    "samurai_a":  dict(body="samurai", cloth="#243f7a", cloth2="#aaa292", obi="#f0e6d2", hair="mage", extra=["swords"], brows="thick", eyes='sharp', face='long', build='thin', size=1.05),
    "samurai_b":  dict(body="samurai", cloth="#5a3218", cloth2="#76726a", obi="#f0e6d2", hair="mage", extra=["swords"], eyes='narrow', face='square', build='stout', hige='mustache'),
    "bozu_a":     dict(body="robe", cloth="#2e1a12", cloth2="#dca24a", obi="#dca24a", hair="bald", extra=["juzu"], eyes="calm", face='round', ears='big'),
    "bozu_b":     dict(body="robe", cloth="#4a4658", cloth2="#b87838", obi="#b87838", hair="bald", extra=["juzu"], eyes='droopy', nose='long', build='thin', size=1.03),
    "rikishi_a":  dict(body="sumo", cloth="#5070b0", cloth2="#34569a", obi="#243f7a", hair="oicho", scale=1.1, brows="thick", eyes='big', face='round'),
    "rikishi_b":  dict(body="sumo", cloth="#b8323a", cloth2="#7a1414", obi="#7a1414", hair="oicho", scale=1.1, brows="thick", eyes='sharp', face='square'),
    "tsujin_a":   dict(body="kimono", cloth="#76726a", cloth2="#4a4658", obi="#dca24a", hair="mage_gray", extra=["haori", "fan"], old=True, pattern="kasuri", pat="#4a4658", eyes='narrow', hige='mustache', wrinkles=True, build='thin'),
    "tsujin_b":   dict(body="kimono", cloth="#5a3218", cloth2="#2e1a12", obi="#f5b860", hair="mage_gray", extra=["haori", "fan"], old=True, pattern="stripe", pat="#2e1a12", eyes='droopy', hige='goatee', wrinkles=True, build='stout', size=0.97),
    # 常連
    "yokichi":    dict(body="happi", cloth="#dca24a", cloth2="#fffaf0", obi="#34569a", hair="mage", extra=["tenugui", "pole"], eyes='big', face='round', size=0.96),
    "genpachi":   dict(body="happi", cloth="#243f7a", cloth2="#fffaf0", obi="#f24a2a", hair="mage", extra=["hachimaki_red"], brows="thick", eyes='sharp', face='square', build='stout', nose='big'),
    "hotta":      dict(body="samurai", cloth="#34569a", cloth2="#d6ccb8", obi="#f0e6d2", hair="mage", extra=["swords", "crest"], eyes='sharp', face='long', build='thin', size=1.04),
    "jonen":      dict(body="robe", cloth="#2e1a12", cloth2="#f5b860", obi="#f5b860", hair="bald", extra=["juzu"], old=True, eyes="calm", face='round', ears='big', wrinkles=True),
    "ikazuchi":   dict(body="sumo", cloth="#dca24a", cloth2="#b87838", obi="#8c5228", hair="oicho", scale=1.2, brows="thick", eyes='sharp', face='square'),
    "sessai":     dict(body="kimono", cloth="#4a4658", cloth2="#2e1a12", obi="#f0664e", hair="mage_gray", extra=["haori", "fan"], old=True, pattern="check", pat="#2e1a12", eyes='narrow', hige='mustache', wrinkles=True, face='long', build='thin'),
    # ライバル・VIP・旅の客
    "tatsu":      dict(body="happi", cloth="#fffaf0", cloth2="#d6ccb8", obi="#243f7a", hair="mage", extra=["hachimaki_twist"], brows="angry", eyes='sharp', face='square', nose='big'),
    "chin":       dict(body="robe", cloth="#c42618", cloth2="#dca24a", obi="#dca24a", hair="short", extra=["chefhat"], eyes='narrow', hige='mustache', face='round', build='stout'),
    "ransai":     dict(body="kimono", cloth="#76726a", cloth2="#243f7a", obi="#2e1a12", hair="mage", extra=["haori", "glasses", "book"], face='long', build='thin', nose='long', size=1.04),
    "raizo":      dict(body="kimono", cloth="#f0664e", cloth2="#fffaf0", obi="#243f7a", hair="mage_big", extra=["kumadori"], brows="angry", pattern="check", pat="#fffaf0", eyes='sharp', face='long', nose='long'),
    "uesama":     dict(body="samurai", cloth="#5070b0", cloth2="#34569a", obi="#f5b860", hair="mage", extra=["crest_gold", "swords"], brows="thick", face='long', build='thin', size=1.03),
    "tabibito":   dict(body="kimono", cloth="#aaa292", cloth2="#76726a", obi="#5a3218", hair="mage", extra=["kasa", "cape"], eyes='droopy', hige='goatee'),
    # 会話にだけ出る人
    "okane":      dict(body="kimono", cloth="#8c5228", cloth2="#5a3218", obi="#f0e6d2", hair="bun_gray", extra=["apron"], old=True, pattern="kasuri", pat="#5a3218", lashes=True, eyes='droopy', face='round', wrinkles=True, size=0.92),
    "kumazo":     dict(body="happi", cloth="#5a3218", cloth2="#8c5228", obi="#2e1a12", hair="wild", extra=["fur"], brows="thick", beard=True, eyes='big', nose='round', build='stout', size=1.06),
    "gonta":      dict(body="happi", cloth="#243f7a", cloth2="#34569a", obi="#f0e6d2", hair="mage", extra=["hachimaki"], eyes='big', face='round', build='stout', size=0.95),
    "genba":      dict(body="kimono", cloth="#fffaf0", cloth2="#d6ccb8", obi="#76726a", hair="mage", extra=["eboshi"], old=True, brows="thick", eyes='narrow', hige='mustache', wrinkles=True, face='long'),
    "messenger":  dict(body="samurai", cloth="#2e1a12", cloth2="#4a4658", obi="#f0e6d2", hair="mage", extra=["swords"], eyes='sharp', face='long', build='thin'),
    # 魚河岸の競り（競り人・仲買のライバル）と、常連の漁師
    "seri":       dict(body="happi", cloth="#8c5228", cloth2="#fffaf0", obi="#1c1220", hair="mage", extra=["hachimaki_red"], brows="thick", eyes='big', face='round', nose='round'),
    "itamae":     dict(body="kimono", cloth="#f0e6d2", cloth2="#d6ccb8", obi="#5a3218", hair="mage", extra=["maekake", "tasuki"], eyes='narrow', face='long', build='thin', size=1.03),
    "daidokoro":  dict(body="samurai", cloth="#7a1414", cloth2="#d6ccb8", obi="#f0e6d2", hair="mage_gray", extra=["swords", "crest_gold", "fan"], old=True, brows="thick", scale=1.05, eyes='droopy', build='stout', wrinkles=True, nose='round'),
    "kitsune":    dict(body="happi", cloth="#4a4658", cloth2="#d6ccb8", obi="#dca24a", hair="mage", extra=["tenugui_kubi"], eyes="fox", face='long', build='thin', nose='long', size=1.02),
    # 番付に出てくる他店の主人（屋台に食べに来る）
    "daikokuya":  dict(body="happi", cloth="#5a3218", cloth2="#f0e6d2", obi="#2e1a12", hair="mage", extra=["hachimaki_twist", "maekake"], eyes='droopy', face='round', build='stout', hige='mustache', nose='round', size=1.03),
    "tenkichi":   dict(body="happi", cloth="#fffaf0", cloth2="#34569a", obi="#c42618", hair="mage", extra=["hachimaki", "tasuki"], brows="thick", eyes='sharp', face='long', build='thin', size=1.02),
    "chojuan":    dict(body="kimono", cloth="#243f7a", cloth2="#172b58", obi="#dca24a", hair="mage_gray", extra=["maekake", "glasses"], old=True, pattern="kasuri", pat="#172b58", eyes='calm', hige='goatee', wrinkles=True, face='long', build='thin'),
    "hyotan":     dict(body="kimono", cloth="#b8323a", cloth2="#7a1414", obi="#f4cc62", hair="bun", extra=["apron"], pattern="check", pat="#7a1414", lashes=True, eyes='big', face='round', size=0.95),
    # 長崎の闇商人（唐草の頬かむり）
    "yami":       dict(body="kimono", cloth="#76726a", cloth2="#5a3218", obi="#b8323a", hair="none", extra=["hokamuri", "haori"], pattern="stripe", pat="#4a4658", eyes='narrow', hige='mustache', face='long', build='thin', nose='long'),
    "hamazo":     dict(body="happi", cloth="#34569a", cloth2="#fffaf0", obi="#dca24a", hair="mage", extra=["hachimaki_twist"], brows="thick", stubble=True, eyes='sharp', face='square', build='stout', hige='beard'),
    # 主人公
    "mateo":      dict(body="modern", cloth="#2e1a12", cloth2="#fffaf0", obi="#c42618", hair="short", extra=["bandana", "apron_modern"], brows="thick", stubble=True, face='square'),
    "mateo_happi": dict(body="happi", cloth="#c42618", cloth2="#fffaf0", obi="#243f7a", hair="short", extra=["hachimaki_red", "crest_taco"], brows="thick", stubble=True, face='square'),
    "pon":        dict(body="tanuki", cloth="#8c5228", cloth2="#5a3218", obi="#f0e6d2", hair="none"),
}

# 動きのコマ数
ANIMS = {"walk": 4, "wait": 4, "worry": 2, "eat": 2, "happy": 2, "angry": 2}
# マテオだけの動き：cook 調理中の手元 / greet いらっしゃい / pose 決めポーズ / spin 着替えの回転
MATEO_ANIMS = {"cook": 2, "greet": 2, "pose": 2, "spin": 2, "wait": 4, "happy": 2, "walk": 4}
PON_ANIMS = {"wait": 4, "happy": 2}
# 競りのライバル（仲買）：lean 身を乗り出す / twitch 手がぴくっ / raise 手を上げる / carry 箱を担ぐ / sad 悔しがる / shout 声比べ
RIVALS = ["tatsu", "itamae", "daidokoro", "kitsune"]
RIVAL_ANIMS = {"wait": 4, "lean": 2, "twitch": 2, "raise": 2, "carry": 2, "sad": 2, "shout": 2}
# 競り人：call 掛け声 / lift 箱を軽々と持ち上げる / heavy うなりながら持ち上げる / laugh からかって笑う
SERI_ANIMS = {"wait": 4, "call": 2, "lift": 2, "heavy": 2, "laugh": 2}
# 長崎の闇商人：call 声をかける / laugh 勝ってにやにや / sad 負けて悔しがる / shout イカサマを見破られてあわてる
YAMI_ANIMS = {"wait": 4, "call": 2, "laugh": 2, "sad": 2, "shout": 2}


def anims_for(key):
    """その人物がレンダリングする動き"""
    if key.startswith("mateo"):
        return MATEO_ANIMS
    if key == "pon":
        return PON_ANIMS
    if key == "seri":
        return SERI_ANIMS
    if key == "yami":
        return YAMI_ANIMS
    if key in RIVALS:
        out = dict(ANIMS)
        out.update(RIVAL_ANIMS)
        return out
    return ANIMS


# ---------------------------------------------------------------------------
# セル調のマテリアル
# ---------------------------------------------------------------------------
def _lin(h):
    return (*hex_rgb(h), 1.0)


def _ramp(nt, fac, base):
    sh, li, _ = RAMP.get(base, (base, base, "#1c1220"))
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.interpolation = "CONSTANT"
    els = cr.color_ramp.elements
    els[0].position, els[0].color = 0.0, _lin(sh)
    els[1].position, els[1].color = 0.42, _lin(base)
    e = els.new(0.9)
    e.color = _lin(li)
    nt.links.new(fac, cr.inputs["Fac"])
    return cr.outputs["Color"]


def mat(color, rough=0.7, emit=0.0, pattern=None, pat=None):
    """セル調（光の向きで3段に塗り分ける）。emit は光るもの（そのままの色）。pattern は模様。"""
    name = "t_%s_%s_%s_%d" % (color.strip("#"), pattern or "", (pat or "").strip("#"), int(emit * 10))
    found = bpy.data.materials.get(name)   # シーンを作り直すと消えるので、名前で探す
    if found:
        return found
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    if emit:
        em.inputs["Color"].default_value = _lin(color)
        em.inputs["Strength"].default_value = max(1.0, emit)
    else:
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        dot = nt.nodes.new("ShaderNodeVectorMath")
        dot.operation = "DOT_PRODUCT"
        dot.inputs[1].default_value = tuple(LIGHT)
        nt.links.new(geo.outputs["Normal"], dot.inputs[0])
        ma = nt.nodes.new("ShaderNodeMath")
        ma.operation = "MULTIPLY_ADD"
        ma.inputs[1].default_value = 0.5
        ma.inputs[2].default_value = 0.5
        nt.links.new(dot.outputs["Value"], ma.inputs[0])
        col = _ramp(nt, ma.outputs[0], color)
        if pattern and pat:
            col2 = _ramp(nt, ma.outputs[0], pat)
            attr = nt.nodes.new("ShaderNodeAttribute")
            attr.attribute_name = "rest"
            sep = nt.nodes.new("ShaderNodeSeparateXYZ")
            nt.links.new(attr.outputs["Vector"], sep.inputs[0])
            def band(axis, scale, width):
                s = nt.nodes.new("ShaderNodeMath"); s.operation = "MULTIPLY"; s.inputs[1].default_value = scale
                nt.links.new(sep.outputs[axis], s.inputs[0])
                f = nt.nodes.new("ShaderNodeMath"); f.operation = "FRACT"
                nt.links.new(s.outputs[0], f.inputs[0])
                lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = width
                nt.links.new(f.outputs[0], lt.inputs[0])
                return lt.outputs[0]
            if pattern == "stripe":
                mask = band("X", 14.0, 0.3)
            elif pattern == "check":
                a, b = band("X", 8.0, 0.22), band("Z", 8.0, 0.22)
                mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MAXIMUM"
                nt.links.new(a, mx.inputs[0]); nt.links.new(b, mx.inputs[1])
                mask = mx.outputs[0]
            else:   # 絣：小さな点
                a, b = band("X", 10.0, 0.2), band("Z", 10.0, 0.2)
                mn = nt.nodes.new("ShaderNodeMath"); mn.operation = "MINIMUM"
                nt.links.new(a, mn.inputs[0]); nt.links.new(b, mn.inputs[1])
                mask = mn.outputs[0]
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            nt.links.new(mask, mix.inputs["Factor"])
            nt.links.new(col, mix.inputs[6])
            nt.links.new(col2, mix.inputs[7])
            col = mix.outputs[2]
        nt.links.new(col, em.inputs["Color"])
    # 内側の線の色（Freestyle）
    line = RAMP.get(color, (None, None, "#1c1220"))[2]
    try:
        m.line_color = _lin(line)
    except Exception:
        pass
    m.diffuse_color = _lin(color)
    return m


# ---------------------------------------------------------------------------
# 部品づくりの道具
# ---------------------------------------------------------------------------
NOLINE = "noline"   # 内側の線を引かない部品のコレクション（顔の部品・鼻など）


def _noline_coll():
    c = bpy.data.collections.get(NOLINE)
    if c is None:
        c = bpy.data.collections.new(NOLINE)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c


def obj(name, bm, material, parent=None, smooth=True, noline=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
    rest = me.attributes.new("rest", "FLOAT_VECTOR", "POINT")   # 模様の座標（動いてもずれないように）
    rest.data.foreach_set("vector", [c for v in me.vertices for c in v.co])
    me.materials.append(material)
    if noline:
        ob = bpy.data.objects.new(name, me)
        _noline_coll().objects.link(ob)
    else:
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


def sphere(r, sx=1, sy=1, sz=1, loc=(0, 0, 0), sub=3):
    bm = bm_icosphere(r, sub)
    transform_bm(bm, scale=(sx, sy, sz), loc=loc)
    return bm


def box(sx, sy, sz, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    transform_bm(bm, scale=(sx, sy, sz), rot_z=rz, rot_x=rx, rot_y=ry, loc=loc)
    return bm


def rbox(sx, sy, sz, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0, round_=0.6):
    """角の丸い箱（球をつぶして作る）"""
    bm = bm_icosphere(0.5, 3)
    for v in bm.verts:
        c = v.co
        for i in range(3):
            a = abs(c[i]) * 2
            c[i] = math.copysign(min(0.5, (a ** round_) * 0.5 * 1.25), c[i])
    transform_bm(bm, scale=(sx, sy, sz), rot_z=rz, rot_x=rx, rot_y=ry, loc=loc)
    return bm


def lathe(profile, loc=(0, 0, 0), sx=1.0, sy=1.0, seg=32):
    bm = bm_lathe(profile, seg)
    transform_bm(bm, scale=(sx, sy, 1), loc=loc)
    return bm


def cone(r0, r1, h, loc=(0, 0, 0), seg=24, sx=1.0, sy=1.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r0, radius2=r1, depth=h)
    transform_bm(bm, scale=(sx, sy, 1), loc=(loc[0], loc[1], loc[2] + h / 2))
    return bm


def capsule(p0, p1, r, seg=12, r1=None):
    r1 = r if r1 is None else r1
    pts = [Vector(p0).lerp(Vector(p1), t / 6) for t in range(7)]
    radii = [(r + (r1 - r) * t / 6) * (0.9 + 0.1 * math.sin(math.pi * t / 6)) for t in range(7)]
    return bm_tube([tuple(p) for p in pts], radii, seg)


def curve(points, r, seg=10):
    return bm_tube([tuple(p) for p in points], [r] * len(points), seg)


# ---------------------------------------------------------------------------
# 人物を組み立てる
# ---------------------------------------------------------------------------
HIP_Z = 0.5


class Person:
    def __init__(self, key):
        self.key = key
        c = CHARACTERS[key]
        self.c = c
        sc = c.get("scale", 1.0) * c.get("size", 1.0)   # 背の高さ（人それぞれ）
        self.root = empty(key + "_root", (0, 0, 0))
        self.root.scale = (sc, sc, sc)
        self.faces = {}
        self.build()

    # --- 骨組み ---
    def skeleton(self, hip=HIP_Z, chest=0.34, neck=0.1, shoulder=0.2, arm_len=0.19, leg_x=0.085):
        R = self.root
        self.hips = empty("hips", (0, 0, hip), R)
        self.chest = empty("chest", (0, 0, chest), self.hips)
        self.headp = empty("head", (0, 0, neck), self.chest)
        self.arm = {s: empty("arm%d" % s, (shoulder * s, 0, 0.0), self.chest) for s in (-1, 1)}
        self.fore = {s: empty("fore%d" % s, (0.02 * s, 0, -arm_len), self.arm[s]) for s in (-1, 1)}
        self.hand = {s: empty("hand%d" % s, (0.0, 0, -arm_len * 0.95), self.fore[s]) for s in (-1, 1)}
        self.leg = {s: empty("leg%d" % s, (leg_x * s, 0, -0.2), self.hips) for s in (-1, 1)}

    def build(self):
        c = self.c
        body = c["body"]
        if body == "tanuki":
            self.tanuki()
            return
        skin = mat(SKIN)
        cloth = mat(c["cloth"], pattern=c.get("pattern"), pat=c.get("pat"))
        cloth_plain = mat(c["cloth"])
        cloth2, obi = mat(c["cloth2"]), mat(c["obi"])
        white = mat("#fffaf0")
        big = body == "sumo"
        bw = {"thin": 0.86, "stout": 1.16}.get(c.get("build"), 1.0)   # 体格（胴の太さ）
        self.skeleton(shoulder=(0.4 if big else 0.235) * (1 + (bw - 1) * 0.8), arm_len=0.21 if big else 0.19, leg_x=(0.13 if big else 0.085) * bw)
        H, P, C = self.headp, self.hips, self.chest

        # --- 脚と履物 ---
        for s in (-1, 1):
            L = self.leg[s]
            if body == "modern":
                obj("jeans", capsule((0, 0, 0.1), (0, 0, -0.24), 0.075, r1=0.065), mat("#34569a"), L)
                obj("shoe", rbox(0.12, 0.2, 0.08, loc=(0, -0.04, -0.28)), mat("#fffaf0"), L)
                obj("sole", rbox(0.125, 0.205, 0.03, loc=(0, -0.04, -0.315)), mat("#c42618"), L)
            elif body == "happi":
                obj("momohiki", capsule((0, 0, 0.1), (0, 0, -0.22), 0.075, r1=0.06), mat("#2e1a12"), L)
                obj("jikatabi", rbox(0.11, 0.18, 0.09, loc=(0, -0.035, -0.27)), mat("#243f7a"), L)
            elif body == "sumo":
                obj("leg", capsule((0, 0, 0.1), (0, 0, -0.22), 0.12, r1=0.1), skin, L)
                obj("foot", rbox(0.14, 0.2, 0.07, loc=(0, -0.04, -0.28)), skin, L)
            else:
                obj("ashi", capsule((0, 0, 0.0), (0, 0, -0.22), 0.05), skin, L)
                obj("tabi", rbox(0.1, 0.17, 0.08, loc=(0, -0.035, -0.265)), white, L)
                obj("geta", rbox(0.12, 0.22, 0.035, loc=(0, -0.04, -0.31)), mat("#b87838"), L)
                obj("geta_ha", box(0.1, 0.03, 0.05, loc=(0, -0.11, -0.34)), mat("#5a3218"), L)
                obj("geta_ha", box(0.1, 0.03, 0.05, loc=(0, 0.03, -0.34)), mat("#5a3218"), L)
                obj("hanao", box(0.03, 0.06, 0.02, loc=(0, -0.1, -0.235)), mat("#c42618"), L)

        # --- 胴と着物 ---
        if body == "sumo":
            obj("belly", sphere(0.38, 1.0, 0.85, 0.95, loc=(0, -0.02, 0.12)), skin, P)
            obj("chest", sphere(0.33, 1.25, 0.8, 0.72, loc=(0, 0, -0.02)), skin, C)
            for s2 in (-1, 1):   # 盛り上がった肩
                obj("kata", sphere(0.15, 1.1, 1.0, 0.9, loc=(0.34 * s2, 0.0, 0.03)), skin, C)
            obj("kubi", capsule((0, 0, 0.0), (0, 0, 0.12), 0.16), skin, C)
            obj("mawashi", lathe([(0.37, -0.2), (0.39, -0.12), (0.4, 0.0), (0.0, 0.0), (0.0, -0.2)], loc=(0, 0, -0.06), sy=0.85), obi, P)
            obj("mawashi_mae", rbox(0.16, 0.05, 0.22, loc=(0, -0.33, -0.2)), obi, P)
            for k in range(-2, 3):
                obj("sagari", capsule((k * 0.05, -0.36, -0.15), (k * 0.055, -0.37, -0.36), 0.012), mat(c["cloth2"]), P)
            obj("navel", sphere(0.02, 1, 0.5, 1, loc=(0, -0.34, 0.08)), mat("#d08a64"), P)
        elif body == "modern":
            obj("tshirt", lathe([(0.0, -0.08), (0.2, -0.08), (0.21, 0.1), (0.22, 0.3), (0.2, 0.42), (0.1, 0.46), (0.0, 0.46)], sy=0.8), cloth_plain, P)
            obj("belt", lathe([(0.205, -0.1), (0.205, -0.04), (0.0, -0.04), (0.0, -0.1)], sy=0.82), mat("#5a3218"), P)
            obj("jeans_top", lathe([(0.0, -0.3), (0.19, -0.3), (0.205, -0.1), (0.0, -0.1)], sy=0.8), mat("#34569a"), P)
            obj("neck_v", sphere(0.06, 1.2, 0.3, 0.8, loc=(0, -0.155, 0.43)), skin, P)
        elif body == "happi":
            obj("happi", lathe([(0.0, -0.22), (0.24, -0.22), (0.23, 0.0), (0.22, 0.25), (0.2, 0.42), (0.1, 0.47), (0.0, 0.47)], sy=0.82), cloth_plain, P)
            obj("hem", lathe([(0.243, -0.225), (0.245, -0.17), (0.0, -0.17), (0.0, -0.225)], sy=0.83), mat(c["cloth2"]), P)
            obj("haragake", lathe([(0.0, -0.05), (0.17, -0.05), (0.175, 0.3), (0.0, 0.3)], loc=(0, -0.04, 0), sy=0.72), mat("#2e1a12"), P)
            obj("obi", lathe([(0.232, 0.0), (0.232, 0.07), (0.0, 0.07), (0.0, 0.0)], sy=0.84), obi, P)
            # 襟（白い帯。法被の衿）
            for s in (-1, 1):
                obj("eri", box(0.045, 0.03, 0.42, loc=(0.075 * s, -0.175, 0.2), ry=0.32 * s), mat(c["cloth2"]), P)
        elif body == "samurai":
            obj("kimono", lathe([(0.0, -0.05), (0.21, -0.05), (0.22, 0.25), (0.2, 0.42), (0.1, 0.47), (0.0, 0.47)], sy=0.8), cloth_plain, P)
            obj("hakama", lathe([(0.0, -0.5), (0.33, -0.5), (0.3, -0.3), (0.25, -0.05), (0.22, 0.05), (0.0, 0.05)], sy=0.85), mat(c["cloth2"], pattern="stripe", pat=RAMP.get(c["cloth2"], ("#1c1220",))[0]), P)
            obj("hakama_himo", lathe([(0.225, 0.03), (0.225, 0.08), (0.0, 0.08), (0.0, 0.03)], sy=0.82), mat("#1c1220"), P)
            for s in (-1, 1):   # 肩衣（かたぎぬ）：肩から張り出す
                obj("kataginu", rbox(0.24, 0.2, 0.06, loc=(0.2 * s, 0.0, 0.03), ry=-0.28 * s), mat(c["cloth2"]), C)
                obj("kataginu_mae", box(0.05, 0.03, 0.32, loc=(0.085 * s, -0.17, -0.12), ry=0.12 * s), mat(c["cloth2"]), C)
        elif body == "robe":
            obj("koromo", lathe([(0.0, -0.5), (0.31, -0.5), (0.27, -0.2), (0.22, 0.1), (0.22, 0.3), (0.2, 0.42), (0.1, 0.47), (0.0, 0.47)], sy=0.82), cloth_plain, P)
            obj("kesa", box(0.06, 0.4, 0.62, loc=(0.02, -0.02, 0.14), ry=0.6), mat(c["cloth2"]), P)
            obj("kesa_mae", rbox(0.36, 0.05, 0.3, loc=(0.02, -0.19, -0.05), ry=0.0), mat(c["cloth2"], pattern="check", pat=RAMP.get(c["cloth2"], ("#1c1220",))[0]), P)
        else:   # 着物
            obj("kimono", lathe([(0.0, -0.5), (0.27, -0.5), (0.25, -0.25), (0.22, 0.05), (0.22, 0.3), (0.2, 0.42), (0.1, 0.47), (0.0, 0.47)], sy=0.82), cloth, P)
            obj("okumi", box(0.02, 0.02, 0.5, loc=(0.06, -0.22, -0.25), ry=0.08), mat(RAMP.get(c["cloth"], ("#1c1220",))[0]), P)   # 前の合わせ目
            obj("obi", lathe([(0.226, 0.02), (0.226, 0.12), (0.0, 0.12), (0.0, 0.02)], sy=0.84), obi, P)
            obj("obi_musubi", rbox(0.14, 0.08, 0.08, loc=(0.0, 0.2, 0.07)), obi, P)
        if body in ("kimono", "samurai", "robe"):
            # 襟：白い半襟と、着物の襟（左前ではなく右前に重ねる）
            for s in (-1, 1):
                obj("haneri", box(0.035, 0.025, 0.24, loc=(0.045 * s, -0.17, 0.36), ry=0.42 * s), white, P)
                obj("eri", box(0.05, 0.028, 0.34, loc=(0.075 * s, -0.172, 0.28), ry=0.38 * s), mat(c["cloth2"] if body != "robe" else c["cloth"]), P)

        # 胴の部品を、体格に合わせて横に伸び縮み（太い人は、おなかも出る）
        if bw != 1.0 and not big:
            for o in list(P.children) + list(C.children):
                if o.type == "MESH":
                    o.scale = (o.scale[0] * bw, o.scale[1] * bw, o.scale[2])
            if bw > 1:
                obj("onaka", sphere(0.21, 1.0, 0.8, 0.95, loc=(0, -0.11, 0.18)), cloth if body == "kimono" else cloth_plain, P)

        # --- 腕・袖・手 ---
        for s in (-1, 1):
            A, F, Hd = self.arm[s], self.fore[s], self.hand[s]
            if body == "sumo":
                obj("upper", capsule((0, 0, 0.02), (0.01 * s, 0, -0.2), 0.12, r1=0.1), skin, A)
                obj("lower", capsule((0, 0, 0.02), (0, 0, -0.18), 0.1, r1=0.08), skin, F)
            elif body == "modern":
                obj("sleeve", capsule((0, 0, 0.03), (0.01 * s, 0, -0.12), 0.08, r1=0.075), cloth_plain, A)
                obj("upper", capsule((0, 0, -0.08), (0, 0, -0.2), 0.055), skin, A)
                obj("lower", capsule((0, 0, 0.0), (0, 0, -0.18), 0.052, r1=0.045), skin, F)
            elif body == "happi":
                obj("sleeve", capsule((0, 0, 0.03), (0.01 * s, 0, -0.21), 0.085, r1=0.08), cloth_plain, A)
                obj("sleeve_hem", capsule((0, 0, 0.0), (0, 0, -0.04), 0.083), mat(c["cloth2"]), F)
                obj("lower", capsule((0, 0, -0.03), (0, 0, -0.18), 0.052, r1=0.045), skin, F)
            else:
                # 着物の袖：腕の下に袂（たもと）が下がる
                obj("sleeve", capsule((0, 0, 0.03), (0.01 * s, 0, -0.2), 0.085, r1=0.09), cloth, A)
                obj("tamoto", rbox(0.16, 0.2, 0.26, loc=(0.0, 0.02, -0.11)), cloth, F)
                obj("lower", capsule((0, -0.02, -0.06), (0, -0.02, -0.18), 0.05, r1=0.045), skin, F)
            # 手（ミトンの形に親指）
            hs = 1.25 if big else 1.0
            obj("palm", sphere(0.06 * hs, 0.95, 0.62, 1.05, loc=(0, -0.01, -0.035 * hs)), skin, Hd)
            obj("thumb", capsule((0.0, -0.03, -0.01), (-0.035 * s * -1 if False else -0.032 * s, -0.055, -0.05), 0.022 * hs), skin, Hd)

        # --- 頭 ---
        obj("neck", capsule((0, 0, -0.06), (0, 0, 0.08), 0.075 if not big else 0.11), skin, H)
        fc = c.get("face")
        hs = {"round": (1.05, 0.97), "long": (0.93, 1.07), "square": (1.0, 0.97)}.get(fc, (1.0, 0.97))
        obj("head", sphere(0.32, hs[0], 0.93, hs[1], loc=(0, 0, 0.32)), skin, H)
        jw = {"square": (1.22, 0.78), "long": (0.92, 0.82), "round": (1.08, 0.7)}.get(fc, (1.05, 0.7))
        obj("jaw", sphere(0.24, jw[0], 0.85, jw[1], loc=(0, -0.05, 0.2 - (0.03 if fc == "long" else 0))), skin, H)
        ns = c.get("nose")
        if ns == "big":
            obj("nose", sphere(0.062, 1.1, 0.9, 1.0, loc=(0.0, -0.32, 0.26)), skin, H, noline=True)
        elif ns == "long":
            obj("nose", sphere(0.045, 0.9, 1.2, 1.5, loc=(0.0, -0.33, 0.27)), skin, H, noline=True)
        elif ns == "round":
            obj("nose", sphere(0.055, 1.1, 1.0, 1.0, loc=(0.0, -0.32, 0.25)), skin, H, noline=True)
        else:
            obj("nose", sphere(0.045, 1.0, 0.9, 1.1, loc=(0.0, -0.31, 0.27)), skin, H, noline=True)
        es = 1.35 if c.get("ears") == "big" else 1.0
        for s in (-1, 1):
            obj("ear", sphere(0.06 * es, 0.55, 0.9, 1.15, loc=(0.31 * s * hs[0], 0.03, 0.3)), skin, H)
        self.hair(c.get("hair"), H)
        self.face(c, H)
        self.extras(c, H)
        self.prop_taco()
        self.prop_box()

    # --- たぬき（ポン吉） ---
    def tanuki(self):
        fur, dark, belly, paw = mat("#8c5228"), mat("#2e1a12"), mat("#f0e6d2"), mat("#5a3218")
        R = self.root
        self.hips = empty("hips", (0, 0, 0.42), R)
        self.chest = empty("chest", (0, 0, 0.2), self.hips)
        self.headp = empty("head", (0, 0, 0.12), self.chest)
        self.arm = {s: empty("arm%d" % s, (0.27 * s, -0.04, 0.02), self.chest) for s in (-1, 1)}
        self.fore = {s: empty("fore%d" % s, (0.02 * s, 0, -0.13), self.arm[s]) for s in (-1, 1)}
        self.hand = {s: empty("hand%d" % s, (0.0, 0, -0.12), self.fore[s]) for s in (-1, 1)}
        self.leg = {s: empty("leg%d" % s, (0.14 * s, -0.02, -0.28), self.hips) for s in (-1, 1)}
        # まるい体と白いおなか
        obj("body", sphere(0.36, 1.0, 0.88, 1.0, loc=(0, 0, 0.02)), fur, self.hips)
        obj("belly", sphere(0.25, 1.0, 0.5, 1.15, loc=(0, -0.225, -0.01)), belly, self.hips)
        # 太いしっぽ（しまもよう）
        tail = [(0.18, 0.25, -0.2), (0.35, 0.36, -0.12), (0.45, 0.42, 0.05), (0.48, 0.42, 0.2)]
        obj("tail", bm_tube(tail, [0.1, 0.13, 0.13, 0.09], 12), fur, self.hips)
        for k, pt in enumerate(tail[1:3]):
            obj("tail_ring", sphere(0.135, 1, 1, 0.45, loc=(pt[0], pt[1], pt[2] + 0.05)), dark, self.hips)
        # 足
        for s in (-1, 1):
            obj("leg", capsule((0, 0, 0.1), (0, -0.02, -0.08), 0.1), paw, self.leg[s])
            obj("foot", sphere(0.1, 1.0, 1.3, 0.6, loc=(0, -0.05, -0.12)), paw, self.leg[s])
        # 腕と手（肉球つき）
        for s in (-1, 1):
            obj("arm", capsule((0, 0, 0.04), (0.01 * s, -0.01, -0.13), 0.085, r1=0.075), paw, self.arm[s])
            obj("fore", capsule((0, 0, 0.02), (0, -0.01, -0.11), 0.075, r1=0.07), paw, self.fore[s])
            obj("paw", sphere(0.085, 1.0, 0.85, 0.95, loc=(0, -0.01, -0.02)), paw, self.hand[s])
            obj("pad", sphere(0.04, 1.1, 0.4, 0.9, loc=(0, -0.075, -0.03)), mat("#f0664e"), self.hand[s])
        # 頭
        H = self.headp
        obj("head", sphere(0.34, 1.12, 0.95, 0.92, loc=(0, 0, 0.27)), fur, H)
        obj("cheek_fur", sphere(0.2, 1.6, 0.8, 0.7, loc=(0, -0.08, 0.16)), fur, H)
        for s in (-1, 1):
            obj("ear", sphere(0.1, 1, 0.6, 1, loc=(0.24 * s, 0.03, 0.55)), dark, H)
            obj("ear_in", sphere(0.055, 1, 0.4, 0.9, loc=(0.24 * s, -0.02, 0.54)), mat("#b87838"), H)
            obj("mask", sphere(0.12, 1.25, 0.45, 0.85, loc=(0.13 * s, -0.27, 0.27)), dark, H)
        obj("muzzle", sphere(0.13, 1.25, 0.8, 0.8, loc=(0, -0.27, 0.15)), belly, H)
        obj("nose", sphere(0.045, 1.2, 0.8, 0.9, loc=(0, -0.38, 0.2)), dark, H)
        obj("leaf", sphere(0.14, 1.0, 0.25, 0.55, loc=(0.06, 0.0, 0.64)), mat("#46b03a"), H)
        obj("leaf_vein", box(0.012, 0.02, 0.14, loc=(0.06, -0.035, 0.64)), mat("#1f6a2c"), H)
        obj("leaf_stem", capsule((0.0, 0.0, 0.58), (-0.04, 0.0, 0.53), 0.014), mat("#1f6a2c"), H)
        self.face({"eyes": None, "tanuki": True}, H)
        self.prop_taco()

    # --- 魚の箱（競り人が持ち上げる・ライバルが担ぐ。ふだんは隠す） ---
    def prop_box(self):
        B = empty("box_root", (0, 0, 0), self.root)
        wood, dark, rope = mat("#dca24a"), mat("#8c5228"), mat("#f0e6d2")
        B.scale = (0.8, 0.8, 0.8)
        obj("box", rbox(0.62, 0.42, 0.3, loc=(0, 0, 0), round_=0.85), wood, B)
        obj("box_band", box(0.64, 0.44, 0.04, loc=(0, 0, 0.08)), dark, B)
        obj("box_band2", box(0.64, 0.44, 0.04, loc=(0, 0, -0.08)), dark, B)
        obj("box_rope", box(0.05, 0.46, 0.34, loc=(0.0, 0, 0.0)), rope, B)
        obj("box_fuda", box(0.16, 0.02, 0.12, loc=(0.18, -0.225, 0.02)), mat("#fffaf0"), B)
        self.box = B
        for o in B.children:
            o.hide_render = True

    def show_box(self, loc, rot=(0, 0, 0)):
        self.box.location = loc
        self.box.rotation_euler = Euler(rot)
        for o in self.box.children:
            o.hide_render = False

    # --- 食べるタコス（右手に持つ。ふだんは隠す） ---
    def prop_taco(self):
        Hd = self.hand[1]
        shell = sphere(0.11, 1.25, 0.45, 0.75, loc=(0, -0.09, 0.04))
        bmesh.ops.delete(shell, geom=[v for v in shell.verts if v.co.z > 0.07], context="VERTS")
        self.taco = [obj("taco", shell, mat("#f4cc62"), Hd, smooth=True),
                     obj("taco_fill", sphere(0.09, 1.2, 0.5, 0.35, loc=(0, -0.09, 0.07)), mat("#46b03a"), Hd),
                     obj("taco_fill2", sphere(0.05, 1.0, 0.5, 0.5, loc=(0.04, -0.12, 0.08)), mat("#f24a2a"), Hd)]

    # --- 髪 ---
    def hair(self, style, H):
        hair = mat(GRAY_HAIR if style in ("mage_gray", "bun_gray") else HAIR)
        if style in ("bald", "none", None):
            return
        cz = 0.32   # 頭の中心
        if style in ("mage", "mage_gray", "mage_big"):
            # 月代（そった頭のてっぺん）の下に、横と後ろの髪（鬢と髱）
            b = sphere(0.335, 1.12, 1.03, 0.98, loc=(0, 0.03, cz))
            bmesh.ops.delete(b, geom=[v for v in b.verts if v.co.z > cz + 0.18 or v.co.y < -0.19 or v.co.z < cz - 0.17], context="VERTS")
            obj("bin", b, hair, H)
            big = 1.45 if style == "mage_big" else 1.0
            # 髷：後ろから前へ、頭のてっぺんにのせる
            mg = [(0, 0.24, cz + 0.16), (0, 0.13, cz + 0.33), (0, -0.02, cz + 0.39), (0, -0.17 * big, cz + 0.36)]
            obj("mage", bm_tube(mg, [0.065 * big, 0.07 * big, 0.065 * big, 0.05 * big], 10), hair, H)
            obj("motoyui", capsule((0, 0.19, cz + 0.24), (0, 0.15, cz + 0.29), 0.075 * big), mat("#fffaf0"), H)
        elif style == "oicho":
            b = sphere(0.335, 1.0, 0.98, 0.98, loc=(0, 0.015, cz))
            bmesh.ops.delete(b, geom=[v for v in b.verts if (v.co.y < -0.12 and v.co.z > cz - 0.05) or v.co.z < cz - 0.15 or (v.co.y < -0.05 and v.co.z < cz + 0.05)], context="VERTS")
            obj("hair", b, hair, H)
            obj("oicho", sphere(0.16, 1.4, 0.55, 0.55, loc=(0, -0.02, cz + 0.38)), hair, H)
            obj("oicho_ne", capsule((0, 0.12, cz + 0.28), (0, 0.04, cz + 0.36), 0.05), hair, H)
        elif style == "short":
            b = sphere(0.345, 1.02, 1.0, 0.95, loc=(0, 0.02, cz + 0.03))
            bmesh.ops.delete(b, geom=[v for v in b.verts if (v.co.y < -0.17 and v.co.z < cz + 0.17) or v.co.z < cz - 0.16], context="VERTS")
            obj("hair", b, hair, H)
            for k in range(5):   # 前髪のはね
                x = -0.2 + k * 0.1
                obj("bang", sphere(0.07, 1.0, 0.6, 0.9, loc=(x, -0.26 + abs(x) * 0.25, cz + 0.2 - abs(x) * 0.2)), hair, H)
        elif style == "wild":
            b = sphere(0.36, 1.05, 1.05, 0.95, loc=(0, 0.03, cz + 0.02))
            bmesh.ops.delete(b, geom=[v for v in b.verts if (v.co.y < -0.18 and v.co.z < cz + 0.15) or v.co.z < cz - 0.16], context="VERTS")
            obj("hair", b, hair, H)
            for k in range(9):
                a = -1.2 + k * 0.3
                obj("spike", cone(0.07, 0.0, 0.18, loc=(math.sin(a) * 0.28, 0.05, cz + math.cos(a) * 0.26)), hair, H)
        elif style in ("bun_gray", "bun"):
            b = sphere(0.34, 1.0, 1.0, 0.95, loc=(0, 0.02, cz + 0.02))
            bmesh.ops.delete(b, geom=[v for v in b.verts if (v.co.y < -0.17 and v.co.z < cz + 0.16) or v.co.z < cz - 0.16], context="VERTS")
            obj("hair", b, hair, H)
            obj("bun", sphere(0.14, 1.2, 0.9, 0.8, loc=(0, 0.12, cz + 0.36)), hair, H)
            obj("kanzashi", capsule((-0.18, 0.1, cz + 0.38), (0.16, 0.12, cz + 0.4), 0.014), mat("#f24a2a"), H)

    # --- 顔（表情ごとに部品を用意して、見せる・隠すで切りかえる） ---
    def face(self, c, H):
        dark = mat("#1c1220", emit=1)
        white = mat("#fffaf0", emit=1)
        red = mat("#7a1414", emit=1)
        tongue = mat("#f0664e", emit=1)
        pink = mat("#f0664e", emit=1)
        tan = c.get("tanuki")
        ey = 0.31 if not tan else 0.3
        fy = -0.3 if not tan else -0.33
        ex = 0.115 if not tan else 0.13
        F = {}
        calm = c.get("eyes") in ("calm", "fox")
        fox = c.get("eyes") == "fox"
        # 目：黒目がちの大きな目と、光の点
        e_open = []
        for s in (-1, 1):
            if calm:
                tilt = 0.03 if fox else 0.0   # 狐目：外側がつり上がる
                b = capsule((ex * s - 0.045 * s, fy, ey - 0.005 - tilt), (ex * s + 0.045 * s, fy, ey - 0.005 + tilt), 0.014)
                e_open.append(obj("eye_calm", b, dark, H, noline=True))
            else:
                et = c.get("eyes")
                er, esz = {"big": (0.062, 1.25), "sharp": (0.042, 1.1), "narrow": (0.05, 0.62), "droopy": (0.05, 1.15)}.get(et, (0.05, 1.25))
                e_open.append(obj("eye", sphere(er, 0.8, 0.4, esz, loc=(ex * s, fy, ey)), dark, H, noline=True))
                e_open.append(obj("eye_hi", sphere(0.017 * (1.3 if et == "big" else 1), 1, 0.5, 1, loc=(ex * s - 0.016, fy - 0.025, ey + 0.025 * esz)), white, H, noline=True))
                if et == "sharp":     # 上まぶたが、外へつり上がる
                    e_open.append(obj("lid", box(0.085, 0.02, 0.016, loc=(ex * s + 0.005 * s, fy - 0.004, ey + 0.05), ry=-0.35 * s), dark, H, noline=True))
                elif et == "droopy":  # たれ目：外へ下がるまぶた
                    e_open.append(obj("lid", box(0.085, 0.02, 0.016, loc=(ex * s + 0.008 * s, fy - 0.004, ey + 0.05), ry=0.4 * s), dark, H, noline=True))
                if c.get("lashes"):
                    e_open.append(obj("lash", box(0.05, 0.02, 0.012, loc=(ex * s + 0.03 * s, fy, ey + 0.05), ry=-0.5 * s), dark, H, noline=True))
        F["eyes_open"] = e_open
        e_happy = []
        for s in (-1, 1):   # ^ ^ の目
            pts = [(ex * s - 0.05, fy, ey - 0.01), (ex * s, fy - 0.005, ey + 0.035), (ex * s + 0.05, fy, ey - 0.01)]
            e_happy.append(obj("eye_happy", bm_tube(pts, [0.015] * 3, 6), dark, H, noline=True))
        F["eyes_happy"] = e_happy
        F["eyes_wide"] = []
        for s in (-1, 1):
            F["eyes_wide"].append(obj("eye_wide_w", sphere(0.07, 0.95, 0.4, 1.15, loc=(ex * s, fy + 0.005, ey + 0.01)), white, H, noline=True))
            F["eyes_wide"].append(obj("eye_wide", sphere(0.035, 1, 0.45, 1.1, loc=(ex * s, fy - 0.01, ey + 0.01)), dark, H, noline=True))
        F["eyes_closed"] = [obj("eye_closed", capsule((ex * s - 0.045, fy, ey - 0.01), (ex * s + 0.045, fy, ey - 0.01), 0.013), dark, H) for s in (-1, 1)]
        # 眉
        if not tan:
            thick = 1.6 if c.get("brows") == "thick" else 1.0
            bc = mat(GRAY_HAIR if c.get("hair") in ("mage_gray", "bun_gray") else HAIR)
            ang = 0.32 if c.get("brows") == "angry" else 0.1
            F["brows_ok"] = [obj("brow", box(0.09, 0.025, 0.022 * thick, loc=(ex * s, fy + 0.01, ey + 0.095), ry=ang * s), bc, H, noline=True) for s in (-1, 1)]
            F["brows_worry"] = [obj("brow_w", box(0.09, 0.025, 0.022 * thick, loc=(ex * s, fy + 0.01, ey + 0.1), ry=-0.38 * s), bc, H, noline=True) for s in (-1, 1)]
            F["brows_angry"] = [obj("brow_a", box(0.1, 0.025, 0.026 * thick, loc=(ex * s, fy + 0.01, ey + 0.08), ry=0.55 * s), bc, H, noline=True) for s in (-1, 1)]
        else:
            F["brows_ok"], F["brows_worry"], F["brows_angry"] = [], [], []
        # 口
        my = 0.155 if not tan else 0.1
        mfy = fy + (0.035 if not tan else 0.0)
        F["mouth_ok"] = [obj("mouth", capsule((-0.035, mfy, my), (0.035, mfy, my), 0.011), red, H)]
        sm = [(-0.06, mfy, my + 0.02), (-0.03, mfy - 0.005, my - 0.01), (0.0, mfy - 0.008, my - 0.02), (0.03, mfy - 0.005, my - 0.01), (0.06, mfy, my + 0.02)]
        F["mouth_smile"] = [obj("mouth_smile", bm_tube(sm, [0.013] * 5, 6), red, H, noline=True)]
        F["mouth_open"] = [obj("mouth_open", sphere(0.055, 1.15, 0.3, 0.75, loc=(0, mfy, my - 0.005)), red, H, noline=True),
                           obj("tongue", sphere(0.03, 1.2, 0.3, 0.6, loc=(0, mfy - 0.012, my - 0.025)), tongue, H, noline=True)]
        F["mouth_angry"] = [obj("mouth_angry", box(0.11, 0.02, 0.045, loc=(0, mfy, my)), red, H, noline=True),
                            obj("teeth", box(0.09, 0.021, 0.014, loc=(0, mfy - 0.004, my + 0.012)), white, H, noline=True)]
        F["mouth_worry"] = [obj("mouth_w", bm_tube([(-0.04, mfy, my - 0.01), (0.0, mfy - 0.005, my + 0.012), (0.04, mfy, my - 0.01)], [0.011] * 3, 6), red, H)]
        F["mouth_o"] = [obj("mouth_o", sphere(0.035, 1.0, 0.3, 1.1, loc=(0, mfy, my - 0.005)), red, H, noline=True)]
        F["mouth_chew"] = [obj("mouth_chew", sphere(0.04, 1.3, 0.3, 0.55, loc=(0, mfy, my)), red, H, noline=True)]
        if c.get("stubble"):   # マテオのひげ
            obj("mustache", bm_tube([(-0.08, fy + 0.015, my + 0.05), (0.0, fy - 0.01, my + 0.06), (0.08, fy + 0.015, my + 0.05)], [0.018, 0.024, 0.018], 8), mat(HAIR), H)
        hige = mat(GRAY_HAIR if c.get("hair") in ("mage_gray", "bun_gray") else HAIR)
        if c.get("beard") or c.get("hige") == "beard":
            obj("beard", sphere(0.2, 1.1, 0.6, 0.6, loc=(0, -0.2, 0.1)), hige, H)
        if c.get("hige") == "mustache":
            for s in (-1, 1):
                obj("kuchihige", bm_tube([(0.0, fy + 0.005, my + 0.045), (0.05 * s, fy + 0.0, my + 0.035), (0.09 * s, fy + 0.02, my + 0.0)], [0.017, 0.015, 0.008], 8), hige, H, noline=True)
        if c.get("hige") == "goatee":
            obj("agohige", sphere(0.05, 0.9, 0.6, 1.4, loc=(0, -0.24, 0.04)), hige, H, noline=True)
        if c.get("wrinkles"):   # 目じりと、ほうれい線
            line = mat("#d08a64", emit=1)
            for s in (-1, 1):
                obj("shiwa", box(0.04, 0.015, 0.01, loc=((ex + 0.07) * s, fy + 0.02, ey - 0.005), ry=0.5 * s), line, H, noline=True)
                obj("shiwa2", box(0.012, 0.015, 0.06, loc=(0.075 * s, fy + 0.015, my + 0.03), ry=-0.25 * s), line, H, noline=True)
        # ほっぺ・汗・湯気・怒りの印
        F["blush"] = [obj("blush", sphere(0.045, 1.3, 0.3, 0.6, loc=((ex + 0.07) * s, fy + 0.04, ey - 0.08)), pink, H) for s in (-1, 1)]
        F["sweat"] = [obj("sweat", sphere(0.04, 0.8, 0.6, 1.3, loc=(0.3, fy + 0.08, ey + 0.12)), mat("#5070b0", emit=1), H, noline=True)]
        F["steam"] = [obj("steam", sphere(0.08 + 0.02 * k, loc=(0.2 * (1 if k % 2 else -1), 0.0, 0.7 + 0.07 * k)), mat("#fffaf0"), H) for k in range(3)]
        F["angry_face"] = [obj("angry_mark", box(0.07, 0.02, 0.07, loc=(0.22, fy + 0.06, ey + 0.17), ry=0.785), mat("#f24a2a", emit=1), H, noline=True)]
        self.faces = F

    def set_face(self, expr, frame=0):
        show = {
            "ok": ["eyes_open", "brows_ok", "mouth_ok"],
            "blink": ["eyes_closed", "brows_ok", "mouth_ok"],
            "worry": ["eyes_open", "brows_worry", "mouth_worry", "sweat"],
            "happy": ["eyes_happy", "brows_ok", "mouth_open", "blush"],
            "eat": ["eyes_happy", "brows_ok", "mouth_chew" if frame else "mouth_open", "blush"],
            "angry": ["eyes_open", "brows_angry", "mouth_angry", "angry_face"] + (["steam"] if frame else []),
            "talk": ["eyes_open", "brows_ok", "mouth_open"],
            "wide": ["eyes_wide", "brows_worry", "mouth_o"],
            "shout": ["eyes_closed", "brows_angry", "mouth_open"],
            "smug": ["eyes_closed", "brows_angry", "mouth_smile"],
            "sad": ["eyes_closed", "brows_worry", "mouth_worry", "sweat"],
            "strain": ["eyes_closed", "brows_angry", "mouth_angry", "sweat"],
        }[expr]
        for k, objs in self.faces.items():
            for o in objs:
                o.hide_render = k not in show

    # --- 小物 ---
    def extras(self, c, H):
        ex = c.get("extra", [])
        cz = 0.32
        if "tenugui" in ex:   # 頭にのせた手ぬぐい
            obj("tenugui", rbox(0.3, 0.16, 0.05, loc=(0, 0.04, cz + 0.33), rx=0.15), mat("#f0e6d2", pattern="kasuri", pat="#5070b0"), H)
        if "hachimaki" in ex or "hachimaki_red" in ex or "hachimaki_twist" in ex:
            col = "#f24a2a" if "hachimaki_red" in ex else "#fffaf0"
            b = bm_tube([(0.335 * math.cos(a), 0.32 * math.sin(a) + 0.01, cz + 0.13) for a in [i * math.pi / 14 for i in range(29)]], [0.035 if "hachimaki_twist" in ex else 0.03] * 29, 8, cap=False)
            obj("hachimaki", b, mat(col), H)
            obj("knot", sphere(0.055, loc=(0.2, 0.24, cz + 0.15)), mat(col), H)
            obj("knot_tail", capsule((0.22, 0.27, cz + 0.13), (0.33, 0.34, cz + 0.02), 0.025), mat(col), H)
        if "hokamuri" in ex:   # 頬かむり：唐草の風呂敷を頭からかぶり、あごの下で結ぶ
            b = sphere(0.37, 1.0, 1.0, 0.97, loc=(0, 0.02, cz + 0.02))
            bmesh.ops.delete(b, geom=[v for v in b.verts if (v.co.y < -0.12 and cz - 0.26 < v.co.z < cz + 0.15) or v.co.z < cz - 0.3], context="VERTS")
            obj("hokamuri", b, mat("#1f6a2c", pattern="kasuri", pat="#a8e05a"), H)
            obj("hokamuri_knot", sphere(0.05, loc=(0, -0.2, cz - 0.36)), mat("#1f6a2c"), H)
            for s in (-1, 1):
                obj("hokamuri_tail", capsule((0.03 * s, -0.21, cz - 0.38), (0.1 * s, -0.22, cz - 0.48), 0.024), mat("#1f6a2c"), H)
        if "bandana" in ex:
            b = sphere(0.355, 1.0, 1.0, 0.8, loc=(0, 0.02, cz + 0.05))
            bmesh.ops.delete(b, geom=[v for v in b.verts if v.co.z < cz + 0.13], context="VERTS")
            obj("bandana", b, mat("#c42618", pattern="kasuri", pat="#fffaf0"), H)
            obj("bandana_knot", capsule((0.0, 0.3, cz + 0.12), (0.06, 0.4, cz - 0.05), 0.04), mat("#c42618"), H)
        if "chefhat" in ex:
            obj("chefhat", cone(0.27, 0.3, 0.26, loc=(0, 0.02, cz + 0.22)), mat("#fffaf0"), H)
            obj("chefhat_top", sphere(0.3, 1, 1, 0.5, loc=(0, 0.02, cz + 0.5)), mat("#fffaf0"), H)
        if "eboshi" in ex:
            obj("eboshi", cone(0.24, 0.14, 0.4, loc=(0, 0.04, cz + 0.2)), mat("#1c1220"), H)
        if "kasa" in ex:
            obj("kasa", cone(0.62, 0.03, 0.24, loc=(0, 0.02, cz + 0.24), seg=32), mat("#dca24a", pattern="stripe", pat="#b87838"), H)
        if "glasses" in ex:
            for s in (-1, 1):
                b = bm_tube([(0.115 * s + 0.055 * math.cos(a), -0.32, 0.31 + 0.05 * math.sin(a)) for a in [i * math.pi / 8 for i in range(17)]], [0.011] * 17, 6, cap=False)
                obj("glasses", b, mat("#dca24a"), H)
        if "kumadori" in ex:
            for s in (-1, 1):
                obj("kuma", box(0.13, 0.02, 0.02, loc=(0.12 * s, -0.31, 0.39), ry=0.5 * s), mat("#f24a2a", emit=1), H)
                obj("kuma2", box(0.11, 0.02, 0.02, loc=(0.15 * s, -0.29, 0.22), ry=-0.4 * s), mat("#f24a2a", emit=1), H)
        chest, hips = self.chest, self.hips
        if "maekake" in ex:   # 板前の紺の前掛け
            obj("maekake", rbox(0.36, 0.035, 0.46, loc=(0, -0.235, -0.5)), mat("#243f7a"), chest)
            obj("maekake_himo", box(0.4, 0.035, 0.03, loc=(0, -0.235, -0.28)), mat("#fffaf0"), chest)
        if "tasuki" in ex:    # 袖をたすきで留める
            for s in (-1, 1):
                obj("tasuki", capsule((0.22 * s, -0.17, 0.06), (-0.12 * s, -0.2, -0.26), 0.018), mat("#c42618"), chest)
        if "tenugui_kubi" in ex:   # 首に手ぬぐい
            obj("tenugui_kubi", bm_tube([(0.17 * math.cos(a), -0.02 + 0.15 * math.sin(a), 0.07 - 0.02 * math.sin(a)) for a in [i * math.pi / 10 for i in range(21)]], [0.035] * 21, 8, cap=False), mat("#dca24a", pattern="kasuri", pat="#8c5228"), chest)
        if "haori" in ex:   # 羽織（前が開いている）
            obj("haori", lathe([(0.0, -0.55), (0.3, -0.55), (0.27, -0.2), (0.25, 0.1), (0.23, 0.3), (0.12, 0.38), (0.0, 0.38)], loc=(0, 0.02, 0), sy=0.86), mat(c["cloth2"]), chest)
            for s in (-1, 1):
                obj("haori_himo", sphere(0.025, loc=(0.05 * s, -0.235, -0.08)), mat("#fffaf0"), chest)
        if "cape" in ex:
            obj("cape", lathe([(0.0, -0.32), (0.32, -0.32), (0.27, 0.02), (0.12, 0.08), (0.0, 0.08)], loc=(0, 0.02, 0), sy=0.86), mat("#dca24a"), chest)
        if "fur" in ex:
            obj("fur", lathe([(0.0, -0.36), (0.29, -0.36), (0.26, 0.02), (0.12, 0.08), (0.0, 0.08)], loc=(0, 0.01, 0), sy=0.86), mat("#76726a"), chest)
        if "apron" in ex:
            obj("apron", rbox(0.36, 0.03, 0.52, loc=(0, -0.235, -0.48)), mat("#f0e6d2"), chest)
        if "apron_modern" in ex:
            obj("apron", rbox(0.36, 0.03, 0.62, loc=(0, -0.2, -0.48)), mat("#fffaf0"), chest)
            obj("apron_line", box(0.37, 0.035, 0.035, loc=(0, -0.21, -0.22)), mat("#c42618"), chest)
            obj("apron_pocket", rbox(0.14, 0.035, 0.1, loc=(0, -0.215, -0.42)), mat("#d6ccb8"), chest)
        if "crest" in ex or "crest_gold" in ex or "crest_taco" in ex:
            col = "#f5b860" if "crest_gold" in ex else "#fffaf0"
            for s in (-1, 1):
                obj("crest", sphere(0.04, 1, 0.3, 1, loc=(0.13 * s, -0.19, 0.0)), mat(col, emit=1), chest)
            if "crest_taco" in ex:   # 法被の背中ならぬ胸に、タコスの紋
                shell = sphere(0.09, 1.3, 0.3, 0.75, loc=(0, -0.2, -0.22))
                bmesh.ops.delete(shell, geom=[v for v in shell.verts if v.co.z > -0.2], context="VERTS")
                obj("crest_big", shell, mat("#f4cc62"), chest)
                obj("crest_fill", sphere(0.07, 1.2, 0.3, 0.4, loc=(0, -0.205, -0.2)), mat("#46b03a"), chest)
        if "swords" in ex:
            for k in range(2):
                obj("saya", capsule((0.25, -0.12 + 0.05 * k, 0.12), (0.22, 0.42 + 0.08 * k, -0.18), 0.03), mat("#1c1220"), hips)
                obj("tsuka", capsule((0.25, -0.12 + 0.05 * k, 0.12), (0.27, -0.3 + 0.05 * k, 0.22), 0.028), mat("#fffaf0", pattern="check", pat="#1c1220"), hips)
                obj("tsuba", sphere(0.05, 1, 0.4, 1, loc=(0.255, -0.14 + 0.05 * k, 0.13)), mat("#dca24a"), hips)
        if "juzu" in ex:
            b = bm_tube([(0.075 * math.cos(a), -0.05 + 0.075 * math.sin(a) * 0.4, -0.02 + 0.03 * math.sin(a)) for a in [i * math.pi / 8 for i in range(17)]], [0.02] * 17, 6, cap=False)
            obj("juzu", b, mat("#8c5228"), self.hand[-1])
        if "fan" in ex:
            obj("fan", box(0.03, 0.17, 0.22, loc=(0.0, -0.08, -0.1), rx=0.3), mat("#fffaf0"), self.hand[1])
            obj("fan_top", box(0.035, 0.18, 0.045, loc=(0.0, -0.11, 0.0), rx=0.3), mat("#f24a2a"), self.hand[1])
        if "pole" in ex:   # 天秤棒
            obj("pole", capsule((0.2, -0.7, 0.15), (0.26, 0.9, 0.02), 0.03), mat("#b87838"), chest)
        if "book" in ex:
            obj("book", rbox(0.16, 0.05, 0.2, loc=(0.0, -0.06, -0.08)), mat("#5070b0"), self.hand[-1])

    # --- ポーズ ---
    def pose(self, anim, frame):
        """anim のコマ frame のポーズにする（向き・体のゆれ・腕・脚・表情）。"""
        R, hips = self.root, self.hips
        c = self.c
        tan = c["body"] == "tanuki"
        hip_z = 0.42 if tan else HIP_Z
        R.rotation_euler = Euler((0, 0, math.radians(-12)))
        hips.rotation_euler = Euler((0, 0, 0))
        self.chest.rotation_euler = Euler((0, 0, 0))
        self.headp.rotation_euler = Euler((0, 0, 0))
        for s in (-1, 1):
            # y の回転は、マイナス×s で外へ開く（プラスは体の内側へ）
            self.arm[s].rotation_euler = Euler((0.05, -0.2 * s, 0))
            self.fore[s].rotation_euler = Euler((-0.3, 0.1 * s, 0))
            self.hand[s].rotation_euler = Euler((0, 0, 0))
            self.leg[s].rotation_euler = Euler((0, 0, 0))
        for o in self.taco:
            o.hide_render = True
        if hasattr(self, "box"):
            for o in self.box.children:
                o.hide_render = True
        bob = 0.0

        def arm(s, x, y=0.0, z=0.0, fx=-0.25, fz=0.0, fy=0.0):
            self.arm[s].rotation_euler = Euler((x, y, z))
            self.fore[s].rotation_euler = Euler((fx, fy, fz))

        if anim == "walk":
            R.rotation_euler = Euler((0, 0, math.radians(-38)))    # 右へ歩く（顔が見えるように少し正面寄り）
            ph = frame / 4 * 2 * math.pi
            for s in (-1, 1):
                self.leg[s].rotation_euler = Euler((0.55 * math.sin(ph) * s, 0, 0))
                arm(s, -0.5 * math.sin(ph) * s, -0.12 * s, 0, fx=-0.35 - 0.2 * max(0, -math.sin(ph) * s))
            bob = 0.03 * abs(math.cos(ph))
            self.chest.rotation_euler = Euler((0.06, 0, 0))
            self.set_face("ok")
        elif anim in ("wait", "worry"):
            bob = -0.01 * frame
            self.headp.rotation_euler = Euler((0, 0.05 * (frame * 2 - 1), 0))
            if anim == "wait":   # 4コマ：ふつう → 息を吸う → 首をかしげる → まばたき
                f4 = frame % 4
                bob = [0.0, 0.012, 0.004, -0.004][f4]
                self.chest.rotation_euler = Euler(([0.0, -0.03, 0.0, 0.02][f4], 0, 0))
                self.headp.rotation_euler = Euler(([0.0, -0.04, 0.02, 0.0][f4], [0.0, 0.0, 0.07, 0.03][f4], 0))
                for s in (-1, 1):
                    self.arm[s].rotation_euler = Euler((0.05, (-0.2 - [0, 0.03, 0, 0.01][f4]) * s, 0))
            if anim == "worry":
                arm(1, -1.0, 0.2, 0.35, fx=-1.6)    # あごに手
                arm(-1, -0.4, -0.25, -0.5, fx=-1.5)  # 腕組みぎみ
                self.headp.rotation_euler = Euler((0.06, 0.12 * (frame * 2 - 1), 0))
                self.set_face("worry")
            else:
                if tan:   # ポン吉：おなかの前で手を組む
                    arm(1, -0.7, 0.2, 0.5, fx=-0.9)
                    arm(-1, -0.7, -0.2, -0.5, fx=-0.9)
                self.set_face("blink" if (frame % 4) == 3 and c.get("eyes") not in ("calm", "fox") else "ok")
        elif anim == "eat":
            arm(1, -1.45 - 0.15 * frame, 0.15, 0.35, fx=-1.35)   # タコスを口へ
            arm(-1, -0.6, -0.1, -0.3, fx=-0.9)                  # 下に手をそえる
            for o in self.taco:
                o.hide_render = False
            self.headp.rotation_euler = Euler((0.1 * frame, 0, 0))
            self.set_face("eat", frame)
        elif anim == "happy":
            bob = 0.08 * frame
            if tan:   # ポン吉：両手を横に広げて、手のひらを上へ
                for s in (-1, 1):
                    arm(s, -0.2, -1.25 * s, 0, fx=0.0, fy=-(0.7 + 0.3 * frame) * s)
            else:     # ばんざい
                for s in (-1, 1):
                    arm(s, -0.15, -(2.3 + 0.15 * frame) * s, 0, fx=-0.2, fy=-0.25 * s)
            self.headp.rotation_euler = Euler((-0.12, 0, 0))
            self.set_face("happy")
        elif anim == "cook":
            for s in (-1, 1):
                arm(s, -0.95 - 0.25 * ((frame + (s > 0)) % 2), 0.1 * s, 0.25 * s, fx=-0.6)
            self.headp.rotation_euler = Euler((0.22, 0, 0))
            self.set_face("ok")
        elif anim == "greet":
            arm(1, -0.1, -2.2, 0, fx=-0.3, fy=-0.4 + 0.5 * frame)   # 手をふる
            self.set_face("talk" if frame == 0 else "happy")
        elif anim == "pose":
            arm(1, -0.5, -1.9, 0, fx=-0.2, fy=-0.6)   # 片手を高く
            arm(-1, 0.1, 0.8, 0, fx=-0.2, fy=-1.9)    # もう片方は腰に
            hips.rotation_euler = Euler((0, 0.08, 0))
            bob = 0.03 * frame
            self.set_face("happy")
        elif anim == "spin":
            R.rotation_euler = Euler((0, 0, math.radians(-12 + 120 * (frame + 1))))
            bob = 0.1
            for s in (-1, 1):
                arm(s, 0, -1.2 * s, 0, fx=-0.2)
            self.set_face("happy")
        elif anim == "angry":
            for s in (-1, 1):   # 手を腰に
                arm(s, 0.1, -0.8 * s, 0.0, fx=-0.2, fy=1.9 * s)
            hips.rotation_euler = Euler((0, 0.04 * (frame * 2 - 1), 0))
            self.set_face("angry", frame)
        elif anim == "lean":   # 身を乗り出して、目を見開く
            self.chest.rotation_euler = Euler((0.32, 0, 0))
            self.headp.rotation_euler = Euler((-0.25, 0, 0.05 * (frame * 2 - 1)))
            arm(1, -0.5, 0.25, 0.2, fx=-0.9)
            arm(-1, -0.5, -0.25, -0.2, fx=-0.9)
            self.set_face("wide")
        elif anim == "twitch":   # 手がぴくっと上がりかける
            arm(1, -0.9 - 0.45 * frame, -0.25, 0, fx=-0.9 + 0.3 * frame)
            self.headp.rotation_euler = Euler((-0.05, 0, 0))
            self.set_face("ok" if frame == 0 else "talk")
        elif anim == "raise":    # 「買った！」と手を上げる
            arm(1, -0.2, -2.75, 0, fx=-0.1, fy=-0.1)
            arm(-1, -0.6, -0.1, -0.3, fx=-1.0)
            bob = 0.03 * frame
            self.headp.rotation_euler = Euler((-0.12, 0, 0))
            self.set_face("talk")
        elif anim == "carry":    # 競り落とした箱を肩に担いで、得意げ
            arm(1, -0.2, -2.3, 0, fx=-0.6, fy=-0.9)
            arm(-1, 0.1, 0.8, 0, fx=-0.2, fy=-1.9)
            self.show_box((0.42, 0.05, 1.12 + 0.03 * frame), (0, 0.35, 0.2))
            bob = 0.02 * frame
            self.set_face("smug")
        elif anim == "sad":      # がっくり
            self.headp.rotation_euler = Euler((0.3, 0, 0.08 * (frame * 2 - 1)))
            self.chest.rotation_euler = Euler((0.12, 0, 0))
            arm(1, 0.0, -0.05, 0, fx=-0.1)
            arm(-1, 0.0, 0.05, 0, fx=-0.1)
            bob = -0.02
            self.set_face("sad")
        elif anim == "shout":    # 声比べ：口に手をあてて叫ぶ
            arm(1, -1.5, 0.35, 0.3, fx=-1.5)
            arm(-1, -1.5, -0.35, -0.3, fx=-1.5)
            self.headp.rotation_euler = Euler((-0.15 - 0.06 * frame, 0, 0))
            self.chest.rotation_euler = Euler((-0.08, 0, 0))
            self.set_face("shout")
        elif anim == "call":     # 競り人の掛け声：手を振り上げる
            arm(1, -0.4, -2.2 + 0.5 * frame, 0, fx=-0.6, fy=-0.3)
            arm(-1, -1.3, 0.3, 0.3, fx=-1.5)
            self.headp.rotation_euler = Euler((-0.1, 0, 0.06 * (frame * 2 - 1)))
            self.set_face("talk" if frame == 0 else "shout")
        elif anim == "lift":     # 軽々と頭の上へ
            for s in (-1, 1):
                arm(s, 0, -2.75 * s, 0, fx=-0.25, fy=0.55 * s)
            self.show_box((0.0, 0.0, 1.76 + 0.04 * frame))
            bob = 0.03 * frame
            self.set_face("happy")
        elif anim == "heavy":    # うなりながら、やっと胸まで
            for s in (-1, 1):
                arm(s, -1.0, 0.15 * s, 0, fx=-0.7)
            self.show_box((0.0, -0.32, 0.72 + 0.02 * frame))
            bob = -0.06 + 0.015 * frame
            self.chest.rotation_euler = Euler((0.12, 0, 0.04 * (frame * 2 - 1)))
            self.set_face("strain")
        elif anim == "laugh":    # からかって笑う
            arm(1, -0.6, 0.3, 0.2, fx=-1.2)
            arm(-1, -0.2, 0.6, 0, fx=-0.4, fy=-1.4)
            self.headp.rotation_euler = Euler((-0.25, 0, 0.08 * (frame * 2 - 1)))
            self.set_face("happy")
        hips.location = (0, 0, hip_z + bob)
        bpy.context.view_layer.update()
