export function* RK4(func, deltaT, initValue) {
    let count = 0;
    let t = count * deltaT;
    let value = initValue;
    yield [t, value];

    while (true) {
        let k1 = func(t, value);
        let k2 = func(t + deltaT / 2, math.add(value, math.multiply(k1, deltaT / 2)));
        let k3 = func(t + deltaT / 2, math.add(value, math.multiply(k2, deltaT / 2)));
        let k4 = func(t + deltaT, math.add(value, math.multiply(k3, deltaT)));

        count++;
        t = count * deltaT;
        value = math.chain(k1).add(math.multiply(k2, 2)).add(math.multiply(k3, 2)).add(k4).multiply(deltaT / 6).add(value).done();

        yield [t, value];
    }
}
