/*
 * 多幸寿：味と評価
 *   ・タコスの味 = 皮とのせた食材の「辛・酸・旨・香・食感」の合計
 *   ・客の好み（want）にどれだけ近いか → 好みの点（0〜1）
 *   ・注文どおりか → 注文の点（0〜1）
 *   ・2つを合わせた点数で、星1〜3と代金が決まる
 * 数字はすべて config.js（RATING・CUSTOMERS）。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function cfg() { return OT.CFG; }

  /** served = { skin: 'tortilla', items: ['kisu_ten', ...] } の味の合計 */
  function tasteOf(served) {
    var sum = [0, 0, 0, 0, 0];
    var list = [served.skin].concat(served.items);
    list.forEach(function (id) {
      var ing = cfg().INGREDIENTS[id];
      if (!ing) return;
      for (var k = 0; k < 5; k++) sum[k] += ing.taste[k];
    });
    return sum;
  }

  function tagsOf(served) {
    var tags = {};
    [served.skin].concat(served.items).forEach(function (id) {
      var ing = cfg().INGREDIENTS[id];
      if (ing) ing.tags.forEach(function (t) { tags[t] = 1; });
    });
    return tags;
  }

  /** のせた食材が、どのメニューのタコスにあたるか（必要な食材がいちばん多くそろったもの）。なければ null */
  function identify(served) {
    var best = null, bestN = -1;
    Object.keys(cfg().TACOS).forEach(function (id) {
      var r = cfg().TACOS[id];
      if (r.skin !== served.skin) return;
      var ok = r.need.every(function (n) { return served.items.indexOf(n) >= 0; });
      if (ok && r.need.length > bestN) { best = id; bestN = r.need.length; }
    });
    return best;
  }

  /** 客の好みの点（0〜1）＋種類ごとの上乗せ */
  function preference(guest, served, waited) {
    var T = tasteOf(served), want = guest.want, w = guest.type.weight;
    var tol = cfg().RATING.tolerance, s = 0, ws = 0;
    for (var k = 0; k < 5; k++) {
      var d = Math.abs(T[k] - want[k]);
      var sk = Math.max(0, 1 - d / Math.max(tol, want[k]));
      s += w[k] * sk; ws += w[k];
    }
    var p = s / ws;
    var bonus = 0;
    if (guest.type.fastBonus && waited <= guest.type.fastSeconds) bonus += guest.type.fastBonus;
    if (guest.type.looksBonus) {
      var tags = tagsOf(served);
      if (tags.red && tags.white) bonus += guest.type.looksBonus;
    }
    return { pref: Math.min(1, p), bonus: bonus, taste: T };
  }

  /**
   * 評価する。
   * guest  = { type: CUSTOMERS[..], typeId, want: [..], order: 'tempura' | null(おまかせ) }
   * served = { skin, items }
   * waited = 座ってから出すまでの秒数
   */
  OT.evaluate = function (guest, served, waited) {
    var R = cfg().RATING;
    var got = identify(served);
    var p = preference(guest, served, waited);
    var score, cap = 3;
    if (guest.order) {
      var need = cfg().TACOS[guest.order].need.concat();
      var missing = need.filter(function (n) { return served.items.indexOf(n) < 0; }).length;
      if (served.skin !== cfg().TACOS[guest.order].skin) missing += 1;
      var extras = served.items.filter(function (n) { return need.indexOf(n) < 0; }).length;
      var orderScore = Math.max(0, 1 - R.missingPenalty * missing - R.extraPenalty * extras);
      score = R.orderWeight * orderScore + (1 - R.orderWeight) * p.pref + p.bonus;
      if (missing >= 2) cap = R.wrongOrderMaxStars;
    } else {
      score = p.pref + p.bonus;   // おまかせ：好みだけで決まる
    }
    score = Math.max(0, Math.min(1, score));
    var stars = score >= R.star3 ? 3 : score >= R.star2 ? 2 : 1;
    stars = Math.min(stars, cap);
    var base;
    if (got) base = cfg().TACOS[got].price;
    else {
      base = R.omakaseBase;
      served.items.forEach(function (id) { base += (cfg().INGREDIENTS[id] || {}).value || 0; });
    }
    var pay = Math.max(1, Math.round(base * R.starPay[stars] * guest.type.pay));
    return {
      recipe: got,              // 出したタコスの種類（メニュー外なら null = おまかせ）
      score: score, pref: p.pref, stars: stars, pay: pay,
      rep: cfg().REP.perStar[stars]
    };
  };

  OT.tasteOf = tasteOf;
  OT.identifyTaco = identify;
})(window);
