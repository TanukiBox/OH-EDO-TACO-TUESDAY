/*
 * 多幸寿：タイトル・朝（仕入れ先を選ぶ）・結果の画面
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function st() { return OT.state.get(); }

  // ---------------------------------------------------------------
  // タイトル
  // ---------------------------------------------------------------
  var titleAnim = null;

  OT.title = {
    enter: function () {
      var root = OT.ui.screen('title');
      root.innerHTML = '';
      var noren = OT.ui.pixelCanvas(240, 160, 'title-noren');
      root.appendChild(OT.el('div', { class: 'title-top' }, [
        noren,
        OT.el('h1', { class: 'logo' }, [
          OT.el('span', { class: 'logo-en', text: OT.t('title.logo') }),
          OT.el('span', { class: 'logo-ja', text: '多幸寿' })
        ]),
        OT.el('p', { class: 'tagline', text: OT.t('title.tagline') })
      ]));
      var btns = OT.el('div', { class: 'title-btns' });
      var saved = OT.state.load();
      if (saved) {
        btns.appendChild(OT.button(OT.t('title.continue', { day: saved.day }), function () { OT.title.leave(); OT.flow.resume(); }, 'primary big'));
        btns.appendChild(OT.button(OT.t('title.newgame'), function () {
          if (global.confirm(OT.t('title.resetConfirm'))) { OT.title.leave(); OT.state.newGame(); OT.flow.morning(); }
        }, 'ghost'));
      } else {
        btns.appendChild(OT.button(OT.t('title.start'), function () { OT.title.leave(); OT.state.newGame(); OT.flow.morning(); }, 'primary big'));
      }
      root.appendChild(btns);
      var soundBtn = OT.button(OT.sound.muted ? OT.t('ui.soundOff') : OT.t('ui.soundOn'), function () {
        OT.sound.toggle();
        soundBtn.textContent = OT.sound.muted ? OT.t('ui.soundOff') : OT.t('ui.soundOn');
      }, 'small');
      var langBtn = OT.button(OT.t('ui.lang'), function () {
        var next = OT.i18n.lang === 'ja' ? 'en' : 'ja';
        OT.i18n.setLang(next);
        OT.store.set('lang', next);
        global.document.documentElement.lang = next;
        OT.title.leave();
        OT.title.enter();
      }, 'small');
      root.appendChild(OT.el('div', { class: 'title-foot' }, [soundBtn, langBtn, OT.el('span', { class: 'by', text: OT.t('title.by') })]));

      // 暖簾のはためき（開店カットインの絵を、タイトルでも流す）
      var ctx = noren.getContext('2d'), f = 0;
      function tick() {
        ctx.clearRect(0, 0, 240, 160);
        var im = OT.art.img('noren' + f);
        if (im && im.complete) ctx.drawImage(im, 0, 0);
        f = (f + 1) % 6;
      }
      tick();
      titleAnim = setInterval(tick, 120);
    },
    leave: function () { clearInterval(titleAnim); titleAnim = null; }
  };

  // ---------------------------------------------------------------
  // 朝：仕入れ先を選ぶ
  // ---------------------------------------------------------------
  OT.morning = {
    enter: function () {
      var s = st();
      s.phase = 'morning';
      OT.state.save();
      var root = OT.ui.screen('morning');
      root.innerHTML = '';
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '☀ ' + OT.t('morning.title') }));
      var tipKey = s.stock.tortilla <= 10 ? 'pon.morningLow' : 'pon.morning1';
      root.appendChild(OT.ui.pon(tipKey));

      var left = OT.CFG.MAX_GAMES_PER_DAY - s.gamesToday;
      root.appendChild(OT.el('p', { class: 'lead', text: left > 0 ? OT.t('morning.left', { n: left }) : OT.t('morning.done') }));

      var list = OT.el('div', { class: 'suppliers' });
      OT.CFG.SUPPLIERS.forEach(function (sup) {
        var soon = sup.soon || sup.chapter > OT.state.chapter();
        var blocked = sup.kind === 'game' && left <= 0;
        var card = OT.el('button', {
          class: 'sup ' + sup.kind + (soon ? ' soon' : '') + (blocked && !soon ? ' blocked' : ''),
          onclick: function () {
            if (soon || blocked) { OT.sfx.denied(); return; }
            OT.sfx.tap();
            OT.flow.supplier(sup);
          }
        }, [
          OT.el('span', { class: 'sup-kind', text: OT.t('morning.kind.' + sup.kind) }),
          OT.el('span', { class: 'sup-name', text: OT.t('sup.' + sup.id) }),
          OT.el('span', { class: 'sup-desc', text: soon ? OT.t('morning.soon') : OT.t('sup.' + sup.id + '.desc') })
        ]);
        list.appendChild(card);
      });
      root.appendChild(list);

      // いまの在庫
      var pantry = OT.el('div', { class: 'pantry' }, [OT.el('h3', { text: OT.t('morning.stockTitle') })]);
      var chips = OT.el('div', { class: 'chips' });
      Object.keys(OT.CFG.INGREDIENTS).forEach(function (id) {
        if (!s.seen[id]) return;
        var n = s.stock[id] || 0;
        var icon = OT.ui.pixelCanvas(24, 24, 'chip-icon');
        OT.art.drawIcon(icon, id);
        chips.appendChild(OT.el('span', { class: 'chip' + (n ? '' : ' zero') }, [icon, OT.el('span', { text: OT.ingName(id) + ' ' + n })]));
      });
      pantry.appendChild(chips);
      root.appendChild(pantry);

      root.appendChild(OT.el('div', { class: 'sticky-bottom' }, [
        OT.button('🏮 ' + OT.t('morning.toNight'), function () { OT.flow.night(); }, 'primary big')
      ]));
    }
  };

  // ---------------------------------------------------------------
  // 結果
  // ---------------------------------------------------------------
  OT.result = {
    enter: function () {
      var s = st(), r = s.lastResult;
      var root = OT.ui.screen('result');
      root.innerHTML = '';
      root.appendChild(OT.ui.hud());
      root.appendChild(OT.el('h2', { class: 'scr-title', text: '🏮 ' + OT.t('res.title', { n: r.day }) }));
      var bestName = r.best ? OT.tacoName(r.best) : r.bestIsOmakase ? OT.t('night.omakaseName') : OT.t('res.bestNone');
      var starsTxt = r.served ? r.avg.toFixed(1) + ' ' + '★'.repeat(Math.round(r.avg)) : '—';
      var rows = [
        [OT.t('res.sales'), OT.t('ui.money', { n: r.sales }), 'big'],
        [OT.t('res.served'), OT.t('res.servedVal', { n: r.served, a: r.angry })],
        [OT.t('res.stars'), starsTxt],
        [OT.t('res.satisfaction'), r.satisfaction + '%'],
        [OT.t('res.rep'), (r.rep >= 0 ? '+' : '') + r.rep + '  →  ' + s.rep, r.rep >= 0 ? 'up' : 'down'],
        [OT.t('res.best'), bestName],
        [OT.t('res.money'), OT.t('ui.money', { n: s.money })]
      ];
      var table = OT.el('div', { class: 'res-table' });
      rows.forEach(function (row) {
        table.appendChild(OT.el('div', { class: 'res-row ' + (row[2] || '') }, [
          OT.el('span', { text: row[0] }), OT.el('b', { text: row[1] })
        ]));
      });
      root.appendChild(table);
      var shareText = OT.t('share.text', { day: r.day, sales: r.sales, taco: bestName });
      root.appendChild(OT.el('div', { class: 'res-btns' }, [
        OT.button(OT.t('res.share'), function () { OT.shareOnX(shareText); }, 'x'),
        OT.button(OT.t('res.next'), function () { OT.flow.nextDay(); }, 'primary big')
      ]));
    }
  };
})(window);
