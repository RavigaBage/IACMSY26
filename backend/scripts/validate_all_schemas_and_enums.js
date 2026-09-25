const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Import all models
const Announcement = require('../src/models/Announcement');
const AuditLog = require('../src/models/AuditLog');
const CheckinTicket = require('../src/models/CheckinTicket');
const InternetLounge = require('../src/models/InternetLounge');
const Issue = require('../src/models/Issue');
const IssueVote = require('../src/models/IssueVote');
const MobileBookingRequest = require('../src/models/MobileBookingRequest');
const MobileUserProfile = require('../src/models/MobileUserProfile');
const QRCode = require('../src/models/QRCode');
const Report = require('../src/models/Reports');
const SmtpConfig = require('../src/models/SmtpConfig');
const User = require('../src/models/User');
const EventProgram = require('../src/models/booking');
const Device = require('../src/models/devices');
const DeviceCommand = require('../src/models/devicesCommands');
const CommandQueue = require('../src/models/deviceCommandQue');
const CommandTarget = require('../src/models/deviceCommandTarget');
const CommandProgress = require('../src/models/deviceCommandProgress');
const CommandResult = require('../src/models/deviceCommandResult');
const InternetToken = require('../src/models/internettoken');

const models = {
  Announcement,
  AuditLog,
  CheckinTicket,
  InternetLounge,
  Issue,
  IssueVote,
  MobileBookingRequest,
  MobileUserProfile,
  QRCode,
  Report,
  SmtpConfig,
  User,
  EventProgram,
  Device,
  DeviceCommand,
  CommandQueue,
  CommandTarget,
  CommandProgress,
  CommandResult,
  InternetToken,
};

// Known Frontend Enum Options extracted from React UI pages
const frontendEnums = {
  'InternetLounge.identifierType': [
    'ghana_card', 'student_id', 'passport', 'driver_license', 'voter_id', 'nhis_card', 'other'
  ],
  'InternetLounge.gender': [
    'male', 'female', 'other'
  ],
  'QRCode.durationUnit': [
    'hours', 'days', 'minutes'
  ],
  'QRCode.status': [
    'active', 'expired', 'deactivated'
  ],
  'EventProgram.eventType': [
    'workshop', 'teaching', 'meetings', 'v.conference', 'discussion', 'l.institution', 'it training', 'project'
  ],
  'EventProgram.category': [
    'programming', 'data science', 'networking', 'robotics', 'drone', 'iot', 'ai', 'b.computing', 'others'
  ],
  'EventProgram.beneficiaries': [
    'government officials', 'senior citizens', 'local residents', 'students', 'business', 'others'
  ],
  'EventProgram.roomType': [
    'Seminar Room 1', 'Seminar Room 2', 'Seminar Room 3', 'Seminar Room 4', 'Conference Room', 'Training Lab',
    'conference', 'seminar'
  ],
  'EventProgram.paymentStatus': [
    'Unpaid', 'Paid', 'Partially Paid'
  ],
  'EventProgram.status': [
    'Booked', 'Occupied', 'Completed', 'Cancelled', 'AVAILABLE', 'RESERVED'
  ],
  'Announcement.category': [
    'pinned', 'event', 'class', 'notice'
  ],
  'CheckinTicket.status': [
    'pending', 'confirmed', 'declined', 'checked_out', 'expired'
  ],
  'MobileBookingRequest.status': [
    'pending', 'confirmed', 'rejected'
  ],
  'Issue.category': [
    'Equipment', 'Facility', 'Software', 'Cleanliness', 'General'
  ],
  'Issue.status': [
    'seen', 'pending', 'resolved'
  ],
  'IssueVote.direction': [
    'up', 'down'
  ],
  'Report.reportType': [
    'internet_lounge', 'seminar_rooms', 'training_rooms', 'conference_rooms', 'center_overview', 'device_status', 'custom', 'monthly_summary'
  ],
  'Report.status': [
    'generating', 'completed', 'failed'
  ],
  'User.role': [
    'user', 'admin'
  ],
};

async function validateSchemasAndEnums() {
  console.log('================================================================');
  console.log('🔍 DEEP SCHEMA & ENUM VALIDATION AUDIT ACROSS ALL MODELS & FRONTEND');
  console.log('================================================================');

  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  let totalEnumsChecked = 0;
  let enumMatches = 0;
  let enumDiscrepancies = 0;
  const discrepancyDetails = [];

  // Part 1: Schema Enums Extraction and Comparison
  console.log('\n▶ PART 1: Model Schema Enums vs Frontend Options Verification');
  for (const [modelName, model] of Object.entries(models)) {
    const schema = model.schema;
    if (!schema) continue;

    schema.eachPath((pathname, schematype) => {
      const enums = schematype.enumValues || (schematype.options && schematype.options.enum);
      if (enums && Array.isArray(enums) && enums.length > 0) {
        const fullKey = `${modelName}.${pathname}`;
        totalEnumsChecked++;

        const feOptions = frontendEnums[fullKey];
        if (feOptions) {
          // Check if every frontend option is permitted by the schema enum
          const unpermitted = feOptions.filter(opt => !enums.includes(opt));
          if (unpermitted.length === 0) {
            enumMatches++;
            console.log(`  ✓ ${fullKey.padEnd(35)} : All ${feOptions.length} frontend options match schema`);
          } else {
            enumDiscrepancies++;
            const msg = `Discrepancy at ${fullKey}: Frontend sends [${unpermitted.join(', ')}] not allowed in schema [${enums.join(', ')}]`;
            discrepancyDetails.push(msg);
            console.error(`  ✗ ${fullKey.padEnd(35)} : UNMATCHED -> ${unpermitted.join(', ')}`);
          }
        } else {
          console.log(`  ℹ ${fullKey.padEnd(35)} : Schema enum: [${enums.join(', ')}]`);
        }
      }
    });
  }

  // Part 2: Schema Insertion & Type Integrity Verification
  console.log('\n▶ PART 2: Validating Document Creation with Realistic Frontend Payloads');
  const sampleDocuments = [
    {
      name: 'InternetLounge',
      fn: () => InternetLounge.create({
        name: 'Jane Doe',
        identifier: 'GH-98765432-1',
        identifierType: 'ghana_card',
        contactNumber: '0240000000',
        gender: 'female',
        timeIn: '09:00',
        timeOut: '11:00',
        Signature: 'Jane Doe',
      }),
    },
    {
      name: 'QRCode',
      fn: () => QRCode.create({
        token: 'test_token_123',
        label: 'Orientation Session',
        durationValue: 2,
        durationUnit: 'hours',
        expiresAt: new Date(Date.now() + 7200000),
        status: 'active',
      }),
    },
    {
      name: 'EventProgram (Booking)',
      fn: () => EventProgram.create({
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-01'),
        name: 'Kofi Mensah',
        date: new Date('2026-10-01'),
        organizer: 'Tech Hub',
        presenter: 'Kofi Mensah',
        programName: 'Intro to Python',
        participants: 30,
        eventType: 'workshop',
        category: 'programming',
        beneficiaries: 'students',
        description: 'Beginner Python workshop',
        roomType: 'Conference Room',
        roomNumber: 1,
        paymentStatus: 'Paid',
        status: 'Booked',
      }),
    },
    {
      name: 'Announcement',
      fn: () => Announcement.create({
        category: 'notice',
        title: 'Network Maintenance',
        description: 'Routine maintenance this Friday.',
        isActive: true,
      }),
    },
    {
      name: 'CheckinTicket',
      fn: () => CheckinTicket.create({
        mobileUserId: 'user-101',
        mobileUserName: 'Mobile Student',
        ticketCode: 'IAC-1234',
        status: 'pending',
      }),
    },
    {
      name: 'MobileBookingRequest',
      fn: () => MobileBookingRequest.create({
        mobileUserId: 'user-101',
        mobileUserName: 'Mobile Student',
        contactEmail: 'student@example.com',
        roomNumber: '3',
        roomType: 'conference',
        requestedDate: new Date('2026-10-05'),
        requestedSlot: '10:00 - 12:00',
        programName: 'Group Study',
        status: 'pending',
      }),
    },
    {
      name: 'Issue',
      fn: () => Issue.create({
        reporterId: 'user-101',
        reporterName: 'Mobile Student',
        category: 'Equipment',
        description: 'Mouse is missing on station 5',
        status: 'pending',
      }),
    },
    {
      name: 'IssueVote',
      fn: () => IssueVote.create({
        issueId: new mongoose.Types.ObjectId(),
        mobileUserId: 'user-102',
        direction: 'up',
      }),
    },
    {
      name: 'Report',
      fn: () => Report.create({
        title: 'Monthly Summary — October 2026',
        reportType: 'monthly_summary',
        dateRange: { from: new Date('2026-10-01'), to: new Date('2026-10-31') },
        generatedBy: new mongoose.Types.ObjectId(),
        status: 'completed',
      }),
    },
    {
      name: 'SmtpConfig',
      fn: () => SmtpConfig.create({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: 'user@example.com',
        pass: 'pass123',
        fromEmail: 'noreply@example.com',
        fromName: 'IAC Operations',
      }),
    },
    {
      name: 'User',
      fn: () => User.create({
        name: 'John Staff',
        email: 'staff@iac.com',
        password: 'Password@123',
        role: 'user',
      }),
    },
    {
      name: 'Device',
      fn: () => Device.create({
        deviceName: 'Workstation-01',
        ipAddress: '192.168.1.10',
        operatingSystem: 'Windows 11',
        location: 'Room 1 (Conference Room)',
        security: {
          lastSeen: new Date(),
          ipHistory: ['192.168.1.10'],
          flagged: false,
          riskLevel: 'low',
        },
      }),
    },
    {
      name: 'DeviceCommand',
      fn: () => DeviceCommand.create({
        commandType: 'REBOOT',
        payload: { force: true },
        status: 'PENDING',
      }),
    },
    {
      name: 'InternetToken',
      fn: () => InternetToken.create({
        name: 'Token-Guest-1',
        tokenTicket: 'TKT-999',
        tokenExpire: '2h',
        tokenDuration: '120m',
        ticketStatus: false,
      }),
    },
  ];

  let creationsPassed = 0;
  for (const item of sampleDocuments) {
    try {
      const doc = await item.fn();
      if (doc && doc._id) {
        creationsPassed++;
        console.log(`  ✓ [${item.name}] Created successfully with valid schema & enums (ID: ${doc._id})`);
      }
    } catch (err) {
      console.error(`  ✗ [${item.name}] FAILED creation:`, err.message);
      discrepancyDetails.push(`Creation error for ${item.name}: ${err.message}`);
    }
  }

  await mongoose.disconnect();
  await mongoServer.stop();

  console.log('\n================================================================');
  console.log('📊 AUDIT SUMMARY REPORT');
  console.log('================================================================');
  console.log(`Enums Verified with Frontend: ${enumMatches} Matched, ${enumDiscrepancies} Discrepancies`);
  console.log(`Sample Document Validations:  ${creationsPassed}/${sampleDocuments.length} Passed`);

  if (discrepancyDetails.length > 0) {
    console.log('\nDiscrepancies Found:');
    discrepancyDetails.forEach(d => console.log(' • ' + d));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL SCHEMAS, FRONTEND ENUMS, AND MONGO DB VALIDATIONS ARE 100% IN SYNC!');
    process.exit(0);
  }
}

validateSchemasAndEnums().catch(err => {
  console.error('Fatal error during validation:', err);
  process.exit(1);
});
