# TaxSaver AI

Privacy-first AI tax optimizer for India and US users with **GPT-4o Vision** for document scanning. Scan your tax documents with your camera and discover savings opportunities in 30 seconds.

## Key Features

### 1. Mobile-First Image Scanning (NEW)
- **Camera/Photo Library**: Snap a photo or select from gallery
- **Web File Upload**: Upload PNG, JPG, or WebP images
- **GPT-4o Vision**: AI analyzes document images directly
- **Privacy Tip**: Cover your name/PAN with thumb before scanning - AI only reads numbers

### 2. Dynamic Tax Rules (No Redeployment Needed)
Tax rules are fetched live from GitHub Gists on app load:
- **India**: `India_Tax_Slabs_FY24-25.txt`
- **US**: `US_Tax_Rules_2025.txt`

Update the Gist files anytime and the app automatically uses the latest rules!

### 3. Dual Mode Support
- **India Mode**: Scan Form 16 or Salary Slip for FY 2024-25 analysis
  - Old vs New Regime comparison
  - 80C, 80D, HRA deduction analysis
- **US Mode**: Scan Paystub for 2024 tax optimization
  - **Smart Pay Frequency Detection** from hours worked (Weekly/Bi-Weekly/Monthly)
  - 401(k) contribution gap analysis
  - HSA opportunity detection
  - W-4 withholding check

### 4. Privacy-First Design (Critical)
- **AI extracts ONLY financial numbers** - never names, addresses, or IDs
- System prompt explicitly instructs AI to ignore all PII
- Privacy tip encourages covering sensitive data before scanning
- Raw personal data NEVER leaves your device

### 5. AI-Powered Savings Analysis
For US paystubs, the AI calculates real tax savings:
- **401(k) Savings**: Gap to $23,000 max × marginal tax rate
- **HSA Savings**: $4,150 × marginal tax rate (if no HSA detected)
- **Roth IRA**: $7,000 investment opportunity (for income < $161k)
- Shows specific dollar amounts: "Increase 401(k) by $1,796/month to save $5,171/year"
- **Post-processing**: App ensures all 3 deductions (401k, HSA, Roth IRA) are always displayed

### 6. Email Gate (Lead Gen)
- Results locked until email is provided
- Leads stored locally for admin access

### 7. Rate Limiting
- 1 free report per 24 hours (localStorage)
- Shows countdown when limit reached
- Reset button in Settings for testing

### 8. Admin Dashboard
- Route: `/admin` (or tap version 5x in Settings)
- Password: `admin123`
- View all leads with email, date, mode, and savings

### 9. Live Status Badge
Footer shows:
- `Tax Rules: Live & Updated` (fetch success)
- `Using Cached Rules` (fetch failed, using fallback)

## Tech Stack

- Expo SDK 53 with React Native
- expo-image-picker for camera/photo library access
- GPT-4o Vision for AI document analysis
- React Query for data fetching
- Zustand for state management
- NativeWind/TailwindCSS for styling
- react-native-reanimated for animations

## Setup

1. Add your OpenAI API key in the **ENV tab**:
   - Key: `EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY`
   - Value: Your OpenAI API key

2. On mobile: Grant camera/photo library permissions when prompted
3. On web/desktop: Use file picker for image upload

## Configuration URLs

Edit `src/lib/config.ts` to change Gist URLs:
```typescript
export const TAX_RULES_CONFIG = {
  INDIA_TAX_RULES_URL: "https://gist.githubusercontent.com/.../India_Tax_Slabs_FY24-25.txt",
  US_TAX_RULES_URL: "https://gist.githubusercontent.com/.../US_Tax_Rules_2025.txt",
};
```

## Privacy & Security

The GPT-4o Vision API is explicitly instructed to:
1. IGNORE all PII (Names, Addresses, PAN, SSN)
2. Extract ONLY financial numbers
3. Never transcribe or output personal identifiers

Privacy Tip shown to users:
> "Feel free to cover your Name or PAN with your thumb or pen before snapping the photo. Our AI looks ONLY at the numbers."

## File Structure

```
src/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx      # Main screen with image scanner
│   │   └── two.tsx        # Settings with rate limit reset
│   ├── admin.tsx          # Admin dashboard
│   └── _layout.tsx        # Root layout
├── components/
│   ├── TaxDashboard.tsx   # Results display with pay frequency
│   └── EmailGate.tsx      # Email collection
└── lib/
    ├── config.ts          # Gist URLs configuration
    ├── useTaxRules.ts     # Hook to fetch dynamic rules
    ├── tax-analysis.ts    # Tax analysis types & utilities
    ├── image-analysis.ts  # GPT-4o Vision API integration
    └── state/
        └── tax-store.ts   # Zustand store
```

## Fallback Behavior

If Gist fetch fails:
1. Uses comprehensive embedded fallback rules
2. Badge shows "Using Cached Rules"
3. App continues to work normally
