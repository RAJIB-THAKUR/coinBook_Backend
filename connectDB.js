const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
const dotenv = require("dotenv");
dotenv.config();
const DB = process.env.DATABASE;

//Function to Connect MongoDB
const connect_MongoDB = () =>
  mongoose
    .connect(DB, {
      useNewUrlParser: true,
    })
    .then(() => {
      console.log("Connected to database");
    })
    .catch((e) => console.log(e));

module.exports = connect_MongoDB;
