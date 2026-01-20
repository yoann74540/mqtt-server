import express from "express";
import mqtt from "mqtt";
import cors from "cors";
import {writtingHeaterState, verifyFirebaseToken, canSendMQTT, MqttLimitError, addhistoryEntry} from "./firebaseAdmin.js"

const app = express();
app.use(cors());
app.use(express.json());

const{
    AIO_USERNAME,
    AIO_KEY
} = process.env;

app.post("/heater", verifyFirebaseToken, async (req, res) => {

    console.log("Headers", req.headers);
    console.log("Body reçu", req.body);

    const {state} = req.body;

    console.log("command de", req.user.email, "->", state);

    try{
        const message = state ? "ON": "OFF";
        if(typeof state !== "boolean"){
            return res.status(400).json({
                error: "Invalid state",
                received: req.body
            });
        }

        await canSendMQTT(req.user.uid);

        const topic = `${AIO_USERNAME}/feeds/chauffage`;

        const client = mqtt.connect("mqtts://io.adafruit.com", {
            username: AIO_USERNAME,
            password: AIO_KEY
        });

        client.on("connect", () => {
            client.publish(topic, message, {}, () => {
                setTimeout(() => client.end(), 300);
                res.json({ success: true });
            });
        });

        client.on("error", err => {
            client.end();
            res.status(500).json({ error: err.message });
        });

        await writtingHeaterState(req.user.uid, message);

        await addhistoryEntry(req.user.email, "heater", state);

    } catch(err){
        console.log(err.message);
        if( err instanceof MqttLimitError ){
            return res.status(429).json( { error: err.message } );
        }else{
            return res.status(500).json( {error: "Servor error"} );
        }
    }

});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("server running on", PORT)
});