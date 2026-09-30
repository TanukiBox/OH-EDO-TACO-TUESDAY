/*
 * 多幸寿：BGM（ブラウザの中で合成。音声ファイルは使わない）
 *   江戸の五音音階（三味線・笛・太鼓）× メキシコのリズム（クラーベ・ギロ）
 *   曲：day（昼・朝の仕入れ）/ night（夜の営業）/ battle（料理対決）/ ending（エンディング）
 */
(function (global) {
  'use strict';
  var OT = global.OT = global.OT || {};

  // 音の高さ（D4 = 293.66 を基準に、半音の数で）
  function hz(semi) { return 293.66 * Math.pow(2, semi / 12); }
  // 陽音階（D E G A B）と都節（D Eb G A Bb）
  var YO = [0, 2, 5, 7, 9, 12, 14, 17, 19, 21, 24];
  var MIYAKO = [0, 1, 5, 7, 8, 12, 13, 17, 19, 20, 24];

  // 曲：tempo（1分の拍）、scale、mel（旋律：音階の番号。-1 = 休み）、bass、drums（t=太鼓, c=クラーベ, g=ギロ, s=シェイカー）
  var SONGS = {
    day: { tempo: 88, scale: YO, lead: 'flute',
      mel: [4, -1, 5, -1, 6, -1, 5, 4, 3, -1, -1, -1, 2, -1, 3, -1, 4, -1, 6, -1, 7, -1, 6, 5, 4, -1, -1, -1, -1, -1, -1, -1],
      bass: [0, -1, -1, -1, 3, -1, -1, -1, 2, -1, -1, -1, 3, -1, -1, -1],
      drums: 's.s.s.s.s.s.s.s.' },
    night: { tempo: 112, scale: YO, lead: 'shamisen',
      mel: [5, 5, 7, -1, 6, 5, 4, -1, 5, -1, 3, 4, 5, -1, -1, -1, 7, 7, 8, -1, 7, 6, 5, -1, 4, 5, 6, 5, 4, -1, 3, -1],
      bass: [0, -1, 0, -1, 3, -1, 3, -1, 2, -1, 2, -1, 3, -1, 4, -1],
      drums: 't.c.g.ct.c.gtc.g' },
    battle: { tempo: 144, scale: MIYAKO, lead: 'shamisen',
      mel: [5, -1, 6, 5, 7, -1, 6, 5, 4, -1, 5, -1, 3, -1, 4, -1, 5, 6, 7, 8, 7, -1, 6, -1, 5, 4, 3, 4, 5, -1, -1, -1],
      bass: [0, 0, -1, 0, 1, -1, 1, -1, 0, 0, -1, 0, 3, -1, 2, -1],
      drums: 'tct.tctgtct.tcgg' },
    ending: { tempo: 104, scale: YO, lead: 'koto',
      mel: [7, -1, 8, 9, 10, -1, 9, 8, 7, -1, 5, -1, 6, -1, 7, -1, 5, -1, 6, 7, 8, -1, 7, 6, 5, -1, 4, -1, 5, -1, -1, -1],
      bass: [0, -1, 3, -1, 2, -1, 4, -1, 0, -1, 3, -1, 2, -1, 3, -1],
      drums: 't.c.gsc.t.c.gsc' }
  };

  var S = function () { return OT.sound; };
  var cur = null, timer = null, nextT = 0, step = 0;

  function note(kind, f, t, len) {
    var o = { f: f, at: t, bus: 'music', dur: len };
    if (kind === 'shamisen') { o.vol = 0.07; o.osc = [{ type: 'sawtooth' }, { type: 'triangle', mul: 2, gain: 0.5 }]; o.env = { a: 0.002, d: 0.18, s: 0.0, r: 0.12 }; o.filter = { f: 3200, f1: 700, t: 0.2, q: 2 }; o.reverb = 0.15; }
    else if (kind === 'koto') { o.vol = 0.08; o.osc = [{ type: 'triangle' }, { type: 'sine', mul: 3, gain: 0.25 }]; o.env = { a: 0.003, d: 0.4, s: 0.1, r: 0.3 }; o.reverb = 0.25; }
    else if (kind === 'flute') { o.vol = 0.05; o.osc = [{ type: 'sine' }, { type: 'triangle', gain: 0.3 }]; o.env = { a: 0.06, d: 0.2, s: 0.7, r: 0.2 }; o.vib = { rate: 5, depth: 14, delay: 0.12 }; o.reverb = 0.35; o.echo = 0.15; }
    else if (kind === 'bass') { o.vol = 0.09; o.osc = [{ type: 'triangle' }]; o.env = { a: 0.005, d: 0.25, s: 0.3, r: 0.15 }; o.filter = { f: 900 }; }
    S().synth(o);
  }

  function drum(ch, t) {
    var s = S();
    if (ch === 't') { s.synth({ f: 90, f1: 45, glide: 0.18, dur: 0.18, vol: 0.2, at: t, bus: 'music', osc: [{ type: 'sine' }], env: { a: 0.002, d: 0.2, s: 0, r: 0.1 } }); s.noise({ at: t, dur: 0.06, vol: 0.05, f0: 400, f1: 120, bus: 'music' }); }
    else if (ch === 'c') s.synth({ f: 2100, dur: 0.03, vol: 0.06, at: t, bus: 'music', osc: [{ type: 'square' }], env: { a: 0.001, d: 0.04, s: 0, r: 0.03 }, filter: { type: 'bandpass', f: 2400, q: 4 } });
    else if (ch === 'g') s.noise({ at: t, dur: 0.12, vol: 0.035, f0: 3500, f1: 2500, q: 3, rate: 0.6, bus: 'music' });
    else if (ch === 's') s.noise({ at: t, dur: 0.05, vol: 0.02, f0: 7000, f1: 6000, q: 1, bus: 'music' });
  }

  function schedule() {
    var s = S(), now = s.now();
    if (!cur || now === null || s.muted || !OT.bgm.on()) return;
    var song = SONGS[cur], spb = 60 / song.tempo / 2;   // 1ステップ = 8分音符
    if (nextT < now) nextT = now + 0.05;
    while (nextT < now + 0.4) {
      var m = song.mel[step % song.mel.length];
      if (m >= 0) note(song.lead, hz(song.scale[m]), nextT, song.lead === 'flute' ? spb * 1.8 : spb * 0.9);
      if (step % 2 === 0) {
        var b = song.bass[(step / 2) % song.bass.length];
        if (b >= 0) note('bass', hz(song.scale[b]) / 4, nextT, spb * 1.6);
      }
      var d = song.drums.charAt(step % song.drums.length);
      if (d !== '.') drum(d, nextT);
      nextT += spb;
      step++;
    }
  }

  OT.bgm = {
    on: function () { return OT.store.get('bgm', true); },
    toggle: function () { var v = !OT.bgm.on(); OT.store.set('bgm', v); if (!v) OT.bgm.stop(); else if (cur) OT.bgm.play(cur, true); return v; },
    play: function (name, force) {
      if (cur === name && timer && !force) return;
      cur = name; step = 0; nextT = 0;
      if (!timer) timer = setInterval(schedule, 100);
    },
    stop: function () { cur = null; }
  };
})(window);
