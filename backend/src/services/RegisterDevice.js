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
        deviceName: data.deviceName || data.hostname || data.deviceId || "Unknown device",
        hostname: data.hostname || data.deviceName || data.deviceId || "",
        ipAddress: data.ipAddress || "",
        macAddress: data.macAddress || "",
        operatingSystem: data.operatingSystem || data.platform || "",
        department: data.department || "",
        deviceId: data.deviceId || "",
        location: data.location || "",
        assignedUser: data.assignedUser || "",
        serialNumber: data.serialNumber || "",
        agentVersion: data.agentVersion || "",
        remotePort: data.remotePort ?? 8080,
        authenticationMode: data.authenticationMode || "token",
        encryptionEnabled: data.encryptionEnabled ?? true,
        permissions: data.permissions || {},
        adminNotes: data.adminNotes || "",
        status: {
          networkValidation:
            data.status?.networkValidation || "pending",
          remoteAgent: data.status?.remoteAgent || "waiting",
          authentication: data.status?.authentication || "unverified",
        },
        security: {
          lastSeen: data.security?.lastSeen || null,
          ipHistory: data.security?.ipHistory || [],
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
        const refreshableFields = [
          "deviceName",
          "hostname",
          "ipAddress",
          "macAddress",
          "operatingSystem",
          "department",
          "location",
          "assignedUser",
          "serialNumber",
          "agentVersion",
          "deviceId",
          "remotePort",
          "authenticationMode",
          "encryptionEnabled",
          "adminNotes",
        ];
        for (const field of refreshableFields) {
          const hasValue = data[field] !== undefined && data[field] !== null && data[field] !== "";
          const operatingSystemProvided = field === "operatingSystem" && data.platform;
          if (hasValue || operatingSystemProvided) {
            deviceRecord[field] = normalized[field];
          }
        }
        if (data.permissions) {
          deviceRecord.permissions = { ...deviceRecord.permissions, ...normalized.permissions };
        }
        if (normalized.ipAddress) {
          const ipHistory = deviceRecord.security.ipHistory || [];
          if (!ipHistory.includes(normalized.ipAddress)) ipHistory.push(normalized.ipAddress);
          deviceRecord.security.ipHistory = ipHistory;
        }
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

};

module.exports = { registerAgentService };
