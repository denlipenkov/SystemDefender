/**
 * Вывод игры через PixiJS v8: предпочтение WebGPU, иначе WebGL2.
 * Кадр по-прежнему собирается в offscreen Canvas2D (ctx), затем один texture upload на GPU.
 */
import '../../node_modules/pixi.js/lib/environment-browser/browserAll.mjs';
import { Application, Sprite, Texture } from '../../node_modules/pixi.js/lib/index.mjs';
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
 * @param {HTMLCanvasElement} opts.sourceCanvas — offscreen, сюда пишет ctx
 * @param {string} [opts.preference='webgpu']
 */
export async function createBattlePresentation(opts) {
    const { mount, sourceCanvas, preference = 'webgpu' } = opts;
    const w = Math.max(1, sourceCanvas.width || 1);
    const h = Math.max(1, sourceCanvas.height || 1);

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

    let texture = Texture.from(sourceCanvas);
    const sprite = new Sprite(texture);
    sprite.position.set(0, 0);
    sprite.width = w;
    sprite.height = h;

    const layers = attachCombatLayers(app.stage);
    layers.gameRoot.addChild(sprite);
    const particleFxGraphics = new Graphics();
    layers.fxLayer.addChild(particleFxGraphics);

    const presentation = {
        app,
        get texture() { return texture; },
        sprite,
        layers,
        particleFxGraphics,
        getBackendLabel: () => resolveBackendLabel(app),
        resize(newW, newH) {
            const nw = Math.max(1, newW | 0);
            const nh = Math.max(1, newH | 0);
            app.renderer.resize(nw, nh);
            sprite.width = nw;
            sprite.height = nh;
            const sw = sourceCanvas.width;
            const sh = sourceCanvas.height;
            if (sw !== nw || sh !== nh) {
                try { texture.destroy(true); } catch (e) { /* ignore */ }
                texture = Texture.from(sourceCanvas);
                sprite.texture = texture;
            }
            if (texture.source && typeof texture.source.update === 'function') {
                texture.source.update();
            }
            app.render();
        },
        commitFrame() {
            if (texture.source && typeof texture.source.update === 'function') {
                texture.source.update();
            }
            app.render();
        },
        destroy() {
            try {
                texture.destroy(true);
                app.destroy(true, { children: true, texture: true });
            } catch (e) { /* ignore */ }
        },
    };

    return presentation;
}
