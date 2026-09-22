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
      const FindDevice = await DevicesData.findOne(
        {
          deviceId: normalized.deviceId,
          deviceName:normalized.deviceName,
          operatingSystem:normalized.operatingSystem,
        }
      );
      if(FindDevice){
        return({
          status:"error",
          message:"Device Already exist"
        })
      }
      const data_ = await DevicesData.create(normalized);

      return({
        status: "success",
        data_,
      });
    } catch (err) {
      return({
        status: "error",
        message: err.message,
      });
    }

    return { success: true };
};

module.exports = { registerAgentService };
