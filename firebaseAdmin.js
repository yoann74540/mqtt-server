import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

export class MqttLimitError extends Error{
    constructor(message){
        super(message);
        this.name = "MqttLimitError";
    }
}

export async function verifyFirebaseToken(req, res, next){
    const authHeader = req.headers.authorization;
    if(!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "No token provided" });

    const idToken = authHeader.split("Bearer ")[1];

    try{
        const decodedToken = await auth.verifyIdToken(idToken);
        console.log("UID de l'utilisateur :", decodedToken.uid);
        req.user = decodedToken;
        next();
    }catch (err){
        return res.status(403).json({ error: "Token invalide"})
    }
}

export async function canSendMQTT(uid){
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    const limitsSnap = await db.doc("config/mqtt_limits").get();

    if(!limitsSnap.exists){
        throw new MqttLimitError("Limites MQTT absentes");
    }

    const limits = limitsSnap.data();

    const usageRef = db.doc("system/mqtt_usage");
    const usageSnap = await usageRef.get();

    let usage = usageSnap.exists ? usageSnap.data() : {
        minuteCount: 0,
        minuteWindow: now,
        dayCount: 0,
        dayWindow:today
    };

    if( now - usage.minuteWindow > 60000){
        usage.minuteWindow = now;
        usage.minuteCount = 0;
    }

    if(usage.dayWindow !== today){
        usage.dayWindow = today;
        usage.dayCount = 0;
    }

    if(usage.minuteCount >= limits.maxPerMinute){
        throw new MqttLimitError("Limite minute atteinte");
    }

    if(usage.dayCount >= limits.maxPerDay){
        throw new MqttLimitError("Quota journalier atteint");
    }

    usage.minuteCount++;
    usage.dayCount++;

    await usageRef.set(usage, { merge: true });

    return true;
}

