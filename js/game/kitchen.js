/*
 * 多幸寿：厨房（3つの持ち場）
 *   注文（木札）… 客をタップして注文を聞くと、木札が紐に吊るされる（客の動きは night.js）
 *   焼き場 …… 七輪（網で焼く）・油鍋（揚げる）・藁焼き（炙る）の3つの画面。焼き加減で点が変わる
 *   盛り付け … 皮を置き、具・たれ・薬味をタップで持って、皮の上に置く・撒く・回しかける。包んで客に出す
 *   どの持ち場にいても、焼き場の時間と客の待ち時間は進み続ける。
 *   数字は config.js の KITCHEN と SCORE。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var doc = global.document;

  var K = null;
  function cfg() { return OT.CFG; }
  /** 厨房の数字。焼き場を改装していると、焼き加減の「ちょうど良い」の幅を広げる（焦げるのも、そのぶん遅く） */
  var kcCache = null;
  function KC() {
    var K = OT.CFG.KITCHEN, m = OT.upg ? OT.upg.value('yakiba', 'window') : 1;
    if (m === 1) return K;
    if (kcCache && kcCache.m === m && kcCache.src === K) return kcCache.v;
    var out = {};
    Object.keys(K).forEach(function (k) { out[k] = K[k]; });
    ['grill', 'fry', 'sear'].forEach(function (k) {
      var C = K[k], c = (C.done[0] + C.done[1]) / 2, h = (C.done[1] - C.done[0]) / 2 * m, o = {};
      Object.keys(C).forEach(function (x) { o[x] = C[x]; });
      o.done = [Math.max(c - h, C.flipAt ? C.flipAt + C.flipWindow * m + 0.05 : 0.3), c + h];
      o.burn = C.burn + (o.done[1] - C.done[1]);
      if (C.flipWindow) o.flipWindow = C.flipWindow * m;
      out[k] = o;
    });
    kcCache = { m: m, src: K, v: out };
    return out;
  }
  function st() { return OT.state.get(); }
  function ingOf(id) { return cfg().INGREDIENTS[id] || {}; }
  function useOf(id) {
    var g = ingOf(id);
    if (g.use) return g.use;
    return g.cat === 'herb' ? 'sprinkle' : g.cat === 'salsa' ? 'drizzle' : 'drop';
  }
  function chIdx() { return Math.min(5, OT.state.chapter() - 1); }
  function now() { return performance.now() / 1000; }

  // 焼き場の3つの画面（絵は art/blender/scenes.py の job_kitchen。置き場所は絵の一覧から読む）
  var KINDS = ['grill', 'fry', 'sear'];
  var ICON = { grill: '🔥', fry: '🍤', sear: '🌾' };
  var BG = { grill: 'k_shichirin', fry: 'k_fryer', sear: 'k_wara' };
  var SLOT_POS = {
    grill: [[0.159, 0.387], [0.311, 0.387], [0.689, 0.387], [0.841, 0.387]],
    fry: [[0.273, 0.429], [0.471, 0.429]],
    sear: [[0.5, 0.338]]
  };
  var OIL = [0.372, 0.429, 0.221, 0.3];          // 油の面（中心 x, y と 半径 x, y。画面の 0〜1）
  var SEAR_HANDLE = [0.895, 0.596];               // 藁焼きの串の持ち手
  var SCALE = { grill: 1.5, fry: 2, sear: 3 };     // 具の絵の大きさ
  var VW = 256, VH = 160;                          // 焼き場の絵の大きさ
  var BOARD = 128;                                 // 盛り付けの皮の絵の大きさ

  // ---------------------------------------------------------------
  // つくる
  // ---------------------------------------------------------------
  OT.kitchen = {
    /** night.js が夜のはじめに呼ぶ。rail と3つの持ち場とボタンを作る */
    build: function (N, root, stallEl) {
      K = { N: N, station: 'order', fire: 'grill', tickets: [], selected: null, nextId: 1, slots: [], warm: [],
            dish: null, folding: -1, foldT: 0, drag: null, stroke: null, tool: null, sfxT: 0, flameT: 0, parts: [] };
      var P = (OT.sprites.manifest.kitchen || {}).slots;
      if (P) {
        KINDS.forEach(function (k) { if (P[k]) SLOT_POS[k] = P[k]; });
        if (P.oil) OIL = P.oil;
        if (P.searHandle) SEAR_HANDLE = P.searHandle;
      }
      KINDS.forEach(function (kind) {
        var n = KC()[(kind === 'fry' ? 'fryer' : kind) + 'Slots'][chIdx()];
        SLOT_POS[kind].forEach(function (pos, i) {
          K.slots.push({ kind: kind, i: i, pos: pos, locked: i >= n, item: null });
        });
      });

      // 木札の紐
      K.rail = OT.el('div', { class: 'rail' });
      root.appendChild(K.rail);

      // 持ち場
      var stations = OT.el('div', { class: 'stations' });
      K.el = {};
      K.el.order = OT.el('div', { class: 'station st-order' }, [stallEl]);
      K.hint = OT.el('div', { class: 'st-hint' });
      K.el.order.appendChild(K.hint);
      K.el.grill = buildGrill();
      K.el.plate = buildPlate();
      stations.appendChild(K.el.order);
      stations.appendChild(K.el.grill);
      stations.appendChild(K.el.plate);
      root.appendChild(stations);
      K.card = OT.el('div', { class: 'score-card' });
      stations.appendChild(K.card);

      // 持ち場のボタン（親指で押せる下のほう）
      var bar = OT.el('div', { class: 'st-buttons' });
      K.btn = {};
      [['order', '🏮'], ['grill', '🔥'], ['plate', '🍽']].forEach(function (b) {
        var el = OT.el('button', { class: 'st-btn', 'data-st': b[0], onclick: function () { OT.sfx.tap(); OT.kitchen.go(b[0]); } }, [
          OT.el('span', { class: 'ico', text: b[1] }), OT.el('span', { text: OT.t('k.st.' + b[0]) })
        ]);
        K.btn[b[0]] = el;
        bar.appendChild(el);
      });
      root.appendChild(bar);
      setFire('grill');
      OT.kitchen.go('order');
      renderRail(); renderPlate(); drawBoard();
      return OT.kitchen;
    },

    go: function (station) {
      if (K.station !== station && K.card && !OT.kitchen.tutorialActive()) K.card.className = 'score-card';   // 持ち場を移ったら点数の札は消す
      K.station = station;
      Object.keys(K.el).forEach(function (k) { K.el[k].classList.toggle('on', k === station); });
      Object.keys(K.btn).forEach(function (k) { K.btn[k].classList.toggle('on', k === station); });
      if (station === 'plate') { renderPlate(); drawBoard(); }
      if (station === 'grill') {
        // 今の画面に用がなく、ほかの画面で用があれば、そちらを開く
        if (OT.kitchen.tutorialActive()) setFire('grill');
        else if (!needs(K.fire)) { var k2 = KINDS.filter(needs)[0]; setFire(k2 || K.fire); }
        else renderRaw();
      }
      OT.kitchen.tutorialCheck();
    },

    /** 客の注文を聞いて、木札を1枚つくる */
    takeOrder: function (g) {
      var t = { id: K.nextId++, guest: g, order: g.order, variant: g.variant };
      K.tickets.push(t);
      g.ticket = t.id;
      if (!K.selected) K.selected = t.id;
      renderRail();
      OT.sfx.place();
    },

    /** 客が帰ったら、その木札を外す */
    dropTicketFor: function (g) {
      K.tickets = K.tickets.filter(function (t) { return t.guest !== g; });
      if (K.selected && !K.tickets.some(function (t) { return t.id === K.selected; })) K.selected = K.tickets.length ? K.tickets[0].id : null;
      renderRail();
    },

    update: update,
    draw: function () {
      if (K.station === 'grill') drawFire();
      if (K.station === 'plate' && (K.dirty || K.folding >= 0 || K.parts.length)) { drawBoard(); K.dirty = false; }
    },
    isBusy: function () { return K && (K.folding >= 0); },
    leave: function () { if (K && K.ghost && K.ghost.parentNode) K.ghost.parentNode.removeChild(K.ghost); K = null; },
    _peek: function () { return K; },
    setFire: function (k) { setFire(k); },

    /** 採点の結果を短く見せる（持ち場の上に） */
    showCard: function (g, res) {
      var P = res.parts || {};
      var rows = [['wait', P.wait], ['cook', P.cook], ['plate', P.plate], ['pref', P.pref]].map(function (r) {
        var v = Math.round((r[1] === undefined ? 1 : r[1]) * 100);
        return '<div class="sc-row"><span>' + OT.t('k.score.' + r[0]) + '</span><i><b style="width:' + v + '%"></b></i><em>' + v + '%</em></div>';
      }).join('');
      K.card.innerHTML = '<div class="sc-name">' + escapeHtml(g.name || OT.t('cust.' + g.typeId)) + '</div>' +
        '<div class="sc-stars">' + '★'.repeat(res.stars) + '<s>' + '★'.repeat(5 - res.stars) + '</s></div>' + rows +
        '<div class="sc-pay">+' + res.pay + OT.t('ui.mon') + (res.tip ? '　' + OT.t('k.tip', { n: res.tip }) : '') + '</div>';
      K.card.className = 'score-card on s' + res.stars;
      clearTimeout(K.cardT);
      K.cardT = setTimeout(function () { if (K) K.card.className = 'score-card'; }, 2600);
    }
  };

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------------------------------------------------------------
  // 木札
  // ---------------------------------------------------------------
  function ticketSteps(t) {
    if (!t.order) return null;
    var r = cfg().TACOS[t.order];
    return [r.skin].concat(OT.needOf(t.order, t.variant));
  }

  function hintsOf(g) {
    // おまかせの客：好きな味の上位2つ
    var keys = ['hot', 'sour', 'umami', 'aroma', 'texture'];
    var idx = [0, 1, 2, 3, 4].sort(function (a, b) { return g.want[b] * g.type.weight[b] - g.want[a] * g.type.weight[a]; });
    return idx.slice(0, 2).map(function (i) { return OT.t('taste.' + keys[i]); });
  }

  function renderRail() {
    if (!K) return;
    K.rail.innerHTML = '';
    K.rail.appendChild(OT.el('div', { class: 'rope' }));
    if (!K.tickets.length) K.rail.appendChild(OT.el('div', { class: 'rail-empty', text: OT.t('k.noTicket') }));
    K.tickets.forEach(function (t) {
      var g = t.guest;
      var steps = ticketSteps(t);
      var el = OT.el('button', { class: 'ticket' + (K.selected === t.id ? ' sel' : '') + (t.order ? '' : ' omakase') + (t.shown ? ' old' : ''),
        onclick: function () { OT.sfx.tap(); K.selected = t.id; renderRail(); renderPlate(); OT.kitchen.tutorialCheck(); } });
      el.appendChild(OT.el('span', { class: 'tk-name', text: g.name || OT.t('cust.' + g.typeId) }));
      if (steps) {
        el.appendChild(OT.el('span', { class: 'tk-title', text: OT.tacoName(t.order, t.variant) }));
        var list = OT.el('span', { class: 'tk-steps' });
        steps.forEach(function (id, i) {
          if (id === 'any') return;
          var c = OT.ui.pixelCanvas(32, 32, 'tk-ico');
          OT.art.drawIcon(c, id);
          list.appendChild(OT.el('span', { class: 'tk-step' }, [OT.el('b', { text: String(i + 1) }), c]));
        });
        el.appendChild(list);
      } else {
        el.appendChild(OT.el('span', { class: 'tk-title', text: OT.t('night.omakaseName') }));
        el.appendChild(OT.el('span', { class: 'tk-hint', text: OT.t('k.likes', { a: hintsOf(g)[0], b: hintsOf(g)[1] }) }));
      }
      var r = Math.max(0, g.patience / g.patienceMax);
      el.appendChild(OT.el('span', { class: 'tk-bar' }, [OT.el('i', { style: 'width:' + (r * 100).toFixed(0) + '%;background:' + (r > 0.5 ? '#46b03a' : r > 0.25 ? '#f5b860' : '#f24a2a') })]));
      t.el = el; t.shown = true;
      K.rail.appendChild(el);
    });
  }

  function currentTicket() {
    for (var i = 0; i < K.tickets.length; i++) if (K.tickets[i].id === K.selected) return K.tickets[i];
    return K.tickets[0] || null;
  }

  // ---------------------------------------------------------------
  // 焼き場：七輪 / 油鍋 / 藁焼き（上のタブで切りかえ）
  // ---------------------------------------------------------------
  function buildGrill() {
    var wrap = OT.el('div', { class: 'station st-grill' });
    K.fireTabs = OT.el('div', { class: 'fire-tabs' });
    K.fireBtn = {};
    KINDS.forEach(function (k) {
      var b = OT.el('button', { class: 'fire-tab', 'data-k': k, onclick: function () { OT.sfx.tap(); setFire(k); } }, [
        OT.el('span', { class: 'ico', text: ICON[k] }), OT.el('span', { class: 'lbl', text: OT.t('k.fire.' + k) }), OT.el('em', { class: 'fire-count' })
      ]);
      K.fireBtn[k] = b;
      K.fireTabs.appendChild(b);
    });
    wrap.appendChild(K.fireTabs);

    K.view = OT.el('div', { class: 'fire-view' });
    K.grillCanvas = OT.ui.pixelCanvas(VW, VH, 'grill-canvas');
    K.grillCanvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var r = K.grillCanvas.getBoundingClientRect();
      var s = slotAt((e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH);
      if (!s || !s.item) return;
      if (s.kind === 'sear') { startSearHold(e); return; }   // 藁焼きは、魚を押していても炙れる
      tapSlot(s);
    });
    K.view.appendChild(K.grillCanvas);
    K.tags = OT.el('div', { class: 'slot-tags' });
    K.view.appendChild(K.tags);
    K.slots.forEach(function (s) {
      s.tag = OT.el('div', { class: 'slot-tag', style: 'left:' + (s.pos[0] * 100) + '%;top:' + (s.pos[1] * 100) + '%' });
      K.tags.appendChild(s.tag);
    });
    K.grillMsg = OT.el('div', { class: 'grill-msg' });
    K.view.appendChild(K.grillMsg);
    // 藁焼きのボタン：押している間だけ炎が出る / 取り出す
    K.searHold = OT.el('button', { class: 'sear-hold', text: OT.t('k.searHold') });
    K.searHold.addEventListener('pointerdown', function (e) { e.preventDefault(); startSearHold(e); });
    K.searHold.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    K.searTake = OT.el('button', { class: 'sear-take', text: OT.t('k.searTake'), onclick: function () { var s = searSlot(); if (s) tapSlot(s); } });
    K.searCtrl = OT.el('div', { class: 'sear-ctrl' }, [K.searHold, K.searTake]);
    K.view.appendChild(K.searCtrl);
    wrap.appendChild(K.view);

    K.rawLabel = OT.el('div', { class: 'k-label' });
    wrap.appendChild(K.rawLabel);
    K.rawEl = OT.el('div', { class: 'k-row raw' });
    wrap.appendChild(K.rawEl);
    wrap.appendChild(OT.el('div', { class: 'k-label', text: OT.t('k.warm') }));
    K.warmEl = OT.el('div', { class: 'k-row warm' });
    wrap.appendChild(K.warmEl);
    return wrap;
  }

  function setFire(kind) {
    if (!K) return;
    K.fire = kind;
    KINDS.forEach(function (k) { K.fireBtn[k].classList.toggle('on', k === kind); });
    K.view.className = 'fire-view v-' + kind;
    renderRaw();
    if (OT.kitchen.tutorialCheck) OT.kitchen.tutorialCheck();
  }

  function searSlot() { for (var i = 0; i < K.slots.length; i++) if (K.slots[i].kind === 'sear' && K.slots[i].item) return K.slots[i]; return null; }

  function startSearHold(e) {
    if (!searSlot() || K.searHolding) return;
    K.searHolding = true;
    K.flameT = 0;
    OT.sfx.flame();
    var stop = function (ev) {
      if (ev && ev.pointerId !== e.pointerId) return;
      K && (K.searHolding = false);
      global.removeEventListener('pointerup', stop); global.removeEventListener('pointercancel', stop);
    };
    global.addEventListener('pointerup', stop);
    global.addEventListener('pointercancel', stop);
  }

  function slotAt(x, y) {
    var best = null, bd = 32;
    K.slots.forEach(function (s) {
      if (s.locked || s.kind !== K.fire) return;
      var d = Math.hypot(s.pos[0] * VW - x, s.pos[1] * VH - y);
      if (d < bd) { bd = d; best = s; }
    });
    return best;
  }

  function cookables(kind) {
    return Object.keys(cfg().INGREDIENTS).filter(function (id) { return ingOf(id).cook === kind && st().seen[id]; });
  }

  function renderRaw() {
    if (!K || !K.rawEl) return;
    K.rawLabel.textContent = OT.t('k.raw.' + K.fire);
    K.rawEl.innerHTML = '';
    var list = cookables(K.fire);
    var want = {};
    K.tickets.forEach(function (t) { (ticketSteps(t) || []).forEach(function (id) { want[id] = 1; }); });
    list.sort(function (a, b) { return ((OT.state.stockOf(b) > 0) * 2 + (want[b] || 0)) - ((OT.state.stockOf(a) > 0) * 2 + (want[a] || 0)); });
    if (!list.length) K.rawEl.appendChild(OT.el('span', { class: 'k-empty', text: OT.t('k.noRaw.' + K.fire) }));
    list.forEach(function (id) {
      var n = OT.state.stockOf(id);
      // 指を離したときに反応（タブを切りかえた直後のタップも取りこぼさない）
      K.rawEl.appendChild(chip(id, OT.t('ui.stock', { n: n }), (n ? '' : 'empty') + (want[id] ? ' want' : ''), { tap: function () { putOnFire(id); } }));
    });
    KINDS.forEach(function (k) {
      var open = K.slots.filter(function (s) { return s.kind === k && !s.locked; });
      K.fireBtn[k].querySelector('.fire-count').textContent = open.filter(function (s) { return s.item; }).length + '/' + open.length;
    });
    renderWarm();
  }

  function renderWarm() {
    if (!K || !K.warmEl) return;
    K.warmEl.innerHTML = '';
    if (!K.warm.length) K.warmEl.appendChild(OT.el('span', { class: 'k-empty', text: OT.t('k.noWarm') }));
    K.warm.forEach(function (w) {
      var c = OT.ui.pixelCanvas(32, 32, 'k-ico');
      OT.art.drawIcon(c, w.id);
      K.warmEl.appendChild(OT.el('span', { class: 'k-chip small q-' + w.state }, [c, OT.el('span', { class: 'k-sub', text: OT.t('k.q.' + w.state) })]));
    });
  }

  function putOnFire(id) {
    var method = ingOf(id).cook;
    if (OT.state.stockOf(id) <= 0) { OT.sfx.denied(); OT.ui.toast(OT.t('night.out')); return; }
    if (method !== K.fire) setFire(method);
    var slot = null;
    K.slots.forEach(function (s) { if (!slot && s.kind === method && !s.locked && !s.item) slot = s; });
    if (!slot) { OT.sfx.denied(); OT.ui.toast(OT.t('k.full.' + method)); return; }
    OT.state.useStock(id, 1);
    var C = KC()[method];
    slot.item = { id: id, p: 0, t: 0, seared: 0, time: (C.time || 1) * (KC().timeMul[id] || 1), flipped: false, flipOk: false, holding: false, seed: Math.random() * 10 };
    OT.sfx.place();
    if (method === 'grill') OT.sfx.sizzle(); else if (method === 'fry') OT.sfx.oil();
    // はじめての揚げ物・藁焼きでは、やり方をひとこと
    var fl = st().flags;
    if (method !== 'grill' && !fl['k_hint2_' + method]) { fl['k_hint2_' + method] = 1; OT.ui.toast(OT.t('k.hint.' + method), 'tip long'); }
    renderRaw();
    OT.kitchen.tutorialCheck();
  }

  /** 焼き場の具をタップしたとき：裏返す / 下ろす・引き上げる・取り出す（早すぎるときは、もう一度で） */
  function tapSlot(s) {
    var it = s.item;
    if (!it) return;
    var C = KC()[s.kind];
    if (s.kind === 'grill' && !it.flipped) {
      if (it.p < C.flipAt - C.flipWindow) { msg(OT.t('k.wait')); return; }
      it.flipped = true; it.flipOk = Math.abs(it.p - C.flipAt) <= C.flipWindow; it.flipP = it.p; it.flipT = 0;
      OT.sfx.flip();
      msg(OT.t(it.flipOk ? 'k.flipped' : 'k.flipLate'));
      OT.kitchen.tutorialCheck();
      return;
    }
    var p = s.kind === 'sear' ? it.seared : it.p;
    if (p < C.done[0] - 0.05) {
      if (it.confirm && now() - it.confirm < 1.8) { takeOff(s); return; }
      it.confirm = now();
      msg(OT.t('k.notYet'));
      return;
    }
    takeOff(s);
  }

  function quality(kind, it) {
    var C = KC()[kind];
    var p = kind === 'sear' ? it.seared : it.p;
    var q;
    if (p >= C.done[0] && p <= C.done[1]) q = 1;
    else if (p < C.done[0]) q = Math.max(0, 1 - (C.done[0] - p) / (C.done[0] * 0.6));
    else q = Math.max(0, 1 - (p - C.done[1]) / (C.burn - C.done[1]));
    if (kind === 'grill' && !it.flipOk) q *= 0.65;
    var state = p < C.done[0] - 0.05 ? 'raw' : p > C.done[1] + (C.burn - C.done[1]) * 0.5 ? 'burnt' : 'good';
    return { q: Math.round(q * 100) / 100, state: state };
  }

  function takeOff(s) {
    if (K.warm.length >= KC().warmTray) { OT.sfx.denied(); msg(OT.t('k.warmFull')); return; }
    var Q = quality(s.kind, s.item);
    K.warm.push({ id: s.item.id, q: Q.q, state: Q.state });
    msg(OT.t('k.took', { name: OT.ingName(s.item.id), q: OT.t('k.q.' + Q.state) }));
    s.item = null;
    if (s.kind === 'sear') K.searHolding = false;
    OT.sfx.place();
    renderRaw();
    renderPlate();
    OT.kitchen.tutorialCheck();
  }

  function msg(t) { if (!K) return; K.grillMsg.textContent = t; K.grillMsg.className = 'grill-msg on'; clearTimeout(K.msgT); K.msgT = setTimeout(function () { if (K) K.grillMsg.className = 'grill-msg'; }, 1400); }

  /** その具の上に出す、ひとことの札（裏返す！・下ろす！・焦げる！など） */
  function tagOf(s) {
    var it = s.item;
    if (!it) return null;
    var C = KC()[s.kind];
    if (s.kind === 'sear') {
      if (it.seared > C.done[1]) return ['burn', 'k.tag.burn'];
      if (it.seared >= C.done[0]) return ['ready', 'k.tag.take'];
      return K.searHolding ? null : ['hold', 'k.tag.hold'];
    }
    if (s.kind === 'grill' && !it.flipped) {
      if (Math.abs(it.p - C.flipAt) <= C.flipWindow) return ['flip', 'k.tag.flip'];
      if (it.p > C.flipAt + C.flipWindow) return ['burn', 'k.tag.flipLate'];
      return null;
    }
    if (it.p > C.done[1]) return ['burn', 'k.tag.burn'];
    if (it.p >= C.done[0]) return ['ready', s.kind === 'fry' ? 'k.tag.lift' : 'k.tag.off'];
    return null;
  }

  function updateTags() {
    K.slots.forEach(function (s) {
      var tg = s.kind === K.fire ? tagOf(s) : null;
      var cls = 'slot-tag' + (tg ? ' on ' + tg[0] + ' k-' + s.kind : '');
      var txt = tg ? OT.t(tg[1]) : '';
      if (s.tag.className !== cls) s.tag.className = cls;
      if (s.tag.textContent !== txt) s.tag.textContent = txt;
    });
    var sear = searSlot();
    K.searHold.disabled = !sear;
    K.searTake.disabled = !sear;
    K.searHold.classList.toggle('on', !!K.searHolding);
  }

  // --- 絵 ---
  function bgOf(kind) {
    // 絵の塗り方（config.js の ART_STYLE.kitchen）：'toon' ならセル調の絵（なければ前の絵）
    if ((OT.CFG.ART_STYLE || {}).kitchen === 'toon') {
      var tb = OT.sprites.get(BG[kind] + '_toon');
      if (tb && tb.complete && tb.naturalWidth) return tb;
    }
    var bg = OT.sprites.get(BG[kind]);
    return bg && bg.complete && bg.naturalWidth ? bg : null;
  }

  function drawFire() {
    var ctx = K.grillCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var bg = bgOf(K.fire);
    if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = '#5a3218'; ctx.fillRect(0, 0, VW, VH); }
    var t = K.N.time + now() * 0;   // 案内中（時間が止まっている）も、炎や泡は動かす
    t = now();
    if (K.fire === 'fry') drawOilShimmer(ctx, t);
    K.slots.forEach(function (s) {
      if (s.kind !== K.fire) return;
      var x = Math.round(s.pos[0] * VW), y = Math.round(s.pos[1] * VH);
      if (s.locked) {
        ctx.fillStyle = 'rgba(13,24,48,0.62)';
        ctx.beginPath(); ctx.ellipse(x, y, 18, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', x, y + 4);
        return;
      }
      if (s.kind === 'grill') drawGrillSlot(ctx, s, x, y, t);
      else if (s.kind === 'fry') drawFrySlot(ctx, s, x, y, t);
      else drawSearSlot(ctx, s, x, y, t);
    });
  }

  function blit(ctx, img, x, y, sy, flip) {
    if (!img) return;
    var w = img.width, h = img.height;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(flip ? -1 : 1, sy === undefined ? 1 : sy);
    ctx.drawImage(img, -Math.round(w / 2), -Math.round(h / 2));
    ctx.restore();
  }

  function ring(ctx, s, x, y, prog, C, Q) {
    var R = 18;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(13,24,48,0.7)';
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(168,224,90,0.85)';
    ctx.beginPath(); ctx.arc(x, y, R + 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, C.done[0]), -Math.PI / 2 + Math.PI * 2 * Math.min(1, C.done[1])); ctx.stroke();
    ctx.strokeStyle = Q.state === 'burnt' ? '#f24a2a' : prog >= C.done[0] ? '#46b03a' : '#f5b860';
    ctx.beginPath(); ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, prog)); ctx.stroke();
  }

  /** 七輪：裏返すまでは上は生の面。裏返すと、焼き目のついた面が上に来る */
  function drawGrillSlot(ctx, s, x, y, t) {
    var it = s.item;
    if (!it) return;
    var C = KC().grill, Q = quality('grill', it);
    var pre = { state: 'raw', marks: false };
    var post = pre;
    if (it.flipped) {
      var a = it.flipP * 2;   // 裏返すまで下で焼けていた面の焼け具合
      var look = a < 0.75 ? 'raw' : a > 1.6 ? 'burnt' : 'good';
      if (Q.state === 'burnt') look = 'burnt';
      post = { state: look, marks: look !== 'raw' };
    }
    // 煙（焦げそうなほど黒く）
    var over = (!it.flipped && it.p > C.flipAt + C.flipWindow) || it.p > C.done[1];
    for (var k = 0; k < 4; k++) {
      var ph = (t * 0.7 + k * 0.25 + it.seed) % 1;
      ctx.fillStyle = over ? 'rgba(46,26,18,' + (0.6 * (1 - ph)) + ')' : 'rgba(255,250,240,' + (0.45 * (1 - ph)) + ')';
      ctx.fillRect(Math.round(x - 8 + k * 5 + Math.sin(t * 2 + k) * 3), Math.round(y - 10 - ph * 26), over ? 4 : 3, over ? 4 : 3);
    }
    // 脂が落ちて、下で炎がぼっと上がる
    if (Math.sin(t * 9 + it.seed * 7) > 0.85) {
      ctx.fillStyle = '#f5b860'; ctx.fillRect(x - 12, y + 6, 2, 3); ctx.fillRect(x + 9, y + 5, 2, 4);
      ctx.fillStyle = '#f24a2a'; ctx.fillRect(x - 11, y + 9, 2, 2); ctx.fillRect(x + 10, y + 9, 2, 2);
    }
    // 裏返す動き：ぽんと跳ねて、くるっと回る
    var f = it.flipT !== undefined && it.flipT < 0.42 ? it.flipT / 0.42 : 1;
    var side = f < 0.5 ? pre : post;
    var img = OT.sprites.pieceImage(it.id, side.state, side.marks, SCALE.grill);
    var sy = f < 1 ? Math.max(0.08, Math.abs(Math.cos(Math.PI * f))) : 1;
    var jump = f < 1 ? Math.sin(Math.PI * f) * 14 : 0;
    if (img) blit(ctx, img, x, y - jump, sy, f >= 0.5 && f < 1);
    else { ctx.fillStyle = '#f6c39c'; ctx.fillRect(x - 10, y - 6, 20, 12); }
    if (f < 1 && f > 0.85) { ctx.fillStyle = 'rgba(255,250,240,0.7)'; ctx.fillRect(x - 14, y + 2, 3, 2); ctx.fillRect(x + 12, y + 1, 3, 2); }
    ring(ctx, s, x, y, it.p, C, Q);
    if (!it.flipped) {   // 裏返す印
      var a2 = -Math.PI / 2 + Math.PI * 2 * C.flipAt;
      var near = Math.abs(it.p - C.flipAt) <= C.flipWindow;
      ctx.fillStyle = near && Math.floor(t * 8) % 2 ? '#fffaf0' : '#f5b860';
      ctx.fillRect(Math.round(x + Math.cos(a2) * 18) - 3, Math.round(y + Math.sin(a2) * 18) - 3, 6, 6);
    }
  }

  /** 油鍋：油の面がゆらいで光る（透明感） */
  function drawOilShimmer(ctx, t) {
    var ox = OIL[0] * VW, oy = OIL[1] * VH, rx = OIL[2] * VW, ry = OIL[3] * VH;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(ox, oy, rx * 0.92, ry * 0.9, 0, 0, Math.PI * 2); ctx.clip();
    for (var k = 0; k < 7; k++) {
      var yy = oy - ry + ((t * 5 + k * ry * 0.33) % (ry * 2));
      var xx = ox + Math.sin(t * 0.8 + k * 1.7) * rx * 0.5;
      var len = 10 + (k % 3) * 8;
      ctx.fillStyle = k % 2 ? 'rgba(255,230,176,0.28)' : 'rgba(255,250,240,0.18)';
      ctx.fillRect(Math.round(xx - len / 2), Math.round(yy), len, 1);
    }
    ctx.restore();
  }

  function drawFrySlot(ctx, s, x, y, t) {
    var it = s.item;
    if (!it) return;
    var C = KC().fry, Q = quality('fry', it);
    var img = OT.sprites.pieceImage(it.id, Q.state, false, SCALE.fry);
    var bob = Math.round(Math.sin(t * 3 + it.seed) * 1.2);
    if (img) {
      // 油に沈んだ下の方は、油の色がかかって透けて見える
      var tmp = K.tmp || (K.tmp = doc.createElement('canvas'));
      tmp.width = img.width; tmp.height = img.height;
      var g = tmp.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, tmp.width, tmp.height);
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(214,140,50,0.45)';
      var wl = Math.round(tmp.height * 0.47 + Math.sin(t * 2.4 + it.seed) * 1.5);
      g.fillRect(0, wl, tmp.width, tmp.height - wl);
      g.fillStyle = 'rgba(255,230,176,0.75)';   // 油の面の線
      for (var xx = 0; xx < tmp.width; xx += 2) g.fillRect(xx, wl + Math.round(Math.sin(xx * 0.4 + t * 4) * 0.8), 2, 1);
      g.globalCompositeOperation = 'source-over';
      blit(ctx, tmp, x, y + bob);
    }
    // 泡：入れたては大きく多く、揚がるにつれて小さく少なく
    var n = it.p < 0.5 ? 14 : it.p < C.done[0] ? 9 : 4, big = it.p < 0.5 ? 2 : 1;
    for (var b = 0; b < n; b++) {
      var ph = (t * 1.8 + b * 0.37) % 1;
      var ang = b * 2.39 + it.seed, dist = 9 + (b % 4) * 4 + ph * 2;
      var bx = Math.round(x + Math.cos(ang) * dist * 1.3), by = Math.round(y + 4 + Math.sin(ang) * dist * 0.55 - ph * 3);
      ctx.fillStyle = 'rgba(255,250,240,' + (0.9 - ph * 0.6) + ')';
      if (big > 1 && ph > 0.3) { ctx.fillRect(bx - 1, by, 1, 1); ctx.fillRect(bx + 1, by, 1, 1); ctx.fillRect(bx, by - 1, 1, 1); ctx.fillRect(bx, by + 1, 1, 1); }
      else ctx.fillRect(bx, by, 1, 1);
    }
    ring(ctx, s, x, y, it.p, C, Q);
  }

  /** 藁焼き：串に刺した鰹を、押している間だけ藁の炎で炙る */
  function drawSearSlot(ctx, s, x, y, t) {
    var it = s.item;
    var C = KC().sear;
    var hx = SEAR_HANDLE[0] * VW, hy = SEAR_HANDLE[1] * VH;
    var strawY = Math.round(VH * 0.62);
    var holding = it && K.searHolding;
    // 炎（押している間は大きく、魚まで届く）・おき火（はなしている間）
    if (holding) {
      ctx.fillStyle = 'rgba(245,120,40,0.16)'; ctx.fillRect(0, 0, VW, VH);
      flames(ctx, x, strawY, 120, strawY - y + 6, t);
      for (var e = 0; e < 10; e++) {   // 火の粉
        var ph = (t * 1.3 + e * 0.13) % 1;
        ctx.fillStyle = e % 2 ? '#f5b860' : '#f24a2a';
        ctx.fillRect(Math.round(x - 50 + (e * 37) % 100 + Math.sin(t * 3 + e) * 6), Math.round(strawY - ph * 90), 2, 2);
      }
    } else {
      if (it) flames(ctx, x, strawY, 90, 7, t);
      for (var k = 0; k < 8; k++) {
        if (Math.sin(t * 4 + k * 1.9) > 0.3) { ctx.fillStyle = k % 2 ? '#f24a2a' : '#f5b860'; ctx.fillRect(Math.round(x - 40 + k * 11), strawY - 2 + (k % 3), 2, 2); }
      }
      ctx.fillStyle = 'rgba(214,204,184,0.25)';
      for (var m = 0; m < 3; m++) { var p2 = (t * 0.4 + m / 3) % 1; ctx.fillRect(Math.round(x - 20 + m * 18 + Math.sin(t + m) * 4), Math.round(strawY - 10 - p2 * 40), 4, 4); }
    }
    // 金串（扇形に3本）と、にぎり
    [-7, 0, 7].forEach(function (d) {
      ctx.strokeStyle = '#4a4658'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + d, y + 3); ctx.lineTo(hx + d * 0.25, hy); ctx.stroke();
      ctx.strokeStyle = '#aaa292'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + d, y + 2); ctx.lineTo(hx + d * 0.25, hy - 1); ctx.stroke();
    });
    ctx.fillStyle = '#5a3218'; ctx.fillRect(Math.round(hx - 4), Math.round(hy - 3), 14, 7);
    if (!it) return;
    var Q = quality('sear', it);
    var img = OT.sprites.pieceImage(it.id, Q.state, Q.state !== 'raw', SCALE.sear);
    var shake = holding ? Math.round(Math.sin(t * 40) * 1) : 0;
    if (img) blit(ctx, img, x + shake, y);
    // 炙り加減のゲージ（上）
    var gx = 58, gw = 140, gy = 8, burn = C.burn;
    ctx.fillStyle = 'rgba(13,24,48,0.8)'; ctx.fillRect(gx - 2, gy - 2, gw + 4, 10);
    ctx.fillStyle = '#4a4658'; ctx.fillRect(gx, gy, gw, 6);
    ctx.fillStyle = '#1f6a2c'; ctx.fillRect(Math.round(gx + gw * C.done[0] / burn), gy, Math.round(gw * (C.done[1] - C.done[0]) / burn), 6);
    var fillW = Math.round(gw * Math.min(1, it.seared / burn));
    ctx.fillStyle = Q.state === 'burnt' ? '#f24a2a' : it.seared >= C.done[0] ? '#a8e05a' : '#f5b860';
    ctx.fillRect(gx, gy + 1, fillW, 4);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(gx + fillW - 1, gy - 2, 2, 10);
  }

  /** ドットの炎：まん中が高く、根もとは白っぽく、先は赤い。ゆらゆら動く */
  function flames(ctx, cx, baseY, width, maxH, t) {
    var cols = ['#ffe6b0', '#f5b860', '#f24a2a', '#c42618'];
    for (var x = -width / 2; x < width / 2; x += 2) {
      var n = (Math.sin(x * 0.23 + t * 9) + Math.sin(x * 0.11 - t * 13 + 1.3) + Math.sin(x * 0.047 + t * 5)) / 3;
      var edge = 1 - Math.pow(Math.abs(x) / (width / 2), 2);
      var h = Math.max(0, maxH * edge * (0.5 + 0.5 * n) + (n > 0.55 ? maxH * 0.25 : 0));
      for (var y = 0; y < h; y += 2) {
        var f = y / h + (Math.abs(x) / (width / 2)) * 0.3;
        ctx.fillStyle = cols[Math.min(3, Math.floor(f * 3.2))];
        ctx.fillRect(Math.round(cx + x), Math.round(baseY - y), 2, 2);
      }
    }
  }

  /** その焼き場の画面に、いま用があるか（裏返す・下ろす・焦げそう） */
  function needs(kind) {
    return K.slots.some(function (s) {
      if (s.kind !== kind || !s.item) return false;
      var tg = tagOf(s);
      return !!tg && tg[0] !== 'hold';
    });
  }

  // ---------------------------------------------------------------
  // 盛り付け
  //   皮はタップで置く。具・たれ・薬味はタップで「持つ」→ 皮の上で
  //   具はタップで置く / 薬味は指を左右に動かして撒く / たれは指でなぞって回しかける。
  //   具は下からドラッグで運んでもよい。食材の列は横にスクロールできる。
  // ---------------------------------------------------------------
  function newDish() { return { skin: null, layers: [], seq: [] }; }

  function buildPlate() {
    var wrap = OT.el('div', { class: 'station st-plate' });
    var top = OT.el('div', { class: 'plate-top' });
    K.board = OT.ui.pixelCanvas(BOARD, BOARD, 'plate-board');
    K.boardWrap = OT.el('div', { class: 'plate-board-wrap' }, [K.board]);
    K.plateInfo = OT.el('div', { class: 'plate-info' });
    K.boardWrap.appendChild(K.plateInfo);
    if (OT.sprites.has('people_mateo_happi')) { K.mateo = OT.ui.pixelCanvas(OT.sprites.frame[0], OT.sprites.frame[1], 'plate-mateo'); top.appendChild(K.mateo); }
    top.appendChild(K.boardWrap);
    var side = OT.el('div', { class: 'plate-side' });
    K.trash = OT.el('button', { class: 'trash', onclick: trashDish }, [OT.el('span', { class: 'trash-ico' }), OT.el('span', { text: OT.t('k.trash') })]);
    side.appendChild(K.trash);
    K.kagoBtn = OT.el('button', { class: 'kago-serve', onclick: serveKago });
    side.appendChild(K.kagoBtn);
    top.appendChild(side);
    wrap.appendChild(top);
    K.rows = OT.el('div', { class: 'plate-rows' });
    wrap.appendChild(K.rows);
    K.wrapBtn = OT.button(OT.t('night.wrap'), wrapDish, 'primary wrap-btn');
    wrap.appendChild(K.wrapBtn);
    K.dish = newDish();
    K.ghost = OT.el('div', { class: 'drag-ghost' });
    doc.getElementById('app').appendChild(K.ghost);

    // 皮の上：持っている道具で、置く・撒く・回しかける
    K.board.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (K.folding >= 0) return;
      var T = K.tool;
      if (!T) { if (K.dish.skin) { OT.sfx.denied(); OT.ui.toast(OT.t('k.pickFirst')); } return; }
      var pt = boardPoint(e);
      if (T.kind === 'warm' || T.kind === 'stock') { if (onSkin(pt)) dropItem(T, pt); return; }
      try { K.board.setPointerCapture(e.pointerId); } catch (err) { /* 古いブラウザ */ }
      K.stroke = { tool: T, layer: null, lastX: null, lastPt: null, newStroke: true, pid: e.pointerId };
      showGhost(T, e);
      strokeAt(pt, e);
    });
    K.board.addEventListener('pointermove', function (e) {
      if (!K.stroke || e.pointerId !== K.stroke.pid) return;
      e.preventDefault();
      strokeAt(boardPoint(e), e);
    });
    var end = function (e) {
      if (!K || !K.stroke || e.pointerId !== K.stroke.pid) return;
      K.stroke = null;
      K.ghost.className = 'drag-ghost';
      renderPlate(); drawBoard();
      OT.kitchen.tutorialCheck();
    };
    K.board.addEventListener('pointerup', end);
    K.board.addEventListener('pointercancel', end);
    return wrap;
  }

  /**
   * 食材の札。横にスワイプすると列がスクロールし、タップで opt.tap、
   * 上下に引っぱると opt.drag（具を皮へ運ぶ）。
   */
  function chip(id, sub, cls, opt) {
    var c = OT.ui.pixelCanvas(32, 32, 'k-ico');
    OT.art.drawIcon(c, id);
    var el = OT.el('button', { class: 'k-chip ' + (cls || ''), 'data-id': id }, [c, OT.el('span', { class: 'k-name', text: OT.ingName(id) }), OT.el('span', { class: 'k-sub', text: sub })]);
    el.addEventListener('pointerdown', function (e) {
      var sx = e.clientX, sy = e.clientY, pid = e.pointerId, moved = false, done = false;
      function mv(ev) {
        if (ev.pointerId !== pid || done) return;
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
        if (opt.drag && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.2) { done = true; off(); opt.drag(ev, el, c); }
      }
      function up(ev) { if (ev.pointerId !== pid) return; off(); if (!moved && !done && opt.tap) opt.tap(); }
      function cancel(ev) { if (ev.pointerId === pid) off(); }
      function off() { global.removeEventListener('pointermove', mv); global.removeEventListener('pointerup', up); global.removeEventListener('pointercancel', cancel); }
      global.addEventListener('pointermove', mv);
      global.addEventListener('pointerup', up);
      global.addEventListener('pointercancel', cancel);
    });
    el.addEventListener('click', function (e) { e.preventDefault(); });
    return el;
  }

  function sameTool(a, b) { return a && b && a.kind === b.kind && a.id === b.id && a.index === b.index; }

  function renderPlate() {
    if (!K || !K.rows) return;
    var t = currentTicket();
    var want = t && t.order ? ticketSteps(t) : [];
    var scrolls = [].map.call(K.rows.querySelectorAll('.k-row'), function (r) { return r.scrollLeft; });
    K.rows.innerHTML = '';
    function row(labelKey, items) {
      if (!items.length) return;
      var r = OT.el('div', { class: 'k-row' });
      items.forEach(function (x) { r.appendChild(x); });
      K.rows.appendChild(OT.el('div', { class: 'k-label', text: OT.t(labelKey) }));
      K.rows.appendChild(r);
    }
    function held(tl) { return sameTool(K.tool, tl) ? ' held' : ''; }
    // 皮
    var skins = Object.keys(cfg().INGREDIENTS).filter(function (id) {
      var g = ingOf(id); return g.cat === 'skin' && id !== 'kagomushi' && (g.virtual ? OT.state.chapter() >= 3 : st().seen[id]) && OT.state.stockOf(id) > 0;
    });
    skins.sort(function (a, b) { return (want.indexOf(b) >= 0 || (want[0] && OT.skinOk(want[0], b))) - (want.indexOf(a) >= 0 || (want[0] && OT.skinOk(want[0], a))); });
    row('k.row.skin', skins.map(function (id) {
      return chip(id, OT.t('ui.stock', { n: OT.state.stockOf(id) }), (K.dish.skin === id ? 'on ' : '') + (want[0] && OT.skinOk(want[0], id) ? 'want' : ''), { tap: function () { placeSkin(id); } });
    }));
    // 具（焼き上がり＋そのまま使う具）
    var mains = [];
    K.warm.forEach(function (w, i) {
      var tl = { kind: 'warm', index: i, id: w.id };
      mains.push(chip(w.id, OT.t('k.q.' + w.state), 'q-' + w.state + (want.indexOf(w.id) >= 0 ? ' want' : '') + held(tl), {
        tap: function () { pickTool(tl); },
        drag: function (e, el, c) { startDrag(e, { kind: 'warm', index: i, id: w.id, canvas: c }); } }));
    });
    Object.keys(cfg().INGREDIENTS).forEach(function (id) {
      var g = ingOf(id);
      if (g.cook || g.cat === 'skin' || g.cat === 'ready' || g.cat === 'raw' || !st().seen[id]) return;
      if (useOf(id) !== 'drop' || OT.state.stockOf(id) <= 0) return;
      var tl = { kind: 'stock', id: id };
      mains.push(chip(id, OT.t('ui.stock', { n: OT.state.stockOf(id) }), (want.indexOf(id) >= 0 ? 'want' : '') + held(tl), {
        tap: function () { pickTool(tl); },
        drag: function (e, el, c) { startDrag(e, { kind: 'stock', id: id, canvas: c }); } }));
    });
    mains.sort(function (a, b) { return b.classList.contains('want') - a.classList.contains('want'); });   // 札にある具を前に
    row('k.row.main', mains);
    // 薬味・たれ（タップで持つ）
    var sp = [];
    Object.keys(cfg().INGREDIENTS).forEach(function (id) {
      var g = ingOf(id), u = useOf(id);
      if (g.cook || !st().seen[id] || (u !== 'sprinkle' && u !== 'drizzle') || OT.state.stockOf(id) <= 0) return;
      var tl = { kind: u, id: id };
      sp.push(chip(id, OT.t('k.use.' + u) + ' ' + OT.t('ui.stock', { n: OT.state.stockOf(id) }), (u === 'drizzle' ? 'jug ' : 'bowl ') + (want.indexOf(id) >= 0 ? 'want' : '') + held(tl), {
        tap: function () { pickTool(tl); } }));
    });
    sp.sort(function (a, b) { return b.classList.contains('want') - a.classList.contains('want'); });
    row('k.row.top', sp);
    if (!K.rows.children.length) K.rows.appendChild(OT.el('span', { class: 'k-empty', text: OT.t('night.out') }));
    [].forEach.call(K.rows.querySelectorAll('.k-row'), function (r, i) { if (scrolls[i]) r.scrollLeft = scrolls[i]; });
    // かご蒸し
    var kago = OT.state.chapter() >= cfg().KAGO.chapter && OT.state.stockOf('kagomushi') > 0;
    K.kagoBtn.style.display = kago ? '' : 'none';
    K.kagoBtn.textContent = '🧺 ×' + OT.state.stockOf('kagomushi');
    K.boardWrap.classList.toggle('tool-on', !!K.tool);
    K.dirty = true;
  }

  function placeSkin(id) {
    if (K.folding >= 0) return;
    if (K.dish.skin) { OT.sfx.denied(); OT.ui.toast(OT.t('k.skinAlready')); return; }
    if (!OT.state.useStock(id, 1)) { OT.sfx.denied(); return; }
    K.dish.skin = id;
    K.dish.seq.push(id);
    OT.sfx.place();
    renderPlate(); drawBoard();
    OT.kitchen.tutorialCheck();
  }

  /** 具・たれ・薬味を「持つ」（もう一度タップで置く） */
  function pickTool(tl) {
    if (K.folding >= 0) return;
    if (!K.dish.skin) { OT.sfx.denied(); OT.ui.toast(OT.t('night.needSkin')); return; }
    K.tool = sameTool(K.tool, tl) ? null : tl;
    OT.sfx.tap();
    renderPlate(); drawBoard();
    OT.kitchen.tutorialCheck();
  }

  function boardPoint(e) {
    var r = K.board.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * BOARD, y: (e.clientY - r.top) / r.height * BOARD, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
  }
  function onSkin(pt) { var dx = (pt.x - 64) / 44, dy = (pt.y - 64) / 40; return dx * dx + dy * dy <= 1; }

  function showGhost(T, e) {
    K.ghost.innerHTML = '';
    var g = OT.ui.pixelCanvas(32, 32, 'ghost-ico'), gc = g.getContext('2d');
    var icon = OT.ui.pixelCanvas(32, 32);
    OT.art.drawIcon(icon, T.id);
    var tool = T.kind === 'sprinkle' ? 'k_bowl' : T.kind === 'drizzle' ? 'k_jug' : null;
    if (tool && OT.sprites.has(tool)) { gc.drawImage(OT.sprites.get(tool), 0, 0); gc.drawImage(icon, 8, 2, 16, 16); }
    else gc.drawImage(icon, 0, 0);
    K.ghost.appendChild(g);
    K.ghost.className = 'drag-ghost on ' + T.kind;
    moveGhost(e);
  }

  function moveGhost(e) {
    var app = doc.getElementById('app').getBoundingClientRect();
    K.ghost.style.left = (e.clientX - app.left) + 'px';
    K.ghost.style.top = (e.clientY - app.top) + 'px';
  }

  /** なぞった所に、撒く・回しかける */
  function strokeAt(pt, e) {
    var S = K.stroke;
    if (!S) return;
    moveGhost(e);
    if (!pt.inside || !onSkin(pt)) { S.lastPt = null; S.newStroke = true; return; }
    var id = S.tool.id;
    if (S.tool.kind === 'sprinkle') {
      if (!S.layer) S.layer = ensureLayer(id, 'sprinkle');
      if (S.lastX === null || Math.abs(pt.x - S.lastX) >= 9) {
        S.lastX = pt.x;
        S.layer.amount += 1;
        var r = OT.rng(OT.hash(id) + S.layer.amount * 13 + S.layer.pts.length);
        for (var k = 0; k < 3; k++) {
          var q = { x: pt.x + (r() - 0.5) * 16, y: pt.y + (r() - 0.5) * 12 };
          if (onSkin(q)) { S.layer.pts.push(q); K.parts.push({ x: q.x, y: q.y - 12, ty: q.y, t: 0, id: id }); }
        }
        OT.sfx.sprinkle();
        showCount(S.layer);
      }
    } else {
      if (!S.layer) S.layer = ensureLayer(id, 'drizzle');
      if (!S.lastPt || Math.hypot(pt.x - S.lastPt.x, pt.y - S.lastPt.y) >= 3) {
        if (S.lastPt) S.layer.amount += Math.hypot(pt.x - S.lastPt.x, pt.y - S.lastPt.y);
        S.layer.pts.push({ x: pt.x, y: pt.y, brk: S.newStroke && S.layer.pts.length > 0 });
        S.newStroke = false;
        S.lastPt = { x: pt.x, y: pt.y };
        if (Math.random() < 0.25) OT.sfx.pour();
        showCount(S.layer);
      }
    }
    K.dirty = true;
  }

  function ensureLayer(id, use) {
    // 同じ薬味・たれを続けて使うときは、同じ層に足す
    var last = K.dish.layers[K.dish.layers.length - 1];
    if (last && last.id === id && last.use === use) return last;
    var L = { id: id, use: use, amount: 0, pts: [], q: null };
    K.dish.layers.push(L);
    if (K.dish.seq.indexOf(id) < 0) K.dish.seq.push(id);
    OT.state.useStock(id, 1);   // 在庫は、使い始めに1つ減らす
    return L;
  }

  function showCount(L) {
    var v = L.use === 'sprinkle' ? '×' + L.amount : Math.round(L.amount / cfg().SCORE.drizzleTarget * 100) + '%';
    K.plateInfo.textContent = OT.ingName(L.id) + '　' + v;
  }

  /** 具を皮の上の pt に置く（焼き上がり or 在庫から） */
  function dropItem(T, pt) {
    if (K.dish.layers.filter(function (L) { return L.use === 'drop'; }).length >= cfg().RATING.maxToppings) { OT.sfx.denied(); OT.ui.toast(OT.t('night.full')); return; }
    var q = null, state = 'good';
    if (T.kind === 'warm') {
      var w = K.warm[T.index];
      if (!w || w.id !== T.id) { K.tool = null; renderPlate(); return; }
      K.warm.splice(T.index, 1); q = w.q; state = w.state;
    } else if (!OT.state.useStock(T.id, 1)) { OT.sfx.denied(); return; }
    K.dish.layers.push({ id: T.id, use: 'drop', amount: 1, pts: [{ x: pt.x, y: pt.y }], q: q, state: state });
    if (K.dish.seq.indexOf(T.id) < 0) K.dish.seq.push(T.id);
    OT.sfx.place();
    K.tool = null;
    renderPlate(); renderRaw(); drawBoard();
    OT.kitchen.tutorialCheck();
  }

  // --- 具を下から皮へドラッグ ---
  function startDrag(e, d) {
    if (K.folding >= 0) return;
    if (!K.dish.skin) { OT.sfx.denied(); OT.ui.toast(OT.t('night.needSkin')); return; }
    K.drag = d;
    K.ghost.innerHTML = '';
    var g = OT.ui.pixelCanvas(32, 32, 'ghost-ico');
    g.getContext('2d').drawImage(d.canvas, 0, 0);
    K.ghost.appendChild(g);
    K.ghost.className = 'drag-ghost on ' + d.kind;
    moveGhost(e);
    var move = function (ev) { ev.preventDefault(); moveGhost(ev); };
    var up = function (ev) { global.removeEventListener('pointermove', move); global.removeEventListener('pointerup', up); global.removeEventListener('pointercancel', up); dragEnd(ev); };
    global.addEventListener('pointermove', move, { passive: false });
    global.addEventListener('pointerup', up);
    global.addEventListener('pointercancel', up);
  }

  function dragEnd(e) {
    var d = K.drag;
    K.drag = null;
    K.ghost.className = 'drag-ghost';
    if (!d || e.type === 'pointercancel') return;
    var pt = boardPoint(e);
    // 捨て桶に落としたら、捨てる（焼き上がりの具）
    var tr = K.trash.getBoundingClientRect();
    if (d.kind === 'warm' && e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom) {
      K.warm.splice(d.index, 1); K.tool = null; OT.sfx.denied(); renderPlate(); renderWarm(); return;
    }
    if (pt.inside && onSkin(pt)) dropItem({ kind: d.kind, id: d.id, index: d.index }, pt);
  }

  function trashDish() {
    if (K.folding >= 0 || !K.dish.skin) return;
    K.dish = newDish();
    K.tool = null;
    OT.sfx.denied();
    OT.ui.toast(OT.t('k.trashed'));
    renderPlate(); drawBoard();
  }

  // --- 量と均等さ ---
  function layerScore(L) {
    var SC = cfg().SCORE;
    var target = L.use === 'sprinkle' ? (ingOf(L.id).amount || SC.sprinkleTarget) : SC.drizzleTarget;
    var amount = Math.max(0, 1 - Math.abs(L.amount - target) / target);
    var Z = SC.zones, zs = [];
    for (var i = 0; i < Z; i++) zs.push(0);
    L.pts.forEach(function (p) { var z = Math.max(0, Math.min(Z - 1, Math.floor((p.x - 20) / (88 / Z)))); zs[z] += 1; });
    var mean = zs.reduce(function (a, b) { return a + b; }, 0) / Z;
    var sd = Math.sqrt(zs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / Z);
    var even = mean ? Math.max(0, 1 - sd / mean) : 0;
    return { amount: amount, even: even };
  }

  function platingInfo() {
    return {
      seq: K.dish.seq.slice(1),
      layers: K.dish.layers.map(function (L) {
        var s = L.use === 'drop' ? { amount: 1, even: 1 } : layerScore(L);
        return { id: L.id, use: L.use, amount: s.amount, even: s.even, q: ingOf(L.id).cook ? (L.q === null ? 0.3 : L.q) : null };
      })
    };
  }

  // --- 絵 ---
  function drawBoard() {
    if (!K || !K.board) return;
    var ctx = K.board.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, BOARD, BOARD);
    var frame = K.folding >= 0 ? K.folding : 0;
    if (!K.dish.skin) { var pl = OT.art.img('plate'); if (pl && pl.complete) ctx.drawImage(pl, 0, 0); }
    else {
      OT.art.drawSkin(ctx, K.dish.skin, frame);
      OT.sprites.drawLayers(ctx, K.dish.layers, frame);
      var idd = OT.identifyTaco(dishServed(), OT.state.chapter());
      var rec = idd && cfg().TACOS[idd.id];
      if (rec && !rec.light && frame === 0) OT.sprites.drawSudachi(ctx);
    }
    // 撒いている具が落ちる動き
    K.parts.forEach(function (p) { OT.sprites.drawPieceMini(ctx, p.id, p.x, p.y + (p.ty - p.y) * Math.min(1, p.t / 0.18)); });
    var t = currentTicket();
    if (!K.drag && !K.stroke) {
      var T = K.tool;
      if (T) K.plateInfo.textContent = OT.t('k.held.' + (T.kind === 'warm' || T.kind === 'stock' ? 'drop' : T.kind), { name: OT.ingName(T.id) });
      else K.plateInfo.textContent = t ? (t.guest.name || OT.t('cust.' + t.guest.typeId)) + '：' + (t.order ? OT.tacoName(t.order, t.variant) : OT.t('night.omakaseName')) : OT.t('k.noTicket');
    }
    K.wrapBtn.disabled = !K.dish.skin || K.folding >= 0 || !t;
  }

  function dishServed() {
    return { skin: K.dish.skin, items: K.dish.layers.map(function (L) { return L.id; }).filter(function (id, i, a) { return a.indexOf(id) === i; }) };
  }

  // --- 包んで出す ---
  function wrapDish() {
    var t = currentTicket();
    if (!K.dish.skin || K.folding >= 0) return;
    if (!t) { OT.sfx.denied(); OT.ui.toast(OT.t('k.noTicket')); return; }
    K.folding = 0; K.foldT = 0; K.foldTicket = t;
    K.tool = null;
    OT.sfx.wrap();
    OT.kitchen.tutorialCheck();
  }

  function serveDish() {
    var t = K.foldTicket, served = dishServed(), plating = platingInfo();
    // 包みあがったタコスの絵（出す場面で大きく見せる）
    var snap = doc.createElement('canvas');
    snap.width = snap.height = BOARD;
    var sg = snap.getContext('2d');
    sg.imageSmoothingEnabled = false;
    sg.drawImage(K.board, 0, 0);
    var idd = OT.identifyTaco(served, OT.state.chapter()), rec = idd && cfg().TACOS[idd.id];
    if (rec && !rec.light) OT.sprites.drawSudachi(sg);
    K.folding = -1;
    K.dish = newDish();
    if (t && t.guest.state === 'wait') {
      OT.kitchen.dropTicketFor(t.guest);
      OT.night.serve(t.guest, served, plating, snap, function () { OT.kitchen.tutorialCheck('served'); });
    } else OT.ui.toast(OT.t('k.gone'));
    renderPlate(); drawBoard();
  }

  function serveKago() {
    var t = currentTicket();
    if (!t) { OT.sfx.denied(); OT.ui.toast(OT.t('k.noTicket')); return; }
    if (!OT.state.useStock('kagomushi', 1)) { OT.sfx.denied(); return; }
    OT.sfx.wrap();
    var snap = OT.ui.pixelCanvas(BOARD, BOARD);
    OT.art.drawSkin(snap.getContext('2d'), 'kagomushi', 7);
    OT.kitchen.dropTicketFor(t.guest);
    OT.night.serve(t.guest, { skin: 'kagomushi', items: [] }, null, snap);
    renderPlate();
  }

  // ---------------------------------------------------------------
  // 毎フレーム：焼き場は、どの持ち場にいても進む
  // ---------------------------------------------------------------
  function update(dt) {
    if (!K) return;
    var sizzling = false, frying = false;
    K.slots.forEach(function (s) {
      var it = s.item;
      if (!it) return;
      if (it.flipT !== undefined) it.flipT += dt;
      if (s.kind === 'sear') {
        it.holding = !!K.searHolding;
        if (it.holding) it.seared += dt;
      } else {
        it.t += dt;
        it.p = it.t / it.time;
        if (s.kind === 'grill') sizzling = true; else frying = true;
      }
    });
    K.sfxT -= dt;
    if (K.sfxT <= 0 && (sizzling || frying)) { K.sfxT = 0.45; if (sizzling) OT.sfx.sizzle(true); if (frying) OT.sfx.oil(true); }
    if (K.searHolding) { K.flameT -= dt; if (K.flameT <= 0) { K.flameT = 0.5; OT.sfx.flame(); } }
    if (K.folding >= 0) {
      K.foldT += dt;
      var f = Math.min(7, Math.floor(K.foldT / 0.07));
      if (f !== K.folding) { K.folding = f; K.dirty = true; }
      if (K.foldT > 0.07 * 8 + 0.15) serveDish();
    }
    K.parts.forEach(function (p) { p.t += dt; });
    if (K.parts.length && K.parts[0].t > 0.2) { K.parts = K.parts.filter(function (p) { return p.t <= 0.2; }); K.dirty = true; }
    // 木札の待ち時間のバー
    K.tickets.forEach(function (t) {
      var bar = t.el && t.el.querySelector('.tk-bar i');
      if (!bar) return;
      var r = Math.max(0, t.guest.patience / t.guest.patienceMax);
      bar.style.width = (r * 100).toFixed(0) + '%';
      bar.style.background = r > 0.5 ? '#46b03a' : r > 0.25 ? '#f5b860' : '#f24a2a';
    });
    if (K.station === 'grill') updateTags();
    alerts();
    if (K.mateo) {
      var ctx = K.mateo.getContext('2d');
      var fr = OT.sprites.frame;
      ctx.clearRect(0, 0, fr[0], fr[1]);
      var an = K.N.mateoT > 0 ? K.N.mateoAnim : (K.dish.skin || K.folding >= 0 ? 'cook' : 'wait');
      OT.sprites.drawPerson(ctx, 'mateo_happi', an, K.N.time, fr[0] / 2, fr[1], false, an === 'cook' ? 5 : 3);
    }
  }

  /** 持ち場のボタンを光らせて知らせる */
  function alerts() {
    var N = K.N, order = false, plate = false;
    N.guests.forEach(function (g) {
      if (!g) return;
      if (g.state === 'order') order = true;
      if ((g.state === 'wait' || g.state === 'order') && g.patience / g.patienceMax < 0.3) order = true;
    });
    var fire = false;
    KINDS.forEach(function (k) {
      var n = needs(k);
      if (n) fire = true;
      K.fireBtn[k].classList.toggle('alert', n && !(K.station === 'grill' && K.fire === k));
    });
    if (K.warm.length || (K.dish.skin && K.tickets.length)) plate = true;
    K.btn.order.classList.toggle('alert', order && K.station !== 'order');
    K.btn.grill.classList.toggle('alert', fire && K.station !== 'grill');
    K.btn.plate.classList.toggle('alert', plate && K.station !== 'plate');
    if (K.hint) K.hint.textContent = N.guests.some(function (g) { return g && g.state === 'order'; }) ? OT.t('k.tapGuest') : '';
  }

  // ---------------------------------------------------------------
  // 最初の1日の案内（時間は止まり、ほかの客は来ない）
  //   sel は光らせる場所。関数のときは、そのときのようすで場所を変える
  // ---------------------------------------------------------------
  function holding(kind, id) { return K.tool && (id ? K.tool.id === id : (K.tool.kind === kind)); }
  var TUT = [
    { key: 'k1', sel: '.seat-hit.call', done: function () { return K.tickets.length > 0; } },
    { key: 'k2', sel: '.rail .ticket', ok: true },
    { key: 'k3', sel: '.st-btn[data-st=grill]', done: function () { return K.station === 'grill'; } },
    { key: 'k4', sel: '.k-row.raw .k-chip[data-id=tai]', done: function () { return K.slots.some(function (s) { return s.item; }) || K.warm.length; } },
    { key: 'k5', sel: '.grill-canvas', done: function () { return K.slots.some(function (s) { return s.item && s.item.flipped; }) || K.warm.length; } },
    { key: 'k6', sel: '.grill-canvas', done: function () { return K.warm.length > 0; } },
    { key: 'k7', sel: '.st-btn[data-st=plate]', done: function () { return K.station === 'plate'; } },
    { key: 'k8', sel: '.st-plate .k-chip[data-id=tortilla]', done: function () { return !!K.dish.skin; } },
    { key: 'k9', sel: function () { return holding('warm') ? '.plate-board' : '.st-plate .k-chip.q-good, .st-plate .k-chip.q-raw, .st-plate .k-chip.q-burnt'; },
      done: function () { return K.dish.layers.some(function (L) { return L.id === 'tai'; }); } },
    { key: 'k10', sel: function () { return holding(null, 'bainiku') ? '.plate-board' : '.st-plate .k-chip[data-id=bainiku]'; },
      done: function () { return K.dish.layers.some(function (L) { return L.id === 'bainiku' && L.amount > 60; }); } },
    { key: 'k11', sel: function () { return holding(null, 'daikon') ? '.plate-board' : '.st-plate .k-chip[data-id=daikon]'; },
      done: function () { return K.dish.layers.some(function (L) { return L.id === 'daikon' && L.amount >= 4; }); } },
    { key: 'k12', sel: '.wrap-btn', done: function (ev) { return ev === 'served'; } },
    { key: 'k13', sel: '.st-btn[data-st=order]', ok: true }
  ];
  OT.kitchen.tutorialActive = function () { var s = st(); return !!(K && s && s.day === 1 && !s.flags.tutNight); };
  OT.kitchen.tutorialCheck = function (ev) {
    if (!OT.kitchen.tutorialActive() || !OT.tut) return;
    if (OT.serve.isOpen()) { OT.tut.clear(); return; }   // 出す場面のあいだは、案内を出さない
    var s = st();
    var i = s.flags.tutStep || 0;
    // 済んだ手順を進める
    while (i < TUT.length && TUT[i].done && TUT[i].done(ev)) i++;
    s.flags.tutStep = i;
    if (i >= TUT.length) { OT.kitchen.tutorialEnd(); return; }
    var step = TUT[i];
    OT.tut.point(step.key, typeof step.sel === 'function' ? step.sel() : step.sel, {
      force: true, index: i + 1, total: TUT.length,
      ok: step.ok ? function () { s.flags.tutStep = i + 1; OT.kitchen.tutorialCheck(); } : null,
      close: function () { OT.kitchen.tutorialEnd(); }
    });
  };
  OT.kitchen.tutorialEnd = function () {
    var s = st();
    s.flags.tutNight = 1;
    OT.tut.clear();
    if (K && K.N) { K.N.frozen = false; OT.ui.toast(OT.t('k.tutEnd'), 'tip long'); }
  };
})(window);
