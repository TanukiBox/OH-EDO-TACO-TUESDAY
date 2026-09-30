/*
 * 多幸寿：ミニゲーム「田んぼと里山の採集」
 *   跳ねるイナゴ・蜂の巣・山椒・マコモダケが出てくる。消える前にタップで捕る。
 *   数字は config.js の FORAGE。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var W = 192, H = 128;
  var G = null;

  function cfg() { return OT.CFG.FORAGE; }
  function st() { return OT.state.get(); }

  // 出てくる場所（田んぼ・木・やぶ・水辺）
  var SPOTS = {
    inago: function () { return { x: 20 + Math.random() * 150, y: 70 + Math.random() * 45 }; },
    hachi: function () { var t = [[28, 36], [96, 30], [164, 38]][Math.floor(Math.random() * 3)]; return { x: t[0], y: t[1] + 10 }; },
    sansho: function () { return { x: 14 + Math.random() * 164, y: 56 + Math.random() * 10 }; },
    makomo: function () { return { x: 120 + Math.random() * 60, y: 96 + Math.random() * 20 }; }
  };

  function pick() {
    var items = cfg().items, keys = Object.keys(items), sum = 0;
    keys.forEach(function (k) { sum += items[k].weight; });
    var r = Math.random() * sum;
    for (var i = 0; i < keys.length; i++) { r -= items[keys[i]].weight; if (r <= 0) return keys[i]; }
    return keys[0];
  }

  OT.forage = {
    enter: function () {
      var root = OT.ui.screen('forage');
      root.innerHTML = '';
      G = { root: root, time: 0, items: [], got: {}, spawnT: 0, sparks: [] };
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🌾 ' + OT.t('forage.title') }));
      G.intro = OT.el('div', { class: 'auc-intro' }, [
        OT.el('p', { text: OT.t('forage.howto') }),
        OT.button(OT.t('forage.start'), start, 'primary big')
      ]);
      root.appendChild(G.intro);
    },
    leave: function () { if (G && G.raf) cancelAnimationFrame(G.raf); G = null; }
  };

  function start() {
    G.root.removeChild(G.intro);
    G.timeBar = OT.el('div', { class: 'auc-time' }, [OT.el('i')]);
    G.root.appendChild(G.timeBar);
    G.canvas = OT.ui.pixelCanvas(W, H, 'field-canvas');
    G.canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var r = G.canvas.getBoundingClientRect();
      tap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
    });
    G.root.appendChild(G.canvas);
    G.logEl = OT.el('div', { class: 'forage-log' });
    G.root.appendChild(G.logEl);
    G.last = performance.now();
    G.raf = requestAnimationFrame(loop);
  }

  function tap(x, y) {
    var best = null, bestD = 16;
    G.items.forEach(function (it) {
      var d = Math.hypot(it.x - x, it.y - y);
      if (d < bestD) { best = it; bestD = d; }
    });
    if (!best) { OT.sfx.tap(); return; }
    var gives = cfg().items[best.kind].gives;
    Object.keys(gives).forEach(function (id) {
      OT.state.addStock(id, gives[id]);
      G.got[id] = (G.got[id] || 0) + gives[id];
    });
    G.items.splice(G.items.indexOf(best), 1);
    G.sparks.push({ x: best.x, y: best.y, t: 0 });
    OT.sfx.buy();
  }

  function loop(now) {
    if (!G) return;
    var dt = Math.min(0.05, (now - G.last) / 1000);
    G.last = now;
    G.time += dt;
    var c = cfg();
    G.timeBar.firstChild.style.width = Math.max(0, 100 - G.time / c.seconds * 100) + '%';
    G.spawnT -= dt;
    if (G.spawnT <= 0 && G.items.length < c.maxOnField && G.time < c.seconds - 1) {
      var kind = pick(), p = SPOTS[kind]();
      G.items.push({ kind: kind, x: p.x, y: p.y, t: 0, life: c.items[kind].life, hopT: 0.5 + Math.random() * 0.5, vx: 0, vy: 0, air: 0 });
      G.spawnT = 0.35 + Math.random() * 0.45;
    }
    G.items.forEach(function (it) {
      it.t += dt;
      if (c.items[it.kind].hop) {
        it.hopT -= dt;
        if (it.hopT <= 0 && it.air <= 0) { it.air = 0.45; it.vx = (Math.random() * 2 - 1) * 60; it.hopT = 0.6 + Math.random() * 0.6; }
        if (it.air > 0) { it.air -= dt; it.x += it.vx * dt; it.x = Math.max(8, Math.min(W - 8, it.x)); }
      }
    });
    G.items = G.items.filter(function (it) { return it.t < it.life; });
    G.sparks.forEach(function (s) { s.t += dt; });
    G.sparks = G.sparks.filter(function (s) { return s.t < 0.5; });
    draw();
    var html = Object.keys(G.got).map(function (id) { return OT.ingName(id) + ' ×' + G.got[id]; }).join('　');
    if (G.logEl.textContent !== html) G.logEl.textContent = html;
    if (G.time >= c.seconds) { finish(); return; }
    G.raf = requestAnimationFrame(loop);
  }

  function draw() {
    var ctx = G.canvas.getContext('2d'), P = OT.PAL, t = G.time;
    if (OT.sprites.has('bg_forage')) { ctx.drawImage(OT.sprites.get('bg_forage'), 0, 0); drawItems(ctx, P, t); return; }
    ctx.fillStyle = P.warm1; ctx.fillRect(0, 0, W, 30);
    // 山
    ctx.fillStyle = P.green3;
    for (var x = 0; x < W; x++) { var h = 10 + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.13) * 3; ctx.fillRect(x, 30 - h, 1, h + 4); }
    // 木（蜂の巣が下がる）
    [28, 96, 164].forEach(function (tx) {
      ctx.fillStyle = P.brown1; ctx.fillRect(tx - 2, 34, 4, 22);
      ctx.fillStyle = P.green2; ctx.fillRect(tx - 12, 18, 24, 18); ctx.fillStyle = P.green1; ctx.fillRect(tx - 10, 18, 12, 4);
    });
    // あぜ道とやぶ
    ctx.fillStyle = P.brown4; ctx.fillRect(0, 56, W, 12);
    // 田んぼ（稲）
    ctx.fillStyle = P.corn; ctx.fillRect(0, 68, W, H - 68);
    ctx.fillStyle = P.brown4;
    for (var i = 0; i < 90; i++) ctx.fillRect((i * 29) % W, 70 + (i * 17) % (H - 72), 1, 3);
    // 水辺
    ctx.fillStyle = P.ind1; ctx.fillRect(110, 100, W - 110, H - 100);
    ctx.fillStyle = P.ind2; for (var w = 0; w < 6; w++) ctx.fillRect(115 + ((w * 19 + t * 8) % 70), 106 + (w * 5) % 18, 5, 1);
    // 生き物・食材
    G.items.forEach(function (it) {
      var left = it.life - it.t, blink = left < 0.6 && Math.floor(t * 12) % 2 === 0;
      if (blink) return;
      var y = it.y - (it.air > 0 ? Math.sin((0.45 - it.air) / 0.45 * Math.PI) * 10 : 0);
      OT.art.drawForage(ctx, it.kind, Math.round(it.x), Math.round(y), t);
    });
    G.sparks.forEach(function (s) {
      ctx.fillStyle = P.warm1;
      var r = 3 + s.t * 16;
      for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2; ctx.fillRect(Math.round(s.x + Math.cos(a) * r), Math.round(s.y + Math.sin(a) * r), 2, 2); }
    });
  }

  function drawItems(ctx, P, t) {
    G.items.forEach(function (it) {
      var left = it.life - it.t;
      if (left < 0.6 && Math.floor(t * 12) % 2 === 0) return;
      var y = it.y - (it.air > 0 ? Math.sin((0.45 - it.air) / 0.45 * Math.PI) * 10 : 0);
      var sp = OT.sprites.get('cr_forage_' + it.kind);
      if (sp && sp.complete && sp.naturalWidth) ctx.drawImage(sp, Math.round(it.x - 12), Math.round(y - 12));
      else OT.art.drawForage(ctx, it.kind, Math.round(it.x), Math.round(y), t);
    });
    G.sparks.forEach(function (s) {
      ctx.fillStyle = P.warm1;
      var r = 3 + s.t * 16;
      for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2; ctx.fillRect(Math.round(s.x + Math.cos(a) * r), Math.round(s.y + Math.sin(a) * r), 2, 2); }
    });
  }

  function finish() {
    var root = G.root, got = G.got;
    root.innerHTML = '';
    root.appendChild(OT.ui.hud());
    root.appendChild(OT.el('h2', { class: 'scr-title', text: OT.t('forage.result') }));
    var list = OT.el('ul', { class: 'auc-log big' });
    var keys = Object.keys(got);
    if (!keys.length) list.appendChild(OT.el('li', { text: OT.t('forage.none') }));
    keys.forEach(function (id) { list.appendChild(OT.el('li', { text: OT.ingName(id) + ' ×' + got[id] })); });
    root.appendChild(list);
    st().gamesToday += 1;
    OT.state.save();
    root.appendChild(OT.button(OT.t('auc.done'), function () { OT.forage.leave(); OT.flow.morning(); }, 'primary big'));
  }
})(window);
