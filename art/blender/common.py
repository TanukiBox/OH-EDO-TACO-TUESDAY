"""Blender 内で使う共通の道具（シーン初期化・マテリアル・メッシュ・カメラ・照明）。

このファイルは Blender の中で動きます（build.py から自動で呼ばれます）。
"""
import math
import zlib
import random

import bpy
import bmesh
from mathutils import Vector, Matrix


# ---------------------------------------------------------------------------
# 乱数：毎回同じ結果になるよう、名前から固定のシードを作る
# （Python の hash() は起動ごとに値が変わるので使わない）
# ---------------------------------------------------------------------------
def rng_for(name):
    return random.Random(zlib.crc32(name.encode("utf-8")))


# ---------------------------------------------------------------------------
# なめらかなノイズ（自前）。Blender の mathutils.noise は起動ごとに
# 値が変わってしまうため、毎回同じ値を返すものを自分で用意している。
# ---------------------------------------------------------------------------
def _hash01(ix, iy, iz, k):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (k * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xFFFFFF) / 0xFFFFFF


def value_noise(x, y, z, k=0):
    """-1〜1 のなめらかなノイズ。同じ入力なら必ず同じ値。"""
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    sx, sy, sz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)

    def lerp(a, b, t):
        return a + (b - a) * t

    c = [[[_hash01(ix + i, iy + j, iz + l, k) for l in (0, 1)] for j in (0, 1)] for i in (0, 1)]
    v = lerp(lerp(lerp(c[0][0][0], c[0][0][1], sz), lerp(c[0][1][0], c[0][1][1], sz), sy),
             lerp(lerp(c[1][0][0], c[1][0][1], sz), lerp(c[1][1][0], c[1][1][1], sz), sy), sx)
    return v * 2 - 1


# ---------------------------------------------------------------------------
# シーン
# ---------------------------------------------------------------------------
def reset_scene():
    """シーンを空にして、レンダリング設定を毎回同じ値にそろえる。"""
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials,
                 bpy.data.lights, bpy.data.cameras, bpy.data.images,
                 bpy.data.worlds, bpy.data.curves):
        for item in list(coll):
            coll.remove(item)

    scene = bpy.context.scene
    r = scene.render
    r.engine = "CYCLES"
    r.film_transparent = True
    r.resolution_percentage = 100
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    r.image_settings.color_depth = "8"
    r.use_file_extension = True
    r.use_freestyle = False   # 線は toon_lines() を呼んだときだけ（前の job の設定を持ちこさない）
    if AUTO_LINES is not None:
        toon_lines(**AUTO_LINES)

    c = scene.cycles
    c.device = "CPU"
    c.samples = 64
    c.use_adaptive_sampling = False
    c.seed = 0
    c.use_animated_seed = False
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    if hasattr(c, "denoising_use_gpu"):
        c.denoising_use_gpu = False
    c.pixel_filter_type = "BLACKMAN_HARRIS"
    c.filter_width = 1.0
    # 光の照り返しを切ると、影がパキッとしてドット絵向きの陰影になる
    c.max_bounces = 2
    c.diffuse_bounces = 0
    c.glossy_bounces = 1

    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.frame_set(1)
    return scene


def set_resolution(w, h):
    r = bpy.context.scene.render
    r.resolution_x = w
    r.resolution_y = h


def render_to(path):
    scene = bpy.context.scene
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("  rendered:", path, flush=True)


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------------------
# 照明：左上から暖色（提灯の明かり）＋ 夜の青っぽい環境光
# ---------------------------------------------------------------------------
LANTERN_COLOR = (1.0, 0.74, 0.46)


def add_lantern_light(direction_from=(-1.0, 1.0, 1.35), strength=3.6,
                      color=LANTERN_COLOR, angle_deg=6.0):
    """direction_from: 光がやってくる方向（原点から見た光源の方向）。"""
    ld = bpy.data.lights.new("Lantern", "SUN")
    ld.energy = strength
    ld.color = color
    ld.angle = math.radians(angle_deg)
    ob = link(bpy.data.objects.new("Lantern", ld))
    d = Vector(direction_from).normalized()
    ob.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    return ob


def add_night_world(color=(0.42, 0.46, 0.62), strength=0.8):
    w = bpy.data.worlds.new("Night")
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = None
    for n in w.node_tree.nodes:
        if n.type == "BACKGROUND":
            bg = n
    if bg is None:
        bg = w.node_tree.nodes.new("ShaderNodeBackground")
        out = w.node_tree.nodes.new("ShaderNodeOutputWorld")
        w.node_tree.links.new(bg.outputs[0], out.inputs[0])
    bg.inputs["Color"].default_value = (*color, 1.0)
    bg.inputs["Strength"].default_value = strength
    bpy.context.scene.world = w


# ---------------------------------------------------------------------------
# カメラ
# ---------------------------------------------------------------------------
def add_ortho_camera(name, location, look_at=(0, 0, 0), ortho_scale=3.0, up="Y"):
    cd = bpy.data.cameras.new(name)
    cd.type = "ORTHO"
    cd.ortho_scale = ortho_scale
    cd.clip_start = 0.01
    cd.clip_end = 100.0
    ob = link(bpy.data.objects.new(name, cd))
    ob.location = location
    d = Vector(look_at) - Vector(location)
    ob.rotation_euler = d.to_track_quat("-Z", up).to_euler()
    bpy.context.scene.camera = ob
    return ob


def top_camera(ortho_scale):
    """3.1 真上カメラ（画面の上 = +Y）。"""
    return add_ortho_camera("CamTop", (0, 0, 10), ortho_scale=ortho_scale, up="Y")


def oblique_camera(ortho_scale, elevation_deg=45.0):
    """3.2 斜め上カメラ（手前 -Y 側から約45度で見下ろす）。"""
    e = math.radians(elevation_deg)
    loc = (0, -10 * math.cos(e), 10 * math.sin(e))
    return add_ortho_camera("CamOblique", loc, ortho_scale=ortho_scale, up="Z")


def fit_camera(cam, objects, margin=1.1):
    """objects が画面にちょうど収まるよう、正投影カメラの位置と大きさを合わせる。"""
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in objects:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ob.matrix_world
        for v in me.vertices:
            p = inv @ (mw @ v.co)
            xs.append(p.x)
            ys.append(p.y)
        ev.to_mesh_clear()
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    r = bpy.context.scene.render
    aspect = r.resolution_x / r.resolution_y
    cam.data.ortho_scale = max(w, h * aspect) * margin
    rot = cam.matrix_world.to_3x3()
    cam.location = cam.location + rot @ Vector((cx, cy, 0))


# ---------------------------------------------------------------------------
# マテリアル（ノードを組む小さな道具）
# ---------------------------------------------------------------------------
def hex_rgb(h):
    """'#RRGGBB' → Blender のリニア色 (r, g, b)。"""
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def new_material(name, color="#ffffff", roughness=0.6):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bsdf = None
    for n in nt.nodes:
        if n.type == "BSDF_PRINCIPLED":
            bsdf = n
    if bsdf is None:
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*hex_rgb(color), 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return m, nt, bsdf


def node(nt, kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def color_ramp(nt, stops, interpolation="LINEAR"):
    """stops: [(位置0〜1, '#RRGGBB'), ...]"""
    cr = nt.nodes.new("ShaderNodeValToRGB")
    ramp = cr.color_ramp
    ramp.interpolation = interpolation
    els = ramp.elements
    while len(els) < len(stops):
        els.new(0.5)
    for el, (pos, col) in zip(els, stops):
        el.position = pos
        el.color = (*hex_rgb(col), 1.0)
    return cr


def noise_tex(nt, vector_socket, scale, detail=3.0, roughness=0.55, w=None):
    n = nt.nodes.new("ShaderNodeTexNoise")
    if w is not None:
        n.noise_dimensions = "4D"
        n.inputs["W"].default_value = w
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = roughness
    if vector_socket is not None:
        nt.links.new(vector_socket, n.inputs["Vector"])
    return n


def math_node(nt, op, a, b=None, clamp=False):
    """a, b はソケットか数値。"""
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def mapped(nt, socket, from_min, from_max):
    """値を from_min〜from_max → 0〜1 に引き伸ばす（範囲外は切り捨て）。"""
    n = nt.nodes.new("ShaderNodeMapRange")
    n.clamp = True
    nt.links.new(socket, n.inputs["Value"])
    n.inputs["From Min"].default_value = from_min
    n.inputs["From Max"].default_value = from_max
    return n.outputs["Result"]


def cached_material(name, factory):
    """同じ名前のマテリアルがあれば使い回す。"""
    return bpy.data.materials.get(name) or factory(name)


def ramp_material(name, stops, fac_socket_fn, roughness=0.6, interpolation="LINEAR"):
    """fac_socket_fn(nt) が返す 0〜1 の値でカラーランプの色を決めるマテリアル。"""
    m, nt, bsdf = new_material(name, roughness=roughness)
    fac = fac_socket_fn(nt)
    cr = color_ramp(nt, stops, interpolation)
    nt.links.new(fac, cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], bsdf.inputs["Base Color"])
    return m


AUTO_LINES = None   # dict にすると、reset_scene のたびに toon_lines(**AUTO_LINES) を呼ぶ


def toon_lines(thickness=4.2, outer=False):
    """セル調の線（Freestyle）。人物と同じく、部品が重なる所に「その部品の色を暗くした線」を引く。
    outer=True なら外側の輪郭も描く（背景など、pipeline で輪郭を足さない絵）。
    「noline」コレクションに入れたものには線を引かない。"""
    scene = bpy.context.scene
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
    ls.exclude_external_contour = not outer
    ls.edge_type_combination = "OR" if outer else "AND"
    nl = bpy.data.collections.get("noline") or bpy.data.collections.new("noline")
    if nl.name not in scene.collection.children:
        scene.collection.children.link(nl)
    ls.select_by_collection = True
    ls.collection = nl
    ls.collection_negation = "EXCLUSIVE"
    st = ls.linestyle
    st.thickness = thickness
    st.color = (0.02, 0.01, 0.01)
    if not any(m.type == "MATERIAL" for m in st.color_modifiers):
        mod = st.color_modifiers.new("mat", "MATERIAL")
        mod.material_attribute = "LINE"


def noline(ob):
    """この物には線を引かない（地面・空・水面など、輪郭がいらないもの）"""
    nl = bpy.data.collections.get("noline") or bpy.data.collections.new("noline")
    if nl.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(nl)
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    nl.objects.link(ob)
    return ob


TOON_LIGHT = (-0.45, -0.7, 0.55)   # セル調の光の来る向き（人物と同じ：左上・手前から）


def _lum(h):
    r, g, b = [int(h.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    return 0.3 * r + 0.59 * g + 0.11 * b


def toon3(name, light, mid, dark, noise=0.0, scale=10.0, line=None):
    """セル調：光の向きで「明るい色・地の色・影の色」の3段に塗り分ける（光源に関係なく、パレットの色そのまま）。
    noise を 0 より大きくすると、塗り分けの境目がまだらになる（食材や地面の質感）。line は内側の線の色。"""
    m = bpy.data.materials.get(name)
    if m:
        return m
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
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    L = Vector(TOON_LIGHT).normalized()
    dot.inputs[1].default_value = tuple(L)
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    ma = nt.nodes.new("ShaderNodeMath")
    ma.operation = "MULTIPLY_ADD"
    ma.inputs[1].default_value = 0.5
    ma.inputs[2].default_value = 0.5
    nt.links.new(dot.outputs["Value"], ma.inputs[0])
    fac = ma.outputs[0]
    if noise > 0:
        attr = nt.nodes.new("ShaderNodeAttribute")
        attr.attribute_name = "rest"
        nz = noise_tex(nt, attr.outputs["Vector"], scale, 2.0)
        off = math_node(nt, "SUBTRACT", nz.outputs["Fac"], 0.5)
        off = math_node(nt, "MULTIPLY", off, noise)
        fac = math_node(nt, "ADD", fac, off)
    cr = color_ramp(nt, [(0.0, dark), (0.42, mid), (0.88, light)], "CONSTANT")
    nt.links.new(fac, cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], em.inputs["Color"])
    try:
        m.line_color = (*hex_rgb(line or dark), 1.0)
    except Exception:
        pass
    return m


def toon_stops(name, stops, noise=0.25, scale=8.0):
    """いままでの色ムラのマテリアルの色（stops）から、セル調の3色をえらぶ（明るい順に 明るい・地・影）"""
    cols = sorted({c for _, c in stops}, key=_lum, reverse=True)
    if len(cols) == 1:
        cols = cols * 3
    elif len(cols) == 2:
        cols = [cols[0], cols[0], cols[1]]
    light, mid, dark = cols[0], cols[len(cols) // 2], cols[-1]
    return toon3(name, light, mid, dark, noise=noise, scale=scale)


def object_noise_material(name, stops, scale=8.0, roughness=0.6, detail=2.0):
    """物体座標のノイズで色ムラをつけるだけの手軽なマテリアル。"""
    def fac(nt):
        attr = nt.nodes.new("ShaderNodeAttribute")
        attr.attribute_name = "rest"
        return noise_tex(nt, attr.outputs["Vector"], scale, detail).outputs["Fac"]
    return ramp_material(name, stops, fac, roughness)


# ---------------------------------------------------------------------------
# メッシュ
# ---------------------------------------------------------------------------
def mesh_object(name, bm, material=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
    # 作った時点の位置を覚えておく。折りたたみで形が変わっても模様がずれないように
    # マテリアルはこの "rest" 座標で色ムラを決める。
    rest = me.attributes.new("rest", "FLOAT_VECTOR", "POINT")
    co = [c for v in me.vertices for c in v.co]
    rest.data.foreach_set("vector", co)
    me.update()
    if material is not None:
        me.materials.append(material)
    return link(bpy.data.objects.new(name, me))


def bm_icosphere(radius=1.0, subdiv=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    return bm


def bm_torus(major, minor, seg_major=14, seg_minor=6):
    bm = bmesh.new()
    rings = []
    for i in range(seg_major):
        a = 2 * math.pi * i / seg_major
        ring = []
        for j in range(seg_minor):
            b = 2 * math.pi * j / seg_minor
            r = major + minor * math.cos(b)
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(b))))
        rings.append(ring)
    for i in range(seg_major):
        r0, r1 = rings[i], rings[(i + 1) % seg_major]
        for j in range(seg_minor):
            k = (j + 1) % seg_minor
            bm.faces.new((r0[j], r1[j], r1[k], r0[k]))
    return bm


def bm_lathe(profile, segments=64):
    """profile: [(半径, 高さ), ...] を Z 軸まわりに回転させた回転体。"""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segments),
                                        r * math.sin(2 * math.pi * i / segments), z))
                          for i in range(segments)])
    for a, b in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_tube(points, radii, segments=12, cap=True):
    """points（中心線）に沿って radii の太さの管を作る。"""
    bm = bmesh.new()
    rings = []
    n = len(points)
    for i, (p, r) in enumerate(zip(points, radii)):
        p = Vector(p)
        t = (Vector(points[min(i + 1, n - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        side = t.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = t.cross(Vector((0, 1, 0)))
        side.normalize()
        up = side.cross(t).normalized()
        ring = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            ring.append(bm.verts.new(p + (side * math.cos(a) + up * math.sin(a)) * r))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for j in range(segments):
            k = (j + 1) % segments
            bm.faces.new((a[j], a[k], b[k], b[j]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def jitter(bm, amount, freq, seed_offset=0.0):
    """頂点をノイズで少しずらして、手作りっぽいデコボコにする（毎回同じ結果）。"""
    off = Vector((seed_offset, seed_offset * 1.7, seed_offset * 0.3))
    for v in bm.verts:
        p = v.co * freq + off
        d = Vector([value_noise(p.x, p.y, p.z, k) for k in (1, 2, 3)])
        v.co += d * amount


def transform_bm(bm, scale=(1, 1, 1), rot_z=0.0, rot_x=0.0, rot_y=0.0, loc=(0, 0, 0)):
    m = (Matrix.Translation(loc) @ Matrix.Rotation(rot_z, 4, "Z")
         @ Matrix.Rotation(rot_y, 4, "Y") @ Matrix.Rotation(rot_x, 4, "X")
         @ Matrix.Diagonal((*scale, 1)))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)


def bm_bounds(bm):
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def drop_to_zero(bm):
    """一番下の点が z=0 になるように持ち上げる。"""
    (_, _), (_, _), (zmin, _) = bm_bounds(bm)
    bmesh.ops.translate(bm, vec=(0, 0, -zmin), verts=bm.verts)


# ---------------------------------------------------------------------------
# 具材を積み上げるための「高さマップ」
# 先に置いた具材の上に、次の具材が乗るようにする。
# ---------------------------------------------------------------------------
class Pile:
    def __init__(self, base_z, extent=1.3, n=130):
        self.base_z = base_z
        self.extent = extent
        self.n = n
        self.h = [[base_z] * n for _ in range(n)]

    def _cells(self, x, y, r):
        n, e = self.n, self.extent
        cell = 2 * e / n
        i0 = max(0, int((x - r + e) / cell))
        i1 = min(n - 1, int((x + r + e) / cell))
        j0 = max(0, int((y - r + e) / cell))
        j1 = min(n - 1, int((y + r + e) / cell))
        for i in range(i0, i1 + 1):
            for j in range(j0, j1 + 1):
                cx = -e + (i + 0.5) * cell
                cy = -e + (j + 0.5) * cell
                if (cx - x) ** 2 + (cy - y) ** 2 <= r * r:
                    yield i, j

    def height_at(self, x, y, r):
        hs = [self.h[i][j] for i, j in self._cells(x, y, r)]
        return max(hs) if hs else self.base_z

    def raise_to(self, x, y, r, top):
        for i, j in self._cells(x, y, r):
            self.h[i][j] = max(self.h[i][j], top)

    def place(self, bm, x, y, rot_z=0.0, sink=0.35):
        """bm（底が z=0 の具材）を (x, y) に置き、下の具材の上に乗せる。"""
        (x0, x1), (y0, y1), (_, z1) = bm_bounds(bm)
        r = max(x1 - x0, y1 - y0) / 2
        z = self.height_at(x, y, r * 0.6)
        z -= z1 * sink  # 少しめり込ませて、なじませる
        transform_bm(bm, rot_z=rot_z, loc=(x, y, z))
        self.raise_to(x, y, r * 0.8, z + z1 * 0.85)
        return bm
