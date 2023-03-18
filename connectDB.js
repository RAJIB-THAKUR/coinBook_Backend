const mongoose = require("mongoose");
mongoose.set("strictQuery", false); 

//Function to Connect MongoDB
const connect_MongoDB = () =>
  mongoose
    .connect("mongodb+srv://rajibthakur:rajibthakur@cluster0.zd9jgxo.mongodb.net/coin_Book_App", {
      useNewUrlParser: true,
    })
    .then(() => {
      console.log("Connected to database");
    })
    .catch((e) => console.log(e));

    
module.exports = connect_MongoDB;
