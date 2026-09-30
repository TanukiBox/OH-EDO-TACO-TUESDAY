/*
 * 多幸寿：ミニゲーム「山の追い込み」
 *   猟師の熊蔵といっしょに、スワイプで猪や鹿を上の罠の柵へ追い込む。
 *   スワイプした線の近くにいる獲物が、スワイプの向きに押される。数字は config.js の HUNT。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var W = 192, H = 128;
  var TRAP = { x0: 78, x1: 114, y0: 6, y1: 22 };
  var K = null;

  function cfg() { return OT.CFG.HUNT; }
  function st() { return OT.state.get(); }

  function pick() {
    var c = cfg();
    if (Math.random() < c.nushiChance) return 'nushi';
    var keys = Object.keys(c.animals).filter(function (k) { return c.animals[k].weight > 0; }), sum = 0;
    keys.forEach(function (k) { sum += c.animals[k].weight; });
    var r = Math.random() * sum;
    for (var i = 0; i < keys.length; i++) { r -= c.animals[keys[i]].weight; if (r <= 0) return keys[i]; }
    return keys[0];
  }

  OT.hunt = {
    enter: function () {
      var root = OT.ui.screen('hunt');
      root.innerHTML = '';
      K = { root: root, time: 0, animal: null, caught: [], trail: [], spawnT: 0, nushi: false };
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🐗 ' + OT.t('hunt.title') }));
      K.intro = OT.el('div', { class: 'auc-intro' }, [
        OT.el('p', { text: OT.t('hunt.howto') }),
        OT.button(OT.t('hunt.start'), start, 'primary big')
      ]);
      root.appendChild(K.intro);
    },
    leave: function () { if (K && K.raf) cancelAnimationFrame(K.raf); K = null; }
  };

  function start() {
    K.root.removeChild(K.intro);
    K.timeBar = OT.el('div', { class: 'auc-time' }, [OT.el('i')]);
    K.root.appendChild(K.timeBar);
    K.canvas = OT.ui.pixelCanvas(W, H, 'field-canvas hunt-canvas');
    var drag = null;
    function pos(e) { var r = K.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
    K.canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); drag = [pos(e)]; K.canvas.setPointerCapture && K.canvas.setPointerCapture(e.pointerId); });
    K.canvas.addEventListener('pointermove', function (e) { if (drag) { drag.push(pos(e)); K.trail.push({ p: pos(e), t: 0 }); } });
    function up(e) {
      if (!drag) return;
      var a = drag[0], b = pos(e);
      drag = null;
      swipe(a, b);
    }
    K.canvas.addEventListener('pointerup', up);
    K.canvas.addEventListener('pointercancel', function () { drag = null; });
    K.root.appendChild(K.canvas);
    K.msg = OT.el('div', { class: 'hunt-msg' });
    K.root.appendChild(K.msg);
    K.logEl = OT.el('div', { class: 'forage-log' });
    K.root.appendChild(K.logEl);
    spawn();
    K.last = performance.now();
    K.raf = requestAnimationFrame(loop);
  }

  function spawn() {
    var kind = pick(), info = cfg().animals[kind];
    var a = Math.random() * Math.PI * 2;
    K.animal = { kind: kind, info: info, x: 30 + Math.random() * 130, y: 100 + Math.random() * 16,
      vx: Math.cos(a) * info.speed, vy: -Math.abs(Math.sin(a)) * info.speed * 0.3, turn: 1 + Math.random(), boost: 0 };
    if (kind === 'nushi') say(OT.t('hunt.nushiAppear'));
  }

  function say(msg) { K.msg.textContent = msg; K.msg.className = 'hunt-msg show'; clearTimeout(K.mt); K.mt = setTimeout(function () { if (K) K.msg.className = 'hunt-msg'; }, 1100); }

  /** スワイプ：線の近くの獲物を、スワイプの向きに押す */
  function swipe(a, b) {
    var an = K.animal;
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (!an || len < 8) return;
    // 線分と獲物の距離
    var t = Math.max(0, Math.min(1, ((an.x - a.x) * dx + (an.y - a.y) * dy) / (len * len)));
    var px = a.x + dx * t, py = a.y + dy * t;
    var d = Math.hypot(an.x - px, an.y - py);
    OT.sfx.tap();
    if (d > cfg().reach) return;
    var heavy = an.info.heavy || 1;
    an.vx = dx / len * cfg().push / heavy;
    an.vy = dy / len * cfg().push / heavy;
    an.boost = 0.6;
    say(OT.say('hunt.shout'));
    OT.sfx.place();
  }

  function loop(now) {
    if (!K) return;
    var dt = Math.min(0.05, (now - K.last) / 1000);
    K.last = now;
    K.time += dt;
    var c = cfg();
    K.timeBar.firstChild.style.width = Math.max(0, 100 - K.time / c.seconds * 100) + '%';
    var an = K.animal;
    if (an) {
      an.turn -= dt;
      if (an.boost > 0) {
        an.boost -= dt;
        an.vx *= Math.pow(0.35, dt); an.vy *= Math.pow(0.35, dt);
      } else if (an.turn <= 0) {
        // 気ままにうろつく（罠から逃げるように、少し下向きに）
        var ang = Math.random() * Math.PI * 2;
        an.vx = Math.cos(ang) * an.info.speed;
        an.vy = Math.sin(ang) * an.info.speed * 0.8 + an.info.speed * 0.25;
        an.turn = 0.8 + Math.random() * 1.2;
      }
      an.x += an.vx * dt; an.y += an.vy * dt;
      if (an.x < 8) { an.x = 8; an.vx = Math.abs(an.vx); }
      if (an.x > W - 8) { an.x = W - 8; an.vx = -Math.abs(an.vx); }
      if (an.y > H - 8) { an.y = H - 8; an.vy = -Math.abs(an.vy); }
      // 罠の柵に入ったら、つかまえた
      if (an.y < TRAP.y1 + 4 && an.x > TRAP.x0 && an.x < TRAP.x1) {
        catchIt(an);
      } else if (an.y < 26) { an.y = 26; an.vy = Math.abs(an.vy) * 0.5; }   // 柵の外の崖
    } else {
      K.spawnT -= dt;
      if (K.spawnT <= 0 && K.time < c.seconds - 2) spawn();
    }
    K.trail.forEach(function (tr) { tr.t += dt; });
    K.trail = K.trail.filter(function (tr) { return tr.t < 0.35; });
    draw();
    var html = K.caught.map(function (k) { return OT.t('hunt.' + k); }).join('　');
    if (K.logEl.textContent !== html) K.logEl.textContent = html;
    if (K.time >= c.seconds) { finish(); return; }
    K.raf = requestAnimationFrame(loop);
  }

  function catchIt(an) {
    Object.keys(an.info.gives).forEach(function (id) { OT.state.addStock(id, an.info.gives[id]); });
    K.caught.push(an.kind);
    if (an.kind === 'nushi') { K.nushi = true; OT.fx.nushi(OT.t('hunt.nushi')); }
    K.animal = null;
    K.spawnT = 0.9;
    OT.sfx.buy();
    say(OT.t('hunt.caught', { name: OT.t('hunt.' + an.kind) }));
  }

  function draw() {
    var ctx = K.canvas.getContext('2d'), P = OT.PAL, t = K.time;
    if (OT.sprites.has('bg_hunt')) {
      ctx.drawImage(OT.sprites.get('bg_hunt'), 0, 0);
      var an0 = K.animal;
      if (an0) {
        var sp = OT.sprites.get('cr_animal_' + (an0.kind === 'boar' ? 'boar' : an0.kind) + '_' + (Math.floor(t * 8) % 2));
        if (sp && sp.complete && sp.naturalWidth) {
          ctx.save();
          ctx.translate(Math.round(an0.x), Math.round(an0.y));
          if (an0.vx > 0) ctx.scale(-1, 1);
          ctx.drawImage(sp, -Math.round(sp.width / 2), -Math.round(sp.height / 2));
          ctx.restore();
        }
      }
      ctx.fillStyle = 'rgba(255,230,176,0.8)';
      K.trail.forEach(function (tr) { ctx.fillRect(Math.round(tr.p.x) - 1, Math.round(tr.p.y) - 1, 2, 2); });
      return;
    }
    ctx.fillStyle = P.green2; ctx.fillRect(0, 0, W, H);
    // 木々
    for (var i = 0; i < 18; i++) {
      var tx = (i * 53) % W, ty = 8 + (i * 29) % 20;
      if (tx > TRAP.x0 - 10 && tx < TRAP.x1 + 10 && ty < 30) continue;
      ctx.fillStyle = P.green3; ctx.fillRect(tx - 6, ty - 6, 12, 12);
      ctx.fillStyle = P.green1; ctx.fillRect(tx - 4, ty - 6, 5, 3);
    }
    ctx.fillStyle = P.green1;
    for (var g = 0; g < 70; g++) ctx.fillRect((g * 37) % W, 30 + (g * 23) % (H - 30), 1, 2);
    // 罠の柵
    ctx.fillStyle = P.brown2;
    for (var f = TRAP.x0 - 6; f <= TRAP.x1 + 6; f += 4) { if (f > TRAP.x0 && f < TRAP.x1) continue; ctx.fillRect(f, TRAP.y0, 2, TRAP.y1 - TRAP.y0 + 6); }
    ctx.fillRect(TRAP.x0 - 6, TRAP.y0, TRAP.x1 - TRAP.x0 + 14, 2);
    ctx.fillStyle = P.brown4; ctx.fillRect(TRAP.x0, TRAP.y0 + 4, TRAP.x1 - TRAP.x0, TRAP.y1 - TRAP.y0);
    ctx.fillStyle = P.warm1; for (var ar = 0; ar < 3; ar++) ctx.fillRect(94 + ar * 2 - 2, 28 + ar * 2, 8 - ar * 4 + 4, 1);   // ↑ の目印
    // 熊蔵（仮）
    ctx.fillStyle = P.brown1; ctx.fillRect(10, H - 22, 10, 14); ctx.fillStyle = '#f0c8a0'; ctx.fillRect(11, H - 29, 8, 7); ctx.fillStyle = P.char; ctx.fillRect(10, H - 30, 10, 2);
    // 獲物
    var an = K.animal;
    if (an) {
      var big = an.kind === 'nushi' ? 2 : 1, dir = an.vx >= 0 ? 1 : -1;
      var bw = (an.kind === 'deer' ? 10 : 12) * big, bh = (an.kind === 'deer' ? 6 : 7) * big;
      var body = an.kind === 'deer' ? P.brown3 : an.kind === 'nushi' ? P.char : P.brown1;
      var x = Math.round(an.x), y = Math.round(an.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - bw / 2, y + bh / 2, bw, 2);
      ctx.fillStyle = body; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
      ctx.fillRect(x + dir * bw / 2 - (dir < 0 ? 4 * big : 0), y - bh / 2 - 1, 4 * big, 4 * big);
      var leg = Math.round(Math.sin(t * 20) * 1);
      ctx.fillRect(x - bw / 2 + 1, y + bh / 2, 2, 3 + leg); ctx.fillRect(x + bw / 2 - 3, y + bh / 2, 2, 3 - leg);
      if (an.kind === 'deer') { ctx.fillStyle = P.brown1; ctx.fillRect(x + dir * (bw / 2 + 1), y - bh / 2 - 5, 1, 4); ctx.fillStyle = P.white; ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 2, y - 2, 1, 1); }
      else { ctx.fillStyle = P.white2; ctx.fillRect(x + dir * (bw / 2 + 3 * big), y - 1, 1 * big, 2 * big); }   // 牙
      ctx.fillStyle = P.outline; ctx.fillRect(x + dir * (bw / 2 + 1 * big), y - bh / 2, 1, 1);
    }
    // スワイプの跡
    ctx.fillStyle = 'rgba(255,230,176,0.8)';
    K.trail.forEach(function (tr) { ctx.fillRect(Math.round(tr.p.x) - 1, Math.round(tr.p.y) - 1, 2, 2); });
  }

  function finish() {
    var root = K.root, caught = K.caught, nushi = K.nushi;
    root.innerHTML = '';
    root.appendChild(OT.ui.hud());
    root.appendChild(OT.el('h2', { class: 'scr-title', text: OT.t('hunt.result') }));
    var list = OT.el('ul', { class: 'auc-log big' });
    if (!caught.length) list.appendChild(OT.el('li', { text: OT.t('hunt.none') }));
    caught.forEach(function (k) {
      var gives = cfg().animals[k].gives;
      list.appendChild(OT.el('li', { text: OT.t('hunt.' + k) + ' → ' + Object.keys(gives).map(function (id) { return OT.ingName(id) + ' ×' + gives[id]; }).join('、') }));
    });
    root.appendChild(list);
    st().gamesToday += 1;
    OT.state.save();
    root.appendChild(OT.button(OT.t('auc.done'), function () {
      OT.hunt.leave();
      if (nushi) OT.story.check('hunt_nushi', null, function () { OT.flow.morning(); });
      else OT.flow.morning();
    }, 'primary big'));
  }
})(window);
