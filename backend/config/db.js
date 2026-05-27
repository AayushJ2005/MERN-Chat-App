import mongoose from "mongoose";

const connectDB = async () => {
    try {
        // process.env.MONGO_URI humari secret database link hogi
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            family: 4, 
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1); 
    }
};

export default connectDB;