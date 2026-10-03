/*
 * 多幸寿：味と評価
 *   ・タコスの味 = 皮とのせた食材の「辛・酸・旨・香・食感」の合計
 *   ・客の好み（want）にどれだけ近いか → 好みの点（0〜1）
 *   ・注文どおりか → 注文の点（0〜1）
 *   ・待ち時間・焼き加減・盛り付け・好みの4項目で、星1〜5と代金・心付けが決まる。熟練度で値段と星の上限が上がる
 * 数字はすべて config.js（RATING・CUSTOMERS・MASTERY）。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function cfg() { return OT.CFG; }
  function ing(id) { return cfg().INGREDIENTS[id]; }

  /** served = { skin: 'tortilla', items: ['kisu_ten', ...] } の味の合計 */
  function tasteOf(served) {
    var sum = [0, 0, 0, 0, 0];
    [served.skin].concat(served.items).forEach(function (id) {
      var g = ing(id);
      if (!g) return;
      for (var k = 0; k < 5; k++) sum[k] += g.taste[k];
    });
    return sum;
  }

  function tagsOf(served) {
    var tags = {};
    [served.skin].concat(served.items).forEach(function (id) {
      var g = ing(id);
      if (g) g.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    return tags;
  }

  /** 皮が、そのタコスの皮として使えるか（もろこし粉の皮はトルティーヤの代わりになる） */
  function skinOk(recipeSkin, skin) {
    if (recipeSkin === 'any') return !!skin;
    if (skin === recipeSkin) return true;
    var g = ing(skin);
    return !!(g && g.as === recipeSkin);
  }
  OT.skinOk = skinOk;

  /** 部位つきタコスの need（variant を足したもの） */
  function needOf(recipeId, variant) {
    var r = cfg().TACOS[recipeId];
    var need = r.need.concat();
    if (r.variants && variant) need.push(r.variants[variant]);
    return need;
  }
  OT.needOf = needOf;

  /**
   * のせた食材が、どのタコスにあたるか。
   * 戻り値 { id, variant } / 素タコス { id: 'su:食材' } / メニュー外 null（= おまかせ）
   */
  function identify(served, chapter) {
    var best = null, bestN = -1;
    Object.keys(cfg().TACOS).forEach(function (id) {
      var r = cfg().TACOS[id];
      if (chapter && r.chapter > chapter) return;
      if (!skinOk(r.skin, served.skin)) return;
      if (r.onlyWhenOut) return;
      var variant = null;
      if (r.variants) {
        Object.keys(r.variants).forEach(function (v) { if (!variant && served.items.indexOf(r.variants[v]) >= 0) variant = v; });
        if (!variant) return;
      }
      var need = needOf(id, variant);
      var ok = need.every(function (n) { return served.items.indexOf(n) >= 0; });
      if (ok && need.length > bestN) { best = { id: id, variant: variant }; bestN = need.length; }
    });
    if (best && bestN > 0) return best;
    if (best && cfg().TACOS[best.id].skin === 'kagomushi') return best;
    if (!served.items.length && (!chapter || chapter >= cfg().TACOS.sutaco.chapter) && ing(served.skin) && ing(served.skin).cat === 'skin') return { id: 'sutaco' };
    if (served.items.length === 1) return { id: 'su:' + served.items[0] };
    return best;
  }

  /** 熟練度（1〜5） */
  function level(recipeId) {
    var s = OT.state && OT.state.get && OT.state.get();
    var n = s && s.made ? (s.made[recipeId] || 0) : 0;
    var th = cfg().MASTERY.served, lv = 1;
    for (var i = 0; i < th.length; i++) if (n >= th[i]) lv = i + 1;
    return lv;
  }
  OT.masteryLevel = level;

  /** 客の好みの点（0〜1）＋種類ごとの上乗せ */
  function preference(guest, served, waited) {
    var T = tasteOf(served), want = guest.want, t = guest.type, w = t.weight;
    var tol = cfg().RATING.tolerance, s = 0, ws = 0, worst = -1, worstGap = 0;
    for (var k = 0; k < 5; k++) {
      var d = Math.abs(T[k] - want[k]);
      var sk = Math.max(0, 1 - d / Math.max(tol, want[k]));
      s += w[k] * sk; ws += w[k];
      var gap = w[k] * (1 - sk);
      if (gap > worstGap) { worstGap = gap; worst = k; }
    }
    var p = s / ws;
    var bonus = 0, tags = tagsOf(served), forbidden = false;
    if (t.fastBonus && waited <= t.fastSeconds) bonus += t.fastBonus;
    if (t.looksBonus && tags.red && tags.white) bonus += t.looksBonus;
    if (t.bigBonus && served.items.length >= t.bigItems) bonus += t.bigBonus;
    if (guest.smallBonus && served.items.length <= 2) bonus += guest.smallBonus;   // 川開き：小さなタコスが売れる
    if (t.rareBonus && tags.rare) bonus += t.rareBonus;
    if (t.plainPenalty && !tags.rare) bonus -= t.plainPenalty;
    if (t.tagBonus) Object.keys(t.tagBonus).forEach(function (tag) { if (tags[tag]) bonus += t.tagBonus[tag]; });
    if (t.forbid) t.forbid.forEach(function (tag) { if (tags[tag]) forbidden = true; });
    // ひとこと感想の手がかり（いちばん好みから外れた要素と、多すぎ/少なすぎ）
    var hint = worst >= 0 && worstGap > 0.04 ? { k: worst, more: T[worst] < want[worst] } : null;
    return { pref: Math.max(0, Math.min(1, p)), bonus: bonus, taste: T, forbidden: forbidden, hint: hint };
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  /** 木札の順番どおりにのせたか（0〜1）。順番が入れかわったペアの少なさ */
  function sequenceScore(expected, seq) {
    var common = seq.filter(function (id, i) { return expected.indexOf(id) >= 0 && seq.indexOf(id) === i; });
    if (common.length < 2) return 1;
    var ok = 0, all = 0;
    for (var i = 0; i < common.length; i++) {
      for (var j = i + 1; j < common.length; j++) {
        all++;
        if (expected.indexOf(common[i]) < expected.indexOf(common[j])) ok++;
      }
    }
    return all ? ok / all : 1;
  }

  /**
   * 評価する（星5段階）。
   * guest   = { type, typeId, want, order: 'tempura' | null(おまかせ), variant, patienceMax }
   * served  = { skin, items }
   * waited  = 客が来てから出すまでの秒数
   * plating = { seq: のせた順の食材, layers: [{ id, use, amount, even, q }] }（なければ満点あつかい）
   * 4項目：待ち時間・焼き加減・盛り付け（順番・量・均等さ）・好み。重みと星の区切りは config.js の SCORE
   */
  OT.evaluate = function (guest, served, waited, chapter, plating) {
    var R = cfg().RATING, SC = cfg().SCORE;
    var got = identify(served, chapter);
    var p = preference(guest, served, waited);
    var cap = 5, correct = 1, seqScore = 1;
    if (guest.order) {
      var r = cfg().TACOS[guest.order];
      var need = needOf(guest.order, guest.variant);
      var missing = need.filter(function (n) { return served.items.indexOf(n) < 0; }).length;
      if (!skinOk(r.skin, served.skin)) missing += 1;
      var extras = served.items.filter(function (n) { return need.indexOf(n) < 0 && n !== 'kinpaku'; }).length;   // 金箔は飾り
      correct = Math.max(0, 1 - R.missingPenalty * missing - R.extraPenalty * extras);
      if (missing >= 2) cap = R.wrongOrderMaxStars;
      if (plating && plating.seq) seqScore = sequenceScore(need, plating.seq);
    }
    if (p.forbidden) cap = 1;

    // 盛り付け：量と均等さ（撒く・回しかけるものだけ）
    var amounts = [], evens = [], cooks = [];
    ((plating && plating.layers) || []).forEach(function (L) {
      if (L.use === 'sprinkle' || L.use === 'drizzle') { amounts.push(L.amount); evens.push(L.even); }
      if (L.q !== undefined && L.q !== null) cooks.push(L.q);
    });
    function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 1; }
    var PW = SC.plate;
    var plateRaw = guest.order
      ? (PW.order * seqScore + PW.amount * avg(amounts) + PW.even * avg(evens)) / (PW.order + PW.amount + PW.even)
      : (PW.amount * avg(amounts) + PW.even * avg(evens)) / (PW.amount + PW.even);
    var parts = {
      wait: 1,
      cook: clamp01(avg(cooks)),
      plate: clamp01(plateRaw * correct),
      pref: clamp01(p.pref + p.bonus)
    };
    // 待ち時間：待てる時間の waitGrace までは満点、それを過ぎると waitFloor まで下がる
    var pm = guest.patienceMax || (guest.type && guest.type.patience) || 60;
    var ratio = waited / pm;
    if (ratio > SC.waitGrace) parts.wait = Math.max(SC.waitFloor, 1 - (ratio - SC.waitGrace) / (1 - SC.waitGrace) * (1 - SC.waitFloor));
    var W = guest.order ? SC.weights : SC.omakaseWeights;
    var score = (W.wait * parts.wait + W.cook * parts.cook + W.plate * parts.plate + W.pref * parts.pref) / (W.wait + W.cook + W.plate + W.pref);
    score = clamp01(score);

    // 値段と、タコスごとの星の上限（熟練度）
    var base, lv = 0, key = got ? got.id : null;
    if (key && key.slice(0, 3) === 'su:') {
      base = cfg().SU_TACO.base + ((ing(key.slice(3)) || {}).value || 0);
      cap = Math.min(cap, cfg().SU_TACO.maxStars);
    } else if (key) {
      var rec = cfg().TACOS[key];
      lv = level(key);
      base = rec.price * cfg().MASTERY.priceMul[lv - 1];
      cap = Math.min(cap, rec.maxStars || 5, key === 'sutaco' ? 5 : cfg().MASTERY.maxStars[lv - 1]);
    } else {
      base = R.omakaseBase;
      served.items.forEach(function (id) { base += (ing(id) || {}).value || 0; });
    }
    var pct = score * 100, stars = 1;
    SC.stars.forEach(function (cut, i) { if (pct >= cut) stars = i + 2; });
    stars = Math.max(1, Math.min(stars, cap));
    var pay = key === 'sutaco' ? 1 : Math.max(1, Math.round(base * R.starPay[stars] * guest.type.pay));
    var tip = key === 'sutaco' ? 0 : Math.round(base * R.tipRate[stars] * guest.type.pay);
    return {
      recipe: key,              // 出したタコス（メニュー外なら null = おまかせ、'su:食材' = 素タコス）
      variant: got && got.variant,
      level: lv,
      score: score, parts: parts, pref: p.pref, stars: stars, pay: pay, tip: tip,
      rep: cfg().REP.perStar[stars],
      forbidden: p.forbidden, hint: p.hint
    };
  };

  OT.tasteOf = tasteOf;
  OT.identifyTaco = identify;
})(window);
