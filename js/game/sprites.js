/*
 * 多幸寿：Blender で作ったドット絵を使う（art/output/game/ と art/build.py が書き出す一覧 OT_ART）
 *   ・人物（動きのコマ）・会話の顔・星3の大写し
 *   ・食材のアイコンとかけら・皮の折りたたみ
 *   ・屋台の夜景（年中行事の飾りつき）と手前のカウンター・町の地図・ミニゲームの背景・生き物・紙芝居・ロゴ
 *   絵がまだないものは、art.js の仮の図形のまま。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var A = global.OT_ART || {};
  var BASE = 'art/output/game/';
  var img = {};
  var ready = false;

  function file(key, path) { img[key] = path; }

  // 読み込む絵の一覧
  Object.keys(A.people || {}).forEach(function (k) { file('people_' + k, 'people/' + k + '.png'); });
  ['mini_mateo', 'mini_guard'].forEach(function (k) { file('people_' + k, 'people/' + k + '.png'); });
  file('faces', 'faces.png');
  file('icons', 'food_icons.png');
  file('pieces', 'food_pieces.png');
  if (A.cooked) { file('pieces_raw', 'food_pieces_raw.png'); file('pieces_burnt', 'food_pieces_burnt.png'); }
  ((A.kitchen || {}).images || []).forEach(function (k) { file(k, 'kitchen/' + k + '.png'); });
  (A.skins || []).forEach(function (k) { file('skin_' + k, 'skins/' + k + '.png'); });
  (A.stall || []).forEach(function (k) { file('stall_' + k, 'stall/' + k + '.png'); });
  file('stall_fg', 'stall/fg.png');
  file('map', 'map.png');
  (A.bg || []).forEach(function (k) { file('bg_' + k, 'bg/' + k + '.png'); });
  Object.keys(A.creatures || {}).forEach(function (k) { file('cr_' + k, 'creatures/' + k + '.png'); });
  for (var i = 1; i <= (A.story || 0); i++) file('story_' + i, 'story/' + i + '.png');
  file('logo', 'logo.png');

  var loaded = {};
  OT.sprites = {
    has: function (k) { var im = loaded[k]; return !!(im && im.complete && im.naturalWidth); },
    get: function (k) { return loaded[k]; },
    load: function (done) {
      var keys = Object.keys(img), left = keys.length;
      if (!left) { done(); return; }
      keys.forEach(function (k) {
        var im = new Image();
        im.onload = im.onerror = function () { if (--left === 0) { ready = true; done(); } };
        im.src = BASE + img[k] + '?v=' + OT.VERSION;
        loaded[k] = im;
      });
    },
    /** 星3の大写し（読み込みは使うときに） */
    closeup: function (key) {
      var k = 'close_' + key;
      if (!loaded[k]) { var im = new Image(); im.src = BASE + 'close/' + key + '.png?v=' + OT.VERSION; loaded[k] = im; }
      return loaded[k];
    },
    manifest: A
  };
  var S = OT.sprites;

  // ---------------------------------------------------------------
  // 人物
  // ---------------------------------------------------------------
  /** 客（または人物キー）→ 人物の絵のキー */
  OT.sprites.personKey = function (g) {
    if (!g) return null;
    if (typeof g === 'string') return A.people && A.people[g] ? g : null;
    var cand = g.vipGuest || g.regular || (g.traveler ? 'tabibito' : null);
    if (cand && A.people[cand]) return cand;
    var v = (g.variantSeed || 0) % 2 ? '_b' : '_a';
    return A.people[g.typeId + v] ? g.typeId + v : null;
  };

  /** 人物の1コマを描く。(x, y) は足もとの中心。anim の中の frame は時間 t で選ぶ */
  OT.sprites.drawPerson = function (ctx, key, anim, t, x, y, flip, fps) {
    var lay = A.people && A.people[key];
    var sheet = loaded['people_' + key];
    if (!lay || !sheet || !sheet.complete || !sheet.naturalWidth) return false;
    var a = lay[anim] || lay.wait || lay[Object.keys(lay)[0]];
    var n = a[1], f = a[0] + (Math.floor(t * (fps || 4)) % n);
    ctx.save();
    if (flip) { ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(sheet, f * 64, 0, 64, 80, -32, Math.round(y) - 80, 64, 80); }
    else ctx.drawImage(sheet, f * 64, 0, 64, 80, Math.round(x) - 32, Math.round(y) - 80, 64, 80);
    ctx.restore();
    return true;
  };

  /** 会話の顔を canvas（48×48）に描く。なければ false */
  OT.sprites.drawFace = function (canvas, key, happy) {
    var F = A.faces || {};
    var pos = F[key + (happy ? '_happy' : '')] || F[key];
    if (!pos || !S.has('faces')) return false;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 48, 48);
    ctx.drawImage(loaded.faces, pos[0], pos[1], 48, 48, 0, 0, 48, 48);
    return true;
  };

  // ---------------------------------------------------------------
  // 食材
  // ---------------------------------------------------------------
  var baseIcon = OT.art.drawIcon;
  OT.art.drawIcon = function (canvas, id) {
    var pos = (A.icons || {})[id] || (id === 'sanmai' ? (A.icons || {}).tortilla : null);
    if (pos && S.has('icons')) {
      canvas.width = 32; canvas.height = 32;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(loaded.icons, pos[0], pos[1], 32, 32, 0, 0, 32, 32);
      return;
    }
    baseIcon(canvas, id);
  };

  var baseToppings = OT.art.drawToppings;
  OT.art.drawToppings = function (ctx, items, frame) {
    var P = A.pieces || {};
    if (!S.has('pieces')) return baseToppings(ctx, items, frame);
    var fd = global.OT_FOLD, ppu = fd.size / fd.orthoScale, cx = fd.size / 2, cy = fd.size / 2;
    var rest = [];
    items.forEach(function (id, layer) {
      var pos = P[id];
      if (!pos) { rest.push(id); return; }
      var look = OT.art.look(id);
      var n = pos[2] || look.n || 5;
      var r = OT.rng(OT.hash(id) + layer * 97);
      for (var i = 0; i < n; i++) {
        var a = r() * Math.PI * 2, d = Math.sqrt(r());
        var wx = 0.62 * d * Math.cos(a), wy = 0.3 * d * Math.sin(a);
        var f = OT.art.foldY(wy, look.h || 0.06, frame || 0);
        var v = Math.floor(r() * 3);
        var h = Math.max(6, Math.round(36 * f.squash));
        ctx.drawImage(loaded.pieces, pos[0] + v * 36, pos[1], 36, 36, Math.round(cx + wx * ppu - 18), Math.round(cy - f.y * ppu - h / 2), 36, h);
      }
    });
    if (rest.length) baseToppings(ctx, rest, frame);
  };

  var baseSkin = OT.art.drawSkin;
  OT.art.drawSkin = function (ctx, skin, frame) {
    frame = frame || 0;
    if (skin === 'real_tortilla') skin = 'tortilla';
    if (skin !== 'tortilla' && S.has('skin_' + skin)) {
      ctx.drawImage(loaded['skin_' + skin], frame * 128, 0, 128, 128, 0, 0, 128, 128);
      return;
    }
    baseSkin(ctx, skin, frame);
  };

  /** すだち（さっぱりしたタコス以外に添える）：皿のふちに */
  OT.sprites.drawSudachi = function (ctx) {
    var pos = (A.pieces || {}).sudachi;
    if (!pos || !S.has('pieces')) return;
    ctx.drawImage(loaded.pieces, pos[0], pos[1], 36, 36, 90, 86, 36, 36);
  };

  // ---------------------------------------------------------------
  // 厨房：焼き場の具・盛り付けの層（置く・撒く・回しかける）
  // ---------------------------------------------------------------
  function pieceSheet(id, state) {
    var cooked = (A.cooked || []).indexOf(id) >= 0;
    if (cooked && state === 'raw' && S.has('pieces_raw')) return loaded.pieces_raw;
    if (cooked && state === 'burnt' && S.has('pieces_burnt')) return loaded.pieces_burnt;
    return S.has('pieces') ? loaded.pieces : null;
  }

  /** 焼き場の上の具（2倍の大きさ）。state は raw / good / burnt */
  OT.sprites.drawPieceState = function (ctx, id, state, x, y, flipped) {
    var pos = (A.pieces || {})[id], sheet = pieceSheet(id, state);
    if (!pos || !sheet) {
      var look = OT.art.look(id);
      ctx.fillStyle = state === 'burnt' ? '#2e1a12' : state === 'raw' ? '#f6c39c' : look.c[0];
      ctx.fillRect(Math.round(x) - 10, Math.round(y) - 7, 20, 14);
      return;
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flipped) ctx.scale(-1, 1);
    for (var k = 0; k < 2; k++) ctx.drawImage(sheet, pos[0] + k * 36, pos[1], 36, 36, -36 + k * 10 - 5, -36 + k * 6 - 3, 72, 72);
    ctx.restore();
  };

  /**
   * 焼き場の具の絵（かけら2つを重ねた1切れ）を、scale 倍の canvas にして返す（作った絵は覚えておく）。
   * state は raw / good / burnt。marks = true で網の焼き目（ななめの焦げ筋）をつける。
   */
  var pieceCache = {};
  OT.sprites.pieceImage = function (id, state, marks, scale) {
    scale = scale || 2;
    var key = id + '|' + state + '|' + (marks ? 1 : 0) + '|' + scale;
    if (pieceCache[key]) return pieceCache[key];
    var pos = (A.pieces || {})[id], sheet = pieceSheet(id, state);
    if (!pos || !sheet || !sheet.complete || !sheet.naturalWidth) return null;
    var size = Math.round(48 * scale);
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    var w = Math.round(36 * scale);
    for (var k = 0; k < 2; k++) g.drawImage(sheet, pos[0] + k * 36, pos[1], 36, 36, Math.round((k * 10 + 1) * scale / 2 + (size - w) / 2 - 3 * scale), Math.round((k * 6 + 1) * scale / 2 + (size - w) / 2 - 2 * scale), w, w);
    if (marks) {
      // 網の焼き目：ななめの筋の上だけ、色を暗くする
      var img = g.getImageData(0, 0, size, size), d = img.data, per = Math.max(6, Math.round(7 * scale)), th = Math.max(2, Math.round(1.6 * scale));
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var i = (y * size + x) * 4;
        if (d[i + 3] < 128 || ((x + y) % per) >= th) continue;
        d[i] = Math.round(d[i] * 0.32 + 18); d[i + 1] = Math.round(d[i + 1] * 0.25 + 10); d[i + 2] = Math.round(d[i + 2] * 0.22 + 8);
      }
      g.putImageData(img, 0, 0);
    }
    pieceCache[key] = c;
    return c;
  };

  /** 撒いている途中のかけら（落ちてくる動き） */
  OT.sprites.drawPieceMini = function (ctx, id, x, y) {
    var pos = (A.pieces || {})[id];
    if (!pos || !S.has('pieces')) { ctx.fillStyle = OT.art.look(id).c[0]; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); return; }
    ctx.drawImage(loaded.pieces, pos[0], pos[1], 36, 36, Math.round(x) - 18, Math.round(y) - 18, 36, 36);
  };

  /** 盛り付けた層を、のせた順に描く（折りたたみのコマ frame にも合わせる） */
  OT.sprites.drawLayers = function (ctx, layers, frame) {
    var P = A.pieces || {};
    var fd = global.OT_FOLD, ppu = fd.size / fd.orthoScale, cx = fd.size / 2, cy = fd.size / 2;
    frame = frame || 0;
    layers.forEach(function (L, li) {
      var look = OT.art.look(L.id), pos = P[L.id], sheet = pieceSheet(L.id, L.state || 'good');
      var h = look.h || 0.06;
      function at(px, py) {
        var wx = (px - cx) / ppu, wy = (cy - py) / ppu;
        var f = OT.art.foldY(wy, h, frame);
        return { x: cx + wx * ppu, y: cy - f.y * ppu, squash: f.squash };
      }
      if (L.use === 'drizzle') {
        ctx.fillStyle = look.c[0];
        var shade = look.c[1] || look.c[0];
        for (var i = 1; i < L.pts.length; i++) {
          var a = L.pts[i - 1], b = L.pts[i];
          if (b.brk) continue;
          var n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
          for (var k = 0; k <= n; k++) {
            var q = at(a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n);
            ctx.fillStyle = look.c[0];
            ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, Math.max(1, Math.round(2 * q.squash)));
            ctx.fillStyle = shade;
            ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) + 1, 3, 1);
          }
        }
        return;
      }
      if (L.use === 'sprinkle') {
        L.pts.forEach(function (p, i) {
          var q = at(p.x, p.y);
          if (pos && sheet) {
            var hh = Math.max(6, Math.round(36 * q.squash));
            ctx.drawImage(sheet, pos[0] + (i % 3) * 36, pos[1], 36, 36, Math.round(q.x - 18), Math.round(q.y - hh / 2), 36, hh);
          } else { ctx.fillStyle = look.c[0]; ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3); }
        });
        return;
      }
      // 置く具：皮の上に散らす（置いた所のまわりに寄せる）
      if (!pos || !sheet) { OT.art.drawToppings(ctx, [L.id], frame); return; }
      var r = OT.rng(OT.hash(L.id) + li * 97);
      var cnt = pos[2] || look.n || 5, p0 = L.pts[0] || { x: cx, y: cy };
      var bx = (p0.x - cx) / ppu * 0.35, by = (cy - p0.y) / ppu * 0.35;
      for (var j = 0; j < cnt; j++) {
        var ang = r() * Math.PI * 2, d = Math.sqrt(r());
        var wx = bx + 0.5 * d * Math.cos(ang), wy = by + 0.24 * d * Math.sin(ang);
        var f = OT.art.foldY(wy, h, frame);
        var v = Math.floor(r() * 3);
        var hh2 = Math.max(6, Math.round(36 * f.squash));
        ctx.drawImage(sheet, pos[0] + v * 36, pos[1], 36, 36, Math.round(cx + wx * ppu - 18), Math.round(cy - f.y * ppu - hh2 / 2), 36, hh2);
      }
    });
  };

  // ---------------------------------------------------------------
  // 屋台
  // ---------------------------------------------------------------
  OT.sprites.stallBg = function (festival) {
    var k = 'stall_' + (festival || 'normal');
    return S.has(k) ? loaded[k] : (S.has('stall_normal') ? loaded.stall_normal : null);
  };
  OT.sprites.stallFg = function () { return S.has('stall_fg') ? loaded.stall_fg : null; };
})(window);
