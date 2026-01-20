/**
 * Hook to fetch dynamic tax rules from GitHub Gists
 * Rules are fetched on app load and cached
 * Falls back to comprehensive embedded rules if fetch fails
 */

import { useQuery } from '@tanstack/react-query';
import { TAX_RULES_CONFIG } from './config';

export interface TaxRulesState {
  indiaRules: string | null;
  usRules: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isLive: boolean;
}

async function fetchTaxRules(url: string): Promise<string> {
  try {
    // Use a simple fetch without custom headers that might trigger CORS preflight
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tax rules: ${response.status}`);
    }

    return response.text();
  } catch (error) {
    // If fetch fails (CORS, network, etc.), throw to trigger fallback
    console.warn('Tax rules fetch failed, will use fallback:', error);
    throw error;
  }
}

export function useTaxRules(): TaxRulesState {
  // Fetch India rules - with disabled retry to fail fast to fallback
  const indiaQuery = useQuery({
    queryKey: ['taxRules', 'india'],
    queryFn: () => fetchTaxRules(TAX_RULES_CONFIG.INDIA_TAX_RULES_URL),
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: false, // Don't retry - just use fallback
    refetchOnWindowFocus: false,
  });

  // Fetch US rules
  const usQuery = useQuery({
    queryKey: ['taxRules', 'us'],
    queryFn: () => fetchTaxRules(TAX_RULES_CONFIG.US_TAX_RULES_URL),
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: false, // Don't retry - just use fallback
    refetchOnWindowFocus: false,
  });

  // Only show loading on initial fetch, not on background refetch
  const isLoading = (indiaQuery.isLoading && !indiaQuery.isFetched) ||
                    (usQuery.isLoading && !usQuery.isFetched);

  // Never show error state since we always have fallback rules
  // The Gist URLs might not exist, but that's fine - we have comprehensive embedded rules
  const isError = false;

  // Live status: both queries succeeded with fresh data
  const isLive = !!(
    indiaQuery.isSuccess &&
    usQuery.isSuccess &&
    indiaQuery.data &&
    usQuery.data
  );

  return {
    // Always return data (fetched if available, otherwise fallback)
    indiaRules: indiaQuery.data || FALLBACK_INDIA_RULES,
    usRules: usQuery.data || FALLBACK_US_RULES,
    isLoading,
    isError,
    error: null, // Never expose error - graceful degradation
    isLive,
  };
}

/**
 * Comprehensive fallback rules for India FY 2024-25
 * Used when GitHub Gist fetch fails
 */
export const FALLBACK_INDIA_RULES = `
*** INDIA TAX SLABS FY 2024-25 (AY 2025-26) ***
** UPDATED PER JULY 2024 UNION BUDGET **

-------------------------------------------------------
OPTION A: NEW TAX REGIME (Default & Revised)
-------------------------------------------------------
Basic Exemption Limit: ₹3,00,000
Standard Deduction (Salaried): ₹75,000 (Increased from ₹50k)
Rebate u/s 87A: Available if Taxable Income <= ₹7,00,000.
(Effectively zero tax for salary up to ₹7.75 Lakhs)

SLAB RATES (NEW REGIME):
1. Up to ₹3,00,000          : NIL
2. ₹3,00,001 to ₹7,00,000   : 5%
3. ₹7,00,001 to ₹10,00,000  : 10%
4. ₹10,00,001 to ₹12,00,000 : 15%
5. ₹12,00,001 to ₹15,00,000 : 20%
6. Above ₹15,00,000         : 30%

SURCHARGE (NEW REGIME):
- Income > ₹50L to ₹1Cr: 10%
- Income > ₹1Cr to ₹2Cr: 15%
- Income > ₹2Cr: 25% (Capped at 25%)

-------------------------------------------------------
OPTION B: OLD TAX REGIME (Optional)
-------------------------------------------------------
Basic Exemption Limit: ₹2,50,000 (Age < 60)
Standard Deduction (Salaried): ₹50,000
Rebate u/s 87A: Available if Taxable Income <= ₹5,00,000.

SLAB RATES (OLD REGIME - Age < 60):
1. Up to ₹2,50,000          : NIL
2. ₹2,50,001 to ₹5,00,000   : 5%
3. ₹5,00,001 to ₹10,00,000  : 20%
4. Above ₹10,00,000         : 30%

SENIOR CITIZENS (60-80 Years):
- Basic Exemption: ₹3,00,000
- 3L-5L: 5% | 5L-10L: 20% | >10L: 30%

-------------------------------------------------------
COMMON RULES (BOTH REGIMES)
-------------------------------------------------------
- Health & Education Cess: 4% on (Tax + Surcharge)

*** INDIA INCOME TAX DEDUCTION RULES (FY 2024-25) ***

-------------------------------------------------------
1. STANDARD DEDUCTION (Section 16)
-------------------------------------------------------
- New Regime: Flat ₹75,000 (Applicable for Salary/Pension)
- Old Regime: Flat ₹50,000

-------------------------------------------------------
2. SECTION 80C (Investments) - OLD REGIME ONLY
-------------------------------------------------------
Maximum Limit: ₹1.5 Lakhs (Combined)
Eligible Items:
- EPF (Employee Provident Fund) - Employee Share
- PPF (Public Provident Fund)
- ELSS (Equity Linked Savings Scheme) Mutual Funds
- LIC / Life Insurance Premiums
- Principal Repayment of Home Loan
- Sukanya Samriddhi Yojana (SSY)
- Children's Tuition Fees (Max 2 children)
- 5-Year Tax Saver FD

-------------------------------------------------------
3. SECTION 80D (Health Insurance) - OLD REGIME ONLY
-------------------------------------------------------
A. Self, Spouse & Children:
   - Limit: ₹25,000 (Age < 60)
   - Limit: ₹50,000 (Senior Citizen, Age 60+)

B. Parents:
   - Limit: ₹25,000 (Parents Age < 60)
   - Limit: ₹50,000 (Parents Senior Citizen)

-------------------------------------------------------
4. HRA (House Rent Allowance) - OLD REGIME ONLY
-------------------------------------------------------
Exemption is the LOWEST of:
1. Actual HRA Received
2. Rent Paid minus 10% of Basic Salary (+ DA)
3. 50% of Basic Salary (Metro Cities) or 40% (Non-Metro)

-------------------------------------------------------
5. SECTION 80CCD (1B) (NPS) - OLD REGIME ONLY
-------------------------------------------------------
- Additional deduction for National Pension System (NPS).
- Limit: ₹50,000 (Over and above the ₹1.5L 80C limit).

-------------------------------------------------------
6. SECTION 24(b) (Home Loan Interest) - OLD REGIME ONLY
-------------------------------------------------------
- Self-Occupied Property: Max deduction ₹2 Lakhs.
`;

/**
 * Comprehensive fallback rules for US 2024
 * Used when GitHub Gist fetch fails
 */
export const FALLBACK_US_RULES = `
*** US FEDERAL TAX BRACKETS 2024 ***

-------------------------------------------------------
SINGLE FILERS
-------------------------------------------------------
1. $0 - $11,600: 10%
2. $11,601 - $47,150: 12%
3. $47,151 - $100,525: 22%
4. $100,526 - $191,950: 24%
5. $191,951 - $243,725: 32%
6. $243,726 - $609,350: 35%
7. Above $609,350: 37%

-------------------------------------------------------
MARRIED FILING JOINTLY
-------------------------------------------------------
1. $0 - $23,200: 10%
2. $23,201 - $94,300: 12%
3. $94,301 - $201,050: 22%
4. $201,051 - $383,900: 24%
5. $383,901 - $487,450: 32%
6. $487,451 - $731,200: 35%
7. Above $731,200: 37%

-------------------------------------------------------
STANDARD DEDUCTION 2024
-------------------------------------------------------
- Single: $14,600
- Married Filing Jointly: $29,200
- Head of Household: $21,900

-------------------------------------------------------
FICA TAXES (Social Security & Medicare)
-------------------------------------------------------
- Social Security: 6.2% (up to $168,600 wage base)
- Medicare: 1.45% (no limit)
- Additional Medicare: 0.9% (income over $200k single / $250k married)

-------------------------------------------------------
KEY TAX OPTIMIZATION OPPORTUNITIES
-------------------------------------------------------

1. W-4 WITHHOLDING CHECK
   - Compare YTD withholding to projected tax liability
   - Over-withholding = giving IRS interest-free loan
   - Under-withholding by more than $1,000 = penalties

2. 401(k) CONTRIBUTIONS
   - 2024 Limit: $23,000 (under 50) / $30,500 (50+)
   - Employer Match: FREE MONEY - always maximize
   - Traditional: Pre-tax, reduces current taxable income
   - Roth 401(k): Post-tax, tax-free growth

3. HSA (Health Savings Account)
   - 2024 Limits: $4,150 (individual) / $8,300 (family)
   - Catch-up (55+): Additional $1,000
   - Triple tax advantage: Deductible, grows tax-free, tax-free for medical
   - Requires HDHP (High Deductible Health Plan)

4. IRA CONTRIBUTIONS
   - Traditional IRA: $7,000 limit ($8,000 if 50+)
   - Roth IRA: Same limits, income restrictions apply

5. FSA (Flexible Spending Account)
   - Healthcare FSA: $3,200 (2024)
   - Dependent Care FSA: $5,000
`;
