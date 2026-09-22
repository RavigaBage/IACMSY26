const ExcelJS = require('exceljs');

/**
 * Builds a beautifully styled Excel workbook with KPI Summary Cards, Infographics/Progress Tables,
 * and detailed sheets for Event Programs and Internet Lounge Visitors.
 */
async function buildMonthlyReportExcel({ monthName, year, loungeUsers, eventPrograms, loungeLogs }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IAC Remote Management System';
  workbook.lastModifiedBy = 'IAC System Admin';
  workbook.created = new Date();

  // ---------------------------------------------------------
  // KPI CALCULATIONS
  // ---------------------------------------------------------
  const totalLoungeUsers = Array.isArray(loungeLogs) ? loungeLogs.length : (loungeUsers || 0);

  let totalConferenceUsers = 0;
  let totalConferenceEvents = 0;
  let totalSeminarUsers = 0;
  let totalSeminarEvents = 0;
  let totalTrainingUsers = 0;
  let totalTrainingEvents = 0;
  let totalOtherRoomUsers = 0;
  let totalOtherRoomEvents = 0;

  const eventTypeStats = {};

  if (Array.isArray(eventPrograms)) {
    eventPrograms.forEach((ep) => {
      const parts = Number(ep.participants) || 0;
      const roomType = String(ep.roomType || '').toLowerCase();
      const eventType = String(ep.eventType || '').toLowerCase();
      const programName = String(ep.programName || ep.name || '').toLowerCase();
      const roomNum = Number(ep.roomNumber);

      // Classify into Room Categories
      if (roomType === 'conference' || roomNum === 1 || programName.includes('conference')) {
        totalConferenceUsers += parts;
        totalConferenceEvents += 1;
      } else if (roomType === 'seminar' || roomNum === 2 || programName.includes('seminar')) {
        totalSeminarUsers += parts;
        totalSeminarEvents += 1;
      } else if (roomType === 'training' || roomNum === 3 || roomNum === 4 || eventType === 'it training' || programName.includes('training')) {
        totalTrainingUsers += parts;
        totalTrainingEvents += 1;
      } else {
        totalOtherRoomUsers += parts;
        totalOtherRoomEvents += 1;
      }

      // Event type stats
      const etKey = ep.eventType || 'Other';
      if (!eventTypeStats[etKey]) {
        eventTypeStats[etKey] = { count: 0, participants: 0 };
      }
      eventTypeStats[etKey].count += 1;
      eventTypeStats[etKey].participants += parts;
    });
  }

  const totalEventParticipants = totalConferenceUsers + totalSeminarUsers + totalTrainingUsers + totalOtherRoomUsers;
  const totalFacilityUsers = totalLoungeUsers + totalEventParticipants;
  const totalEvents = (eventPrograms || []).length;

  // Helper for fill color
  const makeFill = (hex) => ({
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF' + hex.replace('#', '') },
  });

  // Helper for border
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  const thickHeaderBorder = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    left: { style: 'medium', color: { argb: 'FF0F172A' } },
    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    right: { style: 'medium', color: { argb: 'FF0F172A' } },
  };

  // =========================================================
  // SHEET 1: EXECUTIVE KPI SUMMARY & INFOGRAPHICS
  // =========================================================
  const summarySheet = workbook.addWorksheet('Executive KPI Summary', {
    views: [{ showGridLines: true }],
  });

  // Set column widths
  summarySheet.columns = [
    { width: 5 },  // A (margin)
    { width: 30 }, // B (Category / Label)
    { width: 18 }, // C (Metric 1)
    { width: 22 }, // D (Metric 2)
    { width: 22 }, // E (Share %)
    { width: 28 }, // F (Visual Bar)
    { width: 5 },  // G (margin)
  ];

  // 1. Title Banner
  summarySheet.mergeCells('B2:F3');
  const titleCell = summarySheet.getCell('B2');
  titleCell.value = `IAC FACILITY USAGE & ACTIVITY REPORT`;
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = makeFill('0F172A'); // Dark Navy
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  summarySheet.mergeCells('B4:F4');
  const subCell = summarySheet.getCell('B4');
  subCell.value = `MONTHLY PERFORMANCE & KPI ANALYTICS — ${monthName.toUpperCase()} ${year}`;
  subCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFF59E0B' } }; // Gold text
  subCell.fill = makeFill('1E293B');
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 2. KPI Cards Row (Row 6 to Row 9)
  const kpiData = [
    { colStart: 'B', colEnd: 'B', title: 'TOTAL LOUNGE USERS', value: totalLoungeUsers, bg: 'EFF6FF', border: '3B82F6', textColor: '1E40AF' },
    { colStart: 'C', colEnd: 'C', title: 'CONFERENCE ROOM ACCESS', value: totalConferenceUsers, bg: 'F0FDF4', border: '22C55E', textColor: '166534' },
    { colStart: 'D', colEnd: 'D', title: 'SEMINAR ROOM ACCESS', value: totalSeminarUsers, bg: 'FEF3C7', border: 'F59E0B', textColor: '92400E' },
    { colStart: 'E', colEnd: 'E', title: 'TRAINING ROOM ACCESS', value: totalTrainingUsers, bg: 'F3E8FF', border: 'A855F7', textColor: '6B21A8' },
    { colStart: 'F', colEnd: 'F', title: 'TOTAL FACILITY PARTICIPANTS', value: totalFacilityUsers, bg: 'ECFEFF', border: '06B6D4', textColor: '155E75' },
  ];

  kpiData.forEach((kpi) => {
    const titleCell = summarySheet.getCell(`${kpi.colStart}6`);
    titleCell.value = kpi.title;
    titleCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };
    titleCell.fill = makeFill(kpi.bg);
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = thinBorder;

    const valueCell = summarySheet.getCell(`${kpi.colStart}7`);
    valueCell.value = kpi.value;
    valueCell.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FF' + kpi.textColor } };
    valueCell.fill = makeFill(kpi.bg);
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valueCell.border = thinBorder;

    const subText = summarySheet.getCell(`${kpi.colStart}8`);
    subText.value = `${monthName} ${year}`;
    subText.font = { name: 'Segoe UI', size: 8, italic: true, color: { argb: 'FF64748B' } };
    subText.fill = makeFill(kpi.bg);
    subText.alignment = { horizontal: 'center', vertical: 'middle' };
    subText.border = thinBorder;
  });

  // 3. Section Header: Room & Facility Usage Breakdown (Row 11)
  summarySheet.mergeCells('B11:F11');
  const sec1 = summarySheet.getCell('B11');
  sec1.value = 'FACILITY ACCESS & ROOM KPI BREAKDOWN';
  sec1.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  sec1.fill = makeFill('1E293B');
  sec1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  // Table Headers (Row 12)
  const roomTableHeaders = ['Facility Area / Category', 'Events Held', 'Total Users / Participants', '% Share of Attendance', 'Visual Share Indicator'];
  ['B', 'C', 'D', 'E', 'F'].forEach((col, idx) => {
    const cell = summarySheet.getCell(`${col}12`);
    cell.value = roomTableHeaders[idx];
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = makeFill('334155');
    cell.alignment = { horizontal: idx === 0 ? 'left' : 'center', vertical: 'middle' };
    cell.border = thickHeaderBorder;
  });

  // Table Rows (Row 13 - 17)
  const roomRows = [
    { area: 'Internet Lounge Check-Ins', events: 'N/A (Continuous)', users: totalLoungeUsers },
    { area: 'Conference Rooms', events: totalConferenceEvents, users: totalConferenceUsers },
    { area: 'Seminar Rooms', events: totalSeminarEvents, users: totalSeminarUsers },
    { area: 'Training Rooms & Labs', events: totalTrainingEvents, users: totalTrainingUsers },
    { area: 'Other Facility Rooms', events: totalOtherRoomEvents, users: totalOtherRoomUsers },
  ];

  roomRows.forEach((row, i) => {
    const rowIdx = 13 + i;
    const share = totalFacilityUsers > 0 ? (row.users / totalFacilityUsers) : 0;
    
    // Bar infographic generator
    const barLength = Math.round(share * 20);
    const barVisual = '█'.repeat(barLength) + '░'.repeat(20 - barLength) + ` ${(share * 100).toFixed(1)}%`;

    const cB = summarySheet.getCell(`B${rowIdx}`);
    cB.value = row.area;
    cB.font = { name: 'Segoe UI', size: 10, bold: true };
    cB.fill = makeFill(i % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
    cB.border = thinBorder;

    const cC = summarySheet.getCell(`C${rowIdx}`);
    cC.value = row.events;
    cC.alignment = { horizontal: 'center' };
    cC.fill = makeFill(i % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
    cC.border = thinBorder;

    const cD = summarySheet.getCell(`D${rowIdx}`);
    cD.value = row.users;
    cD.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cD.alignment = { horizontal: 'center' };
    cD.fill = makeFill(i % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
    cD.border = thinBorder;

    const cE = summarySheet.getCell(`E${rowIdx}`);
    cE.value = share;
    cE.numFmt = '0.0%';
    cE.alignment = { horizontal: 'center' };
    cE.fill = makeFill(i % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
    cE.border = thinBorder;

    const cF = summarySheet.getCell(`F${rowIdx}`);
    cF.value = barVisual;
    cF.font = { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF2563EB' } };
    cF.alignment = { horizontal: 'left', vertical: 'middle' };
    cF.fill = makeFill(i % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
    cF.border = thinBorder;
  });

  // Total Summary Row (Row 18)
  const totalRowIdx = 18;
  summarySheet.getCell(`B${totalRowIdx}`).value = 'TOTAL FACILITY ATTENDANCE';
  summarySheet.getCell(`B${totalRowIdx}`).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getCell(`B${totalRowIdx}`).fill = makeFill('0F172A');
  summarySheet.getCell(`B${totalRowIdx}`).border = thinBorder;

  summarySheet.getCell(`C${totalRowIdx}`).value = `${totalEvents} Total Events`;
  summarySheet.getCell(`C${totalRowIdx}`).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getCell(`C${totalRowIdx}`).fill = makeFill('0F172A');
  summarySheet.getCell(`C${totalRowIdx}`).alignment = { horizontal: 'center' };
  summarySheet.getCell(`C${totalRowIdx}`).border = thinBorder;

  summarySheet.getCell(`D${totalRowIdx}`).value = totalFacilityUsers;
  summarySheet.getCell(`D${totalRowIdx}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF38BDF8' } };
  summarySheet.getCell(`D${totalRowIdx}`).fill = makeFill('0F172A');
  summarySheet.getCell(`D${totalRowIdx}`).alignment = { horizontal: 'center' };
  summarySheet.getCell(`D${totalRowIdx}`).border = thinBorder;

  summarySheet.getCell(`E${totalRowIdx}`).value = 1.0;
  summarySheet.getCell(`E${totalRowIdx}`).numFmt = '0.0%';
  summarySheet.getCell(`E${totalRowIdx}`).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getCell(`E${totalRowIdx}`).fill = makeFill('0F172A');
  summarySheet.getCell(`E${totalRowIdx}`).alignment = { horizontal: 'center' };
  summarySheet.getCell(`E${totalRowIdx}`).border = thinBorder;

  summarySheet.getCell(`F${totalRowIdx}`).value = '100% Complete';
  summarySheet.getCell(`F${totalRowIdx}`).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getCell(`F${totalRowIdx}`).fill = makeFill('0F172A');
  summarySheet.getCell(`F${totalRowIdx}`).alignment = { horizontal: 'center' };
  summarySheet.getCell(`F${totalRowIdx}`).border = thinBorder;

  // 4. Section Header: Event Type Distribution Analytics (Row 20)
  summarySheet.mergeCells('B20:F20');
  const sec2 = summarySheet.getCell('B20');
  sec2.value = 'EVENT PROGRAM TYPE ANALYTICS';
  sec2.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  sec2.fill = makeFill('1E293B');
  sec2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  // Headers (Row 21)
  ['B', 'C', 'D', 'E', 'F'].forEach((col, idx) => {
    const headerTitles = ['Event Type Category', 'Total Events Held', 'Total Participants', 'Avg. Attendance / Event', 'Distribution Visual'];
    const cell = summarySheet.getCell(`${col}21`);
    cell.value = headerTitles[idx];
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = makeFill('334155');
    cell.alignment = { horizontal: idx === 0 ? 'left' : 'center', vertical: 'middle' };
    cell.border = thickHeaderBorder;
  });

  const etKeys = Object.keys(eventTypeStats);
  if (etKeys.length === 0) {
    summarySheet.mergeCells('B22:F22');
    const emptyCell = summarySheet.getCell('B22');
    emptyCell.value = 'No event programs recorded for this period.';
    emptyCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    emptyCell.alignment = { horizontal: 'center' };
  } else {
    etKeys.forEach((etKey, idx) => {
      const rIdx = 22 + idx;
      const stat = eventTypeStats[etKey];
      const avg = stat.count > 0 ? (stat.participants / stat.count).toFixed(1) : 0;
      const share = totalEventParticipants > 0 ? (stat.participants / totalEventParticipants) : 0;
      const barLength = Math.round(share * 20);
      const barVisual = '█'.repeat(barLength) + '░'.repeat(20 - barLength) + ` ${(share * 100).toFixed(1)}%`;

      summarySheet.getCell(`B${rIdx}`).value = etKey.toUpperCase();
      summarySheet.getCell(`B${rIdx}`).font = { name: 'Segoe UI', size: 10, bold: true };
      summarySheet.getCell(`B${rIdx}`).fill = makeFill(idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
      summarySheet.getCell(`B${rIdx}`).border = thinBorder;

      summarySheet.getCell(`C${rIdx}`).value = stat.count;
      summarySheet.getCell(`C${rIdx}`).alignment = { horizontal: 'center' };
      summarySheet.getCell(`C${rIdx}`).fill = makeFill(idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
      summarySheet.getCell(`C${rIdx}`).border = thinBorder;

      summarySheet.getCell(`D${rIdx}`).value = stat.participants;
      summarySheet.getCell(`D${rIdx}`).font = { name: 'Segoe UI', size: 10, bold: true };
      summarySheet.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };
      summarySheet.getCell(`D${rIdx}`).fill = makeFill(idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
      summarySheet.getCell(`D${rIdx}`).border = thinBorder;

      summarySheet.getCell(`E${rIdx}`).value = Number(avg);
      summarySheet.getCell(`E${rIdx}`).alignment = { horizontal: 'center' };
      summarySheet.getCell(`E${rIdx}`).fill = makeFill(idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
      summarySheet.getCell(`E${rIdx}`).border = thinBorder;

      summarySheet.getCell(`F${rIdx}`).value = barVisual;
      summarySheet.getCell(`F${rIdx}`).font = { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF0D9488' } };
      summarySheet.getCell(`F${rIdx}`).alignment = { horizontal: 'left', vertical: 'middle' };
      summarySheet.getCell(`F${rIdx}`).fill = makeFill(idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC');
      summarySheet.getCell(`F${rIdx}`).border = thinBorder;
    });
  }


  // =========================================================
  // SHEET 2: DETAILED EVENT PROGRAM RECORDS
  // =========================================================
  const eventsSheet = workbook.addWorksheet('Event Program Details', {
    views: [{ showGridLines: true }],
  });

  eventsSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Program Name', key: 'programName', width: 28 },
    { header: 'Organizer', key: 'organizer', width: 22 },
    { header: 'Presenter', key: 'presenter', width: 20 },
    { header: 'Room No.', key: 'roomNumber', width: 12 },
    { header: 'Room Type', key: 'roomType', width: 16 },
    { header: 'Event Type', key: 'eventType', width: 18 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Participants', key: 'participants', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
  ];

  // Format header row
  const eventHeaderRow = eventsSheet.getRow(1);
  eventHeaderRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  eventHeaderRow.fill = makeFill('0F172A');
  eventHeaderRow.height = 28;
  eventHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

  if (Array.isArray(eventPrograms)) {
    eventPrograms.forEach((ep, i) => {
      const row = eventsSheet.addRow({
        date: ep.date ? new Date(ep.date).toISOString().slice(0, 10) : 'N/A',
        programName: ep.programName || ep.name || 'N/A',
        organizer: ep.organizer || 'N/A',
        presenter: ep.presenter || 'N/A',
        roomNumber: ep.roomNumber ? `Room ${ep.roomNumber}` : 'N/A',
        roomType: (ep.roomType || 'N/A').toUpperCase(),
        eventType: (ep.eventType || 'N/A').toUpperCase(),
        category: (ep.category || 'N/A').toUpperCase(),
        participants: ep.participants || 0,
        status: (ep.status || 'AVAILABLE').toUpperCase(),
      });

      row.height = 22;
      row.font = { name: 'Segoe UI', size: 10 };
      row.alignment = { vertical: 'middle' };

      // Stripe row colors
      const rowBg = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
      row.eachCell((cell) => {
        cell.fill = makeFill(rowBg);
        cell.border = thinBorder;
      });

      row.getCell('participants').alignment = { horizontal: 'center' };
      row.getCell('roomNumber').alignment = { horizontal: 'center' };
      row.getCell('date').alignment = { horizontal: 'center' };
      row.getCell('status').alignment = { horizontal: 'center' };
    });
  }

  // =========================================================
  // SHEET 3: INTERNET LOUNGE VISITOR LOGS
  // =========================================================
  const loungeSheet = workbook.addWorksheet('Internet Lounge Visitor Logs', {
    views: [{ showGridLines: true }],
  });

  loungeSheet.columns = [
    { header: 'Date & Time', key: 'createdAt', width: 20 },
    { header: 'Visitor Name', key: 'name', width: 26 },
    { header: 'ID Number', key: 'identifier', width: 20 },
    { header: 'ID Type', key: 'identifierType', width: 18 },
    { header: 'Gender', key: 'gender', width: 12 },
    { header: 'Contact No.', key: 'contactNumber', width: 18 },
    { header: 'Time In', key: 'timeIn', width: 16 },
    { header: 'Time Out', key: 'timeOut', width: 16 },
  ];

  const loungeHeaderRow = loungeSheet.getRow(1);
  loungeHeaderRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  loungeHeaderRow.fill = makeFill('0F172A');
  loungeHeaderRow.height = 28;
  loungeHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

  if (Array.isArray(loungeLogs)) {
    loungeLogs.forEach((log, i) => {
      const row = loungeSheet.addRow({
        createdAt: log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A',
        name: log.name || 'N/A',
        identifier: log.identifier || 'N/A',
        identifierType: (log.identifierType || 'N/A').toUpperCase(),
        gender: (log.gender || 'N/A').toUpperCase(),
        contactNumber: log.contactNumber || 'N/A',
        timeIn: log.timeIn ? new Date(log.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        timeOut: log.timeOut ? new Date(log.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      });

      row.height = 22;
      row.font = { name: 'Segoe UI', size: 10 };
      row.alignment = { vertical: 'middle' };

      const rowBg = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
      row.eachCell((cell) => {
        cell.fill = makeFill(rowBg);
        cell.border = thinBorder;
      });

      row.getCell('gender').alignment = { horizontal: 'center' };
      row.getCell('timeIn').alignment = { horizontal: 'center' };
      row.getCell('timeOut').alignment = { horizontal: 'center' };
    });
  }

  return workbook;
}

module.exports = { buildMonthlyReportExcel };
