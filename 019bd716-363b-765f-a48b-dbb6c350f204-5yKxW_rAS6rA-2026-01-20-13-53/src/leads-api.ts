/**
 * Sends user email and tax savings data to Google Sheets via Apps Script.
 */
export const saveLeadToSheet = async (email: string, country: string, savings: string) => {
  // Get the URL from our environment variables
  const WEBHOOK_URL = process.env.EXPO_PUBLIC_LEADS_WEBHOOK_URL;

  if (!WEBHOOK_URL) {
    console.warn("Google Sheet Webhook URL is not set in .env!");
    return;
  }

  try {
    // Fire and forget - send data to Google Script
    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        email: email,
        country: country,
        estimatedSavings: savings,
        currency: country === 'India' ? '₹' : '$',
        date: new Date().toISOString()
      }),
    });
    console.log("Lead sent to Google Sheet");
  } catch (error) {
    console.error("Error saving lead:", error);
  }
};