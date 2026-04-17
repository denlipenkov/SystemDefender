/**
 * Слои боевой сцены Pixi (WebGPU / WebGL2).
 * backgroundLayer — фон/пост-проц (сетka/виньетка/сканлайны).
 * entityLayer — контейнер под будущие спрайты врагов/снарядов (батчинг GPU).
 * fxLayer — частицы и др. эффекты Pixi (Graphics) поверх спрайта с кадром Canvas2D.
 * uiLayer — HUD и экранные оверлеи.
 */
import { Container } from '../../node_modules/pixi.js/lib/index.mjs';

export function attachCombatLayers(stage) {
    const root = new Container();
    const backgroundLayer = new Container();
    const gameRoot = new Container();
    const entityLayer = new Container();
    const fxLayer = new Container();
    const uiLayer = new Container();
    root.addChild(backgroundLayer);
    root.addChild(gameRoot);
    root.addChild(entityLayer);
    root.addChild(fxLayer);
    root.addChild(uiLayer);
    stage.addChild(root);
    return { root, backgroundLayer, gameRoot, entityLayer, fxLayer, uiLayer };
}
