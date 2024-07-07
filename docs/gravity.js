import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

import { Simulator } from "./scripts/gravity_simulator.js";

class Screen {
    constructor(width, height) {
        this.canvas = document.querySelector('#myCanvas');
        this.width = width;
        this.height = height;

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.width, this.height);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);  // 背景色

        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 1000);   // 視野角、アスペクト比、クリッピング開始距離、終了距離
        this.camera.position.set(0, 5, 10); // カメラ位置
        this.camera.lookAt(this.scene.position);    // 注視点を座標原点に

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;  // 滑らかにカメラコントローラを制御する
        this.controls.dampingFactor = 0.2;

        this.light = new THREE.DirectionalLight(0xFFFFFF, 4);
        this.light.position.set(1, 1, 1);
        this.scene.add(this.light);

        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
        this.composer.addPass(this.renderPass);
        this.composer.addPass(this.outlinePass);

        // グリッドの表示
        this.grid = new THREE.GridHelper(20, 10);   // 全体のサイズとマス数
        this.grid.material.opacity = 0.5;   // 透明度
        this.grid.material.transparent = true;
        this.scene.add(this.grid);

        // シーンに表示する天体
        this.planets = [];
        this.planetPalette = HslPalette(60, 100, 60);   // 天体の色を生成するジェネレータ

        // シミュレーション
        this.simulationControler = new SimulationControler(this);

        // 入力イベント
        this.canvas.addEventListener('pointermove', (e) => { this.onPointerMove(e); }); // 画面上でポインタを動かす
        for (let i = 0; i < 3; i++) {
            document.querySelector(`#sample${i}`).addEventListener('click', (e) => { this.switchSimulation(i); });  // シミュレーションのサンプルの切り替えボタン
        }
        document.querySelector('#pauseAndRestart').addEventListener('click', (e) => { this.simulationControler.pauseAndRestart(); });   // シミュレーションの停止／再開ボタン

        this.switchSimulation(0);
    }

    addPlanet(size, name) {
        this.planets.push(new Planet(this.scene, this.planetPalette.next()['value'], size, name));
    }
 
    removePlanet() {
        const planet = this.planets.shift();
        planet.removeFromScene(this.scene);
    }

    // 画面更新
    update() {
        if (this.simulationControler.isRunning) {
            const [t, positions] = this.simulationControler.update();
            for (let i in this.planets) {
                this.planets[i].setPosition(positions[i]);
            }
        }
    
        this.controls.update();
        this.composer.render();
    }

    // シミュレーションのサンプルの切り替え
    switchSimulation(simulatorId) {        
        this.simulationControler.end();
        this.planetPalette = HslPalette(60, 100, 60);
        this.simulationControler.start(simulatorId);
    }

    onPointerMove(event) {
        if (!event.isPrimary) { return; }
        
        const element = event.currentTarget;
        
        // canvas要素上のXY座標
        const x = event.clientX - element.offsetLeft;
        const y = event.clientY - element.offsetTop;
        
        // canvas要素の幅・高さ
        const w = element.offsetWidth;
        const h = element.offsetHeight;

        const intersectedPlanet = this.checkPlanetIntersection((x / w) * 2 - 1, -(y / h) * 2 + 1);  // ポインタ上に天体があるか調べる
        if (intersectedPlanet !== undefined) {  // ポインタ上に天体がある場合
            console.log(intersectedPlanet.name);
            this.outlinePass.selectedObjects = [intersectedPlanet]; // アウトラインを表示する
        }
    }

    // 画面上のx, y座標上に天体があるかどうか
    checkPlanetIntersection(x, y) {
        const planetMeshes = this.planets.map((planet) => planet.mesh);

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
        const intersects = raycaster.intersectObjects(planetMeshes, true);
    
        if (intersects.length > 0) {
            return intersects[0].object;
        }
    }
}

// 色を生成するジェネレータ
function* HslPalette(initH, s, l) {
    let count = 0;
    let h = initH;
    yield new THREE.Color(`hsl(${h}, ${s}%, ${l}%)`);

    let d1 = 60;
    let d2 = 120;
    while (true) {
        count++;
        if (count % 3 != 0 ) { h = (h + 120) % 360; }
        else {
            h = (initH + d1) % 360;
            d1 += d2;
            if (d1 >= 120) {
                d2 /= 2;
                d1 = d2 / 2;
            }
        }
        yield new THREE.Color(`hsl(${h}, ${s}%, ${l}%)`);
    }
}

// 天体表示用クラス
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

// 天体軌道表示用クラス
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

// シミュレータ管理用
class SimulationControler {
    // シミュレーションのサンプル
    simulators = [
        new Simulator(
            [160, 400], // 質量
            [   // 初期位置
                [-5 / Math.sqrt(2), 0, -5 / Math.sqrt(2)],
                [5 / Math.sqrt(2), 0, 5 / Math.sqrt(2)],
            ],
            [   // 初期速度
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

    constructor(screen) {
        this.screen = screen;
    }

    start(simulatorId) {
        this.simulator = this.simulators[simulatorId];
        this.simulator.reset();

        for (let i in this.simulator.masses) {
            // 天体オブジェクトを画面に追加
            this.screen.addPlanet(0.3 * Math.cbrt(this.simulator.masses[i] / Math.min(...this.simulator.masses)), `planet${i}`);
        }

        this.isRunning = true;
    }

    end() {
        this.isRunning = false;

        if (this.simulator !== undefined) {
            for (let i in this.simulator.masses) {
                // 天体オブジェクトを画面から削除
                this.screen.removePlanet();
            }
        }
    }

    pauseAndRestart() {
        this.isRunning = !this.isRunning;
    }

    update() {
        if (!this.isRunning) { return; }
        return this.simulator.calcPositions();
    }
}

const screen = new Screen(960, 540);

function tick() {
    screen.update();
    requestAnimationFrame(tick);
}
tick();