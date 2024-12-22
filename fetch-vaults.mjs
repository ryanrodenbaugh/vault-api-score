import fetch from 'node-fetch';
import fs from 'fs';

const API_KEY = 'kta8sLLthcVX8qVApyIBl2YI3uVxlLQKj1K6NtfG9uo';

async function fetchVaultDetails(vault, retryCount = 0) {
    try {
        const detailsResponse = await fetch(
            `https://api.vaults.fyi/v1/vaults/${vault.network}/${vault.address}`,
            {
                headers: {
                    'x-api-key': API_KEY,
                    'Accept': 'application/json'
                }
            }
        );

        if (detailsResponse.status === 429 && retryCount < 3) {
            console.log(`Rate limited for vault ${vault.address}, waiting 60 seconds before retrying...`);
            await new Promise(resolve => setTimeout(resolve, 60000)); // 60 second wait on rate limit
            return fetchVaultDetails(vault, retryCount + 1);
        }

        if (!detailsResponse.ok) {
            throw new Error(`HTTP error! status: ${detailsResponse.status}`);
        }

        const vaultDetails = await detailsResponse.json();
        return {
            name: vaultDetails.name,
            token: vaultDetails.token?.symbol || 'N/A',
            protocol_tvl: vaultDetails.tvlDetails?.tvlUsd || '0',
            pool_tvl: vaultDetails.tvlDetails?.tvlUsd || '0',
            network: vaultDetails.network,
            address: vaultDetails.address
        };
    } catch (error) {
        console.warn(`Error fetching vault ${vault.address}:`, error.message);
        return null;
    }
}

async function fetchVaultsData() {
    try {
        console.log('Fetching list of vaults...');
        const listResponse = await fetch('https://api.vaults.fyi/v1/vaults', {
            method: 'GET',
            headers: {
                'x-api-key': API_KEY,
                'Accept': 'application/json'
            }
        });

        if (!listResponse.ok) {
            throw new Error(`HTTP error! status: ${listResponse.status}`);
        }

        const vaultsList = await listResponse.json();
        console.log(`Found ${vaultsList.length} vaults`);

        const allVaultData = [];
        const failedVaults = [];

        for (let i = 0; i < vaultsList.length; i++) {
            const vault = vaultsList[i];
            console.log(`Fetching details for vault ${i + 1}/${vaultsList.length}`);
            
            const vaultData = await fetchVaultDetails(vault);
            
            if (vaultData) {
                allVaultData.push(vaultData);
            } else {
                failedVaults.push(vault);
            }

            // Small delay between requests (100 per minute = ~600ms between requests to be safe)
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        // Save successful vault data to CSV
        const csvHeaders = ['name', 'token', 'protocol_tvl', 'pool_tvl', 'network', 'address'];
        const csvContent = [
            csvHeaders.join(','),
            ...allVaultData.map(vault => csvHeaders.map(header => `"${vault[header] || ''}"`).join(','))
        ].join('\n');

        fs.writeFileSync('vault_data.csv', csvContent);
        console.log(`Data saved to vault_data.csv (${allVaultData.length} vaults)`);

        // Save failed vault addresses to separate file
        if (failedVaults.length > 0) {
            fs.writeFileSync('failed_vaults.json', JSON.stringify(failedVaults, null, 2));
            console.log(`${failedVaults.length} failed vaults saved to failed_vaults.json`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

fetchVaultsData();