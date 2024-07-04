import { RK4 } from "./RK4.js"

export class Simulator {
    static get G() { return 1; }            // 万有引力定数 [m^3 / kg /s^2]
    static get deltaT() { return 0.01; }    // 時間幅 [s]

    constructor(masses, initPositions, initVelocities) {
        this.masses = masses;                                   // 質量 [kg]
        this.initPosMatrix = math.matrix(initPositions);     // 初期位置 [m]
        this.initVelMatrix = math.matrix(initVelocities);    // 初速度 [m/s]

        let posSize = this.initPosMatrix.size();
        let velSize = this.initVelMatrix.size();
        console.assert(posSize[0] == this.masses.length && posSize[1] == 3);
        console.assert(velSize[0] == this.masses.length && velSize[1] == 3);

        // 重心位置
        let gravityPos = math.divide(math.sum(math.dotMultiply(this.initPosMatrix, math.matrix(masses).reshape([masses.length, 1])), 0), math.sum(masses));
        this.initPosMatrix = math.subtract(this.initPosMatrix, gravityPos);

        // 重心速度
        let gravityVel = math.divide(math.sum(math.dotMultiply(this.initVelMatrix, math.matrix(masses).reshape([masses.length, 1])), 0), math.sum(masses));
        this.initVelMatrix = math.subtract(this.initVelMatrix, gravityVel);
    }

    reset() {
        this.RK4iter = RK4(
            (t, posVelMatrix) => {
                let posMatrix = posVelMatrix.subset(math.index(0, math.range(0, this.masses.length), [0, 1, 2])).reshape([this.masses.length, 3]);
                let velMatrix = posVelMatrix.subset(math.index(1, math.range(0, this.masses.length), [0, 1, 2])).reshape([this.masses.length, 3]);
                return math.matrix(this.calcDerivatives(posMatrix, velMatrix));
            },
            Simulator.deltaT,
            math.matrix([this.initPosMatrix, this.initVelMatrix])
        );        
    }

    calcPositions() {
        let { value: [time, posVelMatrix] } = this.RK4iter.next();
        for (let i in this.masses) {
            for (let j in this.masses) {
                if (i == j) { continue; }
                let pos1 = posVelMatrix.subset(math.index(0, Number(i), [0, 1, 2])).reshape([3]);
                let pos2 = posVelMatrix.subset(math.index(0, Number(j), [0, 1, 2])).reshape([3]);
                let norm = math.norm(math.subtract(pos1, pos2));
                if (this.min == undefined || this.min > norm) {
                    this.min = norm;
                }
            }
        }
        return [
            time, 
            posVelMatrix.subset(math.index(0, math.range(0, this.masses.length), [0, 1, 2])).reshape([this.masses.length, 3]).toArray()
        ];
    }

    // 位置、速度の時間微分（速度、加速度）を返す
    calcDerivatives(posMatrix, velMatrix) {
        return [velMatrix, this.calcAccelerators(posMatrix)];
    }

    // 加速度の計算
    calcAccelerators(posMatrix) {
        // accMatrix[i, j]: 質点jからの万有引力から生じる質点iの加速度
        let accMatrix = math.zeros(this.masses.length, this.masses.length, 3);
        for (let i = 0; i < this.masses.length; i++) {
            for (let j = 0; j < this.masses.length; j++) {
                if (i != j) {
                    let pos1 = posMatrix.subset(math.index(i, [0, 1, 2])).reshape([3]);
                    let pos2 = posMatrix.subset(math.index(j, [0, 1, 2])).reshape([3]);
                    let vec = math.subtract(pos1, pos2);
                    let acc = math.multiply(vec, -Simulator.G * this.masses[j] / math.norm(vec) ** 3)
    
                    accMatrix.subset(math.index(i, j, [0, 1, 2]), acc);
                }
            }
        }

        return math.sum(accMatrix, 1);
    }
}