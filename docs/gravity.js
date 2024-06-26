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
    0.01,                                 // 時間幅
    [25, 3, 4, 500],                              // 質量
    [[5, 7, 0], [-4, -2, 0], [5, -2, 0], [0, 0, 0]],   // 初期位置
    [[0, -4, 5], [8, -8, -4], [0, 8, 0], [0, 0, 0]]       // 初速度
);

function* HSL_palette(init_h, s, l) {
    let count = 0;
    let h = init_h;
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

let palette = HSL_palette(40, 100, 60);
let sphere_colors = [];
let spheres = [];
for (let i in simulator.masses) {
    let radius = 0.3 * Math.cbrt(simulator.masses[i] / Math.min(...simulator.masses));
    sphere_colors.push(palette.next()['value']);
    spheres.push(
        new THREE.Mesh(
            new THREE.SphereGeometry(radius),
            new THREE.MeshToonMaterial({ color: sphere_colors[i] })
        )
    );
    scene.add(spheres[spheres.length - 1]);
}

let sphere_orbits = [];
const MAX_POINT_COUNT = 100;
for  (let i in simulator.masses) {
    let points = [];
    for (let j = 0; j < MAX_POINT_COUNT; j++) {
        points.push(new THREE.Vector3());
    }

    let vertex_colors = [];
    for (let j = 0; j < MAX_POINT_COUNT; j++) {
        vertex_colors.push(sphere_colors[i].r, sphere_colors[i].g, sphere_colors[i].b, 1 / MAX_POINT_COUNT * j);
    }

    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( vertex_colors, 4 ) );
    geometry.setDrawRange(0, 0);
    sphere_orbits.push(
        new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
            })
        )
    );

    scene.add(sphere_orbits[sphere_orbits.length - 1]);
}

// 軌道に点を追加
function addOrbitPoint(orbit, point, index) {
    let positions = orbit.geometry.attributes.position.array;

    for (let i = 0; i < MAX_POINT_COUNT - 1; i++) {
        positions[i * 3 + 0] = positions[(i + 1) * 3 + 0];
        positions[i * 3 + 1] = positions[(i + 1) * 3 + 1];
        positions[i * 3 + 2] = positions[(i + 1) * 3 + 2];
    }
    positions[(MAX_POINT_COUNT - 1) * 3 + 0] = point[0];
    positions[(MAX_POINT_COUNT - 1) * 3 + 1] = point[1];
    positions[(MAX_POINT_COUNT - 1) * 3 + 2] = point[2];

    if (index < MAX_POINT_COUNT) {
        orbit.geometry.setDrawRange(MAX_POINT_COUNT - index - 1, index + 1);
    }
    orbit.geometry.attributes.position.needsUpdate = true;
}

let t = 0;
let count = 0;

// 毎フレーム時に実行されるループイベント
function tick() {
    let positions;

    for (let i = 0; i < 1; i++) {
        [t, positions] = simulator.calc_positions();
    }

    for (let i in simulator.masses) {
        spheres[i].position.set(...positions[i]);
    }

    const DRAW_POINT_INTERVAL = 4;
    if (count % DRAW_POINT_INTERVAL == 0) {
        for (let i in simulator.masses) {
            addOrbitPoint(sphere_orbits[i], positions[i], Math.round(count / DRAW_POINT_INTERVAL));
        }
    }
    count++;

    controls.update();
    renderer.render(scene, camera);

    requestAnimationFrame(tick);
}
tick();
