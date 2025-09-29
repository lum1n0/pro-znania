// config/db.mjs
import mongoose from 'mongoose';


const connectDB = async () => {
  try {
    const mongoURI = process.env.DB  || 'mongodb://localhost:27017/logs_db'
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB подключена: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Ошибка подключения MongoDB:', error.message);
    process.exit(1);
  }
};

export default connectDB;