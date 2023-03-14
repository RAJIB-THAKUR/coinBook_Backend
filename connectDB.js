const mongoose = require("mongoose");
mongoose.set("strictQuery", false); 

//Function to Connect MongoDB
const connect_MongoDB = () =>
  mongoose
    .connect("mongodb://localhost:27017/myCoinSaverDB", {
      useNewUrlParser: true,
    })
    .then(() => {
      console.log("Connected to database");
    })
    .catch((e) => console.log(e));

module.exports = connect_MongoDB;
