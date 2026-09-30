/*
 * 多幸寿：エンディング（上様の御触れ → ハッピー・タコ・チューズデー）
 *   エンディングのあとも、屋台は営業を続けられる。
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  var anim = null;

  OT.ending = {
    enter: function () {
      var s = OT.state.get();
      s.flags.cleared = 1;
      OT.state.save();
      var root = OT.ui.screen('ending');
      root.innerHTML = '';
      var noren = OT.ui.pixelCanvas(240, 160, 'title-noren');
      var taco = OT.ui.pixelCanvas(128, 128, 'ending-taco');
      var tctx = taco.getContext('2d');
      OT.art.drawSkin(tctx, 'real_tortilla', 0);
      OT.art.drawToppings(tctx, OT.CFG.TACOS.tenka.need, 0);
      root.appendChild(OT.el('div', { class: 'ending' }, [
        noren,
        OT.el('h1', { class: 'ending-title', text: OT.t('ending.title') }),
        OT.el('p', { class: 'ending-sub', text: OT.t('ending.sub') }),
        taco,
        OT.el('p', { class: 'ending-stats', text: OT.t('ending.stats', { days: s.day, served: s.totals.served }) }),
        OT.el('div', { class: 'res-btns' }, [
          OT.button(OT.t('res.share'), function () { OT.shareOnX(OT.t('ending.share')); }, 'x'),
          OT.button(OT.t('ending.continue'), function () { OT.ending.leave(); OT.flow.nextDay(); }, 'primary big')
        ])
      ]));
      var ctx = noren.getContext('2d'), f = 0;
      function tick() { ctx.clearRect(0, 0, 240, 160); var im = OT.art.img('noren' + f); if (im && im.complete) ctx.drawImage(im, 0, 0); f = (f + 1) % 6; }
      tick();
      anim = setInterval(tick, 120);
      OT.sfx.happy(3);
      setTimeout(function () { OT.sfx.happy(3); }, 450);
      OT.fx.celebrate();
      OT.bgm.play('ending');
    },
    leave: function () { clearInterval(anim); anim = null; }
  };
})(window);
