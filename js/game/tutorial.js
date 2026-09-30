/*
 * 多幸寿：はじめての1日の案内（仕入れ → 料理 → 会計を、画面の上で順に指さす）
 *   案内のことばは text.js の 'tut.*'。1日目が終わると出なくなる。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var doc = global.document;

  var box = null, timer = null, current = null;

  function active() {
    var s = OT.state.get();
    return s && s.day === 1 && !s.flags.tutDone;
  }

  function clear() {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    box = null; current = null;
    clearInterval(timer);
  }

  OT.tut = {
    /** selector の場所を光らせて、ポン吉のひとこと（key）を出す */
    point: function (key, selector) {
      if (!active()) return;
      var s = OT.state.get();
      if (s.flags['tut_' + key]) return;
      clear();
      current = key;
      box = OT.el('div', { class: 'tut' }, [
        OT.el('div', { class: 'tut-ring' }),
        OT.el('div', { class: 'tut-bubble' }, [OT.el('b', { text: '🦝 ' + OT.t('pon.name') }), OT.el('span', { text: OT.t('tut.' + key) })])
      ]);
      doc.getElementById('app').appendChild(box);
      var ring = box.firstChild, bub = box.lastChild;
      function place() {
        var el = doc.querySelector(selector);
        var app = doc.getElementById('app').getBoundingClientRect();
        if (!el || !el.offsetParent) { ring.style.display = 'none'; return; }
        var r = el.getBoundingClientRect();
        ring.style.display = 'block';
        ring.style.left = (r.left - app.left - 6) + 'px'; ring.style.top = (r.top - app.top - 6) + 'px';
        ring.style.width = (r.width + 12) + 'px'; ring.style.height = (r.height + 12) + 'px';
        var below = r.top - app.top < app.height * 0.55;
        bub.style.top = below ? (r.bottom - app.top + 12) + 'px' : 'auto';
        bub.style.bottom = below ? 'auto' : (app.bottom - r.top + 12) + 'px';
      }
      place();
      timer = setInterval(place, 200);
    },
    /** その案内を終える（次に同じ案内は出ない） */
    done: function (key) {
      var s = OT.state.get();
      if (!s) return;
      s.flags['tut_' + key] = 1;
      if (current === key) clear();
    },
    finish: function () { var s = OT.state.get(); if (s) { s.flags.tutDone = 1; } clear(); },
    clear: clear
  };
})(window);
