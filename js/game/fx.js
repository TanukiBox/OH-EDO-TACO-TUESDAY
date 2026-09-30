/*
 * 多幸寿：演出（開店カットイン・星3の大写し・ランクアップ・ヌシ・対決の勝利・紙吹雪）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var doc = global.document;

  function layer() { return doc.getElementById('fxlayer'); }

  function confetti(box, n) {
    var cols = ['#f24a2a', '#f5b860', '#a8e05a', '#5070b0', '#fffaf0', '#f0664e'];
    for (var i = 0; i < n; i++) {
      var c = OT.el('i', { class: 'confetti', style: 'left:' + (Math.random() * 100) + '%;background:' + cols[i % cols.length] +
        ';animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's;animation-duration:' + (1.6 + Math.random() * 1.4).toFixed(2) + 's' });
      box.appendChild(c);
    }
  }

  function flashBanner(cls, title, sub, ms) {
    var box = OT.el('div', { class: 'fx-banner ' + cls }, [
      OT.el('div', { class: 'fx-title', text: title }),
      sub ? OT.el('div', { class: 'fx-sub', text: sub }) : null
    ]);
    confetti(box, 40);
    layer().appendChild(box);
    setTimeout(function () { box.classList.add('out'); }, ms || 1800);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, (ms || 1800) + 500);
  }

  OT.fx = {
    /** 開店カットイン：暖簾がはためく → マテオが着替えて決めポーズ（done は終わったあと） */
    cutin: function (done) {
      var box = OT.el('div', { class: 'cutin' });
      var noren = OT.ui.pixelCanvas(240, 160, 'cutin-noren');
      var mateo = OT.ui.pixelCanvas(64, 80, 'cutin-mateo');
      var word = OT.el('div', { class: 'cutin-word', text: OT.t('night.open') });
      box.appendChild(noren);
      box.appendChild(mateo);
      box.appendChild(word);
      layer().appendChild(box);
      var t0 = performance.now(), nf = 0;
      var nctx = noren.getContext('2d'), mctx = mateo.getContext('2d');
      function step(now) {
        var t = (now - t0) / 1000;
        nctx.clearRect(0, 0, 240, 160);
        var im = OT.art.img('noren' + (Math.floor(t * 9) % 6));
        if (im && im.complete) nctx.drawImage(im, 0, 0);
        mctx.clearRect(0, 0, 64, 80);
        // 0〜0.6秒：ふだん着でくるり → 0.6秒〜：勝負服（法被）で決めポーズ
        if (t < 0.6) OT.sprites.drawPerson(mctx, 'mateo', 'spin', t, 32, 80, false, 8);
        else OT.sprites.drawPerson(mctx, 'mateo_happi', 'pose', t, 32, 80, false, 4);
        if (t > 0.6 && !box.classList.contains('dress')) { box.classList.add('dress'); OT.sfx.clack(1); }
        if (t < 2.1) requestAnimationFrame(step);
        else { box.classList.add('out'); setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 350); if (done) done(); }
      }
      requestAnimationFrame(step);
      OT.sfx.wrap();
    },

    /** 星3：お客さんの大写し「うまい！」 */
    closeup: function (key, line) {
      if (!key) return;
      var im = OT.sprites.closeup(key);
      var box = OT.el('div', { class: 'closeup' });
      var c = OT.ui.pixelCanvas(96, 96, 'closeup-face');
      box.appendChild(c);
      box.appendChild(OT.el('div', { class: 'closeup-line', text: line || OT.t('fx.umai') }));
      for (var k = 0; k < 8; k++) box.appendChild(OT.el('i', { class: 'spark', style: 'left:' + (10 + Math.random() * 80) + '%;top:' + (10 + Math.random() * 70) + '%;animation-delay:' + (k * 0.08) + 's' }));
      layer().appendChild(box);
      function draw() { var ctx = c.getContext('2d'); ctx.clearRect(0, 0, 96, 96); if (im.complete && im.naturalWidth) ctx.drawImage(im, 0, 0); }
      if (im.complete) draw(); else im.onload = draw;
      setTimeout(function () { box.classList.add('out'); }, 1300);
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 1700);
    },

    rankUp: function (name) { flashBanner('rank', OT.t('rank.up'), name, 2200); OT.sfx.happy(3); },
    nushi: function (name) { flashBanner('nushi', OT.t('fx.nushi'), name, 1600); OT.sfx.clack(3); },
    win: function () { flashBanner('win', OT.t('fx.win'), null, 1600); OT.sfx.happy(3); },
    celebrate: function () { var box = OT.el('div', { class: 'fx-confetti' }); confetti(box, 80); layer().appendChild(box); setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 4000); }
  };
})(window);
