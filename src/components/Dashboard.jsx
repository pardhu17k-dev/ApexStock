import React, { useState, useMemo } from 'react';

export default function Dashboard({ products, transactions, onRestock, setActiveTab }) {
  const [hoveredLinePoint, setHoveredLinePoint] = useState(null);
  const [hoveredDonutIndex, setHoveredDonutIndex] = useState(null);

  // --- 1. CALCULATE CORE METRICS ---
  const metrics = useMemo(() => {
    // Total Inventory Value (Cost value & Retail value)
    const costValue = products.reduce((acc, p) => acc + p.buyingPrice * p.stock, 0);
    const retailValue = products.reduce((acc, p) => acc + p.sellingPrice * p.stock, 0);
    
    // Low Stock Alerts (Stock <= Reorder level, and stock must be tracked)
    const lowStockItems = products.filter((p) => p.stock <= p.reorderLevel);
    const outOfStockCount = products.filter((p) => p.stock === 0).length;

    // Today's Sales & Net Profit
    const today = new Date().toDateString();
    let todaySales = 0;
    let netProfit = 0;
    let totalSalesCount = 0;

    transactions.forEach((tx) => {
      if (tx.status === 'completed') {
        totalSalesCount += tx.total;
        netProfit += tx.profit;

        const txDate = new Date(tx.timestamp).toDateString();
        if (txDate === today) {
          todaySales += tx.total;
        }
      } else if (tx.status === 'refunded') {
        // Net profit is adjusted (refund reverses profit)
        netProfit += tx.profit; // which is negative in refunded tx
      }
    });

    return {
      inventoryCostValue: costValue,
      inventoryRetailValue: retailValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount,
      todaySales,
      totalSalesCount,
      netProfit,
      lowStockItems,
    };
  }, [products, transactions]);

  // --- 2. PREPARE SALES TREND DATA (LINE CHART) ---
  const lineChartData = useMemo(() => {
    // Get last 5 days labels
    const days = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        dateString: d.toDateString(),
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        revenue: 0,
        profit: 0,
      });
    }

    // Aggregate transactions into days
    transactions.forEach((tx) => {
      const txDate = new Date(tx.timestamp).toDateString();
      const matchIndex = days.findIndex((d) => d.dateString === txDate);
      if (matchIndex !== -1) {
        if (tx.status === 'completed') {
          days[matchIndex].revenue += tx.total;
          days[matchIndex].profit += tx.profit;
        } else if (tx.status === 'refunded') {
          // A refund decreases profit and revenue for that day
          days[matchIndex].revenue -= tx.total; // reverse revenue
          days[matchIndex].profit += tx.profit;  // profit is negative
        }
      }
    });

    // Make sure numbers are formatted
    return days.map(d => ({
      ...d,
      revenue: parseFloat(d.revenue.toFixed(2)),
      profit: parseFloat(d.profit.toFixed(2)),
    }));
  }, [transactions]);

  // SVG Line Chart Drawing Math
  const lineChartSvgProps = useMemo(() => {
    const width = 500;
    const height = 200;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Find Max Value for scaling
    const maxVal = Math.max(
      ...lineChartData.map((d) => Math.max(d.revenue, d.profit, 100))
    ) * 1.15; // 15% padding on top

    const points = lineChartData.map((d, index) => {
      const x = paddingLeft + (index / (lineChartData.length - 1)) * chartWidth;
      const yRevenue = height - paddingBottom - (d.revenue / maxVal) * chartHeight;
      const yProfit = height - paddingBottom - (d.profit / maxVal) * chartHeight;
      return { x, yRevenue, yProfit, label: d.label, revenue: d.revenue, profit: d.profit };
    });

    // Generate Path Strings
    let revenuePathStr = '';
    let profitPathStr = '';
    let revenueAreaStr = '';
    let profitAreaStr = '';

    if (points.length > 0) {
      revenuePathStr = `M ${points[0].x} ${points[0].yRevenue} ` + points.slice(1).map(p => `L ${p.x} ${p.yRevenue}`).join(' ');
      profitPathStr = `M ${points[0].x} ${points[0].yProfit} ` + points.slice(1).map(p => `L ${p.x} ${p.yProfit}`).join(' ');
      
      revenueAreaStr = `${revenuePathStr} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
      profitAreaStr = `${profitPathStr} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
    }

    return {
      width,
      height,
      paddingLeft,
      paddingTop,
      paddingBottom,
      chartHeight,
      chartWidth,
      maxVal,
      points,
      revenuePathStr,
      profitPathStr,
      revenueAreaStr,
      profitAreaStr,
    };
  }, [lineChartData]);

  // --- 3. PREPARE CATEGORY BREAKDOWN DATA (DONUT CHART) ---
  const categoryData = useMemo(() => {
    const categoriesMap = {};
    products.forEach((p) => {
      const val = p.sellingPrice * p.stock;
      if (val > 0) {
        categoriesMap[p.category] = (categoriesMap[p.category] || 0) + val;
      }
    });

    const categoriesList = Object.keys(categoriesMap).map((cat) => ({
      name: cat,
      value: parseFloat(categoriesMap[cat].toFixed(2)),
    }));

    // Sort descending
    categoriesList.sort((a, b) => b.value - a.value);

    const totalVal = categoriesList.reduce((acc, c) => acc + c.value, 0);

    // Color Palette
    const colors = [
      'var(--color-primary)',
      'var(--color-success)',
      'var(--color-warning)',
      'var(--color-secondary)',
      'var(--color-info)',
      '#a855f7',
      '#ec4899',
    ];

    let accumAngle = 0;
    return categoriesList.map((cat, index) => {
      const percentage = totalVal > 0 ? (cat.value / totalVal) : 0;
      const angle = percentage * 360;
      const strokeDasharray = `${(percentage * 251.2).toFixed(1)} 251.2`;
      const strokeDashoffset = `${(251.2 - (accumAngle / 360) * 251.2).toFixed(1)}`;
      accumAngle += angle;

      return {
        ...cat,
        percentage: parseFloat((percentage * 100).toFixed(1)),
        color: colors[index % colors.length],
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [products]);

  const totalCategoryVal = useMemo(() => {
    return categoryData.reduce((acc, c) => acc + c.value, 0);
  }, [categoryData]);

  return (
    <div className="dashboard-view animate-fade-in">
      <div className="view-header">
        <div>
          <h1>Analytics Dashboard</h1>
          <p className="subtitle">Real-time inventory valuation and sales insights</p>
        </div>
        <div className="header-date">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* --- KPI METRIC CARDS --- */}
      <div className="metrics-grid">
        <div className="metric-card glass-panel hover-glow">
          <div className="metric-header">
            <span className="metric-title">Asset Valuation</span>
            <div className="metric-icon val-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <div className="metric-value">${metrics.inventoryCostValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="metric-footer">
            <span className="footer-label">Retail Value: </span>
            <span className="footer-highlight">${metrics.inventoryRetailValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="metric-card glass-panel hover-glow">
          <div className="metric-header">
            <span className="metric-title">Sales Today</span>
            <div className="metric-icon sales-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
            </div>
          </div>
          <div className="metric-value">${metrics.todaySales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="metric-footer">
            <span className="trend-up font-bold">Total Sales Value: </span>
            <span>${metrics.totalSalesCount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="metric-card glass-panel hover-glow">
          <div className="metric-header">
            <span className="metric-title">Net Profit Margin</span>
            <div className="metric-icon profit-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 6l-9.5 9.5-5-5L1 18"></path>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
            </div>
          </div>
          <div className="metric-value">${metrics.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="metric-footer">
            <span className="trend-up">
              {metrics.totalSalesCount > 0 
                ? `${((metrics.netProfit / metrics.totalSalesCount) * 100).toFixed(1)}%` 
                : '0%'}
            </span>
            <span className="footer-label"> Net Profit Ratio</span>
          </div>
        </div>

        <div className="metric-card glass-panel hover-glow">
          <div className="metric-header">
            <span className="metric-title">Stock Status</span>
            <div className="metric-icon alert-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
          </div>
          <div className="metric-value">
            {metrics.lowStockCount} <span className="value-label">Alerts</span>
          </div>
          <div className="metric-footer">
            <span className={`badge ${metrics.outOfStockCount > 0 ? 'badge-danger' : 'badge-warning'}`}>
              {metrics.outOfStockCount} Out of Stock
            </span>
          </div>
        </div>
      </div>

      {/* --- RECENT LOW STOCK NOTIFICATIONS & SIMULATORS --- */}
      {metrics.lowStockItems.length > 0 && (
        <div className="glass-panel alert-banner-panel animate-slide-in">
          <div className="panel-header alert-banner-header">
            <div className="panel-header-title">
              <span className="pulse-alert-dot"></span>
              <h3>Stock Replenishment System</h3>
            </div>
            <span className="panel-subtitle">Items currently below their reorder safety thresholds</span>
          </div>
          <div className="alert-items-list">
            {metrics.lowStockItems.slice(0, 3).map((item) => (
              <div key={item.id} className="alert-item">
                <div className="alert-item-info">
                  <div className="alert-badge-group">
                    <span className={`status-badge ${item.stock === 0 ? 'status-out' : 'status-low'}`}>
                      {item.stock === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                    </span>
                    <span className="alert-sku">{item.sku}</span>
                  </div>
                  <h4 className="alert-item-name">{item.name}</h4>
                  <p className="alert-item-meta">
                    Current: <strong>{item.stock}</strong> units | Safety Level: <strong>{item.reorderLevel}</strong> units
                  </p>
                </div>
                <div className="alert-item-action">
                  <button
                    className="btn btn-sm btn-primary hover-scale"
                    onClick={() => onRestock(item.id, item.reorderLevel * 2 + 5)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    <span>Instant Restock</span>
                  </button>
                </div>
              </div>
            ))}
            {metrics.lowStockItems.length > 3 && (
              <div className="more-alerts-footer">
                <button className="text-btn" onClick={() => setActiveTab('inventory')}>
                  View all {metrics.lowStockItems.length} low stock alerts &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CHARTS GRID --- */}
      <div className="charts-grid">
        {/* Sales & Profit Line Chart */}
        <div className="chart-card glass-panel">
          <div className="chart-header">
            <div>
              <h3>Sales & Profit Analytics</h3>
              <p className="card-subtitle">Aggregated historical invoice transaction data</p>
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot dot-revenue"></span>Revenue</span>
              <span className="legend-item"><span className="legend-dot dot-profit"></span>Net Profit</span>
            </div>
          </div>

          <div className="chart-body">
            <svg 
              viewBox={`0 0 ${lineChartSvgProps.width} ${lineChartSvgProps.height}`}
              className="svg-line-chart"
            >
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-success)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-success)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Y Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = lineChartSvgProps.paddingTop + ratio * lineChartSvgProps.chartHeight;
                const gridVal = lineChartSvgProps.maxVal * (1 - ratio);
                return (
                  <g key={i}>
                    <line 
                      x1={lineChartSvgProps.paddingLeft} 
                      y1={y} 
                      x2={lineChartSvgProps.width - 15} 
                      y2={y} 
                      className="chart-grid-line"
                    />
                    <text 
                      x={lineChartSvgProps.paddingLeft - 8} 
                      y={y + 4} 
                      className="chart-axis-label text-right"
                      textAnchor="end"
                    >
                      ${Math.round(gridVal)}
                    </text>
                  </g>
                );
              })}

              {/* X Grid Lines & Labels */}
              {lineChartSvgProps.points.map((p, i) => (
                <g key={i}>
                  <line 
                    x1={p.x} 
                    y1={lineChartSvgProps.paddingTop} 
                    x2={p.x} 
                    y2={lineChartSvgProps.height - lineChartSvgProps.paddingBottom} 
                    className="chart-grid-line" 
                  />
                  <text 
                    x={p.x} 
                    y={lineChartSvgProps.height - 12} 
                    className="chart-axis-label text-center"
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                </g>
              ))}

              {/* Shaded Areas */}
              <path d={lineChartSvgProps.revenueAreaStr} fill="url(#revenueGrad)" />
              <path d={lineChartSvgProps.profitAreaStr} fill="url(#profitGrad)" />

              {/* Polyline Paths */}
              <path d={lineChartSvgProps.revenuePathStr} className="chart-line-revenue" />
              <path d={lineChartSvgProps.profitPathStr} className="chart-line-profit" />

              {/* Hotspots & Dots for interactions */}
              {lineChartSvgProps.points.map((p, i) => (
                <g key={i}>
                  {/* Revenue dots */}
                  <circle 
                    cx={p.x} 
                    cy={p.yRevenue} 
                    r="4" 
                    className={`chart-dot-revenue ${hoveredLinePoint === i ? 'active' : ''}`} 
                  />
                  {/* Profit dots */}
                  <circle 
                    cx={p.x} 
                    cy={p.yProfit} 
                    r="4" 
                    className={`chart-dot-profit ${hoveredLinePoint === i ? 'active' : ''}`} 
                  />
                  {/* Interactive capture slice */}
                  <rect
                    x={p.x - 20}
                    y={lineChartSvgProps.paddingTop}
                    width="40"
                    height={lineChartSvgProps.chartHeight}
                    fill="transparent"
                    className="chart-interactive-slice"
                    onMouseEnter={() => setHoveredLinePoint(i)}
                    onMouseLeave={() => setHoveredLinePoint(null)}
                  />
                </g>
              ))}
            </svg>

            {/* Hover Tooltip display */}
            <div className="chart-tooltip-container">
              {hoveredLinePoint !== null ? (
                <div className="chart-tooltip glass-panel animate-fade-in">
                  <div className="tooltip-date">{lineChartData[hoveredLinePoint].label}</div>
                  <div className="tooltip-row">
                    <span className="dot-revenue"></span>
                    <span>Revenue: <strong>${lineChartData[hoveredLinePoint].revenue.toFixed(2)}</strong></span>
                  </div>
                  <div className="tooltip-row">
                    <span className="dot-profit"></span>
                    <span>Profit: <strong>${lineChartData[hoveredLinePoint].profit.toFixed(2)}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="chart-tooltip-placeholder">
                  <span>Hover over the data points to view detailed pricing values.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category breakdown (Donut chart) */}
        <div className="chart-card glass-panel">
          <div className="chart-header">
            <div>
              <h3>Inventory Distribution</h3>
              <p className="card-subtitle">Monetary valuation proportioned by category</p>
            </div>
          </div>
          <div className="chart-body donut-chart-container">
            {totalCategoryVal > 0 ? (
              <>
                <div className="donut-chart-wrapper">
                  <svg width="120" height="120" viewBox="0 0 36 36" className="donut-svg">
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="var(--bg-card)" strokeWidth="3" />
                    {categoryData.map((cat, index) => (
                      <circle
                        key={index}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke={cat.color}
                        strokeWidth="3.5"
                        strokeDasharray={cat.strokeDasharray}
                        strokeDashoffset={cat.strokeDashoffset}
                        className={`donut-segment ${hoveredDonutIndex === index ? 'active' : ''}`}
                        onMouseEnter={() => setHoveredDonutIndex(index)}
                        onMouseLeave={() => setHoveredDonutIndex(null)}
                      />
                    ))}
                    <g className="donut-center-text">
                      <text x="50%" y="46%" className="donut-center-val">
                        ${Math.round(totalCategoryVal).toLocaleString()}
                      </text>
                      <text x="50%" y="64%" className="donut-center-lbl">
                        Total Value
                      </text>
                    </g>
                  </svg>
                </div>

                <div className="donut-legend">
                  {categoryData.map((cat, index) => (
                    <div 
                      key={index} 
                      className={`legend-item-vertical ${hoveredDonutIndex === index ? 'active-row' : ''}`}
                      onMouseEnter={() => setHoveredDonutIndex(index)}
                      onMouseLeave={() => setHoveredDonutIndex(null)}
                    >
                      <span className="legend-color-box" style={{ backgroundColor: cat.color }}></span>
                      <div className="legend-info">
                        <span className="legend-name">{cat.name}</span>
                        <span className="legend-percentage">{cat.percentage}%</span>
                      </div>
                      <span className="legend-value">${cat.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-chart-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <p>No inventory items are seeded. Go to Inventory and add products to display distribution statistics.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
