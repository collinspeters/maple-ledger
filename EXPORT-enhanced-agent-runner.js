import OptimizedInteractiveAgent from './EXPORT-optimized-interactive-agent.js';
import AgentPerformanceMonitor from './EXPORT-agent-performance-monitor.js';

async function runEnhancedAgentTest() {
  const monitor = new AgentPerformanceMonitor();
  const agent = new OptimizedInteractiveAgent({
    headless: false,
    timeout: 15000,
    retryAttempts: 2,
    baseUrl: 'http://localhost:5000'
  });

  console.log('🚀 Starting Enhanced Interactive Agent Test...\n');
  console.log('Features: Page Scrolling, Breakage Detection, Interactive Element Testing\n');

  try {
    await agent.init();
    monitor.startMonitoring(agent.page);
    
    console.log('🧪 Running enhanced comprehensive test suite...');
    const testResults = await agent.runComprehensiveTest();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n📊 Generating enhanced reports...');
    const agentReport = await agent.generateReport();
    const performanceReport = await monitor.generateReport();
    
    // Enhanced Summary
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ENHANCED INTERACTIVE AGENT TEST COMPLETE');
    console.log('='.repeat(80));
    
    const successfulPages = testResults.pages?.filter(p => p.success).length || 0;
    const totalPages = testResults.pages?.length || 0;
    const successRate = totalPages > 0 ? (successfulPages / totalPages * 100) : 0;
    
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}% (${successfulPages}/${totalPages} pages)`);
    console.log(`⚡ Average Load Time: ${agentReport.performance.averageLoadTime.toFixed(0)}ms`);
    console.log(`🎖️  Performance Grade: ${performanceReport.performanceScore.grade}`);
    console.log(`🔥 Total Errors: ${performanceReport.metrics.totalErrors}`);
    console.log(`📸 Screenshots: ${agentReport.screenshots.length}`);
    console.log(`🚨 Alerts: ${performanceReport.alerts.length}`);
    
    // Enhanced Page Analysis
    if (testResults.pages && testResults.pages.length > 0) {
      console.log('\n📋 ENHANCED PAGE ANALYSIS:');
      testResults.pages.forEach(page => {
        const status = page.success ? '✅' : '❌';
        const loadTime = page.performance?.domContentLoaded ? ` (${page.performance.domContentLoaded.toFixed(0)}ms)` : '';
        
        console.log(`\n  ${status} ${page.name}${loadTime}`);
        
        if (page.info) {
          console.log(`     Elements: ${page.info.elementsCount}, Interactive: ${page.info.interactiveElements}`);
          if (page.info.isScrollable) {
            console.log(`     📜 Scrollable page (${page.info.scrollHeight}px height)`);
          }
        }
        
        // Breakage analysis
        if (page.breakages) {
          const issues = [
            page.breakages.brokenImages.length && `${page.breakages.brokenImages.length} broken images`,
            page.breakages.emptyButtons.length && `${page.breakages.emptyButtons.length} empty buttons`,
            page.breakages.brokenLinks.length && `${page.breakages.brokenLinks.length} broken links`,
            page.breakages.accessibilityIssues.length && `${page.breakages.accessibilityIssues.length} accessibility issues`
          ].filter(Boolean);
          
          if (issues.length > 0) {
            console.log(`     🔍 Issues: ${issues.join(', ')}`);
          } else {
            console.log(`     ✨ No breakages detected`);
          }
        }
        
        // Interactive element analysis
        if (page.interactiveTest) {
          const brokenButtons = page.interactiveTest.buttons.filter(b => !b.hasClickHandler && !b.disabled).length;
          if (brokenButtons > 0) {
            console.log(`     ⚠️  ${brokenButtons} buttons may need click handlers`);
          }
        }
        
        // Scroll analysis
        if (page.scrollAnalysis && page.scrollAnalysis.scrollPositions.length > 0) {
          const totalBrokenImages = page.scrollAnalysis.scrollPositions.reduce((sum, pos) => sum + pos.brokenImages.length, 0);
          console.log(`     📜 Scroll analysis: ${page.scrollAnalysis.scrollPositions.length} positions tested`);
          if (totalBrokenImages > 0) {
            console.log(`     📜 Found ${totalBrokenImages} broken images during scroll`);
          }
        }
        
        // Recommendations
        if (page.recommendations && page.recommendations.length > 0) {
          console.log(`     💡 Recommendations:`);
          page.recommendations.forEach(rec => {
            console.log(`        - ${rec}`);
          });
        }
        
        if (!page.success && page.error) {
          console.log(`     ❌ Error: ${page.error}`);
        }
      });
    }
    
    // Breakage Summary
    let totalBreakages = 0;
    if (testResults.pages) {
      totalBreakages = testResults.pages.reduce((total, page) => {
        if (!page.breakages) return total;
        return total + 
          page.breakages.brokenImages.length +
          page.breakages.emptyButtons.length +
          page.breakages.brokenLinks.length +
          page.breakages.accessibilityIssues.length;
      }, 0);
      
      console.log(`\n🔍 TOTAL BREAKAGES DETECTED: ${totalBreakages}`);
      
      if (totalBreakages > 0) {
        console.log('\n🔧 CRITICAL FIXES NEEDED:');
        testResults.pages.forEach(page => {
          if (page.breakages) {
            if (page.breakages.brokenImages.length > 0) {
              console.log(`  📸 ${page.name}: Fix ${page.breakages.brokenImages.length} broken images`);
              page.breakages.brokenImages.slice(0, 3).forEach(img => {
                console.log(`     - Missing: ${img.src}`);
              });
            }
            if (page.breakages.accessibilityIssues.length > 0) {
              console.log(`  ♿ ${page.name}: ${page.breakages.accessibilityIssues.length} accessibility issues`);
            }
          }
        });
      } else {
        console.log('✨ No critical breakages found - excellent code quality!');
      }
    }
    
    if (performanceReport.insights.length > 0) {
      console.log('\n💡 PERFORMANCE INSIGHTS:');
      performanceReport.insights.forEach((insight, i) => {
        console.log(`  ${i + 1}. ${insight}`);
      });
    }
    
    if (performanceReport.recommendations.length > 0) {
      console.log('\n🔧 SYSTEM RECOMMENDATIONS:');
      performanceReport.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
    
    const criticalAlerts = performanceReport.alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.log('\n🚨 CRITICAL ALERTS:');
      criticalAlerts.forEach(alert => {
        console.log(`  ⚠️  ${alert.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📁 Enhanced reports saved with scroll analysis and breakage detection');
    console.log('='.repeat(80));
    
    return {
      success: successRate >= 80 && totalBreakages < 10,
      testResults,
      agentReport,
      performanceReport,
      summary: {
        successRate,
        averageLoadTime: agentReport.performance.averageLoadTime,
        performanceGrade: performanceReport.performanceScore.grade,
        totalErrors: performanceReport.metrics.totalErrors,
        totalBreakages,
        recommendations: performanceReport.recommendations
      }
    };
    
  } catch (error) {
    console.error('\n❌ ENHANCED AGENT TEST FAILED:');
    console.error(error.message);
    
    try {
      await agent.generateReport();
      await monitor.generateReport();
    } catch (reportError) {
      console.error('Failed to generate error reports:', reportError.message);
    }
    
    throw error;
  } finally {
    await agent.close();
    console.log('\n✅ Enhanced agent cleanup completed');
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🤖 Enhanced Interactive Agent Test Suite');
  console.log('Features: Scrolling + Breakage Detection + Interactive Testing');
  console.log('=========================================================\n');
  
  runEnhancedAgentTest()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Enhanced test suite PASSED!');
        process.exit(0);
      } else {
        console.log('\n⚠️  Enhanced test suite completed with issues');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Enhanced test suite FAILED');
      process.exit(1);
    });
}

export { runEnhancedAgentTest };