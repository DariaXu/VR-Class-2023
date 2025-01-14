
// YOUR APPLICATION SHOULD REDEFINE THESE FUNCTIONS:

// import { updateModel } from "../scenes/demoCroquet.js";
import { updateModel, initModel, drawView} from "../scenes/seaCroquet.js";
// import { updateModel} from "../scenes/seaCroquet.js";
import { controllerMatrix,  buttonState, joyStickState} from "../render/core/controllerInput.js";
import { initAvatar } from "../primitive/avatar.js";
import * as global from "../global.js";

// YOU SHOULD OBTAIN YOUR OWN apiKey FROM: croquet.io/keys

let apiKey = '17z9hr9nbu0btvJnKip9KNbPfM9by2vbPldPhHago';
let preRightTrigger = {pressed: false, touched: false, value: 0};
let preLeftTrigger = { pressed: false, touched: false, value: 0 };
window.color = [Math.random(), Math.random(), Math.random()]
/////////////////////////////////////////////////////////////////
// let initModel = () => {
//    // if(!croquetModel.scene) croquetModel.scene =  window.clay.model.dataTree;
// }

let drawAvatar = actor => {
    let avatarInfo = actor.avatarPos;
    if (avatarInfo.headset) {
        window.avatars[actor.viewId].headset.matrix = avatarInfo.headset;
    }
    // not in the default pos
    if (avatarInfo.controllerMatrix) {
        window.avatars[actor.viewId].leftController.matrix = avatarInfo.controllerMatrix.left;
        window.avatars[actor.viewId].rightController.matrix = avatarInfo.controllerMatrix.right;
    }
}

// let drawView    = () => {

// }


export class Model extends Croquet.Model {
    init() {
        this.actors = new Map();
        this.actorStates = new Map();
        this.subscribe(this.sessionId, "view-join", this.viewJoin);
        this.subscribe(this.sessionId, "view-exit", this.viewDrop);
        this.subscribe("scene", "initScene"   , this.initScene   );
        this.subscribe("scene", "updateScene" , this.updateScene );
        this.actorIndex = 0;
        this.initScene();
    }
    viewJoin(viewId) {
        let actorState = this.actorStates.get(viewId);
        if (! actorState) {
            actorState = this.actorIndex++;
            this.actorStates.set(viewId, actorState);
        }
        const actor = Actor.create(viewId);
        actor.state = actorState;
        this.actors.set(viewId, actor);
        this.publish("actor", "join", actor);
    }
    viewDrop(viewId) {
        const actor = this.actors.get(viewId);
        this.actors.delete(viewId);
        actor.destroy();
        this.publish("actor", "exit", actor);
    }
    initScene() {
        window.croquetModel = this;
        initModel();
    }
    updateScene(e) {
        if (window.croquetModel)
            updateModel(e);
        else {
            window.croquetModel = this;
            initModel();
        }
    }
}

export class Actor extends Croquet.Model {
    init(viewId) {
        this.viewId = viewId;
        this.mousePos = { x: 0, y: 0 };
        this.avatarPos = {
            "headset": null,
            "controllerMatrix": null,
            "buttonState": null,
            "joyStickState": null,
            "VR": null,
        }
        this.future(500).tick();
        this.subscribe(viewId, "updatePos", this.updatePos);
    }
    updatePos(avatarPos) {
        //   this.mousePos = mousePos;
        this.avatarPos = avatarPos;
    }
    tick() {
        this.publish(this.id, "moved", this.now());
        this.future(500).tick();
    }
}
Actor.register("Actor");

export class View extends Croquet.View {
    constructor(croquetModel) {
        super(croquetModel);
        this.croquetModel = croquetModel;
        this.scene = croquetModel.scene;
        this.state = croquetModel.actorStates.get(this.viewId);
        this.color = window.color; // assign a unique color to each user for them to create their cubes in demoCroquet
        this.pawns = new Map();
        croquetModel.actors.forEach(actor => this.addPawn(actor));

        this.subscribe("actor", "join", this.addPawn);
        this.subscribe("actor", "exit", this.removePawn);
        this.future(50).tick();

        let eToXY = e => {
            const r = window.canvas.getBoundingClientRect();
            const scale = window.canvas.width / Math.min(r.width, r.height);
            const x = (e.clientX - r.left) / window.canvas.width * 2 - 1;
            const y = 1 - (e.clientY - r.top) / window.canvas.width * 2;
            return {x:x, y:y};
        }
        onmousedown = e => { this.mouseDown(eToXY(e)); }
        onmouseup   = e => { this.mouseUp  (eToXY(e)); }
        onmousemove = e => { this.mouseMove(eToXY(e));
            // this.publish(this.viewId, "updatePos", eToXY(e));
        }
    }

    tick() {
        var headMat = [];
        for(let j = 0; j < 16; j ++) {
            headMat.push(window.avatars[window.playerid].headset.matrix[j])
        }
        var avatarJson = {
            "headset": headMat,
            "controllerMatrix": controllerMatrix,
            "buttonState": buttonState,
            "joyStickState": joyStickState,
            "VR": window.vr,
        }

        // send event
        if (buttonState.right[0].pressed) {
            this.event('rightTriggerPressed', controllerMatrix.right, preRightTrigger);
        }
        if(preRightTrigger && !buttonState.right[0].pressed) {
            this.event('rightTriggerRelease', controllerMatrix.right, preRightTrigger)
        }
        if(buttonState.left[0].pressed && buttonState.right[0].pressed) {
            let controllerJson = {
                "left": controllerMatrix.left,
                "right": controllerMatrix.right,
            };
            this.event('bothTriggerPressed', controllerJson, preLeftTrigger);
        }
        if (buttonState.left[0].pressed) {
            this.event('leftTriggerPressed', controllerMatrix.left, preLeftTrigger);
        }

        if(preLeftTrigger && !buttonState.left[0].pressed) {
            this.event('leftTriggerRelease', controllerMatrix.right, preLeftTrigger)
        }


        this.publish(this.viewId, "updatePos", avatarJson);
        preRightTrigger = buttonState.right[0].pressed;
        preLeftTrigger = buttonState.left[0].pressed;

        window.view = this;
        drawView();
        let viewState = this.croquetModel.actorStates.get(this.viewId);
        for (const pawn of this.pawns.values()) {
            pawn.update(viewState);
        }

        this.future(50).tick();
    }

    addPawn(actor) {
        this.pawns.set(actor, new Pawn(actor));
        if(!(actor.viewId in window.avatars)) {
            initAvatar(actor.viewId);
        }
        else { // for false stream drop, when the stream is back, change its avatar to visible
            window.avatars[actor.viewId].headset.model.visible = true;
            window.avatars[actor.viewId].leftController.model.visible = true;
            window.avatars[actor.viewId].rightController.model.visible = true;
        }
    }
    removePawn(actor) {
        const pawn = this.pawns.get(actor);
        if (pawn) {
            pawn.detach();
            this.pawns.delete(actor);
            // currently only change the visibility instead of removing the model directly in case of false stream drop
            window.avatars[actor.viewId].headset.model.visible = false;
            window.avatars[actor.viewId].leftController.model.visible = false;
            window.avatars[actor.viewId].rightController.model.visible = false;
            // global.scene().removeNode(window.avatars[actor.viewId].headset.model);
            // global.scene().removeNode(window.avatars[actor.viewId].leftController.model);
            // global.scene().removeNode(window.avatars[actor.viewId].rightController.model);
        }
    }
    update() { // turns out this function will not be called when entering the VR session, moved the following code to tick function
        // window.view = this;
        // drawView();
        // let viewState = this.croquetModel.actorStates.get(this.viewId);
        // for (const pawn of this.pawns.values()) {
        //    pawn.update(viewState);
        // }
    }
    initScene  (info) { this.publish("scene", "initScene"  , info); }
    updateScene(info) { this.publish("scene", "updateScene", info); }

    event(state, pos, info) { this.updateScene({who : this.viewId,
        what : state,
        where : pos,
        info: info}); }
    mouseDown(p) { this.isDown = true ; this.event('press', p); }
    mouseMove(p) { this.event(this.isDown ? 'drag' : 'move', p); }
    mouseUp(p)   { this.isDown = false; this.event('release', p, this.color); }
}

export class Pawn extends Croquet.View {
    constructor(actor) {
        super(actor);
        this.actor = actor;
    }
    update(viewState) {
        drawAvatar(this.actor);
    }
}

// YOU APPLICATION NEEDS TO REGISTER A UNIQUE NAME.

export let register = name => {
    Model.register("RootModel");
    Croquet.Session.join({
        apiKey  : apiKey,
        appId   : 'edu.nyu.frl.' + name,
        name    : name,
        password: 'secret',
        model   : Model,
        view    : View,
        tps     : 1000 / 500,
    });
}

