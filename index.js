const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
// const serviceAccount = require("./serviceKey.json");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64"
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.ogeopwy.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verify user

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }
  const token = authorization.split(" ")[1];

  try {
    await admin.auth().verifyIdToken(token);
    next();
  } catch (error) {
    res.status(401).send({
      message: "Unauthorized access",
    });
  }
};

app.get("/", (req, res) => {
  res.send("Krishilink server is running");
});

async function run() {
  try {
    // await client.connect();

    const db = client.db("crops_db");
    const cropCollection = db.collection("crops");
    const interestCollection = db.collection("interests");

    app.get("/crops", async (req, res) => {
      const result = await cropCollection.find().toArray();

      res.send(result);
    });

    app.get("/crops/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      // console.log(id);

      const result = await cropCollection.findOne({ _id: new ObjectId(id) });

      res.send({
        success: true,
        result,
      });
    });

    // post
    // insertOne
    // insertMany

    app.post("/crops", async (req, res) => {
      const d = req.body;

      const result = await cropCollection.insertOne(d);
      res.send({
        success: true,
        result,
      });
    });

    // interests

    app.post("/interests/:id", async (req, res) => {
      try {
        const { userEmail, userName, quantity, message, status } = req.body;
        const cropId = new ObjectId(req.params.id); // Always ObjectId

        // Check duplicate
        const existingInterest = await interestCollection.findOne({
          userEmail,
          cropId: cropId,
        });

        if (existingInterest) {
          return res.status(400).json({
            success: false,
            message: "You already submitted interest for this crop.",
          });
        }

        // Insert into interestCollection
        const result = await interestCollection.insertOne({
          cropId,
          userEmail,
          userName,
          quantity,
          message,
          status,
          createdAt: new Date(),
        });

        // Push into cropCollection
        await cropCollection.updateOne(
          { _id: cropId },
          {
            $push: {
              interests: {
                _id: result.insertedId,
                cropId,
                userEmail,
                userName,
                quantity,
                message,
                status,
                createdAt: new Date(),
              },
            },
          }
        );

        return res.json({
          success: true,
          message: "Interest added successfully",
          interestResult: result,
        });
      } catch (error) {
        console.error(error);
        return res.status(500).json({
          success: false,
          message: "Server Error",
        });
      }
    });

    // my interest

    app.get("/my-interests", verifyToken, async (req, res) => {
      const email = req.query.email;

      const result = await cropCollection
        .find({ "interests.userEmail": email })
        .toArray();
      console.log(result);

      res.send(result);
    });

    // latest crops
    app.get("/latest-crops", async (req, res) => {
      const result = await cropCollection
        .find()
        .sort({ created_at: "desc" })
        .limit(6)
        .toArray();

      res.send(result);
    });

    // my posts

    app.get("/my-posts", verifyToken, async (req, res) => {
      const email = req.query.email;

      const result = await cropCollection
        .find({ "owner.ownerEmail": email })
        .toArray();
      res.send(result);
    });

    //  search

    app.get("/search", async (req, res) => {
      const search_text = req.query.search;
      const result = await cropCollection
        .find({ name: { $regex: search_text, $options: "i" } })
        .toArray();

      res.send(result);
    });

    // delete

    app.delete("/my-posts/:id", async (req, res) => {
      const { id } = req.params;
      //    const objectId = new ObjectId(id)
      //    const filter = {_id: objectId}
      const result = await cropCollection.deleteOne({ _id: new ObjectId(id) });

      res.send({
        success: true,
        result,
      });
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`krishilink server is running on port: ${port}`);
});
