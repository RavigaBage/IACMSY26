const mongoose = require('mongoose');

const REPORT_TYPES = [
  'internet_lounge',
  'seminar_rooms',
  'training_rooms',
  'conference_rooms',
  'center_overview',
  'device_status',
  'custom',
  'monthly_summary'
];

const REPORT_STATUS = ['generating', 'completed', 'failed'];

const ReportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Report title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    reportType: {
      type: String,
      enum: REPORT_TYPES,
      required: [true, 'Report type is required'],
    },

    description: {
      type: String,
      trim: true,
    },

    dateRange: {
      from: {
        type: Date,
        required: [true, 'Start date is required'],
      },
      to: {
        type: Date,
        required: [true, 'End date is required'],
      },
    },

    filters: {
      roomType: { type: String },
      roomNumber: { type: Number },
      eventType: { type: String },
      category: { type: String },
      beneficiaries: { type: String },
      status: { type: String },
      location: { type: String },
    },

    summary: {
      totalRecords: { type: Number, default: 0 },
      totalParticipants: { type: Number, default: 0 },
      totalVisitors: { type: Number, default: 0 },
      totalEvents: { type: Number, default: 0 },
      activeDevices: { type: Number, default: 0 },
      occupancyRate: { type: Number, default: 0 },
    },

    chartData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    tableData: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },

    status: {
      type: String,
      enum: REPORT_STATUS,
      default: 'generating',
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Iac_users',
      required: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

ReportSchema.index({ reportType: 1, generatedBy: 1 });
ReportSchema.index({ 'dateRange.from': 1, 'dateRange.to': 1 });

module.exports =
  mongoose.models.Report || mongoose.model('Report', ReportSchema);