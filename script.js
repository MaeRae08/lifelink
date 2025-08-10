// This script is now built exclusively for the Netlify backend.
document.addEventListener('DOMContentLoaded', () => {
  const currentPage = window.location.pathname;

  // --- Homepage Logic ---
  if (currentPage.includes('index.html') || currentPage === '/') {
    const drivesGrid = document.getElementById('drives-grid');
    const authButton = document.getElementById('auth-button');

    async function fetchAndDisplayDrives() {
      // This special URL points to the backend function we created.
      const apiUrl = '/.netlify/functions/drives';
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const drives = await response.json();

        if (drives.length === 0) {
          drivesGrid.innerHTML = `<p>No upcoming drives found.</p>`;
          return;
        }
        drivesGrid.innerHTML = '';
        for (const drive of drives) {
          const card = document.createElement('div');
          card.className = 'card';
          const eventDate = new Date(drive.drive_date);
          const formattedDate = eventDate.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
          });
          card.innerHTML = `<h4>${drive.organizer_name}</h4><p><strong>Date:</strong> ${formattedDate}</p><p><strong>Location:</strong> ${drive.location_name}</p>`;
          drivesGrid.appendChild(card);
        }
      } catch (error) {
        console.error('Error fetching drives:', error);
        drivesGrid.innerHTML = `<p style="color: red;">Error: Could not connect to the backend. Make sure you are running 'netlify dev'.</p>`;
      }
    }

    // For now, the login button will just be a link. We will add auth later.
    authButton.href = 'login.html';
    
    fetchAndDisplayDrives();
  }

  // --- Login & Signup Page Logic (Placeholder for now) ---
  if (currentPage.includes('login.html')) {
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Login functionality with Netlify will be built next!');
    });
  }
  if (currentPage.includes('signup.html')) {
    const signupForm = document.getElementById('signup-form');
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Signup functionality with Netlify will be built next!');
    });
  }
});
