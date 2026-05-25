import React, { useState, useMemo } from 'react';

export default function Reports({ transactions, onRefundTransaction }) {
  // Filters & State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [refundConfirmId, setRefundConfirmId] = useState(null);

  // --- 1. FILTER TRANSACTIONS LEDGER ---
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Sort chronologically descending (newest first)
    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.invoiceNumber.toLowerCase().includes(q) ||
          tx.items.some((item) => item.name.toLowerCase().includes(q))
      );
    }

    // Status Filter
    if (statusFilter !== 'All') {
      result = result.filter((tx) => tx.status === statusFilter.toLowerCase());
    }

    return result;
  }, [transactions, search, statusFilter]);

  // --- 2. PROFIT & LOSS CALCULATIONS ---
  const plSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalCOGS = 0; // Cost of Goods Sold
    let totalDiscounts = 0;
    let totalTax = 0;
    let netProfit = 0;
    let activeTransactionsCount = 0;
    let refundedTransactionsCount = 0;

    transactions.forEach((tx) => {
      if (tx.status === 'completed') {
        totalRevenue += tx.subtotal;
        totalDiscounts += tx.discount;
        totalTax += tx.tax;
        netProfit += tx.profit;
        activeTransactionsCount++;

        // Calculate Cost of Goods Sold = Selling Price (without tax) - Gross Profit
        // To find COGS from our items records: sum (quantity * buyingPrice)
        const cogs = tx.items.reduce((acc, item) => acc + item.buyingPrice * item.quantity, 0);
        totalCOGS += cogs;
      } else if (tx.status === 'refunded') {
        refundedTransactionsCount++;
        // Profit is adjusted (negative of original profit). Cost & revenue are reversed.
        netProfit += tx.profit; // negative
        
        // We also show discount refunded
        totalDiscounts -= tx.discount; // adjust discount
      }
    });

    return {
      revenue: totalRevenue,
      cogs: totalCOGS,
      discounts: totalDiscounts,
      tax: totalTax,
      netProfit,
      activeCount: activeTransactionsCount,
      refundedCount: refundedTransactionsCount,
    };
  }, [transactions]);

  // --- 3. CATEGORY MARGIN BREAKDOWN ---
  const categoryMargins = useMemo(() => {
    const breakdown = {};

    transactions.forEach((tx) => {
      if (tx.status !== 'completed') return; // Ignore refunded transactions for sales margin

      tx.items.forEach((item) => {
        const cat = item.category || 'Electronics'; // fallbacks if seeded
        if (!breakdown[cat]) {
          breakdown[cat] = {
            qtySold: 0,
            revenue: 0,
            cogs: 0,
            profit: 0,
          };
        }

        const rev = item.sellingPrice * item.quantity;
        const cogs = item.buyingPrice * item.quantity;

        breakdown[cat].qtySold += item.quantity;
        breakdown[cat].revenue += rev;
        breakdown[cat].cogs += cogs;
        breakdown[cat].profit += (rev - cogs);
      });
    });

    return Object.keys(breakdown).map((name) => {
      const data = breakdown[name];
      // Distribute discounts proportionately or calculate simple profit margins
      return {
        name,
        qtySold: data.qtySold,
        revenue: parseFloat(data.revenue.toFixed(2)),
        cogs: parseFloat(data.cogs.toFixed(2)),
        profit: parseFloat(data.profit.toFixed(2)),
        margin: data.revenue > 0 ? parseFloat(((data.profit / data.revenue) * 100).toFixed(1)) : 0,
      };
    });
  }, [transactions]);

  return (
    <div className="reports-view animate-fade-in">
      <div className="view-header">
        <div>
          <h1>Sales Reports & P&L Analysis</h1>
          <p className="subtitle">Audit chronological invoice logs, track margins, and manage returns</p>
        </div>
      </div>

      {/* --- P&L FINANCIAL REPORT PANEL --- */}
      <div className="pl-summary-panel glass-panel">
        <div className="pl-panel-header">
          <h3>Income & Profit Statement</h3>
          <span className="subtitle">Consolidated totals based on active audit invoices</span>
        </div>

        <div className="pl-summary-grid">
          <div className="pl-summary-card">
            <span className="pl-label">Gross Revenue</span>
            <div className="pl-val text-primary">${plSummary.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="pl-sub-lbl">Total item retail sales</span>
          </div>

          <div className="pl-summary-card">
            <span className="pl-label">Cost of Goods Sold (COGS)</span>
            <div className="pl-val text-warning">-${plSummary.cogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="pl-sub-lbl">Wholesale cost assets</span>
          </div>

          <div className="pl-summary-card">
            <span className="pl-label">Total Discounts Given</span>
            <div className="pl-val text-secondary">-${plSummary.discounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="pl-sub-lbl">Discount voucher reductions</span>
          </div>

          <div className="pl-summary-card pl-card-net">
            <span className="pl-label text-success font-bold">Net Earnings (Profit)</span>
            <div className="pl-val text-success font-bold">${plSummary.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="pl-sub-lbl font-bold">
              Margin Ratio:{' '}
              <strong>
                {plSummary.revenue > 0
                  ? `${((plSummary.netProfit / plSummary.revenue) * 100).toFixed(1)}%`
                  : '0%'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* --- SECTION: CATEGORICAL SPLIT & INVOICES --- */}
      <div className="reports-details-grid">
        {/* Category Performance breakdown */}
        <div className="glass-panel performance-panel">
          <div className="panel-header">
            <h3>Categorical Sales Breakdown</h3>
            <p className="panel-subtitle">Margin splits based on selling performance</p>
          </div>

          <div className="table-responsive">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-center">Units Sold</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">Net Margin</th>
                </tr>
              </thead>
              <tbody>
                {categoryMargins.length > 0 ? (
                  categoryMargins.map((cat) => (
                    <tr key={cat.name}>
                      <td className="font-bold">{cat.name}</td>
                      <td className="text-center font-mono">{cat.qtySold}</td>
                      <td className="text-right font-mono">${cat.revenue.toFixed(2)}</td>
                      <td className="text-right font-mono text-success">${cat.profit.toFixed(2)}</td>
                      <td className="text-right font-mono font-bold">{cat.margin}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty-mini-table">
                      No categories traded yet. Execute transactions to view results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chronological Invoice Audit Logs */}
        <div className="glass-panel ledger-panel">
          <div className="panel-header flex-header">
            <div>
              <h3>Invoice Audit Ledger</h3>
              <p className="panel-subtitle">Chronological index of all stores invoice documents</p>
            </div>

            <div className="ledger-filters">
              <select
                className="form-control form-control-sm select-control shadow-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Invoices</option>
                <option value="Completed">Completed</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>
          </div>

          {/* Quick Invoice search */}
          <div className="ledger-search-box">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search by INV# or product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="ledger-list-wrapper">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => {
                const isRefunded = tx.status === 'refunded';
                
                return (
                  <div key={tx.id} className={`ledger-card ${isRefunded ? 'ledger-refunded' : ''}`}>
                    <div className="ledger-card-header">
                      <div className="ledger-inv-info">
                        <span className="font-mono inv-num">{tx.invoiceNumber}</span>
                        <span className="inv-date">{new Date(tx.timestamp).toLocaleString()}</span>
                      </div>
                      <span className={`status-badge ${isRefunded ? 'status-out' : 'status-in'}`}>
                        {tx.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="ledger-card-body">
                      <div className="ledger-items-brief">
                        {tx.items.map((item) => (
                          <div key={item.productId} className="ledger-item-row-bullet">
                            <span>{item.name}</span>
                            <strong className="font-mono">x{item.quantity}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ledger-card-footer">
                      <div className="ledger-pricing font-mono">
                        <div>
                          <span>Tax:</span> <strong>${tx.tax.toFixed(2)}</strong>
                        </div>
                        {tx.discount > 0 && (
                          <div>
                            <span>Discount:</span> <strong>-${tx.discount.toFixed(2)}</strong>
                          </div>
                        )}
                        <div className="invoice-charge">
                          <span>Charged:</span> <strong className="price-label">${tx.total.toFixed(2)}</strong>
                        </div>
                        <div className="invoice-profit">
                          <span>Profit:</span>{' '}
                          <strong className={tx.profit < 0 ? 'text-danger' : 'text-success'}>
                            ${tx.profit.toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      {/* Refund Trigger button */}
                      {!isRefunded && (
                        <div className="ledger-refund-action">
                          {refundConfirmId === tx.id ? (
                            <div className="refund-confirmation-bubble animate-scale-in">
                              <span>Reverse sale?</span>
                              <button
                                className="btn btn-xs btn-danger"
                                onClick={() => {
                                  onRefundTransaction(tx.id);
                                  setRefundConfirmId(null);
                                }}
                              >
                                Yes
                              </button>
                              <button
                                className="btn btn-xs btn-dark"
                                onClick={() => setRefundConfirmId(null)}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-xs btn-outline btn-danger hover-scale"
                              onClick={() => setRefundConfirmId(tx.id)}
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-ledger-state">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <p>No transactions match search filter rules.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
