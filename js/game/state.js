/*
 * 多幸寿：ゲームの状態（所持金・在庫・評判・日数）とセーブ
 *
 * セーブするのは「区切り」のときだけ：
 *   ・朝（仕入れ先を選ぶ画面）に入ったとき、仕入れから戻ったとき
 *   ・夜の営業を始める直前（phase = 'night'）… 営業中に再読み込みすると、その夜の最初からやり直し
 *   ・営業が終わって結果が出たとき（phase = 'result'）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function fresh() {
    var S = OT.CFG.START;
    return {
      v: OT.CFG.SAVE_VERSION,
      day: S.day,
      money: S.money,
      rep: S.rep,
      stock: clone(S.stock),
      phase: 'morning',       // 'morning' | 'night' | 'result'
      gamesToday: 0,          // 今日遊んだミニゲームの数
      lastResult: null,       // 最後の夜の結果（結果画面の表示用）
      made: {},               // タコスごとの出した回数（熟練度と図鑑に使う）
      seen: {},               // 手に入れたことのある食材（図鑑に使う）
      totals: { sales: 0, served: 0, stars: 0 },
      rankSeen: 0,            // お知らせ済みの評判ランク
      whaleDay: false,        // 今日は鯨組の大物が競りに入る日か
      fisherTrust: 0,         // 常連の漁師・浜蔵さんの信頼（朝の競りで耳打ちしてくれる）
      flags: {},              // 物語の進み具合など
      chStart: { 1: 1 },      // 各章になった日
      regulars: {},           // 常連ごとの、星3を出した回数
      vipLast: 0,             // 最後に VIP が来た日
      starScale: 5            // 星の段階（以前のセーブは3段階）
    };
  }

  /** 古いセーブに、あとから増えた項目を足す */
  function upgrade(s) {
    var had = s.starScale;
    var f = fresh();
    Object.keys(f).forEach(function (k) { if (s[k] === undefined) s[k] = f[k]; });
    // 星3段階のころのセーブ：過去の星の記録を5段階に換算して引き継ぐ（星3 → 星5、星2 → 約星3）
    if (had !== 5) {
      if (s.totals) s.totals.stars = Math.round((s.totals.stars || 0) * 5 / 3);
      if (s.lastResult && s.lastResult.avg) s.lastResult.avg = s.lastResult.avg * 5 / 3;
      s.starScale = 5;
    }
    return s;
  }

  var st = null;

  OT.state = {
    get: function () { return st; },
    hasSave: function () { return !!OT.store.get('save', null); },
    newGame: function () {
      st = fresh();
      Object.keys(st.stock).forEach(function (id) { st.seen[id] = 1; });
      OT.state.save();
      return st;
    },
    load: function () {
      var s = OT.store.get('save', null);
      if (!s || s.v !== OT.CFG.SAVE_VERSION) return null;
      st = upgrade(s);
      return st;
    },
    save: function () { if (st) OT.store.set('save', st); },
    /** 夜の営業のあいだは、この写しを書きかえる（途中でやめても元の在庫に戻れるように） */
    snapshot: function () { return clone(st); },
    replace: function (s) { st = s; },
    wipe: function () { OT.store.remove('save'); st = null; },

    stockOf: function (id) {
      if (id === 'sanmai') return Math.floor(OT.state.cornSkins() / 3);   // 3枚重ねの皮
      return (st.stock[id] || 0);
    },
    /** トルティーヤの代わりになる皮の合計 */
    cornSkins: function () {
      var n = 0;
      Object.keys(OT.CFG.INGREDIENTS).forEach(function (id) { if (id === 'tortilla' || OT.CFG.INGREDIENTS[id].as === 'tortilla') n += st.stock[id] || 0; });
      return n;
    },
    addStock: function (id, n) {
      st.stock[id] = (st.stock[id] || 0) + n;
      st.seen[id] = 1;
    },
    useStock: function (id, n) {
      n = n || 1;
      if (id === 'sanmai') {
        // 3枚重ね：多く持っているトウモロコシの皮から3枚ずつ使う
        var need = 3 * n;
        if (OT.state.cornSkins() < need) return false;
        var ids = Object.keys(OT.CFG.INGREDIENTS).filter(function (k) { return k === 'tortilla' || OT.CFG.INGREDIENTS[k].as === 'tortilla'; });
        ids.sort(function (a, b) { return (st.stock[b] || 0) - (st.stock[a] || 0); });
        ids.forEach(function (k) { var take = Math.min(need, st.stock[k] || 0); st.stock[k] = (st.stock[k] || 0) - take; need -= take; });
        return true;
      }
      if ((st.stock[id] || 0) < n) return false;
      st.stock[id] -= n;
      return true;
    },

    /** 今の評判ランク（0〜4）。第1章 = 0 */
    rank: function () {
      var r = 0, list = OT.CFG.RANKS;
      for (var i = 0; i < list.length; i++) if (st.rep >= list[i]) r = i;
      return r;
    },
    /** 今の章（1〜6） */
    //   一度上がったランクは、評判が少し下がっても戻らない（解禁したものは使い続けられる）
    chapter: function () { return (st.flags.finale ? 6 : Math.max(OT.state.rank(), st.rankSeen) + 1); },
    /** 今の季節 'spring' | 'summer' | 'autumn' | 'winter' */
    season: function () {
      var i = Math.floor((st.day - 1) / OT.CFG.SEASON_DAYS) % 4;
      return ['spring', 'summer', 'autumn', 'winter'][i];
    }
  };
})(window);
