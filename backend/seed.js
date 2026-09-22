require("dotenv").config();
const EventProgram = require("./src/models/booking");
const InternetLounge = require("./src/models/InternetLounge");
const UsersModel = require("./src/models/User");
const connectDB = require('./src/config/db');

const mongoose = require('mongoose');


// ---------- Helper Functions ----------
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomTimeBetween(startHour, endHour) {
  const hour = randomInt(startHour, endHour - 1);
  const minute = randomInt(0, 59);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

// Formats Date object to "HH:MM" string (24h) – adjust if your schema expects String
function formatTime(date) {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// ---------- Configuration ----------
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Iac_db';
const YEAR = 2025;
const START_DATE = new Date(YEAR, 0, 1);
const END_DATE = new Date(YEAR, 11, 31, 23, 59, 59);

// How many lounge entries to generate (approx 10 per day => 3650)
const LOUNGE_ENTRIES_COUNT = 3500;
// How many room events to generate (approx 0.5 per day => ~180)
const EVENT_COUNT = 180;

// Enums from your models
const EVENT_TYPES = [
  "workshop", "teaching", "meetings", "v.conference",
  "discussion", "l.institution", "it training", "project"
];
const CATEGORIES = [
  "programming", "data science", "networking", "robotics",
  "drone", "iot", "ai", "b.computing", "others"
];
const BENEFICIARIES = [
  "government officials", "senior citizens", "local residents",
  "students", "business", "others"
];
const ROOM_TYPES = ["conference", "seminar"];
const ROOM_NUMBERS = [1, 2, 3, 4];

const ID_TYPES = [
  "student_id", "ghana_card", "passport",
  "driver_license", "voter_id", "nhis_card", "other"
];
const GENDERS = ["male", "female", "other"];

// ---------- Seed Lounge ----------
async function seedLounge() {
  const loungeEntries = [];
  for (let i = 0; i < LOUNGE_ENTRIES_COUNT; i++) {
    const createdAt = randomDate(START_DATE, END_DATE);
    const timeIn = randomTimeBetween(8, 20); // 8am - 8pm
    const timeOut = new Date(timeIn);
    timeOut.setHours(timeIn.getHours() + randomInt(1, 3)); // stay 1-3 hours

    loungeEntries.push({
      name: `Visitor ${randomInt(1000, 9999)}`,
      identifier: `ID-${randomInt(100000, 999999)}`,
      identifierType: randomElement(ID_TYPES),
      contactNumber: `024${randomInt(1000000, 9999999)}`,
      gender: randomElement(GENDERS),
      timeIn: formatTime(timeIn),
      timeOut: formatTime(timeOut),
      Signature: `sig_${randomInt(1, 100)}`,
      createdAt: createdAt,
    });
  }
  await InternetLounge.insertMany(loungeEntries);
  console.log(`✅ Inserted ${loungeEntries.length} lounge entries`);
}

// ---------- Seed Events ----------
async function seedEvents() {
  const events = [];
  for (let i = 0; i < EVENT_COUNT; i++) {
    const eventDate = randomDate(START_DATE, END_DATE);
    const roomNumber = randomElement(ROOM_NUMBERS);
    const roomType = roomNumber <= 2 ? "conference" : "seminar"; // example mapping

    events.push({
      name: `Tech Event ${randomInt(1, 100)}`,
      date: eventDate,
      organizer: `Org ${randomInt(1, 50)}`,
      presenter: `Presenter ${randomInt(1, 50)}`,
      programName: `Program ${randomInt(1, 50)}`,
      participants: randomInt(10, 200),
      eventType: randomElement(EVENT_TYPES),
      category: randomElement(CATEGORIES),
      beneficiaries: randomElement(BENEFICIARIES),
      description: `This is a test event description ${i}`,
      roomNumber: roomNumber,
      roomType: roomType,
      status: "AVAILABLE",
      createdBy: "seeder",
      isDeleted: false,
    });
  }
  await EventProgram.insertMany(events);
  console.log(`✅ Inserted ${events.length} room events`);
}

// ---------- Main ----------
async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Optional: Clear existing data
    await EventProgram.deleteMany({});
    await InternetLounge.deleteMany({});
    console.log('Cleared old data');

    await seedLounge();
    await seedEvents();
    
    UsersModel.insertOne({
      name:'Administrator',
      email:"admin@iac.com",
      password:"Admin@1234",
      role:"admin"
    });
    console.log('seeding users');

    console.log('Seeding completed!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
