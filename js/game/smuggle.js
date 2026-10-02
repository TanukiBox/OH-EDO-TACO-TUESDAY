/*
 * 多幸寿：ミニゲーム「長崎の抜け荷」（夜）
 *   今夜の船の荷（何が何人前か）は、はじめに見える。運ぶ荷を1つえらび、押している間だけ歩いて
 *   船から左の荷車まで運ぶ。重い荷は遅く、軽い荷は速い。
 *   見回りの役人の提灯の明かりに入ると、止まっていても見つかる。見つかったら荷は船にもどり、
 *   マテオも船まで逃げもどる（評判は下がらない）。決まった回数見つかると、その夜はおしまい。
 *   数字は config.js の SMUGGLE。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var W = 192, H = 128, PATH_Y = 100, SHIP_X = 172, CART_X = 22;
  var M = null;

  function cfg() { return OT.CFG.SMUGGLE; }
  function st() { return OT.state.get(); }
  function holding() { return M.hold || (OT.input && OT.input.down); }

  /** 今夜の船の荷：重みつきで、ちがう品を cfg().crates 個 */
  function makeManifest() {
    var c = cfg(), s = st(), keys = Object.keys(c.goods), list = [];
    // 第5章で、まだトウモロコシの種がないなら、船の荷に必ず入る
    if (!s.flags.gotCorn && OT.state.chapter() >= 5 && c.goods.corn) { list.push('corn'); keys = keys.filter(function (k) { return k !== 'corn'; }); }
    while (list.length < c.crates && keys.length) {
      var sum = 0;
      keys.forEach(function (k) { sum += c.goods[k].weight; });
      var r = Math.random() * sum, pick = keys[keys.length - 1];
      for (var i = 0; i < keys.length; i++) { r -= c.goods[keys[i]].weight; if (r <= 0) { pick = keys[i]; break; } }
      list.push(pick);
      keys.splice(keys.indexOf(pick), 1);
    }
    return list.map(function (id) { var g = c.goods[id]; return { id: id, n: g.n, load: g.heavy ? 'heavy' : g.light ? 'light' : '' }; });
  }

  var iconCache = {};
  function iconOf(id) {
    if (!iconCache[id]) { var c = document.createElement('canvas'); OT.art.drawIcon(c, id); iconCache[id] = c; }
    return iconCache[id];
  }

  function speedOf(crate) {
    var c = cfg();
    return c.walkSpeed * (!crate ? 1 : crate.load === 'heavy' ? c.heavySpeed : crate.load === 'light' ? c.lightSpeed : 1);
  }

  function crateChip(crate, i, onTap) {
    var icon = OT.ui.pixelCanvas(24, 24, 'chip-icon');
    OT.art.drawIcon(icon, crate.id);
    return OT.el('button', { class: 'smug-crate' + (crate.load ? ' ' + crate.load : ''), 'data-i': i, onclick: onTap }, [
      icon,
      OT.el('span', { class: 'smug-name', text: OT.ingName(crate.id) + ' ×' + crate.n }),
      crate.load ? OT.el('span', { class: 'smug-load', text: OT.t('smug.' + crate.load) }) : null
    ]);
  }

  OT.smuggle = {
    enter: function () {
      var root = OT.ui.screen('smuggle');
      root.innerHTML = '';
      M = { root: root, time: 0, x: SHIP_X, got: {}, delivered: 0, caught: 0, spot: 0, hold: false, flash: 0, sel: 0, carry: null };
      M.crates = makeManifest();
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🏮 ' + OT.t('smug.title') }));
      var list = OT.el('div', { class: 'smug-crates intro' });
      M.crates.forEach(function (cr, i) { list.appendChild(crateChip(cr, i, function () {})); });
      M.intro = OT.el('div', { class: 'auc-intro' }, [
        OT.el('p', { text: OT.t('smug.howto', { n: cfg().caughtLimit }) }),
        OT.el('h3', { class: 'smug-head', text: OT.t('smug.manifest') }),
        list,
        OT.button(OT.t('smug.start'), start, 'primary big')
      ]);
      root.appendChild(M.intro);
    },
    leave: function () { if (M && M.raf) cancelAnimationFrame(M.raf); M = null; }
  };

  function start() {
    M.root.removeChild(M.intro);
    M.timeBar = OT.el('div', { class: 'auc-time' }, [OT.el('i')]);
    M.root.appendChild(M.timeBar);
    M.canvas = OT.ui.pixelCanvas(W, H, 'field-canvas night-canvas');
    M.canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); M.hold = true; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { M.canvas.addEventListener(ev, function () { if (M) M.hold = false; }); });
    M.root.appendChild(M.canvas);
    M.msg = OT.el('div', { class: 'hunt-msg' });
    M.root.appendChild(M.msg);
    M.logEl = OT.el('div', { class: 'forage-log' });
    M.root.appendChild(M.logEl);
    M.help = OT.el('p', { class: 'smug-help' });
    M.root.appendChild(M.help);
    M.row = OT.el('div', { class: 'smug-crates' });
    M.root.appendChild(M.row);
    renderCrates();
    // 見回りの役人：明かりが道を横切るように上下に動く
    M.guards = [];
    var n = cfg().lanterns;
    for (var i = 0; i < n; i++) {
      M.guards.push({ x: CART_X + 30 + (SHIP_X - CART_X - 60) * (i / Math.max(1, n - 1)), w: 1.1 + Math.random() * 0.9, ph: Math.random() * Math.PI * 2, r: 13 });
    }
    M.last = performance.now();
    M.raf = requestAnimationFrame(loop);
  }

  /** 船に残っている荷（タップで、次に運ぶ荷をえらぶ） */
  function renderCrates() {
    M.row.innerHTML = '';
    M.crates.forEach(function (cr, i) {
      var chip = crateChip(cr, i, function () {
        if (M.carry) { OT.sfx.denied(); say(OT.t('smug.atShip')); return; }
        OT.sfx.tap();
        M.sel = i;
        renderCrates();
      });
      if (i === M.sel && !M.carry) chip.classList.add('on');
      if (M.carry && M.carry === cr) chip.classList.add('carry');
      M.row.appendChild(chip);
    });
  }

  function say(msg, cls) { M.msg.textContent = msg; M.msg.className = 'hunt-msg show ' + (cls || ''); clearTimeout(M.mt); M.mt = setTimeout(function () { if (M) M.msg.className = 'hunt-msg'; }, 1300); }

  function lightPos(g) { return { x: g.x + Math.sin(M.time * g.w * 0.6 + g.ph) * 10, y: PATH_Y - 26 + Math.sin(M.time * g.w + g.ph) * 34 }; }

  function backToShip() {
    M.x = SHIP_X; M.spot = 0; M.carry = null;
    M.sel = Math.min(M.sel, M.crates.length - 1);
    renderCrates();
  }

  function loop(now) {
    if (!M) return;
    var dt = Math.min(0.05, (now - M.last) / 1000);
    M.last = now;
    M.time += dt;
    var c = cfg();
    M.timeBar.firstChild.style.width = Math.max(0, 100 - M.time / c.seconds * 100) + '%';
    if (M.flash > 0) M.flash -= dt;
    else {
      if (holding()) {
        // 船で荷を背負ってから歩きだす
        if (!M.carry) { M.carry = M.crates[M.sel]; renderCrates(); }
        M.x -= speedOf(M.carry) * dt;
      }
      // 明かりの中にいるか
      var lit = M.carry && M.guards.some(function (g) { var L = lightPos(g); return Math.hypot(L.x - M.x, L.y - PATH_Y) < g.r; });
      M.spot = lit ? M.spot + dt : Math.max(0, M.spot - dt * 2);
      if (M.spot >= c.spotTime) {
        // 見つかった：荷は船にもどり、マテオも船まで逃げる
        M.caught++;
        if (c.caughtRep) st().rep = Math.max(0, st().rep + c.caughtRep);
        M.flash = 1.0;
        OT.sfx.angry();
        backToShip();
        if (M.caught >= c.caughtLimit) { say(OT.t('smug.limit'), 'bad'); M.end = 1.2; }
        else say(OT.t('smug.caught', { n: c.caughtLimit - M.caught }), 'bad');
      } else if (M.carry && M.x <= CART_X) {
        var cr = M.carry;
        OT.state.addStock(cr.id, cr.n);
        if (cr.id === 'corn') st().flags.gotCorn = 1;
        M.got[cr.id] = (M.got[cr.id] || 0) + cr.n;
        M.delivered++;
        M.crates.splice(M.crates.indexOf(cr), 1);
        OT.sfx.buy();
        say(OT.t('smug.got', { name: OT.ingName(cr.id), n: cr.n }));
        backToShip();
        if (!M.crates.length) { say(OT.t('smug.allDone')); M.end = 1.2; }
      }
    }
    M.help.textContent = M.carry ? OT.t('smug.walk') : M.crates.length ? OT.t('smug.pick', { name: OT.ingName(M.crates[M.sel].id) }) : '';
    draw();
    var html = Object.keys(M.got).map(function (id) { return OT.ingName(id) + ' ×' + M.got[id]; }).join('　');
    if (M.logEl.textContent !== html) M.logEl.textContent = html;
    if (M.end !== undefined) { M.end -= dt; if (M.end <= 0) { finish(); return; } }
    else if (M.time >= c.seconds) { finish(); return; }
    M.raf = requestAnimationFrame(loop);
  }

  function draw() {
    var ctx = M.canvas.getContext('2d'), P = OT.PAL, t = M.time;
    if (OT.sprites.has('bg_smuggle')) ctx.drawImage(OT.sprites.get('bg_smuggle'), 0, 0);
    else {
      ctx.fillStyle = P.ind5; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = P.night1; ctx.fillRect(0, PATH_Y - 6, W, 20);
      ctx.fillStyle = P.brown1; ctx.fillRect(SHIP_X - 12, 78, 30, 8);
      ctx.fillStyle = P.brown2; ctx.fillRect(CART_X - 12, PATH_Y - 10, 18, 8);
    }
    // 提灯の明かりと役人
    M.guards.forEach(function (g) {
      var L = lightPos(g);
      var grad = ctx.createRadialGradient(L.x, L.y, 2, L.x, L.y, g.r + 3);
      grad.addColorStop(0, 'rgba(255,220,140,0.75)'); grad.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = grad; ctx.fillRect(L.x - g.r - 4, L.y - g.r - 4, g.r * 2 + 8, g.r * 2 + 8);
      var gd = OT.sprites.get('people_mini_guard');
      if (gd && gd.complete && gd.naturalWidth) ctx.drawImage(gd, (Math.floor(t * 4) % 4) * 24, 0, 24, 30, Math.round(g.x - 12), 26, 24, 30);
      ctx.fillStyle = P.red1; ctx.fillRect(Math.round(g.x - 10), 44, 4, 6);
    });
    // 船に残っている荷（小さな箱）
    M.crates.forEach(function (cr, i) {
      if (cr === M.carry) return;
      ctx.fillStyle = P.brown2; ctx.fillRect(SHIP_X - 14 + (i % 3) * 7, 72 - Math.floor(i / 3) * 6, 6, 5);
      ctx.fillStyle = P.brown3; ctx.fillRect(SHIP_X - 14 + (i % 3) * 7, 72 - Math.floor(i / 3) * 6, 6, 1);
    });
    // マテオ（絵は左向き＝荷車のほうを向く）と、背負った荷
    var x = Math.round(M.x), moving = holding() && M.flash <= 0;
    if (M.flash <= 0 || Math.floor(t * 12) % 2) {
      var mm = OT.sprites.get('people_mini_mateo');
      if (mm && mm.complete && mm.naturalWidth) ctx.drawImage(mm, (moving ? Math.floor(t * 8) % 4 : 0) * 24, 0, 24, 30, x - 12, PATH_Y - 30, 24, 30);
      if (M.carry) {
        var heavy = M.carry.load === 'heavy';
        ctx.fillStyle = P.brown2; ctx.fillRect(x + 1, PATH_Y - (heavy ? 32 : 30), heavy ? 12 : 10, heavy ? 10 : 8);
        ctx.fillStyle = P.brown3; ctx.fillRect(x + 1, PATH_Y - (heavy ? 32 : 30), heavy ? 12 : 10, 2);
        var icon = iconOf(M.carry.id);   // 何を運んでいるか（食材の絵を半分の大きさで）
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(icon, 0, 0, icon.width, icon.height, x - 1, PATH_Y - (heavy ? 47 : 45), 16, 16);
      }
      if (M.spot > 0) { ctx.fillStyle = P.red1; ctx.fillRect(x - 6, PATH_Y - 44, 2, 5); ctx.fillRect(x - 6, PATH_Y - 38, 2, 1); }   // ！
    }
  }

  function finish() {
    var root = M.root, got = M.got, caught = M.caught;
    root.innerHTML = '';
    root.appendChild(OT.ui.hud());
    root.appendChild(OT.el('h2', { class: 'scr-title', text: OT.t('smug.result') }));
    var list = OT.el('ul', { class: 'auc-log big' });
    var keys = Object.keys(got);
    if (!keys.length) list.appendChild(OT.el('li', { text: OT.t('smug.none') }));
    keys.forEach(function (id) { list.appendChild(OT.el('li', { text: OT.ingName(id) + ' ×' + got[id] })); });
    if (caught) list.appendChild(OT.el('li', { class: 'bad', text: OT.t('smug.caughtN', { n: caught }) + (cfg().caughtRep ? ' ' + OT.t('smug.caughtRep', { rep: -cfg().caughtRep * caught }) : '') }));
    root.appendChild(list);
    st().gamesToday += 1;
    OT.state.save();
    root.appendChild(OT.button(OT.t('auc.done'), function () { OT.smuggle.leave(); OT.flow.morning(); }, 'primary big'));
  }
})(window);
