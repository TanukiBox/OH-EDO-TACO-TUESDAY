/*
 * 多幸寿：物語の場面を出すしくみ（会話の表示・条件・ごほうび）
 *   いつ出すか = config.js の EVENTS、セリフ = text.js の STORY
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var doc = global.document;

  function st() { return OT.state.get(); }
  function lines(id) {
    var S = OT.STORY[OT.i18n.lang] || OT.STORY.ja;
    return S[id] || OT.STORY.ja[id] || [];
  }
  function who(id) {
    var S = OT.STORY[OT.i18n.lang] || OT.STORY.ja;
    return (S.who && S.who[id]) || '';
  }

  // ---------------------------------------------------------------
  // 会話の画面（タップで次へ。スキップもできる）
  // ---------------------------------------------------------------
  var open = false;
  OT.dialog = function (list, done) {
    var box = doc.getElementById('dialog');
    var i = 0;
    open = true;
    box.innerHTML = '';
    box.className = 'on';
    var face = OT.el('div', { class: 'dlg-face' });
    var faceCanvas = OT.ui.pixelCanvas(48, 48, 'dlg-face-img');
    var name = OT.el('div', { class: 'dlg-name' });
    var text = OT.el('div', { class: 'dlg-text' });
    var next = OT.el('div', { class: 'dlg-next', text: '▼' });
    var skip = OT.el('button', { class: 'dlg-skip', text: OT.t('story.skip') });
    var card = OT.el('div', { class: 'dlg-card' }, [face, OT.el('div', { class: 'dlg-body' }, [name, text]), next]);
    box.appendChild(skip);
    box.appendChild(card);
    function show() {
      var ln = list[i];
      var w = ln[0];
      var FK = { mateo: 'mateo', pon: 'pon', traveler: 'tabibito', crowd: 'chonin_a' };
      var key = FK[w] || w;
      face.textContent = '';
      if (OT.sprites.drawFace(faceCanvas, key, /！|!|うまい|ありがた|ごっつぁん|粋/.test(ln[1]))) face.appendChild(faceCanvas);
      else face.textContent = OT.art.portrait(w);
      face.className = 'dlg-face' + (w === 'narrator' ? ' none' : '');
      name.textContent = who(w);
      text.textContent = ln[1];
      card.className = 'dlg-card' + (w === 'narrator' ? ' narr' : '');
    }
    function close() {
      box.className = '';
      box.innerHTML = '';
      open = false;
      box.onpointerdown = null;
      if (done) done();
    }
    box.onpointerdown = function (e) {
      if (e.target === skip) return;
      e.preventDefault();
      OT.sfx.tap();
      i++;
      if (i >= list.length) close(); else show();
    };
    skip.onclick = function (e) { e.stopPropagation(); close(); };
    if (!list.length) { close(); return; }
    show();
  };
  OT.dialogOpen = function () { return open; };

  // ---------------------------------------------------------------
  // 場面の条件と、起きたときのごほうび
  // ---------------------------------------------------------------
  function daysInChapter(ch) {
    var s = st();
    var start = s.chStart && s.chStart[ch];
    return start ? s.day - start + 1 : 0;
  }
  OT.daysInChapter = daysInChapter;

  function eligible(ev, at, ctx) {
    var s = st();
    if (ev.at !== at) return false;
    if (s.flags['ev_' + ev.id]) return false;
    if (ev.day && s.day !== ev.day) return false;
    if (ev.chapter && OT.state.chapter() !== ev.chapter) return false;
    if (ev.chapterDay && daysInChapter(ev.chapter || OT.state.chapter()) < ev.chapterDay) return false;
    if (ev.needStock && OT.state.stockOf(ev.needStock) <= 0) return false;
    if (ev.needFlag && !s.flags[ev.needFlag]) return false;
    if (at === 'rankup' && ctx && ctx.chapter && ev.chapter > ctx.chapter) return false;
    if (at === 'regular' && (!ctx || ctx.regular !== ev.regular)) return false;
    return true;
  }

  function apply(ev) {
    var s = st();
    s.flags['ev_' + ev.id] = s.day || 1;   // 起きた日を覚えておく
    if (ev.set) s.flags[ev.set] = 1;
    if (ev.give) Object.keys(ev.give).forEach(function (id) { OT.state.addStock(id, ev.give[id]); });
    if (ev.setStock) Object.keys(ev.setStock).forEach(function (id) { s.stock[id] = ev.setStock[id]; });
    if (ev.rep) s.rep += ev.rep;
    if (ev.money) s.money += ev.money;
    if (ev.id === 'summons') { s.chStart = s.chStart || {}; s.chStart[6] = s.day; }
    OT.state.save();
  }

  function find(id) {
    var list = OT.CFG.EVENTS;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  OT.story = {
    /** 場面を1つ見せる（会話 → ごほうび → つながる場面） */
    play: function (id, done) {
      var ev = find(id) || { id: id };
      var show = (id === 'prologue' && OT.sprites.manifest.story) ? OT.opening.play : OT.dialog;
      show(lines(id), function () {
        apply(ev);
        if (ev.next) OT.story.play(ev.next, done);
        else if (done) done();
      });
    },
    /** at のときに起きる場面を、順に全部見せる */
    check: function (at, ctx, done) {
      var todo = OT.CFG.EVENTS.filter(function (ev) { return eligible(ev, at, ctx); });
      var played = 0;
      (function step(k) {
        if (k >= todo.length) { if (done) done(played); return; }
        // 前の場面で条件が変わることがあるので、もう一度確かめる
        if (!eligible(todo[k], at, ctx)) { step(k + 1); return; }
        played++;
        OT.story.play(todo[k].id, function () { step(k + 1); });
      })(0);
    },
    /** その夜の最初の客として来る常連（場面の regular） */
    nightRegular: function () {
      var s = st();
      var list = OT.CFG.EVENTS.filter(function (ev) { return ev.at === 'night' && ev.regular && s.flags['ev_' + ev.id] && s.flags['ev_' + ev.id] === s.day; });
      return list.length ? list[0].regular : null;
    },
    seen: function (id) { return !!st().flags['ev_' + id]; }
  };
})(window);
