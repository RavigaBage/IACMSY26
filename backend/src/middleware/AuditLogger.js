const AuditLog = require('../models/AuditLog');

/**
 * Factory function — call this inside controllers after a successful operation.
 * Usage: await logAudit({ action, resourceType, resourceId, req, details, success })
 */
const logAudit = async ({
  action,
  resourceType,
  resourceId = null,
  req,
  details = {},
  success = true,
  errorMessage = null,
}) => {
  try {
    await AuditLog.create({
      action,
      resourceType,
      resourceId,
      performedBy: req.user._id,
      performedByName: req.user.name,
      performedByRole: req.user.role,
      details,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      success,
      errorMessage,
    });
  } catch (err) {
    // Audit logging should never crash the app
    console.error('[AuditLog Error]:', err.message);
  }
};

/**
 * Express middleware — auto-log READ actions on routes that use it.
 * Usage: router.get('/feeds', auditMiddleware('ACCESS_CAMERA', 'Camera'), controller)
 */
const auditMiddleware = (action, resourceType) => {
  return async (req, res, next) => {
    res.on('finish', async () => {
      const success = res.statusCode < 400;
      await logAudit({
        action,
        resourceType,
        resourceId: req.params.id || null,
        req,
        details: {
          method: req.method,
          path: req.originalUrl,
          query: req.query,
          statusCode: res.statusCode,
        },
        success,
      });
    });
    next();
  };
};

module.exports = { logAudit, auditMiddleware };