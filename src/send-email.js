const nodemailer = require('nodemailer');


// emailService.js
const path = require('path');

// Ensure this path correctly points to the .env file in your project's root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Sends an email using Nodemailer with pre-defined options.
 * This function returns a promise that resolves on success or rejects on failure.
 * @returns {Promise<string>} A promise that resolves with the message ID of the sent email.
 */
async function sendHelloEmail(body) {
    // DEBUG: Log the environment variables to check if they are loaded
  console.log('--- Checking Credentials ---');
  console.log('Email User:', process.env.EMAIL_USER);
  console.log('Email Pass Loaded:', !!process.env.EMAIL_PASS); // Use !! to show true/false without logging the actual password
  console.log('--------------------------');

  // 1. Create a transporter object using credentials from .env
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
 
  // 2. Define the email's content
  const mailOptions = {
    from: `"VS Code Extension" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_SEND, // The email address toclea send to
    subject: 'Hello World Command Executed! 🚀',
    text:  body.replace(/<[^>]*>?/gm, ''), // Create a plain text version from HTML,
    html: '<h3>Hello World Command Executed!</h3><p>' + body + '</p>',
  };

  // 3. Send the email and return the result
  // We use async/await here to handle the promise returned by sendMail
  const info = await transporter.sendMail(mailOptions);
  return info.messageId;
}

// Export the function so it can be used in other files
module.exports = {
  sendHelloEmail,
};