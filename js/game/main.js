/*
 * 多幸寿：起動と1日の流れ
 *   タイトル → 朝（仕入れ）→ ミニゲーム → 朝 → 夜（営業）→ 結果 → 次の日の朝 …
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  OT.flow = {
    title: function () { OT.title.enter(); },
    morning: function () { OT.morning.enter(); },
    supplier: function (sup) {
      if (sup.game === 'auction') OT.auction.enter();
      else if (sup.game === 'fishing') OT.fishing.enter();
      else if (sup.game === 'forage') OT.forage.enter();
      else if (sup.kind === 'shop') OT.shop.enter(sup.id);
    },
    night: function () {
      var s = OT.state.get();
      s.phase = 'night';
      OT.state.save();          // 営業の直前をセーブ（途中で閉じたら、この夜の最初から）
      OT.night.enter();
    },
    result: function () { OT.result.enter(); },
    nextDay: function () {
      var s = OT.state.get();
      s.day += 1;
      s.gamesToday = 0;
      // 鯨組の大物が競りに入る日（第4章から、ときどき）
      s.whaleDay = OT.state.chapter() >= 4 && Math.random() < OT.CFG.AUCTION.whaleChance;
      if (s.stock.kujira) s.stock.kujira = 0;   // 鯨はその日のうちに使いきる
      s.phase = 'morning';
      OT.state.save();
      OT.morning.enter();
    },
    /** セーブの続きから */
    resume: function () {
      var s = OT.state.get();
      if (s.phase === 'result' && s.lastResult) OT.result.enter();
      else if (s.phase === 'night') OT.flow.night();
      else OT.morning.enter();
    }
  };

  function boot() {
    OT.store = TB.createStore(OT.CFG.SAVE_KEY);
    OT.i18n = TB.createI18n(OT.TEXT, 'en');
    var langPick = OT.store.get('lang', null);
    if (langPick && !/[?&]lang=/.test(global.location.search)) OT.i18n.setLang(langPick);
    global.document.documentElement.lang = OT.i18n.lang;
    OT.sound = TB.createSound(OT.store);
    // 共通土台の片手操作：スペース/Enter キーを「押した」にまとめる（画面のボタンは普通のタップ）
    OT.input = TB.createInput(global.document.getElementById('keys'));
    OT.art.load(function () {
      global.document.body.classList.add('ready');
      OT.flow.title();
    });
  }

  if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
