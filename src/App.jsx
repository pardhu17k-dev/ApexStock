import React, { useState, useEffect, useMemo } from 'react';
import { initializeDB, dbService } from './services/db';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import Reports from './components/Reports';
import ToastContainer from './components/Toast';

// Initialize the Database seed records on module load
initializeDB();

export default function App() {
  // App Core State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ims_theme') || 'dark';
  });

  // Toasts Notification Queue State
  const [toasts, setToasts] = useState([]);

  // --- 1. TOAST ALERTS ENGINE ---
  const addToast = (message, type = 'success', title = '') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type, title }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- 2. THEME CONTROLLER ---
  useEffect(() => {
    const body = document.body;
    if (theme === 'light') {
      body.classList.add('light-theme');
    } else {
      body.classList.remove('light-theme');
    }
    localStorage.setItem('ims_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    addToast(
      `Switched to ${theme === 'dark' ? 'Light' : 'Dark'} mode display theme`,
      'info',
      'Theme Updated'
    );
  };

  // --- 3. INITIAL ASYNC DATA FETCHING ---
  const fetchData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const prodList = await dbService.getProducts();
      const txList = await dbService.getTransactions();
      setProducts(prodList);
      setTransactions(txList);
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast('Failed to load database. Refresh page.', 'error', 'API Connection Failure');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 4. DATA MUTATION HANDLERS (CRUD & POS CHECKOUT) ---

  const handleSaveProduct = async (productData) => {
    try {
      const isEdit = !!productData.id;
      const saved = await dbService.saveProduct(productData);
      
      // Instantly sync state
      await fetchData(false);

      addToast(
        `Product "${saved.name}" has been ${isEdit ? 'updated in' : 'added to'} the inventory catalog.`,
        'success',
        isEdit ? 'Product Saved' : 'Product Created'
      );
    } catch (error) {
      console.error(error);
      addToast(error.message || 'Could not save product details.', 'error', 'Save Operation Failed');
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      const success = await dbService.deleteProduct(id);
      if (success) {
        await fetchData(false);
        addToast(
          'The product record has been permanently removed from the catalog database.',
          'info',
          'Product Deleted'
        );
      }
    } catch (error) {
      console.error(error);
      addToast('Could not delete product record.', 'error', 'Delete Operation Failed');
    }
  };

  const handleRestockProduct = async (id, quantity) => {
    try {
      const updated = await dbService.restockProduct(id, quantity);
      await fetchData(false);
      addToast(
        `Replenished +${quantity} units for product "${updated.name}". Current Stock: ${updated.stock}.`,
        'success',
        'Stock Replenished'
      );
    } catch (error) {
      console.error(error);
      addToast('Could not replenish product stock levels.', 'error', 'Restock Failed');
    }
  };

  const handleCheckout = async (cartItems, discountVal) => {
    try {
      const result = await dbService.createTransaction(cartItems, discountVal);
      setProducts(result.products);
      setTransactions((prev) => [...prev, result.transaction]);

      addToast(
        `Charged Invoice ${result.transaction.invoiceNumber} successfully. Total: $${result.transaction.total.toFixed(2)}.`,
        'success',
        'Transaction Complete'
      );
      
      // Return details back to checkout component for showing the receipt modal
      return result;
    } catch (error) {
      console.error(error);
      addToast(error.message || 'Billing checkout failed.', 'error', 'Checkout Error');
      throw error;
    }
  };

  const handleRefundTransaction = async (id) => {
    try {
      const result = await dbService.refundTransaction(id);
      
      // Update both collections instantly
      setProducts(result.products);
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? result.transaction : t))
      );

      addToast(
        `Invoice ${result.transaction.invoiceNumber} was successfully refunded. Stock items have been put back to shelves.`,
        'warning',
        'Invoice Refunded'
      );
    } catch (error) {
      console.error(error);
      addToast(error.message || 'Transaction refund operation failed.', 'error', 'Refund Denied');
    }
  };

  // --- 5. CATEGORY & ALERTS MEMOIZATION ---
  const categoriesList = useMemo(() => {
    const list = new Set(products.map((p) => p.category));
    return Array.from(list);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock <= p.reorderLevel).length;
  }, [products]);

  // Loader Viewport
  if (loading) {
    return (
      <div className="loader-viewport">
        <div className="spinner"></div>
        <p className="animate-pulse">Accessing Enterprise Repository...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Dynamic Floating Toast Alerts Overlay */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Corporate Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Main Panel Viewport */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            products={products}
            transactions={transactions}
            onRestock={handleRestockProduct}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'inventory' && (
          <Inventory
            products={products}
            categories={categoriesList}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onRestock={handleRestockProduct}
          />
        )}

        {activeTab === 'pos' && (
          <POS
            products={products}
            onCheckout={handleCheckout}
          />
        )}

        {activeTab === 'reports' && (
          <Reports
            transactions={transactions}
            onRefundTransaction={handleRefundTransaction}
          />
        )}
      </main>
    </div>
  );
}
