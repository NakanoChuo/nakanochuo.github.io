import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

import { Simulator } from "./scripts/gravity_simulator.js";

const canvas = document.querySelector('#myCanvas');
const width = 960;
const height = 540;

const renderer = new THREE.WebGLRenderer({ canvas: canvas });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);    // 視野角、アスペクト比、クリッピング開始距離、終了距離
camera.position.set(0, 5, 10);
camera.lookAt(scene.position);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;  // 滑らかにカメラコントローラを制御する
controls.dampingFactor = 0.2;

const grid = new THREE.GridHelper(20, 10);
grid.material.opacity = 0.5;
grid.material.transparent = true;
scene.add(grid);

const light = new THREE.DirectionalLight(0xFFFFFF, 4);
light.position.set(1, 1, 1);
scene.add(light);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
composer.addPass(renderPass);
composer.addPass(outlinePass);

function* HslPalette(initH, s, l) {
    let count = 0;
    let h = initH;
    yield new THREE.Color(`hsl(${h}, ${s}%, ${l}%)`);

    while (true) {
        let d1 = 120;
        let d2 = 30;

        count++;
        if (count % 3 == 0) { d1 = 180; }
        if (count % 6 == 0) { d1 = 180 - d2; d2 /= 2; }
        h = (h + d1) % 360;

        yield new THREE.Color(`hsl(${h}, ${s}%, ${l}%)`);
    }
}

class Planet {
    constructor(scene, color, radius, name) {
        const geometry = new THREE.SphereGeometry(radius);
        const material = new THREE.MeshToonMaterial({ color: color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = name;
        scene.add(this.mesh);

        this.orbit = new Orbit(scene, color);

        this.setPositionCount = 0;
    }

    removeFromScene(scene) {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.orbit.removeFromScene(scene);
    }

    setPosition(position) {
        this.mesh.position.set(...position);

        const DRAW_POINT_INTERVAL = 4;
        if (this.setPositionCount % DRAW_POINT_INTERVAL == 0) {
            this.orbit.addPoint(position);
        }
        this.setPositionCount++;
    }
}

class Orbit {
    static get MAX_POINT_COUNT() { return 100; }

    constructor(scene, color) {
        const points = [];
        const vertexColors = [];
        for (let i = 0; i < Orbit.MAX_POINT_COUNT; i++) {
            points.push(new THREE.Vector3());
            vertexColors.push(color.r, color.g, color.b, 1 / Orbit.MAX_POINT_COUNT * i);
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 4));
        geometry.setDrawRange(0, 0);

        const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });

        this.line = new THREE.Line(geometry, material);
        scene.add(this.line);

        this.pointCount = 0;
    }

    removeFromScene(scene) {
        scene.remove(this.line);
        this.line.geometry.dispose();
        this.line.material.dispose();
    }

    addPoint(position) {
        const positions = this.line.geometry.attributes.position.array;

        for (let i = 0; i < Orbit.MAX_POINT_COUNT - 1; i++) {
            positions[i * 3 + 0] = positions[(i + 1) * 3 + 0];
            positions[i * 3 + 1] = positions[(i + 1) * 3 + 1];
            positions[i * 3 + 2] = positions[(i + 1) * 3 + 2];
        }
        positions[(Orbit.MAX_POINT_COUNT - 1) * 3 + 0] = position[0];
        positions[(Orbit.MAX_POINT_COUNT - 1) * 3 + 1] = position[1];
        positions[(Orbit.MAX_POINT_COUNT - 1) * 3 + 2] = position[2];

        this.pointCount++;
        if (this.pointCount <= Orbit.MAX_POINT_COUNT) {
            this.line.geometry.setDrawRange(Orbit.MAX_POINT_COUNT - this.pointCount, this.pointCount);
        }
        this.line.geometry.attributes.position.needsUpdate = true;
    }
}

const simulators = [
    new Simulator(
        [160, 400],
        [
            [-5 / Math.sqrt(2), 0, -5 / Math.sqrt(2)],
            [5 / Math.sqrt(2), 0, 5 / Math.sqrt(2)],
        ],
        [
            [-2 / Math.sqrt(2), 0, 2 / Math.sqrt(2)],
            [3 / Math.sqrt(2), 0, -3 / Math.sqrt(2)],
        ]
    ),
    new Simulator(
        [95, 100, 50],
        [[2, 6, 0], [-2, -1, 0], [1, -1, 0]],
        [[0, 0, 1], [1, 0, -4], [0, 0, 0]]
    ),
    new Simulator(
        [25, 3, 4, 500],
        [[5, 7, 0], [-4, -2, 0], [5, -2, 0], [0, 0, 0]],
        [[0, -4, 5], [8, -8, -4], [0, 8, 0], [0, 0, 0]]
    )
];

let simulator;
const planets = [];
const planetMeshes = [];
let isRunning = false;

// 毎フレーム時に実行されるループイベント
function tick() {
    let positions, t;

    if (isRunning) {
        for (let i = 0; i < 1; i++) {
            [t, positions] = simulator.calcPositions();
        }
    
        for (let i in simulator.masses) {
            planets[i].setPosition(positions[i]);
        }
    }

    controls.update();
    composer.render();

    requestAnimationFrame(tick);
}

function startSimulation(simulatorId) {
    simulator = simulators[simulatorId];
    simulator.reset();
    
    const palette = HslPalette(40, 100, 60);
    for (let i in simulator.masses) {
        planets.push(new Planet(
            scene,
            palette.next()['value'],
            0.3 * Math.cbrt(simulator.masses[i] / Math.min(...simulator.masses)),
            `planet${i}`
        ));
        planetMeshes.push(planets[planets.length - 1].mesh);
    }

    isRunning = true;
}

function endSimulation() {
    isRunning = false;

    while (planets.length > 0) {
        let planet = planets.shift();
        planet.removeFromScene(scene);
        planetMeshes.shift();
    }
}

function pauseAndRestartSimulation() {
    isRunning = !isRunning;
}

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

function onPointerMove(event) {
    if (!event.isPrimary) { return; }

    const element = event.currentTarget;

    // canvas要素上のXY座標
    const x = event.clientX - element.offsetLeft;
    const y = event.clientY - element.offsetTop;

    // canvas要素の幅・高さ
    const w = element.offsetWidth;
    const h = element.offsetHeight;

    mouse.x = (x / w) * 2 - 1
    mouse.y = -(y / h) * 2 + 1;

    checkIntersection();
}

function checkIntersection() {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planetMeshes, true);

    if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        console.log(selectedObject.name);
        outlinePass.selectedObjects = [selectedObject];
    }
}

document.querySelector('#sample0').addEventListener('click', e => { endSimulation(); startSimulation(0); });
document.querySelector('#sample1').addEventListener('click', e => { endSimulation(); startSimulation(1); });
document.querySelector('#sample2').addEventListener('click', e => { endSimulation(); startSimulation(2); });
document.querySelector('#pauseAndRestart').addEventListener('click', e => { pauseAndRestartSimulation(); });

canvas.addEventListener('pointermove', onPointerMove);

startSimulation(0);
tick();