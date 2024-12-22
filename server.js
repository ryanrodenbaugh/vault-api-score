import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const app = express();

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Google Sheet ID
const SPREADSHEET_ID = '1vmF6WgW9VzRtO5HMQbC3GzXv5bhTJVixLLq25-w8KFk';

// Read credentials from environment variable
const credentials = process.env.GOOGLE_CREDENTIALS 
    ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
    : {};

async function fetchVaultScore(network, address) {
    try {
        if (!credentials.private_key || !credentials.client_email) {
            throw new Error('Google credentials not properly configured');
        }

        const auth = new JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
        await doc.loadInfo();
        
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        console.log('Total rows:', rows.length);
        
        const vault = rows.find(row => {
            const rowNetwork = row._rawData[4];  // network is in column E (index 4)
            const rowAddress = row._rawData[5];  // address is in column F (index 5)

            return rowNetwork && rowAddress &&
                   rowNetwork.toLowerCase() === network.toLowerCase() &&
                   rowAddress === address;
        });

        if (!vault) {
            return null;
        }

        return {
            name: vault._rawData[0],     // Vault name is in column A (index 0)
            score: `Score: ${vault._rawData[6]}`  // Format the score as requested
        };
    } catch (error) {
        console.error('Error fetching vault score:', error);
        throw error;
    }
}

// Root path handler
app.get('/', async (req, res) => {
    try {
        // Simple health check that doesn't require Google Sheets access
        res.status(200).json({
            status: 'online',
            message: 'Vault Score API is running',
            endpoints: {
                health: '/',
                vaultScore: '/api/vault-score/:network/:address'
            }
        });
    } catch (error) {
        console.error('Root endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// API endpoint
app.get('/api/vault-score/:network/:address', async (req, res) => {
    try {
        const { network, address } = req.params;
        console.log(`Received request for network: ${network}, address: ${address}`);
        
        const scoreData = await fetchVaultScore(network, address);
        
        if (!scoreData) {
            res.status(404).json({ error: 'Vault not found' });
            return;
        }
        
        res.json(scoreData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Handle 404s
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

export default app;