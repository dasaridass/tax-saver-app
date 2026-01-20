/**
 * Configuration for Tax Optimizer
 * Dynamic tax rules fetched from GitHub Gists
 */

export const TAX_RULES_CONFIG = {
  INDIA_TAX_RULES_URL:
    'https://gist.githubusercontent.com/dasaridass/b98cc7c9daf81491353f2048942abed8/raw/India_Tax_Slabs_FY24-25.txt',
  US_TAX_RULES_URL:
    'https://gist.githubusercontent.com/dasaridass/b98cc7c9daf81491353f2048942abed8/raw/US_Tax_Rules_2025.txt',
} as const;
