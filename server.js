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
        // Debug logging
        console.log('Attempting to parse credentials...');
        console.log('Credentials string length:', process.env.GOOGLE_CREDENTIALS?.length);
        console.log('First 100 chars:', process.env.GOOGLE_CREDENTIALS?.substring(0, 100));
        
        let credentials;
        try {
            credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
            console.log('Credentials parsed successfully');
            console.log('Has private_key:', !!credentials.private_key);
            console.log('Has client_email:', !!credentials.client_email);
        } catch (parseError) {
            console.error('Parse error details:', parseError);
            throw new Error(`Failed to parse credentials: ${parseError.message}`);
        }

        if (!credentials.private_key || !credentials.client_email) {
            throw new Error('Missing required credentials fields');
        }

        console.log('4. Creating JWT auth...');
        let auth;
        try {
            auth = new JWT({
                email: credentials.client_email,
                key: credentials.private_key.replace(/\\n/g, '\n'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            });
            console.log('5. JWT auth created successfully');
        } catch (jwtError) {
            console.error('JWT creation error:', jwtError);
            throw jwtError;
        }

        console.log('6. Creating GoogleSpreadsheet instance...');
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
        console.log('7. Instance created');

        console.log('8. Attempting to load spreadsheet info...');
        try {
            await doc.loadInfo();
            console.log('9. Successfully loaded spreadsheet info');
        } catch (loadError) {
            console.error('Error loading spreadsheet:', loadError);
            if (loadError.response) {
                console.error('Response status:', loadError.response.status);
                console.error('Response data:', loadError.response.data);
            }
            throw loadError;
        }

        const sheet = doc.sheetsByIndex[0];
        console.log('10. Got first sheet');

        console.log('11. Attempting to get rows...');
        const rows = await sheet.getRows();
        console.log(`12. Successfully got ${rows.length} rows`);

        console.log('13. Searching for vault...');
        console.log(`Looking for network: ${network}, address: ${address}`);
        
        const vault = rows.find(row => {
            const rowNetwork = row._rawData[4];
            const rowAddress = row._rawData[5];
            
            console.log(`Checking row - Network: ${rowNetwork}, Address: ${rowAddress}`);
            
            return rowNetwork && rowAddress &&
                   rowNetwork.toLowerCase() === network.toLowerCase() &&
                   rowAddress.toLowerCase() === address.toLowerCase();
        });

        if (!vault) {
            console.log('14. No vault found matching criteria');
            return null;
        }

        console.log('15. Vault found, returning data');
        const result = {
            name: vault._rawData[0],
            score: `Score: ${vault._rawData[6]}`
        };
        console.log('Result:', result);
        return result;
    } catch (error) {
        console.error('Error in spreadsheet operations:', error);
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
        console.error('API Error:', error);
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default app;