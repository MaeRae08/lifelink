// client/script.js

// This global variable will hold the logged-in user's data.
let loggedInUser = null;
let map; // Global variable to hold the map instance
const liveApiUrl = 'https://lifelink-gh-3edbd3f962c8.herokuapp.com'; // Your live backend URL

/**
 * Initializes the Leaflet map and sets the initial view.
 */
function initMap() {
    if (map) {
        map.remove(); // Remove the old map if it exists
    }
    // Initialize the map centered on Accra, Ghana.
    map = L.map('map').setView([5.6037, -0.1870], 12);

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
        menuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('is-open');
        });
    }
}

/**
 * Fetches all drives from the API and renders them on the page.
 * It also conditionally adds Edit/Delete buttons for the drive owner.
 */
async function fetchAndDisplayDrives() {
    const apiUrl = `${liveApiUrl}/api/drives`;
    const drivesGrid = document.getElementById('drives-grid');
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const drives = await response.json();
        drivesGrid.innerHTML = ''; // Clear previous content

        if (!drives || drives.length === 0) {
            drivesGrid.innerHTML = `<p>No upcoming drives have been scheduled yet.</p>`;
            return;
        }

        // Hardcoded coordinates for the map markers.
        const locations = {
            'Tema': [5.6667, 0.0167],
            'Accra Central': [5.5582, -0.2037],
            'Airport Residential Area': [5.6085, -0.1770],
            'Legon Campus': [5.6514, -0.1843],
            // Add more locations here as needed
        };

        for (const drive of drives) {
            const card = document.createElement('div');
            card.className = 'card';
            const eventDate = new Date(drive.drive_date);
            const formattedDate = eventDate.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
            });

            const ownerControls = (loggedInUser && loggedInUser.id === drive.user_id)
                ? `<div class="card-controls">
                     <button class="btn-edit" data-id="${drive.id}" data-organizer="${drive.organizer_name}" data-date="${drive.drive_date.split('T')[0]}" data-location="${drive.location_name}">Edit</button>
                     <button class="btn-delete" data-id="${drive.id}">Delete</button>
                   </div>`
                : '';

            card.innerHTML = `<h4>${drive.organizer_name}</h4><p><strong>Date:</strong> ${formattedDate}</p><p><strong>Location:</strong> ${drive.location_name}</p>${ownerControls}`;
            drivesGrid.appendChild(card);
            
            // Add a marker to the map for this location
            const coords = locations[drive.location_name];
            if (coords) {
                const marker = L.marker(coords).addTo(map);
                marker.bindPopup(`<b>${drive.organizer_name}</b><br>${drive.location_name}<br>Date: ${formattedDate}`);
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
 * Checks for a token in localStorage, fetches the user's data, and updates the UI accordingly.
 */
async function handleAuthState() {
    const token = localStorage.getItem('token');
    const authButton = document.getElementById('auth-button');
    const createDriveSection = document.getElementById('create-drive-section');
    const ctaSection = document.getElementById('cta-section');

    if (token) {
        try {
            const response = await fetch(`${liveApiUrl}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                loggedInUser = await response.json();
            } else {
                localStorage.removeItem('token');
                loggedInUser = null;
            }
        } catch (e) {
            loggedInUser = null;
        }
    }

    if (loggedInUser) {
        // User is logged in
        authButton.textContent = 'Logout';
        authButton.href = '#';
        authButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            loggedInUser = null;
            alert('You have been logged out.');
            window.location.reload();
        });
        if (createDriveSection) createDriveSection.style.display = 'block';
        if (ctaSection) ctaSection.style.display = 'none';
    } else {
        // User is logged out
        authButton.textContent = 'Organizer Login';
        authButton.href = 'login.html';
        if (createDriveSection) createDriveSection.style.display = 'none';
        if (ctaSection) ctaSection.style.display = 'block';
    }
    fetchAndDisplayDrives();
}

/**
 * Adds the event listener for the "Create Drive" form.
 */
function handleCreateDriveForm() {
    const createDriveForm = document.getElementById('create-drive-form');
    if (!createDriveForm) return;

    createDriveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) return alert('You must be logged in.');
        const driveData = {
            organizer_name: document.getElementById('organizer-name').value,
            drive_date: document.getElementById('drive-date').value,
            location_name: document.getElementById('location-name').value,
        };
        try {
            const response = await fetch(`${liveApiUrl}/api/drives`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
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
            alert('An error occurred.');
        }
    });
}

/**
 * Adds event listeners to all "Delete" buttons.
 */
function addDeleteEventListeners() {
    const deleteButtons = document.querySelectorAll('.btn-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const driveId = e.target.dataset.id;
            const token = localStorage.getItem('token');
            if (!confirm('Are you sure you want to delete this drive?')) return;
            try {
                const response = await fetch(`${liveApiUrl}/api/drives/${driveId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await response.json();
                alert(result.message);
                if (response.ok) fetchAndDisplayDrives();
            } catch (error) {
                console.error('Delete error:', error);
                alert('Failed to delete drive.');
            }
        });
    });
}

/**
 * Adds event listeners to all "Edit" buttons and handles the modal logic.
 */
function addEditEventListeners() {
    const modal = document.getElementById('edit-modal');
    const closeBtn = document.querySelector('.close-button');
    const editForm = document.getElementById('edit-drive-form');
    const editButtons = document.querySelectorAll('.btn-edit');

    editButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const driveData = e.target.dataset;
            document.getElementById('edit-drive-id').value = driveData.id;
            document.getElementById('edit-organizer-name').value = driveData.organizer;
            document.getElementById('edit-drive-date').value = driveData.date;
            document.getElementById('edit-location-name').value = driveData.location;
            modal.style.display = 'block';
        });
    });

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        }
    }
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const driveId = document.getElementById('edit-drive-id').value;
            const token = localStorage.getItem('token');
            const updatedData = {
                organizer_name: document.getElementById('edit-organizer-name').value,
                drive_date: document.getElementById('edit-drive-date').value,
                location_name: document.getElementById('edit-location-name').value,
            };

            try {
                const response = await fetch(`${liveApiUrl}/api/drives/${driveId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedData)
                });
                const result = await response.json();
                alert(result.message);
                if (response.ok) {
                    modal.style.display = 'none';
                    fetchAndDisplayDrives();
                }
            } catch (error) {
                console.error('Update error:', error);
                alert('Failed to update drive.');
            }
        });
    }
}

/**
 * Main logic execution block that runs when the page is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname;

    // --- Homepage Logic ---
    if (currentPage.includes('index.html') || currentPage === '/') {
        initMap(); // Initialize the map before fetching drives
        handleAuthState();
        handleCreateDriveForm();
        handleMobileMenu(); // Activate the mobile menu handler
    }

    // --- Login Page Logic ---
    if (currentPage.includes('login.html')) {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                const response = await fetch(`${liveApiUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const result = await response.json();
                if (response.ok) {
                    localStorage.setItem('token', result.token);
                    alert('Login successful!');
                    window.location.href = 'index.html';
                } else {
                    alert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Login fetch error:', error);
                alert('Could not connect to the server.');
            }
        });
    }

    // --- Signup Page Logic ---
    if (currentPage.includes('signup.html')) {
        const signupForm = document.getElementById('signup-form');
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            try {
                const response = await fetch(`${liveApiUrl}/api/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const result = await response.json();
                if (response.ok) {
                    alert(result.message);
                    window.location.href = 'login.html';
                } else {
                    alert(`Error: ${result.message}`);
                }
            } catch (error) {
                console.error('Signup fetch error:', error);
                alert('Could not connect to the server.');
            }
        });
    }
});
