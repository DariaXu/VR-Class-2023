// import * as croquet from "../util/myCroquetlib.js";
import * as croquet from "../util/croquetlib.js";
import { controllerMatrix, buttonState } from "../render/core/controllerInput.js";
import * as cg from "../render/core/cg.js";
import { g2 } from "../util/g2.js";
import * as global from "../global.js";
import { Gltf2Node } from "../render/nodes/gltf2.js";
import { lcb, rcb } from '../handle_scenes.js';

const TROPHIES = 0;
const OXYGEN_TANK = 1;

const ground = .2;
const targetScale = [0.5, .3, .5];
const targetLocation = [0.8, ground + targetScale[1] / 2, .2];

// const tankScale = [.5,.5,.5];
const tankScale = [.05, .05, .05];
const tankDimensions = { x: 1.5 * tankScale[0], y: 3 * tankScale[1], z: 1.5 * tankScale[2] };
const getTankCentral = (m) => { return { x: m[0], y: m[1] + .125, z: m[2] }; };
const amountInTank = .2;
const O2ConsumedPerTick = .001;

let prevPos = [0, 0, 0];

let worldP = null;
let worldG = null;
let target = null;
let objsInScene = { trophies: [], oxygenTanks: [] };

let itemInTarget = 0;
let numOfTrophies = 0;

// let testBox = null;

//#region Collect Objects - Primitive
let isInBoxPrimitive = (p, boxM) => {
    let q = cg.mTransform(cg.mInverse(boxM), p);
    return q[0] >= -1 & q[0] <= 1 &&
        q[1] >= -1 & q[1] <= 1 &&
        q[2] >= -1 & q[2] <= 1;
}

let ifHitAnyTrophies = (controllerM) => {
    let m = controllerM.slice(12, 15);
    for (let i = 0; i < window.croquetModel.scene[TROPHIES].length; i++) {
        const b = isInBoxPrimitive(m, window.croquetModel.scene[TROPHIES][i].matrix);
        // console.log(b)
        if (b) {
            // console.log("color blue")
            // window.croquetModel.scene[i].color = [0, 0, 1];
            return i;
        }
        // else {
        //     // console.log("reset")
        //     window.croquetModel.scene[TROPHIES][i].color = [1, 1, 1];
        // }
    }
    return -1;
}

let OnHitTrophy = (objIndex, triggerPrev, m) => {
    let hitObjInfo = window.croquetModel.scene[TROPHIES][objIndex];
    hitObjInfo.color =  [1, .2, .2];
    let B = m.slice(12, 15);
    if (!triggerPrev)
        prevPos = B;
    else
        hitObjInfo.matrix = cg.mMultiply(cg.mTranslate(cg.subtract(B, prevPos)), hitObjInfo.matrix);

    prevPos = B;
    hitObjInfo.activated = true;
}
let OnHitBlocker = (objIndex, triggerPrev, m) => {
    let hitObjInfo = window.croquetModel.scene[TROPHIES][objIndex];
    hitObjInfo.color =  [.9, .9, 1];
    let B = m.slice(12, 15);
    if (!triggerPrev)
        prevPos = B;
    else
        hitObjInfo.matrix = cg.mMultiply(cg.mTranslate(cg.subtract(B, prevPos)), hitObjInfo.matrix);

    prevPos = B;
    hitObjInfo.activated = true;
}

//#endregion

//#region Collect Objects - GLTF
let isInBoxGltf = (p, m) => {
    const boxDimensions = tankDimensions;
    const boxCenter = getTankCentral(m.slice(12, 15));
    // console.log(`isInBoxGltf: ${m};; p: ${p}`)
    const distanceX = Math.abs(p[0] - boxCenter.x);
    const distanceY = Math.abs(p[1] - boxCenter.y);
    const distanceZ = Math.abs(p[2] - boxCenter.z);
    // console.log(`boxCenter: ${boxCenter.x};;${boxCenter.y};;${boxCenter.z}`)
    // console.log(`isInBoxGltf: distanceX:${distanceX};; distanceY: ${distanceY};; distanceZ: ${distanceZ}`)
    // console.log(`isInBoxGltf: boxDimensionsX:${boxDimensions.x / 2};; boxDimensionsY: ${boxDimensions.y / 2};; boxDimensionsZ: ${boxDimensions.z / 2}`)
    if (distanceX <= boxDimensions.x / 2 &&
        distanceY <= boxDimensions.y / 2 &&
        distanceZ <= boxDimensions.z / 2) {
        // console.log(`isInBoxGltf: HITT`)
        return true;
    }
    return false;
}

let ifHitAnyTanks = (controllerM) => {
    let m = controllerM.slice(12, 15);

    for (let i = 0; i < window.croquetModel.scene[OXYGEN_TANK].length; i++) {
        if(window.croquetModel.scene[OXYGEN_TANK][i].removed) continue;

        const b = isInBoxGltf(m, window.croquetModel.scene[OXYGEN_TANK][i].matrix);
        // console.log(b)
        if (b) {
            // console.log(`ifHitAnyTanks: HIT`)
            // console.log("color blue")
            // window.croquetModel.scene[i].color = [0, 0, 1];
            // testBox.identity().color(1,0,0);
            return i;
        }
    }
    // testBox.identity().color(1,1,1);
    return -1;
}

let OnHitTank = (objIndex, triggerPrev, m) => {
    let hitObjInfo = window.croquetModel.scene[OXYGEN_TANK][objIndex];
    hitObjInfo.removed =true;
    worldG.removeNode(objsInScene.oxygenTanks[objIndex]);
    O2Bar.value = Math.min(O2Bar.value + amountInTank, 1);
    console.log(`getTank: ${objIndex}`);
}
//#endregion

//#region Game State
let O2Bar = null;
let subO2Bar = null;
let createOxygenBar = () => {
    let O2Bar = window.clay.model.add('cube').texture(() => {
        g2.drawWidgets(O2Bar);
    });
    O2Bar.value = 1;
    subO2Bar = g2.addWidget(O2Bar, 'slider', .375, .068, '#80ffff', 'O2', value => { });
    return O2Bar
}

let progressBar = null;
let subPBar = null;
let createProgressBar = () => {
    let progressBar = window.clay.model.add('cube').texture(() => {
        g2.drawWidgets(progressBar);
    });
    progressBar.value = 0;
    subPBar = g2.addWidget(progressBar, 'slider', .375, .068, '#80ff82', ' ', value => { });
    return progressBar
}

let ifSuccess = () => {
    if (objsInScene.trophies.length == 0) return false;
    // console.log("ifSuccess")
    let counter = 0;
    for (let i = 0; i < window.croquetModel.scene[TROPHIES].length; i++) {
        // console.log(objsInScene[i].obj.getGlobalMatrix());
        const b = isInBoxPrimitive(objsInScene.trophies[i].getGlobalMatrix().slice(12, 15), target.getGlobalMatrix());

        if (b && window.croquetModel.scene[TROPHIES][i].isTrophy) {
            // console.log("Success")
            window.croquetModel.scene[TROPHIES][i].color = [0, 1, 0];
            counter += 1;
        }
    }
    itemInTarget = counter;
    if (counter == numOfTrophies) {
        return true;
    }
    return false;
}

let gameEndW = null;
let GameEnd = () => {
    let EndWidget = worldP.add('cube').texture(() => {
        g2.setColor('white');
        // g2.fillRect(.1,0,.8,1);
        g2.fillRect(.1, 0, 1, .5);
        g2.textHeight(.09);
        g2.setColor('black');
        g2.fillText(`DONE!!!`, .5, .4, 'center');

        g2.drawWidgets(EndWidget);
    });
    return EndWidget;
}
//#endregion

export let initModel = () => {                                // INITIALIZE THE MODEL DATA.
    console.log("hello from seaCroquet3");
    window.croquetModel.scene = [];
    // console.log(objsInScene.length);
    let items =
        [
            { location: [0.5, ground, -1], scale: .3, color: [1, 1, 1], failingOffset: .01, isTrophy: true },
            { location: [0, ground, .5], scale: .3, color: [1, 1, 1], failingOffset: .01, isTrophy: true },
            { location: [-0.5,ground, 1.5], scale: .3, color: [1, 1, 1], failingOffset: .01, isTrophy: true },
            { location: [0.2, ground+.5, .5], scale: [.6,.2,.9], color: [.9, .9, .9], failingOffset: .1 , isTrophy: false, texture:'../media/textures/rock1.png'}, // scene objects, should initially be on the ground
        ];
    window.croquetModel.scene.push([]);
    for (const objInfo of items) {
        window.croquetModel.scene[0].push({
            location: objInfo.location,
            matrix: null,
            inMovement: false,
            activated: false,
            color: objInfo.color,
            scale: objInfo.scale,
            failingOffset: objInfo.failingOffset,
            isTrophy: objInfo.isTrophy,
            texture: objInfo.texture,
        });
    }

    let oxygenTanks =
        [
            { location: [0.3, 4, .8] },
            { location: [0, 4, .8] },
            { location: [-0.3, 4, .8] },
        ]
    window.croquetModel.scene.push([]);
    for (const objInfo of oxygenTanks) {
        window.croquetModel.scene[1].push({
            location: objInfo.location,
            matrix: null,
            removed: false,
        });
    }
}

let drawObjects = () => {
    // console.log('drawObjects')
    if (O2Bar == null) {
        O2Bar = createOxygenBar();
    }
    // console.log('drawObjects1')
    if (O2Bar) {
        // O2Bar.setMatrix(rcb.beamMatrix()).move(0, 0.43, -0.6).scale(.2, .2, .0001);
        O2Bar.value = Math.max(0,O2Bar.value-O2ConsumedPerTick);
        O2Bar.hud().move(-.9 , .3, -1).scale(1, .4, .0001);
        subO2Bar.setValue(O2Bar.value);
    }

    // console.log('drawObjects2')
    if (gameEndW) {
        gameEndW.hud().scale(.4, .4, .0001);
    }
    // console.log('drawObjects3')
    if (objsInScene.trophies.length == 0) {
        worldG = new Gltf2Node({ url: './media/gltf/underwater_planet/untitled.gltf' });
        // worldG = new Gltf2Node({ url: './media/gltf/sunflower/sunflower.gltf' });
        global.gltfRoot.addNode(worldG);
        for (const _ of window.croquetModel.scene[OXYGEN_TANK]) {

            // let initTank = new Gltf2Node({ url: './media/gltf/oxygen_kit/scene.gltf' });
            // let initTank = new Gltf2Node({ url: './media/gltf/oxygen_ballon/scene.gltf' });
            let initTank = new Gltf2Node({ url: './media/gltf/oxygen_tank/scene.gltf' });

            worldG.addNode(initTank);
            objsInScene.oxygenTanks.push(initTank);
        }

        worldP = window.clay.model.add();
        target = worldP.add('cube');

        for (const objInfo of window.croquetModel.scene[TROPHIES]) {
            // console.log(`creating cube: ${window.croquetModel.scene[TROPHIES].length}`);
            if (objInfo.isTrophy) numOfTrophies += 1;
            let initObj = window.clay.model.add('cube');
            objsInScene.trophies.push(initObj);
        }

        // testBox = window.clay.model.add('cube');

    }
    // console.log('drawObjects4')
    for (let i = 0; i < window.croquetModel.scene[TROPHIES].length; i++) {
        let objInfo = window.croquetModel.scene[TROPHIES][i];
        let curObj = objsInScene.trophies[i];
        if (objInfo.matrix == null) {
            curObj.identity().move(objInfo.location).color(objInfo.color).scale(objInfo.scale).texture(objInfo.texture);
            objInfo.matrix = curObj.getGlobalMatrix();
            // console.log(`draw1: ${curObj.getGlobalMatrix()}`)
        } else {
            let objGround = Array.isArray(objInfo.scale) ? ground + (objInfo.scale[1] / 2) : (ground + objInfo.scale / 2);

            if (objInfo.inMovement && objInfo.matrix[13] > objGround) {
                objInfo.matrix[13] -= objInfo.failingOffset;
            }
            curObj.setMatrix(objInfo.matrix).color(objInfo.color).scale(objInfo.scale);
            // console.log(`draw2: ${objInfo.matrix}`)
        }
    }
    // console.log('drawObjects5')
    for (let i = 0; i < window.croquetModel.scene[OXYGEN_TANK].length; i++) {

        let tankInfo = window.croquetModel.scene[OXYGEN_TANK][i];
        if(tankInfo.removed) continue;
        let tankObj = objsInScene.oxygenTanks[i];

        tankObj.scale = tankScale;
        tankObj.translation = tankInfo.location;
        tankInfo.matrix = tankObj.worldMatrix;

    }
    // let t = objsInScene.oxygenTanks[0].worldMatrix.slice(12,15);
    // testBox.identity().move([t[0],t[1]+.125, t[2]]).scale([.125*.5,.3*.5,.125*.5]).opacity(.7);
    // console.log('drawObjects6')
    target.identity().move(targetLocation).scale(targetScale).opacity(.7);
    worldG.translation = [0, -3, 0];
    // console.log('drawObjects7')

    if(progressBar == null){
        progressBar = createProgressBar();
    }
    if (progressBar) {
        // O2Bar.setMatrix(rcb.beamMatrix()).move(0, 0.43, -0.6).scale(.2, .2, .0001);
        progressBar.value = itemInTarget/numOfTrophies;
        progressBar.hud().move(0 , .6, -1).scale(2, .4, .0001);
        subPBar.setValue(progressBar.value);
    }
}

export let drawView = () => {
    // console.log("DRAW")                // TO DRAW MY VIEW OF THE SCENE,
    if (!window.croquetModel)                               // SET VIEW ANGLE AND PLACE ALL BOXES.
        return;
    drawObjects();
}

let failing = () => {
    for (const objInfo of window.croquetModel.scene[TROPHIES]) {
        if (objInfo.activated) {
            objInfo.inMovement = true;
            if (objInfo.isTrophy)
                objInfo.color = [1, 1, 1];
        }
    }
}

export let updateModel = e => {
    console.log("UPDATE")
    // if (window.demoseaCroquetState) {
    // e.where => controller matrix, e.info => if trigger previous pressed
    if (objsInScene.trophies.length == 0) return;
    if (e.what == "bothTriggerPressed" && ifHitAnyTrophies(e.where.left)==ifHitAnyTrophies(e.where.right)){
        let ml = e.where.left;
        let leftInAny = ifHitAnyTrophies(ml);
        let leftTriggerPrev = e.info;
        if (leftInAny != -1){
            let hitObjInfo = window.croquetModel.scene[TROPHIES][leftInAny];
            if (hitObjInfo.isTrophy)
                OnHitTrophy(leftInAny, leftTriggerPrev , ml);
            else
                OnHitBlocker(leftInAny, leftTriggerPrev , ml);
        }
    }
    else if (e.what == "rightTriggerPressed") {
        let mr = e.where;
        let rightTriggerPrev = e.info;
        let rightInAny = ifHitAnyTrophies(mr);

        console.log(`right press`)
        if (rightInAny != -1) {
            if (window.croquetModel.scene[TROPHIES][rightInAny].isTrophy)
                OnHitTrophy(rightInAny, rightTriggerPrev, mr);
        }

    } else if (e.what == "leftTriggerPressed") {
        let ml = e.where;
        let leftTriggerPrev = e.info;
        let leftInAny = ifHitAnyTrophies(ml);

        if (leftInAny != -1) {
            // left controller hit something
            if (window.croquetModel.scene[TROPHIES][leftInAny].isTrophy)
                OnHitTrophy(leftInAny, leftTriggerPrev, ml);
        }
    } else if (e.what == "rightTriggerRelease") {
        failing();
        // console.log(`right release`)

        let mr = e.where;
        let rightTriggerPrev = e.info;
        let rightInAny = ifHitAnyTanks(mr);

        // console.log(`hit: ${window.croquetModel.scene}`)
        if (rightInAny != -1) {
            console.log(`right hit: ${rightInAny}`)
            OnHitTank(rightInAny, rightTriggerPrev, mr);
        }

    } else if (e.what == "leftTriggerRelease") {
        failing();

        // collect oxygen tank
        let ml = e.where;
        let leftTriggerPrev = e.info;
        let leftInAny = ifHitAnyTanks(ml);

        if (leftInAny != -1) {
            // left controller hit something
            OnHitTank(leftInAny, leftTriggerPrev, ml);
        }
    }

    if (ifSuccess() && gameEndW == null) {
        //     // console.log("DONE");
        gameEndW = GameEnd();
    }

    // }
}

export const init = async model => {
    croquet.register('croquetDemo_mydemo3');
    model.setTable(false);
    model.setRoom(false);
    model.animate(() => {
    });
}