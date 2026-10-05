const express = require("express");
const rateLimit = require("express-rate-limit");
const { protect, restrictTo } = require("../middleware/auth");
const {devices} = require('../models/');
const { commandService } = require("../services");
const router = express.Router();

const registerAgentService = async (data) => {
    const DevicesData = devices;
    try {
      const normalized = {
        deviceName: data.deviceName || "test_data",
        hostname: data.hostname || "test_data",
        ipAddress: data.ipAddress || "test_data",
        macAddress: data.macAddress || "test_data",
        operatingSystem: data.platform || "test_data",
        department: data.department || "test_data",
        deviceId:data.deviceId || "test_data",
        location: data.location || "test_data",
        assignedUser: data.assignedUser || "test_data",
        serialNumber: data.serialNumber || "test_data",
        agentVersion: data.agentVersion || "test_data",
        remotePort: data.remotePort || 8080,
        authenticationMode: data.authenticationMode || "token",
        encryptionEnabled:
          data.encryptionEnabled !== undefined
            ? data.encryptionEnabled
            : true,
        permissions: {
          allowRemoteShutdown:
            data.permissions?.allowRemoteShutdown ?? true,
          allowRemoteRestart:
            data.permissions?.allowRemoteRestart ?? true,
          allowRemoteLock: data.permissions?.allowRemoteLock ?? true,
          allowRemoteMonitoring:
            data.permissions?.allowRemoteMonitoring ?? true,
          allowFileTransfer:
            data.permissions?.allowFileTransfer ?? false,
        },
        adminNotes: data.adminNotes || "test_data",
        status: {
          networkValidation:
            data.status?.networkValidation || "pending",
          remoteAgent: data.status?.remoteAgent || "waiting",
          authentication: data.status?.authentication || "unverified",
        },
        security: {
          lastSeen: data.security?.lastSeen || null,
          ipHistory: data.security?.ipHistory || "test_data",
          flagged: data.security?.flagged ?? false,
          riskLevel: data.security?.riskLevel || "low",
        },

        isDeleted: false,
      };
      const findQuery = normalized.deviceId && normalized.deviceId !== "test_data"
        ? { $or: [{ deviceId: normalized.deviceId }, { hostname: normalized.hostname }] }
        : { hostname: normalized.hostname };

      let deviceRecord = await DevicesData.findOne(findQuery);

      if (deviceRecord) {
        deviceRecord.status = {
          ...deviceRecord.status,
          remoteAgent: "active",
          networkValidation: "validated",
          authentication: "verified",
        };
        deviceRecord.security = {
          ...deviceRecord.security,
          lastSeen: new Date(),
        };
        if (normalized.ipAddress) deviceRecord.ipAddress = normalized.ipAddress;
        if (normalized.macAddress) deviceRecord.macAddress = normalized.macAddress;
        if (normalized.operatingSystem) deviceRecord.operatingSystem = normalized.operatingSystem;
        if (normalized.agentVersion) deviceRecord.agentVersion = normalized.agentVersion;
        if (normalized.permissions) deviceRecord.permissions = { ...deviceRecord.permissions, ...normalized.permissions };
        if (normalized.deviceId && !deviceRecord.deviceId) deviceRecord.deviceId = normalized.deviceId;
        deviceRecord.isDeleted = false;

        await deviceRecord.save();

        return {
          status: "success",
          data_: deviceRecord,
        };
      }

      normalized.status = {
        networkValidation: "validated",
        remoteAgent: "active",
        authentication: "verified",
      };
      normalized.security = {
        lastSeen: new Date(),
        ipHistory: normalized.ipAddress ? [normalized.ipAddress] : [],
        flagged: false,
        riskLevel: "low",
      };

      const data_ = await DevicesData.create(normalized);

      return {
        status: "success",
        data_,
      };
    } catch (err) {
      return {
        status: "error",
        message: err.message,
      };
    }

    return { success: true };
};

module.exports = { registerAgentService };
