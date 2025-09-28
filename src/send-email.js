// 1. Import Nodemailer
const nodemailer = require('nodemailer');
require('dotenv').config();
// 2. Create a "transporter" object
// This is the object that will actually send the email. It's configured with
// the details of the host email service.
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use a well-known service
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS, // Your App Password
  },
});

// 3. Create an "mailOptions" object
// This object defines the email's content.
const mailOptions = {
  from: '"Your Name" <YOUR_EMAIL@gmail.com>', // Sender address
  to: 'bshen0831@gmail.com', // List of receivers
  subject: 'Hello from Nodemailer! ✔', // Subject line
  text: 'This is a plain-text email.', // Plain text body
  html: '<b>This is an HTML email.</b><p>You can embed images and links!</p>', // HTML body
};

// 4. Send the email
// The sendMail method takes the mailOptions and a callback function.
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.error('Error occurred:', error.message);
  }
  console.log('Message sent successfully!');
  console.log('Message ID:', info.messageId);
  // You can see a preview URL if you're using a service like Ethereal
  // console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
});