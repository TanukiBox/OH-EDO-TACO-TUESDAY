/*
 * 多幸寿：絵
 *   ・art/output/ のドット絵（Blender → ドット絵化）を読み込む
 *   ・まだ絵がないものは「仮の図形」を、ドット絵と同じパレットの色で描く
 *     （第4段階で、Blender で作った絵に差し替える）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  // art/pipeline/palette.py と同じ32色
  var P = {
    outline: '#1c1220',
    char: '#2e1a12', brown1: '#5a3218', brown2: '#8c5228', brown3: '#b87838', brown4: '#dca24a',
    corn: '#f4cc62', corn2: '#fbe39a', cornShade: '#b08a4a',
    white: '#fffaf0', white2: '#f0e6d2', gray1: '#d6ccb8', gray2: '#aaa292', gray3: '#76726a',
    pink1: '#ffb8a4', pink2: '#f0664e', pink3: '#b8323a',
    red1: '#f24a2a', red2: '#c42618', red3: '#7a1414',
    green1: '#a8e05a', green2: '#46b03a', green3: '#1f6a2c',
    ind1: '#5070b0', ind2: '#34569a', ind3: '#243f7a', ind4: '#172b58', ind5: '#0d1830',
    warm1: '#ffe6b0', warm2: '#f5b860',
    night1: '#4a4658', night2: '#2a2838'
  };
  OT.PAL = P;

  var BASE = 'art/output/';
  var images = {};
  var FILES = {
    plate: 'taco_plain/plate_top.png',
    icon_tai: 'icons/icon_tai.png',
    icon_negi: 'icons/icon_negi.png',
    taco_top: 'taco/taco_top.png'
  };
  for (var i = 0; i < 8; i++) FILES['fold' + i] = 'taco_plain/plain_fold_0' + i + '.png';
  for (var j = 0; j < 6; j++) FILES['noren' + j] = 'noren/noren_0' + j + '.png';

  OT.art = {
    img: function (k) { return images[k]; },
    load: function (done) {
      var keys = Object.keys(FILES), left = keys.length;
      keys.forEach(function (k) {
        var im = new Image();
        im.onload = im.onerror = function () { if (--left === 0) done(); };
        im.src = BASE + FILES[k] + '?v=' + OT.VERSION;
        images[k] = im;
      });
    },
    // 食材の本物のアイコン（あるものだけ）
    iconFor: function (id) {
      if (id === 'tai') return images.icon_tai;
      if (id === 'negi') return images.icon_negi;
      return null;
    }
  };

  // ---------------------------------------------------------------
  // 乱数（同じ種なら同じ並び）
  // ---------------------------------------------------------------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  OT.rng = rng;
  OT.hash = hash;

  // ---------------------------------------------------------------
  // 仮の図形：食材のかけら（真上から見た小さなドット）
  //   shape: chunk かたまり / blob とろっとしたもの / strand 千切り / ring 輪切り / dust 粉 / zest 皮の細切り
  //   c: [明るい, ふつう, 暗い]、n: かけらの数、s: 大きさ（ドット）、h: 皮からの高さ
  // ---------------------------------------------------------------
  var LOOK = {
    tortilla: { shape: 'blob', c: [P.corn2, P.corn, P.cornShade], n: 1, s: 8, h: 0 },
    tai:      { shape: 'chunk', c: [P.white, P.white2, P.pink2], n: 8, s: 6, h: 0.05 },
    kisu_ten: { shape: 'chunk', c: [P.corn2, P.brown4, P.brown2], n: 6, s: 7, h: 0.06 },
    tako:     { shape: 'chunk', c: [P.pink1, P.pink2, P.pink3], n: 8, s: 5, h: 0.05 },
    katsuo:   { shape: 'chunk', c: [P.pink2, P.red3, P.brown1], n: 7, s: 6, h: 0.05 },
    shiraae:  { shape: 'blob', c: [P.white, P.white2, P.gray2], n: 3, s: 5, h: 0.08 },
    sumiso:   { shape: 'blob', c: [P.corn2, P.brown4, P.brown2], n: 3, s: 4, h: 0.08 },
    bainiku:  { shape: 'blob', c: [P.pink2, P.red2, P.red3], n: 4, s: 3, h: 0.09 },
    irizake:  { shape: 'blob', c: [P.warm2, P.brown3, P.brown1], n: 5, s: 2, h: 0.07 },
    daikon:   { shape: 'strand', c: [P.white, P.white2, P.gray1], n: 16, s: 4, h: 0.1 },
    kyuri:    { shape: 'ring', c: [P.green1, P.green2, P.green3], n: 7, s: 3, h: 0.1 },
    myoga:    { shape: 'strand', c: [P.pink1, P.pink2, P.pink3], n: 9, s: 3, h: 0.11 },
    negi:     { shape: 'ring', c: [P.green1, P.green2, P.green3], n: 12, s: 2, h: 0.12 },
    yuzu:     { shape: 'zest', c: [P.corn2, P.corn, P.brown4], n: 10, s: 2, h: 0.12 },
    shichimi: { shape: 'dust', c: [P.red1, P.red2, P.brown3], n: 26, s: 1, h: 0.13 }
  };
  // 第2段階の食材
  var MORE = {
    aji_nanban: { shape: 'chunk', c: [P.corn2, P.brown4, P.brown2], n: 6, s: 6, h: 0.06 },
    iwashi:     { shape: 'chunk', c: [P.gray1, P.ind1, P.ind3], n: 6, s: 6, h: 0.05 },
    zuke:       { shape: 'chunk', c: [P.pink2, P.red2, P.red3], n: 6, s: 5, h: 0.05 },
    akami:      { shape: 'chunk', c: [P.pink2, P.red2, P.red3], n: 5, s: 6, h: 0.05 },
    chutoro:    { shape: 'chunk', c: [P.pink1, P.pink2, P.red2], n: 5, s: 6, h: 0.05 },
    otoro:      { shape: 'chunk', c: [P.white, P.pink1, P.pink2], n: 5, s: 6, h: 0.05 },
    kabayaki:   { shape: 'chunk', c: [P.brown4, P.brown2, P.brown1], n: 4, s: 8, h: 0.06 },
    uni:        { shape: 'blob', c: [P.corn2, P.warm2, P.brown3], n: 5, s: 3, h: 0.07 },
    kujira:     { shape: 'chunk', c: [P.red2, P.red3, P.char], n: 6, s: 6, h: 0.05 },
    inago:      { shape: 'chunk', c: [P.brown4, P.brown2, P.brown1], n: 9, s: 3, h: 0.06 },
    hachinoko:  { shape: 'blob', c: [P.white, P.white2, P.gray1], n: 9, s: 1, h: 0.06 },
    makomo:     { shape: 'chunk', c: [P.white2, P.gray1, P.char], n: 6, s: 5, h: 0.06 },
    inoshishi:  { shape: 'chunk', c: [P.pink1, P.brown3, P.brown1], n: 6, s: 6, h: 0.05 },
    ino_bara:   { shape: 'chunk', c: [P.white, P.pink1, P.brown3], n: 6, s: 6, h: 0.05 },
    ino_shita:  { shape: 'chunk', c: [P.pink1, P.pink2, P.brown2], n: 5, s: 6, h: 0.05 },
    ino_mimi:   { shape: 'strand', c: [P.pink1, P.brown3, P.brown2], n: 12, s: 4, h: 0.06 },
    shika:      { shape: 'chunk', c: [P.red2, P.red3, P.brown1], n: 6, s: 6, h: 0.05 },
    shamo:      { shape: 'chunk', c: [P.corn2, P.brown4, P.brown2], n: 6, s: 5, h: 0.05 },
    kamo:       { shape: 'chunk', c: [P.pink2, P.brown2, P.brown1], n: 6, s: 6, h: 0.05 },
    atsuyaki:   { shape: 'chunk', c: [P.corn2, P.corn, P.brown4], n: 4, s: 8, h: 0.06 },
    tofu_soboro: { shape: 'dust', c: [P.white, P.white2, P.gray1], n: 40, s: 1, h: 0.06 },
    yakidofu:   { shape: 'chunk', c: [P.white2, P.gray1, P.brown3], n: 5, s: 6, h: 0.06 },
    nidaikon:   { shape: 'chunk', c: [P.corn2, P.white2, P.brown4], n: 4, s: 7, h: 0.06 },
    konnyaku:   { shape: 'chunk', c: [P.gray2, P.gray3, P.night1], n: 5, s: 5, h: 0.06 },
    satsumaimo: { shape: 'chunk', c: [P.corn2, P.corn, P.pink3], n: 5, s: 6, h: 0.06 },
    satoimo:    { shape: 'blob', c: [P.white, P.white2, P.gray2], n: 5, s: 3, h: 0.06 },
    nasu:       { shape: 'chunk', c: [P.ind1, P.ind3, P.ind5], n: 5, s: 6, h: 0.06 },
    matsutake:  { shape: 'chunk', c: [P.white2, P.brown3, P.brown1], n: 5, s: 7, h: 0.06 },
    sumeshi:    { shape: 'blob', c: [P.white, P.white2, P.gray1], n: 4, s: 5, h: 0.05 },
    shichimi_miso: { shape: 'blob', c: [P.pink2, P.red2, P.brown1], n: 4, s: 3, h: 0.08 },
    miso:       { shape: 'blob', c: [P.brown4, P.brown3, P.brown2], n: 4, s: 3, h: 0.08 },
    dengaku_miso: { shape: 'blob', c: [P.brown3, P.brown2, P.brown1], n: 4, s: 3, h: 0.08 },
    dashi:      { shape: 'blob', c: [P.corn2, P.warm2, P.brown4], n: 5, s: 2, h: 0.07 },
    oroshi:     { shape: 'blob', c: [P.white, P.white2, P.gray1], n: 3, s: 5, h: 0.1 },
    amazu_myoga: { shape: 'strand', c: [P.pink1, P.pink2, P.red2], n: 9, s: 3, h: 0.11 },
    shiraganegi: { shape: 'strand', c: [P.white, P.white2, P.green1], n: 18, s: 5, h: 0.12 },
    yakinegi:   { shape: 'chunk', c: [P.green1, P.white2, P.brown2], n: 5, s: 5, h: 0.1 },
    shoga:      { shape: 'strand', c: [P.corn2, P.corn, P.brown4], n: 10, s: 3, h: 0.11 },
    shiso:      { shape: 'chunk', c: [P.green1, P.green2, P.green3], n: 3, s: 7, h: 0.11 },
    mitsuba:    { shape: 'strand', c: [P.green1, P.green2, P.green3], n: 10, s: 4, h: 0.12 },
    goma:       { shape: 'dust', c: [P.white2, P.corn2, P.char], n: 30, s: 1, h: 0.13 },
    kizaminori: { shape: 'strand', c: [P.green3, P.ind5, P.char], n: 14, s: 3, h: 0.12 },
    wasabi:     { shape: 'blob', c: [P.green1, P.green2, P.green3], n: 2, s: 2, h: 0.1 },
    sansho:     { shape: 'dust', c: [P.green1, P.green2, P.green3], n: 20, s: 1, h: 0.13 },
    togarashi:  { shape: 'ring', c: [P.red1, P.red2, P.red3], n: 7, s: 2, h: 0.12 }
  };
  Object.keys(MORE).forEach(function (k) { LOOK[k] = MORE[k]; });
  // 第3段階の食材
  var MORE3 = {
    kashira:     { shape: 'chunk', c: [P.pink1, P.brown3, P.brown1], n: 7, s: 5, h: 0.05 },
    ino_karaage: { shape: 'chunk', c: [P.brown4, P.brown3, P.brown1], n: 6, s: 6, h: 0.06 },
    amazu:       { shape: 'blob', c: [P.pink1, P.pink2, P.red2], n: 4, s: 3, h: 0.08 },
    sakura:      { shape: 'zest', c: [P.white, P.pink1, P.pink2], n: 12, s: 2, h: 0.12 },
    ranou:       { shape: 'blob', c: [P.warm1, P.warm2, P.brown3], n: 1, s: 5, h: 0.09 },
    konbu:       { shape: 'strand', c: [P.green3, P.ind5, P.char], n: 10, s: 4, h: 0.1 },
    sake:        { shape: 'chunk', c: [P.pink1, P.pink2, P.brown3], n: 6, s: 6, h: 0.05 },
    buta:        { shape: 'chunk', c: [P.white, P.pink1, P.brown3], n: 6, s: 6, h: 0.05 },
    kosho:       { shape: 'dust', c: [P.char, P.gray3, P.brown1], n: 30, s: 1, h: 0.13 },
    nikkei:      { shape: 'dust', c: [P.brown3, P.brown2, P.brown1], n: 24, s: 1, h: 0.13 },
    choji:       { shape: 'dust', c: [P.brown2, P.brown1, P.char], n: 14, s: 1, h: 0.13 },
    sato:        { shape: 'dust', c: [P.white, P.white2, P.gray1], n: 24, s: 1, h: 0.13 },
    pineapple:   { shape: 'chunk', c: [P.corn2, P.corn, P.brown4], n: 6, s: 5, h: 0.07 },
    gyuniku:     { shape: 'chunk', c: [P.brown3, P.brown2, P.char], n: 6, s: 6, h: 0.05 },
    cheese:      { shape: 'blob', c: [P.warm1, P.corn2, P.corn], n: 3, s: 5, h: 0.07 },
    butter:      { shape: 'blob', c: [P.warm1, P.corn2, P.brown4], n: 2, s: 3, h: 0.08 },
    tomato:      { shape: 'chunk', c: [P.red1, P.red2, P.red3], n: 7, s: 4, h: 0.07 },
    avocado:     { shape: 'chunk', c: [P.green1, P.green2, P.green3], n: 6, s: 5, h: 0.07 },
    mole:        { shape: 'blob', c: [P.brown2, P.brown1, P.char], n: 4, s: 4, h: 0.08 },
    honba_chili: { shape: 'ring', c: [P.red1, P.red2, P.red3], n: 6, s: 2, h: 0.12 },
    corn:        { shape: 'chunk', c: [P.corn2, P.corn, P.brown4], n: 6, s: 3, h: 0.05 }
  };
  Object.keys(MORE3).forEach(function (k) { LOOK[k] = MORE3[k]; });

  OT.art.look = function (id) { return LOOK[id] || { shape: 'blob', c: [P.gray1, P.gray2, P.gray3], n: 4, s: 3, h: 0.08 }; };

  function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  /** かけら1つを (x, y) を中心に描く。squash は縦のつぶれ（折りたたみ用、1 = そのまま） */
  function drawPiece(ctx, look, x, y, r, squash) {
    var c = look.c, s = look.s;
    var hs = Math.max(1, Math.round(s * squash));
    switch (look.shape) {
      case 'chunk': {
        var w = s + Math.floor(r() * 3), h = Math.max(1, Math.round((s - 1 + Math.floor(r() * 2)) * squash));
        rect(ctx, x - w / 2 - 1, y - h / 2, w + 2, h + 1, P.outline);   // 輪郭（ドット絵と同じ暗い線）
        rect(ctx, x - w / 2, y - h / 2 - 1, w, h + 2, P.outline);
        rect(ctx, x - w / 2, y - h / 2, w, h, c[1]);
        rect(ctx, x - w / 2, y - h / 2, w - 1, 1, c[0]);
        rect(ctx, x - w / 2 + 1, y + h / 2 - 1, w - 1, 1, c[2]);
        rect(ctx, x + w / 2 - 1, y - h / 2 + 1, 1, h - 1, c[2]);
        break;
      }
      case 'blob': {
        for (var oy = -hs - 1; oy <= hs + 1; oy++) {
          for (var ox = -s - 1; ox <= s + 1; ox++) {
            if ((ox * ox) / ((s + 1) * (s + 1)) + (oy * oy) / ((hs + 1) * (hs + 1)) <= 1) px(ctx, x + ox, y + oy, P.outline);
          }
        }
        for (var yy = -hs; yy <= hs; yy++) {
          for (var xx = -s; xx <= s; xx++) {
            var d = (xx * xx) / (s * s) + (yy * yy) / (hs * hs);
            if (d <= 1) px(ctx, x + xx, y + yy, d < 0.3 && xx < 0 && yy < 0 ? c[0] : d > 0.7 && yy > 0 ? c[2] : c[1]);
          }
        }
        break;
      }
      case 'strand': {
        var dx = r() < 0.5 ? 1 : -1;
        for (var k = 0; k < s; k++) px(ctx, x + k * dx * 0.7, y + (k - s / 2) * squash, k === 0 ? c[0] : c[1]);
        break;
      }
      case 'ring': {
        var rr = s;
        for (var a = 0; a < 12; a++) {
          var ang = a / 12 * Math.PI * 2;
          px(ctx, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * squash, a < 6 ? c[1] : c[2]);
        }
        px(ctx, x - rr, y - 1, c[0]);
        break;
      }
      case 'zest': {
        rect(ctx, x, y, 2, 1, c[1]); px(ctx, x, y, c[0]);
        break;
      }
      default: // dust
        px(ctx, x, y, r() < 0.6 ? c[1] : r() < 0.5 ? c[0] : c[2]);
    }
  }

  // ---------------------------------------------------------------
  // タコスの上の具（真上）。fold = 折りたたみのコマ（0 = 開いたまま）
  // ---------------------------------------------------------------
  var F = function () { return global.OT_FOLD; };

  /** 折りたたみの変形（art/blender/taco.py の fold_coords と同じ式） */
  function foldY(y, h, frame) {
    var fd = F(), t = frame / (fd.frames - 1), e = t * t * (3 - 2 * t);
    var angle = e * fd.foldMaxAngle;
    if (angle < 1e-5) return { y: y, squash: 1 };
    var R = fd.foldBand / (angle / 2);
    var th = Math.max(-angle / 2, Math.min(angle / 2, y / R));
    var extra = y - th * R;
    var sy = R * Math.sin(th) + extra * Math.cos(th) - h * Math.sin(th);
    return { y: sy, squash: Math.max(0.35, Math.abs(Math.cos(th))) };
  }

  /** items の具を、128×128 のタコスの絵の上に描く */
  OT.art.drawToppings = function (ctx, items, frame) {
    var fd = F(), ppu = fd.size / fd.orthoScale, cx = fd.size / 2, cy = fd.size / 2;
    items.forEach(function (id, layer) {
      var look = OT.art.look(id);
      var r = rng(hash(id) + layer * 97);
      for (var i = 0; i < look.n; i++) {
        // 背骨（横方向）に沿った楕円の中に散らす
        var a = r() * Math.PI * 2, d = Math.sqrt(r());
        var wx = 0.62 * d * Math.cos(a), wy = 0.3 * d * Math.sin(a);
        var f = foldY(wy, look.h, frame || 0);
        drawPiece(ctx, look, cx + wx * ppu, cy - f.y * ppu, r, f.squash);
      }
    });
  };

  /** 食材の箱に出す小さな絵（24×24）。本物のアイコンがあればそれを使う */
  OT.art.drawIcon = function (canvas, id) {
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var real = OT.art.iconFor(id);
    if (real && real.complete && real.naturalWidth) {
      canvas.width = 32; canvas.height = 32;
      ctx.drawImage(real, 0, 0);
      return;
    }
    canvas.width = 24; canvas.height = 24;
    var look = OT.art.look(id);
    var ingd = OT.CFG.INGREDIENTS[id];
    if (ingd && (ingd.cat === 'skin' || ingd.cat === 'ready')) { OT.art._drawSkinIcon(ctx, id); return; }
    var r = rng(hash(id + 'icon'));
    var n = look.shape === 'dust' ? 30 : Math.min(look.n, look.shape === 'strand' ? 14 : 6);
    for (var i = 0; i < n; i++) {
      var ang = r() * Math.PI * 2, dd = Math.sqrt(r()) * 7;
      drawPiece(ctx, look, 12 + Math.cos(ang) * dd, 12 + Math.sin(ang) * dd * 0.8, r, 1);
    }
  };

  // ---------------------------------------------------------------
  // 仮の図形：客（屋台の前に立つ人）
  // ---------------------------------------------------------------
  var SKIN = '#f0c8a0', SKIN2 = '#d8a07a';  // 仮の肌色（第4段階でパレットに入れる）
  var CLOTH = {
    chonin: { body: P.brown3, band: P.brown1, hair: P.char },
    shokunin: { body: P.ind2, band: P.white2, hair: P.char },
    samurai: { body: P.ind4, band: P.gray2, hair: P.char }
  };

  /** mood: 'ok' | 'happy' | 'worry' | 'angry' / t: 時間（ゆらゆら動かす） */
  OT.art.drawGuest = function (ctx, typeId, x, y, mood, t, selected) {
    var cl = CLOTH[typeId] || CLOTH.chonin;
    var bob = Math.round(Math.sin(t * 3 + x) * 0.6);
    var yy = y + bob;
    if (selected) {
      ctx.fillStyle = 'rgba(255,230,176,0.25)';
      ctx.fillRect(x - 15, yy - 40, 30, 48);
    }
    // 体（着物）
    rect(ctx, x - 11, yy - 16, 22, 24, cl.body);
    rect(ctx, x - 11, yy - 16, 22, 1, P.outline);
    rect(ctx, x - 1, yy - 16, 2, 10, cl.band);      // 襟
    rect(ctx, x - 11, yy - 6, 22, 3, cl.band);      // 帯
    if (typeId === 'samurai') { rect(ctx, x - 14, yy - 16, 28, 3, cl.body); rect(ctx, x - 14, yy - 16, 28, 1, P.gray3); } // 肩衣
    if (typeId === 'shokunin') { rect(ctx, x - 11, yy - 2, 22, 1, P.white2); }
    // 頭
    var face = mood === 'angry' ? '#e89070' : SKIN;
    rect(ctx, x - 7, yy - 31, 14, 14, face);
    rect(ctx, x - 7, yy - 18, 14, 1, SKIN2);
    // 髪
    rect(ctx, x - 7, yy - 32, 14, 4, cl.hair);
    rect(ctx, x - 8, yy - 30, 2, 6, cl.hair);
    rect(ctx, x + 6, yy - 30, 2, 6, cl.hair);
    rect(ctx, x - 1, yy - 36, 3, 4, cl.hair);          // まげ
    if (typeId === 'shokunin') { rect(ctx, x - 8, yy - 29, 16, 2, P.white2); } // はちまき
    // 顔
    var ey = yy - 25;
    if (mood === 'happy') {
      px(ctx, x - 4, ey, P.outline); px(ctx, x - 3, ey - 1, P.outline); px(ctx, x - 2, ey, P.outline);
      px(ctx, x + 2, ey, P.outline); px(ctx, x + 3, ey - 1, P.outline); px(ctx, x + 4, ey, P.outline);
      rect(ctx, x - 2, ey + 4, 5, 2, P.red3);
    } else {
      rect(ctx, x - 4, ey, 2, 2, P.outline); rect(ctx, x + 2, ey, 2, 2, P.outline);
      if (mood === 'angry') {
        px(ctx, x - 5, ey - 2, P.outline); px(ctx, x - 4, ey - 1, P.outline);
        px(ctx, x + 4, ey - 2, P.outline); px(ctx, x + 3, ey - 1, P.outline);
        rect(ctx, x - 2, ey + 5, 5, 1, P.outline);
      } else if (mood === 'worry') {
        rect(ctx, x - 1, ey + 5, 3, 1, P.outline);
        rect(ctx, x + 7, ey - 3, 1, 2, P.ind1); // 汗
      } else {
        rect(ctx, x - 1, ey + 4, 3, 1, P.brown1);
      }
    }
  };

  // ---------------------------------------------------------------
  // 仮の図形：夜の屋台（奥の町並み・提灯・カウンター）
  // ---------------------------------------------------------------
  OT.art.drawStall = function (ctx, w, h, t) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.ind5); g.addColorStop(1, P.night2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 月
    rect(ctx, w - 30, 8, 8, 8, P.warm1); rect(ctx, w - 31, 10, 10, 4, P.warm1);
    // 町並みの影
    ctx.fillStyle = P.ind4;
    for (var i = 0; i < 7; i++) {
      var bx = i * 30 - 6, bh = 22 + ((i * 37) % 13);
      ctx.fillRect(bx, h - 46 - bh, 28, bh);
      ctx.fillStyle = P.ind5; ctx.fillRect(bx - 2, h - 48 - bh, 32, 3); ctx.fillStyle = P.ind4;
    }
    // 屋台の屋根
    rect(ctx, 0, 0, w, 7, P.brown1); rect(ctx, 0, 7, w, 1, P.outline);
    // 提灯
    [22, w - 22].forEach(function (lx, k) {
      var sway = Math.round(Math.sin(t * 1.5 + k) * 1);
      var glow = ctx.createRadialGradient(lx + sway, 22, 2, lx + sway, 22, 30);
      glow.addColorStop(0, 'rgba(255,200,120,0.35)'); glow.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = glow; ctx.fillRect(lx - 32, 0, 64, 60);
      rect(ctx, lx - 1 + sway, 8, 2, 4, P.char);
      rect(ctx, lx - 6 + sway, 12, 12, 18, P.red1);
      rect(ctx, lx - 6 + sway, 12, 12, 2, P.char); rect(ctx, lx - 6 + sway, 28, 12, 2, P.char);
      rect(ctx, lx - 5 + sway, 17, 10, 1, P.red2); rect(ctx, lx - 5 + sway, 22, 10, 1, P.red2);
      rect(ctx, lx - 3 + sway, 14, 2, 12, P.warm2);
    });
  };

  OT.art.drawCounter = function (ctx, w, h) {
    rect(ctx, 0, h - 22, w, 22, P.brown2);
    rect(ctx, 0, h - 22, w, 2, P.brown4);
    rect(ctx, 0, h - 20, w, 1, P.brown3);
    for (var x = 0; x < w; x += 23) rect(ctx, x, h - 18, 1, 18, P.brown1);
    rect(ctx, 0, h - 1, w, 1, P.outline);
  };

  // ---------------------------------------------------------------
  // 仮の図形：競りの魚
  // ---------------------------------------------------------------
  OT.art.drawFish = function (ctx, kind, w, h) {
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2;
    function ell(x0, y0, rx, ry, col, col2) {
      for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) {
        var d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d <= 1) px(ctx, x0 + x, y0 + y, y > ry * 0.3 && col2 ? col2 : col);
      }
    }
    if (kind === 'uni') {
      for (var sp = 0; sp < 60; sp++) {
        var an = sp / 60 * Math.PI * 2, rr = 16 + (sp % 3) * 3;
        rect(ctx, cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.7, 1, 2, P.char);
      }
      ell(cx, cy, 15, 11, P.ind5, P.char);
      ell(cx, cy - 2, 8, 5, P.warm2, P.corn);
      return;
    }
    if (kind === 'kujira') {
      ell(cx - 4, cy + 2, 40, 14, P.ind4, P.gray1);
      for (var tk = 0; tk < 10; tk++) rect(ctx, cx + 34 + tk, cy - 4 - tk, 2, 8 + tk, P.ind4);
      rect(ctx, cx - 30, cy + 2, 3, 3, P.outline);
      for (var ln = 0; ln < 5; ln++) rect(ctx, cx - 20 + ln * 6, cy + 10, 4, 1, P.gray2);
      return;
    }
    if (kind === 'tako') {
      for (var k = 0; k < 8; k++) {
        var a = Math.PI * (0.15 + 0.7 * k / 7);
        for (var s = 0; s < 22; s++) {
          var xx = cx + Math.cos(a) * (8 + s) * 1.3 + Math.sin(s * 0.5 + k) * 2;
          var yy = cy + 4 + Math.sin(a) * (s * 0.7);
          px(ctx, xx, yy, P.pink2); px(ctx, xx, yy + 1, P.pink3);
          if (s % 4 === 0) px(ctx, xx, yy + 1, P.pink1);
        }
      }
      ell(cx, cy - 8, 12, 12, P.pink2, P.pink3);
      rect(ctx, cx - 5, cy - 8, 3, 3, P.outline); rect(ctx, cx + 3, cy - 8, 3, 3, P.outline);
      return;
    }
    var body = { tai: [P.pink2, P.pink1], kisu: [P.gray1, P.white], katsuo: [P.ind3, P.gray1] }[kind];
    var L = kind === 'kisu' ? 22 : kind === 'katsuo' ? 26 : 24, H = kind === 'kisu' ? 6 : kind === 'katsuo' ? 10 : 12;
    // 尾
    for (var t2 = 0; t2 < 10; t2++) {
      rect(ctx, cx + L - 2 + t2, cy - t2, 1, t2 * 2 + 1, body[0]);
    }
    ell(cx, cy, L, H, body[0], body[1]);
    if (kind === 'katsuo') for (var st = -10; st < 16; st += 5) rect(ctx, cx + st, cy + 3, 3, 1, P.gray2);
    if (kind === 'tai') { rect(ctx, cx - 8, cy - H - 3, 18, 3, P.pink2); }
    rect(ctx, cx - L + 6, cy - 3, 3, 3, P.outline);
    px(ctx, cx - L + 6, cy - 3, P.white);
  };

  // ---------------------------------------------------------------
  // 皮（真上）。トルティーヤは Blender のドット絵、ほかは仮の図形
  // ---------------------------------------------------------------
  var SKIN_LOOK = {
    morokoshi:   { c: [P.corn2, P.white2, P.cornShade], spot: P.brown3, crack: true },
    funoyaki:    { c: [P.white, P.white2, P.gray1], spot: P.brown4 },
    aburaage:    { c: [P.brown4, P.brown3, P.brown2], spot: P.brown2, rect: true },
    nori:        { c: [P.green3, P.ind5, P.char], spot: P.green2 },
    soba:        { c: [P.gray1, P.gray2, P.gray3], spot: P.brown1 },
    usuyaki:     { c: [P.corn2, P.corn, P.brown4], spot: P.brown4 },
    yakionigiri: { c: [P.white2, P.brown4, P.brown2], spot: P.brown1, tri: true },
    aigawa:      { c: [P.ind1, P.ind2, P.ind3], spot: P.ind4 },
    kagomushi:   { c: [P.corn2, P.corn, P.cornShade], spot: P.brown3 },
    pan:         { c: [P.brown4, P.brown3, P.brown2], spot: P.brown1 },
    yuba:        { c: [P.corn2, P.warm1, P.corn], spot: P.brown4 }
  };
  OT.art.skinLook = function (id) { return SKIN_LOOK[id]; };

  /** 折りたたみのコマでの、皮の見かけの縦の長さ（1 = 開いたまま） */
  function foldRatio(frame) {
    var f = foldY(0.95, 0, frame || 0);
    return Math.max(0.28, Math.abs(f.y) / 0.95);
  }

  OT.art.drawSkin = function (ctx, skin, frame) {
    frame = frame || 0;
    if (skin === 'tortilla' || !SKIN_LOOK[skin]) {
      ctx.drawImage(images['fold' + frame], 0, 0);
      return;
    }
    ctx.drawImage(images.plate, 0, 0);
    var L = SKIN_LOOK[skin], cx = 64, cy = 64, rx = 43, ry = Math.round(43 * foldRatio(frame));
    var r = rng(hash(skin));
    for (var y = -ry - 1; y <= ry + 1; y++) {
      for (var x = -rx - 1; x <= rx + 1; x++) {
        var inside, edge;
        if (L.rect) {
          inside = Math.abs(x) <= rx - 6 && Math.abs(y) <= ry - 2;
          edge = Math.abs(x) <= rx - 5 && Math.abs(y) <= ry - 1;
        } else if (L.tri) {
          inside = y >= -ry && y <= ry && Math.abs(x) <= (y + ry) / (2 * ry) * rx * 1.05 + 4;
          edge = y >= -ry - 1 && y <= ry + 1 && Math.abs(x) <= (y + ry) / (2 * ry) * rx * 1.05 + 5;
        } else {
          inside = (x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1;
          edge = (x * x) / ((rx + 1) * (rx + 1)) + (y * y) / ((ry + 1) * (ry + 1)) <= 1;
        }
        if (!inside) { if (edge) px(ctx, cx + x, cy + y, P.outline); continue; }
        var shade = (y > ry * 0.55) ? L.c[2] : (x < -rx * 0.3 && y < 0) ? L.c[0] : L.c[1];
        px(ctx, cx + x, cy + y, shade);
      }
    }
    for (var i = 0; i < 40; i++) {
      var a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.9;
      px(ctx, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, L.spot);
    }
    if (L.crack) {
      for (var k = 0; k < 4; k++) {
        var sx = cx + (r() - 0.5) * rx, sy = cy + (r() - 0.5) * ry;
        for (var j = 0; j < 7; j++) { px(ctx, sx, sy, P.cornShade); sx += r() < 0.5 ? 1 : -1; sy += foldRatio(frame); }
      }
    }
  };

  /** 皮のアイコン（24×24） */
  function drawSkinIcon(ctx, id) {
    if (id === 'tortilla') {
      for (var y = -9; y <= 9; y++) for (var x = -10; x <= 10; x++) {
        var d = (x * x) / 100 + (y * y) / 81;
        if (d <= 1) px(ctx, 12 + x, 12 + y, d > 0.8 ? P.cornShade : ((x * 7 + y * 13) % 11 === 0 ? P.brown3 : P.corn));
      }
      return;
    }
    var L = SKIN_LOOK[id] || SKIN_LOOK.funoyaki;
    for (var yy = -9; yy <= 9; yy++) for (var xx = -10; xx <= 10; xx++) {
      var inside = L.rect ? (Math.abs(xx) <= 9 && Math.abs(yy) <= 7) : L.tri ? (yy >= -8 && Math.abs(xx) <= (yy + 8) / 16 * 10 + 1) : (xx * xx) / 100 + (yy * yy) / 81 <= 1;
      if (inside) px(ctx, 12 + xx, 12 + yy, yy > 5 ? L.c[2] : ((xx * 5 + yy * 11) % 9 === 0 ? L.spot : L.c[1]));
    }
  }
  OT.art._drawSkinIcon = drawSkinIcon;

  // ---------------------------------------------------------------
  // 仮の図形：第2段階の客（お坊さん・力士・通人）
  // ---------------------------------------------------------------
  var baseGuest = OT.art.drawGuest;
  OT.art.drawGuest = function (ctx, typeId, x, y, mood, t, selected) {
    if (typeId !== 'bozu' && typeId !== 'rikishi' && typeId !== 'tsujin') return baseGuest(ctx, typeId, x, y, mood, t, selected);
    var bob = Math.round(Math.sin(t * 3 + x) * 0.6), yy = y + bob;
    var big = typeId === 'rikishi' ? 5 : 0;
    if (selected) { ctx.fillStyle = 'rgba(255,230,176,0.25)'; ctx.fillRect(x - 15 - big, yy - 40, 30 + big * 2, 48); }
    var body = typeId === 'bozu' ? P.char : typeId === 'rikishi' ? P.ind1 : P.brown1;
    rect(ctx, x - 11 - big, yy - 16, 22 + big * 2, 24, body);
    rect(ctx, x - 11 - big, yy - 16, 22 + big * 2, 1, P.outline);
    if (typeId === 'bozu') { rect(ctx, x - 11, yy - 12, 22, 3, P.brown4); rect(ctx, x + 3, yy - 16, 3, 20, P.brown4); }
    if (typeId === 'rikishi') { rect(ctx, x - 16, yy - 4, 32, 3, P.white2); }
    if (typeId === 'tsujin') { rect(ctx, x - 11, yy - 16, 22, 2, P.gray2); for (var i = -9; i < 11; i += 4) rect(ctx, x + i, yy - 10, 2, 2, P.warm2); }
    var face = mood === 'angry' ? '#e89070' : SKIN;
    var hw = typeId === 'rikishi' ? 8 : 7;
    rect(ctx, x - hw, yy - 31, hw * 2, 14, face);
    rect(ctx, x - hw, yy - 18, hw * 2, 1, SKIN2);
    if (typeId === 'bozu') { rect(ctx, x - 7, yy - 32, 14, 3, '#e8b890'); }
    else if (typeId === 'rikishi') { rect(ctx, x - 8, yy - 33, 16, 4, P.char); rect(ctx, x - 4, yy - 37, 8, 4, P.char); rect(ctx, x - 6, yy - 38, 12, 2, P.char); }
    else { rect(ctx, x - 7, yy - 32, 14, 3, P.gray1); rect(ctx, x - 8, yy - 30, 2, 5, P.gray1); rect(ctx, x + 6, yy - 30, 2, 5, P.gray1); rect(ctx, x - 1, yy - 35, 3, 3, P.gray1); }
    var ey = yy - 25;
    if (mood === 'happy') {
      px(ctx, x - 4, ey, P.outline); px(ctx, x - 3, ey - 1, P.outline); px(ctx, x - 2, ey, P.outline);
      px(ctx, x + 2, ey, P.outline); px(ctx, x + 3, ey - 1, P.outline); px(ctx, x + 4, ey, P.outline);
      rect(ctx, x - 2, ey + 4, 5, 2, P.red3);
    } else {
      if (typeId === 'bozu' && mood === 'ok') { rect(ctx, x - 4, ey + 1, 2, 1, P.outline); rect(ctx, x + 2, ey + 1, 2, 1, P.outline); }
      else { rect(ctx, x - 4, ey, 2, 2, P.outline); rect(ctx, x + 2, ey, 2, 2, P.outline); }
      if (mood === 'angry') { px(ctx, x - 5, ey - 2, P.outline); px(ctx, x + 4, ey - 2, P.outline); rect(ctx, x - 2, ey + 5, 5, 1, P.outline); }
      else if (mood === 'worry') { rect(ctx, x - 1, ey + 5, 3, 1, P.outline); rect(ctx, x + 7, ey - 3, 1, 2, P.ind1); }
      else rect(ctx, x - 1, ey + 4, 3, 1, P.brown1);
    }
    if (typeId === 'tsujin') { rect(ctx, x + 9, yy - 14, 2, 8, P.white2); rect(ctx, x + 8, yy - 16, 4, 3, P.red2); }
  };

  // ---------------------------------------------------------------
  // 仮の図形：一本釣りの魚（横から）・採集の生き物
  // ---------------------------------------------------------------
  OT.art.drawSeaFish = function (ctx, kind, x, y, dir, t) {
    var col = { aji: [P.gray1, P.corn2], iwashi: [P.ind1, P.white2], maguro: [P.ind3, P.gray1], unagi: [P.brown1, P.corn2], nushi: [P.ind4, P.gray1] }[kind] || [P.gray1, P.white];
    var L = { aji: 8, iwashi: 6, maguro: 14, unagi: 16, nushi: 22 }[kind] || 8;
    var H = { aji: 3, iwashi: 2, maguro: 5, unagi: 2, nushi: 8 }[kind] || 3;
    for (var i = -L; i <= L; i++) {
      var hh = Math.round(H * Math.sqrt(Math.max(0, 1 - (i * i) / (L * L))));
      var wig = kind === 'unagi' ? Math.round(Math.sin(i * 0.5 + t * 10) * 1.5) : 0;
      if (hh <= 0) hh = 1;
      rect(ctx, x + i * dir, y - hh + wig, 1, hh, col[0]);
      rect(ctx, x + i * dir, y + wig, 1, hh, col[1]);
    }
    rect(ctx, x + (L + 1) * dir, y - H, 2, H * 2, col[0]);
    px(ctx, x - (L - 3) * dir, y - 1, P.outline);
  };

  OT.art.drawForage = function (ctx, kind, x, y, t) {
    if (kind === 'inago') {
      rect(ctx, x - 4, y - 1, 8, 3, P.green2); rect(ctx, x - 4, y - 1, 8, 1, P.green1);
      rect(ctx, x + 3, y - 2, 2, 2, P.green2); px(ctx, x + 4, y - 2, P.outline);
      rect(ctx, x - 2, y + 2, 1, 2, P.green3); rect(ctx, x + 1, y + 2, 1, 2, P.green3);
      rect(ctx, x - 6, y, 3, 1, P.green3);
    } else if (kind === 'hachi') {
      for (var yy = -6; yy <= 6; yy++) for (var xx = -5; xx <= 5; xx++) if ((xx * xx) / 25 + (yy * yy) / 36 <= 1) px(ctx, x + xx, y + yy, (yy + 6) % 3 === 0 ? P.brown2 : P.brown4);
      rect(ctx, x - 1, y + 3, 2, 2, P.char);
      var bx = x + Math.round(Math.cos(t * 9) * 8), by = y - 4 + Math.round(Math.sin(t * 11) * 4);
      rect(ctx, bx, by, 2, 1, P.corn); px(ctx, bx, by + 1, P.char);
    } else if (kind === 'sansho') {
      for (var k = 0; k < 7; k++) { var a = k / 7 * Math.PI * 2; rect(ctx, x + Math.round(Math.cos(a) * 4), y + Math.round(Math.sin(a) * 3), 2, 2, P.green2); }
      for (var m = 0; m < 5; m++) px(ctx, x - 2 + m, y + (m % 2), P.red1);
    } else if (kind === 'makomo') {
      rect(ctx, x - 1, y - 10, 3, 16, P.green2); rect(ctx, x - 1, y - 10, 1, 16, P.green1);
      rect(ctx, x - 2, y + 2, 5, 5, P.white2); px(ctx, x, y + 4, P.char); px(ctx, x + 1, y + 5, P.char);
      rect(ctx, x - 4, y - 12, 1, 8, P.green3); rect(ctx, x + 3, y - 13, 1, 9, P.green3);
    }
  };

  // ---------------------------------------------------------------
  // 仮の図形：常連・旅の客・VIP（見分けがつくように、目印をつける）
  // ---------------------------------------------------------------
  var typeGuest = OT.art.drawGuest;
  var REG_MARK = { yokichi: P.warm2, genpachi: P.red1, hotta: P.white, jonen: P.brown4, ikazuchi: P.corn, sessai: P.pink1 };
  OT.art.drawGuest = function (ctx, skin, x, y, mood, t, selected, typeId) {
    typeId = typeId || skin;
    var bob = Math.round(Math.sin(t * 3 + x) * 0.6), yy = y + bob;
    if (skin === 'tabibito') {
      typeGuest(ctx, 'chonin', x, y, mood, t, selected);
      rect(ctx, x - 12, yy - 34, 24, 3, P.corn); rect(ctx, x - 8, yy - 37, 16, 3, P.brown4); rect(ctx, x - 3, yy - 39, 6, 2, P.brown3);   // 笠
      rect(ctx, x - 12, yy - 16, 24, 6, P.gray2);   // 合羽
      return;
    }
    if (skin === 'chin') {
      typeGuest(ctx, 'samurai', x, y, mood, t, selected);
      rect(ctx, x - 11, yy - 16, 22, 24, P.red2); rect(ctx, x - 1, yy - 16, 2, 20, P.corn);
      rect(ctx, x - 7, yy - 36, 14, 6, P.white); rect(ctx, x - 8, yy - 31, 16, 2, P.white2);   // 料理人の帽子
      return;
    }
    if (skin === 'raizo') {
      typeGuest(ctx, 'samurai', x, y, mood, t, selected);
      rect(ctx, x - 11, yy - 16, 22, 24, P.pink2); for (var i = -10; i < 11; i += 5) rect(ctx, x + i, yy - 12, 3, 3, P.white);
      rect(ctx, x - 6, yy - 27, 3, 1, P.red1); rect(ctx, x + 3, yy - 27, 3, 1, P.red1); rect(ctx, x - 7, yy - 22, 2, 3, P.red1); rect(ctx, x + 5, yy - 22, 2, 3, P.red1);   // 隈取
      return;
    }
    if (skin === 'ransai') {
      typeGuest(ctx, 'samurai', x, y, mood, t, selected);
      rect(ctx, x - 11, yy - 16, 22, 24, P.gray3);
      rect(ctx, x - 6, yy - 26, 4, 3, P.corn2); rect(ctx, x + 2, yy - 26, 4, 3, P.corn2); rect(ctx, x - 2, yy - 25, 4, 1, P.corn2);   // 眼鏡
      return;
    }
    if (skin === 'uesama') {
      typeGuest(ctx, 'samurai', x, y, mood, t, selected);
      rect(ctx, x - 14, yy - 16, 28, 24, P.ind1); rect(ctx, x - 14, yy - 16, 28, 3, P.warm2); rect(ctx, x - 2, yy - 12, 4, 4, P.warm1);   // 葵色の着物と紋
      return;
    }
    if (skin === 'ikazuchi') { typeGuest(ctx, 'rikishi', x, y, mood, t, selected); rect(ctx, x - 16, yy - 4, 32, 3, P.corn); return; }
    if (REG_MARK[skin]) {
      typeGuest(ctx, typeId, x, y, mood, t, selected);
      rect(ctx, x - 3, yy - 44, 6, 3, REG_MARK[skin]); px(ctx, x, yy - 41, REG_MARK[skin]);   // 常連の目印
      return;
    }
    typeGuest(ctx, skin, x, y, mood, t, selected);
  };

  /** 会話で使う顔（第4段階でドット絵に差し替える） */
  var FACES = { mateo: '🌮', pon: '🦝', tatsu: '🍣', yokichi: '🐟', genpachi: '🔨', hotta: '⚔️', jonen: '📿', ikazuchi: '💪',
    sessai: '🪭', chin: '🥢', ransai: '📚', raizo: '🎭', okane: '👵', kumazo: '🏹', gonta: '⛵', genba: '🍱', uesama: '👑',
    messenger: '📜', traveler: '🎒', crowd: '👥', narrator: '' };
  OT.art.portrait = function (who) { return FACES[who] || '🙂'; };
})(window);
