const mongoose = require("mongoose");


const EVENT_TYPES = [
  "workshop",
  "teaching",
  "meetings",
  "v.conference",
  "discussion",
  "l.institution",
  "it training",
  "project",
];

const CATEGORIES = [
  "programming",
  "data science",
  "networking",
  "robotics",
  "drone",
  "iot",
  "ai",
  "b.computing",
  "others",
];

const BENEFICIARIES = [
  "government officials",
  "senior citizens",
  "local residents",
  "students",
  "business",
  "others",
];

const ROOM_TYPES = [
  'Seminar Room 1',
  'Seminar Room 2',
  'Seminar Room 3',
  'Seminar Room 4',
  'Conference Room',
  'Training Lab'
];

const ROOM_STATUS = [
  "AVAILABLE",
  "OCCUPIED",
  "MAINTENANCE",
  "CHECKOUT",
  "RESERVED",
];


const EventProgramSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },   
    status:    { type: String, enum: ['reserved', 'confirmed', 'cancelled'], default: 'reserved' },
    roomNumber: { type: Number, enum: [1, 2, 3, 4], required: true },
    name: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
    },

    organizer: {
      type: String,
      required: true,
      trim: true,
    },

    presenter: {
      type: String,
      required: true,
      trim: true,
    },

    programName: {
      type: String,
      required: true,
      trim: true,
    },

    participants: {
      type: Number,
      required: true,
      min: 0,
    },

    eventType: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
    },

    category: {
      type: String,
      enum: CATEGORIES,
      required: true,
    },

    beneficiaries: {
      type: String,
      enum: BENEFICIARIES,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    
    roomNumber: {
      type: Number,
      enum: [1, 2, 3, 4],
      required: true,
    },

    roomType: {
      type: String,
      enum: ROOM_TYPES,
      required: true,
    },

    status: {
      type: String,
      enum: ROOM_STATUS,
      default: "AVAILABLE",
    },

 
    createdBy: {
      type: String,
      default: "admin",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },

      {
    timestamps: true,
  }
);

EventProgramSchema.index({
  name: "text",
  organizer: "text",
  presenter: "text",
  programName: "text",
});


module.exports =  mongoose.models.EventProgram || mongoose.model('EventProgram', EventProgramSchema);