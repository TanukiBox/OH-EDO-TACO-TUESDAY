/*
 * 多幸寿：厨房（3つの持ち場）
 *   注文（木札）… 客をタップして注文を聞くと、木札が紐に吊るされる（客の動きは night.js）
 *   焼き場 …… 七輪（焼く）・油鍋（揚げる）・藁焼き（炙る）。焼き加減で点が変わる
 *   盛り付け … 皮を置き、具をドラッグ、薬味は撒き、たれは回しかける。包んで客に出す
 *   どの持ち場にいても、焼き場の時間と客の待ち時間は進み続ける。
 *   数字は config.js の KITCHEN と SCORE。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var doc = global.document;

  var K = null;
  function cfg() { return OT.CFG; }
  function KC() { return OT.CFG.KITCHEN; }
  function st() { return OT.state.get(); }
  function ingOf(id) { return cfg().INGREDIENTS[id] || {}; }
  function useOf(id) {
    var g = ingOf(id);
    if (g.use) return g.use;
    return g.cat === 'herb' ? 'sprinkle' : g.cat === 'salsa' ? 'drizzle' : 'drop';
  }
  function chIdx() { return Math.min(5, OT.state.chapter() - 1); }

  // 焼き場の場所（背景の絵の上の位置 0〜1。絵の一覧に位置があればそれを使う）
  var SLOT_POS = {
    grill: [[0.17, 0.33], [0.33, 0.33], [0.17, 0.72], [0.33, 0.72]],
    fry: [[0.6, 0.35], [0.6, 0.74]],
    sear: [[0.86, 0.55]]
  };
  var GW = 256, GH = 176;       // 焼き場の絵の大きさ
  var BOARD = 128;              // 盛り付けの皮の絵の大きさ

  // ---------------------------------------------------------------
  // つくる
  // ---------------------------------------------------------------
  OT.kitchen = {
    /** night.js が夜のはじめに呼ぶ。rail と3つの持ち場とボタンを作る */
    build: function (N, root, stallEl) {
      K = { N: N, station: 'order', tickets: [], selected: null, nextId: 1, slots: [], warm: [],
            dish: null, folding: -1, foldT: 0, drag: null, sfxT: 0, parts: [] };
      var P = (OT.sprites.manifest.kitchen || {}).slots;
      if (P) SLOT_POS = P;
      ['grill', 'fry', 'sear'].forEach(function (kind) {
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
      OT.kitchen.go('order');
      renderRail(); renderRaw(); renderPlate(); drawBoard();
      return OT.kitchen;
    },

    go: function (station) {
      K.station = station;
      Object.keys(K.el).forEach(function (k) { K.el[k].classList.toggle('on', k === station); });
      Object.keys(K.btn).forEach(function (k) { K.btn[k].classList.toggle('on', k === station); });
      if (station === 'plate') { renderPlate(); drawBoard(); }
      if (station === 'grill') renderRaw();
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
      if (K.station === 'grill') drawGrill();
      if (K.station === 'plate' && (K.dirty || K.folding >= 0 || K.parts.length)) { drawBoard(); K.dirty = false; }
    },
    isBusy: function () { return K && (K.folding >= 0); },
    leave: function () { K = null; },
    _peek: function () { return K; },

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
    var skin = r.skin === 'any' || r.skin === 'kagomushi' ? r.skin : r.skin;
    return [skin].concat(OT.needOf(t.order, t.variant));
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
  // 焼き場
  // ---------------------------------------------------------------
  function buildGrill() {
    var wrap = OT.el('div', { class: 'station st-grill' });
    K.grillCanvas = OT.ui.pixelCanvas(GW, GH, 'grill-canvas');
    var holdStart = 0, holdSlot = null;
    K.grillCanvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var r = K.grillCanvas.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * GW, y = (e.clientY - r.top) / r.height * GH;
      var s = slotAt(x, y);
      if (!s) return;
      if (s.kind === 'sear' && s.item && s.item.state === 'cook') { holdSlot = s; holdStart = performance.now(); s.item.holding = true; OT.sfx.flame(); return; }
      tapSlot(s);
    });
    function release() {
      if (!holdSlot) return;
      var s = holdSlot; holdSlot = null;
      if (s.item) s.item.holding = false;
      if (performance.now() - holdStart < 180 && s.item && s.item.p > 0.05) tapSlot(s, true);   // 短いタップは「下ろす」
    }
    K.grillCanvas.addEventListener('pointerup', release);
    K.grillCanvas.addEventListener('pointercancel', release);
    K.grillCanvas.addEventListener('pointerleave', release);
    wrap.appendChild(K.grillCanvas);
    K.grillMsg = OT.el('div', { class: 'grill-msg' });
    wrap.appendChild(K.grillMsg);
    wrap.appendChild(OT.el('div', { class: 'k-label', text: OT.t('k.raw') }));
    K.rawEl = OT.el('div', { class: 'k-row raw' });
    wrap.appendChild(K.rawEl);
    wrap.appendChild(OT.el('div', { class: 'k-label', text: OT.t('k.warm') }));
    K.warmEl = OT.el('div', { class: 'k-row warm' });
    wrap.appendChild(K.warmEl);
    return wrap;
  }

  function slotAt(x, y) {
    var best = null, bd = 26;
    K.slots.forEach(function (s) {
      if (s.locked) return;
      var d = Math.hypot(s.pos[0] * GW - x, s.pos[1] * GH - y);
      if (d < bd) { bd = d; best = s; }
    });
    return best;
  }

  function cookables() {
    return Object.keys(cfg().INGREDIENTS).filter(function (id) { return ingOf(id).cook && st().seen[id]; });
  }

  function renderRaw() {
    if (!K || !K.rawEl) return;
    K.rawEl.innerHTML = '';
    var list = cookables();
    list.sort(function (a, b) { return (OT.state.stockOf(b) > 0) - (OT.state.stockOf(a) > 0); });
    if (!list.length) K.rawEl.appendChild(OT.el('span', { class: 'k-empty', text: OT.t('k.noRaw') }));
    list.forEach(function (id) {
      var n = OT.state.stockOf(id);
      var c = OT.ui.pixelCanvas(32, 32, 'k-ico');
      OT.art.drawIcon(c, id);
      var method = ingOf(id).cook;
      K.rawEl.appendChild(OT.el('button', { class: 'k-chip' + (n ? '' : ' empty'), 'data-id': id, onclick: function () { putOnFire(id); } }, [
        c, OT.el('span', { class: 'k-name', text: OT.ingName(id) }),
        OT.el('span', { class: 'k-sub', text: OT.t('k.m.' + method) + '　' + OT.t('ui.stock', { n: n }) })
      ]));
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
    var slot = null;
    K.slots.forEach(function (s) { if (!slot && s.kind === method && !s.locked && !s.item) slot = s; });
    if (!slot) { OT.sfx.denied(); OT.ui.toast(OT.t('k.full.' + method)); return; }
    OT.state.useStock(id, 1);
    var C = KC()[method];
    slot.item = { id: id, p: 0, t: 0, time: (C.time || 1) * (KC().timeMul[id] || 1), flipped: false, flipOk: false, state: 'cook', holding: false };
    OT.sfx.place();
    if (method === 'grill') OT.sfx.sizzle(); else if (method === 'fry') OT.sfx.oil();
    // はじめての揚げ物・藁焼きでは、やり方をひとこと
    var fl = st().flags;
    if (method !== 'grill' && !fl['k_hint_' + method]) { fl['k_hint_' + method] = 1; OT.ui.toast(OT.t('k.hint.' + method), 'tip long'); }
    renderRaw();
    OT.kitchen.tutorialCheck();
  }

  /** 焼き場の1か所をタップしたとき：裏返す / 下ろす / 引き上げる */
  function tapSlot(s, fromHold) {
    var it = s.item;
    if (!it) return;
    var C = KC()[s.kind];
    if (s.kind === 'grill') {
      if (!it.flipped && Math.abs(it.p - C.flipAt) <= C.flipWindow) { it.flipped = true; it.flipOk = true; OT.sfx.flip(); msg(OT.t('k.flipped')); OT.kitchen.tutorialCheck(); return; }
      if (!it.flipped && it.p < C.flipAt - C.flipWindow) { msg(OT.t('k.wait')); return; }
      if (!it.flipped && it.p < C.done[0] - 0.1) { it.flipped = true; OT.sfx.flip(); msg(OT.t('k.flipLate')); return; }
      if (it.p < 0.85 && !fromHold) { msg(OT.t('k.notYet')); return; }
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
    var state = p < C.done[0] - 0.05 ? 'raw' : p > C.burn ? 'burnt' : p > C.done[1] + (C.burn - C.done[1]) * 0.5 ? 'burnt' : 'good';
    return { q: Math.round(q * 100) / 100, state: state };
  }

  function takeOff(s) {
    if (K.warm.length >= KC().warmTray) { OT.sfx.denied(); msg(OT.t('k.warmFull')); return; }
    var Q = quality(s.kind, s.item);
    K.warm.push({ id: s.item.id, q: Q.q, state: Q.state });
    msg(OT.t('k.took', { name: OT.ingName(s.item.id), q: OT.t('k.q.' + Q.state) }));
    s.item = null;
    OT.sfx.place();
    renderWarm();
    renderPlate();
    OT.kitchen.tutorialCheck();
  }

  function msg(t) { if (!K) return; K.grillMsg.textContent = t; K.grillMsg.className = 'grill-msg on'; clearTimeout(K.msgT); K.msgT = setTimeout(function () { if (K) K.grillMsg.className = 'grill-msg'; }, 1400); }

  function drawGrill() {
    var ctx = K.grillCanvas.getContext('2d'), P = OT.PAL;
    ctx.imageSmoothingEnabled = false;
    var bg = OT.sprites.get('k_grill');
    if (bg && bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0);
    else { ctx.fillStyle = P.brown2; ctx.fillRect(0, 0, GW, GH); }
    var t = K.N.time;
    K.slots.forEach(function (s) {
      var x = Math.round(s.pos[0] * GW), y = Math.round(s.pos[1] * GH);
      if (s.locked) {
        ctx.fillStyle = 'rgba(13,24,48,0.6)'; ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.gray1; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', x, y + 4);
        return;
      }
      var it = s.item;
      if (s.kind === 'sear' && it && it.holding) {
        var fl = OT.sprites.get('k_flame' + (Math.floor(t * 12) % 3));
        if (fl && fl.complete && fl.naturalWidth) ctx.drawImage(fl, x - 24, y - 40);
      }
      if (!it) return;
      var C = KC()[s.kind];
      var prog = s.kind === 'sear' ? it.seared / C.done[1] : it.p;
      var Q = quality(s.kind, it);
      OT.sprites.drawPieceState(ctx, it.id, Q.state, x, y, it.flipped && s.kind === 'grill');
      if (s.kind === 'fry') {   // 泡
        var big = it.p < 0.6 ? 2 : 1;
        ctx.fillStyle = P.warm1;
        for (var k = 0; k < 6; k++) { var a = (t * 3 + k * 1.1) % 1; ctx.fillRect(Math.round(x - 14 + k * 5), Math.round(y + 8 - a * 18), big, big); }
      }
      if (s.kind === 'grill' && Math.floor(t * 8) % 2) { ctx.fillStyle = 'rgba(255,250,240,0.5)'; ctx.fillRect(x - 6 + Math.round(Math.sin(t * 5) * 4), y - 20 - Math.round((t * 20) % 8), 2, 3); }
      // 時間のリング
      var R = 21;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(13,24,48,0.7)';
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = Q.state === 'burnt' ? P.red1 : prog >= (C.done ? C.done[0] / (s.kind === 'sear' ? C.done[1] : 1) : 0.95) ? P.green1 : P.warm2;
      ctx.beginPath(); ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, prog)); ctx.stroke();
      if (s.kind === 'grill' && !it.flipped) {   // 裏返す印
        var a2 = -Math.PI / 2 + Math.PI * 2 * C.flipAt;
        var near = Math.abs(it.p - C.flipAt) <= C.flipWindow;
        ctx.fillStyle = near && Math.floor(t * 8) % 2 ? P.white : P.warm1;
        ctx.fillRect(Math.round(x + Math.cos(a2) * R) - 3, Math.round(y + Math.sin(a2) * R) - 3, 6, 6);
      }
      if (s.kind === 'grill' || s.kind === 'fry') {   // ちょうど良い範囲
        ctx.strokeStyle = 'rgba(168,224,90,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, R + 3, -Math.PI / 2 + Math.PI * 2 * Math.min(1, C.done[0]), -Math.PI / 2 + Math.PI * 2 * Math.min(1, C.done[1])); ctx.stroke();
      }
    });
  }

  // ---------------------------------------------------------------
  // 盛り付け
  // ---------------------------------------------------------------
  function newDish() { return { skin: null, layers: [], seq: [] }; }

  function buildPlate() {
    var wrap = OT.el('div', { class: 'station st-plate' });
    var top = OT.el('div', { class: 'plate-top' });
    K.board = OT.ui.pixelCanvas(BOARD, BOARD, 'plate-board');
    K.boardWrap = OT.el('div', { class: 'plate-board-wrap' }, [K.board]);
    K.plateInfo = OT.el('div', { class: 'plate-info' });
    K.boardWrap.appendChild(K.plateInfo);
    if (OT.sprites.has('people_mateo_happi')) { K.mateo = OT.ui.pixelCanvas(64, 80, 'plate-mateo'); top.appendChild(K.mateo); }
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
    // ドラッグ
    K.ghost = OT.el('div', { class: 'drag-ghost' });
    doc.getElementById('app').appendChild(K.ghost);
    return wrap;
  }

  function chip(id, sub, onDown, cls, onTap) {
    var c = OT.ui.pixelCanvas(32, 32, 'k-ico');
    OT.art.drawIcon(c, id);
    var el = OT.el('button', { class: 'k-chip ' + (cls || ''), 'data-id': id }, [c, OT.el('span', { class: 'k-name', text: OT.ingName(id) }), OT.el('span', { class: 'k-sub', text: sub })]);
    if (onDown) el.addEventListener('pointerdown', function (e) { e.preventDefault(); onDown(e, el, c); });
    if (onTap) el.addEventListener('click', function (e) { e.preventDefault(); onTap(); });
    return el;
  }

  function renderPlate() {
    if (!K || !K.rows) return;
    var t = currentTicket();
    var want = t && t.order ? ticketSteps(t) : [];
    K.rows.innerHTML = '';
    function row(labelKey, items) {
      if (!items.length) return;
      var r = OT.el('div', { class: 'k-row' });
      items.forEach(function (x) { r.appendChild(x); });
      K.rows.appendChild(OT.el('div', { class: 'k-label', text: OT.t(labelKey) }));
      K.rows.appendChild(r);
    }
    // 皮
    var skins = Object.keys(cfg().INGREDIENTS).filter(function (id) {
      var g = ingOf(id); return g.cat === 'skin' && id !== 'kagomushi' && (g.virtual ? OT.state.chapter() >= 3 : st().seen[id]) && OT.state.stockOf(id) > 0;
    });
    skins.sort(function (a, b) { return (want.indexOf(b) >= 0 || (want[0] && OT.skinOk(want[0], b))) - (want.indexOf(a) >= 0 || (want[0] && OT.skinOk(want[0], a))); });
    row('k.row.skin', skins.map(function (id) {
      return chip(id, OT.t('ui.stock', { n: OT.state.stockOf(id) }), null, (K.dish.skin === id ? 'on ' : '') + (want[0] && OT.skinOk(want[0], id) ? 'want' : ''), function () { placeSkin(id); });
    }));
    // 具（焼き上がり＋そのまま使う具）
    var mains = [];
    K.warm.forEach(function (w, i) {
      mains.push(chip(w.id, OT.t('k.q.' + w.state), function (e, el, c) { startDrag(e, { kind: 'warm', index: i, id: w.id, canvas: c }); }, 'q-' + w.state + (want.indexOf(w.id) >= 0 ? ' want' : '')));
    });
    Object.keys(cfg().INGREDIENTS).forEach(function (id) {
      var g = ingOf(id);
      if (g.cook || g.cat === 'skin' || g.cat === 'ready' || g.cat === 'raw' || !st().seen[id]) return;
      if (useOf(id) !== 'drop' || OT.state.stockOf(id) <= 0) return;
      mains.push(chip(id, OT.t('ui.stock', { n: OT.state.stockOf(id) }), function (e, el, c) { startDrag(e, { kind: 'stock', id: id, canvas: c }); }, want.indexOf(id) >= 0 ? 'want' : ''));
    });
    mains.sort(function (a, b) { return b.classList.contains('want') - a.classList.contains('want'); });   // 札にある具を前に
    row('k.row.main', mains);
    // 薬味・たれ
    var sp = [];
    Object.keys(cfg().INGREDIENTS).forEach(function (id) {
      var g = ingOf(id), u = useOf(id);
      if (g.cook || !st().seen[id] || (u !== 'sprinkle' && u !== 'drizzle') || OT.state.stockOf(id) <= 0) return;
      sp.push(chip(id, OT.t('k.use.' + u) + ' ' + OT.t('ui.stock', { n: OT.state.stockOf(id) }), function (e, el, c) { startDrag(e, { kind: u, id: id, canvas: c }); }, (u === 'drizzle' ? 'jug ' : 'bowl ') + (want.indexOf(id) >= 0 ? 'want' : '')));
    });
    sp.sort(function (a, b) { return b.classList.contains('want') - a.classList.contains('want'); });
    row('k.row.top', sp);
    if (!K.rows.children.length) K.rows.appendChild(OT.el('span', { class: 'k-empty', text: OT.t('night.out') }));
    // かご蒸し
    var kago = OT.state.chapter() >= cfg().KAGO.chapter && OT.state.stockOf('kagomushi') > 0;
    K.kagoBtn.style.display = kago ? '' : 'none';
    K.kagoBtn.textContent = '🧺 ×' + OT.state.stockOf('kagomushi');
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

  // --- ドラッグ（具を置く・薬味を撒く・たれを回しかける） ---
  function boardPoint(e) {
    var r = K.board.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * BOARD, y: (e.clientY - r.top) / r.height * BOARD, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
  }
  function onSkin(pt) { var dx = (pt.x - 64) / 44, dy = (pt.y - 64) / 40; return dx * dx + dy * dy <= 1; }

  function startDrag(e, d) {
    if (K.folding >= 0) return;
    if (!K.dish.skin) { OT.sfx.denied(); OT.ui.toast(OT.t('night.needSkin')); return; }
    K.drag = d;
    d.layer = null; d.lastX = null; d.lastPt = null;
    K.ghost.innerHTML = '';
    var g = OT.ui.pixelCanvas(32, 32, 'ghost-ico'), gc = g.getContext('2d');
    var tool = d.kind === 'sprinkle' ? 'k_bowl' : d.kind === 'drizzle' ? 'k_jug' : null;
    if (tool && OT.sprites.has(tool)) { gc.drawImage(OT.sprites.get(tool), 0, 0); gc.drawImage(d.canvas, 8, 2, 16, 16); }
    else gc.drawImage(d.canvas, 0, 0);
    K.ghost.appendChild(g);
    K.ghost.className = 'drag-ghost on ' + d.kind;
    moveGhost(e);
    var move = function (ev) { ev.preventDefault(); dragMove(ev); };
    var up = function (ev) { global.removeEventListener('pointermove', move); global.removeEventListener('pointerup', up); global.removeEventListener('pointercancel', up); dragEnd(ev); };
    global.addEventListener('pointermove', move, { passive: false });
    global.addEventListener('pointerup', up);
    global.addEventListener('pointercancel', up);
  }

  function moveGhost(e) {
    var app = doc.getElementById('app').getBoundingClientRect();
    K.ghost.style.left = (e.clientX - app.left) + 'px';
    K.ghost.style.top = (e.clientY - app.top) + 'px';
  }

  function dragMove(e) {
    var d = K.drag;
    if (!d) return;
    moveGhost(e);
    var pt = boardPoint(e);
    if (!pt.inside || !onSkin(pt)) return;
    if (d.kind === 'sprinkle') {
      if (!d.layer) d.layer = ensureLayer(d.id, 'sprinkle');
      if (d.lastX === null || Math.abs(pt.x - d.lastX) >= 9) {
        d.lastX = pt.x;
        d.layer.amount += 1;
        var r = OT.rng(OT.hash(d.id) + d.layer.amount * 13);
        for (var k = 0; k < 3; k++) {
          var q = { x: pt.x + (r() - 0.5) * 16, y: pt.y + (r() - 0.5) * 12 };
          if (onSkin(q)) { d.layer.pts.push(q); K.parts.push({ x: q.x, y: q.y - 12, ty: q.y, t: 0, id: d.id }); }
        }
        OT.sfx.sprinkle();
        showCount(d.layer);
      }
    } else if (d.kind === 'drizzle') {
      if (!d.layer) d.layer = ensureLayer(d.id, 'drizzle');
      if (!d.lastPt || Math.hypot(pt.x - d.lastPt.x, pt.y - d.lastPt.y) >= 3) {
        if (d.lastPt) d.layer.amount += Math.hypot(pt.x - d.lastPt.x, pt.y - d.lastPt.y);
        d.lastPt = { x: pt.x, y: pt.y };
        d.layer.pts.push({ x: pt.x, y: pt.y, brk: d.layer.pts.length && d.newStroke });
        d.newStroke = false;
        if (Math.random() < 0.25) OT.sfx.pour();
        showCount(d.layer);
      }
    }
    K.dirty = true;
  }

  function ensureLayer(id, use) {
    // 同じ薬味・たれを続けて使うときは、同じ層に足す
    var last = K.dish.layers[K.dish.layers.length - 1];
    if (last && last.id === id && last.use === use) { if (use === 'drizzle') K.drag.newStroke = true; return last; }
    var L = { id: id, use: use, amount: 0, pts: [], q: null };
    K.dish.layers.push(L);
    if (K.dish.seq.indexOf(id) < 0) K.dish.seq.push(id);
    if (!OT.state.useStock(id, 1)) { /* 在庫の数は、使い始めに1つ減らす */ }
    return L;
  }

  function showCount(L) {
    var v = L.use === 'sprinkle' ? '×' + L.amount : Math.round(L.amount / cfg().SCORE.drizzleTarget * 100) + '%';
    K.plateInfo.textContent = OT.ingName(L.id) + '　' + v;
  }

  function dragEnd(e) {
    var d = K.drag;
    K.drag = null;
    K.ghost.className = 'drag-ghost';
    if (!d) return;
    var pt = boardPoint(e);
    // 捨て桶に落としたら、捨てる（焼き上がりの具）
    var tr = K.trash.getBoundingClientRect();
    if (d.kind === 'warm' && e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom) {
      K.warm.splice(d.index, 1); OT.sfx.denied(); renderPlate(); renderWarm(); return;
    }
    if ((d.kind === 'warm' || d.kind === 'stock') && pt.inside && onSkin(pt)) {
      if (K.dish.layers.filter(function (L) { return L.use === 'drop'; }).length >= cfg().RATING.maxToppings) { OT.sfx.denied(); OT.ui.toast(OT.t('night.full')); return; }
      var q = null;
      if (d.kind === 'warm') { var w = K.warm.splice(d.index, 1)[0]; q = w.q; d.state = w.state; }
      else OT.state.useStock(d.id, 1);
      K.dish.layers.push({ id: d.id, use: 'drop', amount: 1, pts: [{ x: pt.x, y: pt.y }], q: q, state: d.state || 'good' });
      if (K.dish.seq.indexOf(d.id) < 0) K.dish.seq.push(d.id);
      OT.sfx.place();
    }
    renderPlate(); renderWarm(); drawBoard();
    OT.kitchen.tutorialCheck();
  }

  function trashDish() {
    if (K.folding >= 0 || !K.dish.skin) return;
    K.dish = newDish();
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
    var name = t ? (t.guest.name || OT.t('cust.' + t.guest.typeId)) + '：' + (t.order ? OT.tacoName(t.order, t.variant) : OT.t('night.omakaseName')) : OT.t('k.noTicket');
    if (!K.drag) K.plateInfo.textContent = name;
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
    OT.sfx.wrap();
    OT.kitchen.tutorialCheck();
  }

  function serveDish() {
    var t = K.foldTicket, served = dishServed(), plating = platingInfo();
    K.folding = -1;
    K.dish = newDish();
    if (t && t.guest.state === 'wait') {
      OT.night.serve(t.guest, served, plating);
      OT.kitchen.dropTicketFor(t.guest);
    } else OT.ui.toast(OT.t('k.gone'));
    renderPlate(); drawBoard();
    OT.kitchen.tutorialCheck('served');
  }

  function serveKago() {
    var t = currentTicket();
    if (!t) { OT.sfx.denied(); OT.ui.toast(OT.t('k.noTicket')); return; }
    if (!OT.state.useStock('kagomushi', 1)) { OT.sfx.denied(); return; }
    OT.sfx.wrap();
    OT.night.serve(t.guest, { skin: 'kagomushi', items: [] }, null);
    OT.kitchen.dropTicketFor(t.guest);
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
      var C = KC()[s.kind];
      if (s.kind === 'sear') {
        it.seared = (it.seared || 0) + (it.holding ? dt : 0);
        it.p = it.seared / C.done[1];
      } else {
        it.t += dt;
        it.p = it.t / it.time;
        if (s.kind === 'grill') sizzling = true; else frying = true;
      }
    });
    K.sfxT -= dt;
    if (K.sfxT <= 0 && (sizzling || frying)) { K.sfxT = 0.45; if (sizzling) OT.sfx.sizzle(true); if (frying) OT.sfx.oil(true); }
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
    alerts();
    if (K.mateo) {
      var ctx = K.mateo.getContext('2d');
      ctx.clearRect(0, 0, 64, 80);
      var an = K.N.mateoT > 0 ? K.N.mateoAnim : (K.dish.skin || K.folding >= 0 ? 'cook' : 'wait');
      OT.sprites.drawPerson(ctx, 'mateo_happi', an, K.N.time, 32, 80, false, an === 'cook' ? 5 : 3);
    }
  }

  /** 持ち場のボタンを光らせて知らせる */
  function alerts() {
    var N = K.N, order = false, grill = false, plate = false;
    N.guests.forEach(function (g) {
      if (!g) return;
      if (g.state === 'order') order = true;
      if ((g.state === 'wait' || g.state === 'order') && g.patience / g.patienceMax < 0.3) order = true;
    });
    K.slots.forEach(function (s) {
      var it = s.item;
      if (!it) return;
      var C = KC()[s.kind];
      if (s.kind === 'grill' && !it.flipped && Math.abs(it.p - C.flipAt) <= C.flipWindow) grill = true;
      if (s.kind !== 'sear' && it.p >= C.done[0]) grill = true;
    });
    if (K.warm.length || (K.dish.skin && K.tickets.length)) plate = true;
    K.btn.order.classList.toggle('alert', order && K.station !== 'order');
    K.btn.grill.classList.toggle('alert', grill && K.station !== 'grill');
    K.btn.plate.classList.toggle('alert', plate && K.station !== 'plate');
    if (K.hint) K.hint.textContent = N.guests.some(function (g) { return g && g.state === 'order'; }) ? OT.t('k.tapGuest') : '';
  }

  // ---------------------------------------------------------------
  // 最初の1日の案内（時間は止まり、ほかの客は来ない）
  // ---------------------------------------------------------------
  var TUT = [
    { key: 'k1', sel: '.seat-hit.call', st: 'order', done: function () { return K.tickets.length > 0; } },
    { key: 'k2', sel: '.rail .ticket', ok: true },
    { key: 'k3', sel: '.st-btn[data-st=grill]', done: function () { return K.station === 'grill'; } },
    { key: 'k4', sel: '.k-row.raw .k-chip[data-id=tai]', st: 'grill', done: function () { return K.slots.some(function (s) { return s.item; }) || K.warm.length; } },
    { key: 'k5', sel: '.grill-canvas', st: 'grill', done: function () { return K.slots.some(function (s) { return s.item && s.item.flipped; }) || K.warm.length; } },
    { key: 'k6', sel: '.grill-canvas', st: 'grill', done: function () { return K.warm.length > 0; } },
    { key: 'k7', sel: '.st-btn[data-st=plate]', done: function () { return K.station === 'plate'; } },
    { key: 'k8', sel: '.k-chip[data-id=tortilla]', st: 'plate', done: function () { return !!K.dish.skin; } },
    { key: 'k9', sel: '.k-row .k-chip.q-good, .k-row .k-chip.q-raw, .k-row .k-chip.q-burnt', st: 'plate', done: function () { return K.dish.layers.some(function (L) { return L.id === 'tai'; }); } },
    { key: 'k10', sel: '.k-chip[data-id=bainiku]', st: 'plate', done: function () { return K.dish.layers.some(function (L) { return L.id === 'bainiku' && L.amount > 60; }); } },
    { key: 'k11', sel: '.k-chip[data-id=daikon]', st: 'plate', done: function () { return K.dish.layers.some(function (L) { return L.id === 'daikon' && L.amount >= 4; }); } },
    { key: 'k12', sel: '.wrap-btn', st: 'plate', done: function (ev) { return ev === 'served' || K.folding >= 0; } },
    { key: 'k13', sel: '.score-card', ok: true }
  ];
  OT.kitchen.tutorialActive = function () { var s = st(); return !!(K && s && s.day === 1 && !s.flags.tutNight); };
  OT.kitchen.tutorialCheck = function (ev) {
    if (!OT.kitchen.tutorialActive() || !OT.tut) return;
    var s = st();
    var i = s.flags.tutStep || 0;
    // 済んだ手順を進める
    while (i < TUT.length && TUT[i].done && TUT[i].done(ev)) i++;
    s.flags.tutStep = i;
    if (i >= TUT.length) { OT.kitchen.tutorialEnd(); return; }
    var step = TUT[i];
    OT.tut.point(step.key, step.sel, {
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
