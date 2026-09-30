/*
 * 多幸寿：はじめての1日の案内（仕入れ → 料理 → 会計を、画面の上で順に指さす）
 *   案内のことばは text.js の 'tut.*'。1日目が終わると出なくなる。
 *   吹き出しはいつも1つだけ。「×」で閉じられる。夜の案内（kitchen.js）は手順の番号と「OK」「案内を終える」つき。
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
    /**
     * selector の場所を光らせて、ポン吉のひとこと（key）を出す。
     * opts: { force: 1日目でなくても出す, index/total: 手順の番号, ok: 「OK」を押したとき, close: 「案内を終える」を押したとき }
     */
    point: function (key, selector, opts) {
      opts = opts || {};
      if (!opts.force && !active()) return;
      var s = OT.state.get();
      if (!opts.force && s.flags['tut_' + key]) return;
      if (current === key && box) return;   // 同じ案内は出し直さない
      clear();
      current = key;
      var head = OT.el('div', { class: 'tut-head' }, [OT.el('b', { text: '🦝 ' + OT.t('pon.name') })]);
      if (opts.index) head.appendChild(OT.el('span', { class: 'tut-step', text: opts.index + ' / ' + opts.total }));
      var closeBtn = OT.el('button', { class: 'tut-x', text: '×', 'aria-label': OT.t('tut.close'),
        onclick: function () { if (opts.close) opts.close(); else OT.tut.done(key); } });
      head.appendChild(closeBtn);
      var bub = OT.el('div', { class: 'tut-bubble' }, [head, OT.el('span', { class: 'tut-text', text: OT.t('tut.' + key) })]);
      if (opts.ok || opts.close) {
        var row = OT.el('div', { class: 'tut-btns' });
        if (opts.close) row.appendChild(OT.el('button', { class: 'tut-skip', text: OT.t('tut.skip'), onclick: function () { opts.close(); } }));
        if (opts.ok) row.appendChild(OT.el('button', { class: 'tut-ok', text: 'OK', onclick: function () { OT.sfx.tap(); clear(); opts.ok(); } }));
        bub.appendChild(row);
      }
      box = OT.el('div', { class: 'tut' + (opts.force ? ' strong' : '') }, [OT.el('div', { class: 'tut-ring' }), bub]);
      doc.getElementById('app').appendChild(box);
      var ring = box.firstChild;
      function place() {
        var el = null, list = doc.querySelectorAll(selector);
        for (var i = 0; i < list.length; i++) if (list[i].offsetParent) { el = list[i]; break; }
        var app = doc.getElementById('app').getBoundingClientRect();
        if (!el) { ring.style.display = 'none'; bub.style.top = '38%'; bub.style.bottom = 'auto'; return; }
        var r = el.getBoundingClientRect();
        ring.style.display = 'block';
        ring.style.left = (r.left - app.left - 6) + 'px'; ring.style.top = (r.top - app.top - 6) + 'px';
        ring.style.width = (r.width + 12) + 'px'; ring.style.height = (r.height + 12) + 'px';
        var below = r.top - app.top < app.height * 0.5;
        bub.style.top = below ? Math.min(app.height - 140, r.bottom - app.top + 12) + 'px' : 'auto';
        bub.style.bottom = below ? 'auto' : Math.min(app.height - 140, app.bottom - r.top + 12) + 'px';
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
    finish: function () { var s = OT.state.get(); if (s) { s.flags.tutDone = 1; s.flags.tutNight = 1; } clear(); },
    clear: clear,
    current: function () { return current; }
  };
})(window);
