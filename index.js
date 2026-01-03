import express from "express";
import mqtt from "mqtt";
import cors from "cors";
import {auth} from "./firebaseAdmin.js"

const app = express();
app.use(cors());
app.use(express.json());

const{
    AIO_USERNAME,
    AIO_KEY
} = process.env;

app.post("/heater", async (req, res) => {
    console.log("Headers", req.headers);
    console.log("Body reçu", req.body);
    const {state} = req.body;

    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if(!idToken) return res.status(401).json({ error: "No token provided" });

    try{
        const decodedToken = await auth.verifyIdToken(idToken);
        console.log("UID de l'utilisateur :", decodedToken.uid);

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

    }catch(err){
        console.error(err);
        res.status(403).json({ error : "Token invalide"});
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("server running on", PORT)
});