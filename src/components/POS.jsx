import React, { useState, useMemo } from 'react';

export default function POS({ products, onCheckout }) {
  // POS Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Cart State
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('0');

  // Completed Transaction receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState(null);

  // --- 1. CATEGORIES FILTER & PRODUCTS SEARCH ---
  const categoriesList = useMemo(() => {
    const list = new Set(products.map((p) => p.category));
    return ['All', ...Array.from(list)];
  }, [products]);

  const posProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, selectedCategory]);

  // --- 2. CART MANAGEMENT ACTIONS ---
  const addToCart = (product) => {
    if (product.stock === 0) return;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.productId === product.id);
      if (existingIndex !== -1) {
        // Check if adding exceeds stock
        const currentQty = prevCart[existingIndex].quantity;
        if (currentQty >= product.stock) {
          return prevCart; // Can't add more than stock
        }
        const newCart = [...prevCart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: currentQty + 1,
        };
        return newCart;
      } else {
        return [
          ...prevCart,
          {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            sellingPrice: product.sellingPrice,
            buyingPrice: product.buyingPrice,
            stock: product.stock,
            quantity: 1,
          },
        ];
      }
    });
  };

  const updateQuantity = (productId, newQty, maxStock) => {
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (qty > maxStock) return; // Prevent exceeding stock

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount('0');
  };

  // --- 3. PRICE CALCULATIONS ---
  const billingSummary = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + item.sellingPrice * item.quantity, 0);
    const discVal = parseFloat(discount) || 0;
    const netSubtotal = Math.max(0, subtotal - discVal);
    const taxRate = 0.08; // 8% Sales Tax
    const tax = parseFloat((netSubtotal * taxRate).toFixed(2));
    const total = parseFloat((netSubtotal + tax).toFixed(2));

    return {
      subtotal,
      discount: discVal,
      tax,
      total,
    };
  }, [cart, discount]);

  // --- 4. CHECKOUT ENGINE ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const result = await onCheckout(cart, billingSummary.discount);
      if (result && result.transaction) {
        // Load receipt to show the printable Modal
        setActiveReceipt(result.transaction);
        clearCart();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="pos-view animate-fade-in">
      <div className="view-header">
        <div>
          <h1>Point of Sale Billing</h1>
          <p className="subtitle">Search product inventory, build customer cart, and execute checkouts</p>
        </div>
      </div>

      <div className="pos-layout">
        {/* --- LEFT HAND SIDE: PRODUCT SELECTION CATALOG --- */}
        <div className="pos-catalog-section">
          {/* Catalog Controls */}
          <div className="glass-panel pos-catalog-header">
            <div className="pos-search-wrapper">
              <span className="search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input
                type="text"
                className="form-control pos-search-input"
                placeholder="Quick lookup SKU or product name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="search-clear-btn" onClick={() => setSearch('')}>
                  ×
                </button>
              )}
            </div>

            {/* Scrollable category pills */}
            <div className="category-pills">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  className={`pill-btn ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid list of inventory products */}
          <div className="pos-products-grid">
            {posProducts.length > 0 ? (
              posProducts.map((p) => {
                const isOutOfStock = p.stock === 0;
                const cartQty = cart.find((item) => item.productId === p.id)?.quantity || 0;
                const remainingStock = p.stock - cartQty;

                return (
                  <div
                    key={p.id}
                    className={`pos-product-card glass-panel hover-scale ${isOutOfStock ? 'disabled-card' : ''}`}
                    onClick={() => !isOutOfStock && remainingStock > 0 && addToCart(p)}
                  >
                    <div className="pos-card-badge">
                      <span className="category-tag">{p.category}</span>
                    </div>
                    <div className="pos-card-body">
                      <span className="font-mono card-sku">{p.sku}</span>
                      <h4 className="card-name" title={p.name}>
                        {p.name}
                      </h4>
                    </div>
                    <div className="pos-card-footer">
                      <div className="card-price">${p.sellingPrice.toFixed(2)}</div>
                      <div className="card-stock">
                        {isOutOfStock ? (
                          <span className="text-danger font-bold">Out of Stock</span>
                        ) : remainingStock === 0 ? (
                          <span className="text-warning font-bold">Limit Reached</span>
                        ) : (
                          <span>Stock: <strong>{remainingStock}</strong></span>
                        )}
                      </div>
                    </div>
                    {cartQty > 0 && (
                      <div className="pos-cart-badge-overlay animate-scale-in">
                        {cartQty}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-catalog-state glass-panel">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
                <p>No products match search criteria.</p>
              </div>
            )}
          </div>
        </div>

        {/* --- RIGHT HAND SIDE: CART / BILLING CHECKOUT PANEL --- */}
        <div className="pos-billing-section">
          <div className="glass-panel pos-billing-panel">
            <div className="billing-panel-header">
              <h3>Cart Summary</h3>
              {cart.length > 0 && (
                <button className="text-btn clear-cart-btn" onClick={clearCart}>
                  Clear All
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="billing-cart-list">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.productId} className="cart-item animate-slide-in">
                    <div className="cart-item-desc">
                      <span className="font-mono sku-small">{item.sku}</span>
                      <h4 className="cart-item-name">{item.name}</h4>
                      <span className="cart-item-price">${item.sellingPrice.toFixed(2)}</span>
                    </div>

                    <div className="cart-item-actions">
                      <div className="qty-controls">
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1, item.stock)}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="qty-input font-mono"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.productId, e.target.value, item.stock)}
                        />
                        <button
                          className="qty-btn"
                          disabled={item.quantity >= item.stock}
                          onClick={() => updateQuantity(item.productId, item.quantity + 1, item.stock)}
                        >
                          +
                        </button>
                      </div>

                      <button
                        className="cart-remove-btn"
                        onClick={() => removeFromCart(item.productId)}
                        title="Remove item"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-cart-state">
                  <div className="empty-cart-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1"></circle>
                      <circle cx="20" cy="21" r="1"></circle>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                  </div>
                  <p>Customer cart is currently empty.</p>
                  <span>Select catalog items on the left side to compile billing items.</span>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="billing-breakdown">
              <div className="breakdown-row">
                <span>Subtotal</span>
                <span className="font-mono">${billingSummary.subtotal.toFixed(2)}</span>
              </div>

              <div className="breakdown-row discount-row">
                <span>Flat Discount ($)</span>
                <input
                  type="number"
                  className="form-control form-control-sm billing-discount-input font-mono text-right"
                  value={discount}
                  min="0"
                  max={billingSummary.subtotal.toString()}
                  onChange={(e) => setDiscount(e.target.value)}
                  disabled={cart.length === 0}
                />
              </div>

              <div className="breakdown-row">
                <span>Sales Tax (8%)</span>
                <span className="font-mono">${billingSummary.tax.toFixed(2)}</span>
              </div>

              <div className="breakdown-divider"></div>

              <div className="breakdown-row total-row animate-pulse">
                <span>Grand Total</span>
                <span className="font-mono price-highlight">${billingSummary.total.toFixed(2)}</span>
              </div>

              <button
                className="btn btn-primary btn-block checkout-btn hover-scale"
                disabled={cart.length === 0}
                onClick={handleCheckout}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Charge & Checkout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- INVOICE RECEIPT MODAL --- */}
      {activeReceipt && (
        <div className="modal-backdrop print-backdrop animate-fade-in">
          <div className="modal-content print-modal glass-panel animate-scale-in">
            <div className="modal-header hide-on-print">
              <h3>Checkout Successful</h3>
              <button className="modal-close-btn" onClick={() => setActiveReceipt(null)}>
                ×
              </button>
            </div>

            <div className="modal-body print-area receipt-print-wrapper" id="receipt-print-area">
              <div className="receipt-paper">
                <div className="receipt-header">
                  <div className="receipt-brand">ApexStock</div>
                  <div className="receipt-title">Official Billing Invoice</div>
                  <div className="receipt-invoice-num">{activeReceipt.invoiceNumber}</div>
                </div>

                <div className="receipt-meta-info">
                  <div>
                    <span>Date:</span> <strong>{new Date(activeReceipt.timestamp).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Cashier:</span> <strong>John Doe</strong>
                  </div>
                  <div>
                    <span>Status:</span> <span className="status-indicator">PAID IN FULL</span>
                  </div>
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-table-header">
                  <span className="item-name-col">Item Description</span>
                  <span className="item-qty-col">Qty</span>
                  <span className="item-price-col">Price</span>
                  <span className="item-total-col text-right">Total</span>
                </div>

                <div className="receipt-items">
                  {activeReceipt.items.map((item) => (
                    <div key={item.productId} className="receipt-item-row">
                      <div className="item-name-col">
                        <span>{item.name}</span>
                      </div>
                      <div className="item-qty-col font-mono">x{item.quantity}</div>
                      <div className="item-price-col font-mono">${item.sellingPrice.toFixed(2)}</div>
                      <div className="item-total-col font-mono text-right">${(item.sellingPrice * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                <div className="receipt-divider"></div>

                <div className="receipt-totals font-mono">
                  <div className="receipt-total-row">
                    <span>Subtotal:</span>
                    <span>${activeReceipt.subtotal.toFixed(2)}</span>
                  </div>
                  {activeReceipt.discount > 0 && (
                    <div className="receipt-total-row discount-text">
                      <span>Discount:</span>
                      <span>-${activeReceipt.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="receipt-total-row">
                    <span>Tax (8%):</span>
                    <span>${activeReceipt.tax.toFixed(2)}</span>
                  </div>
                  <div className="receipt-divider-dotted"></div>
                  <div className="receipt-total-row grand-total-text font-bold">
                    <span>TOTAL:</span>
                    <span>${activeReceipt.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="receipt-footer">
                  <p>Thank you for your business!</p>
                  <span>Refund policies apply within 30 days of purchase.</span>
                </div>
              </div>
            </div>

            <div className="modal-footer hide-on-print">
              <button type="button" className="btn btn-dark" onClick={() => setActiveReceipt(null)}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={printReceipt}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
