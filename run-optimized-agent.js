import OptimizedInteractiveAgent from './optimized-interactive-agent.js';
import AgentPerformanceMonitor from './agent-performance-monitor.js';

async function runCompleteOptimizedTest() {
  const monitor = new AgentPerformanceMonitor();
  const agent = new OptimizedInteractiveAgent({
    headless: false,
    timeout: 10000,
    retryAttempts: 3,
    baseUrl: 'http://localhost:5000'
  });

  console.log('🚀 Starting Complete Optimized Agent Test...\n');

  try {
    // Initialize agent
    await agent.init();
    
    // Start performance monitoring
    monitor.startMonitoring(agent.page);
    
    // Run comprehensive test
    console.log('🧪 Running comprehensive test suite...');
    const testResults = await agent.runComprehensiveTest();
    
    // Wait a moment for metrics to settle
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate reports
    console.log('\n📊 Generating performance reports...');
    const agentReport = await agent.generateReport();
    const performanceReport = await monitor.generateReport();
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('🎯 OPTIMIZED AGENT TEST COMPLETE');
    console.log('='.repeat(60));
    
    const successfulPages = testResults.pages?.filter(p => p.success).length || 0;
    const totalPages = testResults.pages?.length || 0;
    const successRate = totalPages > 0 ? (successfulPages / totalPages * 100) : 0;
    
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}% (${successfulPages}/${totalPages} pages)`);
    console.log(`⚡ Average Load Time: ${agentReport.performance.averageLoadTime.toFixed(0)}ms`);
    console.log(`🎖️  Performance Grade: ${performanceReport.performanceScore.grade}`);
    console.log(`🔥 Total Errors: ${performanceReport.metrics.totalErrors}`);
    console.log(`📸 Screenshots: ${agentReport.screenshots.length}`);
    console.log(`🚨 Alerts: ${performanceReport.alerts.length}`);
    
    if (testResults.pages && testResults.pages.length > 0) {
      console.log('\n📋 PAGE TEST RESULTS:');
      testResults.pages.forEach(page => {
        const status = page.success ? '✅' : '❌';
        const loadTime = page.performance?.domContentLoaded ? ` (${page.performance.domContentLoaded.toFixed(0)}ms)` : '';
        console.log(`  ${status} ${page.name}${loadTime}`);
        if (!page.success && page.error) {
          console.log(`     Error: ${page.error}`);
        }
      });
    }
    
    if (performanceReport.insights.length > 0) {
      console.log('\n💡 KEY INSIGHTS:');
      performanceReport.insights.forEach((insight, i) => {
        console.log(`  ${i + 1}. ${insight}`);
      });
    }
    
    if (performanceReport.recommendations.length > 0) {
      console.log('\n🔧 RECOMMENDATIONS:');
      performanceReport.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
    
    // Critical alerts
    const criticalAlerts = performanceReport.alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.log('\n🚨 CRITICAL ALERTS:');
      criticalAlerts.forEach(alert => {
        console.log(`  ⚠️  ${alert.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📁 Reports saved:');
    console.log(`  - Agent Report: optimized-agent-report-${Date.now()}.json`);
    console.log(`  - Performance Report: performance-report-${Date.now()}.json`);
    console.log('='.repeat(60));
    
    return {
      success: successRate >= 80,
      testResults,
      agentReport,
      performanceReport,
      summary: {
        successRate,
        averageLoadTime: agentReport.performance.averageLoadTime,
        performanceGrade: performanceReport.performanceScore.grade,
        totalErrors: performanceReport.metrics.totalErrors,
        recommendations: performanceReport.recommendations
      }
    };
    
  } catch (error) {
    console.error('\n❌ OPTIMIZED AGENT TEST FAILED:');
    console.error(error.message);
    console.error('\nStack trace:', error.stack);
    
    // Still try to generate what reports we can
    try {
      await agent.generateReport();
      await monitor.generateReport();
    } catch (reportError) {
      console.error('Failed to generate error reports:', reportError.message);
    }
    
    throw error;
  } finally {
    await agent.close();
    console.log('\n✅ Cleanup completed');
  }
}

// Enhanced CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🤖 Optimized Interactive Agent Test Suite');
  console.log('==========================================\n');
  
  runCompleteOptimizedTest()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Test suite PASSED!');
        process.exit(0);
      } else {
        console.log('\n⚠️  Test suite completed with issues');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test suite FAILED');
      process.exit(1);
    });
}

export { runCompleteOptimizedTest };