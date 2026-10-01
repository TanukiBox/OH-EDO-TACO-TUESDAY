/*
 * 多幸寿：画面づくりの共通部品（ことば・画面の切り替え・上の帯・ポン吉のひとこと）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};
  var doc = global.document;

  /** ことば。'|' で区切られたセリフは、ランダムに1つ */
  OT.t = function (key, params) { return OT.i18n.t(key, params); };
  OT.say = function (key, params) {
    var list = OT.t(key, params).split('|');
    return list[Math.floor(Math.random() * list.length)];
  };
  OT.ingName = function (id) { return OT.t('ing.' + id); };
  /** タコスの名前。'su:食材' は素タコス、variant は部位 */
  OT.tacoName = function (id, variant) {
    if (!id) return OT.t('night.omakaseName');
    if (id.slice(0, 3) === 'su:') return OT.t('taco.su', { name: OT.ingName(id.slice(3)) });
    var n = OT.t('taco.' + id);
    if (variant) n += OT.t('taco.variant', { part: OT.t('part.' + variant) });
    return n;
  };
  OT.seasonMark = { spring: '🌸', summer: '🎐', autumn: '🍁', winter: '❄' };

  /** 要素を作る：el('div', { class: 'x', text: '...', onclick: fn }, [子...]) */
  OT.el = function (tag, attrs, kids) {
    var e = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.setAttribute('style', v);
      else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return e;
  };

  /** ボタン（押すと音が鳴る） */
  OT.button = function (label, onPress, cls) {
    return OT.el('button', {
      class: 'btn ' + (cls || ''), text: label,
      onclick: function (e) { e.preventDefault(); if (this.disabled) return; OT.sfx.tap(); onPress && onPress(e); }
    });
  };

  var current = null;
  OT.ui = {
    screen: function (id) {
      var all = doc.querySelectorAll('.screen');
      for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i].id === 'scr-' + id);
      current = id;
      if (OT.tut) OT.tut.clear();   // 画面が変わったら案内の吹き出しを消す
      return doc.getElementById('scr-' + id);
    },
    current: function () { return current; },

    /** 上の帯：日数・所持金・評判 */
    hud: function (extra) {
      var s = OT.state.get();
      return OT.el('div', { class: 'hud' }, [
        OT.el('span', { class: 'hud-day', text: OT.seasonMark[OT.state.season()] + ' ' + OT.t('ui.day', { n: s.day }) }),
        OT.el('span', { class: 'hud-money', text: '💰 ' + OT.t('ui.money', { n: s.money }) }),
        OT.el('span', { class: 'hud-rep', text: '⭐ ' + OT.t('ui.rep', { n: s.rep }) }),
        extra || null
      ]);
    },

    /** ポン吉の顔（Blender で作った会話の顔。読みこめていなければ絵文字） */
    ponFace: function (cls, happy) {
      var c = OT.ui.pixelCanvas(48, 48, 'pon-face-img ' + (cls || ''));
      if (OT.sprites && OT.sprites.drawFace(c, 'pon', happy)) return c;
      return OT.el('span', { class: cls || '', text: '🦝' });
    },

    /** ポン吉のひとこと */
    pon: function (key, params) {
      return OT.el('div', { class: 'pon' }, [
        OT.el('div', { class: 'pon-face' }, [OT.ui.ponFace()]),
        OT.el('div', { class: 'pon-text' }, [
          OT.el('b', { text: OT.t('pon.name') }),
          OT.el('span', { text: OT.t(key, params) })
        ])
      ]);
    },

    /** 画面の上にしばらく出る短いお知らせ */
    toast: function (msg, cls, ms) {
      var box = doc.getElementById(/tip/.test(cls || '') ? 'tipbox' : 'toast');
      var e = OT.el('div', { class: 'toast ' + (cls || ''), text: msg });
      var life = ms || (/long/.test(cls || '') ? 4200 : 1300);
      box.appendChild(e);
      setTimeout(function () { e.classList.add('out'); }, life);
      setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, life + 400);
    },

    /** ドット絵用のキャンバス（width×height ドット。CSS で拡大してもぼやけない） */
    pixelCanvas: function (w, h, cls) {
      var c = OT.el('canvas', { class: 'pix ' + (cls || ''), width: w, height: h });
      var ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      return c;
    }
  };
})(window);
