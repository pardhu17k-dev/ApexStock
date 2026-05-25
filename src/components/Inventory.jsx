import React, { useState, useMemo } from 'react';

export default function Inventory({ products, categories, onSaveProduct, onDeleteProduct, onRestock }) {
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  
  // Sorting State
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Quick Restock State
  const [restockProductId, setRestockProductId] = useState(null);
  const [restockQty, setRestockQty] = useState('');

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form State
  const initialFormState = {
    sku: '',
    name: '',
    category: '',
    buyingPrice: '',
    sellingPrice: '',
    stock: '0',
    reorderLevel: '5',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  // --- 1. SORTING & FILTERING MATHEMATICS ---
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // 1. Search Query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }

    // 2. Category Filter
    if (categoryFilter !== 'All') {
      result = result.filter((p) => p.category === categoryFilter);
    }

    // 3. Stock Level Filter
    if (stockFilter !== 'All') {
      if (stockFilter === 'In Stock') {
        result = result.filter((p) => p.stock > p.reorderLevel);
      } else if (stockFilter === 'Low Stock') {
        result = result.filter((p) => p.stock <= p.reorderLevel && p.stock > 0);
      } else if (stockFilter === 'Out of Stock') {
        result = result.filter((p) => p.stock === 0);
      }
    }

    // 4. Sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, search, categoryFilter, stockFilter, sortField, sortOrder]);

  // --- 2. MODAL FORM ACTIONS ---
  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      ...initialFormState,
      sku: `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, // Auto SKU
      category: categories[0] || 'Electronics',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      buyingPrice: product.buyingPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      stock: product.stock.toString(),
      reorderLevel: product.reorderLevel.toString(),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Product name is required';
    if (!formData.category.trim()) errors.category = 'Category is required';
    
    const buyVal = parseFloat(formData.buyingPrice);
    if (isNaN(buyVal) || buyVal <= 0) errors.buyingPrice = 'Buying price must be greater than $0';
    
    const sellVal = parseFloat(formData.sellingPrice);
    if (isNaN(sellVal) || sellVal <= 0) errors.sellingPrice = 'Selling price must be greater than $0';
    
    if (buyVal && sellVal && sellVal < buyVal) {
      errors.sellingPrice = 'Warning: Selling price is less than purchase cost!';
    }

    const stockVal = parseInt(formData.stock);
    if (isNaN(stockVal) || stockVal < 0) errors.stock = 'Stock level cannot be negative';

    const alertVal = parseInt(formData.reorderLevel);
    if (isNaN(alertVal) || alertVal < 0) errors.reorderLevel = 'Safety margin cannot be negative';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    onSaveProduct({
      ...formData,
      buyingPrice: parseFloat(formData.buyingPrice),
      sellingPrice: parseFloat(formData.sellingPrice),
      stock: parseInt(formData.stock),
      reorderLevel: parseInt(formData.reorderLevel),
    });

    setIsModalOpen(false);
  };

  const handleQuickRestockSubmit = (e, id) => {
    e.preventDefault();
    const qty = parseInt(restockQty);
    if (isNaN(qty) || qty <= 0) return;
    
    onRestock(id, qty);
    setRestockProductId(null);
    setRestockQty('');
  };

  return (
    <div className="inventory-view animate-fade-in">
      <div className="view-header">
        <div>
          <h1>Product Inventory Tracking</h1>
          <p className="subtitle">Maintain catalog records, check stocks, and log procurement items</p>
        </div>
        <div>
          <button className="btn btn-primary hover-scale" onClick={openAddModal}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* --- FILTER CONTROL PANEL --- */}
      <div className="glass-panel filter-panel">
        <div className="search-bar-wrapper">
          <span className="search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="text"
            className="form-control search-input"
            placeholder="Search by product name or SKU serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear-btn" onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>

        <div className="filters-selectors">
          <div className="filter-group">
            <label>Category</label>
            <select
              className="form-control select-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Stock Alert State</label>
            <select
              className="form-control select-control"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="All">All Levels</option>
              <option value="In Stock">In Stock (&gt; Safety Level)</option>
              <option value="Low Stock">Low Stock (&le; Safety Level)</option>
              <option value="Out of Stock">Out of Stock (= 0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- INVENTORY LISTING TABLE --- */}
      <div className="glass-panel table-panel">
        <div className="table-responsive">
          <table className="inventory-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('sku')}>
                  SKU Code {sortField === 'sku' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="sortable" onClick={() => handleSort('name')}>
                  Product Name {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="sortable" onClick={() => handleSort('category')}>
                  Category {sortField === 'category' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="sortable text-right" onClick={() => handleSort('buyingPrice')}>
                  Cost Cost {sortField === 'buyingPrice' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="sortable text-right" onClick={() => handleSort('sellingPrice')}>
                  Retail Price {sortField === 'sellingPrice' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="sortable text-center" onClick={() => handleSort('stock')}>
                  Stock Level {sortField === 'stock' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  const isLow = p.stock <= p.reorderLevel && p.stock > 0;
                  const isOut = p.stock === 0;
                  
                  return (
                    <tr key={p.id} className={isOut ? 'row-out-of-stock' : isLow ? 'row-low-stock' : ''}>
                      <td className="font-mono sku-cell">{p.sku}</td>
                      <td>
                        <span className="product-display-name">{p.name}</span>
                      </td>
                      <td>
                        <span className="category-tag">{p.category}</span>
                      </td>
                      <td className="text-right font-mono">${p.buyingPrice.toFixed(2)}</td>
                      <td className="text-right font-mono">${p.sellingPrice.toFixed(2)}</td>
                      <td className="text-center font-mono font-bold">
                        {p.stock} 
                        <span className="reorder-sub-lbl"> / {p.reorderLevel} safety</span>
                      </td>
                      <td className="text-center">
                        {isOut ? (
                          <span className="status-badge status-out animate-pulse">Out of Stock</span>
                        ) : isLow ? (
                          <span className="status-badge status-low">Low Stock</span>
                        ) : (
                          <span className="status-badge status-in">In Stock</span>
                        )}
                      </td>
                      <td className="text-right actions-cell">
                        {/* Quick Restock Drawer trigger */}
                        {restockProductId === p.id ? (
                          <form 
                            className="quick-restock-form animate-fade-in"
                            onSubmit={(e) => handleQuickRestockSubmit(e, p.id)}
                          >
                            <input
                              type="number"
                              className="form-control form-control-sm quick-qty-input"
                              placeholder="Qty"
                              autoFocus
                              value={restockQty}
                              onChange={(e) => setRestockQty(e.target.value)}
                            />
                            <button type="submit" className="btn btn-sm btn-success icon-btn" title="Add stock">
                              ✓
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-dark icon-btn" 
                              onClick={() => setRestockProductId(null)}
                            >
                              ✕
                            </button>
                          </form>
                        ) : (
                          <div className="action-buttons-group">
                            <button
                              className="action-btn restock-btn"
                              title="Restock units"
                              onClick={() => {
                                setRestockProductId(p.id);
                                setRestockQty('');
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                              </svg>
                            </button>

                            <button
                              className="action-btn edit-btn"
                              title="Edit product"
                              onClick={() => openEditModal(p)}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                              </svg>
                            </button>

                            {deleteConfirmId === p.id ? (
                              <div className="delete-confirm-flow animate-slide-in">
                                <span className="confirm-lbl">Sure?</span>
                                <button
                                  className="btn btn-xs btn-danger"
                                  onClick={() => {
                                    onDeleteProduct(p.id);
                                    setDeleteConfirmId(null);
                                  }}
                                >
                                  Yes
                                </button>
                                <button
                                  className="btn btn-xs btn-dark"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                className="action-btn delete-btn"
                                title="Remove product"
                                onClick={() => setDeleteConfirmId(p.id)}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="empty-table-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <p>No products match your current filtering selections.</p>
                    <button className="btn btn-xs btn-outline" onClick={() => { setSearch(''); setCategoryFilter('All'); setStockFilter('All'); }}>
                      Reset Filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD/EDIT PRODUCT MODAL --- */}
      {isModalOpen && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-content glass-panel animate-scale-in">
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Catalog Product' : 'Add Catalog Product'}</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group col-6">
                    <label className="required-label">SKU Serial Code</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g. ELEC-001"
                      required
                    />
                  </div>
                  <div className="form-group col-6">
                    <label className="required-label">Category</label>
                    <select
                      className="form-control select-control"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="required-label">Product Name</label>
                  <input
                    type="text"
                    className={`form-control ${formErrors.name ? 'input-error' : ''}`}
                    placeholder="Enter explicit product name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  {formErrors.name && <span className="field-error-msg">{formErrors.name}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group col-6">
                    <label className="required-label">Buying Cost (USD)</label>
                    <div className="price-input-wrapper">
                      <span className="price-symbol">$</span>
                      <input
                        type="number"
                        step="0.01"
                        className={`form-control pad-left-symbol ${formErrors.buyingPrice ? 'input-error' : ''}`}
                        placeholder="0.00"
                        value={formData.buyingPrice}
                        onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                      />
                    </div>
                    {formErrors.buyingPrice && <span className="field-error-msg">{formErrors.buyingPrice}</span>}
                  </div>
                  
                  <div className="form-group col-6">
                    <label className="required-label">Selling Retail (USD)</label>
                    <div className="price-input-wrapper">
                      <span className="price-symbol">$</span>
                      <input
                        type="number"
                        step="0.01"
                        className={`form-control pad-left-symbol ${formErrors.sellingPrice ? 'input-error' : ''}`}
                        placeholder="0.00"
                        value={formData.sellingPrice}
                        onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                      />
                    </div>
                    {formErrors.sellingPrice && <span className="field-error-msg">{formErrors.sellingPrice}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group col-6">
                    <label className="required-label">Initial Stock Level</label>
                    <input
                      type="number"
                      className={`form-control ${formErrors.stock ? 'input-error' : ''}`}
                      placeholder="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      disabled={!!editingProduct} // Can only edit stock via Restock transactions for traceablity
                    />
                    {formErrors.stock && <span className="field-error-msg">{formErrors.stock}</span>}
                    {editingProduct && <span className="field-help-msg">Restock directly in table.</span>}
                  </div>
                  
                  <div className="form-group col-6">
                    <label className="required-label">Reorder Safety Level</label>
                    <input
                      type="number"
                      className={`form-control ${formErrors.reorderLevel ? 'input-error' : ''}`}
                      placeholder="5"
                      value={formData.reorderLevel}
                      onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    />
                    {formErrors.reorderLevel && <span className="field-error-msg">{formErrors.reorderLevel}</span>}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-dark" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
