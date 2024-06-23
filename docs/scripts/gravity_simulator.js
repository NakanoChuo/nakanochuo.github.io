import { RK4 } from "./RK4.js"

export class Simulator {
    constructor(delta_t, masses, init_positions, init_velocities) {
        this.masses = masses;                                   // 質量 [kg]
        this.init_pos_matrix = math.matrix(init_positions);     // 初期位置 [m]
        this.init_vel_matrix = math.matrix(init_velocities);    // 初速度 [m/s]

        let pos_size = this.init_pos_matrix.size();
        let vel_size = this.init_vel_matrix.size();
        console.assert(pos_size[0] == this.masses.length && pos_size[1] == 3);
        console.assert(vel_size[0] == this.masses.length && vel_size[1] == 3);

        // 重心位置
        let gravityPos = math.divide(math.sum(math.dotMultiply(this.init_pos_matrix, math.matrix(masses).reshape([masses.length, 1])), 0), math.sum(masses));
        this.init_pos_matrix = math.subtract(this.init_pos_matrix, gravityPos);

        // 重心速度
        let gravityVel = math.divide(math.sum(math.dotMultiply(this.init_vel_matrix, math.matrix(masses).reshape([masses.length, 1])), 0), math.sum(masses));
        this.init_vel_matrix = math.subtract(this.init_vel_matrix, gravityVel);

        this.G = 1; // 万有引力定数 [m^3 / kg / s^2]

        this.RK4_iter = RK4(
            (t, pos_vel_matrix) => {
                let pos_matrix = pos_vel_matrix.subset(math.index(0, math.range(0, masses.length), [0, 1, 2])).reshape([masses.length, 3]);
                let vel_matrix = pos_vel_matrix.subset(math.index(1, math.range(0, masses.length), [0, 1, 2])).reshape([masses.length, 3]);
                return math.matrix(this.calc_derivatives(pos_matrix, vel_matrix));
            },
            delta_t,
            math.matrix([this.init_pos_matrix, this.init_vel_matrix])
        );
    }

    calc_positions() {
        let { value: [time, pos_vel_matrix] } = this.RK4_iter.next();
        for (let i in this.masses) {
            for (let j in this.masses) {
                if (i == j) { continue; }
                let pos1 = pos_vel_matrix.subset(math.index(0, Number(i), [0, 1, 2])).reshape([3]);
                let pos2 = pos_vel_matrix.subset(math.index(0, Number(j), [0, 1, 2])).reshape([3]);
                let norm = math.norm(math.subtract(pos1, pos2));
                if (this.min == undefined || this.min > norm) {
                    this.min = norm;
                }
            }
        }
        return [
            time, 
            pos_vel_matrix.subset(math.index(0, math.range(0, this.masses.length), [0, 1, 2])).reshape([this.masses.length, 3]).toArray()
        ];
    }

    // 位置、速度の時間微分（速度、加速度）を返す
    calc_derivatives(pos_matrix, vel_matrix) {
        return [vel_matrix, this.calc_accelerators(pos_matrix)];
    }

    // 加速度の計算
    calc_accelerators(pos_matrix) {
        // acc_matrix[i, j]: 質点jからの万有引力から生じる質点iの加速度
        let acc_matrix = math.zeros(this.masses.length, this.masses.length, 3);
        for (let i = 0; i < this.masses.length; i++) {
            for (let j = 0; j < this.masses.length; j++) {
                if (i != j) {
                    let pos1 = pos_matrix.subset(math.index(i, [0, 1, 2])).reshape([3]);
                    let pos2 = pos_matrix.subset(math.index(j, [0, 1, 2])).reshape([3]);
                    let vec = math.subtract(pos1, pos2);
                    let acc = math.multiply(vec, -this.G * this.masses[j] / math.norm(vec) ** 3)
    
                    acc_matrix.subset(math.index(i, j, [0, 1, 2]), acc);
                }
            }
        }

        return math.sum(acc_matrix, 1);
    }
}