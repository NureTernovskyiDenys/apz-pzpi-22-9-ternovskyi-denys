const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor() {
    this.reports = [];
  }

  // Load test results from JSON files
  loadResults(directory = './') {
    const files = fs.readdirSync(directory);
    const resultFiles = files.filter(file => 
      file.includes('stress-test-results') || 
      file.includes('monitor-') || 
      file.includes('k6-results') ||
      file.includes('artillery-report')
    );

    console.log(`Found ${resultFiles.length} result files:`);
    resultFiles.forEach(file => console.log(`  - ${file}`));

    for (const file of resultFiles) {
      try {
        const filePath = path.join(directory, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Determine test type based on file content
        let testType = 'unknown';
        if (file.includes('stress-test-results')) {
          testType = 'stress-test';
        } else if (file.includes('monitor-')) {
          testType = 'monitoring';
        } else if (data.metrics && data.metrics.http_req_duration) {
          testType = 'k6';
        } else if (data.aggregate) {
          testType = 'artillery';
        }

        this.reports.push({
          fileName: file,
          testType,
          data,
          timestamp: data.timestamp || fs.statSync(filePath).mtime
        });
      } catch (error) {
        console.warn(`Failed to load ${file}: ${error.message}`);
      }
    }

    console.log(`Loaded ${this.reports.length} reports for analysis`);
    return this.reports;
  }

  // Generate comprehensive HTML report
  generateHTMLReport() {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Lamp Task Server - Load Test Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1, h2, h3 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #2c3e50;
        }
        .metric-label {
            color: #7f8c8d;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .status-good { color: #27ae60; }
        .status-warning { color: #f39c12; }
        .status-error { color: #e74c3c; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #3498db;
            color: white;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .chart-container {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .recommendation {
            background: #e8f5e8;
            border-left: 4px solid #27ae60;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .error {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .test-details {
            background: #f8f9fa;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Smart Lamp Task Server - Load Test Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Total Test Sessions:</strong> ${this.reports.length}</p>

        ${this.generateExecutiveSummary()}
        ${this.generateDetailedResults()}
        ${this.generateRecommendations()}
        
        <div class="footer">
            <p>Report generated by Smart Lamp Load Testing Suite</p>
            <p>For questions or support, contact the development team</p>
        </div>
    </div>
</body>
</html>`;

    const reportPath = path.join(__dirname, `load-test-report-${Date.now()}.html`);
    fs.writeFileSync(reportPath, html);
    console.log(`HTML report generated: ${reportPath}`);
    return reportPath;
  }

  // Generate executive summary section
  generateExecutiveSummary() {
    const stressTests = this.reports.filter(r => r.testType === 'stress-test');
    const monitoringData = this.reports.filter(r => r.testType === 'monitoring');
    
    if (stressTests.length === 0) {
      return '<h2>📊 Executive Summary</h2><p>No stress test data available.</p>';
    }

    const latestTest = stressTests[stressTests.length - 1];
    const results = latestTest.data.results;
    
    const successRate = results.successRate || 0;
    const avgResponseTime = results.averageResponseTime || 0;
    const requestsPerSecond = results.requestsPerSecond || 0;
    const totalRequests = results.totalRequests || 0;

    const healthStatus = this.getHealthStatus(successRate, avgResponseTime);

    return `
        <h2>📊 Executive Summary</h2>
        <div class="summary-grid">
            <div class="metric-card">
                <div class="metric-value ${healthStatus.color}">${successRate.toFixed(1)}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${avgResponseTime.toFixed(0)}ms</div>
                <div class="metric-label">Average Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${requestsPerSecond.toFixed(1)}</div>
                <div class="metric-label">Requests per Second</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${totalRequests.toLocaleString()}</div>
                <div class="metric-label">Total Requests</div>
            </div>
        </div>
        
        <div class="${healthStatus.class}">
            <strong>Overall Assessment:</strong> ${healthStatus.message}
        </div>`;
  }

  // Generate detailed results section
  generateDetailedResults() {
    let html = '<h2>📈 Detailed Test Results</h2>';

    // Stress test results
    const stressTests = this.reports.filter(r => r.testType === 'stress-test');
    if (stressTests.length > 0) {
      html += '<h3>Stress Test Results</h3>';
      html += '<table><tr><th>Test Date</th><th>Total Requests</th><th>Success Rate</th><th>Avg Response Time</th><th>RPS</th><th>Errors</th></tr>';
      
      stressTests.forEach(test => {
        const results = test.data.results;
        const date = new Date(test.timestamp).toLocaleString();
        html += `<tr>
          <td>${date}</td>
          <td>${results.totalRequests?.toLocaleString() || 'N/A'}</td>
          <td class="${this.getStatusClass(results.successRate)}">${results.successRate?.toFixed(1) || 'N/A'}%</td>
          <td>${results.averageResponseTime?.toFixed(0) || 'N/A'}ms</td>
          <td>${results.requestsPerSecond?.toFixed(1) || 'N/A'}</td>
          <td>${results.failedRequests || 0}</td>
        </tr>`;
      });
      html += '</table>';
    }

    // Monitoring results
    const monitoringTests = this.reports.filter(r => r.testType === 'monitoring');
    if (monitoringTests.length > 0) {
      html += '<h3>Server Monitoring Results</h3>';
      html += '<table><tr><th>Monitor Date</th><th>Duration</th><th>Checks</th><th>Success Rate</th><th>Avg Response</th><th>P95 Response</th></tr>';
      
      monitoringTests.forEach(test => {
        const stats = test.data.statistics;
        const date = new Date(test.timestamp).toLocaleString();
        html += `<tr>
          <td>${date}</td>
          <td>${stats.monitoringDuration?.toFixed(0) || 'N/A'}s</td>
          <td>${stats.totalChecks || 'N/A'}</td>
          <td class="${this.getStatusClass(stats.successRate)}">${stats.successRate?.toFixed(1) || 'N/A'}%</td>
          <td>${stats.averageResponseTime?.toFixed(0) || 'N/A'}ms</td>
          <td>${stats.p95ResponseTime?.toFixed(0) || 'N/A'}ms</td>
        </tr>`;
      });
      html += '</table>';
    }

    return html;
  }

  // Generate recommendations section
  generateRecommendations() {
    const recommendations = this.analyzeResults();
    
    let html = '<h2>💡 Recommendations</h2>';
    
    recommendations.forEach(rec => {
      html += `<div class="${rec.type}">
        <strong>${rec.title}</strong><br>
        ${rec.description}
      </div>`;
    });

    return html;
  }

  // Analyze results and generate recommendations
  analyzeResults() {
    const recommendations = [];
    const stressTests = this.reports.filter(r => r.testType === 'stress-test');
    
    if (stressTests.length === 0) {
      return [{ type: 'warning', title: 'No Data', description: 'No stress test data available for analysis.' }];
    }

    const latestTest = stressTests[stressTests.length - 1];
    const results = latestTest.data.results;

    // Success rate analysis
    if (results.successRate < 95) {
      recommendations.push({
        type: 'error',
        title: 'Low Success Rate',
        description: `Success rate of ${results.successRate?.toFixed(1)}% is below acceptable threshold of 95%. Consider investigating error logs and increasing server resources.`
      });
    } else if (results.successRate < 99) {
      recommendations.push({
        type: 'warning',
        title: 'Moderate Success Rate',
        description: `Success rate of ${results.successRate?.toFixed(1)}% could be improved. Monitor for patterns in failures.`
      });
    }

    // Response time analysis
    if (results.averageResponseTime > 1000) {
      recommendations.push({
        type: 'error',
        title: 'High Response Times',
        description: `Average response time of ${results.averageResponseTime?.toFixed(0)}ms is too high. Consider optimizing database queries, adding caching, or scaling server resources.`
      });
    } else if (results.averageResponseTime > 500) {
      recommendations.push({
        type: 'warning',
        title: 'Elevated Response Times',
        description: `Average response time of ${results.averageResponseTime?.toFixed(0)}ms could be optimized. Review slow endpoints and implement performance improvements.`
      });
    }

    // Performance recommendations
    if (results.p95 && results.p95 > 2000) {
      recommendations.push({
        type: 'warning',
        title: 'High P95 Response Time',
        description: `95th percentile response time is ${results.p95?.toFixed(0)}ms. Some requests are experiencing significant delays.`
      });
    }

    // General recommendations
    recommendations.push({
      type: 'recommendation',
      title: 'Regular Testing',
      description: 'Continue running load tests regularly to monitor performance trends and catch regressions early.'
    });

    if (results.requestsPerSecond && results.requestsPerSecond > 100) {
      recommendations.push({
        type: 'recommendation',
        title: 'Good Throughput',
        description: `Server is handling ${results.requestsPerSecond?.toFixed(1)} requests per second effectively. Monitor scaling needs as traffic grows.`
      });
    }

    return recommendations;
  }

  // Get health status based on metrics
  getHealthStatus(successRate, avgResponseTime) {
    if (successRate >= 99 && avgResponseTime <= 200) {
      return {
        color: 'status-good',
        class: 'recommendation',
        message: 'Server performance is excellent with high reliability and fast response times.'
      };
    } else if (successRate >= 95 && avgResponseTime <= 500) {
      return {
        color: 'status-warning',
        class: 'warning',
        message: 'Server performance is acceptable but could be optimized for better response times.'
      };
    } else {
      return {
        color: 'status-error',
        class: 'error',
        message: 'Server performance needs attention. Consider investigating errors and optimizing resources.'
      };
    }
  }

  // Get CSS class for status indicators
  getStatusClass(value) {
    if (value >= 99) return 'status-good';
    if (value >= 95) return 'status-warning';
    return 'status-error';
  }

  // Generate markdown report
  generateMarkdownReport() {
    const stressTests = this.reports.filter(r => r.testType === 'stress-test');
    const latestTest = stressTests[stressTests.length - 1];
    
    let markdown = `# Smart Lamp Task Server - Load Test Report\n\n`;
    markdown += `**Generated:** ${new Date().toLocaleString()}\n`;
    markdown += `**Total Test Sessions:** ${this.reports.length}\n\n`;

    if (latestTest) {
      const results = latestTest.data.results;
      markdown += `## Executive Summary\n\n`;
      markdown += `| Metric | Value |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| Success Rate | ${results.successRate?.toFixed(1)}% |\n`;
      markdown += `| Average Response Time | ${results.averageResponseTime?.toFixed(0)}ms |\n`;
      markdown += `| Requests per Second | ${results.requestsPerSecond?.toFixed(1)} |\n`;
      markdown += `| Total Requests | ${results.totalRequests?.toLocaleString()} |\n\n`;
    }

    // Add recommendations
    const recommendations = this.analyzeResults();
    markdown += `## Recommendations\n\n`;
    recommendations.forEach(rec => {
      const icon = rec.type === 'error' ? '🔴' : rec.type === 'warning' ? '🟡' : '💡';
      markdown += `${icon} **${rec.title}**: ${rec.description}\n\n`;
    });

    const reportPath = path.join(__dirname, `load-test-report-${Date.now()}.md`);
    fs.writeFileSync(reportPath, markdown);
    console.log(`Markdown report generated: ${reportPath}`);
    return reportPath;
  }

  // Generate JSON summary
  generateJSONSummary() {
    const summary = {
      generatedAt: new Date().toISOString(),
      totalReports: this.reports.length,
      testTypes: this.reports.reduce((acc, report) => {
        acc[report.testType] = (acc[report.testType] || 0) + 1;
        return acc;
      }, {}),
      recommendations: this.analyzeResults(),
      latestResults: this.reports.length > 0 ? this.reports[this.reports.length - 1] : null
    };

    const reportPath = path.join(__dirname, `load-test-summary-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    console.log(`JSON summary generated: ${reportPath}`);
    return reportPath;
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const directory = args[0] || './';
  const format = args[1] || 'html';

  console.log('Smart Lamp Task Server - Report Generator');
  console.log('Usage: node generate-report.js [directory] [format]');
  console.log('Formats: html, markdown, json, all');
  console.log('');

  const generator = new ReportGenerator();
  const reports = generator.loadResults(directory);

  if (reports.length === 0) {
    console.log('No test results found. Please run some load tests first.');
    process.exit(1);
  }

  console.log('Generating reports...');

  switch (format.toLowerCase()) {
    case 'html':
      generator.generateHTMLReport();
      break;
    case 'markdown':
    case 'md':
      generator.generateMarkdownReport();
      break;
    case 'json':
      generator.generateJSONSummary();
      break;
    case 'all':
      generator.generateHTMLReport();
      generator.generateMarkdownReport();
      generator.generateJSONSummary();
      break;
    default:
      console.log('Unknown format. Using HTML.');
      generator.generateHTMLReport();
  }

  console.log('Report generation completed!');
}

module.exports = ReportGenerator;