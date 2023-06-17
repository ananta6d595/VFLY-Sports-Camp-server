const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
var jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

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
    // TODO: get token from localStorage sent by client side by headers of Api by fetch operation
    // or watch 78-8 module at 11 minute

    const authorization = req.headers.authorization;
    // console.log(req.headers);
    if (!authorization) {
        res.status(401).send({ error: true, message: "unauthorized access" });
    }
    const token = authorization.split(" ")[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err) {
            return res
                .status(401)
                .send({ error: true, message: "unauthorized access" });
        }
        req.decode = decode;
        next();
    });
};

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
        // await client.connect();
        const usersCollection = client.db("campDb").collection("users");
        const classCollection = client.db("campDb").collection("classes");
        const selectedClassesCollection = client.db("campDb").collection("selectedClasses");

        app.post("/jwt", (req, res) => {
            const data = req.body;

            const token = jwt.sign(data, process.env.ACCESS_TOKEN_SECRET,
                {
                    expiresIn: "2h",
                }
            );
            res.send({ token });
        });

        // add new class
        app.post('/instructor/addClass', async (req, res) => {
            const newClassData = req.body;

            const result = await classCollection.insertOne(newClassData);
            res.send(result);
        })

        // save selected class
        app.patch('/selectedClasses', async (req, res) => {
            const selectedClassData = req.body;
            const updateDoc = {
                $set: selectedClassData
            }
            const option = { upsert: true }
            const result = await selectedClassesCollection.updateOne(selectedClassData, updateDoc, option);
            res.send(result);
        })


        // get selected classes
        app.get('/selectedClasses/:email', async (req, res) => {
            const email = req.params.email;

            const filter = { email: email }
            const selectedClasses = await selectedClassesCollection.find(filter).toArray();

            const allClasses = await classCollection.find().toArray();
            const selectedClassDetails = allClasses.filter((all) => selectedClasses.some((selected) => {

                return all._id.toHexString() === selected.class_id
            }))
            // console.log(selectedClassDetails);
            res.send(selectedClassDetails);
        })

        //delete selected class
        app.delete('/selected/:id', async (req, res) => {
            const id = req.params.id;
            const query = { class_id: id }
            const result = await selectedClassesCollection.deleteOne(query);
            res.send(result);
        })

        // get all classes for admin classes
        app.get('/allClasses', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result);
        })
        app.get('/approvedClasses', async (req, res) => {

            const query = { status: "approved" }
            const result = await classCollection.find(query).toArray();
            res.send(result);
        })

        // change class status from pending by admin
        app.patch('/updateStatus', async (req, res) => {
            const classData = req.body;
            const query = { _id: new ObjectId(classData.id) }
            const updateDoc = {
                $set: {
                    status: classData.status,
                }
            }
            const result = await classCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        // add or update feedback to classes, specially that are denied.
        app.patch('/feedBack/:id', async (req, res) => {
            const id = req.params.id;

            const classData = req.body;

            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    feedback: classData.feedback,
                }
            }
            const result = await classCollection.updateOne(query, updateDoc);
            res.send(result);
        })


        // specific instructor's all classes
        app.get('/instructor/classes/:email', async (req, res) => {
            const email = req.params.email;

            const query = {
                instructor_mail
                    : email
            }
            const result = await classCollection.find(query).toArray();
            res.send(result);
        })

        // get single class of instructor for update based on _id
        app.get('/instructor/class/:id', async (req, res) => {
            const id = req.params.id;

            const query = {
                _id: new ObjectId(id)
            }
            const result = await classCollection.findOne(query);
            res.send(result);
        })


        // update class
        app.patch(`/instructor/updateClass/:id`, async (req, res) => {
            const id = req.params.id;
            const classUpdate = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: classUpdate
            }
            const result = await classCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        // get a student's class data jwt// TODO: Dummy api
        app.get("/classes", verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodeEmail = req.decode.email;
            if (email !== decodeEmail) {
                return res
                    .status(403)
                    .send({ error: true, message: "Forbidden access" });
            }

            const query = { email: email };
            const result = await classCollection.find(query).toArray();
            res.send(result);
        });
        // get all users
        app.get("/users", verifyJWT, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });
        app.get("/users/instructor", async (req, res) => {
            const query = {
                role: 'instructor'
            }
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });
        //save unique users
        app.patch("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const update = {
                $set: { ...user, role: "student" },
            };
            const options = { upsert: true };
            const result = await usersCollection.updateOne(
                query,
                update,
                options
            );
            res.send(result);
        });

        // role maker apis update role based on Admin input
        app.patch("/admin/:id", async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "admin",
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        //update role to instructor based on admin input
        app.patch("/instructor/:id", async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "instructor",
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // verify if the user email has admin role or not. if not then
        // Warning: use verifyJWT before using verifyAdmin
        // TODO: getting jwt connection error when using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }


        // security layer: verifyJWT
        // is email same?
        //
        // check is admin

        app.get("/isAdmin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decode.email !== email) {
                res.send({ admin: false });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = {
                admin: user?.role === "admin",
            };
            res.send(result);
        });
        //
        // check is instructor
        app.get("/isInstructor/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decode.email !== email) {
                res.send({ instructor: false });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = {
                instructor: user?.role === "instructor",
            };
            res.send(result);
        });
        app.get("/isStudent/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decode.email !== email) {
                res.send({ student: false });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = {
                student: user?.role === "student",
            };

            res.send(result);
        });


        //payment
        app.post('/create-payment-intent',   async (req, res) => {
            const {price} = req.body;
            const amount = parseInt(price) * 100;
            console.log("amount:", amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })

        })

        // create payment intent
        // app.post('/create-payment-intent', verifyJWT, async (req, res) => {
        //     const { price } = req.body
        //     const amount = parseFloat(price) * 100
        //     if (!price) return
        //     const paymentIntent = await stripe.paymentIntents.create({
        //         amount: amount,
        //         currency: 'usd',
        //         payment_method_types: ['card'],
        //     })

        //     res.send({
        //         clientSecret: paymentIntent.client_secret,
        //     })
        // })










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
