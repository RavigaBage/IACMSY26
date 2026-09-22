const mongoose = require('mongoose');
const DeviceSchema = new mongoose.Schema(
  {
    
    deviceName: { type: String, required: true, trim: true },
    hostname: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    macAddress: { type: String, trim: true },
    operatingSystem: { type: String, trim: true },
    department: { type: String, trim: true },
    location: { type: String, trim: true },
    assignedUser: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    agentVersion: { type: String, trim: true },
    deviceId:{ type: String, trim: true },
    remotePort: {
      type: Number,
      default: 8080,
    },

    authenticationMode: {
      type: String,
      enum: ["token", "password", "certificate"],
      default: "token",
    },

    encryptionEnabled: {
      type: Boolean,
      default: true,
    },

    permissions: {
      allowRemoteShutdown: { type: Boolean, default: true },
      allowRemoteRestart: { type: Boolean, default: true },
      allowRemoteLock: { type: Boolean, default: true },
      allowRemoteMonitoring: { type: Boolean, default: true },
      allowFileTransfer: { type: Boolean, default: false },
    },

    adminNotes: {
      type: String,
      default: "",
      trim: true,
    },

   status: {
      networkValidation: {
        type: String,
        enum: ["pending", "validated", "failed"],
        default: "pending",
      },

      remoteAgent: {
        type: String,
        enum: ["waiting", "active", "offline"],
        default: "waiting",
      },

      authentication: {
        type: String,
        enum: ["unverified", "verified", "failed"],
        default: "unverified",
      },
    },

    security: {
      riskLevel: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "low",
      },
    },

   
    security: {
      lastSeen: { type: Date },
      ipHistory: String,
      flagged: { type: Boolean, default: false },
      riskLevel: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "low",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.DeviceSchema || mongoose.model('DeviceSchema', DeviceSchema);