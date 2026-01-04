import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();

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