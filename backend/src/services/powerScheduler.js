const PowerSchedule = require("../models/PowerSchedule");
const { devices } = require("../models");

function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).reduce((out, p) => (out[p.type] = p.value, out), {});
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { key: `${parts.year}-${parts.month}-${parts.day}`, weekday, time: `${parts.hour}:${parts.minute}` };
}

function startPowerScheduler(commandService) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const now = new Date();
      const schedules = await PowerSchedule.find({ enabled: true });
      for (const schedule of schedules) {
        let local;
        try { local = localParts(now, schedule.timezone); } catch { continue; }
        const runKey = `${local.key}:${schedule.timezone}`;
        if (schedule.lastRunKey === runKey || local.time !== schedule.time || !schedule.days.includes(local.weekday)) continue;
        const claimed = await PowerSchedule.updateOne(
          { _id: schedule._id, enabled: true, lastRunKey: { $ne: runKey } },
          { $set: { lastRunKey: runKey } }
        );
        if (!claimed.modifiedCount) continue;
        const filter = schedule.targetType === "all"
          ? { isDeleted: { $ne: true }, "status.remoteAgent": "active", "permissions.allowRemoteSleep": { $ne: false } }
          : { _id: { $in: schedule.deviceIds }, isDeleted: { $ne: true }, "status.remoteAgent": "active", "permissions.allowRemoteSleep": { $ne: false } };
        const targets = await devices.find(filter).select("_id").lean();
        if (!targets.length) continue;
        await commandService.sleep(targets.map(d => String(d._id)), {
          scheduleId: String(schedule._id),
          graceSeconds: schedule.graceSeconds,
          skipIfActiveSession: schedule.skipIfActiveSession,
          allowCancellation: schedule.allowCancellation,
          warning: `This computer will sleep in ${schedule.graceSeconds} seconds. Save your work.`
        });
      }
    } catch (error) {
      console.error("[PowerScheduler] Tick failed:", error.message);
    } finally { busy = false; }
  };
  const timer = setInterval(tick, 15000);
  timer.unref?.();
  tick();
  return () => clearInterval(timer);
}

module.exports = { startPowerScheduler };
