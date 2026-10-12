const express = require("express");
const dgram = require("dgram");
const mongoose = require("mongoose");
const PowerSchedule = require("../../models/PowerSchedule");
const Device = require("../../models/devices");
const { restrictTo } = require("../../middleware/auth");
const { logAudit } = require("../../middleware/AuditLogger");

const router = express.Router();
const DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);
const MAC_RE = /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

function validSchedule(body) {
  if (!body || typeof body.name !== "string" || !body.name.trim() || body.name.length > 80) return "A schedule name is required.";
  if (typeof body.time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.time)) return "Time must use 24-hour HH:MM format.";
  if (!Array.isArray(body.days) || !body.days.length || body.days.some(d => !DAYS.has(d))) return "Select at least one valid weekday.";
  if (!Intl.DateTimeFormat().resolvedOptions().timeZone || typeof body.timezone !== "string") return "A valid timezone is required.";
  try { new Intl.DateTimeFormat("en", { timeZone: body.timezone }); } catch { return "Timezone is invalid."; }
  if (!["all", "selected"].includes(body.targetType)) return "Target type must be all or selected.";
  if (body.targetType === "selected" && (!Array.isArray(body.deviceIds) || !body.deviceIds.length || body.deviceIds.some(id => !mongoose.Types.ObjectId.isValid(id)))) return "Select at least one valid device.";
  if (body.graceSeconds !== undefined && (!Number.isInteger(body.graceSeconds) || body.graceSeconds < 0 || body.graceSeconds > 600)) return "Grace period must be between 0 and 600 seconds.";
  for (const field of ["enabled", "skipIfActiveSession", "allowCancellation"]) if (body[field] !== undefined && typeof body[field] !== "boolean") return `${field} must be true or false.`;
  return null;
}

function pickScheduleFields(body) {
  const fields = ["name", "enabled", "time", "days", "timezone", "targetType", "deviceIds", "graceSeconds", "skipIfActiveSession", "allowCancellation"];
  return Object.fromEntries(fields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
}

async function validateTargets(body, res) {
  if (body.targetType !== "selected") return true;
  const count = await Device.countDocuments({ _id: { $in: body.deviceIds }, isDeleted: { $ne: true } });
  if (count !== new Set(body.deviceIds.map(String)).size) {
    res.status(400).json({ message: "One or more selected computers do not exist." });
    return false;
  }
  return true;
}

function sendMagicPacket(mac, address) {
  return new Promise((resolve, reject) => {
    const bytes = mac.replace(/[:-]/g, "").match(/.{2}/g).map(pair => parseInt(pair, 16));
    const packet = Buffer.alloc(6 + 16 * 6, 0xff);
    for (let i = 6; i < packet.length; i += 6) packet.set(bytes, i);
    const socket = dgram.createSocket("udp4");
    socket.once("error", err => { socket.close(); reject(err); });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 9, address, err => {
        socket.close();
        if (err) reject(err); else resolve();
      });
    });
  });
}

function validBroadcast(device) {
  const limitedBroadcast = "255.255.255.255";
  if (!device.networkSubnet) {
    return device.broadcastAddress || limitedBroadcast;
  }
  const match = /^((?:\d{1,3}\.){3}\d{1,3})\/(\d|[12]\d|3[0-2])$/.exec(device.networkSubnet);
  if (!match) return device.broadcastAddress || limitedBroadcast;
  const octets = match[1].split(".").map(Number);
  if (octets.some(value => value > 255) || Number(match[2]) > 30) return device.broadcastAddress || limitedBroadcast;
  const privateNetwork = octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 169 && octets[1] === 254);
  if (!privateNetwork || Number(match[2]) < 1) return device.broadcastAddress || limitedBroadcast;
  const ip = octets.reduce((value, part) => (value * 256 + part) >>> 0, 0);
  const mask = (0xffffffff << (32 - Number(match[2]))) >>> 0;
  const expected = (((ip & mask) | (~mask >>> 0)) >>> 0);
  const calculated = [expected >>> 24, (expected >>> 16) & 255, (expected >>> 8) & 255, expected & 255].join(".");
  return calculated || device.broadcastAddress || limitedBroadcast;
}

router.use(restrictTo("admin"));

router.get("/schedules", async (req, res) => {
  res.json(await PowerSchedule.find().sort({ createdAt: -1 }).lean());
});

router.post("/schedules", async (req, res) => {
  const body = pickScheduleFields(req.body || {});
  const problem = validSchedule(body);
  if (problem) return res.status(400).json({ message: problem });
  if (!await validateTargets(body, res)) return;
  const schedule = await PowerSchedule.create({ ...body, name: body.name.trim(), createdBy: req.user._id });
  await logAudit({ action: "CREATE", resourceType: "System", resourceId: schedule._id, req, details: { kind: "power-schedule", name: schedule.name, targetType: schedule.targetType } });
  res.status(201).json(schedule);
});

router.patch("/schedules/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid schedule id." });
  const current = await PowerSchedule.findById(req.params.id);
  if (!current) return res.status(404).json({ message: "Schedule not found." });
  const body = pickScheduleFields(req.body || {});
  const merged = { ...current.toObject(), ...body };
  const problem = validSchedule(merged);
  if (problem) return res.status(400).json({ message: problem });
  if (!await validateTargets(merged, res)) return;
  const schedule = await PowerSchedule.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (current.enabled && schedule.enabled === false && schedule.allowCancellation) {
    const targets = schedule.targetType === "all" ? await Device.find({ isDeleted: { $ne: true } }).select("_id").lean() : schedule.deviceIds.map(_id => ({ _id }));
    if (targets.length) await require("../../services").services.commandService.cancelSleep(targets.map(d => String(d._id)), String(schedule._id));
  }
  await logAudit({ action: "UPDATE", resourceType: "System", resourceId: schedule._id, req, details: { kind: "power-schedule", name: schedule.name, enabled: schedule.enabled } });
  res.json(schedule);
});

router.delete("/schedules/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid schedule id." });
  const result = await PowerSchedule.findById(req.params.id);
  if (!result) return res.status(404).json({ message: "Schedule not found." });
  if (result.allowCancellation) {
    const targets = result.targetType === "all" ? await Device.find({ isDeleted: { $ne: true } }).select("_id").lean() : result.deviceIds.map(_id => ({ _id }));
    if (targets.length) await require("../../services").services.commandService.cancelSleep(targets.map(d => String(d._id)), String(result._id));
  }
  await result.deleteOne();
  await logAudit({ action: "DELETE", resourceType: "System", resourceId: result._id, req, details: { kind: "power-schedule", name: result.name } });
  res.status(204).end();
});

router.post("/schedules/:id/cancel", async (req, res, next) => {
  try {
    const schedule = await PowerSchedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ message: "Schedule not found." });
    if (!schedule.allowCancellation) return res.status(409).json({ message: "Cancellation is disabled for this schedule." });
    const targets = schedule.targetType === "all" ? await Device.find({ isDeleted: { $ne: true } }).select("_id").lean() : schedule.deviceIds.map(_id => ({ _id }));
    const result = await require("../../services").services.commandService.cancelSleep(targets.map(d => String(d._id)), String(schedule._id));
    await logAudit({ action: "STATUS_CHANGE", resourceType: "System", resourceId: schedule._id, req, details: { kind: "sleep-cancel-request", name: schedule.name } });
    res.status(202).json(result);
  } catch (error) { next(error); }
});

router.post("/sleep", async (req, res, next) => {
  try {
    const { deviceIds, graceSeconds = 30, skipIfActiveSession = true } = req.body || {};
    if (!Array.isArray(deviceIds) || !deviceIds.length || deviceIds.length > 200 || deviceIds.some(id => !mongoose.Types.ObjectId.isValid(id))) return res.status(400).json({ message: "Provide 1–200 valid device ids." });
    if (!Number.isInteger(graceSeconds) || graceSeconds < 0 || graceSeconds > 600 || typeof skipIfActiveSession !== "boolean") return res.status(400).json({ message: "Invalid sleep options." });
    const authorizedDevices = await Device.find({ _id: { $in: deviceIds }, isDeleted: { $ne: true }, "permissions.allowRemoteSleep": { $ne: false } }).select("_id").lean();
    if (authorizedDevices.length !== new Set(deviceIds.map(String)).size) return res.status(403).json({ message: "One or more selected computers do not allow remote sleep or are unavailable." });
    const { commandService } = require("../../services").services;
    const result = await commandService.sleep(deviceIds, { graceSeconds, skipIfActiveSession, allowCancellation: true, warning: `This computer will sleep in ${graceSeconds} seconds. Save your work.` });
    await logAudit({ action: "STATUS_CHANGE", resourceType: "Device", req, details: { action: "sleep", deviceIds, graceSeconds, skipIfActiveSession } });
    res.status(202).json(result);
  } catch (error) { next(error); }
});

router.post("/wake", async (req, res, next) => {
  try {
    const { deviceIds } = req.body || {};
    if (!Array.isArray(deviceIds) || !deviceIds.length || deviceIds.length > 200 || deviceIds.some(id => !mongoose.Types.ObjectId.isValid(id))) return res.status(400).json({ message: "Provide 1–200 valid device ids." });
    const targets = await Device.find({ _id: { $in: deviceIds }, isDeleted: { $ne: true } }).select("_id deviceName macAddress networkSubnet broadcastAddress permissions.allowRemoteWake").lean();
    const results = await Promise.all(targets.map(async device => {
      if (device.permissions?.allowRemoteWake === false) return { deviceId: String(device._id), deviceName: device.deviceName, status: "failed", error: "Remote wake is disabled for this computer." };
      if (!MAC_RE.test(device.macAddress || "")) return { deviceId: String(device._id), deviceName: device.deviceName, status: "failed", error: "Missing or invalid MAC address." };
      const macBytes = device.macAddress.replace(/[:-]/g, "").match(/.{2}/g).map(value => parseInt(value, 16));
      if (macBytes.every(value => value === 0) || macBytes.every(value => value === 255) || (macBytes[0] & 1)) return { deviceId: String(device._id), deviceName: device.deviceName, status: "failed", error: "MAC address must identify a single physical network adapter." };
      const address = validBroadcast(device);
      if (!address) return { deviceId: String(device._id), deviceName: device.deviceName, status: "failed", error: "The saved network and broadcast address do not match. Reconnect the agent to refresh network details." };
      try {
        await sendMagicPacket(device.macAddress, address);
        if (address !== "255.255.255.255") {
          try { await sendMagicPacket(device.macAddress, "255.255.255.255"); } catch {}
        }
        const io = req.app?.get("io");
        if (io) {
          io.emit("agent:wol:relay", { macAddress: device.macAddress, broadcastAddress: address });
        }
        return { deviceId: String(device._id), deviceName: device.deviceName, status: "sent", broadcastAddress: address };
      }
      catch (error) { return { deviceId: String(device._id), deviceName: device.deviceName, status: "failed", error: error.message }; }
    }));
    const foundIds = new Set(targets.map(device => String(device._id)));
    for (const id of deviceIds) {
      if (!foundIds.has(String(id))) results.push({ deviceId: String(id), status: "failed", error: "Computer is not registered." });
    }
    await logAudit({ action: "STATUS_CHANGE", resourceType: "Device", req, details: { action: "wake-on-lan", deviceIds, results } });
    res.status(202).json({ results });
  } catch (error) { next(error); }
});

module.exports = router;
