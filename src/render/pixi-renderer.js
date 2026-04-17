/**
 * Pixi renderer facade for System Defender.
 *
 * Goal: render game scene directly in Pixi (WebGPU/WebGL2) without Canvas2D frame upload.
 * This is intentionally simple: a few persistent Graphics objects are cleared/redrawn each frame.
 * Later we can switch hot-path entities to pooled Sprites / RenderTexture atlases.
 */
import { Graphics } from '../../node_modules/pixi.js/lib/scene/graphics/shared/Graphics.mjs';
import { Container } from '../../node_modules/pixi.js/lib/index.mjs';

function toPixiColor(c, fallback = 0xffffff) {
    if (typeof c === 'number') return c >>> 0;
    if (typeof c !== 'string') return fallback;
    // Accept: '#rrggbb' / 'rgb(...)' / 'rgba(...)' / 'hsl(...)' (fallback) / named colors (fallback)
    if (c[0] === '#') {
        const hex = c.slice(1);
        const n = parseInt(hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex, 16);
        return Number.isFinite(n) ? (n >>> 0) : fallback;
    }
    const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (m) {
        const r = Math.max(0, Math.min(255, parseInt(m[1], 10) || 0));
        const g = Math.max(0, Math.min(255, parseInt(m[2], 10) || 0));
        const b = Math.max(0, Math.min(255, parseInt(m[3], 10) || 0));
        return ((r << 16) | (g << 8) | b) >>> 0;
    }
    return fallback;
}

export function createPixiRenderer(presentation) {
    const { layers } = presentation;

    // Containers (kept stable for future pooling)
    const background = new Container();
    const entities = new Container();
    const ui = new Container();

    const gBackground = new Graphics();
    const gEntities = new Graphics();
    const gUI = new Graphics();

    // Menu "matrix" overlay state (pure Pixi, no Canvas2D)
    let menuCols = null;
    let menuColsKey = '';

    background.addChild(gBackground);
    entities.addChild(gEntities);
    ui.addChild(gUI);

    layers.backgroundLayer.addChild(background);
    layers.entityLayer.addChild(entities);
    layers.uiLayer.addChild(ui);

    function clearAll() {
        gBackground.clear();
        gEntities.clear();
        gUI.clear();
    }

    function drawGrid(g, w, h, hueColor) {
        const grid = Math.max(24, Math.floor(Math.min(w, h) / 18));
        const c = toPixiColor(hueColor, 0x2cff7a);
        g.rect(0, 0, w, h).fill({ color: 0x050805, alpha: 1 });
        g.stroke({ width: 1, color: c, alpha: 0.10 });
        for (let x = 0; x <= w; x += grid) {
            g.moveTo(x, 0);
            g.lineTo(x, h);
        }
        for (let y = 0; y <= h; y += grid) {
            g.moveTo(0, y);
            g.lineTo(w, y);
        }

        // Scanlines (very subtle)
        const scanA = 0.045;
        for (let y = 0; y < h; y += 3) {
            g.rect(0, y, w, 1).fill({ color: 0x000000, alpha: scanA });
        }

        // Simple vignette (dark borders; cheap approximation of radial gradient)
        const vA = 0.18;
        const t = Math.max(24, Math.floor(Math.min(w, h) * 0.06));
        g.rect(0, 0, w, t).fill({ color: 0x000000, alpha: vA });
        g.rect(0, h - t, w, t).fill({ color: 0x000000, alpha: vA });
        g.rect(0, 0, t, h).fill({ color: 0x000000, alpha: vA });
        g.rect(w - t, 0, t, h).fill({ color: 0x000000, alpha: vA });
    }

    function drawPlayer(g, player) {
        if (!player) return;
        const x = player.x || 0;
        const y = player.y || 0;
        const r = player.radius || 18;
        const ang = (player.angle != null ? player.angle : -Math.PI / 2);
        const c = toPixiColor(player.color || player.stroke || '#37ff9b', 0x37ff9b);
        const fill = 0x07110c;
        const a0 = ang;
        const p1x = x + Math.cos(a0) * r;
        const p1y = y + Math.sin(a0) * r;
        const p2x = x + Math.cos(a0 + 2.6) * r * 0.92;
        const p2y = y + Math.sin(a0 + 2.6) * r * 0.92;
        const p3x = x + Math.cos(a0 - 2.6) * r * 0.92;
        const p3y = y + Math.sin(a0 - 2.6) * r * 0.92;
        g.poly([p1x, p1y, p2x, p2y, p3x, p3y]).fill({ color: fill, alpha: 0.95 });
        g.poly([p1x, p1y, p2x, p2y, p3x, p3y]).stroke({ width: 2, color: c, alpha: 0.9 });
    }

    function drawEnemies(g, enemies) {
        if (!enemies || !enemies.length) return;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || !e.active) continue;
            const x = e.x || 0;
            const y = e.y || 0;
            const r = e.radius || 16;
            const c = toPixiColor(e.color || e.stroke || '#ff3a78', 0xff3a78);
            g.circle(x, y, r).fill({ color: 0x070607, alpha: 0.92 });
            g.circle(x, y, r).stroke({ width: 2, color: c, alpha: 0.85 });
        }
    }

    function drawBullets(g, bullets, enemyBullets) {
        const drawList = (arr, fallbackColor) => {
            if (!arr || !arr.length) return;
            for (let i = 0; i < arr.length; i++) {
                const b = arr[i];
                if (!b || b.active === false) continue;
                const x = b.x || 0;
                const y = b.y || 0;
                const sz = b.size || 4;
                const c = toPixiColor(b.color || fallbackColor, toPixiColor(fallbackColor));
                g.rect(x - sz, y - sz, sz * 2, sz * 2).fill({ color: c, alpha: 0.95 });
            }
        };
        drawList(bullets, '#37ff9b');
        drawList(enemyBullets, '#ff3a78');
    }

    function drawPickups(g, pickups, powerups, defenseDrops) {
        const drawArr = (arr, fallbackColor, shape) => {
            if (!arr || !arr.length) return;
            for (let i = 0; i < arr.length; i++) {
                const p = arr[i];
                if (!p || p.active === false) continue;
                const x = p.x || 0;
                const y = p.y || 0;
                const r = p.radius || p.size || 7;
                const c = toPixiColor(p.color || fallbackColor, toPixiColor(fallbackColor));
                if (shape === 'circle') g.circle(x, y, r).fill({ color: c, alpha: 0.85 });
                else g.roundRect(x - r, y - r, r * 2, r * 2, Math.max(2, r * 0.3)).fill({ color: c, alpha: 0.85 });
            }
        };
        drawArr(pickups, '#47d7ff', 'circle');
        drawArr(powerups, '#ffd86b', 'rect');
        drawArr(defenseDrops, '#b076ff', 'rect');
    }

    function drawWallsAndPortals(g, walls, portals) {
        if (walls && walls.length) {
            for (let i = 0; i < walls.length; i++) {
                const w = walls[i];
                if (!w || w.active === false) continue;
                // Most wall objects in this codebase expose x/y/w/h
                const x = w.x || 0, y = w.y || 0;
                const ww = w.w || w.width || 0;
                const hh = w.h || w.height || 0;
                if (ww > 0 && hh > 0) g.rect(x, y, ww, hh).fill({ color: 0x0b1116, alpha: 0.95 });
            }
        }
        if (portals && portals.length) {
            for (let i = 0; i < portals.length; i++) {
                const p = portals[i];
                if (!p || p.active === false) continue;
                const x = p.x || 0, y = p.y || 0;
                const r = p.radius || 18;
                g.circle(x, y, r).stroke({ width: 2, color: 0xff40d0, alpha: 0.65 });
                g.circle(x, y, r * 0.6).stroke({ width: 2, color: 0x6ef7ff, alpha: 0.5 });
            }
        }
    }

    function drawHudBars(g, player, w, h) {
        if (!player) return;
        const hp = Math.max(0, player.hp || 0);
        const mhp = Math.max(1, player.maxHp || player.maxHP || 1);
        const t = Math.max(0, Math.min(1, hp / mhp));
        const pad = 14;
        const barW = Math.max(180, Math.min(520, Math.floor(w * 0.32)));
        const barH = 10;
        const x = pad;
        const y = h - pad - barH;
        g.roundRect(x, y, barW, barH, 5).fill({ color: 0x000000, alpha: 0.35 });
        g.roundRect(x + 1, y + 1, Math.max(0, (barW - 2) * t), barH - 2, 4).fill({ color: 0x37ff9b, alpha: 0.65 });
        g.roundRect(x, y, barW, barH, 5).stroke({ width: 1, color: 0x37ff9b, alpha: 0.35 });
    }

    function ensureMenuCols(w, h) {
        const key = `${w}x${h}`;
        if (menuCols && menuColsKey === key) return;
        menuColsKey = key;
        const colW = 15;
        const n = Math.ceil(w / colW) + 2;
        menuCols = [];
        const seed = 90210;
        let s = seed >>> 0;
        const rnd = () => {
            // Mulberry32-ish
            s |= 0; s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const lh = 13;
        for (let i = 0; i < n; i++) {
            menuCols.push({
                x: i * colW,
                y: rnd() * h * 1.4 - h * 0.35,
                spd: 0.55 + rnd() * 2.6,
                len: 10 + Math.floor(rnd() * 22),
                lh
            });
        }
    }

    function drawMenuMatrixOverlay(g, w, h, nowMs) {
        ensureMenuCols(w, h);
        if (!menuCols) return;
        const t = (nowMs || 0) * 0.001;
        const colW = 15;
        // Faint fade layer (like alpha fillRect in Canvas2D version)
        g.rect(0, 0, w, h).fill({ color: 0x020a16, alpha: 0.08 });
        for (let i = 0; i < menuCols.length; i++) {
            const col = menuCols[i];
            col.y += col.spd;
            const totalH = col.len * col.lh;
            if (col.y > h + totalH) col.y = -totalH * (0.3 + ((Math.sin(t + i) + 1) * 0.35));
            for (let r = 0; r < col.len; r++) {
                const yy = col.y - r * col.lh;
                if (yy < -col.lh || yy > h + col.lh) continue;
                const head = r === 0;
                const a = head ? 0.22 : (0.04 + 0.08 * (1 - r / col.len));
                const x = col.x;
                const sz = head ? 8 : 6;
                const c = head ? 0xa0ffbe : 0x2dc86e;
                g.roundRect(x, yy, sz, sz, 2).fill({ color: c, alpha: a });
            }
        }
        // Subtle vertical banding
        for (let x = 0; x < w; x += colW * 2) {
            g.rect(x, 0, colW, h).fill({ color: 0x00ff88, alpha: 0.01 });
        }
    }

    function sync(frame) {
        // frame: { w,h, theme, player, enemies, bullets, enemyBullets, isPlaying, isPaused }
        const w = Math.max(1, frame && frame.w ? frame.w : 1);
        const h = Math.max(1, frame && frame.h ? frame.h : 1);
        clearAll();

        // Background
        const gridColor = frame && frame.theme && (frame.theme.gridStrong || frame.theme.primary);
        drawGrid(gBackground, w, h, gridColor);

        // Entities
        drawEnemies(gEntities, frame && frame.enemies);
        drawBullets(gEntities, frame && frame.bullets, frame && frame.enemyBullets);
        drawPickups(gEntities, frame && frame.pickups, frame && frame.powerups, frame && frame.defenseDrops);
        drawWallsAndPortals(gEntities, frame && frame.walls, frame && frame.portals);
        drawPlayer(gEntities, frame && frame.player);

        // UI
        drawHudBars(gUI, frame && frame.player, w, h);
        if (frame && frame.isPlaying === false) {
            drawMenuMatrixOverlay(gUI, w, h, frame.now);
        }
    }

    return {
        sync,
        destroy() {
            try {
                clearAll();
                background.destroy({ children: true });
                entities.destroy({ children: true });
                ui.destroy({ children: true });
            } catch (e) { /* ignore */ }
        }
    };
}

