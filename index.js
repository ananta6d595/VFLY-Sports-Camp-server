const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
var jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;

const corsConfig = {
    origin: "*",
    credential: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
};
//middleware
app.use(cors(corsConfig));
app.use(express.json());

const verifyJWT = (req, res, next) => {

    // TODO: get token sent by client side by headers of Api by fetch operation

    const authorization = req.headers.authorization;
    if (!authorization) {
        res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decode = decode;
        next();
    })
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3umwupw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const userCollection = client.db("campDb").collection("users");
        const classCollection = client.db("campDb").collection("classes");

        app.post("/jwt", (req, res) => {
            const data = req.body;
            const token = jwt.sign(data, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "2h",
            });
            res.send({ token });
        });


        // get a student's class data // TODO: Dummy api
        app.get("/classes", verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodeEmail = req.decode.email;
            if (email !== decodeEmail) {
                return res.status(403).send({error: true, message: 'Forbidden access'})
            }

            const query= {email:}
            const result = await userCollection.find().toArray();
            res.send(result);
        });
        // get all users
        app.get("/users",verifyJWT, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });
        //save unique users
        app.patch("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const update = {
                $set: { ...user, role: 'student' }
            };
            const options = { upsert: true };
            const result = await userCollection.updateOne(
                query,
                update,
                options
            );
            res.send(result);
        });

        // role maker apis
        app.patch("/admin/:id", async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "admin",
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.patch("/instructor/:id", async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "instructor",
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("kids are playing");
});

app.listen(port, () => {
    console.log(`playing ${port}`);
});
