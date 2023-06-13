const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

const corsConfig = {
    origin: "*",
    credential: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
};
//middleware
app.use(cors(corsConfig));
app.use(express.json());

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

        app.get("/users", async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.patch("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const update = {
                $set: user,
            };
            const options = { upsert: true };
            const result = await userCollection.updateOne(
                query,
                update,
                options
            );
            res.send(result);
        });

        app.patch("/admin/:id", async (req, res) => {
            const id = req.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "admin",
                },
            };
            const result = await userCollection.updateMany(filter, updateDoc);
            return res.send(result);
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
