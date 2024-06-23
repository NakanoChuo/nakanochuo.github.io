export function* RK4(func, delta_t, init_value) {
    let count = 0;
    let t = count * delta_t;
    let value = init_value;
    yield [t, value];

    while (true) {
        let k1 = func(t, value);
        let k2 = func(t + delta_t / 2, math.add(value, math.multiply(k1, delta_t / 2)));
        let k3 = func(t + delta_t / 2, math.add(value, math.multiply(k2, delta_t / 2)));
        let k4 = func(t + delta_t, math.add(value, math.multiply(k3, delta_t)));

        count++;
        t = count * delta_t;
        value = math.chain(k1).add(math.multiply(k2, 2)).add(math.multiply(k3, 2)).add(k4).multiply(delta_t / 6).add(value).done();

        yield [t, value];
    }
}
