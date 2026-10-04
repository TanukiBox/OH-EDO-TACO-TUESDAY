/*
 * 多幸寿：効果音（ブラウザの中で合成する。音声ファイルは使わない）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  function S() { return OT.sound; }

  OT.sfx = {
    tap: function () { S().tone({ type: 'triangle', f0: 880, f1: 660, dur: 0.05, vol: 0.12 }); },
    place: function () {
      S().noise({ dur: 0.07, vol: 0.18, f0: 1800, f1: 600, q: 1.2 });
      S().tone({ type: 'sine', f0: 520, f1: 380, dur: 0.07, vol: 0.08 });
    },
    denied: function () { S().tone({ type: 'square', f0: 180, f1: 140, dur: 0.12, vol: 0.08 }); },
    // 拍子木（開店・閉店の合図）
    clack: function (n) {
      for (var i = 0; i < (n || 2); i++) {
        S().synth({ f: 1250, dur: 0.03, vol: 0.2, osc: [{ type: 'square' }, { type: 'triangle', mul: 2.1 }],
          env: { a: 0.001, d: 0.05, s: 0, r: 0.05 }, filter: { type: 'bandpass', f: 2200, q: 3 }, reverb: 0.25, delay: i * 0.22 });
      }
    },
    // 競り落とし（手を打つ音＋「よしっ」）
    buy: function () {
      S().noise({ dur: 0.06, vol: 0.3, f0: 2500, f1: 900, q: 0.8 });
      S().synth({ f: 660, f1: 990, dur: 0.12, vol: 0.12, osc: [{ type: 'triangle' }], echo: 0.15, delay: 0.04 });
    },
    lost: function () { S().synth({ f: 330, f1: 220, dur: 0.25, vol: 0.1, osc: [{ type: 'sawtooth' }], filter: { f: 900 } }); },
    // 包む（布ずれ）
    wrap: function () {
      S().noise({ dur: 0.22, vol: 0.14, f0: 700, f1: 2400, q: 0.7 });
      S().tone({ type: 'sine', f0: 300, f1: 520, dur: 0.18, vol: 0.06, delay: 0.05 });
    },
    // 会計（小銭）
    coin: function () {
      [1568, 2093].forEach(function (f, i) {
        S().synth({ f: f, dur: 0.06, vol: 0.09, osc: [{ type: 'sine' }, { type: 'sine', mul: 2.7, gain: 0.4 }],
          env: { a: 0.002, d: 0.2, s: 0, r: 0.2 }, reverb: 0.2, delay: i * 0.07 });
      });
    },
    // 星1〜5（星5は高い音まで）
    happy: function (stars) {
      var notes = [[392], [392, 523], [523, 659], [523, 659, 784], [523, 659, 784, 1047, 1319]][Math.max(1, Math.min(5, stars)) - 1];
      notes.forEach(function (f, i) {
        S().synth({ f: f, dur: 0.09, vol: 0.09, osc: [{ type: 'square', gain: 0.5 }, { type: 'triangle' }],
          env: { a: 0.003, d: 0.08, s: 0.4, r: 0.08 }, filter: { f: 3000 }, delay: i * 0.07, reverb: 0.15 });
      });
    },
    angry: function () {
      S().synth({ f: 200, f1: 120, dur: 0.35, vol: 0.12, osc: [{ type: 'sawtooth', detune: -10 }, { type: 'sawtooth', detune: 10 }], filter: { f: 700 } });
    },
    arrive: function () { S().tone({ type: 'sine', f0: 988, dur: 0.08, vol: 0.07 }); S().tone({ type: 'sine', f0: 784, dur: 0.12, vol: 0.07, delay: 0.09 }); },
    // 焼き場：じゅう（網）・しゅわしゅわ（油）・ぼうっ（藁の炎）・ぱたん（裏返す）
    sizzle: function (soft) { S().noise({ dur: soft ? 0.35 : 0.5, vol: soft ? 0.035 : 0.09, f0: 5200, f1: 3600, q: 0.6 }); },
    oil: function (soft) {
      for (var i = 0; i < (soft ? 3 : 6); i++) S().noise({ dur: 0.03, vol: soft ? 0.03 : 0.06, f0: 2600 + Math.random() * 1800, f1: 1800, q: 2, delay: i * 0.06 + Math.random() * 0.03 });
    },
    flame: function () {
      S().noise({ dur: 0.5, vol: 0.14, f0: 300, f1: 900, q: 0.5 });
      S().noise({ dur: 0.4, vol: 0.05, f0: 4000, f1: 2500, q: 0.8, delay: 0.1 });
    },
    flip: function () {
      S().noise({ dur: 0.05, vol: 0.16, f0: 1400, f1: 500, q: 1 });
      S().tone({ type: 'triangle', f0: 300, f1: 520, dur: 0.07, vol: 0.07 });
      S().noise({ dur: 0.3, vol: 0.07, f0: 5200, f1: 3800, q: 0.6, delay: 0.05 });
    },
    // 盛り付け：ぱらぱら（撒く）・とろり（回しかける）
    sprinkle: function () { S().noise({ dur: 0.04, vol: 0.07, f0: 6000 + Math.random() * 2000, f1: 4000, q: 3 }); },
    pour: function () { S().tone({ type: 'sine', f0: 240 + Math.random() * 60, f1: 180, dur: 0.12, vol: 0.04 }); },
    // 魚河岸の競り：鐘・競り人の掛け声・箱が暴れる・重い箱・猫・箱を開ける・大当たり・からかう笑い
    bell: function () {
      [0, 0.5].forEach(function (d) {
        S().synth({ f: 660, dur: 0.5, vol: 0.12, osc: [{ type: 'sine' }, { type: 'sine', mul: 2.76, gain: 0.5 }, { type: 'sine', mul: 5.4, gain: 0.25 }],
          env: { a: 0.002, d: 0.9, s: 0, r: 0.6 }, reverb: 0.4, delay: d });
      });
    },
    call: function (soft) {   // 「せーの、えいっ！」のような掛け声（声らしく、少し上がって下がる）
      var f = 210 + Math.random() * 40;
      S().synth({ f: f, f1: f * (soft ? 0.85 : 1.3), dur: soft ? 0.12 : 0.2, vol: soft ? 0.05 : 0.09, osc: [{ type: 'sawtooth', detune: -6 }, { type: 'square', detune: 6, gain: 0.4 }],
        env: { a: 0.01, d: 0.1, s: 0.6, r: 0.08 }, filter: { type: 'bandpass', f: 900, q: 2.5 } });
    },
    gata: function () {   // ガタッ
      S().noise({ dur: 0.08, vol: 0.3, f0: 900, f1: 300, q: 1.5 });
      S().tone({ type: 'square', f0: 120, f1: 70, dur: 0.1, vol: 0.12 });
      S().noise({ dur: 0.06, vol: 0.2, f0: 1400, f1: 500, q: 2, delay: 0.09 });
    },
    thud: function () {   // ずしり
      S().tone({ type: 'sine', f0: 110, f1: 45, dur: 0.25, vol: 0.2 });
      S().noise({ dur: 0.1, vol: 0.15, f0: 600, f1: 150, q: 1 });
    },
    meow: function () {   // にゃあ
      S().synth({ f: 620, f1: 900, dur: 0.16, vol: 0.07, osc: [{ type: 'triangle' }, { type: 'sine', mul: 2, gain: 0.3 }], env: { a: 0.02, d: 0.1, s: 0.7, r: 0.1 }, filter: { type: 'bandpass', f: 1400, q: 1.5 } });
      S().synth({ f: 900, f1: 520, dur: 0.22, vol: 0.06, osc: [{ type: 'triangle' }], env: { a: 0.01, d: 0.15, s: 0.5, r: 0.12 }, filter: { type: 'bandpass', f: 1200, q: 1.5 }, delay: 0.15 });
    },
    open: function () {   // ふたを開ける（木がきしんで、ぱかっ）
      S().noise({ dur: 0.18, vol: 0.12, f0: 500, f1: 1800, q: 4 });
      S().noise({ dur: 0.05, vol: 0.22, f0: 2200, f1: 900, q: 1, delay: 0.17 });
    },
    laugh: function () {  // わっはっは
      [0, 0.14, 0.28].forEach(function (d, i) {
        S().synth({ f: 260 - i * 15, f1: 220 - i * 15, dur: 0.1, vol: 0.07, osc: [{ type: 'sawtooth' }], env: { a: 0.01, d: 0.06, s: 0.4, r: 0.05 }, filter: { type: 'bandpass', f: 800, q: 2 }, delay: d });
      });
    },
    jackpot: function () {   // 大当たり：太鼓と、上がっていく音と、長い和音
      S().tone({ type: 'sine', f0: 90, f1: 40, dur: 0.5, vol: 0.3 });
      S().noise({ dur: 0.2, vol: 0.2, f0: 300, f1: 80, q: 0.8 });
      [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) {
        S().synth({ f: f, dur: 0.12, vol: 0.08, osc: [{ type: 'square', gain: 0.5 }, { type: 'triangle' }], env: { a: 0.003, d: 0.1, s: 0.5, r: 0.1 }, delay: 0.35 + i * 0.08, reverb: 0.2 });
      });
      [523, 659, 784].forEach(function (f) {
        S().synth({ f: f, dur: 1.2, vol: 0.06, osc: [{ type: 'triangle' }, { type: 'sine', mul: 2, gain: 0.3 }], env: { a: 0.02, d: 0.4, s: 0.6, r: 0.6 }, delay: 0.85, reverb: 0.35 });
      });
    },
    tick: function () { S().tone({ type: 'square', f0: 1200, dur: 0.03, vol: 0.05 }); },
    // 椀を混ぜる（木の椀が盆の上をすべって、コトッ）
    shuffle: function () {
      S().noise({ dur: 0.07, vol: 0.1, f0: 1100, f1: 500, q: 1.4 });
      S().tone({ type: 'sine', f0: 330 + Math.random() * 60, f1: 250, dur: 0.05, vol: 0.06, delay: 0.05 });
    },
    // 瓦版をめくる（紙がかさっ、ぱらっ）
    paper: function () {
      S().noise({ dur: 0.18, vol: 0.09, f0: 2600, f1: 6200, q: 0.5 });
      S().noise({ dur: 0.12, vol: 0.07, f0: 5200, f1: 3000, q: 0.6, delay: 0.16 });
    },
    // 改装の大工仕事（トン・テン・カン）
    hammer: function () {
      [620, 820, 1040].forEach(function (f, i) {
        S().synth({ f: f, dur: 0.04, vol: 0.16, osc: [{ type: 'square' }, { type: 'triangle', mul: 1.9 }],
          env: { a: 0.001, d: 0.08, s: 0, r: 0.08 }, filter: { type: 'bandpass', f: f * 2, q: 2.5 }, reverb: 0.3, delay: i * 0.17 });
      });
    },
    // 高級な一品が売れた（きらり）
    sparkle: function () {
      [1319, 1760, 2349, 3136].forEach(function (f, i) {
        S().synth({ f: f, dur: 0.05, vol: 0.06, osc: [{ type: 'sine' }], env: { a: 0.002, d: 0.25, s: 0, r: 0.25 }, reverb: 0.35, delay: i * 0.06 });
      });
    }
  };
})(window);
