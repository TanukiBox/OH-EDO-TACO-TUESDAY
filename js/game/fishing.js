/*
 * 多幸寿：ミニゲーム「江戸湾の一本釣り」
 *   タップで糸を投げる → 「かかった！」→ 押している間は糸を巻く（張りが強くなる）、
 *   離すと張りがゆるむが魚は逃げようと離れる。張りが100をこえると糸が切れる。
 *   数字は config.js の FISHING。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var W = 192, H = 128;
  var F = null;

  function cfg() { return OT.CFG.FISHING; }
  function st() { return OT.state.get(); }

  function pick() {
    var c = cfg();
    if (Math.random() < c.nushiChance) return 'nushi';
    var keys = Object.keys(c.fish).filter(function (k) { return c.fish[k].weight > 0; }), sum = 0;
    keys.forEach(function (k) { sum += c.fish[k].weight; });
    var r = Math.random() * sum;
    for (var i = 0; i < keys.length; i++) { r -= c.fish[keys[i]].weight; if (r <= 0) return keys[i]; }
    return keys[0];
  }

  function holding() { return F.hold || (OT.input && OT.input.down); }
  /** いまの釣り道具：{ tension: 切れるまでの張り, reel: 巻く速さ } */
  function gearNow() {
    var g = st().gear || { line: 0, rod: 0 }, G = cfg().gear;
    return { tension: G.line[g.line || 0].tension, reel: G.rod[g.rod || 0].reel };
  }
  /** 釣り道具の店：糸と竿を1段ずつ良くする */
  function gearPanel() {
    var box = OT.el('div', { class: 'gear' }, [OT.el('h3', { text: OT.t('gear.title') })]);
    ['line', 'rod'].forEach(function (kind) {
      var s = st(), lv = (s.gear || {})[kind] || 0, list = cfg().gear[kind], next = list[lv + 1];
      var row = OT.el('div', { class: 'gear-row' }, [
        OT.el('div', { class: 'gear-now' }, [
          OT.el('b', { text: OT.t('gear.' + kind + lv) + ' ' + '★'.repeat(lv + 1) + '☆'.repeat(list.length - lv - 1) }),
          OT.el('span', { text: OT.t('gear.' + kind + '.desc') })
        ])
      ]);
      if (next) {
        row.appendChild(OT.button(OT.t('gear.buy', { name: OT.t('gear.' + kind + (lv + 1)), price: next.price }), function () {
          if (s.money < next.price) { OT.sfx.denied(); return; }
          s.money -= next.price;
          s.gear = s.gear || { line: 0, rod: 0 };
          s.gear[kind] = lv + 1;
          OT.state.save();
          OT.sfx.buy();
          OT.fishing.enter();
        }, 'small' + (s.money < next.price ? ' off' : '')));
      } else row.appendChild(OT.el('span', { class: 'gear-max', text: OT.t('gear.max') }));
      box.appendChild(row);
    });
    return box;
  }

  OT.fishing = {
    enter: function () {
      var root = OT.ui.screen('fishing');
      root.innerHTML = '';
      F = { root: root, time: 0, state: 'intro', caught: [], hold: false, snaps: 0 };
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🎣 ' + OT.t('fish.title') }));
      F.intro = OT.el('div', { class: 'auc-intro' }, [
        OT.el('p', { text: OT.t('fish.howto') }),
        OT.button(OT.t('fish.start'), start, 'primary big'),
        gearPanel()
      ]);
      root.appendChild(F.intro);
    },
    leave: function () { if (F && F.raf) cancelAnimationFrame(F.raf); if (OT.input) OT.input.onPress = null; F = null; }
  };

  function start() {
    var root = F.root;
    root.removeChild(F.intro);
    F.timeBar = OT.el('div', { class: 'auc-time' }, [OT.el('i')]);
    root.appendChild(F.timeBar);
    var panel = OT.el('div', { class: 'sea-panel' });
    F.canvas = OT.ui.pixelCanvas(W, H, 'sea-canvas');
    panel.appendChild(F.canvas);
    F.gauge = OT.el('div', { class: 'tension' }, [OT.el('i'), OT.el('span', { text: OT.t('fish.tension') })]);
    panel.appendChild(F.gauge);
    F.msg = OT.el('div', { class: 'auc-msg' });
    panel.appendChild(F.msg);
    F.help = OT.el('div', { class: 'sea-help' });
    panel.appendChild(F.help);
    function down(e) { e.preventDefault(); F.hold = true; if (F.state === 'ready') cast(); }
    function up() { if (F) F.hold = false; }
    panel.addEventListener('pointerdown', down);
    panel.addEventListener('pointerup', up);
    panel.addEventListener('pointerleave', up);
    panel.addEventListener('pointercancel', up);
    root.appendChild(panel);
    F.logEl = OT.el('ul', { class: 'auc-log' });
    root.appendChild(F.logEl);
    OT.input.onPress = function () { if (F && F.state === 'ready') cast(); };
    F.state = 'ready';
    F.last = performance.now();
    F.raf = requestAnimationFrame(loop);
  }

  function cast() {
    F.state = 'wait';
    F.waitT = 0.8 + Math.random() * 1.8;
    F.fish = null;
    OT.sfx.wrap();
  }

  function hook() {
    var kind = pick(), info = cfg().fish[kind];
    F.fish = { kind: kind, info: info, dist: cfg().startDistance, tension: 20, surgeT: 1 + Math.random() * 1.5, surging: 0, t: 0, gear: gearNow() };
    F.state = 'fight';
    flash(kind === 'nushi' ? OT.t('fish.nushi') : OT.t('fish.hooked'), kind === 'nushi' ? 'lost' : 'won');
    OT.sfx.clack(1);
  }

  function land() {
    var fish = F.fish;
    Object.keys(fish.info.gives).forEach(function (id) { OT.state.addStock(id, fish.info.gives[id]); });
    F.caught.push(fish.kind);
    if (fish.kind === 'nushi') OT.fx.nushi(OT.t('sea.nushi'));
    F.state = 'after'; F.afterT = 1.1;
    OT.sfx.buy();
    flash(OT.t('fish.caught', { name: OT.t('sea.' + fish.kind) }), 'won');
  }

  function lose(key) {
    if (key === 'fish.snap') F.snaps++;
    F.state = 'after'; F.afterT = 1.1;
    OT.sfx.lost();
    flash(OT.t(key), 'lost');
  }

  function flash(msg, cls) {
    F.msg.textContent = msg;
    F.msg.className = 'auc-msg show ' + cls;
    clearTimeout(F.msgTimer);
    F.msgTimer = setTimeout(function () { if (F) F.msg.className = 'auc-msg'; }, 900);
  }

  function loop(now) {
    if (!F) return;
    var dt = Math.min(0.05, (now - F.last) / 1000);
    F.last = now;
    F.time += dt;
    var c = cfg();
    F.timeBar.firstChild.style.width = Math.max(0, 100 - F.time / c.seconds * 100) + '%';

    if (F.state === 'wait') {
      F.waitT -= dt;
      if (F.waitT <= 0) hook();
    } else if (F.state === 'fight') {
      var f = F.fish;
      f.t += dt;
      f.surgeT -= dt;
      if (f.surgeT <= 0 && !f.surging) { f.surging = 0.7; f.surgeT = 1.4 + Math.random() * 1.8; }
      if (f.surging) f.surging = Math.max(0, f.surging - dt);
      // かかってから時間がたつほど、魚は疲れて引く力が弱まる
      var tire = Math.max(f.info.tireMin || c.tireMin, 1 - f.t / c.tireTime);
      var pull = (f.info.pull + (f.surging ? f.info.surge : 0)) * tire;
      if (holding()) {
        f.dist -= f.gear.reel * dt;
        f.tension += (c.tensionUp + (f.surging ? f.info.surge * 2.2 * tire : 0)) * dt;
        f.dist += (f.surging ? f.info.surge * 0.35 * tire : 0) * dt;
      } else {
        f.tension -= c.tensionDown * dt;
        f.dist += pull * dt;
      }
      f.tension = Math.max(0, f.tension);
      if (f.tension >= f.gear.tension) lose('fish.snap');
      else if (f.dist >= c.startDistance * 1.6) lose('fish.escape');
      else if (f.dist <= 0) land();
      else if (F.time > c.seconds + 10) lose('fish.escape');
    } else if (F.state === 'after') {
      F.afterT -= dt;
      if (F.afterT <= 0) F.state = F.time < c.seconds ? 'ready' : 'end';
    } else if (F.state === 'ready' && F.time >= c.seconds) {
      F.state = 'end';
    }
    // 張りのメーター
    var ten = F.state === 'fight' ? F.fish.tension / F.fish.gear.tension * 100 : 0;   // 糸が切れるまでの何%か
    F.gauge.firstChild.style.height = Math.min(100, ten) + '%';
    F.gauge.className = 'tension' + (ten > 75 ? ' danger' : '');
    F.help.textContent = F.state === 'ready' ? OT.t('fish.tapCast') : F.state === 'wait' ? OT.t('fish.waiting') :
      F.state === 'fight' ? (F.fish.surging ? OT.t('fish.surge') : OT.t('fish.hold')) : '';
    F.help.className = 'sea-help' + (F.state === 'fight' && F.fish.surging ? ' warn' : '');
    draw();
    renderLog();
    if (F.state === 'end') { finish(); return; }
    F.raf = requestAnimationFrame(loop);
  }

  function draw() {
    var ctx = F.canvas.getContext('2d'), P = OT.PAL, t = F.time;
    var bgImg = OT.sprites.has('bg_fishing') ? OT.sprites.get('bg_fishing') : null;
    if (bgImg) { ctx.drawImage(bgImg, 0, 0); drawBoatAndLine(ctx, P, t); return; }
    var g = ctx.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, P.warm1); g.addColorStop(1, P.ind1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 40);
    // 遠くの富士山
    ctx.fillStyle = P.ind2;
    for (var x = 0; x < 60; x++) { var h = Math.max(0, 16 - Math.abs(x - 30) * 0.55); ctx.fillRect(120 + x, 40 - h, 1, h); }
    ctx.fillStyle = P.white; for (var x2 = 0; x2 < 10; x2++) ctx.fillRect(145 + x2, 25 + Math.abs(x2 - 5) * 0.5, 1, 2);
    // 海
    var sea = ctx.createLinearGradient(0, 40, 0, H);
    sea.addColorStop(0, P.ind2); sea.addColorStop(1, P.ind5);
    ctx.fillStyle = sea; ctx.fillRect(0, 40, W, H - 40);
    ctx.fillStyle = P.ind1;
    for (var i = 0; i < 14; i++) { var wx = (i * 37 + t * 12) % (W + 20) - 10; ctx.fillRect(Math.round(wx), 44 + (i * 13) % 60, 6, 1); }
    // 小舟とマテオ（仮）
    var by = 38 + Math.round(Math.sin(t * 2) * 1);
    ctx.fillStyle = P.brown2; ctx.fillRect(8, by, 34, 5); ctx.fillStyle = P.brown1; ctx.fillRect(10, by + 5, 30, 2);
    ctx.fillStyle = P.red2; ctx.fillRect(22, by - 12, 8, 12); ctx.fillStyle = '#f0c8a0'; ctx.fillRect(23, by - 19, 7, 7);
    ctx.fillStyle = P.char; ctx.fillRect(23, by - 20, 7, 2);
    // 竿
    var tipX = 60, tipY = by - 24;
    ctx.fillStyle = P.brown3; for (var r = 0; r < 30; r++) ctx.fillRect(Math.round(29 + r), Math.round(by - 12 - r * 0.4), 1, 1);
    // 糸と魚
    var fx = null, fy = null;
    if (F.state === 'wait' || F.state === 'ready') {
      if (F.state === 'wait') { fx = 120; fy = 42 + Math.round(Math.sin(t * 6) * 1); ctx.fillStyle = P.red1; ctx.fillRect(fx - 1, fy - 2, 3, 3); }
    } else if (F.state === 'fight') {
      var f = F.fish;
      fx = Math.round(70 + f.dist * 0.7 + (f.surging ? Math.sin(t * 40) * 2 : 0));
      fy = Math.round(76 + Math.sin(t * 3) * 6);
      OT.art.drawSeaFish(ctx, f.kind, fx, fy, -1, t);
      if (f.surging) { ctx.fillStyle = P.white; ctx.fillRect(fx - 4, 40, 1, 3); ctx.fillRect(fx + 3, 41, 1, 2); }
    }
    if (fx !== null) {
      ctx.fillStyle = F.state === 'fight' && F.fish.tension > 75 ? P.red1 : P.white2;
      var steps = 40;
      for (var s = 0; s <= steps; s++) {
        var u = s / steps;
        var sag = F.state === 'fight' ? (1 - F.fish.tension / 100) * 10 : 6;
        var lx = tipX + (fx - tipX) * u, ly = tipY + (fy - tipY) * u + Math.sin(u * Math.PI) * sag;
        ctx.fillRect(Math.round(lx), Math.round(ly), 1, 1);
      }
    }
  }

  /** 絵の背景のときの、小舟・マテオ・竿・糸・魚 */
  function drawBoatAndLine(ctx, P, t) {
    var by = 38 + Math.round(Math.sin(t * 2) * 1);
    var mate = OT.sprites.get('people_mini_mateo');
    if (mate && mate.complete) {   // 小さなマテオの絵は左向きなので、裏返して海（右）を向かせる
      ctx.save(); ctx.translate(26, 0); ctx.scale(-1, 1);
      ctx.drawImage(mate, 0, 0, 24, 30, -12, by - 26, 24, 30);
      ctx.restore();
    }
    // 小舟（へさきが右）
    ctx.fillStyle = P.brown3; ctx.fillRect(6, by + 1, 36, 2);
    ctx.fillStyle = P.brown2; ctx.fillRect(7, by + 3, 34, 3); ctx.fillRect(41, by + 1, 3, 3); ctx.fillRect(44, by, 2, 2);
    ctx.fillStyle = P.brown1; ctx.fillRect(9, by + 6, 30, 2);
    ctx.fillStyle = P.brown3; for (var r = 0; r < 30; r++) ctx.fillRect(Math.round(29 + r), Math.round(by - 12 - r * 0.4), 1, 1);
    var tipX = 60, tipY = by - 24, fx = null, fy = null;
    if (F.state === 'wait') { fx = 120; fy = 42 + Math.round(Math.sin(t * 6) * 1); ctx.fillStyle = P.red1; ctx.fillRect(fx - 1, fy - 2, 3, 3); }
    else if (F.state === 'fight') {
      var f = F.fish;
      fx = Math.round(70 + f.dist * 0.7 + (f.surging ? Math.sin(t * 40) * 2 : 0));
      fy = Math.round(76 + Math.sin(t * 3) * 6);
      var sp = OT.sprites.get('cr_sea_' + f.kind + '_' + (Math.floor(t * 6) % 2));
      if (sp && sp.complete && sp.naturalWidth) ctx.drawImage(sp, Math.round(fx - sp.width / 2), Math.round(fy - sp.height / 2));
      else OT.art.drawSeaFish(ctx, f.kind, fx, fy, -1, t);
      if (f.surging) { ctx.fillStyle = P.white; ctx.fillRect(fx - 4, 40, 1, 3); ctx.fillRect(fx + 3, 41, 1, 2); }
    }
    if (fx !== null) {
      ctx.fillStyle = F.state === 'fight' && F.fish.tension > 75 ? P.red1 : P.white2;
      for (var s = 0; s <= 40; s++) {
        var u = s / 40, sag = F.state === 'fight' ? (1 - F.fish.tension / 100) * 10 : 6;
        ctx.fillRect(Math.round(tipX + (fx - tipX) * u), Math.round(tipY + (fy - tipY) * u + Math.sin(u * Math.PI) * sag), 1, 1);
      }
    }
  }

  function renderLog() {
    var html = F.caught.map(function (k) { return '<li>' + OT.t('sea.' + k) + '</li>'; }).join('');
    if (F.logEl.innerHTML !== html) F.logEl.innerHTML = html;
  }

  function finish() {
    OT.input.onPress = null;
    var root = F.root, caught = F.caught;
    root.innerHTML = '';
    root.appendChild(OT.ui.hud());
    root.appendChild(OT.el('h2', { class: 'scr-title', text: OT.t('fish.result') }));
    var list = OT.el('ul', { class: 'auc-log big' });
    if (!caught.length) list.appendChild(OT.el('li', { text: OT.t('fish.none') }));
    caught.forEach(function (k) {
      var gives = cfg().fish[k].gives;
      var parts = Object.keys(gives).map(function (id) { return OT.ingName(id) + ' ×' + gives[id]; }).join('、');
      list.appendChild(OT.el('li', { text: OT.t('sea.' + k) + ' → ' + parts }));
    });
    root.appendChild(list);
    // 糸が切れたことがあれば、釣り道具をすすめる
    var g = st().gear || {};
    if (F.snaps && ((g.line || 0) < cfg().gear.line.length - 1 || (g.rod || 0) < cfg().gear.rod.length - 1)) root.appendChild(OT.el('p', { class: 'lead', text: OT.t('gear.hint') }));
    st().gamesToday += 1;
    OT.state.save();
    root.appendChild(OT.button(OT.t('auc.done'), function () { OT.fishing.leave(); OT.flow.morning(); }, 'primary big'));
  }
})(window);
