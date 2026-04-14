/**
 * Вывод игры через PixiJS v8: предпочтение WebGPU, иначе WebGL2.
 * Новый путь: сцена рисуется напрямую в Pixi (Graphics/Sprite), без Canvas2D texture upload.
 */
import '../../node_modules/pixi.js/lib/environment-browser/browserAll.mjs';
import { Application } from '../../node_modules/pixi.js/lib/index.mjs';
import { Graphics } from '../../node_modules/pixi.js/lib/scene/graphics/shared/Graphics.mjs';
import { attachCombatLayers } from './layers.js';

function resolveBackendLabel(app) {
    try {
        const r = app.renderer;
        const name = r && (r.name || (r.gpu && 'webgpu') || (r.gl && 'webgl'));
        if (name) return String(name);
        if (r && r.type !== undefined) {
            const t = r.type;
            if (t === 2) return 'webgl';
            if (t === 3) return 'webgpu';
        }
    } catch (e) { /* ignore */ }
    return 'unknown';
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.mount
 * @param {string} [opts.preference='webgpu']
 */
export async function createBattlePresentation(opts) {
    const { mount, preference = 'webgpu', width = 1, height = 1 } = opts || {};
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);

    const app = new Application();
    await app.init({
        width: w,
        height: h,
        preference,
        powerPreference: 'high-performance',
        antialias: true,
        resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(2, window.devicePixelRatio) : 1,
        autoDensity: true,
    });

    mount.replaceChildren();
    mount.appendChild(app.canvas);
    Object.assign(app.canvas.style, {
        display: 'block',
        width: '100%',
        height: '100%',
        verticalAlign: 'top',
    });

    const layers = attachCombatLayers(app.stage);
    const particleFxGraphics = new Graphics();
    layers.fxLayer.addChild(particleFxGraphics);

    const presentation = {
        app,
        layers,
        particleFxGraphics,
        getBackendLabel: () => resolveBackendLabel(app),
        resize(newW, newH) {
            const nw = Math.max(1, newW | 0);
            const nh = Math.max(1, newH | 0);
            app.renderer.resize(nw, nh);
            app.render();
        },
        commitFrame() {
            app.render();
        },
        destroy() {
            try {
                app.destroy(true, { children: true, texture: true });
            } catch (e) { /* ignore */ }
        },
    };

    return presentation;
}
