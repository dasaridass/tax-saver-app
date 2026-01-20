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
    'social security',
    'federal tax',
    'fed tax',
    'fica',
    'medicare',
    'state tax',
    '401k',
    '401(k)',
    'w-2',
    'w2',
    'paystub',
    'pay stub',
    'federal withholding',
    'ssnumber',
    'ssn',
    'employer identification number',
    'ein',
    'ytd gross',
    'ytd earnings',
    'united states',
    'usa',
    'usd',
    '$',
  ];

  // India document indicators
  const indiaIndicators = [
    'form 16',
    'form-16',
    'pan',
    'aadhaar',
    'aadhar',
    'income tax department',
    'section 80c',
    'section 80d',
    '80c',
    '80d',
    'hra',
    'house rent allowance',
    'pf',
    'provident fund',
    'epf',
    'nps',
    'national pension',
    'cess',
    'tds',
    'tax deducted at source',
    'assessment year',
    'financial year',
    'fy 20',
    'ay 20',
    'inr',
    '₹',
    'rupees',
    'lakh',
    'crore',
    'tan',
    'gross total income',
    'chapter vi-a',
    'salary slip',
  ];

  // Count matches for each country
  let usScore = 0;
  let indiaScore = 0;

  for (const indicator of usIndicators) {
    if (lowerText.includes(indicator)) {
      usScore++;
    }
  }

  for (const indicator of indiaIndicators) {
    if (lowerText.includes(indicator)) {
      indiaScore++;
    }
  }

  // Check for currency symbols specifically (strong indicators)
  const hasDollarSign = /\$\s?\d/.test(text);
  const hasRupeeSign = /₹\s?\d/.test(text) || /rs\.?\s?\d/i.test(text);

  if (hasDollarSign) usScore += 3;
  if (hasRupeeSign) indiaScore += 3;

  // Determine detected country
  const threshold = 3; // Need at least 3 indicators to be confident

  if (selectedMode === 'india') {
    // User selected India but document looks like US
    if (usScore >= threshold && usScore > indiaScore * 1.5) {
      return 'This appears to be a US paystub. Please switch to US mode or upload an Indian tax document (Form 16 / Salary Slip).';
    }
  } else {
    // User selected US but document looks like India
    if (indiaScore >= threshold && indiaScore > usScore * 1.5) {
      return 'This appears to be an Indian tax document. Please switch to India mode or upload a US paystub.';
    }
  }

  return null; // No mismatch detected
}

export interface TaxSavingsItem {
  category: string;
  section: string;
  currentAmount: number;
  traditionalAmount?: number; // For 401k: traditional (pre-tax) contribution
  rothAmount?: number; // For 401k: Roth (post-tax) contribution
  employerMatch?: number; // For 401k: employer match amount (separate from employee contribution)
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

// US-specific comparison structure
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
  regimeComparison?: RegimeComparison; // India only
  usComparison?: USComparison; // US only
  payFrequencyDetected?: string; // US only - Weekly/Bi-Weekly/Semi-Monthly/Monthly
  calculationExplanation?: string; // US only - how annual income was calculated
  missedSavings: MissedSavingsItem[];
  deductions: TaxSavingsItem[];
  recommendations: string[];
  disclaimer: string;
  countryMode: CountryMode;
}

/**
 * Build the system prompt dynamically using fetched tax rules
 */
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
    "totalIncome": <number - gross total income as clearly labeled in document>,
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
  "missedSavings": [
    {
      "section": "<e.g., '80C', '80D', 'NPS'>",
      "description": "<clear description>",
      "missedAmount": <number - unused limit>,
      "maxLimit": <number - max allowed>,
      "suggestion": "<specific actionable advice>"
    }
  ],
  "deductions": [
    {
      "category": "<e.g., 'EPF', 'Health Insurance'>",
      "section": "<e.g., '80C', '80D'>",
      "currentAmount": <number - claimed>,
      "maxLimit": <number>,
      "potentialSavings": <number>,
      "recommendation": "<advice>",
      "priority": "<'high' | 'medium' | 'low'>"
    }
  ],
  "recommendations": [
    "<general tax-saving tip>"
  ],
  "disclaimer": "This analysis is for informational purposes only. Consult a qualified CA/tax professional for personalized advice."
}

CALCULATION GUIDELINES:
- Apply tax slabs as per the rules above
- Add 4% Health & Education Cess
- Apply 87A rebate if applicable
- Identify ALL unutilized deduction limits as "missedSavings"
`;
}

function buildUSPrompt(taxRulesText: string): string {
  return `You are a Tax Expert helping people SAVE MONEY on taxes.

CURRENT TAX RULES (Source: Live GitHub Gist):
${taxRulesText}

IMPORTANT: The document has been redacted for privacy. "[REDACTED_SSN]" indicates Social Security Numbers that were removed for security.

**CRITICAL INSTRUCTION FOR US PAYSTUBS:**
Before calculating Annual Income, you MUST determine the Pay Frequency.
1. Look for "Pay Period" dates (e.g., 1/1/25 - 1/31/25 = Monthly).
2. If no dates, look at "Current Hours" or "Total Hours":
   - If Hours are approx 40: Assume WEEKLY (Multiplier: 52)
   - If Hours are approx 80-88: Assume BI-WEEKLY (Multiplier: 26)
   - If Hours are approx 86.67: Assume SEMI-MONTHLY (Multiplier: 24)
   - If Hours are approx 160-210: Assume MONTHLY (Multiplier: 12)

**STEP 1: ANALYZE WITHHOLDING**
- Calculate Annual Federal Withholding = (Fed Tax per period) × (Multiplier)
- Calculate expected tax liability based on 2024/2025 brackets
- If projected Refund > $3,000: Flag as "Over-withholding - you're giving IRS an interest-free loan"
- Calculate extra per-paycheck amount they could keep: Refund ÷ (number of pay periods)

**STEP 2: RETIREMENT CHECKS (401k & Match)**
- Identify ALL 401k-related deductions on the paystub
- IMPORTANT: Look for THREE types of contributions:

  A. TRADITIONAL (PRE-TAX) 401K:
     - Labels: "401K", "401(k)", "Employee 401K", "Retirement", "ADP 401K", "Pre-Tax 401K"

  B. ROTH 401K (POST-TAX):
     - Labels: "Roth 401K", "Roth 401(k)", "Roth", "After-Tax 401K", "Post-Tax 401K"
     - Taxed now, grows tax-free in retirement

  C. EMPLOYER MATCH:
     - Labels: "Employer 401K", "401K Match", "Company Match", "ER 401K", "Employer Contribution"
     - FREE MONEY - does NOT count toward $23,000 limit

- EMPLOYEE TOTAL = Traditional 401K + Roth 401K (BOTH count toward $23,000 limit!)
- Calculate Contribution % = (EMPLOYEE TOTAL / Gross Pay) × 100
- Calculate Annual Employee 401k = (per-period Traditional + Roth) × (Multiplier)
- If % < 3%: Warn "⚠️ Likely missing Employer Match (FREE MONEY). Most employers match 3-6%."
- If % < 15% and income allows: Suggest increasing to capture tax savings
- If maxing out ($23,000): Mark as "Strong Saver ✅"
- Calculate 401k Tax Savings = (Gap to $23,000) × (Marginal Tax Rate)

**STEP 3: THE "ROTH" & "IRA" CHECK**
- **Roth 401(k):** Check if the deduction says "Roth" or "Post-Tax"
  - If NOT present and User Tax Bracket is Low (10% or 12%), Suggest: "Consider switching to Roth 401(k) to pay tax now while rates are low."
- **Roth IRA (Private):** This will NOT be on the paystub.
  - Logic: If Annual Income < $161,000 (Single) or < $240,000 (Married), ADD this to recommendations:
    "✅ Missed Opportunity: You qualify for a Roth IRA. Open a private account and invest up to $7,000 post-tax for tax-free growth."

**STEP 4: HSA CHECK**
- Look for "HSA" deduction
- If HSA = $0 or not present, and any Medical/Health deduction exists:
  - Suggest: "Do you have a High Deductible Health Plan (HDHP)? If so, you're missing the HSA triple tax break."
- HSA Limits 2024: $4,150 (individual) / $8,300 (family)
- Calculate HSA Tax Savings = $4,150 × (Marginal Tax Rate)

**TAX BRACKETS FOR REFERENCE (Single Filers 2024):**
- $0 - $11,600: 10%
- $11,601 - $47,150: 12%
- $47,151 - $100,525: 22%
- $100,526 - $191,950: 24%
- $191,951 - $243,725: 32%
- $243,726 - $609,350: 35%
- Above $609,350: 37%

**CALCULATION EXAMPLE:**
Paystub shows: Gross $12,120, Fed Tax $1,167.09, 401k $121.20, Hours 202
- Pay Frequency: MONTHLY (202 hours)
- Annual Gross = $12,120 × 12 = $145,440
- Annual Fed Withholding = $1,167.09 × 12 = $14,005
- Annual 401k = $121.20 × 12 = $1,454 (only 1% of salary!)
- Marginal Rate: 24% (income $100,526-$191,950)
- 401k Gap = $23,000 - $1,454 = $21,546
- **401k potentialSavings = $21,546 × 0.24 = $5,171** ← THIS IS WHAT GOES IN deductions[0].potentialSavings
- **HSA potentialSavings = $4,150 × 0.24 = $996** ← THIS IS WHAT GOES IN deductions[1].potentialSavings
- **Roth IRA potentialSavings = $7,000** ← Investment opportunity, not tax savings
- Roth IRA: Qualifies (income < $161k)
- TOTAL summary.potentialSavings = $5,171 + $996 = $6,167

**OUTPUT FORMAT (JSON ONLY):**
{
  "summary": {
    "totalIncome": <ANNUAL gross income>,
    "currentTaxLiability": <ANNUAL federal withholding from paystub>,
    "potentialSavings": <total calculated tax savings>,
    "effectiveTaxRate": <fed withholding / gross × 100>
  },
  "payFrequencyDetected": "Monthly/Bi-Weekly/Weekly/Semi-Monthly",
  "calculationExplanation": "$X × Y = $Z annual gross income",
  "usComparison": {
    "current": {
      "grossIncome": <annual>,
      "federalWithholding": <annual>,
      "stateWithholding": <annual>,
      "fica": <annual SS + Medicare>,
      "totalDeductions": <annual 401k + HSA current>,
      "effectiveRate": <percentage>
    },
    "optimized": {
      "grossIncome": <same>,
      "federalWithholding": <REDUCED by potential savings>,
      "stateWithholding": <same>,
      "fica": <same>,
      "totalDeductions": <maxed 401k $23,000 + HSA $4,150>,
      "effectiveRate": <lower percentage>
    },
    "annualSavings": <total tax savings>
  },
  "missedSavings": [
    {
      "section": "401(k) Match",
      "description": "Contributing only X% - likely missing employer match",
      "missedAmount": <gap to recommended minimum 6%>,
      "maxLimit": 23000,
      "suggestion": "Increase to at least 6% to capture full employer match (FREE MONEY)"
    },
    {
      "section": "401(k) Max",
      "description": "Contributing $X/year vs $23,000 limit",
      "missedAmount": <gap to $23,000>,
      "maxLimit": 23000,
      "suggestion": "Increase 401(k) by $X/month to save $Y in federal taxes"
    },
    {
      "section": "HSA",
      "description": "No HSA contributions detected",
      "missedAmount": 4150,
      "maxLimit": 4150,
      "suggestion": "If you have HDHP, contribute $345/month to HSA for triple tax benefit"
    },
    {
      "section": "Roth IRA",
      "description": "You qualify for tax-free retirement growth",
      "missedAmount": 7000,
      "maxLimit": 7000,
      "suggestion": "Open a Roth IRA and contribute up to $7,000/year for tax-free growth in retirement"
    }
  ],
  "deductions": [
    {
      "category": "401(k) Retirement",
      "section": "Pre-tax",
      "currentAmount": <current annual 401k contribution>,
      "maxLimit": 23000,
      "potentialSavings": <TAX SAVINGS = (23000 - currentAmount) × marginalRate>,
      "recommendation": "Increase from X% to 15%+ of salary",
      "priority": "high"
    },
    {
      "category": "HSA",
      "section": "Pre-tax",
      "currentAmount": <current annual HSA, likely 0>,
      "maxLimit": 4150,
      "potentialSavings": <TAX SAVINGS = 4150 × marginalRate if currentAmount is 0>,
      "recommendation": "Open HSA if you have HDHP",
      "priority": "high"
    },
    {
      "category": "Roth IRA",
      "section": "Post-tax (Tax-free growth)",
      "currentAmount": 0,
      "maxLimit": 7000,
      "potentialSavings": 7000,
      "recommendation": "Open private Roth IRA - not a tax deduction but $7,000/year grows tax-FREE forever",
      "priority": "medium"
    }
  ],
  "recommendations": [
    "🚨 Increase 401(k) to at least 6% to get full employer match - this is FREE MONEY",
    "💰 Max out 401(k) at $1,917/month to save $5,171 in taxes",
    "🏥 Open HSA and contribute $345/month to save $996 in taxes (if you have HDHP)",
    "✅ Open Roth IRA - you qualify! Invest $7,000/year for tax-free growth",
    "📊 Total potential tax savings: $6,167/year"
  ],
  "disclaimer": "This analysis is for informational purposes only. Consult a qualified CPA for personalized advice."
}

**CRITICAL RULES - READ CAREFULLY:**
1. currentTaxLiability = ANNUAL federal withholding from paystub (Fed Tax × multiplier)
2. summary.potentialSavings = 401k tax savings + HSA tax savings (must be > $0 if not maxing out!)
3. deductions[0].potentialSavings (401k) = (23000 - annual401k) × marginalRate (e.g., $5,171 for 24% bracket)
4. deductions[1].potentialSavings (HSA) = 4150 × marginalRate (e.g., $996 for 24% bracket)
5. deductions[2].potentialSavings (Roth IRA) = 7000 (investment amount, not tax savings)
6. ALWAYS check Roth IRA eligibility based on income
7. ALWAYS flag if 401k contribution % is below typical employer match (3-6%)
8. Show specific dollar amounts and percentages in ALL recommendations
9. Use emojis in recommendations for better readability

**COMMON MISTAKES TO AVOID:**
- DON'T put $0 or tiny amounts for potentialSavings when 401k is below $23,000
- DON'T confuse contribution gap with tax savings (multiply gap by marginal rate!)
- DON'T forget to annualize all values (multiply by frequency multiplier)
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
  const apiKey = process.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Please add it in the ENV tab.'
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

  // Extract the text response
  const outputText = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response
  const jsonMatch = outputText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse tax analysis response');
  }

  const analysis: TaxAnalysisResult = JSON.parse(jsonMatch[0]);
  analysis.countryMode = countryMode;

  // POST-PROCESSING FOR US MODE: Fix deductions and calculate proper tax savings
  if (countryMode === 'us' && analysis.deductions && analysis.deductions.length > 0) {
    // Determine marginal tax rate based on income
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

    // Fix each deduction's potentialSavings
    analysis.deductions = analysis.deductions.map((deduction) => {
      const category = deduction.category?.toLowerCase() || '';
      const gap = Math.max(0, deduction.maxLimit - deduction.currentAmount);

      // Roth IRA is post-tax, so potentialSavings = investment amount, not tax savings
      if (category.includes('roth ira')) {
        deduction.potentialSavings = gap; // Investment opportunity, not tax savings
        // Don't add to totalTaxSavings
        return deduction;
      }

      // For 401k and HSA, calculate tax savings = gap × marginal rate
      if (category.includes('401') || category.includes('hsa')) {
        const taxSavings = Math.round(gap * marginalRate);

        // Only fix if current value is 0 or suspiciously low
        if (deduction.potentialSavings === 0 || deduction.potentialSavings < taxSavings * 0.5) {
          deduction.potentialSavings = taxSavings;
        }

        totalTaxSavings += deduction.potentialSavings;
      }

      return deduction;
    });

    // Update summary.potentialSavings if it's 0 or doesn't match calculated savings
    if (totalTaxSavings > 0 && (analysis.summary.potentialSavings === 0 || analysis.summary.potentialSavings < totalTaxSavings * 0.5)) {
      analysis.summary.potentialSavings = totalTaxSavings;
    }

    // Ensure usComparison.annualSavings matches
    if (analysis.usComparison) {
      analysis.usComparison.annualSavings = analysis.summary.potentialSavings;
    }
  }

  // POST-PROCESSING FOR INDIA MODE
  if (countryMode === 'india' && analysis.deductions && analysis.deductions.length > 0) {
    // Calculate total potential savings from all deductions
    const calculatedSavings = analysis.deductions.reduce((total, deduction) => {
      return total + (deduction.potentialSavings || 0);
    }, 0);

    // If AI returned 0 or very low savings but deductions show real savings, use calculated value
    if (calculatedSavings > 0 && (analysis.summary.potentialSavings === 0 || analysis.summary.potentialSavings < calculatedSavings * 0.5)) {
      analysis.summary.potentialSavings = calculatedSavings;
    }
  }

  // Also check missedSavings and sum those if potentialSavings is still 0
  if (analysis.summary.potentialSavings === 0 && analysis.missedSavings && analysis.missedSavings.length > 0) {
    // For US mode, estimate tax savings from missed amounts
    if (countryMode === 'us') {
      const annualIncome = analysis.summary.totalIncome || 0;
      let marginalRate = 0.24;
      if (annualIncome <= 47150) marginalRate = 0.12;
      else if (annualIncome <= 100525) marginalRate = 0.22;
      else if (annualIncome <= 191950) marginalRate = 0.24;
      else if (annualIncome <= 243725) marginalRate = 0.32;
      else marginalRate = 0.35;

      const estimatedSavings = analysis.missedSavings.reduce((total, item) => {
        // For 401k and HSA, multiply by marginal rate
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
