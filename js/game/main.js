/*
 * 多幸寿：起動と1日の流れ
 *   タイトル → 朝（仕入れ）→ ミニゲーム → 朝 → 夜（営業）→ 結果 → 次の日の朝 …
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  OT.flow = {
    title: function () { OT.title.enter(); },
    newGame: function () {
      OT.state.newGame();
      OT.story.check('newgame', null, function () { OT.flow.morning(); });
    },
    morning: function () {
      OT.bgm.play('day');
      OT.morning.enter();
      // 朝の場面（起きたら、画面を作り直す）
      OT.story.check('morning', null, function (played) { if (played) OT.morning.enter(); });
    },
    supplier: function (sup) {
      if (sup.game === 'auction') OT.auction.enter();
      else if (sup.game === 'fishing') OT.fishing.enter();
      else if (sup.game === 'forage') OT.forage.enter();
      else if (sup.game === 'hunt') OT.hunt.enter();
      else if (sup.game === 'smuggle') OT.story.check('smuggle', null, function () { OT.smuggle.enter(); });
      else if (sup.kind === 'shop') OT.shop.enter(sup.id);
    },
    night: function (opts) {
      opts = opts || {};
      var s = OT.state.get();
      s.phase = 'night';
      s.tributeNight = !!opts.tribute;
      OT.state.save();          // 営業の直前をセーブ（途中で閉じたら、この夜の最初から）
      OT.story.check('night', null, function () {
        if (opts.tribute) { OT.bgm.play('battle'); OT.story.play('vip_tribute_intro', function () { OT.night.enter({ tribute: true }); }); return; }
        var vip = OT.night.pickVip();
        if (vip) { OT.bgm.play('battle'); OT.story.play('vip_' + vip + '_intro', function () { OT.night.enter({ vip: vip }); }); }
        else { OT.bgm.play('night'); OT.night.enter(); }
      });
    },
    result: function () {
      OT.bgm.play('day');
      OT.result.enter();
      var s = OT.state.get(), r = s.lastResult;
      if (!r || r.eventsDone) return;
      if (r.rankUp) OT.fx.rankUp(OT.t('rank.' + r.rankUp));
      if (r.vip && r.vipResult === 'win') OT.fx.win();
      // 結果のあとの場面：ランクアップ → VIP の勝ち負け → 常連 → その他 → エンディング
      var steps = [];
      if (r.rankUp) steps.push(function (next) { OT.story.check('rankup', { chapter: r.rankUp }, next); });
      if (r.vip && r.vip !== 'tribute') steps.push(function (next) { OT.story.play(r.vipResult === 'win' ? 'vip_' + r.vip + '_win' : 'vip_lose', next); });
      if (r.tribute && r.vipResult !== 'win') steps.push(function (next) { OT.story.play('vip_lose', next); });
      (r.regulars || []).forEach(function (id) { steps.push(function (next) { OT.story.check('regular', { regular: id }, next); }); });
      steps.push(function (next) { OT.story.check('result', null, next); });
      if (r.tribute && r.vipResult === 'win') steps.push(function (next) { OT.bgm.play('ending'); OT.story.play('ending', function () { OT.ending.enter(); }); });
      (function run(i) {
        if (i >= steps.length) { r.eventsDone = true; OT.state.save(); if (OT.ui.current() === 'result') OT.result.enter(); return; }
        steps[i](function () { run(i + 1); });
      })(0);
    },
    nextDay: function () {
      var s = OT.state.get();
      s.day += 1;
      s.gamesToday = 0;
      // 鯨組の大物が競りに入る日（第4章から、ときどき）
      s.whaleDay = OT.state.chapter() >= 4 && Math.random() < OT.CFG.AUCTION.whaleChance;
      if (s.stock.kujira) s.stock.kujira = 0;   // 鯨はその日のうちに使いきる
      if (OT.news) OT.news.newDay();             // 瓦版：ほかの店の評判が動き、今朝の記事ができる
      s.phase = 'morning';
      OT.state.save();
      OT.morning.enter();
    },
    /** セーブの続きから */
    resume: function () {
      var s = OT.state.get();
      if (s.phase === 'result' && s.lastResult) OT.flow.result();
      else if (s.phase === 'night') OT.flow.night({ tribute: s.tributeNight });
      else OT.flow.morning();
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
      OT.sprites.load(function () {
        global.document.body.classList.add('ready');
        OT.flow.title();
      });
    });
  }

  if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
