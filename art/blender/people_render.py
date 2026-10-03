"""人物のレンダリング（全員 × 全部の動き、会話の顔、星5の大写し）。

塗りはセル調（people.py の mat）なので、光源はいらない。
内側の線は Freestyle：部品が重なる所（腕と胴など）にだけ、その部品の色を暗くした線を引く。
外側の輪郭は、ドット絵にする段階（pipeline）で引く。
"""
import math
import os

import bpy
from mathutils import Vector

import common
import people

FRAME = (96, 120)     # 1コマの大きさ（完成サイズ）
PORTRAIT = (64, 64)   # 会話の顔
CLOSEUP = (128, 128)  # 星5のときの大写し
LINE_PX = 4.2         # 内側の線の太さ（4倍で描いて縮めるので、完成で約1ドット）


def _scene(size):
    common.reset_scene()
    common.set_resolution(size[0] * 4, size[1] * 4)
    scene = bpy.context.scene
    scene.cycles.samples = 8
    scene.cycles.use_denoising = False
    common.add_night_world(strength=0.0)
    # 内側の線（Freestyle）
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = "ABSOLUTE"
    vl = bpy.context.view_layer
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("lines")
    ls.select_by_visibility = True
    ls.select_by_edge_types = True
    ls.select_silhouette = True
    ls.select_border = False
    ls.select_crease = False
    ls.select_external_contour = True
    ls.exclude_external_contour = True     # 外側の輪郭は描かない（pipeline で描く）
    ls.edge_type_combination = "AND"
    # 顔の部品など（people.NOLINE のコレクション）には線を引かない
    ls.select_by_collection = True
    ls.collection = people._noline_coll()
    ls.collection_negation = "EXCLUSIVE"
    st = ls.linestyle
    st.thickness = LINE_PX
    st.color = (0.02, 0.01, 0.01)
    if not any(m.type == "MATERIAL" for m in st.color_modifiers):
        mod = st.color_modifiers.new("mat", "MATERIAL")
        mod.material_attribute = "LINE"


def _head_center(p):
    bpy.context.view_layer.update()
    return (p.headp.matrix_world @ Vector((0, 0, 0.3))).z


def render_person(key, out, anims=None, portrait=True):
    _scene(FRAME)
    p = people.Person(key)
    sc = people.CHARACTERS[key].get("scale", 1.0)
    cam = common.add_ortho_camera("Cam", (0, -10, 1.0 * sc + 1.2), look_at=(0, 0, 0.97 * sc), ortho_scale=2.0 * max(1.0, sc), up="Z")
    if anims is None:
        anims = people.anims_for(key)
    for anim, n in anims.items():
        for f in range(n):
            p.pose(anim, f)
            common.render_to(os.path.join(out, "p_%s_%s_%d.png" % (key, anim, f)))
    if portrait:
        # 会話の顔（ふつう・喜ぶ）と、星5の大写し。頭の中心に合わせて枠に収める
        common.set_resolution(PORTRAIT[0] * 4, PORTRAIT[1] * 4)
        cam.data.ortho_scale = 1.1 * sc
        p.pose("wait", 0)
        hc = _head_center(p)
        cam.location = (0, -10, hc + 1.2 + 0.03 * sc)
        p.set_face("talk")
        common.render_to(os.path.join(out, "face_%s.png" % key))
        p.set_face("happy")
        common.render_to(os.path.join(out, "face_%s_happy.png" % key))
        if key in people.RIVALS or key in ("seri", "hamazo", "mateo", "mateo_happi", "pon", "yami"):
            p.set_face("sad" if key != "pon" else "ok")
            common.render_to(os.path.join(out, "face_%s_sad.png" % key))
        common.set_resolution(CLOSEUP[0] * 4, CLOSEUP[1] * 4)
        cam.data.ortho_scale = 1.45 * sc
        p.pose("happy", 1)
        hc = _head_center(p)
        cam.location = (0, -10, hc - 0.14 * sc + 1.2 + 0.03 * sc)
        common.render_to(os.path.join(out, "close_%s.png" % key))


def job_people(out, keys=None):
    for key in (keys or list(people.CHARACTERS.keys())):
        print("== 人物", key, flush=True)
        render_person(key, out)
