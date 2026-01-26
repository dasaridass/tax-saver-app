/**
 * Tax analysis service using OpenAI API
 * Supports both India (FY 2024-25) and US tax systems
 * Now uses dynamically fetched tax rules from GitHub Gists
 */

import type { CountryMode } from './state/tax-store';

/**
 * Detect if document matches the selected country mode
 * Returns an error message if mismatch, null if OK
 */
export function detectDocumentMismatch(
  text: string,
  selectedMode: CountryMode
): string | null {
  const lowerText = text.toLowerCase();

  // US document indicators
  const usIndicators = [
    'social security', 'federal tax', 'fed tax', 'fica', 'medicare',
    'state tax', '401k', '401(k)', 'w-2', 'w2', 'paystub', 'pay stub',
    'federal withholding', 'ssnumber', 'ssn', 'employer identification number',
    'ein', 'ytd gross', 'ytd earnings', 'united states', 'usa', 'usd', '$',
  ];

  // India document indicators
  const indiaIndicators = [
    'form 16', 'form-16', 'pan', 'aadhaar', 'aadhar', 'income tax department',
    'section 80c', 'section 80d', '80c', '80d', 'hra', 'house rent allowance',
    'pf', 'provident fund', 'epf', 'nps', 'national pension', 'cess', 'tds',
    'tax deducted at source', 'assessment year', 'financial year', 'fy 20',
    'ay 20', 'inr', '₹', 'rupees', 'lakh', 'crore', 'tan', 'gross total income',
    'chapter vi-a', 'salary slip',
  ];

  let usScore = 0;
  let indiaScore = 0;

  for (const indicator of usIndicators) {
    if (lowerText.includes(indicator)) usScore++;
  }

  for (const indicator of indiaIndicators) {
    if (lowerText.includes(indicator)) indiaScore++;
  }

  const hasDollarSign = /\$\s?\d/.test(text);
  const hasRupeeSign = /₹\s?\d/.test(text) || /rs\.?\s?\d/i.test(text);

  if (hasDollarSign) usScore += 3;
  if (hasRupeeSign) indiaScore += 3;

  const threshold = 3;

  if (selectedMode === 'india') {
    if (usScore >= threshold && usScore > indiaScore * 1.5) {
      return 'This appears to be a US paystub. Please switch to US mode or upload an Indian tax document (Form 16 / Salary Slip).';
    }
  } else {
    if (indiaScore >= threshold && indiaScore > usScore * 1.5) {
      return 'This appears to be an Indian tax document. Please switch to India mode or upload a US paystub.';
    }
  }

  return null;
}

export interface TaxSavingsItem {
  category: string;
  section: string;
  currentAmount: number;
  traditionalAmount?: number;
  rothAmount?: number;
  employerMatch?: number;
  maxLimit: number;
  potentialSavings: number;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}

export interface MissedSavingsItem {
  section: string;
  description: string;
  missedAmount: number;
  maxLimit: number;
  suggestion: string;
}

export interface RegimeComparison {
  oldRegime: {
    grossIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    taxBeforeCess: number;
    cess: number;
    totalTax: number;
  };
  newRegime: {
    grossIncome: number;
    standardDeduction: number;
    taxableIncome: number;
    taxBeforeCess: number;
    cess: number;
    totalTax: number;
  };
  recommendation: 'OLD' | 'NEW';
  savingsWithRecommended: number;
}

export interface USComparison {
  current: {
    grossIncome: number;
    federalWithholding: number;
    stateWithholding: number;
    fica: number;
    totalDeductions: number;
    effectiveRate: number;
  };
  optimized: {
    grossIncome: number;
    federalWithholding: number;
    stateWithholding: number;
    fica: number;
    totalDeductions: number;
    effectiveRate: number;
  };
  annualSavings: number;
}

export interface TaxAnalysisResult {
  summary: {
    totalIncome: number;
    currentTaxLiability: number;
    potentialSavings: number;
    effectiveTaxRate: number;
  };
  regimeComparison?: RegimeComparison;
  usComparison?: USComparison;
  // Added currentGrossPay to allow TS to correct the math
  currentGrossPay?: number;
  payFrequencyDetected?: string;
  calculationExplanation?: string;
  missedSavings: MissedSavingsItem[];
  deductions: TaxSavingsItem[];
  recommendations: string[];
  disclaimer: string;
  countryMode: CountryMode;
}

function buildIndiaPrompt(taxRulesText: string): string {
  return `You are a Tax Expert for Indian Income Tax.

CURRENT TAX RULES (Source: Live GitHub Gist):
${taxRulesText}

IMPORTANT: The document has been redacted for privacy. "[REDACTED_PAN]" indicates PAN numbers that were removed for security.

DOCUMENT PARSING INSTRUCTIONS:
- The extracted text may contain tabular data with values separated by tabs or spaces
- Look for clearly labeled fields like "Gross Total Income", "Total Income", "Gross Salary", "Net Salary"
- Pay attention to the LABELS next to numbers, not just the numbers themselves
- For Form 16: Look for Part B income details and tax computation section
- For Salary Slips: Look for monthly totals and extrapolate to annual figures
- Common income labels: "Gross Total Income", "Total Income", "Income from Salary", "Gross Salary"
- Ignore phone numbers, employee IDs, and other non-income numbers

INSTRUCTIONS:
Analyze the user's financial document (Form 16 or Salary Slip) based ONLY on the rules above.

Return a JSON response with this EXACT structure:
{
  "summary": {
    "totalIncome": <number - gross total income>,
    "currentTaxLiability": <number - tax as per document>,
    "potentialSavings": <number - total potential savings if all deductions maximized>,
    "effectiveTaxRate": <number - percentage>
  },
  "regimeComparison": {
    "oldRegime": {
      "grossIncome": <number>,
      "totalDeductions": <number - sum of 80C, 80D, HRA, etc.>,
      "taxableIncome": <number>,
      "taxBeforeCess": <number>,
      "cess": <number - 4% of tax>,
      "totalTax": <number>
    },
    "newRegime": {
      "grossIncome": <number>,
      "standardDeduction": 75000,
      "taxableIncome": <number>,
      "taxBeforeCess": <number>,
      "cess": <number - 4% of tax>,
      "totalTax": <number>
    },
    "recommendation": "<'OLD' or 'NEW' - which regime is better>",
    "savingsWithRecommended": <number - how much they save with recommended regime>
  },
  "missedSavings": [],
  "deductions": [],
  "recommendations": [],
  "disclaimer": "This analysis is for informational purposes only. Consult a qualified CA/tax professional for personalized advice."
}

CALCULATION GUIDELINES:
- Apply tax slabs as per the rules above
- Add 4% Health & Education Cess
- Apply 87A rebate if applicable
- Identify ALL unutilized deduction limits as "missedSavings"
`;
}

// FIX: Strictly Enforce Pay Frequency Logic by requesting raw inputs
function buildUSPrompt(taxRulesText: string): string {
  return `You are a Tax Expert helping people SAVE MONEY on taxes.

CURRENT TAX RULES (Source: Live GitHub Gist):
${taxRulesText}

IMPORTANT: The document has been redacted for privacy. "[REDACTED_SSN]" indicates Social Security Numbers that were removed for security.

**CRITICAL RULE: INCOME CALCULATION**
You must extract the raw pay per period to allow for precise annualization.

A. Extract **Current Gross Pay** from the document.
B. Extract **Pay Frequency** (Weekly, Bi-Weekly, Semi-Monthly, Monthly).
C. **CALCULATE** the Annual Income strictly:
   - Weekly: Current Gross x 52
   - Bi-Weekly: Current Gross x 26
   - Semi-Monthly: Current Gross x 24
   - Monthly: Current Gross x 12
D. **IGNORE** any "YTD Gross", "Year to Date", or "Total Income" fields printed on the document. They are misleading.

**ANALYSIS STEPS:**

**STEP 1: ANALYZE WITHHOLDING**
- Calculate Annual Federal Withholding = (Fed Tax per period) × (Multiplier from Step C)
- Check for "Over-withholding" if refund > $3,000.

**STEP 2: RETIREMENT CHECKS (401k & Match)**
- Identify TRADITIONAL (Pre-Tax), ROTH (Post-Tax), and EMPLOYER MATCH.
- Employee Limit: $23,000 (Combined Traditional + Roth).
- Employer Match: Does NOT count toward limit (Free Money).
- If Contribution % < 3%: Warn "⚠️ Likely missing Employer Match".

**STEP 3: THE "ROTH" & "IRA" CHECK**
- If "Roth" is not present and Tax Bracket is Low (10-12%): Suggest switching to Roth 401(k).
- **Roth IRA:** If Annual Income < $161,000 (Single), suggest opening a private Roth IRA ($7,000 limit).

**STEP 4: HSA CHECK**
- If HSA = $0 and Medical deduction exists: Suggest HSA for Triple Tax Break.
- Limit: $4,150 (Individual) / $8,300 (Family).

**OUTPUT FORMAT (JSON ONLY):**
{
  "currentGrossPay": <NUMBER - The raw gross pay for THIS SINGLE PAY PERIOD>,
  "payFrequencyDetected": "Monthly/Bi-Weekly/Weekly/Semi-Monthly",
  "summary": {
    "totalIncome": <NUMBER - The value you calculated in Step C above>,
    "currentTaxLiability": <NUMBER - Annualized Federal Withholding>,
    "potentialSavings": <NUMBER>,
    "effectiveTaxRate": <NUMBER>
  },
  "calculationExplanation": "Detected <Hours> hours -> Frequency <Frequency>. Math: $<Gross> x <Multiplier> = $<Annual>",
  "missedSavings": [],
  "deductions": [],
  "recommendations": [],
  "disclaimer": "Informational only. Consult a CPA."
}
`;
}

export interface AnalyzeOptions {
  redactedText: string;
  countryMode: CountryMode;
  taxRules: string;
}

export async function analyzeTaxDocument(
  redactedText: string,
  countryMode: CountryMode = 'india',
  dynamicRules?: string
): Promise<TaxAnalysisResult> {

  const apiKey = import.meta.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Please add it in Vercel Environment Variables.'
    );
  }

  if (!dynamicRules) {
    throw new Error(
      'Tax rules not loaded. Please wait for rules to load or check your connection.'
    );
  }

  const systemPrompt = countryMode === 'india'
    ? buildIndiaPrompt(dynamicRules)
    : buildUSPrompt(dynamicRules);

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
          content: redactedText,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${error}`);
  }

  const data = await response.json();
  const outputText = data.choices?.[0]?.message?.content || '';

  const jsonMatch = outputText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse tax analysis response');
  }

  const analysis: TaxAnalysisResult = JSON.parse(jsonMatch[0]);
  analysis.countryMode = countryMode;

  // --- POST-PROCESSING FOR US MODE ---
  // Here we override the AI's math if it contradicts the frequency
  if (countryMode === 'us') {
    
    // 1. MATH CORRECTION: Ensure Total Income matches Frequency
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

      // If we found a valid multiplier, force the calculation
      // This fixes the issue where AI says "Monthly" but multiplies by 26
      if (multiplier > 0) {
        const correctedIncome = gross * multiplier;
        analysis.summary.totalIncome = correctedIncome;
        
        // Update explanation to reflect the correction
        analysis.calculationExplanation = `Corrected by System: $${gross.toLocaleString()} x ${multiplier} (${analysis.payFrequencyDetected}) = $${correctedIncome.toLocaleString()}`;
      }
    }

    // 2. DEDUCTIONS & SAVINGS LOGIC (Existing logic preserved)
    if (analysis.deductions && analysis.deductions.length > 0) {
      const annualIncome = analysis.summary.totalIncome || 0;
      let marginalRate = 0.24; // Default 24%

      if (annualIncome <= 11600) marginalRate = 0.10;
      else if (annualIncome <= 47150) marginalRate = 0.12;
      else if (annualIncome <= 100525) marginalRate = 0.22;
      else if (annualIncome <= 191950) marginalRate = 0.24;
      else if (annualIncome <= 243725) marginalRate = 0.32;
      else if (annualIncome <= 609350) marginalRate = 0.35;
      else marginalRate = 0.37;

      let totalTaxSavings = 0;

      analysis.deductions = analysis.deductions.map((deduction) => {
        const category = deduction.category?.toLowerCase() || '';
        const gap = Math.max(0, deduction.maxLimit - deduction.currentAmount);

        if (category.includes('roth ira')) {
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
  }

  // POST-PROCESSING FOR INDIA MODE (Existing logic)
  if (countryMode === 'india' && analysis.deductions && analysis.deductions.length > 0) {
    const calculatedSavings = analysis.deductions.reduce((total, deduction) => {
      return total + (deduction.potentialSavings || 0);
    }, 0);

    if (calculatedSavings > 0 && (analysis.summary.potentialSavings === 0 || analysis.summary.potentialSavings < calculatedSavings * 0.5)) {
      analysis.summary.potentialSavings = calculatedSavings;
    }
  }

  // Missed Savings fallback check (Existing logic)
  if (analysis.summary.potentialSavings === 0 && analysis.missedSavings && analysis.missedSavings.length > 0) {
    if (countryMode === 'us') {
      const annualIncome = analysis.summary.totalIncome || 0;
      let marginalRate = 0.24;
      if (annualIncome <= 47150) marginalRate = 0.12;
      else if (annualIncome <= 100525) marginalRate = 0.22;
      else if (annualIncome <= 191950) marginalRate = 0.24;
      else if (annualIncome <= 243725) marginalRate = 0.32;
      else marginalRate = 0.35;

      const estimatedSavings = analysis.missedSavings.reduce((total, item) => {
        if (item.section?.toLowerCase().includes('401') || item.section?.toLowerCase().includes('hsa')) {
          return total + (item.missedAmount || 0) * marginalRate;
        }
        return total;
      }, 0);

      if (estimatedSavings > 0) {
        analysis.summary.potentialSavings = Math.round(estimatedSavings);
        if (analysis.usComparison) {
          analysis.usComparison.annualSavings = analysis.summary.potentialSavings;
        }
      }
    }
  }

  return analysis;
}