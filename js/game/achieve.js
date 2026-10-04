/*
 * 多幸寿：実績（クリアのあとも楽しめる目標）
 *   どれを実績にするか・何回で達成かは config.js の ACHIEVEMENTS。名前と説明は text.js の 'ach.*'。
 *   画面が変わるたびに確かめて、新しく達成したら知らせる。図鑑の「実績」で一覧が見られる。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function st() { return OT.state.get(); }
  function list() { return OT.CFG.ACHIEVEMENTS; }

  /** いまの進み具合 { n: いま, of: 目標 } */
  function progress(a) {
    var s = st(), C = OT.CFG, n = 0, of = a.n || 1;
    switch (a.kind) {
      case 'listed': n = s.bzListed ? 1 : 0; break;
      case 'ozeki': n = s.bzListed && OT.news && OT.news.ranking().findIndex(function (e) { return e.me; }) <= 1 ? 1 : 0; break;
      case 'tacos': {
        var all = Object.keys(C.TACOS).filter(function (id) { return !C.TACOS[id].onlyWhenOut; });
        n = all.filter(function (id) { return (s.made[id] || 0) > 0; }).length;
        if (!a.n) of = all.length;
        break;
      }
      case 'kaiso3': n = OT.upg ? OT.upg.kinds.filter(function (k) { return OT.upg.level(k) >= 3; }).length : 0; if (!a.n) of = 4; break;
      case 'flag': n = s.flags[a.key] ? 1 : 0; break;
      case 'flags': n = a.keys.filter(function (k) { return s.flags[k]; }).length; of = a.keys.length; break;
      case 'seen': n = s.seen[a.key] ? 1 : 0; break;
      case 'count': n = (s.counts || {})[a.key] || 0; break;
      case 'money': n = s.money; break;
      case 'gear': { var g = s.gear || {}; n = (g.line || 0) + (g.rod || 0); of = C.FISHING.gear.line.length - 1 + C.FISHING.gear.rod.length - 1; break; }
    }
    return { n: Math.min(n, of), of: of };
  }
  function done(a) { var p = progress(a); return p.n >= p.of; }

  OT.ach = {
    progress: progress,
    /** 新しく達成したものを知らせる */
    check: function () {
      var s = st();
      if (!s) return;
      // 夜の営業中・タイトル・開発用メニューでは知らせない（料理のじゃまをしない。結果の画面で知らせる）
      if (['night', 'title', 'dev'].indexOf(OT.ui.current()) >= 0) return;
      s.ach = s.ach || {};
      var fresh = list().filter(function (a) { return !s.ach[a.id] && done(a); });
      if (!fresh.length) return;
      fresh.forEach(function (a) { s.ach[a.id] = s.day; });
      OT.state.save();
      if (fresh.length >= 3) {   // いちどにたくさんなら、ひとつにまとめて
        setTimeout(function () { OT.ui.toast('🏆 ' + OT.t('ach.many', { n: fresh.length }), 'tip long'); OT.sfx.happy(3); }, 300);
        return;
      }
      fresh.forEach(function (a, i) {
        setTimeout(function () {
          OT.ui.toast('🏆 ' + OT.t('ach.got', { name: OT.t('ach.' + a.id) }), 'tip long');
          OT.sfx.happy(2);
        }, 300 + i * 1600);
      });
    },
    /** まだの実績（クリア後の目標に、上から n こ） */
    next: function (n) { var s = st(); return list().filter(function (a) { return !(s.ach || {})[a.id]; }).slice(0, n || 3); },
    /** 図鑑の「実績」のならび */
    cards: function () {
      var s = st();
      return list().map(function (a) {
        var got = (s.ach || {})[a.id], p = progress(a);
        return OT.el('div', { class: 'ach-card' + (got ? ' got' : '') }, [
          OT.el('span', { class: 'ach-icon', text: got ? '🏆' : '🔒' }),
          OT.el('div', { class: 'ach-info' }, [
            OT.el('b', { text: OT.t('ach.' + a.id) }),
            OT.el('span', { text: OT.t('ach.' + a.id + '.desc') }),
            got ? OT.el('span', { class: 'ach-day', text: OT.t('ach.day', { n: got }) }) :
              p.of > 1 ? OT.el('span', { class: 'ach-prog', text: OT.t('ach.prog', { n: p.n, of: p.of }) }) : null
          ].filter(Boolean))
        ]);
      });
    },
    count: function () { var s = st(); return { n: Object.keys(s.ach || {}).length, of: list().length }; },
    /** 回数を数える（星5・高級な一品・イカサマを見破った など） */
    add: function (key, n) { var s = st(); if (!s) return; s.counts = s.counts || {}; s.counts[key] = (s.counts[key] || 0) + (n || 1); }
  };
})(window);
