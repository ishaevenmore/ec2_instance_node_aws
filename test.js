

const express = require('express');
const AWS = require('aws-sdk');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid'); // Import uuidv4 function from uuid package

// Create an instance of Express.js
const app = express();

// Configure AWS SDK with your credentials and region
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASIQY3GNB6TCSDKN4',
  secretAccessKey: 'pUsodARmInJzeZUfbg3FmgMV52CqJmx0xCk6BYN5'
});

// Create DynamoDB DocumentClient instance
const docClient = new AWS.DynamoDB.DocumentClient();

// AWS KMS service
const kms = new AWS.KMS();

// Read the JSON file
const jsonData = fs.readFileSync('/home/evenmore/ec2_instance_node_aws/node.json', 'utf8');

// Define the DynamoDB table name
const tableName = 'user';

// Encrypt the URL
async function encryptURL(url) {
    const cipher = crypto.createCipher('aes192', 'encryption_key');
    let encrypted = cipher.update(url, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// Function to chunk the data and save to DynamoDB
async function saveDataChunksToDynamoDB() {
    try {
        const chunkSize = 175; // Number of lines per chunk
        const chunks = jsonData.split('\n');
        
        // Parse the JSON data from the file
        const jsonParsed = JSON.parse(jsonData);
        const passUrl = jsonParsed.passUrl;
        
        const encryptedUrl = await encryptURL(passUrl.urls[0]);
        
        let parentId = null; // Initialize parent ID to null

        for (let i = 0; i < chunks.length; i += chunkSize) {
            const chunk = chunks.slice(i, i + chunkSize);
            let id;

            if (i === 0) {
                parentId = encryptedUrl; // Use the encrypted URL as the parent ID for the first chunk
                id = parentId.toString(); // Use the encrypted URL as the ID for the first chunk and convert to string
            } else {
                id = uuidv4(); // Generate a UUID for each chunk if it's not the first one
            }

            const params = {
                TableName: tableName,
                Item: {
                    id: id.toString(), // Ensure id is converted to string
                    parentId: parentId !== null && i !== 0 ? parentId.toString() : null, // Set parentId to null only for the first chunk and when i is not 0
                    data: {
                        lines: chunk.join('\n')
                    }
                }
            };

            await docClient.put(params).promise();
            console.log(`Chunk ${i / chunkSize + 1} saved to DynamoDB with Parent ID ${parentId === null || i === 0 ? 'null' : parentId} and ID ${id}`);
        }
    } catch (error) {
        console.error('Error saving data chunks to DynamoDB:', error);
    }
}

// Define a route handler for saving data chunks to DynamoDB
app.post('/saveDataChunksToDynamoDB', async (req, res) => {
    try {
        await saveDataChunksToDynamoDB();
        res.send('Data chunks saved to DynamoDB successfully');
    } catch (error) {
        console.error('Error saving data chunks to DynamoDB:', error);
        res.status(500).send('Internal server error');
    }
});

// Start the server
const port = 5000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
