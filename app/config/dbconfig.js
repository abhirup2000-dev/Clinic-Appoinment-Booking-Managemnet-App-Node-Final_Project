require("dotenv").config();
const mongoose = require("mongoose");

const DB_URL = process.env.MONGODB_URL;


const DataBaseConnecting = async () => {
  try {
    const connect = await mongoose.connect(DB_URL);

    if (connect) {
      console.log("Database connected");
    }else{
      console.log("Database not connected successfully");
    }
  } catch (err) {
    console.log(`Database is not connected ${err.message}`);
  }
};


module.exports = DataBaseConnecting;
