/**
 * Adaptive BGM — одна непрерывная петля track1, без смены кусков и кроссфейдов.
 * Нарастание угрозы → плавно: громкость слоя + открытие lowpass (больше «тела» мелодии).
 * Дубликатов источников нет — один BufferSource, loop=true.
 */
(function (global) {
    'use strict';

    const INTENSITY_SMOOTH = 0.016;
    const FILTER_MIN_HZ = 520;
    const FILTER_MAX_HZ = 19000;
    const LAYER_GAIN_MIN = 0.14;
    const LAYER_GAIN_MAX = 0.98;
    const MIX_TIME_CONST = 0.35;
    const START_FADE_SEC = 1.35;
    const DEATH_FADE_OUT_SEC = 2.1;
    const DEATH_RESTART_DELAY_MS = Math.ceil(DEATH_FADE_OUT_SEC * 1000) + 200;

    let audioCtx = null;
    let masterGainParent = null;
    let trackGainNode = null;
    let toneFilter = null;
    let layerGain = null;
    let mainSource = null;

    let buffersByFile = {};
    let manifest = null;
    let assetsBase = '';
    let loaded = false;
    let playing = false;
    let tickTimer = null;
    let deathMode = false;

    let globalVolume = 0.5;
    let bgmIntensity = 0.35;
    let currentIntensity = 0.15;
    let targetIntensity = 0.15;

    function stopMainSource() {
        if (!mainSource) return;
        try {
            mainSource.onended = null;
            mainSource.stop(0);
        } catch (e) {}
        try {
            mainSource.disconnect();
        } catch (e2) {}
        mainSource = null;
    }

    function disconnectMixChain() {
        stopMainSource();
        try {
            if (toneFilter) toneFilter.disconnect();
        } catch (e) {}
        try {
            if (layerGain) layerGain.disconnect();
        } catch (e2) {}
        toneFilter = null;
        layerGain = null;
    }

    function applyDynamicMix() {
        if (!audioCtx || !toneFilter || !layerGain || deathMode) return;
        const x = Math.max(0, Math.min(1, currentIntensity));
        const t = audioCtx.currentTime;
        const shaped = Math.pow(x, 1.08);
        const freq = FILTER_MIN_HZ + shaped * (FILTER_MAX_HZ - FILTER_MIN_HZ);
        const lg = LAYER_GAIN_MIN + shaped * (LAYER_GAIN_MAX - LAYER_GAIN_MIN);
        try {
            toneFilter.frequency.setTargetAtTime(freq, t, MIX_TIME_CONST);
            layerGain.gain.setTargetAtTime(lg, t, MIX_TIME_CONST);
        } catch (e) {
            toneFilter.frequency.value = freq;
            layerGain.gain.value = lg;
        }
    }

    function tick() {
        if (!playing || !audioCtx || deathMode) return;
        targetIntensity = Math.max(0, Math.min(1, targetIntensity));
        currentIntensity += (targetIntensity - currentIntensity) * INTENSITY_SMOOTH;
        applyDynamicMix();
    }

    function startLoopInternal() {
        if (!audioCtx || !trackGainNode) return;
        const buf = buffersByFile[0];
        if (!buf || buf.duration <= 0) return;

        disconnectMixChain();

        toneFilter = audioCtx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.Q.value = 0.72;
        toneFilter.frequency.value = FILTER_MIN_HZ;

        layerGain = audioCtx.createGain();
        layerGain.gain.value = 0;

        mainSource = audioCtx.createBufferSource();
        mainSource.buffer = buf;
        mainSource.loop = true;
        mainSource.loopStart = 0;
        mainSource.loopEnd = buf.duration;

        mainSource.connect(toneFilter);
        toneFilter.connect(layerGain);
        layerGain.connect(trackGainNode);

        const t0 = audioCtx.currentTime + 0.06;
        try {
            mainSource.start(t0, 0);
        } catch (e) {
            return;
        }
        layerGain.gain.setValueAtTime(0, t0);
        layerGain.gain.linearRampToValueAtTime(LAYER_GAIN_MIN, t0 + START_FADE_SEC);
        setTimeout(function () {
            if (!layerGain || !audioCtx || deathMode) return;
            applyDynamicMix();
        }, Math.ceil(START_FADE_SEC * 1000) + 50);
    }

    const AdaptiveBGM = {
        isLoaded: function () {
            return loaded;
        },

        init: function (ctx, parentGain, base, vol) {
            if (audioCtx && audioCtx !== ctx) {
                try {
                    if (tickTimer) clearInterval(tickTimer);
                    tickTimer = null;
                } catch (e1) {}
                disconnectMixChain();
                try {
                    if (trackGainNode) trackGainNode.disconnect();
                } catch (e3) {}
                trackGainNode = null;
                playing = false;
            }
            audioCtx = ctx;
            masterGainParent = parentGain;
            assetsBase = base || '';
            globalVolume = vol != null ? vol : 0.5;
        },

        loadManifestAndBuffers: async function () {
            try {
                const res = await fetch(assetsBase + '/audio/music-segments.json');
                if (res.ok) manifest = await res.json();
                else manifest = {};
            } catch (e) {
                manifest = {};
            }
            buffersByFile = {};
            const urls = [assetsBase + '/audio/track1.ogg', assetsBase + '/audio/track1.mp3'];
            let decoded = null;
            for (const u of urls) {
                try {
                    const r = await fetch(u);
                    if (!r.ok) continue;
                    const ab = await r.arrayBuffer();
                    decoded = await audioCtx.decodeAudioData(ab);
                    break;
                } catch (e) { /* next */ }
            }
            if (!decoded) return false;
            buffersByFile[0] = decoded;
            buffersByFile['track1.mp3'] = decoded;
            buffersByFile['track1.ogg'] = decoded;
            loaded = true;
            return true;
        },

        start: function () {
            if (!loaded || !audioCtx) return;
            if (tickTimer) clearInterval(tickTimer);
            deathMode = false;

            if (!trackGainNode) {
                trackGainNode = audioCtx.createGain();
                trackGainNode.gain.value = bgmIntensity * globalVolume;
                trackGainNode.connect(masterGainParent);
            }

            playing = true;
            startLoopInternal();
            applyDynamicMix();
            tickTimer = setInterval(tick, 180);
        },

        stop: function () {
            playing = false;
            if (tickTimer) {
                clearInterval(tickTimer);
                tickTimer = null;
            }
            disconnectMixChain();
        },

        setIntensity: function (v) {
            targetIntensity = Math.max(0, Math.min(1, v));
        },

        setBgmIntensity: function (v) {
            bgmIntensity = v;
            if (trackGainNode && audioCtx) {
                const t = audioCtx.currentTime;
                trackGainNode.gain.setTargetAtTime(bgmIntensity * globalVolume, t, 0.55);
            }
        },

        setGlobalVolume: function (v) {
            globalVolume = v;
            if (trackGainNode && audioCtx) {
                trackGainNode.gain.setTargetAtTime(bgmIntensity * globalVolume, audioCtx.currentTime, 0.12);
            }
        },

        setPauseDuck: function (duck) {
            const f = duck ? 0.25 : 1;
            if (trackGainNode && audioCtx) {
                trackGainNode.gain.setTargetAtTime(bgmIntensity * globalVolume * f, audioCtx.currentTime, 0.28);
            }
        },

        onPlayerDeath: function () {
            if (!loaded || !audioCtx || !trackGainNode) return;
            deathMode = true;
            disconnectMixChain();
            const t = audioCtx.currentTime;
            try {
                trackGainNode.gain.cancelScheduledValues(t);
                trackGainNode.gain.setValueAtTime(trackGainNode.gain.value, t);
                trackGainNode.gain.linearRampToValueAtTime(0, t + DEATH_FADE_OUT_SEC);
            } catch (e) {}
            const self = AdaptiveBGM;
            setTimeout(function () {
                if (!audioCtx) return;
                targetIntensity = 0.12;
                currentIntensity = 0.1;
                deathMode = false;
                playing = true;
                trackGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                trackGainNode.gain.linearRampToValueAtTime(bgmIntensity * globalVolume * 0.45, audioCtx.currentTime + 0.5);
                self.start();
            }, DEATH_RESTART_DELAY_MS);
        },

        getManifest: function () {
            return manifest;
        }
    };

    global.AdaptiveBGM = AdaptiveBGM;
})(typeof window !== 'undefined' ? window : globalThis);
