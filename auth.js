// ============================================
// AUTHENTICATION MANAGEMENT MODULE
// Handles Firebase Auth, page protection,
// and user session management
// ============================================

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authInitialized = false;
        this.init();
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    init() {
        // Listen for auth state changes
        firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;
            this.authInitialized = true;

            if (user) {
                console.log('✓ User authenticated:', user.email);
                this.onUserLoggedIn(user);
            } else {
                console.log('ℹ User not authenticated');
                this.onUserLoggedOut();
            }
        });

        // Setup logout listeners
        this.setupLogoutListeners();
    }

    // ============================================
    // LOGIN/LOGOUT HANDLERS
    // ============================================

    /**
     * Called when user successfully logs in
     */
    onUserLoggedIn(user) {
        // Show dashboard if auth containers exist (index.html)
        const authContainer = document.getElementById('authContainer');
        const dashboardContainer = document.getElementById('dashboardContainer');

        if (authContainer && dashboardContainer) {
            authContainer.classList.add('d-none');
            dashboardContainer.classList.remove('d-none');
            this.loadUserData(user);
        }

        // Check page protection for other pages
        this.checkPageAccess();
    }

    /**
     * Called when user logs out
     */
    onUserLoggedOut() {
        // Get current page
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        // Protected pages - redirect to login
        const protectedPages = ['index.html', 'crops.html', 'expenses.html', ''];
        if (protectedPages.some(page => currentPage.includes(page) || currentPage === '')) {
            console.log('Redirecting to login...');
            window.location.href = 'login.html';
        }

        // Show auth form if on index.html
        const authContainer = document.getElementById('authContainer');
        const dashboardContainer = document.getElementById('dashboardContainer');

        if (authContainer && dashboardContainer) {
            authContainer.classList.remove('d-none');
            dashboardContainer.classList.add('d-none');
        }
    }

    /**
     * Check if current page requires authentication
     */
    checkPageAccess() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const protectedPages = ['index.html', 'crops.html', 'expenses.html', ''];

        // If not authenticated and on protected page, redirect to login
        if (!this.currentUser && protectedPages.some(page => currentPage.includes(page) || currentPage === '')) {
            console.log('Unauthorized access - redirecting to login');
            window.location.href = 'login.html';
        }
    }

    /**
     * Handle logout
     */
    async handleLogout() {
        try {
            console.log('Logging out user...');
            await firebase.auth().signOut();
            console.log('✓ User logged out successfully');
            // Redirect handled by onAuthStateChanged
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out: ' + error.message);
        }
    }

    // ============================================
    // SETUP LISTENERS
    // ============================================

    /**
     * Setup logout button listeners
     */
    setupLogoutListeners() {
        // Wait for elements to be ready
        setTimeout(() => {
            const logoutBtns = document.querySelectorAll('#logoutBtn');
            logoutBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleLogout();
                });
            });
        }, 100);
    }

    // ============================================
    // USER DATA
    // ============================================

    /**
     * Load and display user data
     */
    loadUserData(user) {
        if (!user) return;

        const userGreeting = document.getElementById('userGreeting');
        if (userGreeting) {
            const displayName = user.displayName || user.email;
            userGreeting.textContent = `Welcome back, ${displayName}!`;
        }
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Get current authenticated user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.currentUser !== null;
    }

    /**
     * Get current user ID
     */
    getCurrentUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    }

    /**
     * Get current user email
     */
    getCurrentUserEmail() {
        return this.currentUser ? this.currentUser.email : null;
    }
}

// ============================================
// INITIALIZE AUTH MANAGER
// ============================================
const authManager = new AuthManager();
console.log('✓ Auth manager initialized');
