/**
 * Image analysis service using GPT-4o Vision API
 * Mobile-first approach for tax document scanning
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import type { CountryMode } from './state/tax-store';
import type { TaxAnalysisResult } from './tax-analysis';
import { FALLBACK_INDIA_RULES, FALLBACK_US_RULES } from './useTaxRules';

/**
 * Convert image URI to base64
 */
async function imageToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // Web: fetch and convert to base64
    const response = await fetch(uri);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix if present
        const base64Data = base64.split(',')[1] || base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // Mobile: use expo-file-system
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  }
}

/**
 * Get image MIME type from URI
 */
function getImageMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase() || 'jpeg';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return mimeTypes[extension] || 'image/jpeg';
}

/**
 * Build the system prompt for GPT-4o Vision analysis
 */
function buildVisionSystemPrompt(mode: CountryMode, taxRulesText: string): string {
  const privacyRule = `**PRIVACY RULE:** Do NOT transcribe or output the user's Name, Address, PAN, SSN, or any other PII. If you see them, ignore them completely. Process ONLY the financial numbers.`;

  const documentDetectionRule = `**DOCUMENT TYPE DETECTION:**
First, identify what type of document this is:
- INDIA documents: Form 16, Indian Salary Slip (look for: ₹, INR, PAN, Aadhaar, TDS, 80C, 80D, HRA, PF, "Assessment Year", "Financial Year")
- US documents: Paystub, W-2 (look for: $, USD, SSN, Federal Tax, FICA, Medicare, 401k, State Tax)

If the document does NOT match the expected country (${mode === 'india' ? 'INDIA' : 'US'}), return this JSON:
{
  "documentMismatch": true,
  "detectedCountry": "<'india' or 'us'>",
  "errorMessage": "This appears to be a [detected country] document. Please switch to [detected country] mode or upload a [expected country] document."
}`;

  if (mode === 'india') {
    return `You are a Tax Expert AI specializing in Indian Income Tax.

${privacyRule}

${documentDetectionRule}

**CURRENT TAX RULES:**
${taxRulesText}

**INSTRUCTIONS:**
1. FIRST: Verify this is an Indian document (Form 16, Salary Slip). If not, return documentMismatch error.
2. Extract ONLY financial data: Gross Income, Tax Withheld, Deductions (80C/80D/NPS/HRA)
3. Perform Tax Analysis: Compare Old vs New Regime

**OUTPUT JSON (if document matches India):**
{
  "documentMismatch": false,
  "summary": {
    "totalIncome": <number - annual gross income>,
    "currentTaxLiability": <number - tax as shown on document>,
    "potentialSavings": <number - total potential savings if all deductions maximized>,
    "effectiveTaxRate": <number - percentage>
  },
  "regimeComparison": {
    "oldRegime": {
      "grossIncome": <number>,
      "totalDeductions": <number>,
      "taxableIncome": <number>,
      "taxBeforeCess": <number>,
      "cess": <number>,
      "totalTax": <number>
    },
    "newRegime": {
      "grossIncome": <number>,
      "standardDeduction": 75000,
      "taxableIncome": <number>,
      "taxBeforeCess": <number>,
      "cess": <number>,
      "totalTax": <number>
    },
    "recommendation": "<'OLD' or 'NEW'>",
    "savingsWithRecommended": <number>
  },
  "missedSavings": [
    {
      "section": "<e.g., '80C'>",
      "description": "<description>",
      "missedAmount": <number>,
      "maxLimit": <number>,
      "suggestion": "<actionable advice>"
    }
  ],
  "deductions": [
    {
      "category": "<e.g., 'EPF'>",
      "section": "<e.g., '80C'>",
      "currentAmount": <number>,
      "maxLimit": <number>,
      "potentialSavings": <number>,
      "recommendation": "<advice>",
      "priority": "<'high' | 'medium' | 'low'>"
    }
  ],
  "recommendations": ["<tax-saving tips>"],
  "disclaimer": "This analysis is for informational purposes only. Consult a qualified CA for personalized advice."
}`;
  }

  // US mode
  return `You are a Tax Expert AI helping Americans save money on taxes.

${privacyRule}

${documentDetectionRule}

**CURRENT TAX RULES:**
${taxRulesText}

**INSTRUCTIONS:**
1. FIRST: Verify this is a US document (Paystub, W-2). If not, return documentMismatch error.
2. Then proceed with analysis below.

=======================================================================
STEP 1: DETERMINE PAY FREQUENCY (CRITICAL!)
=======================================================================
Look for clues in the document:
- "Pay Period" dates: 01/01 - 01/31 = MONTHLY (multiply by 12)
- "Pay Period" dates: 01/01 - 01/14 = BI-WEEKLY (multiply by 26)
- Total Hours > 140 (e.g., 160, 202, 210) = MONTHLY (multiply by 12)
- Total Hours ~80 (e.g., 70-100) = BI-WEEKLY (multiply by 26)
- Total Hours ~40 = WEEKLY (multiply by 52)

	⚠️ LOGIC GUARDRAILS (DO NOT IGNORE):
- IF you identify Frequency as "Monthly", YOU MUST USE x12.
- IF you identify Frequency as "Bi-Weekly", YOU MUST USE x26.
- NEVER multiply "Monthly" pay by 26.
- NEVER multiply "Bi-Weekly" pay by 12.

=======================================================================
STEP 1.5: EXTRACT 401(k) CONTRIBUTIONS
=======================================================================
Paystubs may show MULTIPLE types of 401k contributions. Look for ALL of these:

A. TRADITIONAL (PRE-TAX) 401K:
   - Labels: "401K", "401(k)", "Employee 401K", "Retirement", "ADP 401K", "Pre-Tax 401K"

B. ROTH 401K (POST-TAX):
   - Labels: "Roth 401K", "Roth 401(k)", "Roth", "After-Tax 401K", "Post-Tax 401K"
   - This is DIFFERENT from traditional 401k - taxed now, tax-free in retirement

C. EMPLOYER MATCH:
   - Labels: "Employer 401K", "401K Match", "Company Match", "ER 401K", "Employer Contribution"
   - This is FREE MONEY and does NOT count toward employee's $23,000 limit

⚠️ CRITICAL CALCULATION:
- EMPLOYEE TOTAL = Traditional 401K + Roth 401K (both count toward $23,000 limit!)

=======================================================================
STEP 2: CALCULATE ANNUAL INCOME
=======================================================================
1. Find GROSS PAY for the current period (NOT YTD!)
2. Multiply by the frequency determined in Step 1:
   - MONTHLY: Gross × 12
   - BI-WEEKLY: Gross × 26
   - WEEKLY: Gross × 52

EXAMPLE:
- Gross Pay This Period: $10,338.43
- Frequency: Monthly
- CALCULATION: $10,338.43 × 12 = $124,061.16
- This goes in totalIncome field!

=======================================================================
STEP 3: CALCULATE TAX SAVINGS OPPORTUNITIES
=======================================================================
A. Determine MARGINAL TAX RATE based on annual income.

B. 401(k) SAVINGS:
   - Find annual 401k contribution = (per-period 401k) × multiplier
   - Gap = $23,000 - annual401k
   - TAX SAVINGS = Gap × marginalRate

C. HSA SAVINGS (if no HSA on paystub):
   - TAX SAVINGS = $4,150 × marginalRate

D. ROTH IRA (if income < $161k single):
   - Investment opportunity = $7,000 (not tax savings, but wealth building)

=======================================================================
OUTPUT JSON FORMAT
=======================================================================
{
  "documentMismatch": false,
  "currentGrossPay": <NUMBER - The RAW gross pay for this period>,
  "payFrequencyDetected": "Monthly",
  "summary": {
    "totalIncome": <MUST be grossPerPeriod × multiplier>,
    "currentTaxLiability": <fedTaxPerPeriod × multiplier>,
    "potentialSavings": <401kTaxSavings + hsaTaxSavings>,
    "effectiveTaxRate": <fedWithholding / grossIncome × 100>
  },
  "calculationExplanation": "$<Gross> x <Multiplier> = $<Annual>",
  "usComparison": {
    "current": {
      "grossIncome": <annual gross>,
      "federalWithholding": <annual fed tax>,
      "stateWithholding": <annual state tax>,
      "fica": <annual SS + Medicare>,
      "totalDeductions": <annual 401k + HSA current>,
      "effectiveRate": <current effective rate %>
    },
    "optimized": {
      "grossIncome": <same as current>,
      "federalWithholding": <current - potentialSavings>,
      "stateWithholding": <same as current>,
      "fica": <same as current>,
      "totalDeductions": <$23,000 + $4,150 = $27,150 if maxed>,
      "effectiveRate": <lower rate after optimization %>
    },
    "annualSavings": <same as summary.potentialSavings>
  },
  "missedSavings": [
    {
      "section": "401(k)",
      "description": "Contributing $X/year vs $23,000 limit",
      "missedAmount": <gap to $23,000>,
      "maxLimit": 23000,
      "suggestion": "Increase 401(k) contribution to save $X in taxes"
    }
  ],
  "deductions": [
    {
      "category": "401(k) Retirement",
      "section": "Pre-tax + Roth",
      "currentAmount": <annual EMPLOYEE total>,
      "traditionalAmount": <annual traditional 401k>,
      "rothAmount": <annual Roth 401k>,
      "employerMatch": <annual EMPLOYER match>,
      "maxLimit": 23000,
      "potentialSavings": <(23000 - employee currentAmount) × marginalRate>,
      "recommendation": "Increase contribution to reduce taxable income",
      "priority": "high"
    }
  ],
  "recommendations": [],
  "disclaimer": "This analysis is for informational purposes only. Consult a qualified CPA for personalized advice."
}`;
}

export interface ImageAnalysisOptions {
  imageUri: string;
  countryMode: CountryMode;
  taxRules?: string;
}

/**
 * Analyze a tax document image using GPT-4o Vision
 */
export async function analyzeImageWithVision({
  imageUri,
  countryMode,
  taxRules,
}: ImageAnalysisOptions): Promise<TaxAnalysisResult> {
  const apiKey = process.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Please add it in the ENV tab.'
    );
  }

  // Use provided rules or fallback
  const rulesText = taxRules || (countryMode === 'india' ? FALLBACK_INDIA_RULES : FALLBACK_US_RULES);

  // Convert image to base64
  const base64Image = await imageToBase64(imageUri);
  const mimeType = getImageMimeType(imageUri);

  const systemPrompt = buildVisionSystemPrompt(countryMode, rulesText);

  const userContent = [
    {
      type: 'text' as const,
      text: `Analyze this tax document image. Extract the financial numbers based on the tax rules provided. IGNORE all PII (Names, Addresses, IDs). DO NOT output them.`,
    },
    {
      type: 'image_url' as const,
      image_url: {
        url: `data:${mimeType};base64,${base64Image}`,
      },
    },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Vision API error:', error);
    throw new Error(`Vision API request failed: ${response.status}`);
  }

  const data = await response.json();

  // Extract the text response
  const outputText = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response
  const jsonMatch = outputText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Could not parse response:', outputText);
    throw new Error('Could not parse tax analysis response from image');
  }

  const parsedResponse = JSON.parse(jsonMatch[0]);

  // Check for document mismatch
  if (parsedResponse.documentMismatch === true) {
    const detectedCountry = parsedResponse.detectedCountry === 'india' ? 'Indian' : 'US';
    const expectedCountry = countryMode === 'india' ? 'Indian' : 'US';
    throw new Error(
      `This appears to be a ${detectedCountry} document. Please switch to ${detectedCountry === 'Indian' ? 'India' : 'US'} mode or upload a ${expectedCountry} document.`
    );
  }

  const analysis: TaxAnalysisResult = parsedResponse;
  analysis.countryMode = countryMode;

  // --- POST-PROCESSING FOR US MODE (CRITICAL FIXES) ---
  if (countryMode === 'us') {
    
    // 1. MATH CORRECTION: Force the logic if AI drifted
    if (analysis.currentGrossPay && analysis.payFrequencyDetected) {
      const freq = analysis.payFrequencyDetected.toLowerCase();
      const gross = analysis.currentGrossPay;
      let multiplier = 0;

      if (freq.includes('month') && !freq.includes('semi')) {
        multiplier = 12; // Strictly Monthly
      } else if (freq.includes('bi')) {
        multiplier = 26; // Strictly Bi-Weekly
      } else if (freq.includes('week')) {
        multiplier = 52; // Weekly
      } else if (freq.includes('semi')) {
        multiplier = 24; // Semi-Monthly
      }

      if (multiplier > 0) {
        // OVERRIDE the AI's math
        analysis.summary.totalIncome = gross * multiplier;
        analysis.calculationExplanation = `Corrected by System: $${gross.toLocaleString()} x ${multiplier} (${analysis.payFrequencyDetected}) = $${(gross * multiplier).toLocaleString()}`;
      }
    }

    // 2. RECALCULATE MARGINAL RATE based on potentially corrected income
    const annualIncome = analysis.summary.totalIncome || 0;
    let marginalRate = 0.24;

    if (annualIncome <= 11600) marginalRate = 0.10;
    else if (annualIncome <= 47150) marginalRate = 0.12;
    else if (annualIncome <= 100525) marginalRate = 0.22;
    else if (annualIncome <= 191950) marginalRate = 0.24;
    else if (annualIncome <= 243725) marginalRate = 0.32;
    else if (annualIncome <= 609350) marginalRate = 0.35;
    else marginalRate = 0.37;

    // Ensure deductions array exists
    if (!analysis.deductions) {
      analysis.deductions = [];
    }

    // 3. RECALCULATE DEDUCTION SAVINGS with new marginal rate
    analysis.deductions = analysis.deductions.map(d => {
      // If 401k or HSA, recalculate potential savings
      if (d.category?.toLowerCase().includes('401') || d.category?.toLowerCase().includes('hsa')) {
        const gap = Math.max(0, d.maxLimit - d.currentAmount);
        d.potentialSavings = Math.round(gap * marginalRate);
      }
      return d;
    });

    // Add missing categories (401k, HSA, Roth)
    const has401k = analysis.deductions.some(d => d.category?.toLowerCase().includes('401'));
    if (!has401k) {
      analysis.deductions.push({
        category: '401(k) Retirement',
        section: 'Pre-tax',
        currentAmount: 0,
        maxLimit: 23000,
        potentialSavings: Math.round(23000 * marginalRate),
        recommendation: 'Contribute to 401(k) to reduce taxable income',
        priority: 'high',
      });
    }

    const hasHSA = analysis.deductions.some(d => d.category?.toLowerCase().includes('hsa'));
    if (!hasHSA) {
      analysis.deductions.push({
        category: 'HSA (Health Savings Account)',
        section: 'Pre-tax',
        currentAmount: 0,
        maxLimit: 4150,
        potentialSavings: Math.round(4150 * marginalRate),
        recommendation: 'If you have a high-deductible health plan, open an HSA',
        priority: 'high',
      });
    }

    // Recalculate total potential savings
    const totalTaxSavings = analysis.deductions.reduce((sum, d) => sum + (d.potentialSavings || 0), 0);
    analysis.summary.potentialSavings = totalTaxSavings;

    // Update US Comparison
    if (analysis.usComparison) {
      analysis.usComparison.annualSavings = totalTaxSavings;
      analysis.usComparison.current.grossIncome = annualIncome;
      analysis.usComparison.optimized.grossIncome = annualIncome;
      // Recalculate effective rates
      if (annualIncome > 0) {
        analysis.usComparison.current.effectiveRate = (analysis.usComparison.current.federalWithholding / annualIncome) * 100;
        analysis.usComparison.optimized.effectiveRate = (analysis.usComparison.optimized.federalWithholding / annualIncome) * 100;
      }
    }
  }

  // Post-processing for India mode
  if (countryMode === 'india' && analysis.deductions && analysis.deductions.length > 0) {
    const calculatedSavings = analysis.deductions.reduce((total, deduction) => {
      return total + (deduction.potentialSavings || 0);
    }, 0);

    if (calculatedSavings > 0) {
      analysis.summary.potentialSavings = calculatedSavings;
    }
  }

  return analysis;
}

/**
 * Validate image file type
 */
export function isValidImageFile(mimeType?: string, fileName?: string): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  if (mimeType && validTypes.includes(mimeType.toLowerCase())) {
    return true;
  }

  if (fileName) {
    const lowerName = fileName.toLowerCase();
    return validExtensions.some(ext => lowerName.endsWith(ext));
  }

  return false;
}