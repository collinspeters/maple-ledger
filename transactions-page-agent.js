import OptimizedInteractiveAgent from './optimized-interactive-agent.js';

class TransactionsPageAgent extends OptimizedInteractiveAgent {
  constructor() {
    super({
      headless: false,
      timeout: 15000,
      retryAttempts: 2,
      baseUrl: 'http://localhost:5000'
    });
  }

  async analyzeTransactionsPageInDepth() {
    console.log('🔍 Starting in-depth Transactions Page analysis...');
    
    const analysis = {
      pageLoad: {},
      tableAnalysis: {},
      filterSystem: {},
      userExperience: {},
      scrollBehavior: {},
      interactionTesting: {},
      visualIssues: [],
      recommendations: []
    };

    try {
      // Step 1: Navigate and initial load analysis
      await this.navigateWithRetry('/transactions');
      await this.waitForElementOptimized('table, [role="table"]', { timeout: 10000 });
      
      analysis.pageLoad = await this.analyzePageLoad();
      
      // Step 2: Table structure analysis
      analysis.tableAnalysis = await this.analyzeTableStructure();
      
      // Step 3: Filter system testing
      analysis.filterSystem = await this.analyzeFilterSystem();
      
      // Step 4: Scroll behavior with transaction loading
      analysis.scrollBehavior = await this.analyzeScrollBehavior();
      
      // Step 5: Interactive element testing
      analysis.interactionTesting = await this.testTransactionInteractions();
      
      // Step 6: Visual issues detection
      analysis.visualIssues = await this.detectVisualIssues();
      
      // Step 7: User experience assessment
      analysis.userExperience = await this.assessUserExperience();
      
      // Generate recommendations
      analysis.recommendations = this.generateTransactionPageRecommendations(analysis);
      
      return analysis;
      
    } catch (error) {
      console.error('❌ Transactions page analysis failed:', error.message);
      throw error;
    }
  }

  async analyzePageLoad() {
    console.log('📊 Analyzing page load performance...');
    
    return await this.page.evaluate(() => {
      const performance = window.performance;
      const navigation = performance.getEntriesByType('navigation')[0];
      
      // Count transaction-related elements
      const transactionRows = document.querySelectorAll('tr[data-transaction], [data-testid*="transaction"], tbody tr');
      const filterElements = document.querySelectorAll('[data-testid*="filter"], select, input[type="search"]');
      const paginationElements = document.querySelectorAll('[data-testid*="pagination"], .pagination button, [aria-label*="page"]');
      
      return {
        domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
        loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
        transactionRowsFound: transactionRows.length,
        filterElementsFound: filterElements.length,
        paginationElementsFound: paginationElements.length,
        totalElements: document.querySelectorAll('*').length,
        tablePresent: !!document.querySelector('table, [role="table"]'),
        loadingIndicators: document.querySelectorAll('[data-testid*="loading"], .loading, .spinner').length
      };
    });
  }

  async analyzeTableStructure() {
    console.log('📋 Analyzing transaction table structure...');
    
    return await this.page.evaluate(() => {
      const table = document.querySelector('table, [role="table"]');
      if (!table) {
        return { error: 'No table found on page' };
      }

      // Analyze headers
      const headers = Array.from(table.querySelectorAll('th, [role="columnheader"]')).map(th => ({
        text: th.textContent.trim(),
        sortable: th.querySelector('[data-testid*="sort"], .sort') ? true : false,
        width: th.offsetWidth
      }));

      // Analyze data rows
      const rows = Array.from(table.querySelectorAll('tbody tr, [role="row"]:not([role="columnheader"])'));
      const sampleRows = rows.slice(0, 5).map((row, index) => {
        const cells = Array.from(row.querySelectorAll('td, [role="cell"]'));
        return {
          index,
          cellCount: cells.length,
          hasData: cells.some(cell => cell.textContent.trim()),
          isEmpty: cells.every(cell => !cell.textContent.trim()),
          cellContents: cells.map(cell => cell.textContent.trim().substring(0, 50))
        };
      });

      return {
        tableFound: true,
        headerCount: headers.length,
        headers,
        totalRows: rows.length,
        sampleRows,
        emptyRows: rows.filter(row => {
          const cells = Array.from(row.querySelectorAll('td, [role="cell"]'));
          return cells.every(cell => !cell.textContent.trim());
        }).length,
        tableWidth: table.offsetWidth,
        tableHeight: table.offsetHeight
      };
    });
  }

  async analyzeFilterSystem() {
    console.log('🔽 Analyzing filter system...');
    
    return await this.page.evaluate(() => {
      const filterElements = {
        searchInputs: [],
        dropdowns: [],
        buttons: [],
        dateInputs: []
      };

      // Find search inputs
      document.querySelectorAll('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]').forEach((input, index) => {
        filterElements.searchInputs.push({
          index,
          placeholder: input.placeholder,
          value: input.value,
          disabled: input.disabled,
          visible: input.offsetParent !== null
        });
      });

      // Find dropdown filters
      document.querySelectorAll('select, [role="combobox"]').forEach((select, index) => {
        const options = select.querySelectorAll('option');
        filterElements.dropdowns.push({
          index,
          optionCount: options.length,
          selectedValue: select.value,
          disabled: select.disabled,
          visible: select.offsetParent !== null,
          firstFewOptions: Array.from(options).slice(0, 3).map(opt => opt.textContent.trim())
        });
      });

      // Find filter buttons
      document.querySelectorAll('button').forEach((btn, index) => {
        const text = btn.textContent.trim().toLowerCase();
        if (text.includes('filter') || text.includes('clear') || text.includes('reset') || 
            btn.getAttribute('data-testid')?.includes('filter')) {
          filterElements.buttons.push({
            index,
            text: btn.textContent.trim(),
            disabled: btn.disabled,
            visible: btn.offsetParent !== null,
            hasIcon: !!btn.querySelector('svg, img'),
            className: btn.className
          });
        }
      });

      // Find date inputs
      document.querySelectorAll('input[type="date"], input[placeholder*="date"], input[placeholder*="Date"]').forEach((input, index) => {
        filterElements.dateInputs.push({
          index,
          placeholder: input.placeholder,
          value: input.value,
          disabled: input.disabled,
          visible: input.offsetParent !== null
        });
      });

      return filterElements;
    });
  }

  async analyzeScrollBehavior() {
    console.log('📜 Analyzing scroll behavior and lazy loading...');
    
    const scrollAnalysis = {
      positions: [],
      newContentLoaded: false,
      infiniteScroll: false,
      performanceImpact: []
    };

    try {
      // Get initial row count
      const initialRowCount = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, [role="row"]:not([role="columnheader"])');
        return rows.length;
      });

      // Scroll to bottom
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for potential loading
      
      // Check if new content loaded
      const finalRowCount = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, [role="row"]:not([role="columnheader"])');
        return rows.length;
      });

      scrollAnalysis.newContentLoaded = finalRowCount > initialRowCount;
      scrollAnalysis.infiniteScroll = scrollAnalysis.newContentLoaded;

      // Test scroll positions
      for (let i = 0; i <= 4; i++) {
        const scrollPercent = (i / 4) * 100;
        
        await this.page.evaluate((percent) => {
          const scrollTop = (document.body.scrollHeight - window.innerHeight) * (percent / 100);
          window.scrollTo(0, scrollTop);
        }, scrollPercent);

        await new Promise(resolve => setTimeout(resolve, 500));

        const positionData = await this.page.evaluate((position) => {
          const visibleRows = Array.from(document.querySelectorAll('tbody tr, [role="row"]:not([role="columnheader"])'))
            .filter(row => {
              const rect = row.getBoundingClientRect();
              return rect.top >= 0 && rect.top <= window.innerHeight;
            });

          return {
            scrollPosition: position,
            visibleRowCount: visibleRows.length,
            loadingIndicators: document.querySelectorAll('[data-testid*="loading"], .loading, .spinner').length
          };
        }, scrollPercent);

        scrollAnalysis.positions.push(positionData);
      }

      // Scroll back to top
      await this.page.evaluate(() => window.scrollTo(0, 0));

      return scrollAnalysis;
      
    } catch (error) {
      console.error('❌ Scroll analysis failed:', error.message);
      return scrollAnalysis;
    }
  }

  async testTransactionInteractions() {
    console.log('🎯 Testing transaction row interactions...');
    
    return await this.page.evaluate(() => {
      const interactions = {
        clickableRows: [],
        editableFields: [],
        actionButtons: [],
        contextMenus: []
      };

      // Test row clicks
      const rows = Array.from(document.querySelectorAll('tbody tr, [role="row"]:not([role="columnheader"])'));
      rows.slice(0, 5).forEach((row, index) => {
        const rect = row.getBoundingClientRect();
        const isVisible = rect.height > 0 && rect.width > 0;
        
        interactions.clickableRows.push({
          index,
          visible: isVisible,
          hasClickHandler: !!row.onclick || row.style.cursor === 'pointer',
          hasDataAttributes: Object.keys(row.dataset).length > 0,
          cellCount: row.querySelectorAll('td, [role="cell"]').length
        });
      });

      // Test editable fields
      document.querySelectorAll('input, select, textarea').forEach((field, index) => {
        if (field.closest('tr, [role="row"]')) {
          interactions.editableFields.push({
            index,
            type: field.type || field.tagName.toLowerCase(),
            disabled: field.disabled,
            readonly: field.readOnly,
            placeholder: field.placeholder,
            value: field.value ? 'has value' : 'empty'
          });
        }
      });

      // Test action buttons in rows
      document.querySelectorAll('button').forEach((btn, index) => {
        if (btn.closest('tr, [role="row"]')) {
          interactions.actionButtons.push({
            index,
            text: btn.textContent.trim(),
            disabled: btn.disabled,
            hasIcon: !!btn.querySelector('svg, img'),
            visible: btn.offsetParent !== null,
            ariaLabel: btn.getAttribute('aria-label')
          });
        }
      });

      return interactions;
    });
  }

  async detectVisualIssues() {
    console.log('👁️ Detecting visual issues...');
    
    return await this.page.evaluate(() => {
      const issues = [];

      // Check for empty buttons (major issue found previously)
      const emptyButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const hasText = btn.textContent.trim();
        const hasIcon = btn.querySelector('svg, img, i[class*="icon"]');
        const hasLabel = btn.getAttribute('aria-label');
        return !hasText && !hasIcon && !hasLabel;
      });

      if (emptyButtons.length > 0) {
        issues.push({
          type: 'empty_buttons',
          count: emptyButtons.length,
          severity: 'high',
          description: `${emptyButtons.length} buttons have no visible content or labels`,
          locations: emptyButtons.slice(0, 5).map(btn => btn.className)
        });
      }

      // Check for table alignment issues
      const table = document.querySelector('table');
      if (table) {
        const headers = Array.from(table.querySelectorAll('th'));
        const firstRow = table.querySelector('tbody tr');
        if (firstRow) {
          const cells = Array.from(firstRow.querySelectorAll('td'));
          if (headers.length !== cells.length) {
            issues.push({
              type: 'table_alignment',
              severity: 'medium',
              description: `Header count (${headers.length}) doesn't match cell count (${cells.length})`
            });
          }
        }
      }

      // Check for overflow issues
      const overflowingElements = Array.from(document.querySelectorAll('*')).filter(el => {
        return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
      });

      if (overflowingElements.length > 5) {
        issues.push({
          type: 'content_overflow',
          count: overflowingElements.length,
          severity: 'medium',
          description: `${overflowingElements.length} elements have content overflow`
        });
      }

      // Check for missing loading states
      const hasLoadingIndicator = document.querySelectorAll('[data-testid*="loading"], .loading, .spinner').length > 0;
      if (!hasLoadingIndicator) {
        issues.push({
          type: 'missing_loading_state',
          severity: 'low',
          description: 'No loading indicators found - users may not know when data is being fetched'
        });
      }

      return issues;
    });
  }

  async assessUserExperience() {
    console.log('👤 Assessing user experience...');
    
    return await this.page.evaluate(() => {
      const ux = {
        dataVisibility: {},
        navigation: {},
        feedback: {},
        accessibility: {}
      };

      // Data visibility assessment
      const rows = document.querySelectorAll('tbody tr, [role="row"]:not([role="columnheader"])');
      const visibleRows = Array.from(rows).filter(row => {
        const rect = row.getBoundingClientRect();
        return rect.height > 0 && rect.width > 0;
      });

      ux.dataVisibility = {
        totalRows: rows.length,
        visibleRows: visibleRows.length,
        emptyTableMessage: document.querySelector('[data-testid*="empty"], .empty-state') ? 'present' : 'missing',
        dataLoaded: visibleRows.length > 0
      };

      // Navigation assessment
      const pagination = document.querySelectorAll('[data-testid*="pagination"], .pagination button, [aria-label*="page"]');
      const sortButtons = document.querySelectorAll('[data-testid*="sort"], .sort, th[role="columnheader"][aria-sort]');
      
      ux.navigation = {
        paginationPresent: pagination.length > 0,
        sortingAvailable: sortButtons.length > 0,
        searchAvailable: document.querySelectorAll('input[type="search"], input[placeholder*="search"]').length > 0
      };

      // Feedback mechanisms
      ux.feedback = {
        successMessages: document.querySelectorAll('[role="alert"], .success, .notification').length,
        errorMessages: document.querySelectorAll('[role="alert"][aria-live="assertive"], .error').length,
        tooltips: document.querySelectorAll('[role="tooltip"], [title]').length
      };

      // Basic accessibility check
      ux.accessibility = {
        missingAltText: document.querySelectorAll('img:not([alt])').length,
        unlabeledInputs: document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])').length,
        keyboardNavigation: document.querySelectorAll('[tabindex="-1"]').length
      };

      return ux;
    });
  }

  generateTransactionPageRecommendations(analysis) {
    const recommendations = [];

    // Critical issues first
    if (analysis.visualIssues) {
      const emptyButtonIssue = analysis.visualIssues.find(issue => issue.type === 'empty_buttons');
      if (emptyButtonIssue && emptyButtonIssue.count > 100) {
        recommendations.push({
          priority: 'CRITICAL',
          issue: `${emptyButtonIssue.count} empty buttons detected`,
          solution: 'Add proper icons or text labels to all buttons, especially pagination and filter controls'
        });
      }
    }

    // Performance recommendations
    if (analysis.pageLoad && analysis.pageLoad.transactionRowsFound > 500) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Large number of transaction rows may impact performance',
        solution: 'Implement virtual scrolling or pagination to limit DOM elements'
      });
    }

    // UX improvements
    if (analysis.userExperience && !analysis.userExperience.navigation.paginationPresent) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'No pagination controls found',
        solution: 'Add pagination to help users navigate through large datasets'
      });
    }

    // Accessibility improvements
    if (analysis.userExperience && analysis.userExperience.accessibility.unlabeledInputs > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: `${analysis.userExperience.accessibility.unlabeledInputs} inputs missing labels`,
        solution: 'Add proper aria-labels or associate with label elements'
      });
    }

    return recommendations;
  }

  async generateDetailedReport(analysis) {
    const report = {
      timestamp: new Date().toISOString(),
      pageUrl: '/transactions',
      analysis,
      summary: {
        overallStatus: 'analyzed',
        criticalIssues: analysis.recommendations?.filter(r => r.priority === 'CRITICAL').length || 0,
        highPriorityIssues: analysis.recommendations?.filter(r => r.priority === 'HIGH').length || 0,
        mediumPriorityIssues: analysis.recommendations?.filter(r => r.priority === 'MEDIUM').length || 0
      }
    };

    const filename = `transactions-page-analysis-${Date.now()}.json`;
    const fs = await import('fs/promises');
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    console.log(`📊 Detailed analysis report saved: ${filename}`);
    
    return report;
  }
}

// Main execution function
async function runTransactionsPageAnalysis() {
  const agent = new TransactionsPageAgent();
  
  console.log('🎯 FOCUSED TRANSACTIONS PAGE ANALYSIS');
  console.log('=====================================\n');
  
  try {
    await agent.init();
    
    // Authenticate first
    const authSuccess = await agent.authenticateAPI();
    if (!authSuccess) {
      throw new Error('Authentication failed');
    }
    
    await agent.injectSession();
    
    // Run the detailed analysis
    const analysis = await agent.analyzeTransactionsPageInDepth();
    
    // Generate and save detailed report
    const report = await agent.generateDetailedReport(analysis);
    
    // Display human-readable summary
    console.log('\n' + '='.repeat(60));
    console.log('👁️  VISUAL ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    
    console.log('\n📊 PAGE LOAD ANALYSIS:');
    if (analysis.pageLoad.tablePresent) {
      console.log(`✅ Transaction table found with ${analysis.pageLoad.transactionRowsFound} rows`);
      console.log(`📋 ${analysis.pageLoad.filterElementsFound} filter elements detected`);
      console.log(`📄 ${analysis.pageLoad.paginationElementsFound} pagination elements found`);
    } else {
      console.log('❌ No transaction table detected on page');
    }
    
    console.log('\n📋 TABLE STRUCTURE:');
    if (analysis.tableAnalysis.tableFound) {
      console.log(`📊 Headers: ${analysis.tableAnalysis.headerCount} columns`);
      console.log(`📝 Data rows: ${analysis.tableAnalysis.totalRows} total`);
      console.log(`❌ Empty rows: ${analysis.tableAnalysis.emptyRows}`);
      
      if (analysis.tableAnalysis.headers.length > 0) {
        console.log('📑 Column headers:', analysis.tableAnalysis.headers.map(h => h.text).join(', '));
      }
    }
    
    console.log('\n🔽 FILTER SYSTEM:');
    const filters = analysis.filterSystem;
    console.log(`🔍 Search inputs: ${filters.searchInputs.length}`);
    console.log(`📋 Dropdown filters: ${filters.dropdowns.length}`);
    console.log(`🔘 Filter buttons: ${filters.buttons.length}`);
    
    console.log('\n🎯 INTERACTION TESTING:');
    const interactions = analysis.interactionTesting;
    console.log(`👆 Clickable rows tested: ${interactions.clickableRows.length}`);
    console.log(`✏️  Editable fields: ${interactions.editableFields.length}`);
    console.log(`🔘 Action buttons in rows: ${interactions.actionButtons.length}`);
    
    console.log('\n👁️  VISUAL ISSUES DETECTED:');
    if (analysis.visualIssues.length === 0) {
      console.log('✨ No major visual issues detected');
    } else {
      analysis.visualIssues.forEach(issue => {
        const severity = issue.severity.toUpperCase();
        console.log(`${severity === 'HIGH' ? '🔴' : severity === 'MEDIUM' ? '🟡' : '🔵'} ${severity}: ${issue.description}`);
      });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (analysis.recommendations.length === 0) {
      console.log('✅ No critical recommendations - page functioning well');
    } else {
      analysis.recommendations.forEach((rec, index) => {
        const icon = rec.priority === 'CRITICAL' ? '🚨' : rec.priority === 'HIGH' ? '⚠️' : '💡';
        console.log(`${icon} ${rec.priority}: ${rec.issue}`);
        console.log(`   Solution: ${rec.solution}\n`);
      });
    }
    
    console.log('\n👤 USER EXPERIENCE ASSESSMENT:');
    const ux = analysis.userExperience;
    if (ux.dataVisibility) {
      console.log(`📊 Data visibility: ${ux.dataVisibility.visibleRows}/${ux.dataVisibility.totalRows} rows visible`);
      console.log(`🔍 Search available: ${ux.navigation.searchAvailable ? 'Yes' : 'No'}`);
      console.log(`📄 Pagination: ${ux.navigation.paginationPresent ? 'Present' : 'Missing'}`);
      console.log(`🔄 Sorting: ${ux.navigation.sortingAvailable ? 'Available' : 'Not available'}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📁 Detailed report saved: transactions-page-analysis-${Date.now()}.json`);
    console.log('='.repeat(60));
    
    return report;
    
  } catch (error) {
    console.error('\n❌ Transactions page analysis failed:', error.message);
    throw error;
  } finally {
    await agent.close();
    console.log('\n✅ Analysis completed');
  }
}

// Export for module use
export default TransactionsPageAgent;
export { runTransactionsPageAnalysis };

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runTransactionsPageAnalysis()
    .then(() => {
      console.log('\n🎉 Transactions page analysis completed successfully!');
      process.exit(0);
    })
    .catch(() => {
      console.error('\n💥 Transactions page analysis failed');
      process.exit(1);
    });
}