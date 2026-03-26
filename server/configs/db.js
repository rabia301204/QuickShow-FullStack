import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/quickshow`);
        console.log('Database connected');
    } catch (error) {
        console.log('DB Connection Error:', error.message);
        process.exit(1); // Stop server if DB fails
    }
}

export default connectDB;