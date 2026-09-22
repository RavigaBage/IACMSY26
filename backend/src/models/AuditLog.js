const mongoose = require('mongoose');

const ACTIONS = [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'UPLOAD',
  'DOWNLOAD',
  'GENERATE_REPORT',
  'ACCESS_CAMERA',
  'STATUS_CHANGE',
];

const RESOURCE_TYPES = [
  'Camera',
  'MediaStorage',
  'Report',
  'EventProgram',
  'InternetLounge',
  'Device',
  'User',
  'System',
];

const AuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ACTIONS,
      required: true,
    },

    resourceType: {
      type: String,
      enum: RESOURCE_TYPES,
      required: true,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Iac_users',
      required: true,
    },

    performedByName: {
      type: String,
      required: true,
    },

    performedByRole: {
      type: String,
      required: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
      trim: true,
    },

    userAgent: {
      type: String,
      trim: true,
    },

    success: {
      type: Boolean,
      default: true,
    },

    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);

AuditLogSchema.index({ performedBy: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, resourceType: 1 });
AuditLogSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);