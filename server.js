import express from 'express';

const app = express();

// Basic root endpoint
app.get('/', (req, res) => {
    res.status(200).send('Vault Score API');
});

// API endpoint
app.get('/api/vault-score/:network/:address', async (req, res) => {
    res.status(200).json({
        message: 'API endpoint working',
        params: req.params
    });
});

// Export the express app
export default app;