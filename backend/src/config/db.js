const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');

let mongoServer;

const seedInitialData = async () => {
    try {
        const adminExists = await User.findOne({
            email: 'admin@iac.com'
        });

        if (!adminExists) {
            await User.create({
                name: 'Administrator',
                email: 'admin@iac.com',
                password: 'Admin@1234',
                role: 'admin',
            });

            console.log('✅ Default admin user created (admin@iac.com)');
        } else {
            console.log('ℹ️ Default admin already exists');
        }

    } catch (err) {
        console.error('❌ Error seeding default admin:', err.message);
        throw err;
    }
};


const connectDB = async () => {
    const uri = process.env.MONGO_URL;
    const useMemoryDb =
        process.env.USE_MEMORY_DB === 'true' ||
        uri === 'memory' ||
        !uri;


    // ==========================================
    // MONGODB MEMORY SERVER
    // ==========================================
    if (useMemoryDb) {
        try {
            console.log('ℹ️ Initializing MongoMemoryServer...');

            mongoServer = await MongoMemoryServer.create();

            const memoryUri = mongoServer.getUri();

            await mongoose.connect(memoryUri);

            console.log(
                `✅ MongoDB Memory Server connected at: ${memoryUri}`
            );

            await seedInitialData();

            return;

        } catch (err) {
            console.error(
                '❌ Failed to start MongoMemoryServer:',
                err.message
            );

            process.exit(1);
        }
    }


    // ==========================================
    // REAL MONGODB
    // ==========================================
    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
        });

        console.log(
            `✅ MongoDB Connected: ${conn.connection.host}`
        );

        console.log(
            `📦 Database: ${conn.connection.name}`
        );

        // Seed only when necessary
        await seedInitialData();

    } catch (err) {
        console.error(
            `❌ MongoDB connection failed: ${err.message}`
        );

        process.exit(1);
    }
};


module.exports = connectDB;