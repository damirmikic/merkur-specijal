// Netlify Function to fetch odds from Ladbrokes API
// This bypasses CORS restrictions by making the request server-side

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS request for CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // Get event ID from query parameters
        const eventId = event.queryStringParameters?.eventId;

        if (!eventId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Event ID is required' })
            };
        }

        const oddsUrl = `https://ss-aka-ori.ladbrokes.com/openbet-ssviewer/Drilldown/2.86/EventToOutcomeForEvent/${eventId}?scorecast=true&translationLang=en&responseFormat=json&referenceEachWayTerms=true`;

        console.log('Fetching odds from:', oddsUrl);

        const response = await fetch(oddsUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Error fetching odds:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to fetch odds',
                message: error.message
            })
        };
    }
};
