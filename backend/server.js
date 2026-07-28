require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const paymentRoutes = require("./routes/payment");
const app = express();

const allowedOrigins = [
  "https://irpunjabijutti.com",
  "https://www.irpunjabijutti.com",
  "http://localhost:1234"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));

app.use(express.json());

mongoose.connect(process.env.SERVER_KEY)
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));

app.use("/api/auth", authRoutes);
app.use("/api", paymentRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
