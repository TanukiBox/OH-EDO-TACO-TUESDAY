/*
 * 多幸寿：ミニゲーム「山の追い込み」
 *   猟師の熊蔵といっしょに、スワイプで猪や鹿を上の罠の柵へ追い込む（入口は柵の下だけ）。
 *   スワイプした線の近くにいる獲物が、だいたいスワイプの向きに逃げる（まっすぐとは限らない）。
 *   ・獲物は、ほうっておくと森（左右と下の端）へ逃げてしまう
 *   ・猪はときどき突進してくる（押しが効きにくい）。鹿は横へ跳ぶ
 *   ・続けざまに追いたてると暴れて、思わぬ方へ走る（落ちついて1回ずつ）
 *   数字は config.js の HUNT。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var W = 192, H = 128;
  var TRAP = { x0: 78, x1: 114, y0: 6, y1: 22 };   // 罠の柵（入口は下の y1）
  var K = null;

  function cfg() { return OT.CFG.HUNT; }
  function st() { return OT.state.get(); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function pick() {
    var c = cfg();
    if (!K.nushiSeen && Math.random() < c.nushiChance) { K.nushiSeen = true; return 'nushi'; }
    var keys = Object.keys(c.animals).filter(function (k) { return c.animals[k].weight > 0; }), sum = 0;
    keys.forEach(function (k) { sum += c.animals[k].weight; });
    var r = Math.random() * sum;
    for (var i = 0; i < keys.length; i++) { r -= c.animals[keys[i]].weight; if (r <= 0) return keys[i]; }
    return keys[0];
  }

  OT.hunt = {
    enter: function () {
      OT.bgm.play('hunt');
      var root = OT.ui.screen('hunt');
      root.innerHTML = '';
      K = { root: root, time: 0, animals: [], caught: [], escaped: 0, trail: [], spawnT: 0, nushi: false };
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🐗 ' + OT.t('hunt.title') }));
      K.intro = OT.el('div', { class: 'auc-intro' }, [
        OT.el('p', { text: OT.t('hunt.howto') }),
        OT.el('ul', { class: 'hunt-tips' }, ['tip1', 'tip2', 'tip3'].map(function (k) { return OT.el('li', { text: OT.t('hunt.' + k) }); })),
        OT.button(OT.t('hunt.start'), start, 'primary big')
      ]);
      root.appendChild(K.intro);
    },
    leave: function () { if (K && K.raf) cancelAnimationFrame(K.raf); K = null; },
    // テスト用
    _peek: function () { return K; },
    _swipe: function (a, b) { swipe(a, b); }
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
    K.spawnT = cfg().secondAfter;
    K.last = performance.now();
    K.raf = requestAnimationFrame(loop);
  }

  function spawn() {
    var kind = pick(), info = cfg().animals[kind];
    var side = Math.random() < 0.5 ? -1 : 1;
    K.animals.push({ kind: kind, info: info, x: 96 + side * rnd(20, 70), y: rnd(68, 100), vx: 0, vy: 0,
      turn: 0.3, boost: 0, panic: 0, mode: 'walk', modeT: 0, f: Math.random() * 4 });
    if (kind === 'nushi') say(OT.t('hunt.nushiAppear'));
  }

  function say(msg, cls) { K.msg.textContent = msg; K.msg.className = 'hunt-msg show ' + (cls || ''); clearTimeout(K.mt); K.mt = setTimeout(function () { if (K) K.msg.className = 'hunt-msg'; }, 1100); }

  /** スワイプ：線の近くの獲物を、だいたいスワイプの向きに追いたてる */
  function swipe(a, b) {
    var c = cfg();
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 8) return;
    OT.sfx.tap();
    var hit = false;
    K.animals.forEach(function (an) {
      var t = Math.max(0, Math.min(1, ((an.x - a.x) * dx + (an.y - a.y) * dy) / (len * len)));
      var d = Math.hypot(an.x - (a.x + dx * t), an.y - (a.y + dy * t));
      if (d > c.reach) return;
      hit = true;
      // 続けざまに追うと暴れる
      an.panic += c.panicPerPush;
      if (an.panic >= 1) { bolt(an); return; }
      var ang = Math.atan2(dy, dx) + rnd(-1, 1) * (an.info.veer || 0.3);
      var power = c.push / (an.info.heavy || 1) * (an.mode === 'charge' ? c.chargeResist : 1);
      an.vx = Math.cos(ang) * power;
      an.vy = Math.sin(ang) * power;
      an.boost = c.boostTime;
      if (an.mode !== 'charge') an.mode = 'walk';
    });
    if (hit) { say(OT.say('hunt.shout')); OT.sfx.place(); }
  }

  /** 暴れて、思わぬ方へ走る（罠から遠ざかる向きに、左右へぶれる） */
  function bolt(an) {
    var away = Math.atan2(an.y - TRAP.y1, an.x - 96) + rnd(-1.2, 1.2);
    var sp = an.info.speed * cfg().boltSpeed;
    an.vx = Math.cos(away) * sp; an.vy = Math.sin(away) * sp;
    an.mode = 'bolt'; an.modeT = cfg().boltTime; an.boost = 0; an.panic = 0;
    say(OT.t('hunt.panic'), 'bad');
    OT.sfx.angry();
  }

  function think(an) {
    var info = an.info, c = cfg();
    an.turn = rnd(0.6, 1.4);
    // 罠の入口の近く：罠に気づいて、横（入口から遠いほう）へよける
    if (Math.hypot(an.x - 96, an.y - TRAP.y1) < c.wary) {
      var s0 = an.x < 96 ? -1 : 1;
      an.vx = s0 * info.speed * c.waryDodge; an.vy = info.speed * rnd(0.1, 0.5);
      an.mode = 'walk'; an.turn = rnd(0.5, 0.8);
      return;
    }
    // 猪：突進（罠から遠ざかる向きへ、速く）
    if (info.charge && Math.random() < info.charge) {
      var away = Math.atan2(an.y - TRAP.y1, an.x - 96) + rnd(-0.5, 0.5);
      an.vx = Math.cos(away) * info.speed * c.chargeSpeed; an.vy = Math.sin(away) * info.speed * c.chargeSpeed;
      an.mode = 'charge'; an.modeT = c.chargeTime;
      if (!K.chargeSaid || K.time - K.chargeSaid > 4) { say(OT.t('hunt.charge'), 'bad'); K.chargeSaid = K.time; }
      return;
    }
    // 鹿：横へ跳ぶ
    if (info.leap && Math.random() < info.leap) {
      var s = Math.random() < 0.5 ? -1 : 1;
      an.vx = s * info.speed * 2; an.vy = rnd(-0.3, 0.6) * info.speed;
      an.mode = 'leap'; an.modeT = 0.4;
      return;
    }
    // 気ままにうろつく。罠から遠ざかり、近い森（左右か下）へ向かいがち
    var ang = Math.random() * Math.PI * 2;
    an.vx = Math.cos(ang) * info.speed + (an.x < 96 ? -1 : 1) * info.speed * c.fleeBias;
    an.vy = Math.sin(ang) * info.speed * 0.8 + info.speed * c.fleeBias;
    an.mode = 'walk';
  }

  function loop(now) {
    if (!K) return;
    var dt = Math.min(0.05, (now - K.last) / 1000);
    K.last = now;
    K.time += dt;
    var c = cfg();
    K.timeBar.firstChild.style.width = Math.max(0, 100 - K.time / c.seconds * 100) + '%';
    K.animals.slice().forEach(function (an) {
      an.panic = Math.max(0, an.panic - c.panicDecay * dt);
      if (an.mode !== 'walk') { an.modeT -= dt; if (an.modeT <= 0) { an.mode = 'walk'; an.turn = 0; } }
      if (an.boost > 0) {
        an.boost -= dt;
        an.vx *= Math.pow(0.4, dt); an.vy *= Math.pow(0.4, dt);
      } else if (an.mode === 'walk') {
        an.turn -= dt;
        if (an.turn <= 0) think(an);
      }
      an.x += an.vx * dt; an.y += an.vy * dt;
      an.f += dt * (4 + Math.hypot(an.vx, an.vy) / 8);
      // 罠のまわり：入口（柵の下）からだけ入れる。柵や崖にぶつかったら下へはね返る
      if (an.y < TRAP.y1 + 4) {
        if (an.x > TRAP.x0 + 2 && an.x < TRAP.x1 - 2) {
          if (an.y < TRAP.y1 - 2) { catchIt(an); return; }
        } else if (an.y < 28) { an.y = 28; an.vy = Math.abs(an.vy) * 0.6; }
      }
      // 森へ逃げた
      if (an.x < -8 || an.x > W + 8 || an.y > H + 8) {
        K.animals.splice(K.animals.indexOf(an), 1);
        K.escaped++;
        K.spawnT = Math.max(K.spawnT, rnd(c.spawnEvery[0], c.spawnEvery[1]));
        say(OT.t('hunt.escape', { name: OT.t('hunt.' + an.kind) }), 'bad');
        OT.sfx.lost();
      }
    });
    if (K.animals.length < c.maxAnimals && K.time < c.seconds - 3) {
      K.spawnT -= dt;
      if (K.spawnT <= 0) { spawn(); K.spawnT = rnd(c.spawnEvery[0], c.spawnEvery[1]); }
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
    K.animals.splice(K.animals.indexOf(an), 1);
    K.spawnT = Math.max(K.spawnT, rnd(cfg().spawnEvery[0], cfg().spawnEvery[1]));
    OT.sfx.buy();
    say(OT.t('hunt.caught', { name: OT.t('hunt.' + an.kind) }));
  }

  function draw() {
    var ctx = K.canvas.getContext('2d'), P = OT.PAL, t = K.time;
    if (OT.sprites.has('bg_hunt')) ctx.drawImage(OT.sprites.get('bg_hunt'), 0, 0);
    else { ctx.fillStyle = P.green2; ctx.fillRect(0, 0, W, H); }
    // 入口の目印（↑）
    ctx.fillStyle = 'rgba(255,230,176,' + (0.45 + 0.35 * Math.sin(t * 4)) + ')';
    for (var ar = 0; ar < 3; ar++) ctx.fillRect(96 - 4 + ar * 2 - 2, 27 + ar * 2, 8 - ar * 4 + 4, 1);
    // 獲物（上にいるものから描く）
    K.animals.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (an) {
      var sp = OT.sprites.get('cr_animal_' + an.kind + '_' + (Math.floor(an.f) % 4));
      var x = Math.round(an.x), y = Math.round(an.y);
      if (sp && sp.complete && sp.naturalWidth) {
        ctx.fillStyle = 'rgba(28,18,32,0.3)';
        ctx.fillRect(x - Math.round(sp.width * 0.3), y + Math.round(sp.height * 0.32), Math.round(sp.width * 0.6), 2);
        ctx.save();
        ctx.translate(x, y);
        if (an.vx > 0) ctx.scale(-1, 1);   // 絵は左向き
        ctx.drawImage(sp, -Math.round(sp.width / 2), -Math.round(sp.height / 2));
        ctx.restore();
        // 突進・暴れているときは「！」
        if (an.mode === 'charge' || an.mode === 'bolt') {
          ctx.fillStyle = P.red1 || '#f24a2a';
          var top = y - Math.round(sp.height / 2) - 7;
          ctx.fillRect(x - 1, top, 2, 4); ctx.fillRect(x - 1, top + 5, 2, 1);
        }
        // あせり（続けて追うと暴れる）
        if (an.panic > 0.45 && an.mode === 'walk') {
          ctx.fillStyle = '#9cc4ff';
          ctx.fillRect(x + 6, y - Math.round(sp.height / 2) - 2 + Math.round(Math.sin(t * 10)), 2, 3);
        }
      } else {
        ctx.fillStyle = P.brown1; ctx.fillRect(x - 6, y - 4, 12, 8);
      }
    });
    ctx.fillStyle = 'rgba(255,230,176,0.8)';
    K.trail.forEach(function (tr) { ctx.fillRect(Math.round(tr.p.x) - 1, Math.round(tr.p.y) - 1, 2, 2); });
  }

  function finish() {
    var root = K.root, caught = K.caught, nushi = K.nushi, escaped = K.escaped;
    root.innerHTML = '';
    root.appendChild(OT.ui.hud());
    root.appendChild(OT.el('h2', { class: 'scr-title', text: OT.t('hunt.result') }));
    var list = OT.el('ul', { class: 'auc-log big' });
    if (!caught.length) list.appendChild(OT.el('li', { text: OT.t('hunt.none') }));
    caught.forEach(function (k) {
      var gives = cfg().animals[k].gives;
      list.appendChild(OT.el('li', { text: OT.t('hunt.' + k) + ' → ' + Object.keys(gives).map(function (id) { return OT.ingName(id) + ' ×' + gives[id]; }).join('、') }));
    });
    if (escaped) list.appendChild(OT.el('li', { class: 'bad', text: OT.t('hunt.escapedN', { n: escaped }) }));
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
