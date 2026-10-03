/*
 * 多幸寿：ミニゲーム「長崎の抜け荷」（唐人屋敷の裏の蔵で、闇商人・銀次と裏の取引）
 *   今夜の荷（何が何人前か・言い値）が並ぶ。荷ごとに、言い値で買うか、「椀の玉当て」で勝負して値切る。
 *   ・三つの椀のどれかに賽を伏せて、銀次が混ぜる。賽の入った椀をタップで当てる
 *   ・当てるたびに安くなる（勝負は3回まで）。勝ったら「ここで買う」か「もう一勝負」かを選べる
 *   ・外れたら、高い値でしか売ってくれない（買わずに見送ってもよい）
 *   ・2回目からは、銀次がときどきイカサマ（賽を袖に隠す）をする。見破って「イカサマだ！」で、いちばん安く
 *   数字は config.js の SMUGGLE。ことばは text.js の 'smug.*' と 'ym.*'（銀次のせりふ）。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var SW = 384, SH = 216;
  var SLOT_X = [132, 192, 252], CUP_Y = 194, LIFT = 26;   // 椀の置き場所（椀の底の高さ）
  var YAMI_X = 192, YAMI_Y = 200;                          // 銀次の足もと（盆にかくれる）
  var Y = null;

  function cfg() { return OT.CFG.SMUGGLE; }
  function st() { return OT.state.get(); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function img(k) { var i = OT.sprites.get('ym_' + k); return i && i.complete && i.naturalWidth ? i : null; }

  /** 今夜の荷：重みつきで、ちがう品を cfg().crates 個。言い値は値打ち×数×markup */
  function makeManifest() {
    var c = cfg(), s = st(), keys = Object.keys(c.goods), list = [];
    // 第5章で、まだトウモロコシの種がないなら、荷に必ず入る
    if (!s.flags.gotCorn && OT.state.chapter() >= 5 && c.goods.corn) { list.push('corn'); keys = keys.filter(function (k) { return k !== 'corn'; }); }
    while (list.length < c.crates && keys.length) {
      var sum = 0;
      keys.forEach(function (k) { sum += c.goods[k].weight; });
      var r = Math.random() * sum, pick = keys[keys.length - 1];
      for (var i = 0; i < keys.length; i++) { r -= c.goods[keys[i]].weight; if (r <= 0) { pick = keys[i]; break; } }
      list.push(pick);
      keys.splice(keys.indexOf(pick), 1);
    }
    return list.map(function (id) {
      var g = c.goods[id], val = (OT.CFG.INGREDIENTS[id] || {}).value || 5;
      return { id: id, n: g.n, list: Math.max(10, Math.round(val * g.n * c.markup)), status: 'open', wins: 0 };
    });
  }
  function priceOf(cr, mul) { return Math.max(5, Math.round(cr.list * mul)); }

  OT.smuggle = {
    enter: function () {
      var root = OT.ui.screen('smuggle');
      root.innerHTML = '';
      root.classList.add('ym');
      Y = { root: root, crates: makeManifest(), cur: null, phase: 'list', t: 0, got: {}, spent: 0, saved: 0,
            cups: [0, 1, 2], ball: 0, lift: [0, 0, 0], swaps: [], sw: 0, swT: 0, anim: 'wait', animT: 0, glint: null, popDice: null };
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🏮 ' + OT.t('smug.title') }));
      Y.stage = OT.el('div', { class: 'ym-stage' });
      Y.canvas = OT.ui.pixelCanvas(SW, SH, 'ym-canvas');
      Y.stage.appendChild(Y.canvas);
      Y.bubble = OT.el('div', { class: 'ym-bubble' });
      Y.stage.appendChild(Y.bubble);
      Y.msg = OT.el('div', { class: 'ak-msg' });
      Y.stage.appendChild(Y.msg);
      Y.stage.addEventListener('pointerdown', function (e) {
        if (!Y || Y.phase !== 'pick') return;
        e.preventDefault();
        var r = Y.canvas.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width * SW, y = (e.clientY - r.top) / r.height * SH;
        for (var slot = 0; slot < 3; slot++) {
          if (Math.abs(x - SLOT_X[slot]) < 30 && y > CUP_Y - 52 && y < CUP_Y + 14) { pickCup(slot); return; }
        }
      });
      root.appendChild(Y.stage);
      Y.lower = OT.el('div', { class: 'ym-lower' });
      root.appendChild(Y.lower);
      say(OT.say('ym.hello'));
      showList(true);
      Y.last = performance.now();
      Y.raf = requestAnimationFrame(loop);
    },
    leave: function () { if (Y && Y.raf) cancelAnimationFrame(Y.raf); if (Y) Y.root.classList.remove('ym'); Y = null; },
    _peek: function () { return Y; },        // テスト用
    _pick: function (slot) { pickCup(slot); },
    _cheat: function () { callCheat(); }
  };

  // ---------------------------------------------------------------
  // 銀次のせりふ・動き
  // ---------------------------------------------------------------
  function say(text, ms) {
    Y.bubble.textContent = text;
    Y.bubble.classList.add('on');
    clearTimeout(Y.bt);
    if (ms) Y.bt = setTimeout(function () { if (Y) Y.bubble.classList.remove('on'); }, ms);
  }
  function act(anim, sec) { Y.anim = anim; Y.animT = sec || 1.4; }
  function flash(text, cls) {
    Y.msg.textContent = text; Y.msg.className = 'ak-msg on ' + (cls || '');
    clearTimeout(Y.mt); Y.mt = setTimeout(function () { if (Y) Y.msg.className = 'ak-msg'; }, 1200);
  }

  // ---------------------------------------------------------------
  // 下の段：今夜の荷 → 1つの荷の取引
  // ---------------------------------------------------------------
  function chip(cr) {
    var icon = OT.ui.pixelCanvas(24, 24, 'chip-icon');
    OT.art.drawIcon(icon, cr.id);
    return [icon, OT.el('span', { class: 'ym-name', text: OT.ingName(cr.id) + ' ×' + cr.n })];
  }

  function showList(first) {
    Y.phase = 'list';
    Y.cur = null;
    Y.cups = [0, 1, 2]; Y.lift = [0, 0, 0]; Y.ball = -1;
    Y.lower.innerHTML = '';
    if (first) Y.lower.appendChild(OT.el('p', { class: 'ym-howto', text: OT.t('smug.howto') }));
    Y.lower.appendChild(OT.el('h3', { class: 'ym-head', text: OT.t('smug.manifest') }));
    var grid = OT.el('div', { class: 'ym-crates' });
    Y.crates.forEach(function (cr) {
      var done = cr.status !== 'open';
      grid.appendChild(OT.el('button', { class: 'ym-crate ' + cr.status, onclick: function () {
        if (done) { OT.sfx.denied(); return; }
        OT.sfx.tap(); offer(cr);
      } }, chip(cr).concat([
        OT.el('span', { class: 'ym-price', text: cr.status === 'bought' ? OT.t('smug.bought', { price: cr.paid }) : cr.status === 'passed' ? OT.t('smug.passed') : OT.t('smug.listPrice', { price: cr.list }) })
      ])));
    });
    Y.lower.appendChild(grid);
    var left = Y.crates.filter(function (c) { return c.status === 'open'; }).length;
    Y.lower.appendChild(OT.button(left ? OT.t('smug.leave') : OT.t('smug.done'), finish, left ? 'ghost' : 'primary big'));
    if (!left) say(OT.say('ym.bye'));
  }

  function offer(cr) {
    Y.cur = cr;
    Y.phase = 'offer';
    act('call', 1.2);
    say(OT.t('ym.offer', { name: OT.ingName(cr.id), n: cr.n, price: cr.list }));
    Y.lower.innerHTML = '';
    Y.lower.appendChild(OT.el('div', { class: 'ym-deal' }, chip(cr).concat([OT.el('span', { class: 'ym-price', text: OT.t('smug.listPrice', { price: cr.list }) })])));
    var steps = cfg().steps;
    Y.lower.appendChild(OT.el('p', { class: 'ym-rule', text: OT.t('smug.rule', { a: priceOf(cr, steps[0]), b: priceOf(cr, steps[1]), c: priceOf(cr, steps[2]), lose: priceOf(cr, cfg().losePrice) }) }));
    Y.lower.appendChild(OT.el('div', { class: 'ym-btns' }, [
      OT.button('🎲 ' + OT.t('smug.play'), function () { cr.wins = 0; startRound(); }, 'primary big'),
      buyBtn(cr, cr.list),
      OT.button(OT.t('smug.pass'), function () { cr.status = 'passed'; say(OT.say('ym.pass'), 1600); showList(); }, 'ghost small')
    ]));
  }

  function buyBtn(cr, price, label) {
    var poor = st().money < price;
    return OT.button(label || OT.t('smug.buy', { price: price }), function () {
      if (st().money < price) { OT.sfx.denied(); flash(OT.t('smug.poor'), 'lost'); return; }
      st().money -= price;
      OT.state.addStock(cr.id, cr.n);
      if (cr.id === 'corn') st().flags.gotCorn = 1;
      cr.status = 'bought'; cr.paid = price;
      Y.got[cr.id] = (Y.got[cr.id] || 0) + cr.n;
      Y.spent += price; Y.saved += Math.max(0, cr.list - price);
      OT.sfx.buy();
      OT.state.save();
      var hud = Y.root.querySelector('.hud'); if (hud) hud.parentNode.replaceChild(OT.ui.hud(), hud);
      say(OT.say('ym.thanks'), 1600);
      showList();
    }, 'small' + (poor ? ' off' : ''));
  }

  // ---------------------------------------------------------------
  // 椀の玉当て
  // ---------------------------------------------------------------
  function startRound() {
    var c = cfg(), r = Y.cur.wins, R = c.rounds[Math.min(r, c.rounds.length - 1)];
    Y.round = r;
    Y.cups = [0, 1, 2];            // cups[椀] = 置き場所
    Y.ball = Math.floor(Math.random() * 3);   // 賽の入った椀（-1 = 袖に隠した）
    Y.lift = [1, 1, 1];
    Y.swaps = [];
    for (var k = 0; k < R.swaps; k++) {
      var a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      Y.swaps.push([a, b]);
    }
    Y.swapTime = R.swapTime;
    Y.cheatAt = Math.random() < (c.cheatChance[r] || 0) ? 1 + Math.floor(Math.random() * Math.max(1, R.swaps - 2)) : -1;
    Y.cheated = false;
    Y.sw = 0; Y.swT = 0;
    Y.phase = 'show'; Y.t = 0;
    Y.lower.innerHTML = '';
    Y.lower.appendChild(OT.el('p', { class: 'ym-rule big', text: OT.t('smug.watch', { n: r + 1 }) }));
    say(OT.say('ym.shuffle'));
    act('call', 1.0);
    OT.sfx.place();
  }

  function slotOfCup(cup) { return Y.cups[cup]; }
  function cupAtSlot(slot) { for (var i = 0; i < 3; i++) if (Y.cups[i] === slot) return i; return 0; }

  function beginPick() {
    Y.phase = 'pick';
    Y.lower.innerHTML = '';
    Y.lower.appendChild(OT.el('p', { class: 'ym-rule big', text: OT.t('smug.pick') }));
    if ((cfg().cheatChance[Y.round] || 0) > 0) {
      Y.lower.appendChild(OT.button('🫵 ' + OT.t('smug.cheatBtn'), callCheat, 'ym-cheat'));
      Y.lower.appendChild(OT.el('p', { class: 'ym-hint', text: OT.t('smug.cheatHint') }));
    }
    say(OT.say('ym.which'));
  }

  function pickCup(slot) {
    if (Y.phase !== 'pick') return;
    var cup = cupAtSlot(slot);
    Y.phase = 'reveal'; Y.t = 0; Y.picked = cup;
    Y.lift = [0, 0, 0]; Y.lift[cup] = 1;
    OT.sfx.open();
    var win = cup === Y.ball;
    setTimeout(function () {
      if (!Y) return;
      if (win) roundWon();
      else {
        if (Y.ball >= 0) Y.lift[Y.ball] = 1;   // 本当の場所も見せる
        roundLost(Y.ball < 0 ? 'ym.hidden' : 'ym.lose');
      }
    }, 650);
  }

  function callCheat() {
    if (Y.phase !== 'pick') return;
    Y.phase = 'reveal'; Y.t = 0;
    if (Y.cheated) {
      // 見破った：袖から賽がこぼれる
      Y.popDice = { t: 0 };
      act('shout', 1.6);
      OT.sfx.jackpot ? OT.sfx.jackpot() : OT.sfx.buy();
      flash(OT.t('smug.caughtHim'), 'won');
      say(OT.say('ym.exposed'));
      var cr = Y.cur, price = priceOf(cr, cfg().cheatWin);
      setTimeout(function () { if (Y) decide(price, 'cheat'); }, 900);
    } else {
      Y.lift = [0, 0, 0]; Y.lift[Y.ball] = 1;
      OT.sfx.open();
      setTimeout(function () { if (Y) roundLost('ym.falseCall'); }, 650);
    }
  }

  function roundWon() {
    var cr = Y.cur;
    cr.wins++;
    act('sad', 1.6);
    OT.sfx.buy();
    flash(OT.t('smug.win'), 'won');
    say(OT.say('ym.win'));
    decide(priceOf(cr, cfg().steps[cr.wins - 1]), 'win');
  }

  function roundLost(key) {
    act('laugh', 1.8);
    if (OT.sfx.laugh) OT.sfx.laugh();
    OT.sfx.lost();
    flash(OT.t('smug.lose'), 'lost');
    say(OT.say(key));
    decide(priceOf(Y.cur, cfg().losePrice), 'lose');
  }

  /** 勝負のあと：この値で買う／もう一勝負／見送る */
  function decide(price, how) {
    var cr = Y.cur, steps = cfg().steps;
    Y.phase = 'decide';
    Y.lower.innerHTML = '';
    Y.lower.appendChild(OT.el('div', { class: 'ym-deal' }, chip(cr).concat([OT.el('span', { class: 'ym-price now ' + how, text: OT.t('smug.nowPrice', { price: price, list: cr.list }) })])));
    var btns = OT.el('div', { class: 'ym-btns' });
    btns.appendChild(buyBtn(cr, price));
    if (how === 'win' && cr.wins < steps.length) {
      btns.appendChild(OT.button('🎲 ' + OT.t('smug.again', { win: priceOf(cr, steps[cr.wins]), lose: priceOf(cr, cfg().losePrice) }), function () { startRound(); }, 'primary'));
    }
    btns.appendChild(OT.button(OT.t('smug.pass'), function () { cr.status = 'passed'; say(OT.say('ym.pass'), 1600); showList(); }, 'ghost small'));
    Y.lower.appendChild(btns);
  }

  // ---------------------------------------------------------------
  // うごき
  // ---------------------------------------------------------------
  function loop(now) {
    if (!Y) return;
    var dt = Math.min(0.05, (now - Y.last) / 1000);
    Y.last = now;
    Y.t += dt;
    if (Y.animT > 0) { Y.animT -= dt; if (Y.animT <= 0) Y.anim = 'wait'; }
    if (Y.phase === 'show') {
      // 賽を見せてから、椀をふせる
      if (Y.t > 1.1) { Y.lift = [Math.max(0, 1 - (Y.t - 1.1) / 0.3), 0, 0]; Y.lift[1] = Y.lift[2] = Y.lift[0]; }
      if (Y.t > 1.5) { Y.lift = [0, 0, 0]; Y.phase = 'shuffle'; Y.sw = 0; Y.swT = 0; }
    } else if (Y.phase === 'shuffle') {
      Y.swT += dt;
      if (Y.swT >= Y.swapTime) {
        var s = Y.swaps[Y.sw], ca = cupAtSlot(s[0]), cb = cupAtSlot(s[1]);
        Y.cups[ca] = s[1]; Y.cups[cb] = s[0];
        OT.sfx.tap();
        Y.sw++; Y.swT = 0;
        // イカサマ：混ぜている途中で、賽を袖に隠す（賽の入った椀が一瞬ちょっと浮く）
        if (Y.sw === Y.cheatAt && Y.ball >= 0) {
          Y.glint = { cup: Y.ball, t: 0 };
          Y.cheated = true;
          Y.ball = -1;
          act('call', 0.35);
        }
        if (Y.sw >= Y.swaps.length) beginPick();
      }
    }
    if (Y.glint) { Y.glint.t += dt; if (Y.glint.t > 0.3) Y.glint = null; }
    if (Y.popDice) { Y.popDice.t += dt; if (Y.popDice.t > 1.2) Y.popDice = null; }
    draw();
    Y.raf = requestAnimationFrame(loop);
  }

  /** 椀 cup の、いまの画面の位置（混ぜている最中は弧をえがいて入れかわる） */
  function cupPos(cup) {
    var slot = slotOfCup(cup), x = SLOT_X[slot], y = CUP_Y, hand = false;
    if (Y.phase === 'shuffle' && Y.sw < Y.swaps.length) {
      var s = Y.swaps[Y.sw], u = Math.min(1, Y.swT / Y.swapTime), e = u * u * (3 - 2 * u);
      if (slot === s[0] || slot === s[1]) {
        var to = slot === s[0] ? s[1] : s[0];
        x = SLOT_X[slot] + (SLOT_X[to] - SLOT_X[slot]) * e;
        y = CUP_Y + (slot === s[0] ? -1 : 1) * Math.sin(e * Math.PI) * 7;   // 一方は奥へ、一方は手前へ
        hand = true;
      }
    }
    var lift = Y.lift[cup] || 0;
    if (Y.glint && Y.glint.cup === cup) lift = Math.max(lift, 0.12);
    return { x: x, y: y - lift * LIFT, hand: hand };
  }

  function draw() {
    var ctx = Y.canvas.getContext('2d'), t = Y.t;
    ctx.imageSmoothingEnabled = false;
    var bg = img('bg_yami');
    if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = '#2e1a12'; ctx.fillRect(0, 0, SW, SH); }
    OT.sprites.drawPerson(ctx, 'yami', Y.anim, Y.anim === 'wait' ? t * 0.7 : t, YAMI_X, YAMI_Y, false, Y.anim === 'wait' ? 3 : 5);
    var fg = img('fg_yami');
    if (fg) ctx.drawImage(fg, 0, 0);
    // 賽（椀の下）
    var dice = img('yami_dice');
    if (Y.ball >= 0 && Y.phase !== 'list' && Y.phase !== 'offer') {
      var bs = slotOfCup(Y.ball), dx = SLOT_X[bs];
      if (Y.phase === 'shuffle' || Y.phase === 'pick') dx = cupPos(Y.ball).x;
      if (dice) ctx.drawImage(dice, Math.round(dx - 7), CUP_Y - 14);
    }
    // 椀（奥のものから）
    var wan = img('yami_wan');
    [0, 1, 2].map(function (c) { return { c: c, p: cupPos(c) }; }).sort(function (a, b) { return a.p.y - b.p.y; }).forEach(function (o) {
      var p = o.p;
      if (wan) ctx.drawImage(wan, Math.round(p.x - 22), Math.round(p.y - 36));
      else { ctx.fillStyle = '#2e1a12'; ctx.fillRect(Math.round(p.x - 20), Math.round(p.y - 30), 40, 30); }
      // 混ぜる手
      if (p.hand) {
        var hx = Math.round(p.x - 6), hy = Math.round(p.y - 40);
        ctx.fillStyle = '#5a3218'; ctx.fillRect(hx - 2, hy - 10, 16, 10);
        ctx.fillStyle = '#1c1220'; ctx.fillRect(hx - 1, hy - 1, 14, 9);
        ctx.fillStyle = '#f6c39c'; ctx.fillRect(hx, hy, 12, 7);
        ctx.fillStyle = '#d08a64'; ctx.fillRect(hx, hy + 5, 12, 2);
      }
      // 選べるときは、椀の上に小さな印
      if (Y.phase === 'pick') {
        ctx.fillStyle = 'rgba(255,230,176,' + (0.5 + 0.4 * Math.sin(t * 6)) + ')';
        ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 46), 6, 2);
        ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 44), 2, 2);
      }
    });
    // イカサマの一瞬のきらり
    if (Y.glint) {
      var gp = cupPos(Y.glint.cup);
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(Math.round(gp.x + 16), Math.round(gp.y - 32), 2, 2);
      ctx.fillRect(Math.round(gp.x + 14), Math.round(gp.y - 30), 6, 1);
    }
    // 見破ったとき：袖から賽がこぼれ落ちる
    if (Y.popDice && dice) {
      var u = Y.popDice.t;
      ctx.drawImage(dice, Math.round(YAMI_X + 26 + u * 20), Math.round(140 + u * 60 - Math.sin(Math.min(1, u * 2) * Math.PI) * 18));
    }
  }

  function finish() {
    var root = Y.root, got = Y.got, spent = Y.spent, saved = Y.saved;
    OT.smuggle.leave();
    root.innerHTML = '';
    root.appendChild(OT.ui.hud());
    root.appendChild(OT.el('h2', { class: 'scr-title', text: OT.t('smug.result') }));
    var list = OT.el('ul', { class: 'auc-log big' });
    var keys = Object.keys(got);
    if (!keys.length) list.appendChild(OT.el('li', { text: OT.t('smug.none') }));
    keys.forEach(function (id) { list.appendChild(OT.el('li', { text: OT.ingName(id) + ' ×' + got[id] })); });
    if (keys.length) list.appendChild(OT.el('li', { text: OT.t('smug.spent', { spent: spent, saved: saved }) }));
    root.appendChild(list);
    st().gamesToday += 1;
    OT.state.save();
    root.appendChild(OT.button(OT.t('auc.done'), function () { OT.flow.morning(); }, 'primary big'));
  }
})(window);
