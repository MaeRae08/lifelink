// client/script.js

let loggedInUser = null;
let map;
let mapMarkers = [];

const apiUrl = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://lifelink-gh-3edbd3f962c8.herokuapp.com';

/**
 * Initializes the Leaflet map.
 */
function initMap() {
    if (map) map.remove();
    map = L.map('map').setView([7.9465, -1.0232], 7); // Center on Ghana
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

/**
 * Toggles the mobile navigation menu.
 */
function handleMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => mainNav.classList.toggle('is-open'));
    }
}

/**
 * NEW: Fetches locations from the API and populates the dropdowns.
 */
async function populateLocationsDropdowns() {
    try {
        const response = await fetch(`${apiUrl}/api/locations`);
        if (!response.ok) throw new Error('Failed to fetch locations');
        const locations = await response.json();

        const createSelect = document.getElementById('location-id');
        const editSelect = document.getElementById('edit-location-id');

        // Clear existing options except for the placeholder
        createSelect.innerHTML = '<option value="" disabled selected>Select a location...</option>';
        editSelect.innerHTML = ''; // Edit modal doesn't need a placeholder

        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = location.name;
            createSelect.appendChild(option.cloneNode(true));
            editSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error populating locations:', error);
    }
}

/**
 * Fetches all drives and renders them.
 */
async function fetchAndDisplayDrives() {
    const drivesGrid = document.getElementById('drives-grid');
    try {
        const response = await fetch(`${apiUrl}/api/drives`);
        if (!response.ok) throw new Error('Failed to fetch drives');
        const drives = await response.json();
        
        drivesGrid.innerHTML = ''; 
        mapMarkers.forEach(marker => marker.remove());
        mapMarkers = [];

        if (!drives || drives.length === 0) {
            drivesGrid.innerHTML = `<p>No upcoming drives have been scheduled yet.</p>`;
            return;
        }

        for (const drive of drives) {
            const card = document.createElement('div');
            card.className = 'card';
            const eventDate = new Date(drive.drive_date);
            const formattedDate = eventDate.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
            });

            // Note: The drive object now contains location_id, which we need for editing.
            const ownerControls = (loggedInUser && loggedInUser.id === drive.user_id)
                ? `<div class="card-controls">
                     <button class="btn-edit" data-id="${drive.id}" data-organizer="${drive.organizer_name}" data-date="${drive.drive_date.split('T')[0]}" data-locationid="${drive.location_id}">Edit</button>
                     <button class="btn-delete" data-id="${drive.id}">Delete</button>
                   </div>`
                : '';

            card.innerHTML = `<h4>${drive.organizer_name}</h4><p><strong>Date:</strong> ${formattedDate}</p><p><strong>Location:</strong> ${drive.location_name}</p>${ownerControls}`;
            drivesGrid.appendChild(card);
            
            if (drive.latitude && drive.longitude) {
                const coords = [drive.latitude, drive.longitude];
                const marker = L.marker(coords).addTo(map);
                marker.bindPopup(`<b>${drive.organizer_name}</b><br>${drive.location_name}<br>Date: ${formattedDate}`);
                mapMarkers.push(marker);
            }
        }
        addDeleteEventListeners();
        addEditEventListeners();
    } catch (error) {
        console.error('Error fetching drives:', error);
        drivesGrid.innerHTML = `<p style="color: red;">Error: Could not connect to the backend.</p>`;
    }
}

/**
 * Handles user authentication state.
 */
async function handleAuthState() {
    const token = localStorage.getItem('token');
    const authButton = document.getElementById('auth-button');
    const createDriveSection = document.getElementById('create-drive-section');
    const ctaSection = document.getElementById('cta-section');

    if (token) {
        try {
            const response = await fetch(`${apiUrl}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) loggedInUser = await response.json();
            else { localStorage.removeItem('token'); loggedInUser = null; }
        } catch (e) { loggedInUser = null; }
    }

    if (loggedInUser) {
        authButton.textContent = 'Logout';
        authButton.href = '#';
        authButton.onclick = (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            window.location.reload();
        };
        if (createDriveSection) createDriveSection.style.display = 'block';
        if (ctaSection) ctaSection.style.display = 'none';
    } else {
        authButton.textContent = 'Organizer Login';
        authButton.href = 'login.html';
        if (createDriveSection) createDriveSection.style.display = 'none';
        if (ctaSection) ctaSection.style.display = 'block';
    }
    fetchAndDisplayDrives();
}

/**
 * Handles the "Create Drive" form submission.
 */
function handleCreateDriveForm() {
    const createDriveForm = document.getElementById('create-drive-form');
    if (!createDriveForm) return;

    createDriveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) return;

        // UPDATED: Get value from the dropdown
        const driveData = {
            organizer_name: document.getElementById('organizer-name').value,
            drive_date: document.getElementById('drive-date').value,
            location_id: document.getElementById('location-id').value,
        };

        try {
            const response = await fetch(`${apiUrl}/api/drives`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(driveData),
            });
            const result = await response.json();
            alert(result.message);
            if (response.ok) {
                createDriveForm.reset();
                fetchAndDisplayDrives();
            }
        } catch (error) {
            console.error('Create drive error:', error);
        }
    });
}

/**
 * Adds event listeners for delete buttons.
 */
function addDeleteEventListeners() {
    document.querySelectorAll('.btn-delete').forEach(button => {
        button.onclick = async (e) => {
            const driveId = e.target.dataset.id;
            const token = localStorage.getItem('token');
            if (!confirm('Are you sure?')) return;
            try {
                const response = await fetch(`${apiUrl}/api/drives/${driveId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) fetchAndDisplayDrives();
            } catch (error) { console.error('Delete error:', error); }
        };
    });
}

/**
 * Adds event listeners for edit buttons and handles the modal.
 */
function addEditEventListeners() {
    const modal = document.getElementById('edit-modal');
    const closeBtn = document.querySelector('.close-button');
    const editForm = document.getElementById('edit-drive-form');

    document.querySelectorAll('.btn-edit').forEach(button => {
        button.onclick = (e) => {
            const { id, organizer, date, locationid } = e.target.dataset;
            document.getElementById('edit-drive-id').value = id;
            document.getElementById('edit-organizer-name').value = organizer;
            document.getElementById('edit-drive-date').value = date;
            // UPDATED: Set the selected value for the dropdown
            document.getElementById('edit-location-id').value = locationid;
            modal.style.display = 'block';
        };
    });

    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => { if (event.target == modal) modal.style.display = 'none'; };

    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const driveId = document.getElementById('edit-drive-id').value;
            const token = localStorage.getItem('token');
            // UPDATED: Get value from the dropdown
            const updatedData = {
                organizer_name: document.getElementById('edit-organizer-name').value,
                drive_date: document.getElementById('edit-drive-date').value,
                location_id: document.getElementById('edit-location-id').value,
            };

            try {
                const response = await fetch(`${apiUrl}/api/drives/${driveId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(updatedData)
                });
                if (response.ok) {
                    modal.style.display = 'none';
                    fetchAndDisplayDrives();
                }
            } catch (error) { console.error('Update error:', error); }
        };
    }
}

/**
 * Main logic execution block.
 */
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname;

    if (currentPage.includes('index.html') || currentPage === '/') {
        initMap();
        populateLocationsDropdowns(); // Load locations into dropdowns
        handleAuthState();
        handleCreateDriveForm();
        handleMobileMenu();
    }

    if (currentPage.includes('login.html')) {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                const response = await fetch(`${apiUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const result = await response.json();
                if (response.ok) {
                    localStorage.setItem('token', result.token);
                    window.location.href = 'index.html';
                } else { alert(`Error: ${result.message}`); }
            } catch (error) { console.error('Login fetch error:', error); }
        });
    }

    if (currentPage.includes('signup.html')) {
        const signupForm = document.getElementById('signup-form');
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            try {
                const response = await fetch(`${apiUrl}/api/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const result = await response.json();
                if (response.ok) {
                    window.location.href = 'login.html';
                } else { alert(`Error: ${result.message}`); }
            } catch (error) { console.error('Signup fetch error:', error); }
        });
    }
});
