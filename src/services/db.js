// Mock Database & Simulated API Service Layer
// Uses LocalStorage to persist state and mock delays to simulate a server/database environment.

const DELAY_MS = 250; // Mock network latency for responsive loaders/skeletons
const sleep = (ms = DELAY_MS) => new Promise((resolve) => setTimeout(resolve, ms));

const KEYS = {
  PRODUCTS: 'ims_products',
  TRANSACTIONS: 'ims_transactions',
  THEME: 'ims_theme',
};

// Seed Data
const INITIAL_PRODUCTS = [
  {
    id: 'prod-1',
    sku: 'ELEC-APL-001',
    name: 'Retina Studio Display Pro',
    category: 'Electronics',
    stock: 12,
    reorderLevel: 5,
    buyingPrice: 850.00,
    sellingPrice: 1299.99,
  },
  {
    id: 'prod-2',
    sku: 'ELEC-APL-002',
    name: 'Mechanical Keychron K4 Keyboard',
    category: 'Electronics',
    stock: 4, // Below reorder level (6) to trigger stock alerts!
    reorderLevel: 6,
    buyingPrice: 65.00,
    sellingPrice: 99.00,
  },
  {
    id: 'prod-3',
    sku: 'APPR-SHR-003',
    name: 'Minimalist Merino Wool Hoodie',
    category: 'Apparel',
    stock: 25,
    reorderLevel: 8,
    buyingPrice: 45.00,
    sellingPrice: 89.50,
  },
  {
    id: 'prod-4',
    sku: 'HOME-KIT-004',
    name: 'Smart Vacuum Robot S9',
    category: 'Home & Kitchen',
    stock: 8,
    reorderLevel: 3,
    buyingPrice: 220.00,
    sellingPrice: 349.99,
  },
  {
    id: 'prod-5',
    sku: 'HOME-KIT-005',
    name: 'Precision Gooseneck Kettle',
    category: 'Home & Kitchen',
    stock: 2, // Low stock! Reorder level 3
    reorderLevel: 3,
    buyingPrice: 40.00,
    sellingPrice: 75.00,
  },
  {
    id: 'prod-6',
    sku: 'OFFC-SUP-006',
    name: 'Ergonomic Memory Foam Cushion',
    category: 'Office Supplies',
    stock: 18,
    reorderLevel: 5,
    buyingPrice: 15.00,
    sellingPrice: 29.99,
  },
  {
    id: 'prod-7',
    sku: 'GROC-BEV-007',
    name: 'Direct Trade Coffee Beans (1kg)',
    category: 'Groceries',
    stock: 40,
    reorderLevel: 10,
    buyingPrice: 12.00,
    sellingPrice: 24.50,
  },
  {
    id: 'prod-8',
    sku: 'ELEC-ACC-008',
    name: 'USB-C Multi-Port Hub Pro',
    category: 'Electronics',
    stock: 0, // Out of stock to show critical badge and alerts!
    reorderLevel: 5,
    buyingPrice: 28.00,
    sellingPrice: 49.99,
  }
];

const INITIAL_TRANSACTIONS = [
  {
    id: 'tx-1001',
    invoiceNumber: 'INV-2026-0001',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    items: [
      { productId: 'prod-1', name: 'Retina Studio Display Pro', quantity: 1, buyingPrice: 850.00, sellingPrice: 1299.99 },
      { productId: 'prod-6', name: 'Ergonomic Memory Foam Cushion', quantity: 2, buyingPrice: 15.00, sellingPrice: 29.99 }
    ],
    subtotal: 1359.97,
    discount: 50.00,
    tax: 104.80, // ~8% of (subtotal - discount)
    total: 1414.77,
    profit: 469.97, // total selling price (discounted proportioned) minus buying prices
    status: 'completed'
  },
  {
    id: 'tx-1002',
    invoiceNumber: 'INV-2026-0002',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    items: [
      { productId: 'prod-3', name: 'Minimalist Merino Wool Hoodie', quantity: 3, buyingPrice: 45.00, sellingPrice: 89.50 },
      { productId: 'prod-7', name: 'Direct Trade Coffee Beans (1kg)', quantity: 2, buyingPrice: 12.00, sellingPrice: 24.50 }
    ],
    subtotal: 317.50,
    discount: 0,
    tax: 25.40,
    total: 342.90,
    profit: 158.50,
    status: 'completed'
  },
  {
    id: 'tx-1003',
    invoiceNumber: 'INV-2026-0003',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    items: [
      { productId: 'prod-2', name: 'Mechanical Keychron K4 Keyboard', quantity: 2, buyingPrice: 65.00, sellingPrice: 99.00 },
      { productId: 'prod-4', name: 'Smart Vacuum Robot S9', quantity: 1, buyingPrice: 220.00, sellingPrice: 349.99 }
    ],
    subtotal: 547.99,
    discount: 20.00,
    tax: 42.24,
    total: 570.23,
    profit: 157.99,
    status: 'completed'
  },
  {
    id: 'tx-1004',
    invoiceNumber: 'INV-2026-0004',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    items: [
      { productId: 'prod-1', name: 'Retina Studio Display Pro', quantity: 1, buyingPrice: 850.00, sellingPrice: 1299.99 }
    ],
    subtotal: 1299.99,
    discount: 100.00,
    tax: 96.00,
    total: 1295.99,
    profit: 349.99,
    status: 'completed'
  }
];

// Helper to load/save to localStorage
const loadData = (key, fallback) => {
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return fallback;
  }
};

const saveData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

// Database Initializer
export const initializeDB = () => {
  loadData(KEYS.PRODUCTS, INITIAL_PRODUCTS);
  loadData(KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
};

// API Services
export const dbService = {
  // PRODUCTS API
  async getProducts() {
    await sleep();
    return loadData(KEYS.PRODUCTS, INITIAL_PRODUCTS);
  },

  async saveProduct(product) {
    await sleep();
    const products = loadData(KEYS.PRODUCTS, INITIAL_PRODUCTS);
    let savedProduct;

    if (product.id) {
      // Edit
      const index = products.findIndex((p) => p.id === product.id);
      if (index === -1) throw new Error('Product not found');
      savedProduct = { ...products[index], ...product };
      products[index] = savedProduct;
    } else {
      // Create
      savedProduct = {
        ...product,
        id: `prod-${Date.now()}`,
        sku: product.sku || `SKU-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        stock: parseInt(product.stock) || 0,
        reorderLevel: parseInt(product.reorderLevel) || 0,
        buyingPrice: parseFloat(product.buyingPrice) || 0,
        sellingPrice: parseFloat(product.sellingPrice) || 0,
      };
      products.push(savedProduct);
    }

    saveData(KEYS.PRODUCTS, products);
    return savedProduct;
  },

  async deleteProduct(id) {
    await sleep();
    const products = loadData(KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const filtered = products.filter((p) => p.id !== id);
    if (filtered.length === products.length) return false;
    saveData(KEYS.PRODUCTS, filtered);
    return true;
  },

  async restockProduct(id, quantity) {
    await sleep();
    const products = loadData(KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Product not found');
    
    products[index].stock += parseInt(quantity) || 0;
    saveData(KEYS.PRODUCTS, products);
    return products[index];
  },

  // TRANSACTIONS API
  async getTransactions() {
    await sleep();
    return loadData(KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  },

  async createTransaction(cartItems, discount = 0, taxRate = 0.08) {
    await sleep();
    const products = loadData(KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const transactions = loadData(KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);

    // 1. Validate and subtract stock
    const updatedProducts = [...products];
    const itemRecords = [];
    let subtotal = 0;
    let totalCostOfGoods = 0;

    for (const item of cartItems) {
      const pIdx = updatedProducts.findIndex((p) => p.id === item.productId);
      if (pIdx === -1) throw new Error(`Product ${item.name} not found`);
      
      const product = updatedProducts[pIdx];
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name}. Available: ${product.stock}`);
      }

      // Deduct stock
      updatedProducts[pIdx] = {
        ...product,
        stock: product.stock - item.quantity,
      };

      subtotal += product.sellingPrice * item.quantity;
      totalCostOfGoods += product.buyingPrice * item.quantity;

      itemRecords.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        buyingPrice: product.buyingPrice,
        sellingPrice: product.sellingPrice,
      });
    }

    // 2. Calculate dynamic values
    const discValue = parseFloat(discount) || 0;
    const netSubtotal = Math.max(0, subtotal - discValue);
    const taxValue = parseFloat((netSubtotal * taxRate).toFixed(2));
    const totalValue = parseFloat((netSubtotal + taxValue).toFixed(2));
    
    // Profit Calculation = Total Revenue (discounted proportionately) - Total COGS
    // For simplicity, profit is total sales - total buying price - discounts
    const profitValue = parseFloat((netSubtotal - totalCostOfGoods).toFixed(2));

    // Generate Invoice Number
    const nextNum = transactions.length + 1001;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${nextNum}`;

    const newTx = {
      id: `tx-${Date.now()}`,
      invoiceNumber,
      timestamp: new Date().toISOString(),
      items: itemRecords,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: discValue,
      tax: taxValue,
      total: totalValue,
      profit: profitValue,
      status: 'completed',
    };

    transactions.push(newTx);
    
    // Save both transaction and updated product stock levels
    saveData(KEYS.PRODUCTS, updatedProducts);
    saveData(KEYS.TRANSACTIONS, transactions);

    return { transaction: newTx, products: updatedProducts };
  },

  async refundTransaction(id) {
    await sleep();
    const transactions = loadData(KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    const products = loadData(KEYS.PRODUCTS, INITIAL_PRODUCTS);

    const txIndex = transactions.findIndex((t) => t.id === id);
    if (txIndex === -1) throw new Error('Transaction not found');
    
    const tx = transactions[txIndex];
    if (tx.status === 'refunded') throw new Error('Transaction is already refunded');

    // Return items back to stock
    const updatedProducts = [...products];
    for (const item of tx.items) {
      const pIdx = updatedProducts.findIndex((p) => p.id === item.productId);
      if (pIdx !== -1) {
        updatedProducts[pIdx] = {
          ...updatedProducts[pIdx],
          stock: updatedProducts[pIdx].stock + item.quantity,
        };
      }
    }

    // Update transaction status
    transactions[txIndex] = {
      ...tx,
      status: 'refunded',
      profit: parseFloat((-tx.subtotal + tx.discount).toFixed(2)), // refund turns sales into loss equivalent to loss of COGS + selling minus buying
      // Wait, more simply, net transaction profit becomes negative of gross profit since the sale was reversed.
      // Net Profit of transaction is -(sellingPrice - buyingPrice - discount) i.e. we lost the profit opportunity or have a negative revenue.
      // Let's set profit to negative of original profit because we returned the cash, and returned stock, meaning net profit from this is zero, but since we are reversing, the profit change is -tx.profit
      profit: -tx.profit,
    };

    saveData(KEYS.TRANSACTIONS, transactions);
    saveData(KEYS.PRODUCTS, updatedProducts);

    return { transaction: transactions[txIndex], products: updatedProducts };
  },
};
