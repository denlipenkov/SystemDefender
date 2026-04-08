/**
 * Offline analyzer: decodes ./assets/audio/track*.mp3 (or .ogg), computes
 * RMS / spectral centroid / energy per time window, classifies calm|mid|intense,
 * merges segments, writes assets/audio/music-segments.json
 *
 * Usage: node tools/analyze-music-segments.mjs
 * Requires: npm install audio-decode (devDependency)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import decode from 'audio-decode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const OUT_JSON = path.join(AUDIO_DIR, 'music-segments.json');

const WINDOW_SEC = 0.75;
const HOP_SEC = 0.25;
const MIN_SEGMENT_SEC = 2.5;
const FFT_SIZE = 2048;

/** In-place radix-2 FFT, x is Float64Array length n, real/imag interleaved or separate - use complex as [re, im] pairs */
function fft_inplace(re, im) {
    const n = re.length;
    let j = 0;
    for (let i = 1; i < n; i++) {
        let bit = n >>> 1;
        for (; j & bit; bit >>>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            let t = re[i]; re[i] = re[j]; re[j] = t;
            t = im[i]; im[i] = im[j]; im[j] = t;
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        const wlenRe = Math.cos(ang);
        const wlenIm = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let wRe = 1, wIm = 0;
            for (let j = 0; j < len / 2; j++) {
                const k = i + j + len / 2;
                const tre = re[k] * wRe - im[k] * wIm;
                const tim = re[k] * wIm + im[k] * wRe;
                re[k] = re[i + j] - tre;
                im[k] = im[i + j] - tim;
                re[i + j] += tre;
                im[i + j] += tim;
                const nwRe = wRe * wlenRe - wIm * wlenIm;
                const nwIm = wRe * wlenIm + wIm * wlenRe;
                wRe = nwRe; wIm = nwIm;
            }
        }
    }
}

function nextPow2(n) {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
}

function hann(n) {
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    return w;
}

function spectralCentroidRmsEnergy(floatMono, sr, start, winLen) {
    const end = Math.min(start + winLen, floatMono.length);
    const n = end - start;
    let sumSq = 0;
    for (let i = start; i < end; i++) sumSq += floatMono[i] * floatMono[i];
    const rms = Math.sqrt(sumSq / Math.max(1, n));
    const energy = sumSq / Math.max(1, n);

    const fftN = Math.min(FFT_SIZE, nextPow2(n));
    if (fftN < 64) return { rms, centroid: 1000, energy };

    const re = new Float64Array(fftN);
    const im = new Float64Array(fftN);
    const h = hann(fftN);
    const off = start + Math.floor((n - fftN) / 2);
    for (let i = 0; i < fftN; i++) {
        const s = off + i < floatMono.length ? floatMono[off + i] : 0;
        re[i] = s * h[i];
    }
    fft_inplace(re, im);

    let num = 0, den = 0;
    const nyq = fftN / 2;
    for (let k = 1; k < nyq; k++) {
        const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        const freq = (k * sr) / fftN;
        num += freq * mag;
        den += mag;
    }
    const centroid = den > 1e-12 ? num / den : 0;
    return { rms, centroid, energy };
}

function toMono(audio) {
    const ch = audio.channelData;
    if (ch.length === 1) return Float32Array.from(ch[0]);
    const L = ch[0];
    const R = ch[1] || ch[0];
    const out = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) out[i] = 0.5 * (L[i] + R[i]);
    return out;
}

function analyzeTrack(floatMono, sr, fileName) {
    const dur = floatMono.length / sr;
    const winSamps = Math.max(256, Math.floor(WINDOW_SEC * sr));
    const hopSamps = Math.max(64, Math.floor(HOP_SEC * sr));
    const windows = [];

    for (let start = 0; start < floatMono.length; start += hopSamps) {
        const t0 = start / sr;
        const { rms, centroid, energy } = spectralCentroidRmsEnergy(floatMono, sr, start, winSamps);
        windows.push({ t0, rms, centroid, energy });
        if (start + winSamps >= floatMono.length) break;
    }
    if (windows.length === 0) return { fileName, duration: dur, segments: [], windows: [] };

    const rmsArr = windows.map(w => w.rms);
    const cenArr = windows.map(w => w.centroid);
    const rMin = Math.min(...rmsArr), rMax = Math.max(...rmsArr);
    const cMin = Math.min(...cenArr), cMax = Math.max(...cenArr);
    const rSpan = rMax - rMin || 1;
    const cSpan = cMax - cMin || 1;

    for (const w of windows) {
        const rN = (w.rms - rMin) / rSpan;
        const cN = (w.centroid - cMin) / cSpan;
        const eN = Math.min(1, w.energy / (rSpan * rSpan * 4 + 1e-12));
        w.score = 0.45 * rN + 0.35 * cN + 0.2 * eN;
    }
    const scores = windows.map(w => w.score).sort((a, b) => a - b);
    const q1 = scores[Math.floor(scores.length * 0.33)] ?? scores[0];
    const q2 = scores[Math.floor(scores.length * 0.66)] ?? scores[scores.length - 1];

    for (const w of windows) {
        if (w.score < q1) w.type = 'calm';
        else if (w.score < q2) w.type = 'mid';
        else w.type = 'intense';
    }

    const segments = [];
    let segStart = windows[0].t0;
    let curType = windows[0].type;
    let rmsSum = windows[0].rms;
    let winCount = 1;

    const flush = (endTime) => {
        const rmsMean = rmsSum / winCount;
        segments.push({
            start_time: segStart,
            end_time: endTime,
            type: curType,
            rmsMean
        });
    };

    for (let i = 1; i < windows.length; i++) {
        const w = windows[i];
        if (w.type === curType) {
            rmsSum += w.rms;
            winCount++;
            continue;
        }
        const boundary = (w.t0 + windows[i - 1].t0 + HOP_SEC) / 2;
        flush(boundary);
        segStart = boundary;
        curType = w.type;
        rmsSum = w.rms;
        winCount = 1;
    }
    flush(dur);

    const merged = [];
    for (const s of segments) {
        const len = s.end_time - s.start_time;
        if (len < MIN_SEGMENT_SEC && merged.length > 0) {
            const prev = merged[merged.length - 1];
            prev.end_time = s.end_time;
            prev.rmsMean = (prev.rmsMean + s.rmsMean) * 0.5;
        } else {
            merged.push({ ...s });
        }
    }

    const normRms = merged.map(s => s.rmsMean);
    const rmsMed = normRms.sort((a, b) => a - b)[Math.floor(normRms.length / 2)] || 0.05;

    return {
        fileName,
        duration: dur,
        segments: merged.map(s => ({
            start_time: s.start_time,
            end_time: s.end_time,
            type: s.type,
            gain: Math.min(2.5, Math.max(0.35, 1 / (Math.sqrt(s.rmsMean) / Math.sqrt(rmsMed + 1e-8))))
        }))
    };
}

async function main() {
    const all = fs.readdirSync(AUDIO_DIR).filter(f => /^track1\.(mp3|ogg|wav)$/i.test(f));
    const file = all.find(f => /\.ogg$/i.test(f)) || all.find(f => /\.mp3$/i.test(f)) || all[0];
    if (!file) {
        console.error('Need track1.mp3 or track1.ogg in', AUDIO_DIR);
        process.exit(1);
    }
    console.log('Analyzing only', file, 'in', AUDIO_DIR);

    const tracks = {};
    const pool = { calm: [], mid: [], intense: [] };

    {
        const buf = fs.readFileSync(path.join(AUDIO_DIR, file));
        const audio = await decode(buf);
        const mono = toMono(audio);
        const sr = audio.sampleRate;
        const { duration, segments } = analyzeTrack(mono, sr, file);

        tracks[file] = {
            sampleRate: sr,
            duration,
            segments
        };

        for (const seg of segments) {
            const d = seg.end_time - seg.start_time;
            const entry = {
                file,
                start: seg.start_time,
                end: seg.end_time,
                duration: d,
                gain: seg.gain != null ? seg.gain : 1
            };
            pool[seg.type].push(entry);
        }
    }

    const out = {
        version: 1,
        singleTrack: true,
        audioFile: file,
        generated: new Date().toISOString(),
        windowSec: WINDOW_SEC,
        hopSec: HOP_SEC,
        tracks,
        pool,
        deathFile: file
    };

    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2), 'utf8');
    console.log('Wrote', OUT_JSON);
    console.log('Pool sizes:', Object.fromEntries(Object.entries(pool).map(([k, v]) => [k, v.length])));
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
