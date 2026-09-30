/*
 * 多幸寿：夜の営業（客が来る → 注文 → 料理 → 包んで出す → 評価）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var W = 256, H = 144;               // 屋台の絵の大きさ（ドット）
  var SEAT_X = [58, 128, 198];         // 席の位置
  var GUEST_Y = 130;                   // 客の足もと（カウンターのうしろ）
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
      if (r.needFlag && !st().flags[r.needFlag]) return false;              // 物語で解禁されるまで出ない
      if (r.festival && (!N || N.festival !== r.festival)) return false;    // 行事の日だけ
      if (r.traveler) return false;                                          // 旅の客だけが頼む
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
      var fest = N && N.fest;
      if (fest && fest.order && fest.order[id]) w *= fest.order[id];   // 行事の日に頼まれやすいタコス
      return canMake(id) ? w : w * 0.12;                  // 作れないものは頼まれにくい
    });
    var r = cfg().TACOS[order], variant = null;
    if (r.variants) {
      variant = makeableVariant(order);
      if (!variant) { var keys = Object.keys(r.variants); variant = keys[Math.floor(Math.random() * keys.length)]; }
    }
    return { order: order, variant: variant };
  }

  function baseGuest(seat, typeId) {
    var type = cfg().CUSTOMERS[typeId];
    var j = cfg().CUSTOMER_JITTER;
    var want = type.want.map(function (v) { return Math.max(0, v + Math.round((Math.random() * 2 - 1) * j)); });
    var pm = (N.fest && N.fest.patienceMul) || 1;
    return {
      typeId: typeId, type: type, want: want, order: null, variant: null, seat: seat,
      x: seat < 1 ? -36 : W + 36, state: 'in', t: 0,
      patience: type.patience * pm, patienceMax: type.patience * pm, waited: 0,
      line: OT.say('cust.' + typeId + '.hello'), lineT: 2.5, mood: 'ok', variantSeed: Math.floor(Math.random() * 1000),
      smallBonus: N.fest && N.fest.smallBonus
    };
  }

  function makeGuest(seat) {
    // 物語の場面や VIP で決まっている客が先
    if (N.queue.length) return N.queue.shift()(seat);
    var ch = OT.state.chapter();
    // 旅の客（第4章から）
    var T = cfg().TRAVELERS;
    if (ch >= T.chapter && Math.random() < T.chance) return makeTraveler(seat);
    var types = unlockedTypes();
    var typeId = pickWeighted(types, function (id) { return cfg().CUSTOMER_MIX[id] || 1; });
    var g = baseGuest(seat, typeId);
    var o = chooseOrder(g.type);
    g.order = o.order; g.variant = o.variant;
    return g;
  }

  /** 常連（名前のある客）。好物を頼みやすい */
  function makeRegular(seat, typeId) {
    var R = cfg().REGULARS.list[typeId];
    var g = baseGuest(seat, typeId);
    g.regular = R.id;
    g.name = OT.STORY[OT.i18n.lang].who[R.id];
    g.fav = R.fav;
    g.line = OT.say('reg.' + R.id + '.hello');
    var favOk = menu().indexOf(R.fav) >= 0;
    if (favOk && Math.random() < 0.6) { g.order = R.fav; }
    else { var o = chooseOrder(g.type); g.order = o.order; g.variant = o.variant; }
    return g;
  }

  /** 旅の客：ふるさとの名物を持ってきて、それでタコスを頼む */
  function makeTraveler(seat) {
    var T = cfg().TRAVELERS.list, keys = Object.keys(T);
    var from = keys[Math.floor(Math.random() * keys.length)], info = T[from];
    var g = baseGuest(seat, 'chonin');
    g.traveler = from;
    g.skin = 'tabibito';
    g.type = Object.assign({}, g.type, { pay: info.pay, omakase: 0, fastBonus: 0 });
    g.order = info.recipe;
    g.line = OT.say('trav.' + from + '.hello');
    g.name = OT.t('trav.' + from);
    Object.keys(info.bring).forEach(function (id) { OT.state.addStock(id, info.bring[id]); });
    setTimeout(function () {
      if (!N) return;
      OT.ui.toast(OT.t('trav.brought', { name: g.name, items: Object.keys(info.bring).map(OT.ingName).join('・') }), 'tip');
      renderBins();
      if (!OT.story.seen('traveler_first')) { N.pause = true; OT.story.check('traveler', null, function () { if (N) N.pause = false; }); }
    }, 900);
    return g;
  }

  /** VIP（料理対決・特別な来店） */
  function makeVip(seat, vipId) {
    var V = cfg().VIPS[vipId];
    var g = baseGuest(seat, V.type);
    g.vip = vipId;
    g.vipGuest = V.guest;
    g.name = OT.STORY[OT.i18n.lang].who[V.guest];
    g.skin = V.guest;
    g.want = cfg().VIP_WANT[V.guest].concat();
    g.type = Object.assign({}, g.type, { omakase: 0, fastBonus: 0, looksBonus: V.guest === 'raizo' ? 0.15 : 0, forbid: null, plainPenalty: 0, rareBonus: 0, bigBonus: 0 });
    g.order = V.recipe;
    g.patience = g.patienceMax = V.time;
    g.line = OT.t('vip.' + vipId + '.odai');
    g.lineT = 5;
    return g;
  }

  /** 今夜来る VIP（章・日数・目印で決まる。勝つまで2日おきに来る） */
  function pickVip() {
    var s = st(), ch = OT.state.chapter(), V = cfg().VIPS;
    var ids = Object.keys(V).filter(function (id) {
      var v = V[id];
      if (id === 'tribute') return false;
      if (s.flags[v.win]) return false;
      if (ch < v.chapter) return false;
      if (ch === v.chapter && OT.daysInChapter(ch) < v.chapterDay) return false;
      if (v.needFlag && !s.flags[v.needFlag]) return false;
      return s.day - (s.vipLast || 0) >= 2;
    });
    return ids.length ? ids[0] : null;
  }

  /** 今日の年中行事（第4章から） */
  function todayFestival() {
    var F = cfg().FESTIVALS;
    if (OT.state.chapter() < F.chapter) return null;
    var dayIn = ((st().day - 1) % cfg().SEASON_DAYS) + 1, season = OT.state.season();
    var hit = null;
    Object.keys(F.list).forEach(function (id) { var f = F.list[id]; if (f.season === season && f.day === dayIn) hit = id; });
    return hit;
  }
  OT.todayFestival = function () { return OT.state.get() ? todayFestival() : null; };

  // ---------------------------------------------------------------
  // 画面
  // ---------------------------------------------------------------
  OT.night = {
    enter: function (opts) {
      opts = opts || {};
      var root = OT.ui.screen('night');
      root.innerHTML = '';
      var festival = opts.tribute ? null : todayFestival();
      N = {
        tribute: !!opts.tribute, festival: festival, fest: festival ? cfg().FESTIVALS.list[festival] : null,
        queue: [], vip: null, vipResult: null, regularsServed: [],
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
      if (OT.sprites.has('people_mateo_happi')) {
        N.mateoCanvas = OT.ui.pixelCanvas(64, 80, 'mateo-canvas');
        boardWrap.appendChild(N.mateoCanvas);
      }
      N.mateoAnim = 'wait'; N.mateoT = 0;
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

      // 今夜の特別な客
      var forced = OT.story.nightRegular();
      if (forced) N.queue.push(function (seat) { return makeRegular(seat, forced); });
      if (N.tribute) {
        N.vip = 'tribute';
        N.queue = [function (seat) { return makeVip(seat, 'tribute'); }];
        N.nextGuest = 1.2;
      } else {
        var vip = opts.vip;
        if (vip) {
          N.vip = vip;
          st().vipLast = st().day;
          N.queue.unshift(function (seat) { return makeVip(seat, vip); });
        }
        // 常連がふらりと来る
        var types = unlockedTypes();
        if (!forced && Math.random() < cfg().REGULARS.chance) {
          var rt = types[Math.floor(Math.random() * types.length)];
          N.queue.push(function (seat) { return makeRegular(seat, rt); });
        }
      }
      renderBins();
      drawBoard();
      OT.sfx.clack(2);
      if (!N.tribute && OT.sprites.has('people_mateo_happi')) {
        // 開店カットイン（暖簾がはためく → マテオが勝負服に着替える）
        N.pause = true;
        OT.fx.cutin(function () { if (N) N.pause = false; });
      } else OT.ui.toast(N.tribute ? OT.t('night.tribute') : OT.t('night.open'), 'big');
      if (N.festival) setTimeout(function () { if (N) OT.ui.toast(OT.t('fest.' + N.festival) + '　' + OT.t('fest.' + N.festival + '.desc'), 'tip long'); }, 1200);
      if (st().day === 1 && st().flags.tutDone) setTimeout(function () { if (N) OT.ui.toast(OT.t('pon.night1'), 'tip long'); }, 900);

      N.last = performance.now();
      N.raf = requestAnimationFrame(loop);
    },
    leave: function () { if (N && N.raf) cancelAnimationFrame(N.raf); N = null; },
    pickVip: function () { return pickVip(); },
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
      var g = cfg().INGREDIENTS[id];
      if (g.virtual) return g.cat === N.tab && OT.state.chapter() >= 3;   // 3枚重ねの皮（トウモロコシの皮3枚）
      return g.cat === N.tab && st().seen[id];
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
      var idd = OT.identifyTaco(N.dish, OT.state.chapter());
      var rec = idd && cfg().TACOS[idd.id];
      if (rec && !rec.light && frame === 0) OT.sprites.drawSudachi(ctx);   // さっぱりしたタコス以外は、すだちを添える
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
    if (OT.tut) OT.tut.done('n4');
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
    // 行事の日の値段
    if (N.fest && N.fest.priceMul && res.recipe && N.fest.priceMul[res.recipe]) res.pay = Math.round(res.pay * N.fest.priceMul[res.recipe]);
    // VIP：お題のタコスを、点数 minScore 以上で出せば勝ち
    if (g.vip) {
      var V = cfg().VIPS[g.vip];
      var ok = res.recipe === V.recipe && res.score >= V.minScore && (!V.minItems || dish.items.length >= V.minItems);
      N.vipResult = ok ? 'win' : 'lose';
      N.vipScore = res.score;
      res.rep += ok ? cfg().REP.vipWin : cfg().REP.vipLose;
      if (ok) res.stars = 3;
    }
    // 常連：星3を出すと、なじみが深まる
    if (g.regular && res.stars === 3) {
      st().regulars[g.regular] = (st().regulars[g.regular] || 0) + 1;
      if (st().regulars[g.regular] >= cfg().REGULARS.eventAfter) N.regularsServed.push(g.regular);
    }
    g.state = 'eat'; g.t = 0; g.result = res;
    g.mood = res.stars >= 2 ? 'happy' : 'worry';
    if (res.forbidden && g.type.forbid) g.line = OT.say('cust.' + g.typeId + '.forbid');
    else if (g.vip) g.line = OT.t('vip.' + (N.vipResult === 'win' ? 'win' : 'lose'));
    else if (g.traveler) g.line = OT.say('trav.' + res.stars);
    else if (g.regular) g.line = OT.say('reg.' + g.regular + '.' + res.stars);
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
    if (res.stars === 3) { mateoDo('pose', 1.4); OT.fx.closeup(OT.sprites.personKey(g), g.line); }
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
    if (N.pause || OT.dialogOpen()) return;
    N.time += dt;
    if (N.mateoT > 0) N.mateoT -= dt;
    if (N.tribute && N.vipResult && N.open) N.time = Math.max(N.time, D.nightSeconds);   // 献上は1皿で終わり
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
      if (N.nextGuest <= 0 && N.time < D.nightSeconds - D.lastOrderBefore && (!N.tribute || N.queue.length)) {
        var free = [];
        N.guests.forEach(function (g, i) { if (!g) free.push(i); });
        if (free.length) {
          var seat = free[Math.floor(Math.random() * free.length)];
          N.guests[seat] = makeGuest(seat);
          OT.sfx.arrive();
          mateoDo('greet', 1.2);
          var busy = Math.pow(D.busier, Math.min(5, OT.state.chapter()) - 1) * ((N.fest && N.fest.busier) || 1);
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
          if (g.vip) N.vipResult = 'lose';
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
        if (g.x < -40 || g.x > W + 40) { N.guests[i] = null; if (N.selected === i) N.selected = -1; }
      }
    });
    autoSelect();
    updateBubbles();
    tutorialStep();

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

  /** はじめての1日の案内：注文 → 皮 → 具 → 包む */
  function tutorialStep() {
    if (!OT.tut) return;
    var g = N.guests[N.selected];
    if (!g || g.state !== 'wait') return;
    if (!N.dish.skin) OT.tut.point('n2', '.bin');
    else if (N.dish.items.length < (g.order ? OT.needOf(g.order, g.variant).length : 2)) { OT.tut.done('n2'); OT.tut.point('n3', '.tabs'); }
    else { OT.tut.done('n3'); OT.tut.point('n4', '.actions .btn.primary'); }
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
        if (g.vip) order = OT.t('vip.odaiShort') + '：' + OT.tacoName(g.order);
        var label = g.name ? g.name : OT.t('cust.' + g.typeId);
        html += '<div class="b-type' + (g.vip ? ' vip' : g.regular ? ' reg' : g.traveler ? ' trav' : '') + '">' + esc(label) + '</div>';
        html += '<div class="b-order">' + esc(order) + '</div>';
        var r = Math.max(0, g.patience / g.patienceMax);
        html += '<div class="b-bar"><i style="width:' + (r * 100).toFixed(0) + '%;background:' + (r > 0.5 ? '#46b03a' : r > 0.2 ? '#f5b860' : '#f24a2a') + '"></i></div>';
      }
      if (b.innerHTML !== html) b.innerHTML = html;
      b.className = 'bubble on' + (N.selected === i && g.state === 'wait' ? ' sel' : '');
    });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /** 客の動き：歩く・待つ・困る・食べる・喜ぶ・怒る */
  function guestAnim(g) {
    if (g.state === 'in') return 'walk';
    if (g.state === 'out') return g.mood === 'angry' && g.t < 0.9 ? 'angry' : 'walk';
    if (g.state === 'eat') return g.t < 1.1 ? 'eat' : (g.result && g.result.stars >= 2 ? 'happy' : 'worry');
    if (g.mood === 'angry') return g.patience / g.patienceMax < 0.1 ? 'angry' : 'worry';
    return g.mood === 'worry' ? 'worry' : 'wait';
  }

  function draw() {
    var ctx = N.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var bg = OT.sprites.stallBg(N.festival);
    if (bg) ctx.drawImage(bg, 0, 0); else OT.art.drawStall(ctx, W, H, N.time);
    N.guests.forEach(function (g, i) {
      if (!g) return;
      var key = OT.sprites.personKey(g);
      var sel = N.selected === i && g.state === 'wait';
      if (key) {
        if (sel) { ctx.fillStyle = 'rgba(255,230,176,0.18)'; ctx.fillRect(Math.round(g.x) - 30, 40, 60, 90); }
        var anim = guestAnim(g);
        var left = (g.state === 'in' && g.x > SEAT_X[i]) || (g.state === 'out' && i >= 1);
        OT.sprites.drawPerson(ctx, key, anim, g.t + i * 0.37, g.x, GUEST_Y, left && anim === 'walk', anim === 'walk' ? 8 : 3);
      } else {
        OT.art.drawGuest(ctx, g.skin || g.regular || g.typeId, Math.round(g.x), GUEST_Y - 18, g.mood, N.time, sel, g.typeId);
      }
    });
    var fg = OT.sprites.stallFg();
    if (fg) ctx.drawImage(fg, 0, 18); else OT.art.drawCounter(ctx, W, H);   // カウンターは少し下げて、客の上半身が見えるように
    drawMateo();
  }

  // 厨房のマテオ：調理中・いらっしゃい・決めポーズ
  function mateoDo(anim, sec) { if (N) { N.mateoAnim = anim; N.mateoT = sec; } }
  function drawMateo() {
    if (!N.mateoCanvas) return;
    var ctx = N.mateoCanvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 80);
    var anim = N.mateoT > 0 ? N.mateoAnim : (N.dish.skin || N.folding >= 0 ? 'cook' : 'wait');
    OT.sprites.drawPerson(ctx, N.tribute ? 'mateo_happi' : 'mateo_happi', anim, N.time, 32, 80, false, anim === 'cook' ? 5 : 3);
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
    s.chStart = s.chStart || { 1: 1 };
    for (var c = chapterBefore + 1; c <= chapterAfter; c++) if (!s.chStart[c]) s.chStart[c] = s.day + 1;
    s.totals.sales += N.sales; s.totals.served += N.served; s.totals.stars += N.starsSum;
    s.lastResult = {
      day: s.day, sales: N.sales, served: N.served, angry: N.angry,
      avg: avg, satisfaction: N.served + N.angry ? Math.round(N.starsSum / (3 * (N.served + N.angry)) * 100) : 0,
      rep: N.repDelta, best: best === 'omakase' ? null : best, bestIsOmakase: best === 'omakase',
      bestVariant: N.soldVariant[best] || null,
      rankUp: chapterAfter > chapterBefore ? chapterAfter : 0,
      vip: N.vip, vipResult: N.vip ? (N.vipResult || 'lose') : null,
      regulars: N.regularsServed, tribute: N.tribute, festival: N.festival
    };
    if (N.vip && N.vipResult === 'win') s.flags[cfg().VIPS[N.vip].win] = 1;
    s.phase = 'result';
    OT.state.save();
    setTimeout(function () { OT.night.leave(); OT.flow.result(); }, 600);
  }
})(window);
