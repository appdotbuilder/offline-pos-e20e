
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { 
  User, 
  Product, 
  Category, 
  Transaction, 
  LoginInput, 
  CreateProductInput, 
  CreateCategoryInput, 
  CreateTransactionInput,
  CreateUserInput,
  LoginResponse 
} from '../../server/src/schema';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  Plus, 
  Minus, 
  Trash2, 
  Edit, 
  AlertTriangle,
  Receipt,
  Download,
  Upload,
  Eye,
  DollarSign,
  TrendingUp,
  ShoppingBag
} from 'lucide-react';

// Create a type for authenticated user (without password_hash)
type AuthenticatedUser = Omit<User, 'password_hash'>;

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

function App() {
  // Authentication state - using AuthenticatedUser type instead of User
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loginForm, setLoginForm] = useState<LoginInput>({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Application state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState('pos');

  // Form states
  const [productForm, setProductForm] = useState<CreateProductInput>({
    name: '',
    description: null,
    category_id: null,
    image_url: null,
    purchase_price: 0,
    selling_price: 0,
    stock_quantity: 0,
    low_stock_threshold: 10,
    is_active: true
  });

  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    name: '',
    description: null
  });

  const [userForm, setUserForm] = useState<CreateUserInput>({
    username: '',
    password: '',
    role: 'cashier'
  });

  // Transaction state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [transactionDiscount, setTransactionDiscount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Settings state
  const [storeName, setStoreName] = useState('My Store');
  const [taxRate, setTaxRate] = useState(0.1);

  // Dialog states
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  // Load initial data
  useEffect(() => {
    loadProducts();
    loadCategories();
    if (user?.role === 'admin') {
      loadUsers();
      loadTransactions();
    }
  }, [user]);

  const loadProducts = async () => {
    try {
      const result = await trpc.getProducts.query();
      setProducts(result);
    } catch (error) {
      console.error('Failed to load products:', error);
      // For demo purposes, add some sample products
      setProducts([
        {
          id: 1,
          name: 'Coffee',
          description: 'Premium coffee beans',
          category_id: 1,
          image_url: null,
          purchase_price: 5.00,
          selling_price: 8.00,
          stock_quantity: 50,
          low_stock_threshold: 10,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 2,
          name: 'Sandwich',
          description: 'Fresh sandwich',
          category_id: 2,
          image_url: null,
          purchase_price: 3.00,
          selling_price: 6.50,
          stock_quantity: 8,
          low_stock_threshold: 10,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    }
  };

  const loadCategories = async () => {
    try {
      const result = await trpc.getCategories.query();
      setCategories(result);
    } catch (error) {
      console.error('Failed to load categories:', error);
      // For demo purposes, add some sample categories
      setCategories([
        { id: 1, name: 'Beverages', description: 'Hot and cold drinks', created_at: new Date() },
        { id: 2, name: 'Food', description: 'Fresh food items', created_at: new Date() }
      ]);
    }
  };

  const loadUsers = async () => {
    try {
      const result = await trpc.getUsers.query();
      setUsers(result);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const result = await trpc.getTransactions.query();
      setTransactions(result);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response: LoginResponse = await trpc.login.mutate(loginForm);
      setUser(response.user); // Now this matches AuthenticatedUser type
      localStorage.setItem('pos_token', response.token);
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pos_token');
    setCart([]);
    setActiveTab('pos');
  };

  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      alert('Product out of stock!');
      return;
    }

    const existingItem = cart.find(item => item.product.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        alert('Not enough stock!');
        return;
      }
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1, discount: 0 }]);
    }
  };

  const updateCartQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.product.id !== productId));
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && quantity > product.stock_quantity) {
      alert('Not enough stock!');
      return;
    }

    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const updateCartDiscount = (productId: number, discount: number) => {
    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, discount: Math.max(0, discount) }
        : item
    ));
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const itemTotal = (item.product.selling_price * item.quantity) - item.discount;
      return sum + Math.max(0, itemTotal);
    }, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    const afterDiscount = subtotal - transactionDiscount;
    return Math.max(0, afterDiscount * taxRate);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    return Math.max(0, subtotal - transactionDiscount + tax);
  };

  const processPayment = async () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }

    if (!user) {
      alert('User not logged in!');
      return;
    }

    setIsLoading(true);
    try {
      const transactionInput: CreateTransactionInput = {
        user_id: user.id,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          discount_amount: item.discount
        })),
        transaction_discount: transactionDiscount,
        payment_method: paymentMethod
      };

      const transaction = await trpc.createTransaction.mutate(transactionInput);
      setLastTransaction(transaction);
      
      // Update local product stock
      setProducts(products.map(product => {
        const cartItem = cart.find(item => item.product.id === product.id);
        if (cartItem) {
          return { ...product, stock_quantity: product.stock_quantity - cartItem.quantity };
        }
        return product;
      }));

      // Clear cart and show receipt
      setCart([]);
      setTransactionDiscount(0);
      setShowReceipt(true);

      // Reload transactions if admin
      if (user.role === 'admin') {
        loadTransactions();
      }
    } catch (error) {
      console.error('Payment failed:', error);
      alert('Payment processing failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || productForm.selling_price <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const newProduct = await trpc.createProduct.mutate(productForm);
      setProducts((prev: Product[]) => [...prev, newProduct]);
      setProductForm({
        name: '',
        description: null,
        category_id: null,
        image_url: null,
        purchase_price: 0,
        selling_price: 0,
        stock_quantity: 0,
        low_stock_threshold: 10,
        is_active: true
      });
      setShowAddProduct(false);
    } catch (error) {
      console.error('Failed to add product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name) {
      alert('Please enter category name');
      return;
    }

    setIsLoading(true);
    try {
      const newCategory = await trpc.createCategory.mutate(categoryForm);
      setCategories((prev: Category[]) => [...prev, newCategory]);
      setCategoryForm({ name: '', description: null });
      setShowAddCategory(false);
    } catch (error) {
      console.error('Failed to add category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username || !userForm.password) {
      alert('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const newUser = await trpc.createUser.mutate(userForm);
      setUsers((prev: User[]) => [...prev, newUser]);
      setUserForm({ username: '', password: '', role: 'cashier' });
      setShowAddUser(false);
    } catch (error) {
      console.error('Failed to add user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const data = await trpc.exportData.query();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const exportTransactionsCSV = () => {
    const csvHeaders = 'Date,Transaction Code,User,Payment Method,Subtotal,Discount,Tax,Total,Status\n';
    const csvData = transactions.map((t: Transaction) => 
      `${t.created_at.toLocaleDateString()},${t.transaction_code},User ${t.user_id},${t.payment_method},${t.subtotal.toFixed(2)},${t.discount_amount.toFixed(2)},${t.tax_amount.toFixed(2)},${t.total_amount.toFixed(2)},${t.status}`
    ).join('\n');
    
    const blob = new Blob([csvHeaders + csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printReceipt = () => {
    if (!lastTransaction) return;

    const receiptContent = `
      <div style="font-family: monospace; width: 300px; margin: 0 auto; padding: 20px;">
        <h2 style="text-align: center; margin-bottom: 20px;">${storeName}</h2>
        <div style="text-align: center; margin-bottom: 20px;">
          <div>Date: ${lastTransaction.created_at.toLocaleDateString()}</div>
          <div>Time: ${lastTransaction.created_at.toLocaleTimeString()}</div>
          <div>Transaction: ${lastTransaction.transaction_code}</div>
          <div>Cashier: ${user?.username}</div>
        </div>
        <hr style="border: 1px dashed #000;">
        ${cart.map((item: CartItem) => `
          <div style="margin: 10px 0;">
            <div style="display: flex; justify-content: space-between;">
              <span>${item.product.name}</span>
              <span>$${item.product.selling_price.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px;">
              <span>Qty: ${item.quantity}</span>
              <span>$${(item.product.selling_price * item.quantity).toFixed(2)}</span>
            </div>
            ${item.discount > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 12px; color: red;">
              <span>Discount</span>
              <span>-$${item.discount.toFixed(2)}</span>
            </div>` : ''}
          </div>
        `).join('')}
        <hr style="border: 1px dashed #000;">
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span>Subtotal:</span>
          <span>$${calculateSubtotal().toFixed(2)}</span>
        </div>
        ${transactionDiscount > 0 ? `<div style="display: flex; justify-content: space-between; margin: 5px 0; color: red;">
          <span>Transaction Discount:</span>
          <span>-$${transactionDiscount.toFixed(2)}</span>
        </div>` : ''}
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span>Tax (${(taxRate * 100).toFixed(1)}%):</span>
          <span>$${calculateTax().toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 10px 0; font-weight: bold; font-size: 16px;">
          <span>Total:</span>
          <span>$${calculateTotal().toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span>Payment Method:</span>
          <span>${paymentMethod.toUpperCase()}</span>
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 12px;">
          Thank you for your business!
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${lastTransaction.transaction_code}</title>
            <style>
              body { margin: 0; padding: 0; }
              @media print {
                body { -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            ${receiptContent}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 100);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const filteredProducts = selectedCategory 
    ? products.filter((p: Product) => p.category_id === selectedCategory && p.is_active)
    : products.filter((p: Product) => p.is_active);

  const lowStockProducts = products.filter((p: Product) => p.stock_quantity <= p.low_stock_threshold);

  const getDailySales = () => {
    const today = new Date().toDateString();
    return transactions
      .filter((t: Transaction) => t.created_at.toDateString() === today && t.status === 'completed')
      .reduce((sum: number, t: Transaction) => sum + t.total_amount, 0);
  };

  const getMonthlySales = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return transactions
      .filter((t: Transaction) => {
        const date = new Date(t.created_at);
        return date.getMonth() === currentMonth && 
               date.getFullYear() === currentYear && 
               t.status === 'completed';
      })
      .reduce((sum: number, t: Transaction) => sum + t.total_amount, 0);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-blue-600">🏪 POS System</CardTitle>
            <p className="text-gray-600">Please sign in to continue</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Username"
                  value={loginForm.username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLoginForm((prev: LoginInput) => ({ ...prev, username: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLoginForm((prev: LoginInput) => ({ ...prev, password: e.target.value }))
                  }
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-sm mb-2">Demo Credentials:</h3>
              <p className="text-xs text-gray-600">
                Admin: admin / admin<br/>
                Cashier: cashier / cashier
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-blue-600">🏪 {storeName}</h1>
            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
              {user.role.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {user.username}</span>
            <Button variant="outline" onClick={handleLogout} size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-white shadow-sm h-screen sticky top-0">
          <div className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-1 gap-1">
                <TabsTrigger value="pos" className="justify-start">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Point of Sale
                </TabsTrigger>
                {user.role === 'admin' && (
                  <>
                    <TabsTrigger value="products" className="justify-start">
                      <Package className="h-4 w-4 mr-2" />
                      Products
                    </TabsTrigger>
                    <TabsTrigger value="users" className="justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      Users
                    </TabsTrigger>
                    <TabsTrigger value="reports" className="justify-start">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Reports
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </Tabs>

            {/* Quick Stats */}
            <div className="mt-6 space-y-3">
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm">Today's Sales</span>
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    ${getDailySales().toFixed(2)}
                  </span>
                </div>
              </Card>
              
              {lowStockProducts.length > 0 && (
                <Card className="p-3 border-orange-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-orange-600 mr-2" />
                      <span className="text-sm">Low Stock</span>
                    </div>
                    <Badge variant="secondary" className="text-orange-600">
                      {lowStockProducts.length}
                    </Badge>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <Tabs value={activeTab} className="w-full">
            {/* Point of Sale */}
            <TabsContent value="pos" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Product Selection */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Products</CardTitle>
                        <div className="flex items-center space-x-2">
                          <Select value={selectedCategory?.toString() || 'all'} onValueChange={(value) => setSelectedCategory(value === 'all' ? null : parseInt(value))}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {categories.map((category: Category) => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredProducts.map((product: Product) => (
                          <Card
                            key={product.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              product.stock_quantity <= 0 ? 'opacity-50' : ''
                            } ${product.stock_quantity <= product.low_stock_threshold ? 'border-orange-200' : ''}`}
                            onClick={() => addToCart(product)}
                          >
                            <CardContent className="p-4">
                              <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                                {product.image_url ? (
                                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                                ) : (
                                  <Package className="h-8 w-8 text-gray-400" />
                                )}
                              </div>
                              <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                              <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-green-600">
                                  ${product.selling_price.toFixed(2)}
                                </span>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500">Stock: {product.stock_quantity}</div>
                                  {product.stock_quantity <= product.low_stock_threshold && product.stock_quantity > 0 && (
                                    <Badge variant="secondary" className="text-orange-600 text-xs">Low</Badge>
                                  )}
                                  {product.stock_quantity <= 0 && (
                                    <Badge variant="destructive" className="text-xs">Out</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Shopping Cart */}
                <div>
                  <Card className="sticky top-6">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Cart ({cart.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {cart.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Cart is empty</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {cart.map((item: CartItem) => (
                            <div key={item.product.id} className="border rounded-lg p-3">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-sm">{item.product.name}</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFromCart(item.product.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                                <span className="text-sm font-semibold">
                                  ${(item.product.selling_price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Item Discount:</span>
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.product.selling_price * item.quantity}
                                  step="0.01"
                                  value={item.discount}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateCartDiscount(item.product.id, parseFloat(e.target.value) || 0)
                                  }
                                  className="h-6 w-16 text-xs"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {cart.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          
                          {/* Transaction Controls */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Transaction Discount:</span>
                              <Input
                                type="number"
                                min="0"
                                max={calculateSubtotal()}
                                step="0.01"
                                value={transactionDiscount}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setTransactionDiscount(parseFloat(e.target.value) || 0)
                                }
                                className="h-8 w-20 text-sm"
                              />
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium mb-2 block">Payment Method:</label>
                              <Select value={paymentMethod} onValueChange={(value: 'cash' | 'card' | 'mobile') => setPaymentMethod(value)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">💵 Cash</SelectItem>
                                  <SelectItem value="card">💳 Card</SelectItem>
                                  <SelectItem value="mobile">📱 Mobile</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Separator className="my-4" />
                          
                          {/* Totals */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Subtotal:</span>
                              <span>${calculateSubtotal().toFixed(2)}</span>
                            </div>
                            {transactionDiscount > 0 && (
                              <div className="flex justify-between text-sm text-red-600">
                                <span>Transaction Discount:</span>
                                <span>-${transactionDiscount.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span>Tax ({(taxRate * 100).toFixed(1)}%):</span>
                              <span>${calculateTax().toFixed(2)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-lg font-bold">
                              <span>Total:</span>
                              <span className="text-green-600">${calculateTotal().toFixed(2)}</span>
                            </div>
                          </div>

                          <Button
                            onClick={processPayment}
                            disabled={isLoading}
                            className="w-full mt-4"
                            size="lg"
                          >
                            {isLoading ? 'Processing...' : `Process Payment (${paymentMethod.toUpperCase()})`}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Products Management */}
            {user.role === 'admin' && (
              <TabsContent value="products" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Product Management</h2>
                  <div className="flex space-x-2">
                    <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Category
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Category</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddCategory} className="space-y-4">
                          <Input
                            placeholder="Category name"
                            value={categoryForm.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCategoryForm((prev: CreateCategoryInput) => ({ ...prev, name: e.target.value }))
                            }
                            required
                          />
                          <Textarea
                            placeholder="Description (optional)"
                            value={categoryForm.description || ''}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              setCategoryForm((prev: CreateCategoryInput) => ({ ...prev, description: e.target.value || null }))
                            }
                          />
                          <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Adding...' : 'Add Category'}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Product
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Add New Product</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddProduct} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <Input
                              placeholder="Product name"
                              value={productForm.name}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setProductForm((prev: CreateProductInput) => ({ ...prev, name: e.target.value }))
                              }
                              required
                            />
                            <Select 
                              value={productForm.category_id?.toString() || 'none'} 
                              onValueChange={(value) => setProductForm((prev: CreateProductInput) => ({ ...prev, category_id: value === 'none' ? null : parseInt(value) }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Category</SelectItem>
                                {categories.length > 0 ? (
                                  categories.map((category: Category) => (
                                    <SelectItem key={category.id} value={category.id.toString()}>
                                      {category.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <Textarea
                            placeholder="Description (optional)"
                            value={productForm.description || ''}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              setProductForm((prev: CreateProductInput) => ({ ...prev, description: e.target.value || null }))
                            }
                          />
                          
                          <Input
                            placeholder="Image URL (optional)"
                            value={productForm.image_url || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setProductForm((prev: CreateProductInput) => ({ ...prev, image_url: e.target.value || null }))
                            }
                          />
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium mb-1 block">Purchase Price</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={productForm.purchase_price}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setProductForm((prev: CreateProductInput) => ({ ...prev, purchase_price: parseFloat(e.target.value) || 0 }))
                                }
                                required
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">Selling Price</label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={productForm.selling_price}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setProductForm((prev: CreateProductInput) => ({ ...prev, selling_price: parseFloat(e.target.value) || 0 }))
                                }
                                required
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium mb-1 block">Stock Quantity</label>
                              <Input
                                type="number"
                                min="0"
                                value={productForm.stock_quantity}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setProductForm((prev: CreateProductInput) => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))
                                }
                                required
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1 block">Low Stock Threshold</label>
                              <Input
                                type="number"
                                min="0"
                                value={productForm.low_stock_threshold}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setProductForm((prev: CreateProductInput) => ({ ...prev, low_stock_threshold: parseInt(e.target.value) || 0 }))         
                                }
                                required
                              />
                            </div>
                          </div>
                          
                          <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Adding...' : 'Add Product'}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Low Stock Alert */}
                {lowStockProducts.length > 0 && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <strong>{lowStockProducts.length} product(s)</strong> are running low on stock: {' '}
                      {lowStockProducts.map((p: Product) => p.name).join(', ')}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Products Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>All Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Purchase Price</TableHead>
                          <TableHead>Selling Price</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product: Product) => {
                          const category = categories.find((c: Category) => c.id === product.category_id);
                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell>{category?.name || 'No Category'}</TableCell>
                              <TableCell>${product.purchase_price.toFixed(2)}</TableCell>
                              <TableCell>${product.selling_price.toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <span>{product.stock_quantity}</span>
                                  {product.stock_quantity <= product.low_stock_threshold && (
                                    <Badge variant="secondary" className="text-orange-600">Low</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                  {product.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button variant="outline" size="sm">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Users Management */}
            {user.role === 'admin' && (
              <TabsContent value="users" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">User Management</h2>
                  <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddUser} className="space-y-4">
                        <Input
                          placeholder="Username"
                          value={userForm.username}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setUserForm((prev: CreateUserInput) => ({ ...prev, username: e.target.value }))
                          }
                          required
                        />
                        <Input
                          type="password"
                          placeholder="Password"
                          value={userForm.password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setUserForm((prev: CreateUserInput) => ({ ...prev, password: e.target.value }))
                          }
                          required
                        />
                        <Select value={userForm.role} onValueChange={(value: 'admin' | 'cashier') => setUserForm((prev: CreateUserInput) => ({ ...prev, role: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="cashier">Cashier</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? 'Adding...' : 'Add User'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>All Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u: User) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.username}</TableCell>
                            <TableCell>
                              <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                                {u.role.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>{u.created_at.toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm">
                                  <Edit className="h-3 w-3" />
                                </Button>
                                {u.id !== user.id && (
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Reports */}
            {user.role === 'admin' && (
              <TabsContent value="reports" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Sales Reports</h2>
                  <Button onClick={exportTransactionsCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Today's Sales</p>
                          <p className="text-2xl font-bold text-green-600">${getDailySales().toFixed(2)}</p>
                        </div>
                        <DollarSign className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Monthly Sales</p>
                          <p className="text-2xl font-bold text-blue-600">${getMonthlySales().toFixed(2)}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total Products</p>
                          <p className="text-2xl font-bold text-purple-600">{products.length}</p>
                        </div>
                        <Package className="h-8 w-8 text-purple-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total Transactions</p>
                          <p className="text-2xl font-bold text-orange-600">{transactions.length}</p>
                        </div>
                        <ShoppingBag className="h-8 w-8 text-orange-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Transactions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transaction Code</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Payment Method</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.slice(0, 10).map((transaction: Transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">{transaction.transaction_code}</TableCell>
                            <TableCell>{transaction.created_at.toLocaleDateString()}</TableCell>
                            <TableCell>User {transaction.user_id}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {transaction.payment_method.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>${transaction.total_amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={
                                transaction.status === 'completed' ? 'default' :
                                transaction.status === 'cancelled' ? 'destructive' : 'secondary'
                              }>
                                {transaction.status.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Settings */}
            {user.role === 'admin' && (
              <TabsContent value="settings" className="space-y-6">
                <h2 className="text-2xl font-bold">Settings</h2>

                {/* Store Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Store Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Store Name</label>
                      <Input
                        value={storeName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStoreName(e.target.value)}
                        placeholder="Enter store name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Tax Rate (%)</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={taxRate * 100}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaxRate((parseFloat(e.target.value) || 0) / 100)}
                        placeholder="Enter tax rate"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Data Management */}
                <Card>
                  <CardHeader>
                    <CardTitle>Data Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex space-x-4">
                      <Button onClick={exportData}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Backup
                      </Button>
                      <Button variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Import Backup
                      </Button>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold text-red-600 mb-2">Danger Zone</h4>
                      <Button variant="destructive" onClick={() => {
                        if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
                          // Reset data logic here
                          setProducts([]);
                          setCategories([]);
                          setTransactions([]);
                          alert('All data has been reset.');
                        }
                      }}>
                        Reset All Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Transaction Complete</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div className="text-6xl">✅</div>
            <div>
              <p className="font-semibold">Transaction: {lastTransaction?.transaction_code}</p>
              <p className="text-2xl font-bold text-green-600">${calculateTotal().toFixed(2)}</p>
              <p className="text-sm text-gray-600">Payment Method: {paymentMethod.toUpperCase()}</p>
            </div>
            <div className="flex space-x-2 justify-center">
              <Button onClick={printReceipt}>
                <Receipt className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
              <Button variant="outline" onClick={() => setShowReceipt(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
