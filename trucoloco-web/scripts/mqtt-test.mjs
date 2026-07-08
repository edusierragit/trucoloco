import mqtt from "mqtt";
const test = (url) => new Promise((resolve) => {
  const c = mqtt.connect(url, { connectTimeout: 6000, reconnectPeriod: 0 });
  const t = setTimeout(() => { c.end(true); resolve(`${url} TIMEOUT`); }, 9000);
  c.on("connect", () => {
    clearTimeout(t);
    const topic = "trucoloco/selftest/" + Math.random().toString(36).slice(2);
    c.subscribe(topic, () => c.publish(topic, "hola"));
    c.on("message", () => { c.end(true); resolve(`${url} CONECTA Y ECO OK`); });
    setTimeout(() => { c.end(true); resolve(`${url} conecta pero SIN eco`); }, 5000);
  });
  c.on("error", (e) => { clearTimeout(t); c.end(true); resolve(`${url} ERROR ${e.message}`); });
});
for (const u of ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt", "wss://test.mosquitto.org:8081"]) {
  console.log(await test(u));
}
