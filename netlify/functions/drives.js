// This is your new serverless backend. It runs on Netlify's servers when deployed.

exports.handler = async function(event, context) {
  // For now, we will return hard-coded sample data.
  // This allows us to build and test our app without database errors.
  const sampleDrives = [
    {
      id: 1,
      organizer_name: 'Korle Bu Teaching Hospital',
      drive_date: '2025-08-20',
      location_name: 'Accra Central',
    },
    {
      id: 2,
      organizer_name: '37 Military Hospital',
      drive_date: '2025-09-05',
      location_name: 'Airport Residential Area',
    },
    {
      id: 3,
      organizer_name: 'Ghana National Blood Service',
      drive_date: '2025-09-15',
      location_name: 'Legon Campus',
    }
  ];

  // This sends the data back to your frontend website.
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sampleDrives),
  };
};
