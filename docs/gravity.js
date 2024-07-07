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

        // シミュレーション
        this.simulationControler = new SimulationControler(this);

        // 入力イベント
        this.canvas.addEventListener('pointermove', (e) => { this.onPointerMove(e); });
        for (let i = 0; i < 3; i++) {
            document.querySelector(`#sample${i}`).addEventListener('click', (e) => { this.simulationControler.end(); this.simulationControler.start(i); });
        }
        document.querySelector('#pauseAndRestart').addEventListener('click', (e) => { this.simulationControler.pauseAndRestart(); });
    }

    addPlanet = (() => {
        const palette = HslPalette(40, 100, 60);

        return (size, name) => {
            this.planets.push(new Planet(this.scene, palette.next()['value'], size, name));
        }
    })();

    removePlanet() {
        const planet = this.planets.shift();
        planet.removeFromScene(this.scene);
    }

    update() {
        if (this.simulationControler.isRunning) {
            const [t, positions] = this.simulationControler.update();
            for (let i in this.planets) {
                this.planets[i].setPosition(positions[i]);
            }
        }
    
        this.controls.update();
        this.composer.render();
    
        requestAnimationFrame(this.update.bind(this));
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
        
        this.checkIntersection((x / w) * 2 - 1, -(y / h) * 2 + 1);
    }
    
    checkIntersection(x, y) {
        const planetMeshes = this.planets.map((planet) => planet.mesh);

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
        const intersects = raycaster.intersectObjects(planetMeshes, true);
    
        if (intersects.length > 0) {
            const selectedObject = intersects[0].object;
            console.log(selectedObject.name);
            this.outlinePass.selectedObjects = [selectedObject];
        }
    }
}

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

class SimulationControler {
    simulators = [
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

    constructor(screen) {
        this.screen = screen;
        this.start(0);
    }

    start(simulatorId) {
        this.simulator = this.simulators[simulatorId];
        this.simulator.reset();

        for (let i in this.simulator.masses) {
            this.screen.addPlanet(0.3 * Math.cbrt(this.simulator.masses[i] / Math.min(...this.simulator.masses)), `planet${i}`);
        }

        this.isRunning = true;
    }

    end() {
        this.isRunning = false;

        for (let i in this.simulator.masses) {
            this.screen.removePlanet();
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
screen.update();