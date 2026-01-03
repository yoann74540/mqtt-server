import express from "express";
import mqtt from "mqtt";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const{
    AIO_USERNAME,
    AIO_KEY
} = process.env;

app.post("/heater", (req, res) => {
    console.log("Headers", req.headers);
    console.log("Body reçu", req.body);
    const {state} = req.body;

    if(typeof state !== "boolean"){
        return res.status(400).json({
            error: "Invalid state",
            received: req.body
        });
    }

    const topic = `${AIO_USERNAME}/feeds/chauffage`;

    const client = mqtt.connect("mqtts://io.adafruit.com", {
        username: AIO_USERNAME,
        password: AIO_KEY
    });

    client.on("connect", () => {
        client.publish(topic, state ? "ON" : "OFF", {}, () => {
            setTimeout(() => client.end(), 300);
            res.json({ success: true });
        });
    });

    client.on("error", err => {
        client.end();
        res.status(500).json({ error: err.message });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("server running on", PORT)
});