"""ゲームで使う絵をまとめる：人物・食材・皮・屋台・地図・ミニゲーム・生き物・紙芝居・ロゴ。

たくさんの小さな絵を、種類ごとに1枚の画像（アトラス）に並べ、
どこに何があるかを art/output/game/art.js（window.OT_ART）に書き出す。
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

from . import pixelate
from .palette import PALETTE, rgb

FONTS = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")


def _px(src, size, outline=True, recolor=None):
    return pixelate.pixelate(src, size, with_outline=outline, recolor=recolor)


def _save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pixelate.save_png(img, path)


def _exists(R, name):
    return os.path.exists(os.path.join(R, name))


def people_atlases(R, out, man):
    """人物：1人1枚（全部の動きのコマを横に並べる）＋ 顔の表"""
    # Blender なしで人物の一覧を読む（people.py の CHARACTERS と ANIMS の名前だけ）
    src = open(os.path.join(os.path.dirname(__file__), "..", "blender", "people.py"), encoding="utf-8").read()
    import re
    block = src.split("CHARACTERS = {", 1)[1].split("\n}\n", 1)[0]
    keys = re.findall(r'^\s+"(\w+)":\s+dict\(', block, re.M)

    def anims(key):
        def parse(name):
            m = re.search(name + r' = \{([^}]*)\}', src)
            return [(a, int(n)) for a, n in re.findall(r'"(\w+)": (\d+)', m.group(1))]
        if key.startswith("mateo"):
            return parse("MATEO_ANIMS")
        if key == "pon":
            return parse("PON_ANIMS")
        return parse("ANIMS")

    man["people"] = {}
    faces = []
    for key in keys:
        frames, layout = [], {}
        for a, n in anims(key):
            got = 0
            for f in range(n):
                name = "p_%s_%s_%d.png" % (key, a, f)
                if _exists(R, name):
                    frames.append(_px(os.path.join(R, name), (64, 80)))
                    got += 1
            if got:
                layout[a] = [len(frames) - got, got]
        if frames:
            sheet = Image.new("RGBA", (64 * len(frames), 80), (0, 0, 0, 0))
            for i, fr in enumerate(frames):
                sheet.alpha_composite(fr, (i * 64, 0))
            _save(sheet, os.path.join(out, "people", key + ".png"))
            man["people"][key] = layout
        for suffix in ("", "_happy"):
            name = "face_%s%s.png" % (key, suffix)
            if _exists(R, name):
                faces.append((key + suffix, _px(os.path.join(R, name), (48, 48))))
        name = "close_%s.png" % key
        if _exists(R, name):
            _save(_px(os.path.join(R, name), (96, 96)), os.path.join(out, "close", key + ".png"))
    cols = 8
    sheet = Image.new("RGBA", (48 * cols, 48 * ((len(faces) + cols - 1) // cols)), (0, 0, 0, 0))
    man["faces"] = {}
    for i, (k, im) in enumerate(faces):
        sheet.alpha_composite(im, ((i % cols) * 48, (i // cols) * 48))
        man["faces"][k] = [(i % cols) * 48, (i // cols) * 48]
    _save(sheet, os.path.join(out, "faces.png"))
    # 抜け荷で使う小さな人（マテオと役人）
    for key, src_key in (("mini_mateo", "mateo_happi"), ("mini_guard", "messenger")):
        frames = [_px(os.path.join(R, "p_%s_walk_%d.png" % (src_key, f)), (24, 30)) for f in range(4) if _exists(R, "p_%s_walk_%d.png" % (src_key, f))]
        if frames:
            sheet = Image.new("RGBA", (24 * len(frames), 30), (0, 0, 0, 0))
            for i, fr in enumerate(frames):
                sheet.alpha_composite(fr, (i * 24, 0))
            _save(sheet, os.path.join(out, "people", key + ".png"))


RED_RAW = {"katsuo", "kujira"}   # 生のときに濃い赤になる具（赤身）


def food_atlases(R, out, man, food_keys):
    """食材：アイコン（32×32、輪郭あり）と、かけら（36×36、輪郭なし・3通り）"""
    cols = 16
    icons = [(k, os.path.join(R, "food_%s.png" % k)) for k in food_keys if _exists(R, "food_%s.png" % k)]
    sheet = Image.new("RGBA", (32 * cols, 32 * ((len(icons) + cols - 1) // cols)), (0, 0, 0, 0))
    man["icons"] = {}
    for i, (k, p) in enumerate(icons):
        sheet.alpha_composite(_px(p, (32, 32)), ((i % cols) * 32, (i // cols) * 32))
        man["icons"][k] = [(i % cols) * 32, (i // cols) * 32]
    _save(sheet, os.path.join(out, "food_icons.png"))
    pieces = [k for k in food_keys if _exists(R, "piece_%s_0.png" % k)]
    # かけらの数（foods.py の n=）
    import re
    fsrc = open(os.path.join(os.path.dirname(__file__), "..", "blender", "foods.py"), encoding="utf-8").read()
    counts = {k: int(n) for k, n in re.findall(r'^    "(\w+)":\s+dict\(.*?\bn=(\d+)', fsrc, re.M)}
    # 焼き場で焼く具（config.js の cook:）は、生焼けと焦げの絵も作る（同じ並びの別の画像）
    csrc = open(os.path.join(os.path.dirname(__file__), "..", "..", "js", "game", "config.js"), encoding="utf-8").read()
    cooked = set(re.findall(r"^\s+(\w+):\s*\{ cat: '\w+', cook: '", csrc, re.M))
    man["cooked"] = sorted(k for k in cooked if k in pieces)
    for look, fname in ((None, "food_pieces.png"), ("raw", "food_pieces_raw.png"), ("burnt", "food_pieces_burnt.png")):
        sheet = Image.new("RGBA", (36 * 3 * 8, 36 * ((len(pieces) + 7) // 8)), (0, 0, 0, 0))
        man["pieces"] = {}
        for i, k in enumerate(pieces):
            x0, y0 = (i % 8) * 108, (i // 8) * 36
            if look is None or k in cooked:
                for v in range(3):
                    if _exists(R, "piece_%s_%d.png" % (k, v)):
                        how = "raw_red" if look == "raw" and k in RED_RAW else look
                        sheet.alpha_composite(_px(os.path.join(R, "piece_%s_%d.png" % (k, v)), (36, 36), False, how), (x0 + v * 36, y0))
            man["pieces"][k] = [x0, y0, counts.get(k, 5)]
        _save(sheet, os.path.join(out, fname))


def skin_atlases(R, out, man):
    man["skins"] = []
    kinds = sorted({n.split("_fold_")[0][5:] for n in os.listdir(R) if n.startswith("skin_") and "_fold_" in n})
    for kind in kinds:
        frames = [os.path.join(R, "skin_%s_fold_%02d.png" % (kind, f)) for f in range(8)]
        if not all(os.path.exists(f) for f in frames):
            continue
        sheet = Image.new("RGBA", (128 * 8, 128), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            sheet.alpha_composite(_px(f, (128, 128)), (i * 128, 0))
        _save(sheet, os.path.join(out, "skins", kind + ".png"))
        man["skins"].append(kind)


def scene_images(R, out, man):
    man["stall"] = []
    fg = os.path.join(R, "stall_fg.png")
    if os.path.exists(fg):
        _save(_px(fg, (256, 144), False), os.path.join(out, "stall", "fg.png"))
    for n in sorted(os.listdir(R)):
        if n.startswith("stall_bg"):
            key = n[len("stall_bg"):-4].lstrip("_") or "normal"
            _save(_px(os.path.join(R, n), (256, 144), False), os.path.join(out, "stall", key + ".png"))
            man["stall"].append(key)
    if _exists(R, "map.png"):
        _save(_px(os.path.join(R, "map.png"), (256, 160), False), os.path.join(out, "map.png"))
        man["places"] = json.load(open(os.path.join(R, "map_places.json"), encoding="utf-8"))
    man["bg"] = []
    for k in ("auction", "fishing", "forage", "hunt", "smuggle"):
        if _exists(R, "bg_%s.png" % k):
            _save(_px(os.path.join(R, "bg_%s.png" % k), (192, 128), False), os.path.join(out, "bg", k + ".png"))
            man["bg"].append(k)
    # 生き物
    man["creatures"] = {}
    specs = {"fish_tai": (96, 64), "fish_kisu": (96, 64), "fish_katsuo": (96, 64), "fish_tako": (96, 64), "fish_uni": (96, 64), "fish_kujira": (96, 64),
             "forage_inago": (24, 24), "forage_hachi": (24, 24), "forage_sansho": (24, 24), "forage_makomo": (24, 24)}
    for f in range(2):
        for k, sz in {"sea_aji": (24, 12), "sea_iwashi": (20, 10), "sea_maguro": (44, 18), "sea_unagi": (44, 12), "sea_nushi": (72, 28),
                      "animal_boar": (24, 18), "animal_deer": (24, 18), "animal_nushi": (40, 30)}.items():
            specs["%s_%d" % (k, f)] = sz
    for k, sz in specs.items():
        if _exists(R, k + ".png"):
            _save(_px(os.path.join(R, k + ".png"), sz), os.path.join(out, "creatures", k + ".png"))
            man["creatures"][k] = list(sz)
    # 夜の厨房（焼き場・炎・木札・紐・捨て桶・鉢・徳利）
    kitchen = {"k_shichirin": ((256, 160), False), "k_fryer": ((256, 160), False), "k_wara": ((256, 160), False), "k_flame0": ((48, 48), False), "k_flame1": ((48, 48), False), "k_flame2": ((48, 48), False),
               "k_ticket": ((56, 72), True), "k_rope": ((128, 12), False), "k_trash": ((40, 40), True), "k_bowl": ((32, 32), True), "k_jug": ((32, 32), True)}
    man["kitchen"] = {"images": []}
    for k, (sz, ol) in kitchen.items():
        if _exists(R, k + ".png"):
            _save(_px(os.path.join(R, k + ".png"), sz, ol), os.path.join(out, "kitchen", k + ".png"))
            man["kitchen"]["images"].append(k)
    if _exists(R, "kitchen_slots.json"):
        man["kitchen"]["slots"] = json.load(open(os.path.join(R, "kitchen_slots.json"), encoding="utf-8"))
    # 紙芝居
    man["story"] = 0
    for i in range(1, 10):
        if _exists(R, "story_%d.png" % i):
            _save(_px(os.path.join(R, "story_%d.png" % i), (240, 160), False), os.path.join(out, "story", "%d.png" % i))
            man["story"] = i


def logo(out, man):
    """タイトルロゴ：「Oh!Edo Taco Tuesday!!」（Mochiy Pop One）と「多幸寿」（Yuji Syuku）をドット絵に"""
    W, H = 240, 132
    big = Image.new("RGBA", (W * 4, H * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    f_en = ImageFont.truetype(os.path.join(FONTS, "MochiyPopOne-Regular.ttf"), 92)
    f_ja = ImageFont.truetype(os.path.join(FONTS, "YujiSyuku-Regular.ttf"), 210)
    yellow, red, white, indigo = rgb("#ffe6b0"), rgb("#c42618"), rgb("#fffaf0"), rgb("#172b58")
    for text, y in (("Oh!Edo Taco", 20), ("Tuesday!!", 118)):
        for dy in range(10, 0, -2):   # 立体の影
            d.text((W * 2, y + dy), text, font=f_en, fill=red + (255,), anchor="mt")
        d.text((W * 2, y), text, font=f_en, fill=yellow + (255,), anchor="mt")
    for dy in range(10, 0, -2):
        d.text((W * 2, 260 + dy), "多幸寿", font=f_ja, fill=indigo + (255,), anchor="mt")
    d.text((W * 2, 260), "多幸寿", font=f_ja, fill=white + (255,), anchor="mt")
    tmp = os.path.join(out, "_logo_big.png")
    big.save(tmp)
    img = pixelate.pixelate(tmp, (W, H))
    os.remove(tmp)
    _save(img, os.path.join(out, "logo.png"))
    man["logo"] = [W, H]


def ogp_and_icons(out, root_out):
    """X に貼ったときの絵（1200×630）と、ホーム画面のアイコン"""
    try:
        bg = Image.open(os.path.join(out, "stall", "normal.png")).convert("RGBA")
        fg = Image.open(os.path.join(out, "stall", "fg.png")).convert("RGBA")
    except FileNotFoundError:
        return
    scene = bg.copy()
    scene.alpha_composite(fg)
    lg = Image.open(os.path.join(out, "logo.png")).convert("RGBA")
    taco = Image.open(os.path.join(root_out, "taco", "taco_oblique.png")).convert("RGBA")
    canvas = Image.new("RGBA", (300, 158), rgb("#0d1830") + (255,))
    canvas.alpha_composite(scene.resize((281, 158), Image.NEAREST), (19, 0))
    people_dir = os.path.join(out, "people")
    for key, x in (("mateo_happi", 4), ("pon", 228)):
        p = os.path.join(people_dir, key + ".png")
        if os.path.exists(p):
            sh = Image.open(p).convert("RGBA")
            canvas.alpha_composite(sh.crop((64 * (sh.width // 64 - 1) if key == "pon" else 0, 0, 64 * (sh.width // 64 - 1) + 64 if key == "pon" else 64, 80)), (x, 76))
    canvas.alpha_composite(lg.resize((160, 88), Image.NEAREST), (70, 2))
    canvas.alpha_composite(taco.resize((76, 76), Image.NEAREST), (112, 84))
    canvas.resize((1200, 632), Image.NEAREST).crop((0, 0, 1200, 630)).convert("RGB").save(os.path.join(out, "ogp.png"))
    icon = Image.new("RGBA", (64, 64), rgb("#172b58") + (255,))
    icon.alpha_composite(taco.resize((64, 64), Image.NEAREST), (0, 2))
    for size, name in ((512, "icon-512.png"), (180, "icon-180.png"), (64, "favicon.png")):
        icon.resize((size, size), Image.NEAREST).save(os.path.join(out, name))


def make_all(R, out, root_out, food_keys):
    man = {}
    people_atlases(R, out, man)
    food_atlases(R, out, man, food_keys)
    skin_atlases(R, out, man)
    scene_images(R, out, man)
    logo(out, man)
    ogp_and_icons(out, root_out)
    with open(os.path.join(out, "art.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write("// art/build.py が自動で書き出すファイル（手で書きかえない）\n")
        f.write("window.OT_ART = " + json.dumps(man, ensure_ascii=False) + ";\n")
    return man
