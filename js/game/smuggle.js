/*
 * 多幸寿：ミニゲーム「長崎の抜け荷」（夜）
 *   押している間だけ歩いて、船から屋台の荷車まで荷を運ぶ。
 *   見回りの役人の提灯の明かりに入ると、止まっていても見つかる（評判が下がる）。
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

  function pickGood() {
    var c = cfg(), s = st();
    // 第5章で、まだトウモロコシの種がないなら、何回か運んだら必ず出す
    if (!s.flags.gotCorn && M.delivered >= c.cornGuaranteeAfter - 1 && OT.state.chapter() >= 5) return 'corn';
    var keys = Object.keys(c.goods), sum = 0;
    keys.forEach(function (k) { sum += c.goods[k].weight; });
    var r = Math.random() * sum;
    for (var i = 0; i < keys.length; i++) { r -= c.goods[keys[i]].weight; if (r <= 0) return keys[i]; }
    return keys[0];
  }

  OT.smuggle = {
    enter: function () {
      var root = OT.ui.screen('smuggle');
      root.innerHTML = '';
      M = { root: root, time: 0, x: SHIP_X, got: {}, delivered: 0, caught: 0, spot: 0, hold: false, flash: 0 };
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🏮 ' + OT.t('smug.title') }));
      M.intro = OT.el('div', { class: 'auc-intro' }, [
        OT.el('p', { text: OT.t('smug.howto') }),
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
    // 見回りの役人：明かりが道を横切るように上下に動く
    M.guards = [];
    var n = cfg().lanterns;
    for (var i = 0; i < n; i++) {
      M.guards.push({ x: CART_X + 30 + (SHIP_X - CART_X - 60) * (i / Math.max(1, n - 1)), w: 1.1 + Math.random() * 0.9, ph: Math.random() * Math.PI * 2, r: 13 });
    }
    M.last = performance.now();
    M.raf = requestAnimationFrame(loop);
  }

  function say(msg, cls) { M.msg.textContent = msg; M.msg.className = 'hunt-msg show ' + (cls || ''); clearTimeout(M.mt); M.mt = setTimeout(function () { if (M) M.msg.className = 'hunt-msg'; }, 1100); }

  function lightPos(g) { return { x: g.x + Math.sin(M.time * g.w * 0.6 + g.ph) * 10, y: PATH_Y - 26 + Math.sin(M.time * g.w + g.ph) * 34 }; }

  function loop(now) {
    if (!M) return;
    var dt = Math.min(0.05, (now - M.last) / 1000);
    M.last = now;
    M.time += dt;
    var c = cfg();
    M.timeBar.firstChild.style.width = Math.max(0, 100 - M.time / c.seconds * 100) + '%';
    if (M.flash > 0) M.flash -= dt;
    else {
      if (holding()) M.x -= c.walkSpeed * dt;
      // 明かりの中にいるか
      var lit = M.guards.some(function (g) { var L = lightPos(g); return Math.hypot(L.x - M.x, L.y - PATH_Y) < g.r; });
      M.spot = lit ? M.spot + dt : Math.max(0, M.spot - dt * 2);
      if (M.spot >= c.spotTime) {
        M.caught++;
        st().rep = Math.max(0, st().rep + c.caughtRep);
        M.x = SHIP_X; M.spot = 0; M.flash = 1.0;
        OT.sfx.angry();
        say(OT.t('smug.caught'), 'bad');
      } else if (M.x <= CART_X) {
        var good = pickGood(), n = c.goods[good].n;
        OT.state.addStock(good, n);
        if (good === 'corn') st().flags.gotCorn = 1;
        M.got[good] = (M.got[good] || 0) + n;
        M.delivered++;
        M.x = SHIP_X;
        OT.sfx.buy();
        say(OT.t('smug.got', { name: OT.ingName(good), n: n }));
      }
    }
    draw();
    var html = Object.keys(M.got).map(function (id) { return OT.ingName(id) + ' ×' + M.got[id]; }).join('　');
    if (M.logEl.textContent !== html) M.logEl.textContent = html;
    if (M.time >= c.seconds) { finish(); return; }
    M.raf = requestAnimationFrame(loop);
  }

  function draw() {
    var ctx = M.canvas.getContext('2d'), P = OT.PAL, t = M.time;
    ctx.fillStyle = P.ind5; ctx.fillRect(0, 0, W, H);
    // 海と出島の影
    ctx.fillStyle = P.ind4; ctx.fillRect(0, 60, W, 30);
    ctx.fillStyle = P.ind3; for (var w = 0; w < 10; w++) ctx.fillRect((w * 31 + t * 6) % W, 66 + (w * 7) % 20, 5, 1);
    ctx.fillStyle = P.night2; ctx.fillRect(40, 44, 70, 16); ctx.fillRect(56, 36, 30, 8);
    // 船
    ctx.fillStyle = P.brown1; ctx.fillRect(SHIP_X - 12, 78, 30, 8); ctx.fillStyle = P.gray2; ctx.fillRect(SHIP_X, 56, 2, 22); ctx.fillStyle = P.white2; ctx.fillRect(SHIP_X - 8, 58, 10, 14);
    // 道（石畳）と荷車
    ctx.fillStyle = P.night1; ctx.fillRect(0, PATH_Y - 6, W, 20);
    ctx.fillStyle = P.night2; for (var s = 0; s < W; s += 9) ctx.fillRect(s, PATH_Y - 6 + (s % 2) * 8, 8, 1);
    ctx.fillStyle = P.brown2; ctx.fillRect(CART_X - 12, PATH_Y - 10, 18, 8); ctx.fillStyle = P.char; ctx.fillRect(CART_X - 10, PATH_Y - 2, 4, 4); ctx.fillRect(CART_X + 0, PATH_Y - 2, 4, 4);
    // 樽（かくれる場所の目印）
    ctx.fillStyle = P.brown3; [60, 108, 150].forEach(function (bx) { ctx.fillRect(bx, PATH_Y - 16, 7, 9); });
    // 提灯の明かり
    M.guards.forEach(function (g) {
      var L = lightPos(g);
      var grad = ctx.createRadialGradient(L.x, L.y, 2, L.x, L.y, g.r + 3);
      grad.addColorStop(0, 'rgba(255,220,140,0.75)'); grad.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = grad; ctx.fillRect(L.x - g.r - 4, L.y - g.r - 4, g.r * 2 + 8, g.r * 2 + 8);
      // 役人と提灯
      ctx.fillStyle = P.ind2; ctx.fillRect(g.x - 3, 40, 6, 12); ctx.fillStyle = '#f0c8a0'; ctx.fillRect(g.x - 2, 35, 5, 5);
      ctx.fillStyle = P.red1; ctx.fillRect(g.x + 4, 44, 4, 6);
    });
    // マテオ（仮）と荷
    var x = Math.round(M.x), bob = holding() && M.flash <= 0 ? Math.round(Math.sin(t * 16)) : 0;
    if (M.flash <= 0 || Math.floor(t * 12) % 2) {
      ctx.fillStyle = P.red2; ctx.fillRect(x - 3, PATH_Y - 12 + bob, 6, 10);
      ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x - 3, PATH_Y - 18 + bob, 6, 6);
      ctx.fillStyle = P.brown4; ctx.fillRect(x - 5, PATH_Y - 24 + bob, 10, 6);   // 背負った荷
      if (M.spot > 0) { ctx.fillStyle = P.red1; ctx.fillRect(x - 1, PATH_Y - 32, 2, 5); ctx.fillRect(x - 1, PATH_Y - 26, 2, 1); }   // ！
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
    if (caught) list.appendChild(OT.el('li', { class: 'bad', text: OT.t('smug.caughtN', { n: caught, rep: -cfg().caughtRep * caught }) }));
    root.appendChild(list);
    st().gamesToday += 1;
    OT.state.save();
    root.appendChild(OT.button(OT.t('auc.done'), function () { OT.smuggle.leave(); OT.flow.morning(); }, 'primary big'));
  }
})(window);
