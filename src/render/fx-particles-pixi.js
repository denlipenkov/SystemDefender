/**
 * Частицы боя через Pixi Graphics (fxLayer поверх полного кадра — как в Canvas2D, частицы последние).
 */
function parseCssColor(css) {
    // Supports: #rgb/#rrggbb, rgb(), rgba(). Returns { color:number, alpha:number }
    const s = (css == null) ? '' : String(css).trim();
    if (s[0] === '#') {
        const hex = s.slice(1);
        const full = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex;
        const n = parseInt(full, 16);
        if (Number.isFinite(n)) return { color: (n >>> 0), alpha: 1 };
    }
    const m = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([0-9.]+))?\s*\)/i);
    if (m) {
        const r = Math.max(0, Math.min(255, parseInt(m[1], 10) || 0));
        const g = Math.max(0, Math.min(255, parseInt(m[2], 10) || 0));
        const b = Math.max(0, Math.min(255, parseInt(m[3], 10) || 0));
        const a = (m[4] == null) ? 1 : Math.max(0, Math.min(1, parseFloat(m[4]) || 0));
        return { color: (((r << 16) | (g << 8) | b) >>> 0), alpha: a };
    }
    // Fallback (unknown string): use white; caller controls alpha by life anyway
    return { color: 0xffffff, alpha: 1 };
}

function applyFillFromCss(graphics, css, alphaMul) {
    const c = parseCssColor(css);
    graphics.setFillStyle({ color: c.color, alpha: c.alpha * alphaMul });
    return c;
}

/**
 * @param {import('pixi.js').Graphics} graphics
 * @param {object} opts
 * @param {Array<{ x: number, y: number, life: number, size: number, color: string, glow: boolean }>} opts.particles
 * @param {{ particleGlowOffCount: number, enemyStressCount: number }} opts.PERF
 * @param {number} opts.activeEnemyN
 */
export function redrawParticlesGraphics(graphics, opts) {
    const { particles, PERF, activeEnemyN } = opts;
    graphics.clear();
    if (!particles || particles.length === 0) return;
    const stress = particles.length > PERF.particleGlowOffCount || activeEnemyN > PERF.enemyStressCount;
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const a = Math.max(0, p.life);
        if (a <= 0) continue;
        const base = applyFillFromCss(graphics, p.color, a);
        const s = p.size;
        if (p.glow && !stress) {
            graphics.setFillStyle({ color: base.color, alpha: a * 0.35 });
            graphics.rect(p.x - 1, p.y - 1, s + 2, s + 2).fill();
            applyFillFromCss(graphics, p.color, a);
        }
        graphics.rect(p.x, p.y, s, s).fill();
    }
}
