import fs from 'fs/promises';
import path from 'path';

class AgentPerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoads: [],
      userActions: [],
      errors: [],
      networkRequests: [],
      memoryUsage: [],
      timestamps: []
    };
    this.thresholds = {
      slowPageLoad: 3000, // ms
      highMemory: 500, // MB
      errorRate: 0.05, // 5%
      consecutiveErrors: 3
    };
    this.alerts = [];
  }

  startMonitoring(page) {
    console.log('📊 Starting performance monitoring...');
    
    // Monitor page loads
    page.on('load', () => {
      this.recordPageLoad();
    });

    // Monitor network requests
    page.on('response', (response) => {
      this.recordNetworkRequest({
        url: response.url(),
        status: response.status(),
        timing: response.timing(),
        size: response.headers()['content-length'] || 0
      });
    });

    // Monitor console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.recordError({
          type: 'console',
          message: msg.text(),
          timestamp: Date.now()
        });
      }
    });

    // Monitor page errors
    page.on('pageerror', (error) => {
      this.recordError({
        type: 'page',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });

    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  recordPageLoad() {
    const loadTime = Date.now();
    this.metrics.pageLoads.push({
      timestamp: loadTime,
      duration: loadTime // Will be updated with actual duration
    });

    if (this.metrics.pageLoads.length > 1) {
      const prev = this.metrics.pageLoads[this.metrics.pageLoads.length - 2];
      prev.duration = loadTime - prev.timestamp;
      
      if (prev.duration > this.thresholds.slowPageLoad) {
        this.createAlert('slow_page_load', `Page load took ${prev.duration}ms`);
      }
    }
  }

  recordUserAction(action) {
    this.metrics.userActions.push({
      action: action.type,
      target: action.target,
      timestamp: Date.now(),
      success: action.success
    });
  }

  recordError(error) {
    this.metrics.errors.push(error);
    
    // Check for consecutive errors
    const recentErrors = this.metrics.errors.slice(-this.thresholds.consecutiveErrors);
    if (recentErrors.length === this.thresholds.consecutiveErrors) {
      const timeSpan = recentErrors[recentErrors.length - 1].timestamp - recentErrors[0].timestamp;
      if (timeSpan < 10000) { // Within 10 seconds
        this.createAlert('consecutive_errors', `${this.thresholds.consecutiveErrors} errors in ${timeSpan}ms`);
      }
    }
  }

  recordNetworkRequest(request) {
    this.metrics.networkRequests.push({
      ...request,
      timestamp: Date.now()
    });

    // Alert on failed requests
    if (request.status >= 400) {
      this.createAlert('network_error', `HTTP ${request.status} for ${request.url}`);
    }
  }

  startMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memMB = memUsage.heapUsed / 1024 / 1024;
      
      this.metrics.memoryUsage.push({
        heap: memMB,
        external: memUsage.external / 1024 / 1024,
        timestamp: Date.now()
      });

      if (memMB > this.thresholds.highMemory) {
        this.createAlert('high_memory', `Memory usage: ${memMB.toFixed(1)}MB`);
      }
    }, 5000); // Check every 5 seconds
  }

  createAlert(type, message) {
    const alert = {
      type,
      message,
      timestamp: Date.now(),
      severity: this.getAlertSeverity(type)
    };
    
    this.alerts.push(alert);
    console.log(`🚨 ${alert.severity.toUpperCase()} ALERT: ${message}`);
  }

  getAlertSeverity(type) {
    const severityMap = {
      slow_page_load: 'warning',
      consecutive_errors: 'critical',
      network_error: 'error',
      high_memory: 'warning'
    };
    return severityMap[type] || 'info';
  }

  getPerformanceScore() {
    const scores = {
      pageLoad: this.calculatePageLoadScore(),
      errorRate: this.calculateErrorRateScore(),
      networkHealth: this.calculateNetworkScore(),
      memoryEfficiency: this.calculateMemoryScore()
    };

    const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
    
    return {
      overall: Math.round(overallScore),
      breakdown: scores,
      grade: this.getPerformanceGrade(overallScore)
    };
  }

  calculatePageLoadScore() {
    if (this.metrics.pageLoads.length === 0) return 100;
    
    const avgLoadTime = this.metrics.pageLoads
      .filter(load => load.duration > 0)
      .reduce((sum, load) => sum + load.duration, 0) / this.metrics.pageLoads.length;
    
    if (avgLoadTime < 1000) return 100;
    if (avgLoadTime < 2000) return 85;
    if (avgLoadTime < 3000) return 70;
    if (avgLoadTime < 5000) return 50;
    return 25;
  }

  calculateErrorRateScore() {
    const totalActions = this.metrics.userActions.length + this.metrics.pageLoads.length;
    if (totalActions === 0) return 100;
    
    const errorRate = this.metrics.errors.length / totalActions;
    if (errorRate === 0) return 100;
    if (errorRate < 0.01) return 90;
    if (errorRate < 0.05) return 75;
    if (errorRate < 0.1) return 50;
    return 25;
  }

  calculateNetworkScore() {
    if (this.metrics.networkRequests.length === 0) return 100;
    
    const failedRequests = this.metrics.networkRequests.filter(req => req.status >= 400).length;
    const successRate = 1 - (failedRequests / this.metrics.networkRequests.length);
    
    return Math.round(successRate * 100);
  }

  calculateMemoryScore() {
    if (this.metrics.memoryUsage.length === 0) return 100;
    
    const avgMemory = this.metrics.memoryUsage.reduce((sum, mem) => sum + mem.heap, 0) / this.metrics.memoryUsage.length;
    
    if (avgMemory < 100) return 100;
    if (avgMemory < 250) return 85;
    if (avgMemory < 400) return 70;
    if (avgMemory < 600) return 50;
    return 25;
  }

  getPerformanceGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  generateInsights() {
    const insights = [];
    const score = this.getPerformanceScore();
    
    // Page load insights
    if (score.breakdown.pageLoad < 70) {
      insights.push('Page load times are slower than optimal. Consider optimizing bundle size or implementing lazy loading.');
    }
    
    // Error rate insights
    if (score.breakdown.errorRate < 80) {
      insights.push('Error rate is high. Review console errors and implement better error handling.');
    }
    
    // Network insights
    if (score.breakdown.networkHealth < 90) {
      insights.push('Network requests are failing. Check API endpoints and error handling.');
    }
    
    // Memory insights
    if (score.breakdown.memoryEfficiency < 70) {
      insights.push('Memory usage is high. Look for memory leaks or optimize data structures.');
    }
    
    // Alert-based insights
    const criticalAlerts = this.alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      insights.push(`${criticalAlerts.length} critical issues detected. Immediate attention required.`);
    }
    
    return insights;
  }

  async generateReport() {
    const score = this.getPerformanceScore();
    const insights = this.generateInsights();
    
    const report = {
      timestamp: new Date().toISOString(),
      performanceScore: score,
      insights,
      metrics: {
        totalPageLoads: this.metrics.pageLoads.length,
        totalUserActions: this.metrics.userActions.length,
        totalErrors: this.metrics.errors.length,
        totalNetworkRequests: this.metrics.networkRequests.length,
        averageMemoryUsage: this.metrics.memoryUsage.length > 0 
          ? (this.metrics.memoryUsage.reduce((sum, mem) => sum + mem.heap, 0) / this.metrics.memoryUsage.length).toFixed(1)
          : 0
      },
      alerts: this.alerts,
      recommendations: this.generateRecommendations()
    };
    
    const filename = `performance-report-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    console.log(`📊 Performance report saved: ${filename}`);
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    const score = this.getPerformanceScore();
    
    if (score.overall < 80) {
      recommendations.push('Overall performance needs improvement. Focus on the lowest scoring areas.');
    }
    
    if (this.alerts.length > 10) {
      recommendations.push('High alert volume. Implement monitoring dashboards for real-time tracking.');
    }
    
    if (this.metrics.errors.length > 5) {
      recommendations.push('Consider implementing error boundaries and better error reporting.');
    }
    
    return recommendations;
  }

  reset() {
    this.metrics = {
      pageLoads: [],
      userActions: [],
      errors: [],
      networkRequests: [],
      memoryUsage: [],
      timestamps: []
    };
    this.alerts = [];
    console.log('📊 Performance monitor reset');
  }
}

export default AgentPerformanceMonitor;