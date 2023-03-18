//----------------------------BACKEND SERVER--------------------------

const express = require("express");
const cors = require("cors") ; 

//Connect To Database
const connect_MongoDB = require("./connectDB");
connect_MongoDB();  

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

//Backend Routes
app.use("/user",require("./routes/auth"));

const PORT = process.env.PORT||3700;


app.listen(PORT, () => {
  console.log(`Server is working on port: http://localhost:${PORT}`);
});