"""人物のレンダリング（全員 × 全部の動き、会話の顔）。"""
import math
import os

import bpy
from mathutils import Vector

import common
import people

FRAME = (64, 80)      # 1コマの大きさ（完成サイズ）
PORTRAIT = (48, 48)   # 会話の顔
CLOSEUP = (96, 96)    # 星3のときの大写し


def _scene(size):
    common.reset_scene()
    common.set_resolution(size[0] * 4, size[1] * 4)
    scene = bpy.context.scene
    scene.cycles.samples = 24
    common.add_lantern_light(direction_from=(-1.1, -1.4, 1.3), strength=3.6)
    # 後ろからの青い縁取りの光（夜の町の明かり）
    ld = bpy.data.lights.new("Rim", "SUN")
    ld.energy = 1.6
    ld.color = (0.55, 0.65, 1.0)
    rim = common.link(bpy.data.objects.new("Rim", ld))
    rim.rotation_euler = (math.radians(-60), 0, math.radians(-160))
    common.add_night_world(strength=0.7)


def render_person(key, out, anims=None, portrait=True):
    _scene(FRAME)
    p = people.Person(key)
    sc = people.CHARACTERS[key].get("scale", 1.0)
    cam = common.add_ortho_camera("Cam", (0, -10, 1.0 * sc + 1.2), look_at=(0, 0, 0.97 * sc), ortho_scale=2.0 * max(1.0, sc), up="Z")
    if anims is None:
        anims = people.MATEO_ANIMS if key.startswith("mateo") else people.PON_ANIMS if key == "pon" else people.ANIMS
    for anim, n in anims.items():
        for f in range(n):
            p.pose(anim, f)
            common.render_to(os.path.join(out, "p_%s_%s_%d.png" % (key, anim, f)))
    if portrait:
        # 会話の顔（ふつう・喜ぶ）と、星3の大写し
        common.set_resolution(PORTRAIT[0] * 4, PORTRAIT[1] * 4)
        cam.data.ortho_scale = 1.05 * sc
        p.pose("wait", 0)
        face_z, close_z = 1.36 * sc, 1.22 * sc
        if people.CHARACTERS[key].get("body") == "tanuki":
            # ポン吉は頭の高さが人とちがうので、頭の中心に合わせて枠に収める
            bpy.context.view_layer.update()
            head_c = (p.headp.matrix_world @ Vector((0, 0, 0.3))).z
            face_z, close_z = head_c, head_c - 0.12
        cam.location = (0, -10, face_z + 1.2)
        p.set_face("talk")
        common.render_to(os.path.join(out, "face_%s.png" % key))
        p.set_face("happy")
        common.render_to(os.path.join(out, "face_%s_happy.png" % key))
        common.set_resolution(CLOSEUP[0] * 4, CLOSEUP[1] * 4)
        cam.data.ortho_scale = 1.35 * sc
        cam.location = (0, -10, close_z + 1.2)
        p.pose("happy", 1)
        common.render_to(os.path.join(out, "close_%s.png" % key))


def job_people(out, keys=None):
    for key in (keys or list(people.CHARACTERS.keys())):
        print("== 人物", key, flush=True)
        render_person(key, out)
