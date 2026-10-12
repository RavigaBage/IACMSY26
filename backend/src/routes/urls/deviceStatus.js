const express = require("express");
const rateLimit = require("express-rate-limit");
const { protect, restrictTo } = require("./../../middleware/auth");
const DevicesData = require("./../../models/devices");

function InitiateService_route(commandService){



  const router = express.Router();

  const allowedFields = [
    "deviceName",
    "hostname",
    "ipAddress",
    "operatingSystem",
    "department",
    "location",
    "assignedUser",
    "serialNumber",
    "agentVersion",
    "remotePort",
    "authenticationMode",
    "encryptionEnabled",
    "permissions",
    "adminNotes",
    "status",
    "security",
  ];

  function sanitizeBody(body) {
    const clean = {};
    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        clean[field] = body[field];
      }
    });
    return clean;
  }

  router.get(
    "/devicStatus",
    restrictTo("user", "admin"),
    async (req, res) => {
      try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = 20;
        const skip = (page - 1) * limit;

        const data = await DevicesData.find({ isDeleted: { $ne: true } })
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 });

        const total = await DevicesData.countDocuments({
          isDeleted: { $ne: true },
        });

        res.json({
          status: "success",
          data,
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        });
      } catch (err) {
        res.status(500).json({
          status: "error",
          message: err.message,
        });
      }
    }
  );

  router.post("/restart", restrictTo("user", "admin"), async (req, res) => {
    try{
      deviceIds = req.body.deviceIds;
      if(deviceIds.length === 0) return res.status(400).json({message: "No device IDs provided"});
      
      const result =  await commandService.restart(deviceIds);
      if(result === 'error occurred') return res.status(500).json({message: "Error creating command"});
    
      res.json(result);
    }catch(error){
      console.error("Error restarting devices:", error);
      res.status(500).json({message: "Error restarting devices"});
    }
  });
  router.post("/shutdown", restrictTo("user", "admin"), async (req, res) => {
    try {
      const { deviceIds } = req.body;

      if (!deviceIds?.length)
        return res.status(400).json({ message: "No device IDs provided" });

      const result = await commandService.shutdown(deviceIds);

      if (!result) {
        return res.status(500).json({ message: "Error creating shutdown command" });
      }

      res.json(result);
    } catch (error) {
      console.error("Shutdown error:", error);
      res.status(500).json({ message: "Error shutting down devices" });
    }
  });
  router.post("/logoff", restrictTo("user", "admin"), async (req, res) => {
    try {
      const { deviceIds } = req.body;

      if (!deviceIds?.length)
        return res.status(400).json({ message: "No device IDs provided" });

      const result = await commandService.logoff(deviceIds);

      if (!result) {
        return res.status(500).json({ message: "Error creating logoff command" });
      }

      res.json(result);
    } catch (error) {
      console.error("Logoff error:", error);
      res.status(500).json({ message: "Error logging off devices" });
    }
  });
  router.post("/lock", restrictTo("user", "admin"), async (req, res) => {
    try {
      const { deviceIds } = req.body;

      if (!deviceIds?.length)
        return res.status(400).json({ message: "No device IDs provided" });

      const result = await commandService.lock(deviceIds);

      if (!result) {
        return res.status(500).json({ message: "Error creating lock command" });
      }

      res.json(result);
    } catch (error) {
      console.error("Lock error:", error);
      res.status(500).json({ message: "Error locking devices" });
    }
  });
  router.post("/system_update", restrictTo("user", "admin"), async (req, res) => {
    try {
      const { deviceIds } = req.body;

      if (!deviceIds?.length)
        return res.status(400).json({ message: "No device IDs provided" });

      const result = await commandService.system_update(deviceIds);

      if (!result) {
        return res.status(500).json({ message: "Error creating system_update command" });
      }

      res.json(result);
    } catch (error) {
      console.error("system_update error:", error);
      res.status(500).json({ message: "Error system_updateing devices" });
    }
  });
  router.post("/sleep", restrictTo("user", "admin"), async (req, res) => {
    try {
      const { deviceIds, graceSeconds = 30, skipIfActiveSession = false } = req.body;
      if (!deviceIds?.length) return res.status(400).json({ message: "No device IDs provided" });
      const result = await commandService.sleep(deviceIds, { graceSeconds, skipIfActiveSession });
      if (!result) return res.status(500).json({ message: "Error creating sleep command" });
      res.json(result);
    } catch (error) {
      console.error("Sleep error:", error);
      res.status(500).json({ message: "Error putting devices to sleep" });
    }
  });
  router.post("/wake", restrictTo("user", "admin"), async (req, res) => {
    try {
      const { deviceIds } = req.body;
      if (!deviceIds?.length) return res.status(400).json({ message: "No device IDs provided" });
      const dgram = require("dgram");
      const targets = await DevicesData.find({ _id: { $in: deviceIds }, isDeleted: { $ne: true } }).lean();
      const results = await Promise.all(targets.map(async device => {
        if (!device.macAddress) return { deviceId: String(device._id), deviceName: device.deviceName, status: "failed", error: "Missing MAC address" };
        const macClean = device.macAddress.replace(/[:-]/g, "");
        if (macClean.length !== 12) return { deviceId: String(device._id), deviceName: device.deviceName, status: "failed", error: "Invalid MAC address" };
        const bytes = macClean.match(/.{2}/g).map(p => parseInt(p, 16));
        const packet = Buffer.alloc(6 + 16 * 6, 0xff);
        for (let i = 6; i < packet.length; i += 6) packet.set(bytes, i);
        const address = device.broadcastAddress || "255.255.255.255";
        await new Promise((resolve) => {
          const s = dgram.createSocket("udp4");
          s.bind(() => {
            s.setBroadcast(true);
            s.send(packet, 9, address, () => {
              if (address !== "255.255.255.255") {
                try { s.send(packet, 9, "255.255.255.255", () => s.close()); } catch { s.close(); }
              } else {
                s.close();
              }
              resolve();
            });
          });
        });
        const io = req.app?.get("io");
        if (io) io.emit("agent:wol:relay", { macAddress: device.macAddress, broadcastAddress: address });
        return { deviceId: String(device._id), deviceName: device.deviceName, status: "sent", broadcastAddress: address };
      }));
      res.json({ results });
    } catch (error) {
      console.error("Wake error:", error);
      res.status(500).json({ message: "Error waking devices" });
    }
  });
  router.post("/device-Status", restrictTo('admin',"user"),async(req,res)=>{
    try {
      const { deviceIds } = req.body;

      if (!deviceIds?.length)
        return res.status(400).json({ message: "No device IDs provided" });

      const result = await commandService.update_Status(deviceIds);

      if (!result) {
        return res.status(500).json({ message: "Error creating lock command" });
      }

      res.json(result);
    } catch (error) {
      console.error("Lock error:", error);
      res.status(500).json({ message: "Error locking devices" });
    }
  })
  router.post(
    "/submit-devicStatus",
    restrictTo("user", "admin"),
    async (req, res) => {
      try {
        const normalized = {
          deviceName: req.body.deviceName || "",
          hostname: req.body.hostname || "",
          ipAddress: req.body.ipAddress || "",
          operatingSystem: req.body.operatingSystem || "",
          department: req.body.department || "",
          location: req.body.location || "",
          assignedUser: req.body.assignedUser || "",
          serialNumber: req.body.serialNumber || "",
          agentVersion: req.body.agentVersion || "",
          remotePort: req.body.remotePort || 8080,
          authenticationMode: req.body.authenticationMode || "token",
          encryptionEnabled:
            req.body.encryptionEnabled !== undefined
              ? req.body.encryptionEnabled
              : true,
          permissions: {
            allowRemoteShutdown:
              req.body.permissions?.allowRemoteShutdown ?? true,
            allowRemoteRestart:
              req.body.permissions?.allowRemoteRestart ?? true,
            allowRemoteLock: req.body.permissions?.allowRemoteLock ?? true,
            allowRemoteSleep: req.body.permissions?.allowRemoteSleep ?? true,
            allowRemoteMonitoring:
              req.body.permissions?.allowRemoteMonitoring ?? true,
            allowFileTransfer:
              req.body.permissions?.allowFileTransfer ?? false,
          },
          adminNotes: req.body.adminNotes || "",
          status: {
            networkValidation:
              req.body.status?.networkValidation || "pending",
            remoteAgent: req.body.status?.remoteAgent || "waiting",
            authentication: req.body.status?.authentication || "unverified",
          },
          security: {
            lastSeen: req.body.security?.lastSeen || null,
            ipHistory: req.body.security?.ipHistory || [],
            flagged: req.body.security?.flagged ?? false,
            riskLevel: req.body.security?.riskLevel || "low",
          },

          isDeleted: false,
        };

        //check if device exists
        const FindDevice = await DevicesData.findOne({ipAddress: normalized.ipAddress});
        if(FindDevice){
          res.json({
            status:"error",
            message:"Device Already exist"
          })
          return;
        }

        const data = await DevicesData.create(normalized);

        res.json({
          status: "success",
          data,
        });
      } catch (err) {
        res.status(500).json({
          status: "error",
          message: err.message,
        });
      }
    }
  );

  router.patch(
    "/devicStatus/:id",
    restrictTo("user", "admin"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const sanitized = sanitizeBody(req.body);

        const device = await DevicesData.findById(id);
        if (!device) {
          return res.status(404).json({ message: "Device not found" });
        }

        if (
          req.user.role !== "admin"
        ) {
          return res.status(403).json({ message: `Forbidden` });
        }

        const updated = await DevicesData.findByIdAndUpdate(
          id,
          { $set: sanitized },
          {
            new: true,
            runValidators: true,
          }
        );

        res.json({
          status: "success",
          data: updated,
        });
      } catch (err) {
        res.status(500).json({
          status: "error",
          message: err.message,
        });
      }
    }
  );


  router.delete(
    "/devicStatus/:id",
    restrictTo("user", "admin"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const device = await DevicesData.findById(id);
        if (!device) {
          return res.status(404).json({ message: "Device not found" });
        }

        if (
          (req.user.role).toLowerCase() !== "admin"
        ) {
          return res.status(403).json({ message: `Forbidden  ${req.user.role}` });
        }

        await DevicesData.findByIdAndDelete(id);

        res.json({
          status: "success",
          message: "Device soft deleted successfully",
        });
      } catch (err) {
        res.status(500).json({
          status: "error",
          message: err.message,
        });
      }
    }
  );
  return router
}
module.exports = InitiateService_route;
