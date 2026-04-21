// ============================================
// CROPS MANAGEMENT MODULE
// Handles all crop-related operations:
// - Adding new crops
// - Editing existing crops
// - Deleting crops
// - Real-time display updates from Firestore
// ============================================

class CropsManager {
    constructor() {
        this.crops = [];                  // Array to store all crops
        this.editingCropId = null;        // ID of crop being edited (null if adding new)
        this.unsubscribe = null;          // Firestore listener unsubscribe function
        this.init();
    }

    // Initialize the crops manager
    // Waits for user authentication, then sets up form listeners and loads crops
    init() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // User is logged in - set up the page
                console.log('✓ User authenticated, initializing crops manager');
                this.setupFormListeners();
                this.loadCropsRealTime();  // Load crops with real-time listener
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

    // Setup event listeners for the crop form
    setupFormListeners() {
        // Listen for form submission
        const cropForm = document.getElementById('cropForm');
        if (cropForm) {
            cropForm.addEventListener('submit', (e) => this.handleAddCrop(e));
        }

        // Listen for cancel button (when editing)
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelEdit());
        }
    }

    // Validate form data before saving
    validateCropData(cropName, plantingDate, harvestDate) {
        // Check if crop name is empty
        if (!cropName || cropName.trim() === '') {
            this.showNotification('Please enter a crop name', 'error');
            return false;
        }

        // Check if dates are valid
        const plantDate = new Date(plantingDate);
        const harvestDate_obj = new Date(harvestDate);

        if (plantDate >= harvestDate_obj) {
            this.showNotification('Harvest date must be after planting date', 'error');
            return false;
        }

        return true;
    }

    // ============================================
    // FIRESTORE OPERATIONS
    // ============================================

    // Load crops with real-time listener
    // This will update automatically when data changes in Firestore
    loadCropsRealTime() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            // Create a real-time listener
            this.unsubscribe = firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .collection('crops')
                .orderBy('plantingDate', 'desc')  // Sort by newest first
                .onSnapshot((snapshot) => {
                    // This callback runs whenever data changes
                    this.crops = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    console.log(`✓ Loaded ${this.crops.length} crops from Firestore`);
                    this.renderCropsTable();  // Update the table display
                }, (error) => {
                    console.error('Error loading crops:', error);
                    this.showNotification('Error loading crops: ' + error.message, 'error');
                });
        } catch (error) {
            console.error('Error setting up crops listener:', error);
        }
    }

    // Handle form submission (add or update crop)
    async handleAddCrop(e) {
        e.preventDefault();

        // Get form values
        const cropName = document.getElementById('cropName').value;
        const plantingDate = document.getElementById('plantingDate').value;
        const harvestDate = document.getElementById('harvestDate').value;
        const expectedYield = document.getElementById('expectedYield').value;
        const expectedRevenue = document.getElementById('expectedRevenue').value;

        // Validate the data
        if (!this.validateCropData(cropName, plantingDate, harvestDate)) {
            return;
        }

        const user = firebase.auth().currentUser;
        if (!user) return;

        // Prepare crop data object
        const cropData = {
            cropName: cropName,
            plantingDate: plantingDate,
            harvestDate: harvestDate,
            expectedYield: parseFloat(expectedYield) || 0,
            expectedRevenue: parseFloat(expectedRevenue) || 0,
            updatedAt: new Date()
        };

        try {
            // Show loading state
            const submitBtn = document.getElementById('submitBtn');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

            if (this.editingCropId) {
                // Update existing crop
                await firebase.firestore()
                    .collection('users')
                    .doc(user.uid)
                    .collection('crops')
                    .doc(this.editingCropId)
                    .update(cropData);
                
                console.log('✓ Crop updated successfully');
                this.showNotification('Crop updated successfully!', 'success');
                this.cancelEdit();
            } else {
                // Add new crop
                // Also add createdAt timestamp for new crops
                cropData.createdAt = new Date();
                
                await firebase.firestore()
                    .collection('users')
                    .doc(user.uid)
                    .collection('crops')
                    .add(cropData);
                
                console.log('✓ Crop added successfully');
                this.showNotification('Crop added successfully!', 'success');
            }

            // Reset form
            document.getElementById('cropForm').reset();
            // Real-time listener will automatically update the table

        } catch (error) {
            console.error('Error saving crop:', error);
            this.showNotification('Error saving crop: ' + error.message, 'error');
        } finally {
            // Restore button state
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = false;
            submitBtn.innerHTML = this.editingCropId ? 'Update Crop' : 'Add Crop';
        }
    }

    // ============================================
    // EDIT & DELETE OPERATIONS
    // ============================================

    // Load a crop into the form for editing
    editCrop(cropId) {
        // Find the crop in our array
        const crop = this.crops.find(c => c.id === cropId);
        if (!crop) {
            console.error('Crop not found:', cropId);
            return;
        }

        // Set editing mode
        this.editingCropId = cropId;

        // Populate form with crop data
        document.getElementById('cropName').value = crop.cropName;
        document.getElementById('plantingDate').value = crop.plantingDate;
        document.getElementById('harvestDate').value = crop.harvestDate;
        document.getElementById('expectedYield').value = crop.expectedYield || '';
        document.getElementById('expectedRevenue').value = crop.expectedRevenue || '';

        // Update form UI to show editing mode
        document.getElementById('formTitle').textContent = 'Edit Crop';
        document.getElementById('submitBtn').textContent = 'Update Crop';
        document.getElementById('cancelBtn').style.display = 'inline-block';

        // Scroll to form so user can see it
        document.getElementById('cropForm').scrollIntoView({ behavior: 'smooth' });
    }

    // Cancel editing and reset form to "add" mode
    cancelEdit() {
        this.editingCropId = null;
        document.getElementById('cropForm').reset();
        document.getElementById('formTitle').textContent = 'Add New Crop';
        document.getElementById('submitBtn').textContent = 'Add Crop';
        document.getElementById('cancelBtn').style.display = 'none';
    }

    // Delete a crop from Firestore
    async deleteCrop(cropId) {
        // Confirm deletion with user
        if (!confirm('Are you sure you want to delete this crop? This action cannot be undone.')) {
            return;
        }

        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            console.log('Deleting crop:', cropId);
            
            await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .collection('crops')
                .doc(cropId)
                .delete();

            console.log('✓ Crop deleted successfully');
            this.showNotification('Crop deleted successfully!', 'success');
            // Real-time listener will automatically update the table
        } catch (error) {
            console.error('Error deleting crop:', error);
            this.showNotification('Error deleting crop: ' + error.message, 'error');
        }
    }

    // ============================================
    // TABLE RENDERING
    // ============================================

    // Render the crops table with all current crops
    renderCropsTable() {
        const tbody = document.getElementById('cropsTableBody');
        
        // Show empty state if no crops
        if (this.crops.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="fas fa-leaf mb-2" style="font-size: 2rem; display: block; opacity: 0.3;"></i>
                        No crops added yet. Add your first crop above!
                    </td>
                </tr>
            `;
            return;
        }

        // Build table rows for each crop
        tbody.innerHTML = this.crops.map(crop => {
            // Calculate days until harvest
            const harvestDate = new Date(crop.harvestDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);  // Reset time for accurate calculation
            const daysLeft = Math.ceil((harvestDate - today) / (1000 * 60 * 60 * 24));
            
            // Determine status based on days left
            let statusBadge = '';
            let statusClass = '';
            let dayColor = '';
            
            if (daysLeft < 0) {
                statusBadge = 'Overdue';
                statusClass = 'badge-danger';
                dayColor = 'text-danger';
            } else if (daysLeft === 0) {
                statusBadge = 'Ready Today';
                statusClass = 'badge-warning';
                dayColor = 'text-warning';
            } else if (daysLeft < 7) {
                statusBadge = 'Ready Soon';
                statusClass = 'badge-warning';
                dayColor = 'text-warning';
            } else {
                statusBadge = 'Active';
                statusClass = 'badge-success';
                dayColor = 'text-success';
            }

            return `
                <tr>
                    <td class="fw-bold">${this.escapeHtml(crop.cropName)}</td>
                    <td>${this.formatDate(crop.plantingDate)}</td>
                    <td>${this.formatDate(crop.harvestDate)}</td>
                    <td>
                        <span class="${dayColor}">
                            ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}
                        </span>
                    </td>
                    <td>KSh ${this.formatNumber(crop.expectedRevenue || 0)}</td>
                    <td>
                        <span class="badge ${statusClass}">${statusBadge}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="cropsManager.editCrop('${crop.id}')" title="Edit crop">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="cropsManager.deleteCrop('${crop.id}')" title="Delete crop">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
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

    // Escape HTML special characters to prevent XSS attacks
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show a notification to the user
    // Currently using alerts, can be replaced with a toast notification system
    showNotification(message, type) {
        // Create a simple notification
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
// INITIALIZE CROPS MANAGER
// ============================================
const cropsManager = new CropsManager();
console.log('✓ Crops manager initialized');
