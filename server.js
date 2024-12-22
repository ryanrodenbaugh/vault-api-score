import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Google Sheet ID from your URL
const SPREADSHEET_ID = '1vmF6WgW9VzRtO5HMQbC3GzXv5bhTJVixLLq25-w8KFk';

// Read credentials
const credentials = JSON.parse(fs.readFileSync('./credentials.json'));

async function fetchVaultScore(network, address) {
    try {
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
        console.log('Searching for vault with network:', network, 'address:', address);

        const vault = rows.find(row => {
            const rowNetwork = row._rawData[4];  // network is in column E (index 4)
            const rowAddress = row._rawData[5];  // address is in column F (index 5)

            return rowNetwork && rowAddress &&
                   rowNetwork.toLowerCase() === network.toLowerCase() &&
                   rowAddress.trim() === address;
        });

        if (!vault) {
            console.log('No vault found');
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});