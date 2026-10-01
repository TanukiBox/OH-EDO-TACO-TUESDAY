/*
 * 多幸寿：ミニゲーム「魚河岸の競り」（一山いくら）
 *   中身の見えない箱が5つ、1つずつ競りに出る。買えるのは1山だけ。
 *   手がかり（漁場の札・競り人の持ち上げ方・ガタッと暴れる・猫・上の一匹・覗き見）から中身を読み、
 *   値段が掛け声とともに下がっていく「下げ競り」で、最初に「買った！」と手を上げた人が競り落とす。
 *   ほぼ同時なら「声比べ」（連打）。最後に箱を開け、答え合わせ、棒手振りに売って、今朝の戦果。
 *   数字はすべて config.js の AUCTION と FISHER。ことばは text.js の 'ak.*'。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var doc = global.document;

  var A = null;
  function C() { return OT.CFG.AUCTION; }
  function st() { return OT.state.get(); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(weights) {   // { key: 重み } → key
    var keys = Object.keys(weights), sum = 0;
    keys.forEach(function (k) { sum += weights[k]; });
    var r = Math.random() * sum;
    for (var i = 0; i < keys.length; i++) { r -= weights[keys[i]]; if (r <= 0) return keys[i]; }
    return keys[keys.length - 1];
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function who(id) { var W = OT.STORY[OT.i18n.lang].who; return (W && W[id]) || id; }

  // 舞台（夜明けの魚河岸）の大きさと立ち位置（絵の一覧から）
  var MK = (global.OT_ART && global.OT_ART.market) || {};
  var SP = MK.spots || { seri: [192, 150], box: [192, 176], rivals: [[56, 232], [328, 232], [262, 224]], catY: 212, botefuri: [330, 214] };
  var SW = 384, SH = 216;

  /** 数字を漢数字に（掛け声用。四百八十 など） */
  function kanji(n) {
    var d = '〇一二三四五六七八九'.split(''), out = '';
    n = Math.max(0, Math.round(n));
    if (OT.i18n.lang !== 'ja') return String(n);
    var th = Math.floor(n / 1000), h = Math.floor(n / 100) % 10, t = Math.floor(n / 10) % 10, o = n % 10;
    if (th) out += (th > 1 ? d[th] : '') + '千';
    if (h) out += (h > 1 ? d[h] : '') + '百';
    if (t) out += (t > 1 ? d[t] : '') + '十';
    if (o) out += d[o];
    return out || '〇';
  }

  // ---------------------------------------------------------------
  // 箱をつくる（中身と、手がかり）
  // ---------------------------------------------------------------
  function fishOk(k) { var f = C().fish[k]; return f && !f.jackpot && f.chapter <= OT.state.chapter(); }

  function layerOf(kind, n) {
    var f = C().fish[kind];
    if (f.jackpot) {
      var items = Object.keys(f.gives).map(function (id) { return { id: id, n: f.gives[id] }; });
      var tot = items.reduce(function (a, b) { return a + b.n; }, 0);
      return { kind: kind, n: tot, jackpot: true, items: items, value: f.value, unit: Math.round(f.value / tot) };
    }
    return { kind: kind, n: n, items: [{ id: f.gives, n: n }], value: n * f.perPortion, unit: f.perPortion };
  }

  function makeBoxes() {
    var c = C(), G = c.grounds, boxes = [];
    var gw = {};
    Object.keys(G).forEach(function (k) { gw[k] = G[k].weight; });
    for (var i = 0; i < c.boxes; i++) {
      var ground = pick(gw), fw = {};
      Object.keys(G[ground].fish).forEach(function (k) { if (fishOk(k)) fw[k] = G[ground].fish[k]; });
      // 漁場の魚がその章で少ないときは、ほかの魚も少し混ざる
      if (Object.keys(fw).length < c.mixKinds) Object.keys(c.fish).forEach(function (k) { if (fishOk(k) && !fw[k]) fw[k] = c.mixFill; });
      if (!Object.keys(fw).length) fw = { kisu: 1 };
      var layers = [], got = {};
      for (var l = 0; l < 3; l++) {
        var w = {};   // すでに入った魚は、次の段に入りにくく（段ごとに別の魚になりやすい）
        Object.keys(fw).forEach(function (k) { w[k] = fw[k] * Math.pow(c.sameLayer, got[k] || 0); });
        var kind = pick(w);
        got[kind] = (got[kind] || 0) + 1;
        layers.push(layerOf(kind, Math.round(rnd(c.layerPortions[0], c.layerPortions[1]))));
      }
      boxes.push({ i: i, ground: ground, layers: layers, peeked: [true, false, false] });
    }
    // 大当たり：鯨組の日は鯨、ふだんはまれにヌシ。中か下の段にまるごと
    var jk = st().whaleDay && C().fish.kujira.chapter <= OT.state.chapter() ? 'kujira' : Math.random() < c.jackpotChance ? 'nushi' : null;
    if (jk) {
      var b = boxes[Math.floor(Math.random() * boxes.length)];
      b.layers[1 + Math.floor(Math.random() * 2)] = layerOf(jk);
      b.jackpot = jk;
    }
    boxes.forEach(function (b) {
      b.value = b.layers.reduce(function (a, L) { return a + L.value; }, 0);
      b.portions = b.layers.reduce(function (a, L) { return a + L.n; }, 0);
      b.big = b.layers.some(function (L) { return C().fish[L.kind].big; });
    });
    var avg = boxes.reduce(function (a, b) { return a + b.value; }, 0) / boxes.length;
    var K = c.clues;
    boxes.forEach(function (b) {
      b.good = b.value >= avg * K.goodRatio;
      var w = b.portions <= K.light ? 0 : b.portions >= K.heavy ? 2 : 1;
      if (Math.random() > K.weightTrue) w = Math.max(0, Math.min(2, w + (Math.random() < 0.5 ? -1 : 1)));
      b.weight = w;   // 0 軽い / 1 並 / 2 重い（見せる重さ）
      b.shake = Math.random() < (b.big ? K.shakeBig : K.shakeFalse);
      b.cat = Math.random() < (b.good ? K.catGood : K.catFalse);
      // 見た目からの相場（はじめの値段のもと）：上の段＋重さから見た残り
      var visible = b.layers[0].value + (b.weight + 1) * 4.5 * 12;
      b.start = Math.round(visible * rnd(c.startMul[0], c.startMul[1]) / 5) * 5;
    });
    return { boxes: boxes, avg: avg };
  }

  /** その朝のライバル（章で人数が増える。物語のライバル、寿司の親方の辰五郎はいつもいる） */
  function pickRivals() {
    var c = C(), ch = OT.state.chapter();
    var n = c.rivalsPerChapter[Math.min(5, ch - 1)];
    var pool = Object.keys(c.rivals).filter(function (k) { return c.rivals[k].chapter <= ch && k !== 'tatsu'; });
    pool.sort(function () { return Math.random() - 0.5; });
    var ids = ['tatsu'].concat(pool).slice(0, n);
    return ids.map(function (id, i) {
      return { id: id, cfg: c.rivals[id], slot: i, anim: 'wait', animT: 0, bubble: null, bubbleT: 0, got: [], lostClash: false };
    });
  }

  /** ライバルが箱にいくらまで出すか（目利きと好みと欲） */
  function rivalLimits(box) {
    var easy = st().day === 1 ? C().firstDayEasy : 1;
    A.rivals.forEach(function (r) {
      var R = r.cfg, like = 0, tot = 0;
      box.layers.forEach(function (L) { like += (R.likes[L.kind] || 1) * L.n; tot += L.n; });
      var est = box.value * (1 + (Math.random() * 2 - 1) * (1 - R.skill) * 0.6) * (like / tot);
      r.limit = Math.round(est * R.greed * easy);
      // 反応：良い箱で正直に身を乗り出す / ずる賢いのは悪い箱で、わざと興味のあるふり
      r.react = (box.good && Math.random() < R.tell) ? 'tell' : (!box.good && Math.random() < R.bluff) ? 'bluff' : null;
      if (r.react === 'bluff') r.limit = Math.round(r.limit * 0.9);
      r.pendingAt = 0; r.raisedAt = 0;
    });
  }

  // ---------------------------------------------------------------
  // 画面
  // ---------------------------------------------------------------
  OT.auction = {
    enter: function () {
      var root = OT.ui.screen('auction');
      root.innerHTML = '';
      root.classList.add('ak');
      var made = makeBoxes();
      A = { root: root, boxes: made.boxes, avg: made.avg, lot: -1, phase: 'intro', t: 0, peeks: C().peeks,
            rivals: pickRivals(), bought: null, price: 0, log: [], seri: { anim: 'wait', t: 0 }, cat: { x: -40, anim: 'walk', target: null, leave: false, t: 0 },
            shakeT: 0, shakeNext: 1, soldBoxes: [] };
      root.appendChild(OT.ui.hud());
      // 5つの箱の並び
      A.lotsEl = OT.el('div', { class: 'ak-lots' });
      root.appendChild(A.lotsEl);
      // 舞台
      A.stage = OT.el('div', { class: 'ak-stage' });
      A.canvas = OT.ui.pixelCanvas(SW, SH, 'ak-canvas');
      A.stage.appendChild(A.canvas);
      A.tag = OT.el('div', { class: 'ak-fuda' });
      A.stage.appendChild(A.tag);
      A.seriBubble = OT.el('div', { class: 'ak-bubble seri' });
      A.stage.appendChild(A.seriBubble);
      A.rivals.forEach(function (r) {
        r.el = OT.el('div', { class: 'ak-bubble rival', style: 'left:' + (SP.rivals[r.slot][0] / SW * 100) + '%' });
        A.stage.appendChild(r.el);
      });
      A.gata = OT.el('div', { class: 'ak-gata', text: OT.t('ak.gata') });
      A.stage.appendChild(A.gata);
      A.stageMsg = OT.el('div', { class: 'ak-msg' });
      A.stage.appendChild(A.stageMsg);
      A.stage.addEventListener('pointerdown', function (e) {
        if (!A) return;
        if (A.phase === 'bid') { e.preventDefault(); bid(); }
        else if (A.phase === 'clash') { e.preventDefault(); mash(); }
        else if (A.phase === 'present' && A.boxShown && A.t > 2.4) { e.preventDefault(); startBid(); }   // 見終わったら、舞台のタップですぐ競りへ
      });
      root.appendChild(A.stage);
      // 下の段（箱の中身と手がかり、値段と「買った！」）
      A.lower = OT.el('div', { class: 'ak-lower' });
      root.appendChild(A.lower);
      renderLots();
      intro();
      A.last = performance.now();
      A.raf = requestAnimationFrame(loop);
      OT.input.onPress = function (p) { if (p.source === 'key' && A) { if (A.phase === 'bid') bid(); else if (A.phase === 'clash') mash(); } };
    },
    leave: function () { if (A && A.raf) cancelAnimationFrame(A.raf); OT.input.onPress = null; if (A) A.root.classList.remove('ak'); A = null; },
    _peek: function () { return A; }
  };

  function setLower(nodes) { A.lower.innerHTML = ''; nodes.forEach(function (n) { if (n) A.lower.appendChild(n); }); }

  function renderLots() {
    A.lotsEl.innerHTML = '';
    A.boxes.forEach(function (b, i) {
      var cls = 'ak-lot' + (i === A.lot ? ' now' : '') + (b.owner ? ' done' : '') + (b.owner === 'me' ? ' mine' : '') + (A.whisper === i ? ' tip' : '');
      var el = OT.el('div', { class: cls }, [
        OT.el('span', { class: 'n', text: String(i + 1) }),
        OT.el('span', { class: 'g', text: OT.t('ak.g.' + b.ground) })
      ]);
      if (b.owner) {
        var face = OT.ui.pixelCanvas(48, 48, 'ak-lot-face');
        OT.sprites.drawFace(face, b.owner === 'me' ? 'mateo_happi' : b.owner, false);
        el.appendChild(face);
      }
      A.lotsEl.appendChild(el);
    });
  }

  // ---------------------------------------------------------------
  // はじまり（遊び方・耳打ち）
  // ---------------------------------------------------------------
  function intro() {
    A.phase = 'intro';
    var list = OT.el('ul', { class: 'ak-howto' });
    ['h1', 'h2', 'h3', 'h4'].forEach(function (k) { list.appendChild(OT.el('li', { text: OT.t('ak.' + k) })); });
    var rv = OT.el('div', { class: 'ak-rivals' });
    A.rivals.forEach(function (r) {
      var f = OT.ui.pixelCanvas(48, 48, 'ak-rival-face');
      OT.sprites.drawFace(f, r.id, false);
      rv.appendChild(OT.el('div', { class: 'ak-rival' }, [f, OT.el('b', { text: who(r.id) }), OT.el('span', { text: OT.t('ak.r.' + r.id) })]));
    });
    setLower([OT.el('div', { class: 'ak-intro' }, [OT.button(OT.t('auc.start'), start, 'primary big ak-start'), list, OT.el('div', { class: 'ak-sub', text: OT.t('ak.today') }), rv])]);
    say(A.seriBubble, OT.t('ak.seri.hello'), 3);
    if (OT.tut) OT.tut.point('a1', '#scr-auction .ak-start');
  }

  function start() {
    if (OT.tut) OT.tut.done('a1');
    OT.sfx.bell();
    // 常連漁師の耳打ち
    var s = st(), W = C().whisper, trust = s.fisherTrust || 0;
    if (trust > 0 && Math.random() < trust * W.perTrust) {
      s.fisherTrust = trust - 1;
      var best = 0;
      A.boxes.forEach(function (b, i) { if (b.value > A.boxes[best].value) best = i; });
      var idx = Math.random() < W.accuracy ? best : Math.floor(Math.random() * A.boxes.length);
      A.whisper = idx;
      renderLots();
      OT.dialog([['hamazo', OT.t('ak.whisper', { n: idx + 1, g: OT.t('ak.g.' + A.boxes[idx].ground) })]], nextLot);
      return;
    }
    nextLot();
  }

  // ---------------------------------------------------------------
  // 1箱ずつ：見せる → 下げ競り → 決まり
  // ---------------------------------------------------------------
  function nextLot() {
    A.lot++;
    if (A.lot >= A.boxes.length) { afterLots(); return; }
    var b = A.boxes[A.lot];
    A.box = b;
    rivalLimits(b);
    A.phase = 'present';
    A.t = 0;
    A.price = b.start;
    A.boxShown = false;
    A.cue = { cat: false, gata: false };
    A.shakeNext = rnd(1.4, 2.6);
    A.cat = { x: Math.random() < 0.5 ? -30 : SW + 30, anim: 'walk', target: null, leave: false, t: 0, come: b.cat ? rnd(0.8, 2.0) : (Math.random() < 0.35 ? rnd(1, 2.5) : -1) };
    A.rivals.forEach(function (r) { r.anim = 'wait'; r.animT = 0; r.twitchT = 0; });
    // 競り人が箱を持ち上げる（重さの手がかり）
    A.seri.anim = b.weight === 2 ? 'heavy' : 'lift';
    A.seri.t = 0;
    say(A.seriBubble, OT.t('ak.seri.w' + b.weight), 1.8);
    if (b.weight === 2) OT.sfx.thud(); else OT.sfx.tap();
    renderLots();
    renderInfo();
  }

  /** 箱の中身（3段）と手がかり・値段の板・「買った！」 */
  function renderInfo() {
    var b = A.box;
    var clues = OT.el('div', { class: 'ak-clues' }, [
      OT.el('span', { class: 'ak-chip fuda', text: OT.t('ak.g.' + b.ground) }),
      OT.el('span', { class: 'ak-chip w' + (A.boxShown ? b.weight : 'x'), text: A.boxShown ? OT.t('ak.w' + b.weight) : '…' }),
      A.cue && A.cue.cat ? OT.el('span', { class: 'ak-chip on', text: '🐈 ' + OT.t('ak.catStay') }) : null,
      A.cue && A.cue.gata ? OT.el('span', { class: 'ak-chip on', text: '💥 ' + OT.t('ak.gata') }) : null
    ].filter(Boolean));
    var dan = OT.el('div', { class: 'ak-dans' });
    b.layers.forEach(function (L, i) {
      var open = b.peeked[i];
      var row = OT.el('button', { class: 'ak-dan' + (open ? ' open' : '') + (i === 0 ? ' top' : ''), 'data-i': i }, [
        OT.el('span', { class: 'lbl', text: OT.t('ak.dan' + i) }),
        open ? layerIcons(L) : OT.el('span', { class: 'peek', text: A.peeks > 0 ? OT.t('ak.peek', { n: A.peeks }) : OT.t('ak.noPeek') })
      ]);
      if (!open) row.addEventListener('click', function () { peek(i); });
      dan.appendChild(row);
    });
    A.priceEl = OT.el('div', { class: 'ak-price' });
    A.buyBtn = OT.el('button', { class: 'ak-buy', text: OT.t('ak.buy') });
    A.buyBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); if (A.phase === 'bid') bid(); else if (A.phase === 'clash') mash(); });
    var board = OT.el('div', { class: 'ak-board' }, [A.priceEl, A.buyBtn]);
    setLower([clues, dan, board]);
    updatePrice();
  }

  function layerIcons(L) {
    var wrap = OT.el('span', { class: 'ak-fish' + (L.jackpot ? ' jackpot' : '') });
    L.items.forEach(function (it) {
      var c = OT.ui.pixelCanvas(32, 32, 'ak-ico');
      OT.art.drawIcon(c, it.id);
      wrap.appendChild(c);
    });
    wrap.appendChild(OT.el('b', { text: OT.t('ak.f.' + L.kind) + ' ×' + L.n }));
    return wrap;
  }

  function peek(i) {
    if (!A || (A.phase !== 'present' && A.phase !== 'bid') || A.peeks <= 0 || A.box.peeked[i]) { OT.sfx.denied(); return; }
    A.peeks--;
    A.box.peeked[i] = true;
    OT.sfx.open();
    renderInfo();
  }

  function updatePrice() {
    if (!A.priceEl) return;
    var p = A.price;
    A.priceEl.innerHTML = '<b>' + esc(kanji(p)) + '</b><span>' + OT.t('ui.money', { n: p }) + '</span>' + (st().money < p ? '<i>' + OT.t('ak.poor') + '</i>' : '');
    A.priceEl.className = 'ak-price' + (A.phase === 'bid' ? ' live' : '');
    A.buyBtn.disabled = !(A.phase === 'bid' || A.phase === 'clash');
    A.buyBtn.classList.toggle('mash', A.phase === 'clash');
    A.buyBtn.textContent = A.phase === 'clash' ? OT.t('ak.mash') : OT.t('ak.buy');
  }

  function say(el, text, sec) {
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('on'); }, (sec || 1.5) * 1000);
  }

  function startBid() {
    A.phase = 'bid';
    A.t = 0;
    A.tick = 0;
    A.seri.anim = 'call';
    say(A.seriBubble, OT.t('ak.seri.start') + kanji(A.price) + '！', 1.2);
    OT.sfx.call();
    updatePrice();
    if (OT.tut && st().day === 1) OT.tut.point('a2', '#scr-auction .ak-buy');
  }

  /** プレイヤーが「買った！」 */
  function bid() {
    if (A.phase !== 'bid') return;
    if (st().money < A.price) { OT.sfx.denied(); flashMsg(OT.t('ak.poor')); return; }
    var now = A.t;
    // ほぼ同時：手を上げかけている・上げたばかりのライバルがいたら、声比べ
    var rival = null;
    A.rivals.forEach(function (r) {
      if ((r.pendingAt && r.pendingAt - now <= C().clashWindow) || (r.raisedAt && now - r.raisedAt <= C().clashWindow)) rival = rival || r;
    });
    if (rival) { clash(rival); return; }
    won(null);
  }

  // --- 声比べ ---
  function clash(r) {
    A.phase = 'clash';
    A.clash = { r: r, me: 3, them: 3, t: 0 };
    r.anim = 'shout';
    A.seri.anim = 'wait';
    OT.sfx.call();
    A.clashEl = OT.el('div', { class: 'ak-clash' }, [
      OT.el('div', { class: 'cb me', text: OT.t('ak.katta') }),
      OT.el('div', { class: 'cb them', text: OT.t('ak.katta') }),
      OT.el('div', { class: 'ak-clash-title', text: OT.t('ak.clash') })
    ]);
    A.stage.appendChild(A.clashEl);
    updatePrice();
  }
  function mash() {
    if (A.phase !== 'clash') return;
    A.clash.me += 1;
    OT.sfx.tap();
  }
  function clashUpdate(dt) {
    var K = A.clash;
    K.t += dt;
    K.them += K.r.cfg.voice * dt * rnd(0.8, 1.2);
    var share = K.me / (K.me + K.them);
    var me = A.clashEl.querySelector('.me'), them = A.clashEl.querySelector('.them');
    me.style.transform = 'translateX(' + ((share - 0.5) * 80) + '%) scale(' + (0.7 + share) + ')';
    them.style.transform = 'translateX(' + ((share - 0.5) * 80) + '%) scale(' + (1.7 - share) + ')';
    if (K.t >= C().clashSeconds || share > 0.8 || share < 0.2) {
      A.stage.removeChild(A.clashEl);
      if (share >= 0.5) { K.r.lostClash = true; K.r.anim = 'sad'; say(K.r.el, OT.t('ak.rs.' + K.r.id), 1.6); won(null, true); }
      else won(K.r, true);
    }
  }

  /** 決まり（winner = ライバル / null = 自分） */
  function won(r, fromClash) {
    var b = A.box, price = A.price;
    A.phase = 'sold';
    A.t = 0;
    b.price = price;
    if (!r) {
      b.owner = 'me';
      A.bought = b;
      st().money -= price;
      refreshMoney();
      OT.sfx.buy();
      if (price > b.value * C().overpay) { A.seri.anim = 'laugh'; say(A.seriBubble, OT.t('ak.seri.tease'), 2); OT.sfx.laugh(); }
      else { A.seri.anim = 'call'; say(A.seriBubble, OT.t('ak.seri.me'), 1.6); }
      flashMsg(OT.t('ak.got', { n: price }), 'won');
      A.rivals.forEach(function (x) { if (x.limit >= price * 0.9 && x.anim !== 'sad') { x.anim = 'sad'; say(x.el, OT.t('ak.rs.' + x.id), 1.4); } });
    } else {
      b.owner = r.id;
      r.got.push(b);
      r.anim = 'carry';
      say(r.el, OT.t('ak.rc.' + r.id), 1.6);
      A.seri.anim = 'call';
      say(A.seriBubble, OT.t('ak.seri.them', { name: who(r.id) }), 1.4);
      OT.sfx.lost();
    }
    A.soldBoxes.push(b);
    renderLots();
    updatePrice();
  }

  function flashMsg(text, cls) {
    A.stageMsg.textContent = text;
    A.stageMsg.className = 'ak-msg on ' + (cls || '');
    clearTimeout(A.msgT);
    A.msgT = setTimeout(function () { if (A) A.stageMsg.className = 'ak-msg'; }, 1300);
  }

  function refreshMoney() {
    var el = A.root.querySelector('.hud-money');
    if (el) el.textContent = '💰 ' + OT.t('ui.money', { n: st().money });
  }

  /** 自分が買ったあとの残りの箱は、ライバルたちがさっさと買っていく */
  function rushRest() {
    A.boxes.forEach(function (b, i) {
      if (i <= A.lot || b.owner) return;
      A.box = b;
      rivalLimits(b);
      var sorted = A.rivals.slice().sort(function (x, y) { return y.limit - x.limit; });
      var w = sorted[0];
      b.price = Math.max(Math.round(b.start * C().floorMul), sorted[1] ? Math.min(w.limit, sorted[1].limit + 5) : Math.round(w.limit * 0.9));
      b.owner = w.id;
      w.got.push(b);
    });
    A.lot = A.boxes.length - 1;
    renderLots();
  }

  // ---------------------------------------------------------------
  // 毎フレーム
  // ---------------------------------------------------------------
  function loop(now) {
    if (!A) return;
    var dt = Math.min(0.05, (now - A.last) / 1000);
    A.last = now;
    if (!OT.dialogOpen()) update(dt);
    draw(now / 1000);
    if (A) A.raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    var c = C();
    A.t += dt;
    A.seri.t += dt;
    A.rivals.forEach(function (r) { r.animT += dt; });
    if (A.phase === 'present') {
      if (A.t > 1.7 && !A.boxShown) { A.boxShown = true; A.seri.anim = 'wait'; renderInfo(); revealCues(); }
      if (A.boxShown) cues(dt);
      if (A.t >= c.showSeconds + 1.7) startBid();
    } else if (A.phase === 'bid') {
      cues(dt);
      A.tick += dt;
      if (A.tick >= c.tickSeconds) {
        A.tick = 0;
        A.price = Math.max(1, Math.round(A.price - A.box.start * c.stepRate));
        if (Math.random() < 0.6) say(A.seriBubble, kanji(A.price) + '！', 0.4);
        OT.sfx.call(true);
        updatePrice();
      }
      rivalsBid();
    } else if (A.phase === 'clash') {
      clashUpdate(dt);
    } else if (A.phase === 'sold') {
      if (A.t > 1.8) {
        if (A.bought && A.lot < A.boxes.length - 1) { rushRest(); afterLots(); }
        else nextLot();
      }
    }
    // 猫
    catUpdate(dt);
  }

  /** ライバルの手：限界が近いと手がぴくっ。フェイントも。限界をこえたら、手を上げる */
  function rivalsBid() {
    var c = C(), now = A.t;
    var floor = Math.round(A.box.start * c.floorMul);
    A.rivals.forEach(function (r) {
      if (r.anim === 'raise') return;
      if (!r.pendingAt && A.price <= r.limit) r.pendingAt = now + r.cfg.react * rnd(0.8, 1.25);
      // 限界の少し上で手がぴくっ（フェイントもある）
      var near = A.price <= r.limit * 1.12 && A.price > r.limit;
      if ((near && Math.random() < 0.08) || Math.random() < r.cfg.feint * 0.03) { if (r.anim !== 'twitch') { r.anim = 'twitch'; r.animT = 0; } }
      else if (r.anim === 'twitch' && r.animT > 0.5) r.anim = r.react ? 'lean' : 'wait';
      if (r.pendingAt && now >= r.pendingAt && !r.raisedAt) {
        r.raisedAt = now;
        r.anim = 'raise';
        say(r.el, OT.t('ak.katta'), 0.8);
        OT.sfx.call();
      }
    });
    // 手を上げてから少し待って（ほぼ同時なら声比べ）、決まり
    var raised = A.rivals.filter(function (r) { return r.raisedAt && now - r.raisedAt > c.clashWindow; });
    if (raised.length) { won(raised[0]); return; }
    if (A.price <= floor) {   // だれも手を上げないまま下がりきったら、いちばん出せるライバルが買う
      var best = A.rivals.slice().sort(function (x, y) { return y.limit - x.limit; })[0];
      won(best);
    }
  }

  /** 手がかりの演出（ガタッ・ライバルの反応） */
  function revealCues() {
    A.rivals.forEach(function (r) {
      if (r.react) { r.anim = 'lean'; r.animT = 0; setTimeout(function () { if (A && r.anim === 'lean') say(r.el, OT.t('ak.rl.' + r.id), 1.6); }, 400 + r.slot * 300); }
    });
  }
  function cues(dt) {
    var b = A.box;
    if (b.shake) {
      A.shakeNext -= dt;
      if (A.shakeNext <= 0) {
        A.shakeNext = rnd(2.2, 3.6);
        A.shakeT = 0.35;
        OT.sfx.gata();
        A.gata.classList.remove('on'); void A.gata.offsetWidth; A.gata.classList.add('on');
        if (!A.cue.gata) { A.cue.gata = true; renderInfo(); }
      }
    }
    if (A.shakeT > 0) A.shakeT -= dt;
  }

  // --- 猫：良い箱には寄ってきて、離れない ---
  function catUpdate(dt) {
    var K = A.cat, b = A.box;
    if (!b || A.phase === 'intro') return;
    K.t += dt;
    var bx = SP.box[0];
    if (K.come >= 0 && K.t > K.come && !K.target && !K.leave) K.target = bx + (K.x < bx ? -38 : 38);
    if (K.target !== null && K.target !== undefined) {
      var d = K.target - K.x;
      if (Math.abs(d) > 1.5) { K.x += Math.sign(d) * dt * 55; K.anim = 'walk'; K.flip = d < 0; }
      else {
        K.x = K.target;
        if (K.anim === 'walk') {
          K.anim = 'sit'; K.sitT = 0;
          if (b.cat) { OT.sfx.meow(); K.anim = 'meow'; setTimeout(function () { if (A && A.cat === K) K.anim = 'sit'; }, 600); if (!A.cue.cat) { A.cue.cat = true; renderInfo(); } }
        }
        K.sitT = (K.sitT || 0) + dt;
        if (!b.cat && K.sitT > 1.2 && !K.leave) { K.leave = true; K.target = K.x < bx ? -40 : SW + 40; }
      }
    }
    if (A.phase === 'sold' && b.owner && b.owner !== 'me' && !K.leave) { K.leave = true; K.target = K.x < bx ? -40 : SW + 40; }
  }

  // ---------------------------------------------------------------
  // 絵
  // ---------------------------------------------------------------
  function draw(time) {
    var ctx = A.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var bg = OT.sprites.get('mk_bg');
    if (bg && bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0);
    else { ctx.fillStyle = '#243f7a'; ctx.fillRect(0, 0, SW, SH); }
    // 競り人
    var sfps = A.seri.anim === 'heavy' ? 6 : A.seri.anim === 'lift' ? (A.box && A.box.weight === 0 ? 6 : 2) : 3;   // 軽い箱は、ひょいひょいと
    OT.sprites.drawPerson(ctx, 'seri', A.seri.anim, A.seri.t, SP.seri[0], SP.seri[1], false, sfps);
    // 箱（競り台の前）
    var hako = OT.sprites.get('mk_hako'), b = A.box;
    var showBox = b && A.boxShown && !(A.phase === 'sold' && b.owner && b.owner !== 'me' && A.t > 0.4);
    if (hako && hako.complete && hako.naturalWidth && showBox) {
      var jx = A.shakeT > 0 ? Math.round(Math.sin(time * 90) * 2) : 0, jy = A.shakeT > 0 ? -Math.round(Math.abs(Math.sin(time * 60)) * 2) : 0;
      ctx.drawImage(hako, Math.round(SP.box[0] - 40 + jx), Math.round(SP.box[1] - 28 + jy));
    }
    A.tag.style.display = showBox ? 'block' : 'none';
    if (showBox) { A.tag.textContent = OT.t('ak.g.' + b.ground); A.tag.style.left = ((SP.box[0] + 14) / SW * 100) + '%'; A.tag.style.top = ((SP.box[1] - 10) / SH * 100) + '%'; }
    A.gata.style.left = (SP.box[0] / SW * 100) + '%';
    A.gata.style.top = ((SP.box[1] - 40) / SH * 100) + '%';
    // 猫
    var catImg = OT.sprites.get('mk_cat'), CM = MK.cat;
    if (catImg && catImg.complete && catImg.naturalWidth && CM && A.cat && A.phase !== 'intro') {
      var fr = CM[A.cat.anim] || CM.sit, f = fr[Math.floor(time * (A.cat.anim === 'walk' ? 8 : 2)) % fr.length];
      ctx.save();
      ctx.translate(Math.round(A.cat.x), 0);
      if (A.cat.flip) ctx.scale(-1, 1);
      ctx.drawImage(catImg, f * 48, 0, 48, 40, -24, SP.catY - 40, 48, 40);
      ctx.restore();
    }
    // ライバル（右側の人は左を向く）
    A.rivals.forEach(function (r) {
      var p = SP.rivals[r.slot];
      var gone = r.anim === 'carry' && A.phase === 'sold' && A.box && A.box.owner === r.id;
      var x = p[0] + (gone ? (p[0] < SW / 2 ? -1 : 1) * Math.max(0, A.t - 0.6) * 90 : 0);
      OT.sprites.drawPerson(ctx, r.id, r.anim, r.animT + r.slot * 0.3, x, p[1], p[0] > SW / 2, r.anim === 'twitch' ? 8 : 3);
      r.el.style.left = (x / SW * 100) + '%';
    });
  }

  // ---------------------------------------------------------------
  // 競りのあと：開ける → 答え合わせ → 棒手振り → 今朝の戦果
  // ---------------------------------------------------------------
  function afterLots() {
    if (OT.tut) OT.tut.done('a2');   // 競りが終わったら「買った！」の案内は消す
    A.box = null;
    A.phase = 'after';
    A.seri.anim = 'wait';
    A.rivals.forEach(function (r) { r.anim = r.got.length ? 'carry' : 'wait'; });
    if (A.bought) openBox(); else answer();
  }

  /** 競り落とした箱を、タップするたびに一段ずつ開ける */
  function openBox() {
    var b = A.bought, opened = 0;
    var title = OT.el('div', { class: 'ak-after-title', text: OT.t('ak.open') });
    var box = OT.el('div', { class: 'ak-openbox' });
    var rows = b.layers.map(function (L, i) {
      var row = OT.el('div', { class: 'ak-dan big' + (i === 0 ? ' open' : '') }, [OT.el('span', { class: 'lbl', text: OT.t('ak.dan' + i) }), layerIcons(L), OT.el('div', { class: 'lid' })]);
      box.appendChild(row);
      return row;
    });
    rows[0].classList.add('opened');
    opened = 1;
    var next = OT.button(OT.t('ak.toAnswer'), function () { answer(); }, 'primary big ak-next');
    next.style.visibility = 'hidden';
    box.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (opened >= 3) return;
      var L = b.layers[opened], row = rows[opened];
      row.classList.add('opened');
      OT.sfx.open();
      if (L.jackpot) jackpotFx(L.kind);
      opened++;
      if (opened >= 3) {
        setTimeout(function () {
          if (!A) return;
          var card = mineCard(b, false);
          box.parentNode.insertBefore(card, box);   // 箱の上に出して、すぐ見えるように
          A.lower.scrollTop = 0;
          verdictSound(verdictOf(b));
          next.style.visibility = 'visible';
          if (OT.tut) OT.tut.point('a4', '#scr-auction .ak-next');
        }, L.jackpot ? 2900 : 450);
      }
    });
    setLower([title, box, OT.el('div', { class: 'ak-sub', text: OT.t('ak.openHint') }), next]);
  }

  /** ヌシや鯨：スローモーションと大きな書き文字 */
  function jackpotFx(kind) {
    var fx = OT.el('div', { class: 'ak-jackpot' }, [
      OT.el('div', { class: 'big', text: OT.t('ak.jp.' + kind) }),
      OT.el('div', { class: 'small', text: OT.t('ak.jackpot') })
    ]);
    var key = kind === 'kujira' ? 'cr_fish_kujira' : 'cr_sea_nushi_0';
    if (OT.sprites.has(key)) {
      var im = OT.sprites.get(key), c = OT.ui.pixelCanvas(im.naturalWidth, im.naturalHeight, 'ak-jp-fish');
      c.getContext('2d').drawImage(im, 0, 0);
      fx.insertBefore(c, fx.firstChild);
    }
    for (var k = 0; k < 14; k++) fx.appendChild(OT.el('i', { class: 'spark', style: 'left:' + (5 + Math.random() * 90) + '%;top:' + (10 + Math.random() * 70) + '%;animation-delay:' + (k * 0.09) + 's' }));
    A.root.appendChild(fx);
    OT.sfx.jackpot();
    setTimeout(function () { fx.classList.add('out'); }, 2600);
    setTimeout(function () { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 3000);
  }

  /** 自分の山の判定：jackpot 大当たり / great 当たり / good まずまず / fair ちょっと高くついた / bad はずれ */
  function verdictOf(b) {
    var V = C().verdict, r = b.value / Math.max(1, b.price);
    if (b.jackpot) return 'jackpot';
    return r >= V.great ? 'great' : r >= V.good ? 'good' : r >= V.fair ? 'fair' : 'bad';
  }
  /** 5箱の中で、何番目にお得だったか（得 = 値打ち − 値段） */
  function rankOf(b) {
    var gains = A.boxes.map(function (x) { return x.value - (x.price || 0); }).sort(function (x, y) { return y - x; });
    return gains.indexOf(b.value - b.price) + 1;
  }
  /** 自分の山の札：中身・値打ち・払った値段・得か損か・判定 */
  function mineCard(b, compact) {
    var v = verdictOf(b), gain = b.value - b.price, rank = rankOf(b);
    var face = OT.ui.pixelCanvas(48, 48, 'ak-mine-face');
    OT.sprites.drawFace(face, 'mateo_happi', v === 'fair' || v === 'bad' ? 'sad' : true);
    return OT.el('div', { class: 'ak-mine v-' + v + (compact ? ' compact' : '') }, [
      OT.el('div', { class: 'ak-mine-head' }, [face, OT.el('div', {}, [
        OT.el('div', { class: 'ak-mine-title', text: OT.t('ak.mine') + '：' + OT.t('ak.v.' + v) }),
        OT.el('div', { class: 'ak-mine-gain ' + (gain >= 0 ? 'plus' : 'minus'), text: gain >= 0 ? OT.t('ak.profit', { n: gain }) : OT.t('ak.loss', { n: -gain }) })
      ])]),
      compact ? OT.el('div', { class: 'body' }, b.layers.map(function (L) { return layerIcons(L); })) : null,
      OT.el('div', { class: 'ak-mine-rows' }, [
        OT.el('span', { text: OT.t('ak.value', { n: b.value }) }),
        OT.el('span', { text: OT.t('ak.paid', { n: b.price }) }),
        OT.el('b', { text: rank === 1 ? OT.t('ak.rankTop') : OT.t('ak.rank', { n: rank, m: A.boxes.length }) })
      ])
    ]);
  }
  function verdictSound(v) {
    if (v === 'jackpot' || v === 'great') OT.sfx.happy(5);
    else if (v === 'good') OT.sfx.happy(3);
    else OT.sfx.lost();
  }

  /** 答え合わせ：ライバルが買った箱も開けて見せる */
  function answer() {
    if (OT.tut) OT.tut.done('a4');   // 答え合わせに来たら「開け終わったら…」の案内は消す
    var title = OT.el('div', { class: 'ak-after-title', text: OT.t('ak.answer') });
    var V = C().verdict;
    var mine = A.bought, myGain = mine ? mine.value - mine.price : 0;
    var top = mine ? mineCard(mine, true) : OT.el('div', { class: 'ak-mine v-none' }, [OT.el('div', { class: 'ak-mine-title', text: OT.t('ak.verdictNone') })]);
    var list = OT.el('div', { class: 'ak-answers' });
    var regrets = 0, k = 0;
    A.boxes.forEach(function (b, i) {
      if (b.owner === 'me') return;
      var gain = b.value - (b.price || 0);
      var verdict = '';
      if (gain - myGain >= Math.max(V.regretMin, b.value * V.regretRate)) { verdict = 'regret'; regrets++; }
      else if (b.jackpot) { verdict = 'jpmiss'; regrets++; }   // 大当たりの箱を見送った（得かどうかは別）
      else if (gain < -b.value * V.reliefRate) verdict = 'relief';   // ライバルが、はっきり高値をつかんだ
      var face = OT.ui.pixelCanvas(48, 48, 'ak-ans-face');
      OT.sprites.drawFace(face, b.owner, gain < 0 ? 'sad' : true);
      var card = OT.el('div', { class: 'ak-ans ' + verdict, style: 'animation-delay:' + (0.3 + k++ * 0.25) + 's' }, [
        OT.el('div', { class: 'head' }, [OT.el('span', { class: 'n', text: String(i + 1) }), OT.el('span', { class: 'g', text: OT.t('ak.g.' + b.ground) }), face,
          OT.el('span', { class: 'who', text: who(b.owner) }), OT.el('span', { class: 'pr', text: OT.t('ui.money', { n: b.price || 0 }) })]),
        OT.el('div', { class: 'body' }, b.layers.map(function (L) { return layerIcons(L); })),
        OT.el('div', { class: 'foot' }, [OT.el('span', { text: OT.t('ak.value', { n: b.value }) }), verdict ? OT.el('b', { text: OT.t('ak.' + verdict) }) : null].filter(Boolean))
      ]);
      list.appendChild(card);
    });
    // まとめのひとこと：まず自分の山。ほかに、はっきり得な箱があったときだけ悔しがる
    setTimeout(function () {
      if (!A) return;
      if (mine) { var v = verdictOf(mine); flashMsg(OT.t('ak.v.' + v), v === 'fair' || v === 'bad' ? 'lost' : 'won'); }
      else if (regrets) { OT.sfx.lost(); flashMsg(OT.t('ak.regretBig'), 'lost'); }
      else { OT.sfx.happy(3); flashMsg(OT.t('ak.reliefBig'), 'won'); }
    }, 300);
    var others = OT.el('div', { class: 'ak-sub', text: OT.t('ak.others') });
    var next = OT.button(A.bought ? OT.t('ak.toSell') : OT.t('ak.toResult'), function () { if (A.bought) sell(); else result(); }, 'primary big ak-next');
    setLower([title, top, others, list, next]);
  }

  /** 棒手振り（与吉）に、要らない魚を安く売る */
  function sell() {
    if (OT.tut) OT.tut.clear();
    var b = A.bought;
    A.keep = [];
    b.layers.forEach(function (L) { L.items.forEach(function (it) { A.keep.push({ id: it.id, n: it.n, unit: Math.max(1, Math.round(L.unit * C().sellRate)) }); }); });
    // 同じ食材はまとめる
    var merged = {};
    A.keep.forEach(function (k) { if (merged[k.id]) merged[k.id].n += k.n; else merged[k.id] = k; });
    A.keep = Object.keys(merged).map(function (k) { return merged[k]; });
    A.sold = 0;
    var title = OT.el('div', { class: 'ak-after-title', text: OT.t('ak.sell') });
    var face = OT.ui.pixelCanvas(48, 48, 'ak-bote-face');
    OT.sprites.drawFace(face, 'yokichi', true);
    var talk = OT.el('div', { class: 'ak-bote' }, [face, OT.el('span', { text: OT.t('ak.boteHello') })]);
    var list = OT.el('div', { class: 'ak-sell' });
    function render() {
      list.innerHTML = '';
      A.keep.forEach(function (k) {
        var c = OT.ui.pixelCanvas(32, 32, 'ak-ico');
        OT.art.drawIcon(c, k.id);
        var btn = OT.el('button', { class: 'ak-sell-btn', text: OT.t('ak.sell1', { n: k.unit }), disabled: k.n <= 0 ? 'disabled' : null, onclick: function () {
          if (k.n <= 0) return;
          k.n -= 1; A.sold += k.unit; st().money += k.unit; refreshMoney(); OT.sfx.coin(); render();
        } });
        list.appendChild(OT.el('div', { class: 'ak-sell-row' }, [c, OT.el('span', { class: 'nm', text: OT.ingName(k.id) }), OT.el('b', { text: '×' + k.n }), btn]));
      });
    }
    render();
    setLower([title, talk, list, OT.button(OT.t('ak.toResult'), result, 'primary big ak-next')]);
  }

  /** 今朝の戦果：買った山の中身・使ったお金・ライバルの悔しがる顔 */
  function result() {
    var b = A.bought;
    if (b) (A.keep || []).forEach(function (k) { if (k.n > 0) OT.state.addStock(k.id, k.n); });
    st().gamesToday += 1;
    OT.state.save();
    var title = OT.el('div', { class: 'ak-after-title', text: OT.t('ak.result') });
    var rows = OT.el('div', { class: 'ak-res' });
    if (b) {
      var got = OT.el('div', { class: 'ak-res-got' });
      (A.keep || []).forEach(function (k) {
        if (k.n <= 0) return;
        var c = OT.ui.pixelCanvas(32, 32, 'ak-ico');
        OT.art.drawIcon(c, k.id);
        got.appendChild(OT.el('span', { class: 'it' }, [c, OT.el('b', { text: OT.ingName(k.id) + ' ×' + k.n })]));
      });
      rows.appendChild(got);
      rows.appendChild(OT.el('div', { class: 'ak-res-row' }, [OT.el('span', { text: OT.t('ak.spent') }), OT.el('b', { text: OT.t('ui.money', { n: b.price }) })]));
      if (A.sold) rows.appendChild(OT.el('div', { class: 'ak-res-row' }, [OT.el('span', { text: OT.t('ak.soldBote') }), OT.el('b', { text: '+' + OT.t('ui.money', { n: A.sold }) })]));
      rows.appendChild(OT.el('div', { class: 'ak-res-row' }, [OT.el('span', { text: OT.t('ak.value2') }), OT.el('b', { text: OT.t('ui.money', { n: b.value }) })]));
      var gain = b.value - b.price;
      rows.appendChild(OT.el('div', { class: 'ak-res-row verdict v-' + verdictOf(b) }, [OT.el('span', { text: OT.t('ak.v.' + verdictOf(b)) }), OT.el('b', { text: gain >= 0 ? OT.t('ak.profit', { n: gain }) : OT.t('ak.loss', { n: -gain }) })]));
    } else rows.appendChild(OT.el('div', { class: 'ak-res-row' }, [OT.el('span', { text: OT.t('ak.none') })]));
    // ライバルの顔：自分が得をしたほど悔しがる
    var good = b && (verdictOf(b) === 'jackpot' || verdictOf(b) === 'great' || verdictOf(b) === 'good');
    var faces = OT.el('div', { class: 'ak-res-faces' });
    A.rivals.forEach(function (r) {
      var f = OT.ui.pixelCanvas(48, 48, 'ak-res-face');
      var sad = good || r.lostClash;
      OT.sprites.drawFace(f, r.id, sad ? 'sad' : true);
      faces.appendChild(OT.el('div', { class: 'ak-res-rival' }, [f, OT.el('span', { text: sad ? OT.t('ak.rs.' + r.id) : OT.t('ak.rc.' + r.id) })]));
    });
    rows.appendChild(faces);
    if (good) OT.sfx.happy(5);
    setLower([title, rows, OT.button(OT.t('auc.done'), function () { OT.auction.leave(); if (OT.tut) OT.tut.done('a3'); OT.flow.morning(); }, 'primary big ak-next')]);
    if (OT.tut) { OT.tut.done('a2'); OT.tut.done('a4'); OT.tut.point('a3', '#scr-auction .ak-next'); }
  }
})(window);
