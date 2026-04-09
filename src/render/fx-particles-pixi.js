/**
 * Частицы боя через Pixi Graphics (fxLayer поверх полного кадра — как в Canvas2D, частицы последние).
 */
import { Color } from '../../node_modules/pixi.js/lib/color/Color.mjs';

const _col = new Color();

function applyFillFromCss(graphics, css, alphaMul) {
    _col.setValue(css);
    const baseA = (_col.alpha !== undefined ? _col.alpha : 1);
    graphics.setFillStyle({ color: _col.toNumber(), alpha: baseA * alphaMul });
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
        applyFillFromCss(graphics, p.color, a);
        const s = p.size;
        if (p.glow && !stress) {
            graphics.setFillStyle({ color: _col.toNumber(), alpha: a * 0.35 });
            graphics.rect(p.x - 1, p.y - 1, s + 2, s + 2).fill();
            applyFillFromCss(graphics, p.color, a);
        }
        graphics.rect(p.x, p.y, s, s).fill();
    }
}
