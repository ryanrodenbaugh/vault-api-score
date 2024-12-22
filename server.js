import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const app = express();

// Basic root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'online',
        message: 'Vault Score API',
        endpoints: {
            vaultScore: '/api/vault-score/:network/:address'
        }
    });
});

// Google Sheet ID
const SPREADSHEET_ID = '1vmF6WgW9VzRtO5HMQbC3GzXv5bhTJVixLLq25-w8KFk';

async function fetchVaultScore(network, address) {
    try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
        
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
        
        const vault = rows.find(row => {
            const rowNetwork = row._rawData[4];
            const rowAddress = row._rawData[5];
            return rowNetwork && rowAddress &&
                   rowNetwork.toLowerCase() === network.toLowerCase() &&
                   rowAddress === address;
        });

        if (!vault) {
            return null;
        }

        return {
            name: vault._rawData[0],
            score: `Score: ${vault._rawData[6]}`
        };
    } catch (error) {
        console.error('Error fetching vault score:', error);
        throw error;
    }
}

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
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

export default app;