// Import required libraries
import axios from 'axios'; //const axios = require('axios');
import { Octokit } from '@octokit/rest'; //const { Octokit } = require('@octokit/rest');

// Get environment variables (we'll store these securely later)
const ACCUWEATHER_API_KEY = process.env.ACCUWEATHER_API_KEY;
const LOCATION_KEY = process.env.LOCATION_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

// Initialize Octokit (GitHub API client)
const octokit = new Octokit({
  auth: GITHUB_TOKEN
});

// Extract owner and repo from the GITHUB_REPOSITORY variable (format: 'owner/repo')
const [owner, repo] = GITHUB_REPOSITORY.split('/');

// Function to fetch weather forecast from AccuWeather
async function getWeatherForecast() {
  try {
    const url = `http://dataservice.accuweather.com/forecasts/v1/daily/5day/${LOCATION_KEY}?apikey=${ACCUWEATHER_API_KEY}&details=true`;
    const response = await axios.get(url);
    return response.data.DailyForecasts;
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    throw error;
  }
}

// Function to analyze forecast for garden-relevant conditions
function analyzeGardenConditions(forecast) {
  const alerts = [];
  
  forecast.forEach((day, index) => {
    const date = new Date(day.Date);
    const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const conditions = day.Day.IconPhrase;
    const tempHigh = day.Temperature.Maximum.Value;
    const tempLow = day.Temperature.Minimum.Value;
    const rainProb = day.Day.RainProbability;
    
    // Check for frost risk (below 36°F / 2°C)
    if (tempLow <= 36) {
      alerts.push(`🥶 FROST ALERT for ${formattedDate}: Overnight low of ${tempLow}°F - Cover sensitive plants!`);
    }
    
    // Check for heat stress (above 90°F / 32°C)
    if (tempHigh >= 90) {
      alerts.push(`🔥 HEAT ALERT for ${formattedDate}: High of ${tempHigh}°F - Water plants thoroughly in morning/evening!`);
    }
    
    // Check for heavy rain
    if (rainProb >= 70) {
      alerts.push(`💧 RAIN ALERT for ${formattedDate}: ${rainProb}% chance of precipitation - Hold off on fertilizing!`);
    }
    
    // Drought warning (3+ consecutive days with <30% rain chance)
    if (index <= 2 && rainProb < 30) {
      if (index === 0 || (index > 0 && forecast[index-1].Day.RainProbability < 30)) {
        alerts.push(`🏜️ DRY SPELL for ${formattedDate}: Low rain chance continues - Deep water your garden!`);
      }
    }
  });
  
  return alerts;
}

// Function to create GitHub issue with alerts
async function createGardenAlertIssue(alerts) {
  // If no alerts, no need to create an issue
  if (alerts.length === 0) {
    console.log('No garden alerts for today!');
    return;
  }
  
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Build issue content
  const issueTitle = `🌱 Garden Weather Alert: ${alerts.length} condition${alerts.length > 1 ? 's' : ''} to watch for ${today}`;
  
  const issueBody = `
# Garden Weather Alerts for ${today}

${alerts.map(alert => `- ${alert}`).join('\n')}

## Recommended Actions

Please check your garden and take appropriate actions based on these alerts.

---
*This issue was automatically generated by the Garden Weather Alerts system.*
  `;
  
  // Create GitHub issue
  try {
    const response = await octokit.issues.create({
      owner,
      repo,
      title: issueTitle,
      body: issueBody,
      labels: ['garden-alert', 'automated']
    });
    
    console.log(`Garden alerts issue created successfully! Issue #${response.data.number}`);
    return response.data;
  } catch (error) {
    console.error('Error creating GitHub issue:', error);
    throw error;
  }
}

// Main function to run the entire process
async function runWeatherAlerts() {
  try {
    console.log('Fetching weather forecast...');
    const forecast = await getWeatherForecast();
    
    console.log('Analyzing garden conditions...');
    const alerts = analyzeGardenConditions(forecast);
    
    console.log('Creating GitHub issue with alerts...');
    await createGardenAlertIssue(alerts);
    
    console.log('Weather alert process completed successfully!');
  } catch (error) {
    console.error('Error in weather alert process:', error);
    process.exit(1);
  }
}

// Run the program
runWeatherAlerts();
