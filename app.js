// app.js - SkullHunter Invoice Generator (INR formatting + fixes)

// Invoice Data Model
const invoiceData = {
    logo: null,
    business: {
        name: '',
        address: '',
        email: '',
        phone: ''
    },
    client: {
        name: '',
        address: '',
        email: '',
        phone: ''
    },
    invoiceNumber: '',
    invoiceDate: '',
    lineItems: [],
    taxPercentage: 0,
    subtotal: 0,
    taxAmount: 0,
    total: 0
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    addLineItem(); // Add one default line item
});

function initializeApp() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('invoiceDate');
    if (dateEl) {
        dateEl.value = today;
    }
    invoiceData.invoiceDate = today;
    renderInvoicePreview();
}

function setupEventListeners() {
    // Logo upload
    const logoEl = document.getElementById('logoUpload');
    if (logoEl) logoEl.addEventListener('change', handleLogoUpload);

    // Helper binding
    const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', (e) => { fn(e.target.value); renderInvoicePreview(); });
    };

    // Business information
    bind('businessName', v => invoiceData.business.name = v);
    bind('businessAddress', v => invoiceData.business.address = v);
    bind('businessEmail', v => invoiceData.business.email = v);
    bind('businessPhone', v => invoiceData.business.phone = v);

    // Client information
    bind('clientName', v => invoiceData.client.name = v);
    bind('clientAddress', v => invoiceData.client.address = v);
    bind('clientEmail', v => invoiceData.client.email = v);
    bind('clientPhone', v => invoiceData.client.phone = v);

    // Invoice metadata
    bind('invoiceNumber', v => invoiceData.invoiceNumber = v);
    const invDate = document.getElementById('invoiceDate');
    if (invDate) invDate.addEventListener('input', (e) => { invoiceData.invoiceDate = e.target.value; renderInvoicePreview(); });

    // Tax percentage
    const taxEl = document.getElementById('taxPercentage');
    if (taxEl) taxEl.addEventListener('input', (e) => {
        invoiceData.taxPercentage = parseFloat(e.target.value) || 0;
        calculateTotals();
        renderInvoicePreview();
    });

    // Action buttons
    const addBtn = document.getElementById('addItemBtn');
    if (addBtn) addBtn.addEventListener('click', addLineItem);
    const pdfBtn = document.getElementById('downloadPdfBtn');
    if (pdfBtn) pdfBtn.addEventListener('click', generatePDF);
    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', printInvoice);
}

// Logo Upload Handler
function handleLogoUpload(event) {
    const file = event.target.files && event.target.files[0];
    
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a PNG, JPG, or SVG file.');
        event.target.value = '';
        return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
        alert('File size must be less than 5MB.');
        event.target.value = '';
        return;
    }

    // Read and convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
        invoiceData.logo = e.target.result;
        renderInvoicePreview();
    };
    reader.onerror = () => {
        alert('Error reading file. Please try again.');
    };
    reader.readAsDataURL(file);
}

// Line Items Management
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function addLineItem() {
    const id = generateUniqueId();
    const lineItem = {
        id: id,
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0
    };

    invoiceData.lineItems.push(lineItem);
    renderLineItemInputs();
    calculateTotals();
    renderInvoicePreview();
}

function removeLineItem(id) {
    invoiceData.lineItems = invoiceData.lineItems.filter(item => item.id !== id);
    renderLineItemInputs();
    calculateTotals();
    renderInvoicePreview();
}

function updateLineItem(id, field, value) {
    const item = invoiceData.lineItems.find(item => item.id === id);
    if (!item) return;

    if (field === 'quantity' || field === 'rate') {
        item[field] = parseFloat(value) || 0;
        item.amount = calculateLineItemAmount(item);
    } else {
        item[field] = value;
    }

    calculateTotals();
    renderInvoicePreview();
}

function renderLineItemInputs() {
    const container = document.getElementById('lineItemsContainer');
    if (!container) return;
    container.innerHTML = '';

    invoiceData.lineItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'line-item';
        // Keep inline handlers for simplicity (they call global functions)
        itemDiv.innerHTML = `
            <input type="text" placeholder="Description" value="${escapeHtml(item.description)}" 
                   onchange="updateLineItem('${item.id}', 'description', this.value)">
            <div class="line-item-row">
                <input type="number" placeholder="Quantity" value="${item.quantity}" min="0" step="1"
                       onchange="updateLineItem('${item.id}', 'quantity', this.value)">
                <input type="number" placeholder="Rate" value="${item.rate}" min="0" step="0.01"
                       onchange="updateLineItem('${item.id}', 'rate', this.value)">
                <input type="text" placeholder="Amount" value="${formatCurrency(item.amount)}" disabled>
            </div>
            <div class="line-item-actions">
                <button class="btn btn-danger" onclick="removeLineItem('${item.id}')">Remove</button>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}

// Calculation Functions
function calculateLineItemAmount(item) {
    return Math.round(item.quantity * item.rate * 100) / 100;
}

function calculateSubtotal() {
    return invoiceData.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
}

function calculateTax() {
    return Math.round(invoiceData.subtotal * (invoiceData.taxPercentage / 100) * 100) / 100;
}

function calculateTotal() {
    return Math.round((invoiceData.subtotal + invoiceData.taxAmount) * 100) / 100;
}

function calculateTotals() {
    invoiceData.subtotal = calculateSubtotal();
    invoiceData.taxAmount = calculateTax();
    invoiceData.total = calculateTotal();
}

// Formatting Functions
function formatCurrency(amount) {
    // Use Indian formatting and INR currency symbol
    const n = Number(amount) || 0;
    return n.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    // Use a familiar long format; you can change locale if needed
    return date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function escapeHtml(s) {
    return String(s || '').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Invoice Preview Rendering
function renderInvoicePreview() {
    // Logo
    const logoImg = document.getElementById('previewLogo');
    if (logoImg) {
        if (invoiceData.logo) {
            logoImg.src = invoiceData.logo;
            logoImg.style.display = 'block';
        } else {
            logoImg.style.display = 'none';
        }
    }

    // Business information
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text || '';
    };

    setText('previewBusinessName', invoiceData.business.name);
    setText('previewBusinessAddress', invoiceData.business.address);
    setText('previewBusinessEmail', invoiceData.business.email);
    setText('previewBusinessPhone', invoiceData.business.phone);

    // Hide empty business fields
    toggleVisibility('previewBusinessName', invoiceData.business.name);
    toggleVisibility('previewBusinessAddress', invoiceData.business.address);
    toggleVisibility('previewBusinessEmail', invoiceData.business.email);
    toggleVisibility('previewBusinessPhone', invoiceData.business.phone);

    // Client information
    setText('previewClientName', invoiceData.client.name);
    setText('previewClientAddress', invoiceData.client.address);
    setText('previewClientEmail', invoiceData.client.email);
    setText('previewClientPhone', invoiceData.client.phone);

    // Hide empty client fields
    toggleVisibility('previewClientName', invoiceData.client.name);
    toggleVisibility('previewClientAddress', invoiceData.client.address);
    toggleVisibility('previewClientEmail', invoiceData.client.email);
    toggleVisibility('previewClientPhone', invoiceData.client.phone);

    // Invoice metadata
    const invNumEl = document.getElementById('previewInvoiceNumber');
    if (invNumEl) invNumEl.textContent = invoiceData.invoiceNumber || '-';
    const invDateEl = document.getElementById('previewInvoiceDate');
    if (invDateEl) invDateEl.textContent = formatDate(invoiceData.invoiceDate);

    // Line items
    renderLineItemsPreview();

    // Totals
    const subEl = document.getElementById('previewSubtotal');
    if (subEl) subEl.textContent = formatCurrency(invoiceData.subtotal);
    const taxPctEl = document.getElementById('previewTaxPercentage');
    if (taxPctEl) taxPctEl.textContent = (Number(invoiceData.taxPercentage) || 0).toFixed(2);
    const taxAmtEl = document.getElementById('previewTaxAmount');
    if (taxAmtEl) taxAmtEl.textContent = formatCurrency(invoiceData.taxAmount);
    const totEl = document.getElementById('previewTotal');
    if (totEl) totEl.textContent = formatCurrency(invoiceData.total);
}

function renderLineItemsPreview() {
    const tbody = document.getElementById('previewLineItems');
    if (!tbody) return;
    
    if (invoiceData.lineItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No items added yet</td></tr>';
        return;
    }

    tbody.innerHTML = invoiceData.lineItems.map(item => `
        <tr>
            <td>${escapeHtml(item.description || '-')}</td>
            <td>${item.quantity}</td>
            <td style="text-align:right;">${formatCurrency(item.rate)}</td>
            <td style="text-align:right;">${formatCurrency(item.amount)}</td>
        </tr>
    `).join('');
}

function toggleVisibility(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.style.display = value ? 'block' : 'none';
}

// PDF Generation
async function generatePDF() {
    try {
        const { jsPDF } = window.jspdf;
        const invoice = document.getElementById('invoicePreview');
        if (!invoice) { alert('Invoice preview not found'); return; }
        
        // Create canvas from invoice preview
        const canvas = await html2canvas(invoice, {
            scale: 2,
            useCORS: true,
            logging: false
        });

        // Calculate dimensions
        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Create PDF
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        
        // Generate filename (no currency symbol in filename)
        const safeInvoiceNum = String(invoiceData.invoiceNumber || '').replace(/[^\w\-]/g, '');
        const filename = safeInvoiceNum ? `Invoice-${safeInvoiceNum}.pdf` : `Invoice-${Date.now()}.pdf`;
        
        // Download
        pdf.save(filename);
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF. Please try again.');
    }
}

// Print Function
function printInvoice() {
    window.print();
}

// Make functions globally accessible for inline event handlers
window.updateLineItem = updateLineItem;
window.removeLineItem = removeLineItem;
