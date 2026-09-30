/*
 * 多幸寿：オープニングの紙芝居（序章の会話に、Blender で作った5枚の絵をつける。スキップできる）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var doc = global.document;

  // 序章の会話の何行目で、何枚目の絵にするか（text.js の STORY.prologue の行と対応）
  var PANEL_OF = [1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5];

  OT.opening = {
    play: function (lines, done) {
      var box = doc.getElementById('dialog');
      box.innerHTML = '';
      box.className = 'on kami';
      var frame = OT.el('div', { class: 'kami-frame' });
      var pic = OT.ui.pixelCanvas(240, 160, 'kami-pic');
      frame.appendChild(pic);
      var name = OT.el('div', { class: 'dlg-name' });
      var text = OT.el('div', { class: 'dlg-text' });
      var card = OT.el('div', { class: 'dlg-card kami-card' }, [OT.el('div', { class: 'dlg-body' }, [name, text]), OT.el('div', { class: 'dlg-next', text: '▼' })]);
      var skip = OT.el('button', { class: 'dlg-skip', text: OT.t('story.skip') });
      box.appendChild(skip);
      box.appendChild(frame);
      box.appendChild(card);
      var i = 0, shown = 0;
      var S = OT.STORY[OT.i18n.lang] || OT.STORY.ja;
      function show() {
        var p = PANEL_OF[Math.min(i, PANEL_OF.length - 1)];
        if (p !== shown) {
          shown = p;
          frame.classList.remove('slide'); void frame.offsetWidth; frame.classList.add('slide');
          var ctx = pic.getContext('2d'); ctx.clearRect(0, 0, 240, 160);
          var im = OT.sprites.get('story_' + p);
          if (im && im.complete) ctx.drawImage(im, 0, 0);
          OT.sfx.clack(1);
        }
        var w = lines[i][0];
        name.textContent = (S.who && S.who[w]) || '';
        text.textContent = lines[i][1];
        card.className = 'dlg-card kami-card' + (w === 'narrator' ? ' narr' : '');
      }
      function close() { box.className = ''; box.innerHTML = ''; box.onpointerdown = null; if (done) done(); }
      box.onpointerdown = function (e) {
        if (e.target === skip) return;
        e.preventDefault();
        OT.sfx.tap();
        i++;
        if (i >= lines.length) close(); else show();
      };
      skip.onclick = function (e) { e.stopPropagation(); close(); };
      show();
    }
  };
})(window);
