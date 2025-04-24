'use strict';

const axios = require('axios');

// Function to hash the phone number (if needed)
function formatPhoneNumber(phone) {
  // Remove any non-digit characters
  return phone.replace(/\D/g, '');
}

exports.handler = async (event) => {
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
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const requestBody = JSON.parse(event.body);
    const { data, pixelId, accessToken } = requestBody;
    
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
    const userData = {
      ...data[0].user_data,
      client_ip_address: clientIp,
      client_user_agent: userAgent
    };

    const url = `https://graph.facebook.com/v17.0/${pixelId}/events?access_token=${accessToken}`;
    
    // Prepare the event data using the new structure
    const eventData = {
      data: [{
        ...data[0],
        user_data: userData
      }]
    };

    // Remove undefined values recursively
    const cleanObject = (obj) => {
      Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === 'object') {
          cleanObject(obj[key]);
        }
        if (obj[key] === undefined || obj[key] === null) {
          delete obj[key];
        }
      });
      return obj;
    };

    const cleanEventData = cleanObject(eventData);
    console.log('Sending event to Facebook:', JSON.stringify(cleanEventData, null, 2));

    const response = await axios.post(url, cleanEventData);
    console.log('Facebook API response:', response.data);

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