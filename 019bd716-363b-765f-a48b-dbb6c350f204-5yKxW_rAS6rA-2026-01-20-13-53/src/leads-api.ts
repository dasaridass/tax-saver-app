/**
 * Sends user email and tax savings data to Google Sheets via Apps Script.
 * Uses 'no-cors' mode to bypass Google's strict browser restrictions.
 */
export const saveLeadToSheet = async (email: string, country: string, savings: string) => {
  const WEBHOOK_URL = process.env.EXPO_PUBLIC_LEADS_WEBHOOK_URL;

  if (!WEBHOOK_URL) {
    console.warn("Google Sheet Webhook URL is not set in .env!");
    return;
  }

  try {
    // We use 'no-cors' mode. This means:
    // 1. The browser allows the request to send data.
    // 2. We CANNOT read the response (it will be "opaque").
    // 3. We assume it worked and don't block the user.
    await fetch(WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors", // <--- CRITICAL FIX
      headers: {
        "Content-Type": "text/plain", // <--- CRITICAL FIX
      },
      body: JSON.stringify({
        email: email,
        country: country,
        estimatedSavings: savings,
        currency: country === 'India' ? '₹' : '$',
        date: new Date().toISOString()
      }),
    });
    
    console.log("Lead sent to Google Sheet (No-CORS mode)");
  } catch (error) {
    // Even with no-cors, network errors (like offline) can still be caught here
    console.error("Error saving lead:", error);
  }
};