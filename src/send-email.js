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
async function sendHelloEmail(highlightedText,body, email) {
    // DEBUG: Log the environment variables to check if they are loaded
  console.log('--- Checking Credentials ---');
  console.log('Email User:', process.env.EMAIL_USER);
  console.log('Email Pass Loaded:', !!process.env.EMAIL_PASS); // Use !! to show true/false without logging the actual password
  console.log('--------------------------');

  // Highlight the selected text in the body for better visibility
  const highlightedHTML = body.replaceAll(highlightedText,'<span style="background-color: yellow;">' + highlightedText + '</span>');
  // console.log("highlightedHTML:", highlightedHTML);
  // console.log("highlightedText:", highlightedText," body:", body);
  // console.log("type of body:", typeof body," type of highlightedText:", typeof highlightedText);

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
    to: process.env.EMAIL_SEND + ","+email, // The email address toclea send to
    subject: 'Bug Report from VS Code Extension',
    html: '<h3>There has been a bug request from a student. The code is below and the highlighted section is the area of interest.</h3><pre>' + highlightedHTML + '</pre>' + '<h3>End of Code</h3><h3>Please Respond to:' + email + '</h3>',
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