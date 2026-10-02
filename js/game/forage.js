/*
 * 多幸寿：ミニゲーム「田んぼと里山の採集」（横から見た里山）
 *   田んぼの稲にとまるイナゴ・木の枝にさがる蜂の巣・あぜ道の奥の山椒のやぶ・池のマコモダケが出てくる。
 *   消える前にタップで捕る。何を捕ったかは、絵の下の4つの札に数で出る。
 *   数字は config.js の FORAGE。出る場所（SPOTS）は背景の絵（art/blender/landscapes.py の _forage）と同じ。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var W = 192, H = 128;
  var G = null;
  var KINDS = ['inago', 'hachi', 'sansho', 'makomo'];
  var NESTS = [[42, 50], [110, 46], [150, 50]];          // 枝の先（蜂の巣がさがる）
  var BUSHES = [12, 54, 74, 124, 140, 184];               // 山椒のやぶ（あぜ道の奥）

  function cfg() { return OT.CFG.FORAGE; }
  function st() { return OT.state.get(); }

  // 出てくる場所。同じ枝・同じやぶには1つだけ
  function used(kind, x, y) { return G.items.some(function (it) { return it.kind === kind && Math.abs(it.x - x) < 6 && Math.abs(it.y - y) < 6; }); }
  var SPOTS = {
    inago: function () { return { x: 10 + Math.random() * 98, y: 80 + Math.random() * 34 }; },
    hachi: function () {
      var free = NESTS.filter(function (p) { return !used('hachi', p[0], p[1]); });
      if (!free.length) return null;
      var p = free[Math.floor(Math.random() * free.length)];
      return { x: p[0], y: p[1] };
    },
    sansho: function () {
      var free = BUSHES.filter(function (x) { return !used('sansho', x, 52); });
      if (!free.length) return null;
      return { x: free[Math.floor(Math.random() * free.length)], y: 52 };
    },
    makomo: function () { return { x: 130 + Math.random() * 54, y: 100 + Math.random() * 14 }; }
  };

  function pick() {
    var items = cfg().items, keys = Object.keys(items), sum = 0;
    keys.forEach(function (k) { sum += items[k].weight; });
    var r = Math.random() * sum;
    for (var i = 0; i < keys.length; i++) { r -= items[keys[i]].weight; if (r <= 0) return keys[i]; }
    return keys[0];
  }

  function spriteOf(kind) {
    var sp = OT.sprites.get('cr_forage_' + kind);
    return sp && sp.complete && sp.naturalWidth ? sp : null;
  }

  OT.forage = {
    enter: function () {
      var root = OT.ui.screen('forage');
      root.innerHTML = '';
      G = { root: root, time: 0, items: [], got: {}, count: {}, spawnT: 0, sparks: [] };
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🌾 ' + OT.t('forage.title') }));
      G.intro = OT.el('div', { class: 'auc-intro' }, [
        OT.el('p', { text: OT.t('forage.howto') }),
        legend(true),
        OT.button(OT.t('forage.start'), start, 'primary big')
      ]);
      root.appendChild(G.intro);
    },
    leave: function () { if (G && G.raf) cancelAnimationFrame(G.raf); G = null; },
    _peek: function () { return G; }   // テスト用
  };

  /** 捕るもの4つの札（絵・名前・どこに出るか・捕った数） */
  function legend(intro) {
    var row = OT.el('div', { class: 'fg-legend' + (intro ? ' intro' : '') });
    KINDS.forEach(function (k) {
      var c = OT.ui.pixelCanvas(24, 32, 'fg-ico');
      var sp = spriteOf(k);
      if (sp) { var ctx = c.getContext('2d'); ctx.drawImage(sp, Math.round((24 - sp.width) / 2), Math.round((32 - sp.height) / 2)); }
      var chip = OT.el('div', { class: 'fg-chip', 'data-k': k }, [
        c,
        OT.el('b', { text: OT.t('forage.n.' + k) }),
        OT.el('span', { class: 'fg-where', text: OT.t('forage.w.' + k) }),
        intro ? null : OT.el('span', { class: 'fg-count', text: '×0' })
      ].filter(Boolean));
      row.appendChild(chip);
    });
    return row;
  }

  function start() {
    G.root.removeChild(G.intro);
    G.timeBar = OT.el('div', { class: 'auc-time' }, [OT.el('i')]);
    G.root.appendChild(G.timeBar);
    G.wrap = OT.el('div', { class: 'fg-wrap' });
    G.canvas = OT.ui.pixelCanvas(W, H, 'field-canvas');
    G.canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var r = G.canvas.getBoundingClientRect();
      tap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
    });
    G.wrap.appendChild(G.canvas);
    G.root.appendChild(G.wrap);
    G.legend = legend(false);
    G.root.appendChild(G.legend);
    G.last = performance.now();
    G.raf = requestAnimationFrame(loop);
  }

  function hitR(it) { var sp = spriteOf(it.kind); return sp ? Math.max(12, Math.max(sp.width, sp.height) / 2 + 3) : 14; }

  function tap(x, y) {
    var best = null, bestD = 1e9;
    G.items.forEach(function (it) {
      var d = Math.hypot(it.x - x, curY(it) - y);
      if (d < hitR(it) && d < bestD) { best = it; bestD = d; }
    });
    if (!best) { OT.sfx.tap(); return; }
    var gives = cfg().items[best.kind].gives;
    Object.keys(gives).forEach(function (id) {
      OT.state.addStock(id, gives[id]);
      G.got[id] = (G.got[id] || 0) + gives[id];
    });
    G.count[best.kind] = (G.count[best.kind] || 0) + 1;
    G.items.splice(G.items.indexOf(best), 1);
    G.sparks.push({ x: best.x, y: curY(best), t: 0 });
    popup(best);
    var chip = G.legend.querySelector('.fg-chip[data-k="' + best.kind + '"]');
    if (chip) {
      chip.querySelector('.fg-count').textContent = '×' + G.count[best.kind];
      chip.classList.remove('hit'); void chip.offsetWidth; chip.classList.add('hit');
    }
    OT.sfx.buy();
  }

  /** 捕ったものの名前が、その場所から浮かぶ */
  function popup(it) {
    var gives = cfg().items[it.kind].gives, id = Object.keys(gives)[0];
    var p = OT.el('span', { class: 'fg-pop', text: '+' + OT.ingName(id) + (gives[id] > 1 ? ' ×' + gives[id] : ''),
      style: 'left:' + (it.x / W * 100) + '%;top:' + (curY(it) / H * 100) + '%' });
    G.wrap.appendChild(p);
    setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 900);
  }

  /** 跳ねているイナゴは、そのぶん上に */
  function curY(it) { return it.y - (it.air > 0 ? Math.sin((0.45 - it.air) / 0.45 * Math.PI) * 12 : 0); }

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
      if (p) G.items.push({ kind: kind, x: p.x, y: p.y, t: 0, life: c.items[kind].life, hopT: 0.5 + Math.random() * 0.5, vx: 0, air: 0 });
      G.spawnT = 0.35 + Math.random() * 0.45;
    }
    G.items.forEach(function (it) {
      it.t += dt;
      if (c.items[it.kind].hop) {
        it.hopT -= dt;
        if (it.hopT <= 0 && it.air <= 0) { it.air = 0.45; it.vx = (Math.random() * 2 - 1) * 50; it.hopT = 0.6 + Math.random() * 0.6; }
        if (it.air > 0) { it.air -= dt; it.x += it.vx * dt; it.x = Math.max(10, Math.min(108, it.x)); }
      }
    });
    G.items = G.items.filter(function (it) { return it.t < it.life; });
    G.sparks.forEach(function (s) { s.t += dt; });
    G.sparks = G.sparks.filter(function (s) { return s.t < 0.5; });
    draw();
    if (G.time >= c.seconds) { finish(); return; }
    G.raf = requestAnimationFrame(loop);
  }

  function draw() {
    var ctx = G.canvas.getContext('2d'), P = OT.PAL, t = G.time;
    if (OT.sprites.has('bg_forage')) ctx.drawImage(OT.sprites.get('bg_forage'), 0, 0);
    else { ctx.fillStyle = P.green2; ctx.fillRect(0, 0, W, H); }
    G.items.forEach(function (it) {
      var left = it.life - it.t;
      if (left < 0.6 && Math.floor(t * 12) % 2 === 0) return;   // 消えそうなときは点滅
      var y = curY(it), sp = spriteOf(it.kind);
      // 出てきたところは、ぽんと大きく
      var s = it.t < 0.15 ? 0.5 + it.t / 0.15 * 0.5 : 1;
      if (sp) {
        var w = Math.round(sp.width * s), h = Math.round(sp.height * s);
        var flip = it.kind === 'inago' && it.vx > 0;
        ctx.save();
        ctx.translate(Math.round(it.x), Math.round(y));
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(sp, -Math.round(w / 2), -Math.round(h / 2), w, h);
        ctx.restore();
      } else OT.art.drawForage(ctx, it.kind, Math.round(it.x), Math.round(y), t);
      // 蜂の巣のまわりを飛ぶ蜂
      if (it.kind === 'hachi') {
        for (var b = 0; b < 2; b++) {
          var a = t * (5 + b) + b * 3;
          var bx = Math.round(it.x + Math.cos(a) * 12), by = Math.round(it.y + Math.sin(a * 1.3) * 8);
          ctx.fillStyle = P.warm1 || '#f4cc62'; ctx.fillRect(bx, by, 2, 2);
          ctx.fillStyle = '#1c1220'; ctx.fillRect(bx + 1, by, 1, 2);
        }
      }
      // 出てきたばかりのきらり
      if (it.t < 0.5) {
        ctx.fillStyle = '#fffaf0';
        var r = Math.round(8 + it.t * 10);
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (d) { ctx.fillRect(Math.round(it.x + d[0] * r), Math.round(y + d[1] * r), 2, 2); });
      }
    });
    G.sparks.forEach(function (s) {
      ctx.fillStyle = '#ffe6b0';
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
