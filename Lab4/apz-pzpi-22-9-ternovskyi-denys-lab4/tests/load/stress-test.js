const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

class StressTest {
  constructor(baseUrl = 'http://localhost:8080', options = {}) {
    this.baseUrl = baseUrl;
    this.options = {
      concurrency: options.concurrency || 10,
      duration: options.duration || 60000, // 60 seconds
      rampUpTime: options.rampUpTime || 10000, // 10 seconds
      ...options
    };
    
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      responseTimes: [],
      errors: [],
      statusCodes: {}
    };
    
    this.isRunning = false;
    this.startTime = 0;
  }

  // Make HTTP request
  async makeRequest(method, path, headers = {}, body = null) {
    const url = new URL(path, this.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {
        'User-Agent': 'Smart-Lamp-Stress-Test/1.0',
        ...headers
      }
    };

    if (body && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          try {
            const jsonData = data ? JSON.parse(data) : {};
            resolve({
              statusCode: res.statusCode,
              responseTime,
              data: jsonData,
              headers: res.headers,
              success: res.statusCode >= 200 && res.statusCode < 300
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              responseTime,
              data: data,
              headers: res.headers,
              success: res.statusCode >= 200 && res.statusCode < 300,
              parseError: error.message
            });
          }
        });
      });
      
      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        resolve({
          statusCode: 0,
          responseTime,
          error: error.message,
          success: false
        });
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        resolve({
          statusCode: 0,
          responseTime,
          error: 'Request timeout',
          success: false
        });
      });
      
      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  // Generate random test data
  generateTestUser() {
    const randomId = Math.random().toString(36).substring(7);
    return {
      username: `stress_test_${randomId}`,
      email: `stress_test_${randomId}@example.com`,
      password: 'StressTest123',
      firstName: 'Stress',
      lastName: 'Test'
    };
  }

  // Test health endpoint
  async testHealth() {
    return this.makeRequest('GET', '/health');
  }

  // Test user registration
  async testRegister() {
    const userData = this.generateTestUser();
    const body = JSON.stringify(userData);
    const headers = {
      'Content-Type': 'application/json'
    };
    
    return this.makeRequest('POST', '/api/auth/register', headers, body);
  }

  // Test user login
  async testLogin(email, password) {
    const loginData = { email, password };
    const body = JSON.stringify(loginData);
    const headers = {
      'Content-Type': 'application/json'
    };
    
    return this.makeRequest('POST', '/api/auth/login', headers, body);
  }

  // Test get profile
  async testProfile(accessToken) {
    const headers = {
      'Authorization': `Bearer ${accessToken}`
    };
    
    return this.makeRequest('GET', '/api/auth/me', headers);
  }

  // Record test result
  recordResult(result) {
    this.results.totalRequests++;
    
    if (result.success) {
      this.results.successfulRequests++;
    } else {
      this.results.failedRequests++;
      this.results.errors.push({
        error: result.error,
        statusCode: result.statusCode,
        timestamp: new Date().toISOString()
      });
    }
    
    // Record response time
    if (result.responseTime) {
      this.results.responseTimes.push(result.responseTime);
      this.results.minResponseTime = Math.min(this.results.minResponseTime, result.responseTime);
      this.results.maxResponseTime = Math.max(this.results.maxResponseTime, result.responseTime);
    }
    
    // Record status codes
    const statusCode = result.statusCode || 0;
    this.results.statusCodes[statusCode] = (this.results.statusCodes[statusCode] || 0) + 1;
  }

  // Calculate final statistics
  calculateStats() {
    if (this.results.responseTimes.length > 0) {
      this.results.averageResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length;
      
      // Calculate percentiles
      const sorted = this.results.responseTimes.slice().sort((a, b) => a - b);
      const len = sorted.length;
      
      this.results.p50 = sorted[Math.floor(len * 0.5)];
      this.results.p95 = sorted[Math.floor(len * 0.95)];
      this.results.p99 = sorted[Math.floor(len * 0.99)];
    }
    
    this.results.successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
    this.results.requestsPerSecond = this.results.totalRequests / ((Date.now() - this.startTime) / 1000);
  }

  // Run a mixed load test scenario
  async runMixedScenario() {
    const scenarios = [
      { name: 'health', weight: 0.4, test: () => this.testHealth() },
      { name: 'register', weight: 0.2, test: () => this.testRegister() },
      { name: 'register_login_profile', weight: 0.4, test: () => this.testFullUserFlow() }
    ];
    
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const scenario of scenarios) {
      cumulativeWeight += scenario.weight;
      if (random <= cumulativeWeight) {
        try {
          const result = await scenario.test();
          this.recordResult(result);
          return { scenario: scenario.name, result };
        } catch (error) {
          this.recordResult({ success: false, error: error.message, statusCode: 0 });
          return { scenario: scenario.name, error: error.message };
        }
      }
    }
  }

  // Test full user flow (register -> login -> profile)
  async testFullUserFlow() {
    // Register user
    const registerResult = await this.testRegister();
    if (!registerResult.success) {
      return registerResult;
    }
    
    // Extract user data for login
    const userData = registerResult.data?.data?.user;
    if (!userData) {
      return { success: false, error: 'No user data in registration response', statusCode: 500 };
    }
    
    // Login
    const loginResult = await this.testLogin(userData.email, 'StressTest123');
    if (!loginResult.success) {
      return loginResult;
    }
    
    // Get access token
    const accessToken = loginResult.data?.data?.accessToken;
    if (!accessToken) {
      return { success: false, error: 'No access token in login response', statusCode: 500 };
    }
    
    // Get profile
    return this.testProfile(accessToken);
  }

  // Display real-time stats
  displayStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rps = this.results.totalRequests / elapsed;
    
    console.clear();
    console.log('='.repeat(60));
    console.log('SMART LAMP TASK SERVER - STRESS TEST');
    console.log('='.repeat(60));
    console.log(`Target: ${this.baseUrl}`);
    console.log(`Elapsed: ${elapsed.toFixed(1)}s`);
    console.log(`Concurrency: ${this.options.concurrency}`);
    console.log('');
    console.log('REQUESTS:');
    console.log(`  Total: ${this.results.totalRequests}`);
    console.log(`  Successful: ${this.results.successfulRequests} (${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`  Failed: ${this.results.failedRequests} (${((this.results.failedRequests / this.results.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`  Requests/sec: ${rps.toFixed(2)}`);
    console.log('');
    
    if (this.results.responseTimes.length > 0) {
      console.log('RESPONSE TIMES (ms):');
      console.log(`  Average: ${this.results.averageResponseTime.toFixed(2)}`);
      console.log(`  Min: ${this.results.minResponseTime.toFixed(2)}`);
      console.log(`  Max: ${this.results.maxResponseTime.toFixed(2)}`);
      if (this.results.p50) {
        console.log(`  P50: ${this.results.p50.toFixed(2)}`);
        console.log(`  P95: ${this.results.p95.toFixed(2)}`);
        console.log(`  P99: ${this.results.p99.toFixed(2)}`);
      }
      console.log('');
    }
    
    console.log('STATUS CODES:');
    Object.entries(this.results.statusCodes).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
    
    if (this.results.errors.length > 0) {
      console.log('');
      console.log('RECENT ERRORS:');
      this.results.errors.slice(-5).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.error} (${error.statusCode})`);
      });
    }
  }

  // Run the stress test
  async run() {
    console.log(`Starting stress test on ${this.baseUrl}`);
    console.log(`Concurrency: ${this.options.concurrency}, Duration: ${this.options.duration}ms`);
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    // Display stats interval
    const statsInterval = setInterval(() => {
      if (this.isRunning) {
        this.displayStats();
      }
    }, 1000);
    
    // Ramp up workers gradually
    const workers = [];
    const rampUpDelay = this.options.rampUpTime / this.options.concurrency;
    
    for (let i = 0; i < this.options.concurrency; i++) {
      setTimeout(() => {
        if (this.isRunning) {
          workers.push(this.startWorker());
        }
      }, i * rampUpDelay);
    }
    
    // Stop test after duration
    setTimeout(() => {
      this.isRunning = false;
      clearInterval(statsInterval);
      
      this.calculateStats();
      this.displayStats();
      
      console.log('\n='.repeat(60));
      console.log('TEST COMPLETED');
      console.log('='.repeat(60));
      
      // Save results to file
      this.saveResults();
      
    }, this.options.duration + this.options.rampUpTime);
  }

  // Individual worker that makes requests continuously
  async startWorker() {
    while (this.isRunning) {
      await this.runMixedScenario();
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
  }

  // Save results to JSON file
  saveResults() {
    const fs = require('fs');
    const path = require('path');
    
    const resultsFile = path.join(__dirname, `stress-test-results-${Date.now()}.json`);
    const reportData = {
      testConfig: this.options,
      baseUrl: this.baseUrl,
      timestamp: new Date().toISOString(),
      results: this.results
    };
    
    try {
      fs.writeFileSync(resultsFile, JSON.stringify(reportData, null, 2));
      console.log(`Results saved to: ${resultsFile}`);
    } catch (error) {
      console.error('Failed to save results:', error.message);
    }
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key && value) {
      config[key] = isNaN(value) ? value : parseInt(value);
    }
  }
  
  const baseUrl = config.url || 'http://localhost:8080';
  const options = {
    concurrency: config.concurrency || 10,
    duration: config.duration || 60000,
    rampUpTime: config.rampUpTime || 10000
  };
  
  console.log('Smart Lamp Task Server - Stress Test');
  console.log('Usage: node stress-test.js --url <url> --concurrency <n> --duration <ms>');
  console.log('');
  
  const stressTest = new StressTest(baseUrl, options);
  stressTest.run().catch(console.error);
}

module.exports = StressTest;