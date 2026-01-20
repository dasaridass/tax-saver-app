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
    "potentialSavings": <number - total potential savings>,
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
- Total Hours ~160-200 = MONTHLY (multiply by 12)
- Total Hours ~80 = BI-WEEKLY (multiply by 26)
- Total Hours ~40 = WEEKLY (multiply by 52)

=======================================================================
STEP 1.5: EXTRACT 401(k) CONTRIBUTIONS (CRITICAL!)
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
- Example:
  - Traditional 401K: $300/period
  - Roth 401K: $200/period
  - Employer Match: $250/period
  - EMPLOYEE CONTRIBUTION = $300 + $200 = $500/period (counts toward limit)
  - TOTAL 401K (for display) = $500 + $250 = $750/period

The $23,000 limit applies to EMPLOYEE contributions (Traditional + Roth combined).
The employer match is on TOP of this limit.

=======================================================================
STEP 2: CALCULATE ANNUAL INCOME (SHOW YOUR MATH!)
=======================================================================
1. Find GROSS PAY for the current period (NOT YTD!)
2. Multiply by the frequency:
   - MONTHLY: Gross × 12
   - BI-WEEKLY: Gross × 26
   - WEEKLY: Gross × 52

EXAMPLE (YOU MUST DO THIS):
- Gross Pay This Period: $10,338.43
- Frequency: Monthly
- CALCULATION: $10,338.43 × 12 = $124,061.16
- This goes in totalIncome field!

⚠️ COMMON ERROR TO AVOID:
- $10,000/month is NOT $50,000/year
- $10,000/month × 12 = $120,000/year

=======================================================================
STEP 3: CALCULATE TAX SAVINGS OPPORTUNITIES
=======================================================================
A. Determine MARGINAL TAX RATE based on annual income:
   - $0-$11,600: 10%
   - $11,601-$47,150: 12%
   - $47,151-$100,525: 22%
   - $100,526-$191,950: 24%
   - $191,951-$243,725: 32%
   - $243,726-$609,350: 35%

B. 401(k) SAVINGS:
   - Find annual 401k contribution = (per-period 401k) × multiplier
   - Gap = $23,000 - annual401k
   - TAX SAVINGS = Gap × marginalRate
   - Example: If annual 401k = $1,500 and rate = 24%
     Gap = $23,000 - $1,500 = $21,500
     Tax Savings = $21,500 × 0.24 = $5,160

C. HSA SAVINGS (if no HSA on paystub):
   - TAX SAVINGS = $4,150 × marginalRate
   - Example: $4,150 × 0.24 = $996

D. ROTH IRA (if income < $161k single):
   - Investment opportunity = $7,000 (not tax savings, but wealth building)

=======================================================================
OUTPUT JSON FORMAT
=======================================================================
{
  "documentMismatch": false,
  "summary": {
    "totalIncome": <MUST be grossPerPeriod × multiplier - VERIFY THIS!>,
    "currentTaxLiability": <fedTaxPerPeriod × multiplier>,
    "potentialSavings": <401kTaxSavings + hsaTaxSavings>,
    "effectiveTaxRate": <fedWithholding / grossIncome × 100>
  },
  "payFrequencyDetected": "Monthly",
  "calculationExplanation": "$10,338.43 × 12 = $124,061.16 annual gross",
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
    },
    {
      "section": "HSA",
      "description": "No HSA contributions detected",
      "missedAmount": 4150,
      "maxLimit": 4150,
      "suggestion": "If you have HDHP, contribute to HSA for triple tax benefit"
    },
    {
      "section": "Roth IRA",
      "description": "You qualify for tax-free retirement growth",
      "missedAmount": 7000,
      "maxLimit": 7000,
      "suggestion": "Open Roth IRA and contribute up to $7,000/year"
    }
  ],
  "deductions": [
    {
      "category": "401(k) Retirement",
      "section": "Pre-tax + Roth",
      "currentAmount": <annual EMPLOYEE total (Traditional + Roth) × multiplier>,
      "traditionalAmount": <annual traditional 401k × multiplier>,
      "rothAmount": <annual Roth 401k × multiplier>,
      "employerMatch": <annual EMPLOYER match × multiplier - report separately!>,
      "maxLimit": 23000,
      "potentialSavings": <(23000 - employee currentAmount) × marginalRate>,
      "recommendation": "Increase contribution to reduce taxable income",
      "priority": "high"
    },
    {
      "category": "HSA",
      "section": "Pre-tax",
      "currentAmount": <annual HSA, likely 0>,
      "maxLimit": 4150,
      "potentialSavings": <4150 × marginalRate if currentAmount is 0>,
      "recommendation": "Open HSA if you have high-deductible health plan",
      "priority": "high"
    },
    {
      "category": "Roth IRA",
      "section": "Post-tax",
      "currentAmount": 0,
      "maxLimit": 7000,
      "potentialSavings": 7000,
      "recommendation": "Tax-free growth - not on paystub but highly recommended",
      "priority": "medium"
    }
  ],
  "recommendations": [
    "🚨 Increase 401(k) from X% to at least 6% for employer match",
    "💰 Max 401(k) at $23,000/year to save $X in taxes",
    "🏥 Open HSA if eligible - save $X in taxes annually",
    "✅ Open Roth IRA - you qualify for $7,000/year tax-free growth"
  ],
  "disclaimer": "This analysis is for informational purposes only. Consult a qualified CPA for personalized advice."
}

=======================================================================
FINAL VERIFICATION CHECKLIST (DO THIS BEFORE RESPONDING!)
=======================================================================
☐ Is totalIncome = grossPerPeriod × multiplier? (e.g., $10k × 12 = $120k)
☐ Did I find ALL 401k types: Traditional, Roth, AND Employer Match?
☐ Did I SUM Traditional + Roth for employee currentAmount?
☐ Did I report traditionalAmount and rothAmount separately?
☐ Did I use only EMPLOYEE contributions (Traditional + Roth) for potentialSavings?
☐ Did I calculate 401k potentialSavings = gap × marginalRate?
☐ Did I calculate HSA potentialSavings = $4,150 × marginalRate?
☐ Did I include all 3 deductions (401k, HSA, Roth IRA)?
☐ Did I include all 3 missedSavings entries?
☐ Does summary.potentialSavings = 401k savings + HSA savings?`;
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

  // Debug logging
  console.log('[TaxSaver] AI Response parsed:', JSON.stringify({
    totalIncome: parsedResponse.summary?.totalIncome,
    payFrequency: parsedResponse.payFrequencyDetected,
    calculationExplanation: parsedResponse.calculationExplanation,
    deductionsCount: parsedResponse.deductions?.length,
    missedSavingsCount: parsedResponse.missedSavings?.length,
  }, null, 2));

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

  // Post-processing for US mode
  if (countryMode === 'us') {
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

    // Check if 401k exists, add if missing
    const has401k = analysis.deductions.some(d => d.category?.toLowerCase().includes('401'));
    if (!has401k) {
      analysis.deductions.push({
        category: '401(k) Retirement',
        section: 'Pre-tax',
        currentAmount: 0,
        maxLimit: 23000,
        potentialSavings: Math.round(23000 * marginalRate),
        recommendation: 'Contribute to 401(k) to reduce taxable income and save on taxes',
        priority: 'high',
      });
    }

    // Check if HSA exists, add if missing
    const hasHSA = analysis.deductions.some(d => d.category?.toLowerCase().includes('hsa'));
    if (!hasHSA) {
      analysis.deductions.push({
        category: 'HSA (Health Savings Account)',
        section: 'Pre-tax',
        currentAmount: 0,
        maxLimit: 4150,
        potentialSavings: Math.round(4150 * marginalRate),
        recommendation: 'If you have a high-deductible health plan, open an HSA for triple tax benefits',
        priority: 'high',
      });
    }

    // Check if Roth IRA exists, add if missing
    const hasRoth = analysis.deductions.some(d => d.category?.toLowerCase().includes('roth'));
    if (!hasRoth && annualIncome < 161000) {
      analysis.deductions.push({
        category: 'Roth IRA',
        section: 'Post-tax',
        currentAmount: 0,
        maxLimit: 7000,
        potentialSavings: 7000,
        recommendation: 'Open a Roth IRA for tax-free growth - you qualify based on your income',
        priority: 'medium',
      });
    }

    // Ensure missedSavings array exists
    if (!analysis.missedSavings) {
      analysis.missedSavings = [];
    }

    // Add missed savings entries if missing
    const hasMissed401k = analysis.missedSavings.some(m => m.section?.includes('401'));
    if (!hasMissed401k) {
      const current401k = analysis.deductions.find(d => d.category?.toLowerCase().includes('401'))?.currentAmount || 0;
      const gap = Math.max(0, 23000 - current401k);
      if (gap > 0) {
        analysis.missedSavings.push({
          section: '401(k)',
          description: `Contributing $${current401k.toLocaleString()}/year vs $23,000 limit`,
          missedAmount: gap,
          maxLimit: 23000,
          suggestion: `Increase 401(k) contribution to save $${Math.round(gap * marginalRate).toLocaleString()} in taxes`,
        });
      }
    }

    const hasMissedHSA = analysis.missedSavings.some(m => m.section?.includes('HSA'));
    if (!hasMissedHSA) {
      const currentHSA = analysis.deductions.find(d => d.category?.toLowerCase().includes('hsa'))?.currentAmount || 0;
      const gap = Math.max(0, 4150 - currentHSA);
      if (gap > 0) {
        analysis.missedSavings.push({
          section: 'HSA',
          description: currentHSA > 0 ? `Contributing $${currentHSA.toLocaleString()}/year vs $4,150 limit` : 'No HSA contributions detected',
          missedAmount: gap,
          maxLimit: 4150,
          suggestion: `If you have HDHP, contribute to HSA for $${Math.round(gap * marginalRate).toLocaleString()} in tax savings`,
        });
      }
    }

    const hasMissedRoth = analysis.missedSavings.some(m => m.section?.includes('Roth'));
    if (!hasMissedRoth && annualIncome < 161000) {
      analysis.missedSavings.push({
        section: 'Roth IRA',
        description: 'You qualify for tax-free retirement growth',
        missedAmount: 7000,
        maxLimit: 7000,
        suggestion: 'Open Roth IRA and contribute up to $7,000/year for tax-free growth',
      });
    }

    // Recalculate potential savings
    let totalTaxSavings = 0;
    analysis.deductions = analysis.deductions.map((deduction) => {
      const category = deduction.category?.toLowerCase() || '';
      const gap = Math.max(0, deduction.maxLimit - deduction.currentAmount);

      if (category.includes('roth')) {
        deduction.potentialSavings = gap;
        return deduction;
      }

      if (category.includes('401') || category.includes('hsa')) {
        const taxSavings = Math.round(gap * marginalRate);
        if (deduction.potentialSavings === 0 || deduction.potentialSavings < taxSavings * 0.5) {
          deduction.potentialSavings = taxSavings;
        }
        totalTaxSavings += deduction.potentialSavings;
      }

      return deduction;
    });

    if (totalTaxSavings > 0 && (analysis.summary.potentialSavings === 0 || analysis.summary.potentialSavings < totalTaxSavings * 0.5)) {
      analysis.summary.potentialSavings = totalTaxSavings;
    }

    if (analysis.usComparison) {
      analysis.usComparison.annualSavings = analysis.summary.potentialSavings;
    }
  }

  // Post-processing for India mode
  if (countryMode === 'india' && analysis.deductions && analysis.deductions.length > 0) {
    const calculatedSavings = analysis.deductions.reduce((total, deduction) => {
      return total + (deduction.potentialSavings || 0);
    }, 0);

    if (calculatedSavings > 0 && (analysis.summary.potentialSavings === 0 || analysis.summary.potentialSavings < calculatedSavings * 0.5)) {
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
