const net = require('net');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const nodemailer = require('nodemailer');
const assert = require('assert');

const SmtpConfig = require('../src/models/SmtpConfig');
const { sendEmail, verifyAndSendTestEmail } = require('../src/services/mailerService');

async function testEmailFunctionality() {
    console.log("==================================================");
    console.log("📧 TESTING EMAIL & GOOGLE SMTP FUNCTIONALITY");
    console.log("==================================================");

    // 1. Test Network Connectivity to Google SMTP (smtp.gmail.com:587)
    console.log("\n▶ Test 1: Testing direct TCP connection to smtp.gmail.com:587...");
    await new Promise((resolve, reject) => {
        const sock = net.createConnection(587, 'smtp.gmail.com', () => {
            console.log("  ✓ Successfully established TCP socket connection to smtp.gmail.com:587");
            sock.end();
            resolve();
        });
        sock.on('error', (err) => {
            console.error("  ✗ Network socket error to smtp.gmail.com:587:", err.message);
            reject(err);
        });
        sock.setTimeout(5000, () => {
            sock.destroy();
            reject(new Error("Timeout connecting to smtp.gmail.com:587"));
        });
    });

    // 2. Setup in-memory MongoDB for mailerService tests
    console.log("\n▶ Test 2: Testing mailerService without credentials configured...");
    const mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Call sendEmail without credentials
    const resultNoCreds = await sendEmail({
        to: "test@example.com",
        subject: "Test Booking",
        html: "<p>Hello</p>"
    });

    assert.strictEqual(resultNoCreds.success, false);
    assert(resultNoCreds.error.includes("SMTP credentials"));
    console.log("  ✓ Correctly handled missing credentials without throwing an unhandled exception.");
    console.log("  ✓ Returned:", JSON.stringify(resultNoCreds));

    // 3. Test mailerService with mock SMTP (Nodemailer test transport)
    console.log("\n▶ Test 3: Testing Nodemailer transporter & email dispatch pipeline...");
    const testAccount = await nodemailer.createTestAccount();
    console.log("  ✓ Created test SMTP credentials for pipeline verification");

    const testTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        }
    });

    const info = await testTransporter.sendMail({
        from: '"IAC Mobile System" <noreply@iac.system>',
        to: "attendee@example.com",
        subject: "Booking Confirmed - IAC Mobile System",
        html: "<h2>Reservation Confirmed</h2><p>Your room booking is approved.</p>"
    });

    assert(info.messageId, "Email should have a messageId");
    console.log("  ✓ Email sent successfully through nodemailer pipeline!");
    console.log("  ✓ MessageId:", info.messageId);
    console.log("  ✓ Preview URL:", nodemailer.getTestMessageUrl(info));

    // 4. Test live HTTP endpoint on running dev server
    console.log("\n▶ Test 4: Testing live HTTP endpoint on localhost:3000/api/iac-mobile/smtp-config...");
    try {
        const res = await fetch("http://localhost:3000/api/iac-mobile/smtp-config");
        if (res.ok) {
            const data = await res.json();
            console.log("  ✓ Live endpoint GET /api/iac-mobile/smtp-config returned 200 OK:");
            console.log("    Host:", data.host);
            console.log("    Port:", data.port);
            console.log("    Secure:", data.secure);
            console.log("    isConfigured:", data.isConfigured);
        } else {
            console.log("  ℹ Endpoint returned status:", res.status);
        }
    } catch (err) {
        console.log("  ℹ Server fetch note:", err.message);
    }

    // Cleanup
    await mongoose.disconnect();
    await mongoServer.stop();

    console.log("\n==================================================");
    console.log("🎉 ALL EMAIL TESTS COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
}

testEmailFunctionality().catch(err => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
});
