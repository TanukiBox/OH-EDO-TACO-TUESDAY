/*
 * 多幸寿：夜の営業（客が来る → 注文 → 料理 → 包んで出す → 評価）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var W = 192, H = 108;               // 屋台の絵の大きさ（ドット）
  var SEAT_X = [36, 96, 156];          // 席の位置
  var GUEST_Y = 90;
  var CATS = ['skin', 'main', 'salsa', 'herb'];

  var N = null;   // 今夜のようす

  function cfg() { return OT.CFG; }
  function st() { return OT.state.get(); }

  // ---------------------------------------------------------------
  // 客
  // ---------------------------------------------------------------
  function unlockedTypes() {
    var ch = OT.state.chapter();
    return Object.keys(cfg().CUSTOMERS).filter(function (id) { return cfg().CUSTOMERS[id].chapter <= ch; });
  }
  /** 今夜頼まれるかもしれないタコス（章・季節・鯨の日で絞る） */
  function menu() {
    var ch = OT.state.chapter(), season = OT.state.season();
    return Object.keys(cfg().TACOS).filter(function (id) {
      var r = cfg().TACOS[id];
      if (r.chapter > ch || r.onlyWhenOut) return false;
      if (r.season && r.season !== season) return false;
      if (id === 'isana' && OT.state.stockOf('kujira') <= 0) return false;   // 鯨は入った日だけ
      return true;
    });
  }
  /** 手持ちの在庫で作れる部位（部位つきタコス）。作れなければ null */
  function makeableVariant(tacoId) {
    var r = cfg().TACOS[tacoId];
    if (!r.variants) return null;
    var ok = Object.keys(r.variants).filter(function (v) { return canMake(tacoId, v); });
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
  }
  function hasSkin(skin) {
    return Object.keys(cfg().INGREDIENTS).some(function (id) {
      return OT.state.stockOf(id) > 0 && OT.skinOk(skin, id);
    });
  }
  function canMake(tacoId, variant) {
    var r = cfg().TACOS[tacoId];
    if (r.variants && !variant) return !!makeableVariant(tacoId);
    if (r.skin === 'kagomushi') return OT.state.stockOf('kagomushi') > 0;
    if (!hasSkin(r.skin)) return false;
    return OT.needOf(tacoId, variant).every(function (id) { return OT.state.stockOf(id) > 0; });
  }
  function pickWeighted(list, weightOf) {
    var sum = 0;
    list.forEach(function (x) { sum += weightOf(x); });
    var r = Math.random() * sum;
    for (var i = 0; i < list.length; i++) { r -= weightOf(list[i]); if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  /** 客の注文を決める。{ order, variant }（order が null ならおまかせ） */
  function chooseOrder(type) {
    var m = menu();
    var makeable = m.filter(function (id) { return canMake(id); });
    // 仕込み切れ：何も作れないときは「素タコス（一文）」
    var sutaco = cfg().TACOS.sutaco;
    if (!makeable.length && sutaco.chapter <= OT.state.chapter() && hasSkin('any')) return { order: 'sutaco' };
    if (Math.random() < type.omakase || !m.length) return { order: null };
    var late = N && N.time > cfg().DAY.nightSeconds * cfg().DAY.lateNight;
    var order = pickWeighted(m, function (id) {
      var rank = type.likes.indexOf(id);
      var w = rank < 0 ? 1 : (type.likes.length - rank) + 1;
      if (id === 'chazuke' && late) w *= 4;              // 夜ふけは〆の茶漬け
      return canMake(id) ? w : w * 0.12;                  // 作れないものは頼まれにくい
    });
    var r = cfg().TACOS[order], variant = null;
    if (r.variants) {
      variant = makeableVariant(order);
      if (!variant) { var keys = Object.keys(r.variants); variant = keys[Math.floor(Math.random() * keys.length)]; }
    }
    return { order: order, variant: variant };
  }

  function makeGuest(seat) {
    var types = unlockedTypes();
    var typeId = pickWeighted(types, function (id) { return cfg().CUSTOMER_MIX[id] || 1; });
    var type = cfg().CUSTOMERS[typeId];
    var j = cfg().CUSTOMER_JITTER;
    var want = type.want.map(function (v) { return Math.max(0, v + Math.round((Math.random() * 2 - 1) * j)); });
    var o = chooseOrder(type);
    return {
      typeId: typeId, type: type, want: want, order: o.order, variant: o.variant, seat: seat,
      x: seat < 1 ? -20 : W + 20, state: 'in', t: 0,
      patience: type.patience, patienceMax: type.patience, waited: 0,
      line: OT.say('cust.' + typeId + '.hello'), lineT: 2.5, mood: 'ok'
    };
  }

  // ---------------------------------------------------------------
  // 画面
  // ---------------------------------------------------------------
  OT.night = {
    enter: function () {
      var root = OT.ui.screen('night');
      root.innerHTML = '';
      N = {
        time: 0, open: true, closed: false, nextGuest: cfg().DAY.firstGuestAfter,
        guests: [null, null, null], selected: -1,
        dish: { skin: null, items: [] }, tab: 'skin',
        folding: -1, foldT: 0,
        sales: 0, served: 0, angry: 0, starsSum: 0, repDelta: 0, sold: {}, soldMoney: {}, soldVariant: {},
        floaters: []
      };

      var timer = OT.el('span', { class: 'hud-timer' });
      N.hud = OT.ui.hud(timer);
      N.timerEl = timer;
      root.appendChild(N.hud);

      // 屋台（客）
      var stage = OT.el('div', { class: 'stall' });
      N.canvas = OT.ui.pixelCanvas(W, H, 'stall-canvas');
      stage.appendChild(N.canvas);
      N.bubbles = [];
      for (var s = 0; s < 3; s++) {
        (function (seat) {
          var b = OT.el('div', { class: 'bubble', style: 'left:' + (SEAT_X[seat] / W * 100) + '%' });
          var hit = OT.el('div', { class: 'seat-hit', style: 'left:' + ((SEAT_X[seat] - 30) / W * 100) + '%;width:' + (60 / W * 100) + '%',
            onpointerdown: function (e) { e.preventDefault(); selectSeat(seat, true); } });
          stage.appendChild(hit);
          stage.appendChild(b);
          N.bubbles.push(b);
        })(s);
      }
      N.fx = OT.el('div', { class: 'fx' });
      stage.appendChild(N.fx);
      root.appendChild(stage);

      // 調理台
      var kitchen = OT.el('div', { class: 'kitchen' });
      var boardWrap = OT.el('div', { class: 'board' });
      N.board = OT.ui.pixelCanvas(128, 128, 'board-canvas');
      boardWrap.appendChild(N.board);
      N.dishName = OT.el('div', { class: 'dish-name' });
      boardWrap.appendChild(N.dishName);
      kitchen.appendChild(boardWrap);

      N.tabsEl = OT.el('div', { class: 'tabs' });
      CATS.forEach(function (c) {
        N.tabsEl.appendChild(OT.el('button', { class: 'tab', 'data-cat': c, text: OT.t('night.tab.' + c),
          onclick: function () { OT.sfx.tap(); N.tab = c; renderBins(); } }));
      });
      kitchen.appendChild(N.tabsEl);
      N.binsEl = OT.el('div', { class: 'bins' });
      kitchen.appendChild(N.binsEl);

      var actions = OT.el('div', { class: 'actions' });
      N.clearBtn = OT.button(OT.t('night.clear'), clearDish, 'ghost');
      N.wrapBtn = OT.button(OT.t('night.wrap'), wrap, 'primary');
      actions.appendChild(N.clearBtn);
      // 作り置きのかご蒸し（タップ1回で出せる）
      if (OT.state.chapter() >= cfg().KAGO.chapter && st().seen.kagomushi) {
        N.kagoBtn = OT.button('', serveKago, 'kago');
        actions.appendChild(N.kagoBtn);
        actions.classList.add('three');
      }
      actions.appendChild(N.wrapBtn);
      kitchen.appendChild(actions);
      root.appendChild(kitchen);

      renderBins();
      drawBoard();
      OT.sfx.clack(2);
      OT.ui.toast(OT.t('night.open'), 'big');
      if (st().day === 1) setTimeout(function () { if (N) OT.ui.toast(OT.t('pon.night1'), 'tip long'); }, 900);

      N.last = performance.now();
      N.raf = requestAnimationFrame(loop);
    },
    leave: function () { if (N && N.raf) cancelAnimationFrame(N.raf); N = null; },
    /** 自動テスト用：今夜のようす（ゲームでは使わない） */
    _peek: function () { return N; }
  };

  // ---------------------------------------------------------------
  // 食材の箱
  // ---------------------------------------------------------------
  function inUse(id) {
    var n = 0;
    if (N.dish.skin === id) n++;
    N.dish.items.forEach(function (x) { if (x === id) n++; });
    return n;
  }

  function renderBins() {
    if (N.kagoBtn) {
      N.kagoBtn.textContent = '🧺 ×' + OT.state.stockOf('kagomushi');
      N.kagoBtn.disabled = OT.state.stockOf('kagomushi') <= 0;
    }
    var tabs = N.tabsEl.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-cat') === N.tab);
    N.binsEl.innerHTML = '';
    var ids = Object.keys(cfg().INGREDIENTS).filter(function (id) {
      return cfg().INGREDIENTS[id].cat === N.tab && st().seen[id];
    });
    // 在庫のあるものを前に
    ids.sort(function (a, b) { return (OT.state.stockOf(b) > 0) - (OT.state.stockOf(a) > 0); });
    ids.forEach(function (id) {
      var left = OT.state.stockOf(id) - inUse(id);
      var icon = OT.ui.pixelCanvas(24, 24, 'bin-icon');
      OT.art.drawIcon(icon, id);
      var on = (N.tab === 'skin' ? N.dish.skin === id : N.dish.items.indexOf(id) >= 0);
      var b = OT.el('button', { class: 'bin' + (left <= 0 ? ' empty' : '') + (on ? ' on' : ''),
        onclick: function () { addIngredient(id); } }, [
        icon,
        OT.el('span', { class: 'bin-name', text: OT.ingName(id) }),
        OT.el('span', { class: 'bin-count', text: OT.t('ui.stock', { n: Math.max(0, left) }) })
      ]);
      N.binsEl.appendChild(b);
    });
  }

  function addIngredient(id) {
    if (N.folding >= 0) return;
    var ing = cfg().INGREDIENTS[id];
    if (OT.state.stockOf(id) - inUse(id) <= 0) { OT.sfx.denied(); OT.ui.toast(OT.t('night.out')); return; }
    if (ing.cat === 'skin') {
      N.dish.skin = id;
      OT.sfx.place();
      N.tab = 'main';
    } else {
      if (!N.dish.skin) { OT.sfx.denied(); OT.ui.toast(OT.t('night.needSkin')); N.tab = 'skin'; renderBins(); return; }
      var idx = N.dish.items.indexOf(id);
      if (idx >= 0) { N.dish.items.splice(idx, 1); OT.sfx.tap(); }   // もう一度押すと外す
      else {
        if (N.dish.items.length >= cfg().RATING.maxToppings) { OT.sfx.denied(); OT.ui.toast(OT.t('night.full')); return; }
        N.dish.items.push(id);
        OT.sfx.place();
      }
    }
    renderBins();
    drawBoard();
  }

  function clearDish() {
    if (N.folding >= 0) return;
    N.dish = { skin: null, items: [] };
    N.tab = 'skin';
    renderBins();
    drawBoard();
  }

  // ---------------------------------------------------------------
  // 調理台の絵
  // ---------------------------------------------------------------
  function drawBoard() {
    var ctx = N.board.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    var frame = N.folding >= 0 ? N.folding : 0;
    if (!N.dish.skin) {
      ctx.drawImage(OT.art.img('plate'), 0, 0);
    } else {
      OT.art.drawSkin(ctx, N.dish.skin, frame);
      OT.art.drawToppings(ctx, N.dish.items, frame);
    }
    var name = '';
    if (N.dish.skin) {
      var id = OT.identifyTaco(N.dish, OT.state.chapter());
      if (id) {
        name = '→ ' + OT.tacoName(id.id, id.variant);
        if (cfg().TACOS[id.id]) name += '  Lv' + OT.masteryLevel(id.id);
      } else if (N.dish.items.length) name = '→ ' + OT.t('night.omakaseName');
    }
    N.dishName.textContent = name;
    N.wrapBtn.disabled = !N.dish.skin || N.folding >= 0;
  }

  // ---------------------------------------------------------------
  // 包んで出す
  // ---------------------------------------------------------------
  function selectSeat(seat, byTap) {
    var g = N.guests[seat];
    if (!g || g.state !== 'wait') return;
    N.selected = seat;
    if (byTap) OT.sfx.tap();
  }

  function autoSelect() {
    var cur = N.guests[N.selected];
    if (cur && cur.state === 'wait') return;
    var best = -1, bestP = 1e9;
    N.guests.forEach(function (g, i) {
      if (g && g.state === 'wait' && g.patience < bestP) { best = i; bestP = g.patience; }
    });
    N.selected = best;
  }

  function wrap() {
    if (!N.dish.skin || N.folding >= 0) return;
    autoSelect();
    if (N.selected < 0) { OT.sfx.denied(); OT.ui.toast(OT.t('night.noGuest')); return; }
    N.folding = 0; N.foldT = 0;
    N.foldTarget = N.selected;
    OT.sfx.wrap();
    drawBoard();
  }

  function serve() {
    var g = N.guests[N.foldTarget];
    if (!g || g.state !== 'wait') { autoSelect(); g = N.guests[N.selected]; }
    var dish = N.dish;
    N.dish = { skin: null, items: [] };
    N.folding = -1;
    N.tab = 'skin';
    if (!g) { renderBins(); drawBoard(); return; }   // 出す相手がいない（まれ）
    // 在庫を使う
    OT.state.useStock(dish.skin, 1);
    dish.items.forEach(function (id) { OT.state.useStock(id, 1); });
    judge(g, dish);
    renderBins();
    drawBoard();
  }

  /** 作り置きのかご蒸しを、選んでいる客にすぐ出す */
  function serveKago() {
    if (N.folding >= 0) return;
    autoSelect();
    var g = N.guests[N.selected];
    if (!g) { OT.sfx.denied(); OT.ui.toast(OT.t('night.noGuest')); return; }
    if (!OT.state.useStock('kagomushi', 1)) { OT.sfx.denied(); OT.ui.toast(OT.t('night.out')); return; }
    OT.sfx.wrap();
    judge(g, { skin: 'kagomushi', items: [] });
    renderBins();
  }

  /** 評価して、客のようす・売上・評判に反映する */
  function judge(g, dish) {
    var res = OT.evaluate(g, dish, g.waited, OT.state.chapter());
    g.state = 'eat'; g.t = 0; g.result = res;
    g.mood = res.stars >= 2 ? 'happy' : 'worry';
    if (res.forbidden && g.type.forbid) g.line = OT.say('cust.' + g.typeId + '.forbid');
    else g.line = OT.say('cust.' + g.typeId + '.' + res.stars);
    g.lineT = 2.4;
    // ときどき、味のひとこと感想（いちばん好みから外れた味について）
    if (res.hint && res.stars < 3 && !res.forbidden && Math.random() < cfg().COMMENT_CHANCE) {
      g.comment = OT.say('cmt.' + (res.hint.more ? 'more' : 'less') + '.' + res.hint.k);
    } else if (res.stars === 3 && Math.random() < cfg().COMMENT_CHANCE * 0.5) {
      g.comment = OT.say('cmt.great');
    }
    N.sales += res.pay; N.served++; N.starsSum += res.stars; N.repDelta += res.rep;
    var key = res.recipe || 'omakase';
    N.sold[key] = (N.sold[key] || 0) + 1;
    N.soldMoney[key] = (N.soldMoney[key] || 0) + res.pay;
    if (res.recipe && res.recipe === g.order && res.variant) N.soldVariant[key] = res.variant;
    st().money += res.pay;
    var before = res.recipe && cfg().TACOS[res.recipe] ? OT.masteryLevel(res.recipe) : 0;
    st().made[key] = (st().made[key] || 0) + 1;
    floater(g.seat, '★'.repeat(res.stars) + '  +' + res.pay + OT.t('ui.mon'), 'stars s' + res.stars);
    if (before && OT.masteryLevel(res.recipe) > before) {
      setTimeout(function () { if (N) OT.ui.toast(OT.t('night.levelUp', { name: OT.tacoName(res.recipe), lv: OT.masteryLevel(res.recipe) }), 'lv'); }, 500);
    }
    OT.sfx.happy(res.stars);
    setTimeout(function () { if (N) OT.sfx.coin(); }, 350);
    refreshHud();
  }

  function floater(seat, text, cls) {
    var f = OT.el('div', { class: 'floater ' + (cls || ''), text: text, style: 'left:' + (SEAT_X[seat] / W * 100) + '%' });
    N.fx.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1800);
  }

  function refreshHud() {
    var s = st();
    N.hud.querySelector('.hud-money').textContent = '💰 ' + OT.t('ui.money', { n: s.money });
    N.hud.querySelector('.hud-rep').textContent = '⭐ ' + OT.t('ui.rep', { n: s.rep + N.repDelta });
  }

  // ---------------------------------------------------------------
  // 毎フレーム
  // ---------------------------------------------------------------
  function loop(now) {
    if (!N) return;
    var dt = Math.min(0.05, (now - N.last) / 1000);
    N.last = now;
    update(dt);
    draw();
    N.raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    var D = cfg().DAY;
    N.time += dt;
    var left = Math.max(0, Math.ceil(D.nightSeconds - N.time));
    N.timerEl.textContent = '⏳ ' + OT.t('night.close', { n: left });

    // 折りたたみのアニメ
    if (N.folding >= 0) {
      N.foldT += dt;
      var f = Math.min(7, Math.floor(N.foldT / 0.07));
      if (f !== N.folding) { N.folding = f; drawBoard(); }
      if (N.foldT > 0.07 * 8 + 0.15) serve();
    }

    // 新しい客
    if (N.open) {
      N.nextGuest -= dt;
      if (N.nextGuest <= 0 && N.time < D.nightSeconds - D.lastOrderBefore) {
        var free = [];
        N.guests.forEach(function (g, i) { if (!g) free.push(i); });
        if (free.length) {
          var seat = free[Math.floor(Math.random() * free.length)];
          N.guests[seat] = makeGuest(seat);
          OT.sfx.arrive();
          var busy = Math.pow(D.busier, OT.state.chapter() - 1);
          N.nextGuest = (D.arrivalMin + Math.random() * (D.arrivalMax - D.arrivalMin)) * busy;
        } else {
          N.nextGuest = 1.5;
        }
      }
    }

    // 客それぞれ
    N.guests.forEach(function (g, i) {
      if (!g) return;
      g.t += dt;
      if (g.lineT > 0) g.lineT -= dt;
      var target = SEAT_X[i];
      if (g.state === 'in') {
        g.x += (target - g.x) * Math.min(1, dt * 6);
        if (Math.abs(target - g.x) < 0.8) { g.x = target; g.state = 'wait'; g.t = 0; }
      } else if (g.state === 'wait') {
        if (N.folding < 0 || N.foldTarget !== i) g.patience -= dt;
        g.waited += dt;
        var ratio = g.patience / g.patienceMax;
        g.mood = ratio > 0.5 ? 'ok' : ratio > 0.2 ? 'worry' : 'angry';
        if (g.patience <= 0) {
          g.state = 'out'; g.mood = 'angry'; g.line = OT.say('cust.angry'); g.lineT = 2;
          N.angry++; N.repDelta += cfg().REP.angry;
          OT.sfx.angry();
          floater(i, '💢', 'angry');
          refreshHud();
          if (N.selected === i) N.selected = -1;
        }
      } else if (g.state === 'eat') {
        if (g.t > 2.2) { g.state = 'out'; g.t = 0; }
      } else if (g.state === 'out') {
        var dir = i < 1 ? -1 : 1;
        g.x += dir * dt * 70;
        if (g.x < -30 || g.x > W + 30) { N.guests[i] = null; if (N.selected === i) N.selected = -1; }
      }
    });
    autoSelect();
    updateBubbles();

    // 閉店
    if (N.open && N.time >= D.nightSeconds) {
      N.open = false;
      N.guests.forEach(function (g) { if (g && (g.state === 'wait' || g.state === 'in')) { g.state = 'out'; g.line = ''; } });
      OT.sfx.clack(3);
      OT.ui.toast(OT.t('night.closed'), 'big');
    }
    if (!N.open && !N.closed && N.folding < 0 && N.guests.every(function (g) { return !g || g.state === 'out'; }) && N.time >= D.nightSeconds + 1.8) {
      N.closed = true;
      finish();
    }
  }

  function updateBubbles() {
    N.guests.forEach(function (g, i) {
      var b = N.bubbles[i];
      if (!g || g.state === 'in' || (g.state === 'out' && g.lineT <= 0)) { b.className = 'bubble'; b.innerHTML = ''; return; }
      var html = '';
      if (g.lineT > 0 && g.line) html += '<div class="b-line">' + esc(g.line) + '</div>';
      else if (g.state === 'eat' && g.comment) html += '<div class="b-line cmt">' + esc(g.comment) + '</div>';
      if (g.state === 'wait') {
        var order = g.order ? OT.tacoName(g.order, g.variant) : OT.t('night.omakase');
        html += '<div class="b-type">' + esc(OT.t('cust.' + g.typeId)) + '</div>';
        html += '<div class="b-order">' + esc(order) + '</div>';
        var r = Math.max(0, g.patience / g.patienceMax);
        html += '<div class="b-bar"><i style="width:' + (r * 100).toFixed(0) + '%;background:' + (r > 0.5 ? '#46b03a' : r > 0.2 ? '#f5b860' : '#f24a2a') + '"></i></div>';
      }
      if (b.innerHTML !== html) b.innerHTML = html;
      b.className = 'bubble on' + (N.selected === i && g.state === 'wait' ? ' sel' : '');
    });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function draw() {
    var ctx = N.canvas.getContext('2d');
    OT.art.drawStall(ctx, W, H, N.time);
    N.guests.forEach(function (g, i) {
      if (!g) return;
      OT.art.drawGuest(ctx, g.typeId, Math.round(g.x), GUEST_Y, g.mood, N.time, N.selected === i && g.state === 'wait');
    });
    OT.art.drawCounter(ctx, W, H);
  }

  // ---------------------------------------------------------------
  // 閉店 → 結果
  // ---------------------------------------------------------------
  function finish() {
    var s = st();
    var best = null, bestN = 0;
    Object.keys(N.sold).forEach(function (k) {
      if (N.sold[k] > bestN || (N.sold[k] === bestN && N.soldMoney[k] > N.soldMoney[best])) { best = k; bestN = N.sold[k]; }
    });
    var avg = N.served ? N.starsSum / N.served : 0;
    var chapterBefore = OT.state.chapter();
    s.rep = Math.max(0, s.rep + N.repDelta);
    s.rankSeen = Math.max(s.rankSeen, OT.state.rank());
    var chapterAfter = OT.state.chapter();
    s.totals.sales += N.sales; s.totals.served += N.served; s.totals.stars += N.starsSum;
    s.lastResult = {
      day: s.day, sales: N.sales, served: N.served, angry: N.angry,
      avg: avg, satisfaction: N.served + N.angry ? Math.round(N.starsSum / (3 * (N.served + N.angry)) * 100) : 0,
      rep: N.repDelta, best: best === 'omakase' ? null : best, bestIsOmakase: best === 'omakase',
      bestVariant: N.soldVariant[best] || null,
      rankUp: chapterAfter > chapterBefore ? chapterAfter : 0
    };
    s.phase = 'result';
    OT.state.save();
    setTimeout(function () { OT.night.leave(); OT.flow.result(); }, 600);
  }
})(window);
