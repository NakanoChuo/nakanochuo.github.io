class HSV {
    constructor(h, s, v) {
        this.h = h % 360;
        if (this.h < 0) {
            this.h = (this.h + 360) % 360;
        }
        this.s = Math.max(0, Math.min(100, s));
        this.v = Math.max(0, Math.min(100, v));
    }

    toRGB() {
        let r, g, b;

        let max = this.v / 100 * 255;
        let min = max - ((this.s / 100) * max);

        if (this.h < 60) {
            r = max;
            g = (this.h / 60) * (max - min) + min;
            b = min;
        } else if (this.h < 120) {
            r = ((120 - this.h) / 60) * (max - min) + min;
            g = max;
            b = min;
        } else if (this.h < 180) {
            r = min;
            g = max;
            b = ((this.h - 120) / 60) * (max - min) + min;
        } else if (this.h < 240) {
            r = min;
            g = ((240 - this.h) / 60) * (max - min) + min;
            b = max;
        } else if (this.h < 300) {
            r = ((this.h - 240) / 60) * (max - min) + min;
            g = min;
            b = max;
        } else {
            r = max;
            g = min;
            b = ((360 - this.h) / 60) * (max - min) + min;
        }

        r = Math.floor(r);
        g = Math.floor(g);
        b = Math.floor(b);

        return r * Math.pow(16, 4) + g * Math.pow(16, 2) + b;
    }
}

export function* HSV_palette(init_h, s, v) {
    let count = 0;
    let h = init_h;
    yield new HSV(h, s, v);

    while (true) {
        let d1 = 120;
        let d2 = 30;

        count++;
        if (count % 3 == 0) { d1 = 180; }
        if (count % 6 == 0) { d1 = 180 - d2; d2 /= 2; }
        h = (h + d1) % 360;

        yield new HSV(h, s, v);
    }
}