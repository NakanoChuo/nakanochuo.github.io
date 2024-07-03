import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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

// const simulator = new Simulator(
//     0.01,
//     [2, 10],
//     [
//         [-4 / Math.sqrt(2), 0, -4 / Math.sqrt(2)],
//         [4 / Math.sqrt(2), 0, 4 / Math.sqrt(2)],
//     ],
//     [
//         [-1 / Math.sqrt(2) / 2, 0, 1 / Math.sqrt(2) / 2],
//         [1 / Math.sqrt(2) / 4, 0, -1 / Math.sqrt(2) / 4],
//     ]
// )
// const simulator = new Simulator(
//     0.01,                                 // 時間幅
//     [5.95, 3.05, 4.95],                              // 質量
//     [[1, 3, 0], [-2, -1, 0], [1, -1, 0]],   // 初期位置
//     [[0, 0, 1], [0, 0, -1], [0, 0, 0]]       // 初速度
// );
const simulator = new Simulator(
    [25, 3, 4, 500],                              // 質量
    [[5, 7, 0], [-4, -2, 0], [5, -2, 0], [0, 0, 0]],   // 初期位置
    [[0, -4, 5], [8, -8, -4], [0, 8, 0], [0, 0, 0]]       // 初速度
);

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
    constructor(scene, color, radius) {
        this.geometry = new THREE.SphereGeometry(radius);
        this.material = new THREE.MeshToonMaterial({ color: color });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        scene.add(this.mesh);

        this.orbit = new Orbit(scene, color);

        this.setPositionCount = 0;
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
        let points = [];
        let vertexColors = [];
        for (let i = 0; i < Orbit.MAX_POINT_COUNT; i++) {
            points.push(new THREE.Vector3());
            vertexColors.push(color.r, color.g, color.b, 1 / Orbit.MAX_POINT_COUNT * i);
        }

        this.geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 4));
        this.geometry.setDrawRange(0, 0);

        this.material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });

        this.line = new THREE.Line(this.geometry, this.material);
        scene.add(this.line);

        this.pointCount = 0;
    }

    addPoint(position) {
        let positions = this.geometry.attributes.position.array;

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
            this.geometry.setDrawRange(Orbit.MAX_POINT_COUNT - this.pointCount, this.pointCount);
        }
        this.geometry.attributes.position.needsUpdate = true;
    }
}

let palette = HslPalette(40, 100, 60);
let planets = [];
for (let mass of simulator.masses) {
    planets.push(new Planet(
        scene,
        palette.next()['value'],
        0.3 * Math.cbrt(mass / Math.min(...simulator.masses))
    ));
}

let t = 0;

// 毎フレーム時に実行されるループイベント
function tick() {
    let positions;

    for (let i = 0; i < 1; i++) {
        [t, positions] = simulator.calcPositions();
    }

    for (let i in simulator.masses) {
        planets[i].setPosition(positions[i]);
    }

    controls.update();
    renderer.render(scene, camera);

    requestAnimationFrame(tick);
}
tick();
