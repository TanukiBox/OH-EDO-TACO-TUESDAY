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
      flags: {}               // 物語の進み具合など
    };
  }

  /** 古いセーブに、あとから増えた項目を足す */
  function upgrade(s) {
    var f = fresh();
    Object.keys(f).forEach(function (k) { if (s[k] === undefined) s[k] = f[k]; });
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

    stockOf: function (id) { return (st.stock[id] || 0); },
    addStock: function (id, n) {
      st.stock[id] = (st.stock[id] || 0) + n;
      st.seen[id] = 1;
    },
    useStock: function (id, n) {
      n = n || 1;
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
