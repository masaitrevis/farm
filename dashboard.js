// ============================================
// DASHBOARD MANAGEMENT MODULE
// Real-time tracking of:
// - Total expenses from Firestore
// - Expected revenue (user-managed)
// - Automatic profit/loss calculation
// - Recent crops and expenses
// ============================================

class DashboardManager {
    constructor() {
        this.crops = [];
        this.expenses = [];
        this.expectedRevenue = 0;
        this.unsubscribeCrops = null;
        this.unsubscribeExpenses = null;
        this.init();
    }

    // Initialize dashboard
    // Waits for authentication and sets up real-time listeners
    init() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log('✓ User authenticated, initializing dashboard');
                this.setupFormListeners();
                this.loadRevenueData();      // Load saved expected revenue
                this.setupRealTimeListeners(); // Set up real-time listeners for crops & expenses
            }
        });
    }

    // ============================================
    // FORM & UI SETUP
    // ============================================

    setupFormListeners() {
        // Listen for expected revenue form submission
        const revenueForm = document.getElementById('revenueForm');
        if (revenueForm) {
            revenueForm.addEventListener('submit', (e) => this.handleRevenueSubmit(e));
        }

        // Set today's date in input
        const revenueDate = document.getElementById('revenueDate');
        if (revenueDate) {
            const today = new Date().toISOString().split('T')[0];
            revenueDate.value = today;
        }
    }

    // ============================================
    // REAL-TIME LISTENERS
    // ============================================

    // Setup real-time listeners for crops and expenses
    setupRealTimeListeners() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        // Real-time listener for crops
        this.unsubscribeCrops = firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .collection('crops')
            .onSnapshot((snapshot) => {
                this.crops = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log(`✓ Loaded ${this.crops.length} crops (real-time)`);
                this.updateKPIs();
                this.updateRecentItems();
            }, (error) => {
                console.error('Error loading crops:', error);
            });

        // Real-time listener for expenses
        this.unsubscribeExpenses = firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .collection('expenses')
            .onSnapshot((snapshot) => {
                this.expenses = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log(`✓ Loaded ${this.expenses.length} expenses (real-time)`);
                this.updateKPIs();
                this.updateRecentItems();
            }, (error) => {
                console.error('Error loading expenses:', error);
            });
    }

    // ============================================
    // REVENUE MANAGEMENT
    // ============================================

    // Load expected revenue from user document
    async loadRevenueData() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .get();

            if (userDoc.exists) {
                this.expectedRevenue = parseFloat(userDoc.data().expectedRevenue) || 0;
                console.log('✓ Loaded expected revenue:', this.expectedRevenue);
            }

            // Update the form display
            this.updateRevenueDisplay();
            this.updateKPIs(); // Recalculate with loaded revenue
        } catch (error) {
            console.error('Error loading revenue data:', error);
        }
    }

    // Handle expected revenue form submission
    async handleRevenueSubmit(e) {
        e.preventDefault();

        const revenueAmount = parseFloat(document.getElementById('revenueAmount').value);

        if (!revenueAmount || revenueAmount < 0) {
            alert('Please enter a valid revenue amount');
            return;
        }

        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            const submitBtn = document.querySelector('#revenueForm button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

            // Save to user document
            await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .update({
                    expectedRevenue: revenueAmount,
                    revenueUpdatedAt: new Date()
                });

            this.expectedRevenue = revenueAmount;
            console.log('✓ Expected revenue saved:', revenueAmount);
            
            this.updateKPIs(); // Recalculate profit/loss
            this.showNotification('Revenue updated successfully!', 'success');

        } catch (error) {
            console.error('Error saving revenue:', error);
            this.showNotification('Error saving revenue: ' + error.message, 'error');
        } finally {
            const submitBtn = document.querySelector('#revenueForm button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Revenue';
        }
    }

    // Update expected revenue display
    updateRevenueDisplay() {
        const revenueAmount = document.getElementById('revenueAmount');
        if (revenueAmount) {
            revenueAmount.value = this.expectedRevenue;
        }
    }

    // ============================================
    // KPI CALCULATIONS & UPDATES
    // ============================================

    // Calculate and update all KPI metrics
    updateKPIs() {
        // Calculate total expenses
        const totalExpenses = this.expenses.reduce((sum, expense) => {
            return sum + (parseFloat(expense.amount) || 0);
        }, 0);

        // Count active crops (harvest date in future)
        const activeCrops = this.crops.filter(crop => {
            const harvestDate = new Date(crop.harvestDate);
            return harvestDate > new Date();
        }).length;

        // Use user's input for expected revenue
        const expectedRevenue = this.expectedRevenue;

        // Calculate projected profit/loss
        const projectedProfit = expectedRevenue - totalExpenses;

        // Update UI elements
        this.updateKPIElement('totalExpenses', totalExpenses);
        this.updateKPIElement('activeCrops', activeCrops);
        this.updateKPIElement('expectedRevenue', expectedRevenue);
        this.updateProfitLossDisplay(projectedProfit);

        console.log(`Dashboard Update: Expenses=${totalExpenses}, Revenue=${expectedRevenue}, Profit=${projectedProfit}`);
    }

    // Update a KPI element with formatted value
    updateKPIElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            // Format as currency for money values, number for counts
            if (elementId === 'activeCrops') {
                element.textContent = value;
            } else {
                element.textContent = this.formatCurrency(value);
            }
        }
    }

    // Update profit/loss display with color coding
    updateProfitLossDisplay(profit) {
        const profitElement = document.getElementById('projectedProfit');
        const profitCard = document.getElementById('profitCard');

        if (profitElement) {
            profitElement.textContent = this.formatCurrency(profit);

            // Color code: green for profit, red for loss
            if (profit >= 0) {
                profitElement.className = 'text-success';
                if (profitCard) {
                    profitCard.style.borderTop = '4px solid #27ae60';
                }
            } else {
                profitElement.className = 'text-danger';
                if (profitCard) {
                    profitCard.style.borderTop = '4px solid #e74c3c';
                }
            }
        }
    }

    // ============================================
    // RECENT ITEMS DISPLAY
    // ============================================

    // Update recent crops and expenses display
    updateRecentItems() {
        this.updateRecentCrops();
        this.updateRecentExpenses();
    }

    // Display recent crops with harvest countdown
    updateRecentCrops() {
        const recentCropsContainer = document.getElementById('recentCrops');
        if (!recentCropsContainer) return;

        if (this.crops.length === 0) {
            recentCropsContainer.innerHTML = `
                <div class="empty-state">
                    <p class="text-muted small mb-0">
                        <i class="fas fa-leaf opacity-50"></i><br>
                        No crops added yet
                    </p>
                </div>
            `;
            return;
        }

        // Show most recent 3 crops
        const recent = this.crops.slice(-3).reverse();
        recentCropsContainer.innerHTML = recent.map(crop => {
            const harvestDate = new Date(crop.harvestDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysLeft = Math.ceil((harvestDate - today) / (1000 * 60 * 60 * 24));
            
            let statusClass = 'badge-success';
            let statusText = 'Active';
            if (daysLeft < 0) {
                statusClass = 'badge-danger';
                statusText = Math.abs(daysLeft) + ' days late';
            } else if (daysLeft < 7) {
                statusClass = 'badge-warning';
                statusText = daysLeft + ' days left';
            } else {
                statusText = daysLeft + ' days left';
            }
            
            return `
                <div class="d-flex justify-content-between align-items-center mb-3 pb-2" style="border-bottom: 0.5px solid var(--color-border-tertiary);">
                    <div>
                        <p class="mb-0 fw-bold">${this.escapeHtml(crop.cropName)}</p>
                        <small class="text-muted">Planted: ${this.formatDate(crop.plantingDate)}</small>
                    </div>
                    <span class="badge ${statusClass}">${statusText}</span>
                </div>
            `;
        }).join('');
    }

    // Display recent expenses by category
    updateRecentExpenses() {
        const recentExpensesContainer = document.getElementById('recentExpenses');
        if (!recentExpensesContainer) return;

        if (this.expenses.length === 0) {
            recentExpensesContainer.innerHTML = `
                <div class="empty-state">
                    <p class="text-muted small mb-0">
                        <i class="fas fa-receipt opacity-50"></i><br>
                        No expenses logged yet
                    </p>
                </div>
            `;
            return;
        }

        // Category mapping
        const categoryMap = {
            'seeds': 'Seeds',
            'labor': 'Labor',
            'fertilizer': 'Fertilizer',
            'pesticide': 'Pesticide',
            'water': 'Water',
            'equipment': 'Equipment',
            'transport': 'Transport',
            'other': 'Other'
        };

        // Show most recent 3 expenses
        const recent = this.expenses.slice(-3).reverse();
        recentExpensesContainer.innerHTML = recent.map(expense => `
            <div class="d-flex justify-content-between align-items-center mb-3 pb-2" style="border-bottom: 0.5px solid var(--color-border-tertiary);">
                <div>
                    <p class="mb-0 fw-bold text-capitalize">${categoryMap[expense.category] || expense.category}</p>
                    <small class="text-muted">${this.formatDate(expense.date)}</small>
                </div>
                <span class="badge bg-danger">KSh ${this.formatNumber(expense.amount)}</span>
            </div>
        `).join('');
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    // Format number with comma separator
    formatNumber(num) {
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    // Format number as currency with KSh prefix
    formatCurrency(amount) {
        return 'KSh ' + this.formatNumber(amount);
    }

    // Format date string to readable format
    formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show floating notification
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
        notification.role = 'alert';
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// ============================================
// INITIALIZE DASHBOARD
// ============================================
const dashboardManager = new DashboardManager();
console.log('✓ Dashboard manager initialized');
