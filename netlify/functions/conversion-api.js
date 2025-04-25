'use strict';

const axios = require('axios');

// Function to hash the phone number (if needed)
function formatPhoneNumber(phone) {
  // Remove any non-digit characters
  return phone.replace(/\D/g, '');
}

exports.handler = async function(event, context) {
  // Enable CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { data, pixelId, accessToken } = JSON.parse(event.body);
    
    if (!data || !pixelId || !accessToken) {
      throw new Error('Missing required parameters: data, pixelId, or accessToken');
    }

    // Get and clean the IP address
    let clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || '';
    clientIp = clientIp.split(',')[0].trim();
    
    if (!clientIp || clientIp === 'unknown') {
      clientIp = '0.0.0.0';
    }

    const userAgent = event.headers['user-agent'] || '';

    // Format user data according to Facebook's requirements
    const formattedData = await Promise.all(data.map(async event => ({
      ...event,
      event_id: event.event_id, // Include event_id for deduplication
      event_time: event.event_time,
      action_source: event.action_source,
      event_source_url: event.event_source_url,
      user_data: {
        ...event.user_data,
        em: event.user_data.em ? [await sha256(event.user_data.em.toLowerCase())] : undefined,
        ph: event.user_data.ph ? [event.user_data.ph] : undefined,
        external_id: event.user_data.external_id ? [event.user_data.external_id] : undefined,
        client_ip_address: clientIp,
        client_user_agent: userAgent,
        fbc: event.user_data.fbc,
        fbp: event.user_data.fbp
      }
    })));

    const url = `https://graph.facebook.com/v17.0/${pixelId}/events?access_token=${accessToken}`;
    
    const response = await axios.post(url, {
      data: formattedData,
      test_event_code: process.env.FACEBOOK_TEST_EVENT_CODE // Optional: for testing
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        data: response.data 
      })
    };

  } catch (error) {
    console.error('Error details:', error.response?.data || error.message);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: error.response?.data || error.message 
      })
    };
  }
} 