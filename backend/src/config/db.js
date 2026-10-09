const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const MobileUserProfile = require('../models/MobileUserProfile');

let mongoServer;

const seedInitialData = async () => {
    const production = process.env.NODE_ENV === 'production';
    const adminEmail = production ? process.env.INITIAL_ADMIN_EMAIL : 'admin@iac.com';
    const adminPassword = production ? process.env.INITIAL_ADMIN_PASSWORD : 'Admin@1234';
    const adminName = production ? process.env.INITIAL_ADMIN_NAME : 'Administrator';
    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
        await User.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
        });
        console.log(`✅ Initial administrator created (${adminEmail})`);
    }

    if (!production) {
        const mobileDemoExists = await MobileUserProfile.findOne({
            email: 'alex.vance@mit.edu'
        });

        if (!mobileDemoExists) {
            await MobileUserProfile.create({
                mobileUserId: 'mob_user_88402',
                name: 'Alex Vance',
                email: 'alex.vance@mit.edu',
                phoneNumber: '+1 555-0192',
                studentId: 'IAC-USR-88402',
                password: 'Password123!',
                streak: 7,
                longestStreak: 12,
                totalCheckins: 14,
            });
            console.log('✅ Default mobile demo user created (alex.vance@mit.edu)');
        }
    }
};

const connectDB = async () => {
    mongoose.set('bufferCommands', false);
    const uri = process.env.MONGO_URL;
    const useMemoryDb =
        process.env.USE_MEMORY_DB === 'true' ||
        uri === 'memory' ||
        !uri;

    if (process.env.NODE_ENV === 'production' && useMemoryDb) {
        throw new Error('Production requires a persistent MongoDB database; configure MONGO_URL and set USE_MEMORY_DB=false');
    }

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
            throw new Error(`Failed to start MongoDB Memory Server: ${err.message}`, { cause: err });
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

        await seedInitialData();

    } catch (err) {
        throw new Error(`MongoDB connection failed: ${err.message}`, { cause: err });
    }
};

module.exports = connectDB;