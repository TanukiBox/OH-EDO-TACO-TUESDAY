/*
 * 多幸寿：夜の営業（客が来る → 注文を聞く（木札）→ 焼き場・盛り付け（kitchen.js）→ 包んで出す → 評価）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var SZ = (global.OT_ART && global.OT_ART.stallSize) || [256, 144];
  var W = SZ[0], H = SZ[1];             // 屋台の絵の大きさ（ドット）
  var SEAT_X = [0.227, 0.5, 0.773].map(function (f) { return Math.round(W * f); });   // 席の位置
  var GUEST_Y = Math.round(H * 0.903); // 客の足もと（カウンターのうしろ）
  var FG_Y = Math.round(H * 0.125);    // 手前のカウンターを下げる量（客の上半身が見えるように）
  var PW = ((global.OT_ART && global.OT_ART.frame) || [64, 80])[0];   // 人物の絵の幅

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
      var w = rank < 0 ? 1 : 1 + cfg().LIKES_BOOST * (1 - rank / type.likes.length);
      if (N && N.ordered && N.ordered[id]) w *= Math.pow(cfg().ORDER_VARIETY, N.ordered[id]);   // 今夜もう頼まれた料理は頼まれにくく
      if (id === 'chazuke' && late) w *= 4;              // 夜ふけは〆の茶漬け
      var fest = N && N.fest;
      if (fest && fest.order && fest.order[id]) w *= fest.order[id];   // 行事の日に頼まれやすいタコス
      return canMake(id) ? w : w * 0.12;                  // 作れないものは頼まれにくい
    });
    if (N) { N.ordered = N.ordered || {}; N.ordered[order] = (N.ordered[order] || 0) + 1; }
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
      x: seat < 1 ? -PW * 0.56 : W + PW * 0.56, state: 'in', t: 0,
      patience: type.patience * pm, patienceMax: type.patience * pm, waitMax: type.patience * pm, waited: 0,
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

  /** 常連の漁師・浜蔵：魚のタコスが好き。満足させると、朝の競りで耳打ちしてくれる */
  function makeFisher(seat) {
    var F = cfg().FISHER;
    var g = baseGuest(seat, F.type);
    g.fisher = true;
    g.name = OT.STORY[OT.i18n.lang].who.hamazo;
    g.line = OT.t('fisher.hello');
    var ok = F.likes.filter(function (id) { return menu().indexOf(id) >= 0; });
    var can = ok.filter(function (id) { return canMake(id); });
    var list = can.length ? can : ok;
    if (list.length) { g.order = list[Math.floor(Math.random() * list.length)]; g.variant = null; }
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
      if (OT.kitchen._peek()) OT.kitchen.go(OT.kitchen._peek().station);
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
    g.patience = g.patienceMax = g.waitMax = V.time;
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
  // 画面：上に木札の紐、まん中に持ち場（注文＝屋台 / 焼き場 / 盛り付け）、下に持ち場のボタン
  //   料理の中身は kitchen.js。ここは客の出入りと、評価・売上・閉店
  // ---------------------------------------------------------------
  function maxGuests() { return cfg().KITCHEN.maxGuests[Math.min(5, OT.state.chapter() - 1)]; }

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
        guests: [null, null, null],
        sales: 0, tips: 0, served: 0, angry: 0, starsSum: 0, repDelta: 0, streak: 0, sold: {}, soldMoney: {}, soldVariant: {},
        mateoAnim: 'wait', mateoT: 0
      };

      var timer = OT.el('span', { class: 'hud-timer' });
      N.hud = OT.ui.hud(timer);
      N.timerEl = timer;
      root.appendChild(N.hud);
      N.root = root;

      // 屋台（客）：注文の持ち場
      var stage = OT.el('div', { class: 'stall' });
      N.canvas = OT.ui.pixelCanvas(W, H, 'stall-canvas');
      stage.appendChild(N.canvas);
      N.bubbles = []; N.hits = [];
      for (var s = 0; s < 3; s++) {
        (function (seat) {
          var b = OT.el('div', { class: 'bubble', style: 'left:' + (SEAT_X[seat] / W * 100) + '%' });
          var hit = OT.el('div', { class: 'seat-hit', style: 'left:' + ((SEAT_X[seat] - W * 0.117) / W * 100) + '%;width:' + (23.4) + '%',
            onpointerdown: function (e) { e.preventDefault(); tapSeat(seat); } });
          stage.appendChild(hit);
          stage.appendChild(b);
          N.bubbles.push(b); N.hits.push(hit);
        })(s);
      }
      N.fx = OT.el('div', { class: 'fx' });
      stage.appendChild(N.fx);

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
        // 常連の漁師がふらりと来る
        var FI = cfg().FISHER;
        if (FI && st().day >= FI.fromDay && Math.random() < FI.chance) N.queue.push(function (seat) { return makeFisher(seat); });
        // 常連がふらりと来る
        var types = unlockedTypes();
        if (!forced && Math.random() < cfg().REGULARS.chance) {
          var rt = types[Math.floor(Math.random() * types.length)];
          N.queue.push(function (seat) { return makeRegular(seat, rt); });
        }
      }

      OT.kitchen.build(N, root, stage);

      // はじめての夜：時間を止めて、ひとりのお客さん（与吉の紅白タコス）だけで練習する
      if (OT.kitchen.tutorialActive()) {
        N.frozen = true;
        st().flags.tutStep = 0;
        ['tortilla', 'tai', 'bainiku', 'daikon'].forEach(function (id) { if (OT.state.stockOf(id) <= 0) OT.state.addStock(id, 1); });
        N.queue = [function (seat) { var g = makeRegular(seat, 'chonin'); g.order = 'kohaku'; g.variant = null; return g; }];
        N.nextGuest = 0.8;
      }

      OT.sfx.clack(2);
      if (!N.tribute && OT.sprites.has('people_mateo_happi')) {
        // 開店カットイン（暖簾がはためく → マテオが勝負服に着替える）
        N.pause = true;
        OT.fx.cutin(function () { if (N) { N.pause = false; OT.kitchen.tutorialCheck(); } });
      } else OT.ui.toast(N.tribute ? OT.t('night.tribute') : OT.t('night.open'), 'big');
      if (N.festival) setTimeout(function () { if (N) OT.ui.toast(OT.t('fest.' + N.festival) + '　' + OT.t('fest.' + N.festival + '.desc'), 'tip long'); }, 1200);

      N.last = performance.now();
      N.raf = requestAnimationFrame(loop);
    },
    leave: function () { if (N && N.raf) cancelAnimationFrame(N.raf); N = null; OT.kitchen.leave(); },
    pickVip: function () { return pickVip(); },
    /** kitchen.js が、包んだタコスを客に出すときに呼ぶ */
    /**
     * kitchen.js が、包んだタコスを客に出すときに呼ぶ。
     * 評価してから「出す場面」（serve.js）を見せる。場面のあいだ夜の時間は止まる。
     */
    serve: function (g, served, plating, img, done) {
      if (!N || !g) return;
      var res = judge(g, served, plating);
      N.pause = true;
      if (OT.tut) OT.tut.clear();
      var name = OT.tacoName(res.recipe, res.variant);
      OT.serve.play({
        root: N.root, guest: g, res: res, img: img, name: name,
        stage: { W: W, H: H, seatX: SEAT_X[g.seat], footY: GUEST_Y, fgY: FG_Y, festival: N.festival },
        onTip: function (n) { st().money += n; N.tips += n; refreshHud(); }
      }, function () {
        if (!N) return;
        N.pause = false;
        N.last = performance.now();
        g.t = Math.max(g.t, 1.6);   // 場面の中で食べ終わったので、まもなく帰る
        if (done) done();
      });
    },
    /** 自動テスト用：今夜のようす（ゲームでは使わない） */
    _peek: function () { return N; }
  };

  /** 客をタップ：注文を聞いて、木札をつくる */
  function tapSeat(seat) {
    var g = N.guests[seat];
    if (!g) return;
    if (g.state === 'order') {
      g.state = 'wait'; g.t = 0;
      g.patience = g.patienceMax = g.waitMax;
      g.waited = 0;
      g.line = g.vip ? OT.t('vip.' + g.vip + '.odai') : OT.t('k.ordered.' + (g.order ? 'menu' : 'omakase'), { name: g.order ? OT.tacoName(g.order, g.variant) : '' });
      g.lineT = 2.2;
      OT.kitchen.takeOrder(g);
      OT.kitchen.tutorialCheck();
    } else if (g.state === 'wait') {
      OT.sfx.tap();   // 待っている客：その木札を選んで、盛り付けへ
      var K = OT.kitchen._peek();
      if (K && g.ticket && !OT.kitchen.tutorialActive()) { K.selected = g.ticket; OT.kitchen.go('plate'); }
    }
  }

  /** 評価して、客のようす・売上・評判に反映する */
  function judge(g, served, plating) {
    var res = OT.evaluate(g, served, g.waited, OT.state.chapter(), plating);
    // 行事の日の値段
    if (N.fest && N.fest.priceMul && res.recipe && N.fest.priceMul[res.recipe]) res.pay = Math.round(res.pay * N.fest.priceMul[res.recipe]);
    // VIP：お題のタコスを、点数 minScore 以上で出せば勝ち
    if (g.vip) {
      var V = cfg().VIPS[g.vip];
      var ok = res.recipe === V.recipe && res.score >= V.minScore && (!V.minItems || served.items.length >= V.minItems);
      N.vipResult = ok ? 'win' : 'lose';
      N.vipScore = res.score;
      res.rep += ok ? cfg().REP.vipWin : cfg().REP.vipLose;
      if (ok) res.stars = 5;
    }
    // 星4以上が続くと、評判がさらに上がる
    if (res.stars >= 4) { N.streak++; if (N.streak >= 2) res.rep += cfg().REP.streakBonus; } else N.streak = 0;
    // 漁師：満足させると、朝の競りで耳打ちしてくれるようになる
    if (g.fisher && res.stars >= cfg().FISHER.trustStars) {
      var W = cfg().AUCTION.whisper;
      st().fisherTrust = Math.min(W.maxTrust, (st().fisherTrust || 0) + 1);
      setTimeout(function () { if (N) OT.ui.toast(OT.t('fisher.trust'), 'tip long'); }, 900);
    }
    // 常連：星4以上を出すと、なじみが深まる
    if (g.regular && res.stars >= 4) {
      st().regulars[g.regular] = (st().regulars[g.regular] || 0) + 1;
      if (st().regulars[g.regular] >= cfg().REGULARS.eventAfter) N.regularsServed.push(g.regular);
    }
    // 台詞は3段階（星1〜2 / 星3 / 星4〜5）
    var say = res.stars >= 4 ? 3 : res.stars === 3 ? 2 : 1;
    g.state = 'eat'; g.t = 0; g.result = res;
    g.mood = res.stars >= 3 ? 'happy' : 'worry';
    if (res.forbidden && g.type.forbid) g.line = OT.say('cust.' + g.typeId + '.forbid');
    else if (g.vip) g.line = OT.t('vip.' + (N.vipResult === 'win' ? 'win' : 'lose'));
    else if (g.traveler) g.line = OT.say('trav.' + say);
    else if (g.fisher) g.line = OT.t('fisher.' + say);
    else if (g.regular) g.line = OT.say('reg.' + g.regular + '.' + say);
    else g.line = OT.say('cust.' + g.typeId + '.' + say);
    g.lineT = 2.4;
    // ときどき、味のひとこと感想（いちばん好みから外れた味について）
    if (res.hint && res.stars < 4 && !res.forbidden && Math.random() < cfg().COMMENT_CHANCE) {
      g.comment = OT.say('cmt.' + (res.hint.more ? 'more' : 'less') + '.' + res.hint.k);
    } else if (res.stars === 5 && Math.random() < cfg().COMMENT_CHANCE * 0.5) {
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
    if (before && OT.masteryLevel(res.recipe) > before) {
      setTimeout(function () { if (N) OT.ui.toast(OT.t('night.levelUp', { name: OT.tacoName(res.recipe), lv: OT.masteryLevel(res.recipe) }), 'lv'); }, 500);
    }
    if (res.stars === 5) mateoDo('pose', 1.4);
    refreshHud();
    return res;
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
    if (N) draw();
    if (N) N.raf = requestAnimationFrame(loop);
  }

  function leaveAngry(g, i) {
    g.state = 'out'; g.t = 0; g.mood = 'angry'; g.line = OT.say('cust.angry'); g.lineT = 2;
    N.angry++; N.repDelta += cfg().REP.angry; N.streak = 0;
    if (g.vip) N.vipResult = 'lose';
    OT.kitchen.dropTicketFor(g);
    OT.sfx.angry();
    floater(i, '💢', 'angry');
    refreshHud();
  }

  function update(dt) {
    var D = cfg().DAY;
    if (N.pause || OT.dialogOpen()) return;
    OT.kitchen.update(dt);            // 焼き場は、どの持ち場にいても進む（案内中も）
    if (!N) return;
    var frozen = !!N.frozen;          // はじめての夜の案内中は、時間が止まる
    if (!frozen) N.time += dt;
    if (N.mateoT > 0) N.mateoT -= dt;
    if (N.tribute && N.vipResult && N.open) N.time = Math.max(N.time, D.nightSeconds);   // 献上は1皿で終わり
    var left = Math.max(0, Math.ceil(D.nightSeconds - N.time));
    N.timerEl.textContent = (frozen ? '⏸ ' : '⏳ ') + OT.t('night.close', { n: left });

    // 新しい客（同時に来る数は章で決まる）
    if (N.open) {
      N.nextGuest -= dt;
      var present = N.guests.filter(function (g) { return g && g.state !== 'out'; }).length;
      var can = frozen ? (present === 0 && N.queue.length > 0 && !N.tutGuest) : present < maxGuests();
      if (N.nextGuest <= 0 && can && N.time < D.nightSeconds - D.lastOrderBefore && (!N.tribute || N.queue.length)) {
        var free = [];
        N.guests.forEach(function (g, i) { if (!g) free.push(i); });
        if (free.length) {
          var seat = frozen ? (free.indexOf(1) >= 0 ? 1 : free[0]) : free[Math.floor(Math.random() * free.length)];
          N.guests[seat] = makeGuest(seat);
          if (frozen) N.tutGuest = true;
          OT.sfx.arrive();
          mateoDo('greet', 1.2);
          var busy = Math.pow(D.busier, Math.min(5, OT.state.chapter()) - 1) * ((N.fest && N.fest.busier) || 1);
          N.nextGuest = (D.arrivalMin + Math.random() * (D.arrivalMax - D.arrivalMin)) * busy;
        } else N.nextGuest = 1.5;
      }
    }

    // 客それぞれ：入る → 注文（タップで聞く）→ 待つ → 食べる → 帰る
    N.guests.forEach(function (g, i) {
      if (!g) return;
      g.t += dt;
      if (g.lineT > 0) g.lineT -= dt;
      var target = SEAT_X[i];
      if (g.state === 'in') {
        g.x += (target - g.x) * Math.min(1, dt * 6);
        if (Math.abs(target - g.x) < 0.8) {
          g.x = target; g.state = 'order'; g.t = 0;
          g.patience = g.patienceMax = cfg().KITCHEN.orderPatience * ((N.fest && N.fest.patienceMul) || 1);
          OT.kitchen.tutorialCheck();
        }
      } else if (g.state === 'order' || g.state === 'wait') {
        if (!frozen) g.patience -= dt;
        if (g.state === 'wait' && !frozen) g.waited += dt;
        var ratio = g.patience / g.patienceMax;
        g.mood = ratio > 0.5 ? 'ok' : ratio > 0.2 ? 'worry' : 'angry';
        if (g.patience <= 0) leaveAngry(g, i);
      } else if (g.state === 'eat') {
        if (g.t > 2.2) { g.state = 'out'; g.t = 0; }
      } else if (g.state === 'out') {
        var dir = i < 1 ? -1 : 1;
        g.x += dir * dt * 70 * W / 256;
        if (g.x < -PW * 0.62 || g.x > W + PW * 0.62) N.guests[i] = null;
      }
    });
    updateBubbles();

    // 閉店
    if (N.open && N.time >= D.nightSeconds) {
      N.open = false;
      N.guests.forEach(function (g) {
        if (g && (g.state === 'wait' || g.state === 'in' || g.state === 'order')) { g.state = 'out'; g.line = ''; OT.kitchen.dropTicketFor(g); }
      });
      OT.sfx.clack(3);
      OT.ui.toast(OT.t('night.closed'), 'big');
    }
    if (!N.open && !N.closed && !OT.kitchen.isBusy() && N.guests.every(function (g) { return !g || g.state === 'out'; }) && N.time >= D.nightSeconds + 1.8) {
      N.closed = true;
      finish();
    }
  }

  function updateBubbles() {
    N.guests.forEach(function (g, i) {
      var b = N.bubbles[i];
      N.hits[i].className = 'seat-hit' + (g && g.state === 'order' ? ' call' : '');
      if (!g || g.state === 'in' || (g.state === 'out' && g.lineT <= 0)) { b.className = 'bubble'; b.innerHTML = ''; return; }
      var html = '';
      var label = g.name ? g.name : OT.t('cust.' + g.typeId);
      var typeCls = g.vip ? ' vip' : g.regular ? ' reg' : g.traveler ? ' trav' : '';
      if (g.state === 'order') {
        html += '<div class="b-type' + typeCls + '">' + esc(label) + '</div>';
        html += '<div class="b-call">' + esc(OT.t('k.callOrder')) + '</div>';
      } else if (g.lineT > 0 && g.line) html += '<div class="b-line">' + esc(g.line) + '</div>';
      else if (g.state === 'eat' && g.comment) html += '<div class="b-line cmt">' + esc(g.comment) + '</div>';
      else if (g.state === 'wait') html += '<div class="b-type' + typeCls + '">' + esc(label) + '</div>';
      if (g.state === 'wait' || g.state === 'order') {
        var r = Math.max(0, g.patience / g.patienceMax);
        html += '<div class="b-bar"><i style="width:' + (r * 100).toFixed(0) + '%;background:' + (r > 0.5 ? '#46b03a' : r > 0.2 ? '#f5b860' : '#f24a2a') + '"></i></div>';
      }
      if (b.innerHTML !== html) b.innerHTML = html;
      b.className = 'bubble on' + (g.state === 'order' ? ' call' : '');
    });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /** 客の動き：歩く・待つ・困る・食べる・喜ぶ・怒る */
  function guestAnim(g) {
    if (g.state === 'in') return 'walk';
    if (g.state === 'out') return g.mood === 'angry' && g.t < 0.9 ? 'angry' : 'walk';
    if (g.state === 'eat') return g.t < 1.1 ? 'eat' : (g.result && g.result.stars >= 3 ? 'happy' : 'worry');
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
      if (key) {
        if (g.state === 'order' && Math.floor(g.t * 3) % 2) { ctx.fillStyle = 'rgba(255,230,176,0.16)'; ctx.fillRect(Math.round(g.x - W * 0.117), Math.round(H * 0.28), Math.round(W * 0.234), Math.round(H * 0.625)); }
        var anim = guestAnim(g);
        var left = (g.state === 'in' && g.x > SEAT_X[i]) || (g.state === 'out' && i >= 1);
        OT.sprites.drawPerson(ctx, key, anim, g.t + i * 0.37, g.x, GUEST_Y, left && anim === 'walk', anim === 'walk' ? 8 : 3);
      } else {
        OT.art.drawGuest(ctx, g.skin || g.regular || g.typeId, Math.round(g.x), GUEST_Y - 18, g.mood, N.time, g.state === 'order', g.typeId);
      }
    });
    var fg = OT.sprites.stallFg();
    if (fg) ctx.drawImage(fg, 0, FG_Y); else OT.art.drawCounter(ctx, W, H);   // カウンターは少し下げて、客の上半身が見えるように
    OT.kitchen.draw();
  }

  // 厨房のマテオ：調理中・いらっしゃい・決めポーズ（盛り付けの持ち場に出る）
  function mateoDo(anim, sec) { if (N) { N.mateoAnim = anim; N.mateoT = sec; } }

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
    s.totals.sales += N.sales + N.tips; s.totals.served += N.served; s.totals.stars += N.starsSum;
    s.lastResult = {
      day: s.day, sales: N.sales, tips: N.tips, served: N.served, angry: N.angry,
      avg: avg, satisfaction: N.served + N.angry ? Math.round(N.starsSum / (5 * (N.served + N.angry)) * 100) : 0,
      rep: N.repDelta, best: best === 'omakase' ? null : best, bestIsOmakase: best === 'omakase',
      bestVariant: N.soldVariant[best] || null,
      rankUp: chapterAfter > chapterBefore ? chapterAfter : 0,
      vip: N.vip, vipResult: N.vip ? (N.vipResult || 'lose') : null,
      regulars: N.regularsServed, tribute: N.tribute, festival: N.festival
    };
    if (N.vip && N.vipResult === 'win') s.flags[cfg().VIPS[N.vip].win] = 1;
    s.flags.tutNight = 1;
    s.phase = 'result';
    OT.state.save();
    setTimeout(function () { OT.night.leave(); OT.flow.result(); }, 600);
  }
})(window);
