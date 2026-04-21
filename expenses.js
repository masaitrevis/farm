// ============================================
// EXPENSES MANAGEMENT MODULE
// Handles all expense-related operations:
// - Logging new expenses
// - Deleting expenses
// - Real-time display updates from Firestore
// - Category filtering & breakdown
// - Total expenses calculation
// ============================================

class ExpensesManager {
    constructor() {
        this.expenses = [];                // Array to store all expenses
        this.unsubscribe = null;           // Firestore listener unsubscribe function
        this.filteredTotal = 0;            // Total of filtered expenses
        
        // Category mapping (lowercase key → display name)
        this.categoryMap = {
            'seeds': 'Seeds',
            'labor': 'Labor',
            'fertilizer': 'Fertilizer',
            'pesticide': 'Pesticide',
            'water': 'Water & Irrigation',
            'equipment': 'Equipment',
            'transport': 'Transport',
            'other': 'Other'
        };
        
        this.init();
    }

    // Initialize the expenses manager
    // Waits for user authentication, then sets up form listeners and loads expenses
    init() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // User is logged in - set up the page
                console.log('✓ User authenticated, initializing expenses manager');
                this.setupFormListeners();
                this.loadExpensesRealTime();  // Load with real-time listener
            } else {
                // User logged out - clean up
                if (this.unsubscribe) {
                    this.unsubscribe();    // Stop listening to Firestore changes
                }
            }
        });
    }

    // ============================================
    // FORM SETUP & HANDLING
    // ============================================

    // Setup event listeners for the expense form
    setupFormListeners() {
        // Listen for form submission
        const expenseForm = document.getElementById('expenseForm');
        if (expenseForm) {
            expenseForm.addEventListener('submit', (e) => this.handleAddExpense(e));
        }

        // Listen for category filter changes
        const filterCategory = document.getElementById('filterCategory');
        if (filterCategory) {
            filterCategory.addEventListener('change', () => this.renderExpensesTable());
        }

        // Set today's date as default (better UX)
        const expenseDate = document.getElementById('expenseDate');
        if (expenseDate) {
            const today = new Date().toISOString().split('T')[0];
            expenseDate.value = today;
        }
    }

    // Validate expense data before saving
    validateExpenseData(amount, category, date) {
        // Check if amount is positive
        if (!amount || amount <= 0) {
            this.showNotification('Please enter an amount greater than 0', 'error');
            return false;
        }

        // Check if category is selected
        if (!category || category.trim() === '') {
            this.showNotification('Please select a category', 'error');
            return false;
        }

        // Check if date is selected
        if (!date || date.trim() === '') {
            this.showNotification('Please select a date', 'error');
            return false;
        }

        return true;
    }

    // ============================================
    // FIRESTORE OPERATIONS
    // ============================================

    // Load expenses with real-time listener
    // This will update automatically when data changes in Firestore
    loadExpensesRealTime() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            // Create a real-time listener
            this.unsubscribe = firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .collection('expenses')
                .orderBy('date', 'desc')  // Sort by newest first
                .onSnapshot((snapshot) => {
                    // This callback runs whenever data changes
                    this.expenses = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    console.log(`✓ Loaded ${this.expenses.length} expenses from Firestore`);
                    this.updateTotals();              // Recalculate totals
                    this.updateCategoryBreakdown();   // Update breakdown chart
                    this.renderExpensesTable();       // Update the table display
                }, (error) => {
                    console.error('Error loading expenses:', error);
                    this.showNotification('Error loading expenses: ' + error.message, 'error');
                });
        } catch (error) {
            console.error('Error setting up expenses listener:', error);
        }
    }

    // Handle form submission (add new expense)
    async handleAddExpense(e) {
        e.preventDefault();

        // Get form values
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const date = document.getElementById('expenseDate').value;
        const description = document.getElementById('expenseDescription').value;

        // Validate the data
        if (!this.validateExpenseData(amount, category, date)) {
            return;
        }

        const user = firebase.auth().currentUser;
        if (!user) return;

        // Prepare expense data object
        const expenseData = {
            amount: amount,
            category: category,
            date: date,
            description: description,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        try {
            // Show loading state
            const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

            // Add expense to Firestore
            await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .collection('expenses')
                .add(expenseData);
            
            console.log('✓ Expense added successfully');
            this.showNotification('Expense logged successfully!', 'success');

            // Reset form
            document.getElementById('expenseForm').reset();
            
            // Reset date to today
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('expenseDate').value = today;
            
            // Real-time listener will automatically update the table

        } catch (error) {
            console.error('Error saving expense:', error);
            this.showNotification('Error saving expense: ' + error.message, 'error');
        } finally {
            // Restore button state
            const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> Log Expense';
        }
    }

    // ============================================
    // DELETE OPERATION
    // ============================================

    // Delete an expense from Firestore
    async deleteExpense(expenseId) {
        // Confirm deletion with user
        if (!confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
            return;
        }

        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            console.log('Deleting expense:', expenseId);
            
            await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .collection('expenses')
                .doc(expenseId)
                .delete();

            console.log('✓ Expense deleted successfully');
            this.showNotification('Expense deleted successfully!', 'success');
            // Real-time listener will automatically update the table
        } catch (error) {
            console.error('Error deleting expense:', error);
            this.showNotification('Error deleting expense: ' + error.message, 'error');
        }
    }

    // ============================================
    // CALCULATIONS & TOTALS
    // ============================================

    // Update total amount displays (all expenses + filtered)
    updateTotals() {
        // Calculate total of ALL expenses
        const totalAmount = this.expenses.reduce((sum, expense) => {
            return sum + (parseFloat(expense.amount) || 0);
        }, 0);

        // Update the total amount display
        const totalElement = document.getElementById('totalExpenseAmount');
        if (totalElement) {
            totalElement.textContent = this.formatCurrency(totalAmount);
        }

        // Calculate filtered total (based on current filter)
        const filterValue = document.getElementById('filterCategory')?.value || '';
        if (filterValue) {
            this.filteredTotal = this.expenses
                .filter(e => e.category === filterValue)
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        } else {
            this.filteredTotal = totalAmount;
        }
    }

    // Update category breakdown (pie chart data in sidebar)
    updateCategoryBreakdown() {
        const breakdown = {};
        
        // Calculate total for each category
        this.expenses.forEach(expense => {
            const category = expense.category;
            if (!breakdown[category]) {
                breakdown[category] = 0;
            }
            breakdown[category] += parseFloat(expense.amount) || 0;
        });

        // Update the breakdown display
        const breakdownContainer = document.getElementById('expenseCategoryBreakdown');
        if (breakdownContainer) {
            if (Object.keys(breakdown).length === 0) {
                breakdownContainer.innerHTML = '<p class="text-muted small">No expenses yet</p>';
            } else {
                // Sort by amount (highest first)
                breakdownContainer.innerHTML = Object.entries(breakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => {
                        // Calculate percentage
                        const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
                        const percentage = Math.round((amount / total) * 100);
                        
                        return `
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div>
                                    <span class="text-capitalize" style="font-size: 13px;">${this.categoryMap[category] || category}</span>
                                    <br>
                                    <small class="text-muted">${percentage}%</small>
                                </div>
                                <span class="fw-bold" style="text-align: right;">KSh ${this.formatNumber(amount)}</span>
                            </div>
                        `;
                    })
                    .join('');
            }
        }
    }

    // ============================================
    // TABLE RENDERING
    // ============================================

    // Render the expenses table with filtering and totals
    renderExpensesTable() {
        const tbody = document.getElementById('expensesTableBody');
        const filterValue = document.getElementById('filterCategory')?.value || '';

        // Filter expenses based on selected category
        let filteredExpenses = this.expenses;
        if (filterValue) {
            filteredExpenses = this.expenses.filter(e => e.category === filterValue);
        }

        // Show empty state if no expenses
        if (filteredExpenses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-5">
                        <div class="empty-state">
                            <i class="fas fa-receipt mb-3" style="font-size: 3rem; opacity: 0.2; display: block;"></i>
                            <p>No expenses ${filterValue ? 'in this category' : 'logged yet'}</p>
                            <small>${filterValue ? 'Try a different category or add expenses' : 'Use the form above to log your first expense'}</small>
                        </div>
                    </td>
                </tr>
            `;
            
            // Still show total at bottom
            this.showTableFooter(0, filterValue);
            return;
        }

        // Build table rows for each expense
        tbody.innerHTML = filteredExpenses.map(expense => {
            return `
                <tr>
                    <td class="text-nowrap">${this.formatDate(expense.date)}</td>
                    <td>
                        <span class="badge ${this.getCategoryBadgeClass(expense.category)}">
                            ${this.categoryMap[expense.category] || expense.category}
                        </span>
                    </td>
                    <td>
                        <small>${this.escapeHtml(expense.description || '—')}</small>
                    </td>
                    <td class="fw-bold text-end">KSh ${this.formatNumber(expense.amount)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger" onclick="expensesManager.deleteExpense('${expense.id}')" title="Delete expense">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Show total for filtered expenses at bottom
        this.showTableFooter(filteredExpenses.length, filterValue);
    }

    // Show total row at bottom of table
    showTableFooter(rowCount, filterValue) {
        const tbody = document.getElementById('expensesTableBody');
        
        if (rowCount > 0) {
            // Calculate filtered total
            let total = 0;
            if (filterValue) {
                total = this.expenses
                    .filter(e => e.category === filterValue)
                    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            } else {
                total = this.expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            }

            // Add total row
            const totalRow = document.createElement('tr');
            totalRow.className = 'table-light fw-bold';
            totalRow.innerHTML = `
                <td colspan="3" class="text-end pe-2">
                    ${filterValue ? 'Category Total:' : 'Total Expenses:'}
                </td>
                <td class="text-end">KSh ${this.formatNumber(total)}</td>
                <td></td>
            `;
            tbody.appendChild(totalRow);
        }
    }

    // Get appropriate badge class for category
    getCategoryBadgeClass(category) {
        const categoryClasses = {
            'seeds': 'bg-info',
            'labor': 'bg-primary',
            'fertilizer': 'bg-success',
            'pesticide': 'bg-danger',
            'water': 'bg-warning',
            'equipment': 'bg-secondary',
            'transport': 'bg-dark',
            'other': 'bg-muted'
        };
        return categoryClasses[category] || 'bg-secondary';
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    // Format a date string to readable format
    // Input: "2025-04-15" → Output: "15 Apr 2025"
    formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    // Format a number with commas and no decimals
    // Input: 50000 → Output: "50,000"
    formatNumber(num) {
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    // Format currency with "KSh" prefix
    formatCurrency(amount) {
        return 'KSh ' + this.formatNumber(amount);
    }

    // Escape HTML special characters to prevent XSS attacks
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show a notification to the user
    // Floating toast that auto-dismisses instead of alert boxes
    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
        notification.role = 'alert';
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// ============================================
// INITIALIZE EXPENSES MANAGER
// ============================================
const expensesManager = new ExpensesManager();
console.log('✓ Expenses manager initialized');
