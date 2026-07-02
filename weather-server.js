#!/usr/bin/env node

/**
 * Simple MCP Weather Server for testing
 * Implements the Model Context Protocol for weather data
 */

import readline from 'readline';

class WeatherServer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Mock weather data
    this.weatherData = {
      'beijing': { temp: 15, condition: 'cloudy', humidity: 65 },
      'shanghai': { temp: 22, condition: 'sunny', humidity: 45 },
      'guangzhou': { temp: 28, condition: 'rainy', humidity: 80 },
      'shenzhen': { temp: 26, condition: 'partly cloudy', humidity: 70 },
      'new york': { temp: 18, condition: 'sunny', humidity: 55 },
      'london': { temp: 12, condition: 'rainy', humidity: 85 },
      'tokyo': { temp: 20, condition: 'cloudy', humidity: 60 }
    };
  }

  start() {
    // Send initialization message
    this.sendMessage({
      jsonrpc: '2.0',
      method: 'initialized',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: {
          name: 'weather-server',
          version: '1.0.0'
        }
      }
    });

    // Listen for messages
    this.rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        this.sendError(null, -32700, 'Parse error', error.message);
      }
    });

    this.rl.on('close', () => {
      process.exit(0);
    });
  }

  sendMessage(message) {
    console.log(JSON.stringify(message));
  }

  sendError(id, code, message, data = null) {
    this.sendMessage({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data
      }
    });
  }

  handleMessage(message) {
    const { id, method, params } = message;

    switch (method) {
      case 'initialize':
        this.sendMessage({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {
                listChanged: false
              }
            },
            serverInfo: {
              name: 'weather-server',
              version: '1.0.0'
            }
          }
        });
        break;

      case 'tools/list':
        this.sendMessage({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'get_weather',
                description: 'Get current weather information for a city',
                inputSchema: {
                  type: 'object',
                  properties: {
                    city: {
                      type: 'string',
                      description: 'The city name to get weather for'
                    },
                    units: {
                      type: 'string',
                      enum: ['celsius', 'fahrenheit'],
                      description: 'Temperature units',
                      default: 'celsius'
                    }
                  },
                  required: ['city']
                }
              },
              {
                name: 'get_forecast',
                description: 'Get weather forecast for a city',
                inputSchema: {
                  type: 'object',
                  properties: {
                    city: {
                      type: 'string',
                      description: 'The city name to get forecast for'
                    },
                    days: {
                      type: 'number',
                      description: 'Number of days to forecast',
                      minimum: 1,
                      maximum: 7,
                      default: 3
                    }
                  },
                  required: ['city']
                }
              }
            ]
          }
        });
        break;

      case 'tools/call':
        this.handleToolCall(id, params);
        break;

      default:
        this.sendError(id, -32601, 'Method not found');
    }
  }

  handleToolCall(id, params) {
    const { name, arguments: args } = params;

    switch (name) {
      case 'get_weather':
        this.getWeather(id, args);
        break;
      case 'get_forecast':
        this.getForecast(id, args);
        break;
      default:
        this.sendError(id, -32601, 'Tool not found');
    }
  }

  getWeather(id, args) {
    const { city, units = 'celsius' } = args;
    const cityKey = city.toLowerCase();
    
    if (!this.weatherData[cityKey]) {
      this.sendError(id, -32000, 'City not found', `Weather data not available for ${city}`);
      return;
    }

    const weather = this.weatherData[cityKey];
    let temp = weather.temp;
    
    if (units === 'fahrenheit') {
      temp = Math.round((temp * 9/5) + 32);
    }

    this.sendMessage({
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: `Current weather in ${city}:
Temperature: ${temp}°${units === 'celsius' ? 'C' : 'F'}
Condition: ${weather.condition}
Humidity: ${weather.humidity}%`
          }
        ]
      }
    });
  }

  getForecast(id, args) {
    const { city, days = 3 } = args;
    const cityKey = city.toLowerCase();
    
    if (!this.weatherData[cityKey]) {
      this.sendError(id, -32000, 'City not found', `Weather data not available for ${city}`);
      return;
    }

    const baseWeather = this.weatherData[cityKey];
    const forecast = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Generate some variation in the forecast
      const tempVariation = Math.floor(Math.random() * 6) - 3; // -3 to +3
      const temp = baseWeather.temp + tempVariation;
      
      const conditions = ['sunny', 'cloudy', 'partly cloudy', 'rainy'];
      const condition = i === 0 ? baseWeather.condition : conditions[Math.floor(Math.random() * conditions.length)];
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        temperature: temp,
        condition: condition,
        humidity: baseWeather.humidity + Math.floor(Math.random() * 20) - 10
      });
    }

    this.sendMessage({
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: `${days}-day weather forecast for ${city}:
${forecast.map(day => 
  `${day.date}: ${day.temperature}°C, ${day.condition}, ${day.humidity}% humidity`
).join('\n')}`
          }
        ]
      }
    });
  }
}

// Start the server
const server = new WeatherServer();
server.start();