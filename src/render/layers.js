/**
 * Слои боевой сцены Pixi (WebGPU / WebGL2).
 * gameRoot — полноэкранный спрайт с кадром из offscreen canvas (текущий путь).
 * entityLayer — контейнер под будущие спрайты врагов/снарядов (батчинг GPU).
 * fxLayer — частицы и др. эффекты Pixi (Graphics) поверх спрайта с кадром Canvas2D.
 */
import { Container } from '../../node_modules/pixi.js/lib/index.mjs';

export function attachCombatLayers(stage) {
    const root = new Container();
    const gameRoot = new Container();
    const entityLayer = new Container();
    const fxLayer = new Container();
    root.addChild(gameRoot);
    root.addChild(entityLayer);
    root.addChild(fxLayer);
    stage.addChild(root);
    return { root, gameRoot, entityLayer, fxLayer };
}
