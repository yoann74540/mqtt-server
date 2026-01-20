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

export async function writtingHeaterState(uid, state){
    try{
        await db.doc("system/state").set({
            heater: state,
            updateAt:  admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid,
        },{ merge: true});
        console.log("Etat chauffage enregistré :", state);
    }catch(err){
        console.log(err);
        throw new Error(err);
    }
}

export async function addhistoryEntry(userEmail, type, value){
    const historyRef = db.collection("system").doc("global").collection("history");
    try{
        await historyRef.add({
            userEmail: userEmail,
            type: type,
            value: value,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const snapshot = await historyRef.orderBy("createdAt", "desc").get();
        const entries = snapshot.docs;

        if(entries.length > 10){
            let keepTemp = null;
            for(const doc of entries){
                const data = doc.data();
                if( data.type === "temperature"){
                    keepTemp = doc.id;
                    break
                }
            }
            for(let i = entries.length -1; i >=10; i--){
                const docId = snapshot.docs[i].id;
                if(docId !== keepTemp){
                    await historyRef.doc(docId).delete();
                }       
            }
        }

        console.log("Etat chauffage enregistré dans historique:", value);
    }catch(err){
        console.log(err);
        throw new Error(err);
    }
}