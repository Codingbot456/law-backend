const express = require('express');
const db = require('../config/db');
const upload = require('../middleware/upload');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { getAccessToken, processStkPush, confirmStkPush } = require('../services/mpesaService');

const router = express.Router();

// Setup email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper function to format phone numbers
function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) {
        throw new Error('Phone number is required');
    }

    // Remove all non-numeric characters and leading '+'
    const cleaned = phoneNumber.replace(/^\+/, '').replace(/[^0-9]/g, '');

    // Kenyan phone numbers should start with '254', remove leading '0' if present
    const countryCode = '254'; // Kenyan country code

    // Check if the number starts with '0' and prepend country code if needed
    if (cleaned.startsWith('0')) {
        return countryCode + cleaned.slice(1);
    }

    // If already includes country code or is correctly formatted, return as is
    return cleaned.startsWith(countryCode) ? cleaned : countryCode + cleaned;
}

// Endpoint to handle form submission
router.post('/', upload.array('attachments'), async (req, res) => {
    const { userId, type, question, minWords, isUrgent, budget, category } = req.body;
    const attachments = req.files.map((file) => file.filename);

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const sql = 'INSERT INTO submissions (userId, type, question, minWords, isUrgent, attachments, budget, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        await db.query(sql, [userId, type, question, minWords, isUrgent, JSON.stringify(attachments), budget, category]);
        console.log(`Form submission successful: UserID ${userId}`);
        res.status(200).json({ message: 'Submission stored successfully!' });
    } catch (error) {
        console.error('Database error during form submission:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to handle answer submission
router.post('/answers', upload.array('attachments'), async (req, res) => {
    const { answer, budget, submissionId, userId } = req.body;
    const attachments = req.files.map((file) => file.filename);
    const paymentToken = crypto.randomBytes(20).toString('hex');

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const sql = 'INSERT INTO answers (answer, budget, attachments, submissionId, userId, paymentStatus, paymentToken) VALUES (?, ?, ?, ?, ?, ?, ?)';
        await db.query(sql, [answer, budget, JSON.stringify(attachments), submissionId, userId, 'pending', paymentToken]);
        console.log(`Answer submission successful: SubmissionID ${submissionId}, UserID ${userId}`);

        // Fetch the question poster's email and phone number
        const [rows] = await db.query('SELECT s.userId, u.email, u.phone FROM submissions s JOIN users u ON s.userId = u.id WHERE s.id = ?', [submissionId]);
        if (rows.length > 0) {
            const { email, phone } = rows[0];

            if (!phone) {
                console.error('Phone number not found for the given submission ID:', submissionId);
                return res.status(400).json({ error: 'Phone number is required for payment processing' });
            }

            const formattedPhoneNumber = formatPhoneNumber(phone);

            console.log('Sending email to:', email);

            // Generate a payment link
            const paymentLink = `${process.env.BASE_URL}/payment/${paymentToken}`;

            // Send email notification
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Your question has been answered!',
                text: `Your question with ID ${submissionId} has been answered. To view the answer, please make a payment of ${budget} using the following link: ${paymentLink}`,
                html: `<p>Your question with ID ${submissionId} has been answered. To view the answer, please make a payment of <strong>${budget}</strong> using the following link: <a href="${paymentLink}">Pay Now</a></p>`,
            };

            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully to:', email);

            // Process STK Push Payment
            try {
                const accessToken = await getAccessToken();
                console.log('Access Token acquired:', accessToken);
                console.log('Processing STK Push with formatted phone number:', formattedPhoneNumber);

                await processStkPush(accessToken, formattedPhoneNumber, budget, paymentToken, res);
            } catch (error) {
                console.error('Error acquiring access token or processing STK push:', error);
                res.status(500).json({ error: 'Payment processing failed' });
            }
        } else {
            console.log('No user found for the given submission ID:', submissionId);
            res.status(404).json({ error: 'User not found for the given submission' });
        }
    } catch (error) {
        console.error('Error during answer submission or email sending:', error);
        res.status(500).json({ error: 'Database error or email sending failed' });
    }
});

// Endpoint to handle payment link click
router.get('/payment/:paymentToken', async (req, res) => {
    const { paymentToken } = req.params;

    try {
        // Fetch the answer details using the payment token
        const [rows] = await db.query('SELECT * FROM answers WHERE paymentToken = ?', [paymentToken]);
        if (rows.length > 0) {
            const { budget } = rows[0];

            // Display a payment page or redirect to a payment gateway
            res.send(`
                <html>
                <body>
                    <h1>Pay ${budget}</h1>
                    <form action="/payment/confirm/${paymentToken}" method="post">
                        <button type="submit">Pay Now</button>
                    </form>
                </body>
                </html>
            `);
        } else {
            res.status(404).send('Payment request not found');
        }
    } catch (error) {
        console.error('Error during payment link processing:', error);
        res.status(500).json({ error: 'Error processing payment link' });
    }
});

// Endpoint to confirm payment
router.post('/payment/confirm/:paymentToken', async (req, res) => {
    const { paymentToken } = req.params;

    try {
        // Fetch the answer details using the payment token
        const [rows] = await db.query('SELECT * FROM answers WHERE paymentToken = ?', [paymentToken]);
        if (rows.length > 0) {
            const { submissionId } = rows[0];

            // Complete the payment process and update payment status
            // You should process STK Push payment confirmation here
            // For simplicity, we'll just update the payment status to 'completed'
            const sql = 'UPDATE answers SET paymentStatus = ? WHERE paymentToken = ?';
            await db.query(sql, ['completed', paymentToken]);

            res.send('Payment completed successfully. You can now view the answer.');
        } else {
            res.status(404).send('Payment request not found');
        }
    } catch (error) {
        console.error('Error during payment confirmation:', error);
        res.status(500).json({ error: 'Error confirming payment' });
    }
});

// Endpoint to get all submissions
router.get('/', async (req, res) => {
    try {
        const sql = 'SELECT * FROM submissions';
        const [results] = await db.query(sql);
        console.log('Fetched all submissions successfully');
        res.status(200).json(results);
    } catch (error) {
        console.error('Database error during fetching all submissions:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get submissions by userId
router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const sql = 'SELECT * FROM submissions WHERE userId = ?';
        const [results] = await db.query(sql, [userId]);
        console.log(`Fetched submissions for userID ${userId}`);
        res.status(200).json(results);
    } catch (error) {
        console.error('Database error during fetching submissions by userId:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get submissions and their answers by userId
router.get('/user/questions/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const sql = `
            SELECT s.*, a.answer, a.budget, a.paymentStatus
            FROM submissions s
            LEFT JOIN answers a ON s.id = a.submissionId
            WHERE s.userId = ?`;
        const [results] = await db.query(sql, [userId]);
        console.log(`Fetched questions and answers for userID ${userId}`);
        res.status(200).json(results);
    } catch (error) {
        console.error('Database error during fetching user questions and answers:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get tasks done by a user (questions answered by the user)
router.get('/user/tasks/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const sql = `
            SELECT s.question, a.answer, a.budget, a.paymentStatus
            FROM submissions s
            INNER JOIN answers a ON s.id = a.submissionId
            WHERE a.userId = ?`;
        const [results] = await db.query(sql, [userId]);
        console.log(`Fetched tasks for userID ${userId}`);
        res.status(200).json(results);
    } catch (error) {
        console.error('Database error during fetching user tasks:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get questions asked by a user
router.get('/user/questions/asked/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const sql = `
            SELECT s.id, s.question, s.budget, 
                   CASE 
                     WHEN a.submissionId IS NOT NULL THEN 'Yes'
                     ELSE 'No'
                   END AS answered
            FROM submissions s
            LEFT JOIN answers a ON s.id = a.submissionId
            WHERE s.userId = ?`;
        const [results] = await db.query(sql, [userId]);
        console.log(`Fetched questions asked by userID ${userId}`);
        res.status(200).json(results);
    } catch (error) {
        console.error('Database error during fetching questions asked by user:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get answers for a specific submission
router.get('/answers/:submissionId', async (req, res) => {
    const { submissionId } = req.params;
    try {
        const sql = 'SELECT * FROM answers WHERE submissionId = ?';
        const [results] = await db.query(sql, [submissionId]);
        console.log(`Fetched answers for submissionID ${submissionId}`);
        res.status(200).json(results);
    } catch (error) {
        console.error('Database error during fetching answers for submission:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get answers by userId
router.get('/user/answers/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const sql = `
            SELECT a.*
            FROM answers a
            INNER JOIN submissions s ON a.submissionId = s.id
            WHERE s.userId = ?`;
        const [results] = await db.query(sql, [userId]);
        console.log(`Fetched answers by userID ${userId}`);
        res.status(200).json(results);
    } catch (error) {
        console.error('Database error during fetching answers by userId:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get submissions by type
router.get('/type/:type', async (req, res) => {
    const { type } = req.params;
    try {
        const sql = 'SELECT * FROM submissions WHERE type = ?';
        const [results] = await db.query(sql, [type]);
        console.log(`Fetched submissions by type ${type}`);
        res.status(200).json(results);
    } catch (error) {
        console.error('Database error during fetching submissions by type:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get answers for a specific submission based on payment status
router.get('/answers/view/:submissionId', async (req, res) => {
    const { submissionId } = req.params;
    try {
        const [answers] = await db.query('SELECT * FROM answers WHERE submissionId = ?', [submissionId]);
        if (answers.length > 0 && answers[0].paymentStatus === 'completed') {
            console.log(`Answers are available for submissionID ${submissionId}`);
            res.status(200).json(answers);
        } else {
            console.log(`Payment required or no answers found for submissionID ${submissionId}`);
            res.status(403).json({ error: 'Payment required to view answers' });
        }
    } catch (error) {
        console.error('Database error during fetching answers for view based on payment status:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
