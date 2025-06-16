const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

class AutocannonBenchmark {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.results = [];
  }

  // Run health check benchmark
  async benchmarkHealth(options = {}) {
    console.log('🔍 Benchmarking health endpoint...');
    
    const config = {
      url: `${this.baseUrl}/health`,
      connections: options.connections || 10,
      duration: options.duration || 30,
      pipelining: options.pipelining || 1,
      ...options
    };

    try {
      const result = await autocannon(config);
      
      const summary = {
        endpoint: '/health',
        ...this.extractMetrics(result),
        timestamp: new Date().toISOString()
      };
      
      this.results.push(summary);
      this.displayResults(summary);
      
      return summary;
    } catch (error) {
      console.error('Health benchmark failed:', error.message);
      return null;
    }
  }

  // Run registration benchmark
  async benchmarkRegistration(options = {}) {
    console.log('📝 Benchmarking registration endpoint...');
    
    let counter = 0;
    
    const config = {
      url: `${this.baseUrl}/api/auth/register`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      setupClient: (client) => {
        client.setBody = () => {
          counter++;
          return JSON.stringify({
            username: `bench_user_${counter}_${Date.now()}`,
            email: `bench_user_${counter}_${Date.now()}@test.com`,
            password: 'BenchTest123',
            firstName: 'Bench',
            lastName: 'Test'
          });
        };
      },
      connections: options.connections || 5,
      duration: options.duration || 30,
      pipelining: 1, // Registration should be sequential
      ...options
    };

    try {
      const result = await autocannon(config);
      
      const summary = {
        endpoint: '/api/auth/register',
        ...this.extractMetrics(result),
        timestamp: new Date().toISOString()
      };
      
      this.results.push(summary);
      this.displayResults(summary);
      
      return summary;
    } catch (error) {
      console.error('Registration benchmark failed:', error.message);
      return null;
    }
  }

  // Run login benchmark (requires pre-created users)
  async benchmarkLogin(options = {}) {
    console.log('🔐 Benchmarking login endpoint...');
    
    // First create some test users
    await this.createTestUsers(10);
    
    let counter = 0;
    const testUsers = Array.from({length: 10}, (_, i) => ({
      email: `bench_login_${i}@test.com`,
      password: 'BenchTest123'
    }));
    
    const config = {
      url: `${this.baseUrl}/api/auth/login`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      setupClient: (client) => {
        client.setBody = () => {
          const user = testUsers[counter % testUsers.length];
          counter++;
          return JSON.stringify(user);
        };
      },
      connections: options.connections || 5,
      duration: options.duration || 30,
      pipelining: options.pipelining || 1,
      ...options
    };

    try {
      const result = await autocannon(config);
      
      const summary = {
        endpoint: '/api/auth/login',
        ...this.extractMetrics(result),
        timestamp: new Date().toISOString()
      };
      
      this.results.push(summary);
      this.displayResults(summary);
      
      return summary;
    } catch (error) {
      console.error('Login benchmark failed:', error.message);
      return null;
    }
  }

  // Create test users for login benchmark
  async createTestUsers(count = 10) {
    console.log(`Creating ${count} test users for login benchmark...`);
    
    const promises = [];
    for (let i = 0; i < count; i++) {
      const userData = {
        username: `bench_login_${i}`,
        email: `bench_login_${i}@test.com`,
        password: 'BenchTest123',
        firstName: 'Bench',
        lastName: 'Login'
      };
      
      const promise = fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      }).catch(() => {}); // Ignore errors for existing users
      
      promises.push(promise);
    }
    
    await Promise.all(promises);
    console.log('Test users created');
  }

  // Extract key metrics from autocannon result
  extractMetrics(result) {
    return {
      requestsPerSecond: result.requests.average,
      latencyAverage: result.latency.average,
      latencyP50: result.latency.p50,
      latencyP95: result.latency.p95,
      latencyP99: result.latency.p99,
      latencyMax: result.latency.max,
      throughputAverage: result.throughput.average,
      totalRequests: result.requests.total,
      totalBytes: result.throughput.total,
      duration: result.duration,
      connections: result.connections,
      errors: result.errors,
      statusCodes: result.statusCodeStats,
      success: result.errors === 0
    };
  }

  // Display results in a nice format
  displayResults(summary) {
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Benchmark Results: ${summary.endpoint}`);
    console.log('='.repeat(60));
    
    console.log(`🚀 Performance:`);
    console.log(`   Requests/sec: ${summary.requestsPerSecond.toFixed(2)}`);
    console.log(`   Throughput: ${(summary.throughputAverage / 1024 / 1024).toFixed(2)} MB/s`);
    console.log(`   Total Requests: ${summary.totalRequests.toLocaleString()}`);
    
    console.log(`⏱️  Latency:`);
    console.log(`   Average: ${summary.latencyAverage.toFixed(2)}ms`);
    console.log(`   P50: ${summary.latencyP50.toFixed(2)}ms`);
    console.log(`   P95: ${summary.latencyP95.toFixed(2)}ms`);
    console.log(`   P99: ${summary.latencyP99.toFixed(2)}ms`);
    console.log(`   Max: ${summary.latencyMax.toFixed(2)}ms`);
    
    console.log(`📈 Configuration:`);
    console.log(`   Duration: ${summary.duration}s`);
    console.log(`   Connections: ${summary.connections}`);
    console.log(`   Errors: ${summary.errors}`);
    
    // Performance assessment
    this.assessPerformance(summary);
  }

  // Assess performance and provide recommendations
  assessPerformance(summary) {
    console.log(`\n🎯 Assessment:`);
    
    const rps = summary.requestsPerSecond;
    const avgLatency = summary.latencyAverage;
    const p95Latency = summary.latencyP95;
    const errorRate = summary.errors / summary.totalRequests * 100;
    
    // RPS Assessment
    if (rps >= 100) {
      console.log(`   ✅ Excellent throughput (${rps.toFixed(1)} RPS)`);
    } else if (rps >= 50) {
      console.log(`   🟡 Good throughput (${rps.toFixed(1)} RPS)`);
    } else if (rps >= 10) {
      console.log(`   🟠 Moderate throughput (${rps.toFixed(1)} RPS)`);
    } else {
      console.log(`   🔴 Low throughput (${rps.toFixed(1)} RPS)`);
    }
    
    // Latency Assessment
    if (avgLatency <= 100) {
      console.log(`   ✅ Excellent response time (${avgLatency.toFixed(0)}ms avg)`);
    } else if (avgLatency <= 300) {
      console.log(`   🟡 Good response time (${avgLatency.toFixed(0)}ms avg)`);
    } else if (avgLatency <= 1000) {
      console.log(`   🟠 Slow response time (${avgLatency.toFixed(0)}ms avg)`);
    } else {
      console.log(`   🔴 Very slow response time (${avgLatency.toFixed(0)}ms avg)`);
    }
    
    // P95 Assessment
    if (p95Latency <= 200) {
      console.log(`   ✅ Consistent performance (P95: ${p95Latency.toFixed(0)}ms)`);
    } else if (p95Latency <= 500) {
      console.log(`   🟡 Mostly consistent (P95: ${p95Latency.toFixed(0)}ms)`);
    } else {
      console.log(`   🔴 Inconsistent performance (P95: ${p95Latency.toFixed(0)}ms)`);
    }
    
    // Error Assessment
    if (errorRate === 0) {
      console.log(`   ✅ No errors detected`);
    } else if (errorRate < 1) {
      console.log(`   🟡 Low error rate (${errorRate.toFixed(2)}%)`);
    } else if (errorRate < 5) {
      console.log(`   🟠 Moderate error rate (${errorRate.toFixed(2)}%)`);
    } else {
      console.log(`   🔴 High error rate (${errorRate.toFixed(2)}%)`);
    }
  }

  // Run comprehensive benchmark suite
  async runComprehensiveBenchmark(options = {}) {
    console.log('🚀 Starting comprehensive autocannon benchmark...');
    console.log(`Target: ${this.baseUrl}`);
    console.log('');
    
    const config = {
      connections: options.connections || 10,
      duration: options.duration || 30,
      ...options
    };
    
    // 1. Health check benchmark
    await this.benchmarkHealth(config);
    await this.delay(5000);
    
    // 2. Registration benchmark
    await this.benchmarkRegistration({
      ...config,
      connections: Math.min(config.connections, 5) // Limit for registration
    });
    await this.delay(5000);
    
    // 3. Login benchmark
    await this.benchmarkLogin({
      ...config,
      connections: Math.min(config.connections, 5) // Limit for login
    });
    
    // Generate summary
    this.generateSummary();
    
    // Save results
    this.saveResults();
  }

  // Generate summary of all benchmarks
  generateSummary() {
    if (this.results.length === 0) {
      console.log('No benchmark results to summarize');
      return;
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPREHENSIVE BENCHMARK SUMMARY');
    console.log('='.repeat(70));
    
    this.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.endpoint}:`);
      console.log(`   RPS: ${result.requestsPerSecond.toFixed(1)} | ` +
                 `Avg Latency: ${result.latencyAverage.toFixed(0)}ms | ` +
                 `P95: ${result.latencyP95.toFixed(0)}ms | ` +
                 `Errors: ${result.errors}`);
    });
    
    // Overall performance score
    const avgRps = this.results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / this.results.length;
    const avgLatency = this.results.reduce((sum, r) => sum + r.latencyAverage, 0) / this.results.length;
    const totalErrors = this.results.reduce((sum, r) => sum + r.errors, 0);
    
    console.log('\n🎯 Overall Performance:');
    console.log(`   Average RPS: ${avgRps.toFixed(1)}`);
    console.log(`   Average Latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`   Total Errors: ${totalErrors}`);
    
    if (avgRps >= 50 && avgLatency <= 300 && totalErrors === 0) {
      console.log('   🏆 Excellent overall performance!');
    } else if (avgRps >= 20 && avgLatency <= 500 && totalErrors < 10) {
      console.log('   ✅ Good overall performance');
    } else if (avgRps >= 10 && avgLatency <= 1000) {
      console.log('   🟡 Acceptable performance with room for improvement');
    } else {
      console.log('   🔴 Performance needs significant improvement');
    }
  }

  // Save results to JSON file
  saveResults() {
    const timestamp = Date.now();
    const filename = `autocannon-results-${timestamp}.json`;
    
    const reportData = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      results: this.results,
      summary: {
        totalBenchmarks: this.results.length,
        averageRPS: this.results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / this.results.length,
        averageLatency: this.results.reduce((sum, r) => sum + r.latencyAverage, 0) / this.results.length,
        totalErrors: this.results.reduce((sum, r) => sum + r.errors, 0)
      }
    };
    
    try {
      fs.writeFileSync(filename, JSON.stringify(reportData, null, 2));
      console.log(`\n💾 Results saved to: ${filename}`);
    } catch (error) {
      console.error('Failed to save results:', error.message);
    }
  }

  // Simple delay helper
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const config = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    
    if (key && value) {
      config[key] = isNaN(value) ? value : parseInt(value);
    }
  }
  
  const baseUrl = config.url || 'http://localhost:8080';
  const benchmark = new AutocannonBenchmark(baseUrl);
  
  console.log('Smart Lamp Task Server - Autocannon Benchmark');
  console.log('Usage: node autocannon-test.js --url <url> --connections <n> --duration <s>');
  console.log('');
  
  // Check if server is available
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    console.log('✅ Server is accessible');
  } catch (error) {
    console.error('❌ Server is not accessible:', error.message);
    console.log('💡 Make sure the server is running on', baseUrl);
    process.exit(1);
  }
  
  // Run benchmarks
  const benchmarkConfig = {
    connections: config.connections || 10,
    duration: config.duration || 30
  };
  
  if (config.endpoint) {
    // Run specific endpoint
    switch (config.endpoint.toLowerCase()) {
      case 'health':
        await benchmark.benchmarkHealth(benchmarkConfig);
        break;
      case 'register':
        await benchmark.benchmarkRegistration(benchmarkConfig);
        break;
      case 'login':
        await benchmark.benchmarkLogin(benchmarkConfig);
        break;
      default:
        console.error('Unknown endpoint. Available: health, register, login');
        process.exit(1);
    }
  } else {
    // Run comprehensive benchmark
    await benchmark.runComprehensiveBenchmark(benchmarkConfig);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = AutocannonBenchmark;