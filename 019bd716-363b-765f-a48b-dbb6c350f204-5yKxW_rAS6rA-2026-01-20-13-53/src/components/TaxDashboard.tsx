import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { cn } from '@/lib/cn';
import type { TaxAnalysisResult, TaxSavingsItem, MissedSavingsItem, RegimeComparison, USComparison } from '@/lib/tax-analysis';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info, AlertTriangle, Scale } from 'lucide-react-native';

interface TaxDashboardProps {
  analysis: TaxAnalysisResult;
}

function formatCurrency(amount: number, mode: 'india' | 'us' = 'india'): string {
  if (mode === 'us') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function SummaryCard({
  title,
  value,
  subtitle,
  trend,
  highlight,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  highlight?: boolean;
}) {
  return (
    <View className={cn(
      "rounded-2xl p-4 flex-1 min-w-[140px] shadow-sm border",
      highlight
        ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700"
        : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
    )}>
      <Text className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">
        {title}
      </Text>
      <View className="flex-row items-center mt-1">
        <Text className={cn(
          "text-xl font-bold",
          highlight ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-white"
        )}>
          {value}
        </Text>
        {trend === 'up' && (
          <TrendingUp size={16} color="#22c55e" style={{ marginLeft: 4 }} />
        )}
        {trend === 'down' && (
          <TrendingDown size={16} color="#ef4444" style={{ marginLeft: 4 }} />
        )}
      </View>
      {subtitle && (
        <Text className="text-gray-400 dark:text-gray-500 text-xs mt-1">
          {subtitle}
        </Text>
      )}
    </View>
  );
}

function RegimeComparisonTable({ comparison, mode }: { comparison: RegimeComparison; mode: 'india' | 'us' }) {
  const { oldRegime, newRegime, recommendation, savingsWithRecommended } = comparison;

  const rows = [
    { label: 'Gross Income', old: oldRegime.grossIncome, new: newRegime.grossIncome },
    { label: 'Deductions', old: oldRegime.totalDeductions, new: newRegime.standardDeduction, isDeduction: true },
    { label: 'Taxable Income', old: oldRegime.taxableIncome, new: newRegime.taxableIncome },
    { label: 'Tax (before cess)', old: oldRegime.taxBeforeCess, new: newRegime.taxBeforeCess },
    { label: 'Cess (4%)', old: oldRegime.cess, new: newRegime.cess },
    { label: 'Total Tax', old: oldRegime.totalTax, new: newRegime.totalTax, isTotal: true },
  ];

  const isBetterOld = recommendation === 'OLD';

  return (
    <View className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 mb-4">
      {/* Header */}
      <View className="flex-row bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
        <View className="flex-1 p-3">
          <Text className="text-gray-500 dark:text-gray-400 text-xs font-medium">
            Particulars
          </Text>
        </View>
        <View className={cn(
          "flex-1 p-3 items-end",
          isBetterOld && "bg-emerald-50 dark:bg-emerald-900/20"
        )}>
          <Text className={cn(
            "text-xs font-bold",
            isBetterOld ? "text-emerald-700 dark:text-emerald-300" : "text-gray-500 dark:text-gray-400"
          )}>
            OLD REGIME
          </Text>
          {isBetterOld && (
            <View className="bg-emerald-500 px-2 py-0.5 rounded mt-1">
              <Text className="text-white text-[10px] font-bold">RECOMMENDED</Text>
            </View>
          )}
        </View>
        <View className={cn(
          "flex-1 p-3 items-end",
          !isBetterOld && "bg-emerald-50 dark:bg-emerald-900/20"
        )}>
          <Text className={cn(
            "text-xs font-bold",
            !isBetterOld ? "text-emerald-700 dark:text-emerald-300" : "text-gray-500 dark:text-gray-400"
          )}>
            NEW REGIME
          </Text>
          {!isBetterOld && (
            <View className="bg-emerald-500 px-2 py-0.5 rounded mt-1">
              <Text className="text-white text-[10px] font-bold">RECOMMENDED</Text>
            </View>
          )}
        </View>
      </View>

      {/* Rows */}
      {rows.map((row) => (
        <View
          key={row.label}
          className={cn(
            "flex-row border-b border-gray-50 dark:border-gray-700/50",
            row.isTotal && "bg-gray-50 dark:bg-gray-700/30"
          )}
        >
          <View className="flex-1 p-3 justify-center">
            <Text className={cn(
              "text-sm",
              row.isTotal ? "font-bold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"
            )}>
              {row.label}
            </Text>
          </View>
          <View className={cn(
            "flex-1 p-3 items-end justify-center",
            isBetterOld && "bg-emerald-50/50 dark:bg-emerald-900/10"
          )}>
            <Text className={cn(
              "text-sm",
              row.isTotal ? "font-bold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-200",
              row.isDeduction && "text-red-600 dark:text-red-400"
            )}>
              {row.isDeduction ? `-${formatCurrency(row.old, mode)}` : formatCurrency(row.old, mode)}
            </Text>
          </View>
          <View className={cn(
            "flex-1 p-3 items-end justify-center",
            !isBetterOld && "bg-emerald-50/50 dark:bg-emerald-900/10"
          )}>
            <Text className={cn(
              "text-sm",
              row.isTotal ? "font-bold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-200",
              row.isDeduction && "text-red-600 dark:text-red-400"
            )}>
              {row.isDeduction ? `-${formatCurrency(row.new, mode)}` : formatCurrency(row.new, mode)}
            </Text>
          </View>
        </View>
      ))}

      {/* Savings Banner */}
      <View className="bg-emerald-500 p-4 flex-row items-center justify-center">
        <Scale size={18} color="white" />
        <Text className="text-white font-bold ml-2">
          Save {formatCurrency(savingsWithRecommended, mode)} with {recommendation} Regime
        </Text>
      </View>
    </View>
  );
}

function USComparisonTable({ comparison }: { comparison: USComparison }) {
  const { current, optimized, annualSavings } = comparison;

  const rows = [
    { label: 'Gross Income', current: current.grossIncome, optimized: optimized.grossIncome },
    { label: 'Federal Withholding', current: current.federalWithholding, optimized: optimized.federalWithholding },
    { label: 'State Withholding', current: current.stateWithholding, optimized: optimized.stateWithholding },
    { label: 'FICA (SS + Medicare)', current: current.fica, optimized: optimized.fica },
    { label: 'Pre-tax Deductions', current: current.totalDeductions, optimized: optimized.totalDeductions, isDeduction: true },
    { label: 'Effective Rate', current: current.effectiveRate, optimized: optimized.effectiveRate, isPercent: true },
  ];

  return (
    <View className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 mb-4">
      {/* Header */}
      <View className="flex-row bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
        <View className="flex-1 p-3">
          <Text className="text-gray-500 dark:text-gray-400 text-xs font-medium">
            Category
          </Text>
        </View>
        <View className="flex-1 p-3 items-end">
          <Text className="text-gray-500 dark:text-gray-400 text-xs font-bold">
            CURRENT
          </Text>
        </View>
        <View className="flex-1 p-3 items-end bg-emerald-50 dark:bg-emerald-900/20">
          <Text className="text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            OPTIMIZED
          </Text>
          <View className="bg-emerald-500 px-2 py-0.5 rounded mt-1">
            <Text className="text-white text-[10px] font-bold">RECOMMENDED</Text>
          </View>
        </View>
      </View>

      {/* Rows */}
      {rows.map((row) => (
        <View
          key={row.label}
          className="flex-row border-b border-gray-50 dark:border-gray-700/50"
        >
          <View className="flex-1 p-3 justify-center">
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              {row.label}
            </Text>
          </View>
          <View className="flex-1 p-3 items-end justify-center">
            <Text className={cn(
              "text-sm text-gray-700 dark:text-gray-200",
              row.isDeduction && "text-red-600 dark:text-red-400"
            )}>
              {row.isPercent
                ? `${row.current.toFixed(1)}%`
                : row.isDeduction
                  ? `-${formatCurrency(row.current, 'us')}`
                  : formatCurrency(row.current, 'us')}
            </Text>
          </View>
          <View className="flex-1 p-3 items-end justify-center bg-emerald-50/50 dark:bg-emerald-900/10">
            <Text className={cn(
              "text-sm text-gray-700 dark:text-gray-200",
              row.isDeduction && "text-emerald-600 dark:text-emerald-400"
            )}>
              {row.isPercent
                ? `${row.optimized.toFixed(1)}%`
                : row.isDeduction
                  ? `-${formatCurrency(row.optimized, 'us')}`
                  : formatCurrency(row.optimized, 'us')}
            </Text>
          </View>
        </View>
      ))}

      {/* Savings Banner */}
      <View className="bg-emerald-500 p-4 flex-row items-center justify-center">
        <TrendingUp size={18} color="white" />
        <Text className="text-white font-bold ml-2">
          Potential Annual Savings: {formatCurrency(annualSavings, 'us')}
        </Text>
      </View>
    </View>
  );
}

function MissedSavingsSection({ missedSavings, mode }: { missedSavings: MissedSavingsItem[]; mode: 'india' | 'us' }) {
  if (!missedSavings || missedSavings.length === 0) return null;

  return (
    <View className="mb-6">
      <View className="flex-row items-center mb-3">
        <AlertTriangle size={20} color="#f59e0b" />
        <Text className="text-gray-900 dark:text-white text-lg font-bold ml-2">
          Missed Savings
        </Text>
      </View>

      {missedSavings.map((item, index) => (
        <View
          key={`${item.section}-${index}`}
          className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-3 border border-amber-100 dark:border-amber-800"
        >
          {/* Header row with section badge and amount */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="bg-amber-500 px-2 py-0.5 rounded">
              <Text className="text-white text-xs font-bold">{item.section}</Text>
            </View>
            <View className="items-end">
              <Text className="text-amber-600 dark:text-amber-400 text-xs">Missed</Text>
              <Text className="text-amber-700 dark:text-amber-300 font-bold text-lg">
                {formatCurrency(item.missedAmount, mode)}
              </Text>
            </View>
          </View>

          {/* Description on its own line */}
          <Text className="text-amber-800 dark:text-amber-200 font-semibold text-sm mb-2">
            {item.description}
          </Text>

          <View className="flex-row items-start bg-amber-100/50 dark:bg-amber-800/30 rounded-lg p-2">
            <Info size={14} color="#92400e" style={{ marginTop: 2, marginRight: 8, flexShrink: 0 }} />
            <Text className="text-amber-800 dark:text-amber-300 text-sm flex-1">
              {item.suggestion}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PriorityBadge({ priority }: { priority: TaxSavingsItem['priority'] }) {
  const colors = {
    high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  };

  return (
    <View className={cn('px-2 py-0.5 rounded-full', colors[priority])}>
      <Text className={cn('text-xs font-medium capitalize', colors[priority].split(' ').slice(2).join(' '))}>
        {priority}
      </Text>
    </View>
  );
}

function DeductionRow({ item, mode }: { item: TaxSavingsItem; mode: 'india' | 'us' }) {
  const utilizationPercent = item.maxLimit > 0
    ? Math.min(100, (item.currentAmount / item.maxLimit) * 100)
    : 0;

  const is401k = item.category?.toLowerCase().includes('401');
  const employerMatch = (item as { employerMatch?: number }).employerMatch;
  const traditionalAmount = (item as { traditionalAmount?: number }).traditionalAmount;
  const rothAmount = (item as { rothAmount?: number }).rothAmount;
  const hasBreakdown = traditionalAmount !== undefined || rothAmount !== undefined;

  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-100 dark:border-gray-700">
      {/* Header with priority badge */}
      <View className="flex-row items-start justify-between mb-1">
        <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
          {item.section}
        </Text>
        <PriorityBadge priority={item.priority} />
      </View>

      {/* Category name on its own line */}
      <Text className="text-gray-900 dark:text-white font-semibold text-base mb-3">
        {item.category}
      </Text>

      {/* 401k breakdown: Traditional vs Roth */}
      {is401k && hasBreakdown && (
        <View className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-3">
          <Text className="text-blue-700 dark:text-blue-300 text-xs font-medium mb-2">
            Your Contributions Breakdown
          </Text>
          <View className="flex-row justify-between">
            {traditionalAmount !== undefined && (
              <View>
                <Text className="text-gray-500 dark:text-gray-400 text-xs">Traditional (Pre-tax)</Text>
                <Text className="text-gray-900 dark:text-white font-medium">
                  {formatCurrency(traditionalAmount, mode)}
                </Text>
              </View>
            )}
            {rothAmount !== undefined && rothAmount > 0 && (
              <View className="items-center">
                <Text className="text-gray-500 dark:text-gray-400 text-xs">Roth (Post-tax)</Text>
                <Text className="text-gray-900 dark:text-white font-medium">
                  {formatCurrency(rothAmount, mode)}
                </Text>
              </View>
            )}
            <View className="items-end">
              <Text className="text-gray-500 dark:text-gray-400 text-xs">Your Total</Text>
              <Text className="text-blue-700 dark:text-blue-300 font-bold">
                {formatCurrency(item.currentAmount, mode)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View className="flex-row justify-between mb-2">
        <View>
          <Text className="text-gray-500 dark:text-gray-400 text-xs">
            {is401k ? 'Your Contribution' : 'Used'}
          </Text>
          <Text className="text-gray-900 dark:text-white font-medium">
            {formatCurrency(item.currentAmount, mode)}
          </Text>
        </View>
        {is401k && employerMatch !== undefined && employerMatch > 0 && (
          <View className="items-center">
            <Text className="text-gray-500 dark:text-gray-400 text-xs">Employer Match</Text>
            <Text className="text-emerald-600 dark:text-emerald-400 font-medium">
              +{formatCurrency(employerMatch, mode)}
            </Text>
          </View>
        )}
        <View className="items-center">
          <Text className="text-gray-500 dark:text-gray-400 text-xs">Limit</Text>
          <Text className="text-gray-900 dark:text-white font-medium">
            {formatCurrency(item.maxLimit, mode)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-gray-500 dark:text-gray-400 text-xs">Potential</Text>
          <Text className="text-emerald-600 dark:text-emerald-400 font-bold">
            +{formatCurrency(item.potentialSavings, mode)}
          </Text>
        </View>
      </View>

      {/* Total 401k row when employer match exists */}
      {is401k && employerMatch !== undefined && employerMatch > 0 && (
        <View className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 mb-2">
          <View className="flex-row justify-between items-center">
            <Text className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">
              Total 401(k) (You + Employer)
            </Text>
            <Text className="text-emerald-700 dark:text-emerald-300 text-sm font-bold">
              {formatCurrency(item.currentAmount + employerMatch, mode)}
            </Text>
          </View>
        </View>
      )}

      {/* Progress bar */}
      <View className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
        <View
          className="h-full bg-emerald-500 rounded-full"
          style={{ width: `${utilizationPercent}%` }}
        />
      </View>
      <Text className="text-gray-400 dark:text-gray-500 text-xs mt-1">
        {utilizationPercent.toFixed(0)}% of limit utilized
      </Text>

      <View className="flex-row items-start mt-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
        <Info size={14} color="#6b7280" style={{ marginTop: 2, marginRight: 8, flexShrink: 0 }} />
        <Text className="text-gray-600 dark:text-gray-300 text-sm flex-1">
          {item.recommendation}
        </Text>
      </View>
    </View>
  );
}

export function TaxDashboard({ analysis }: TaxDashboardProps) {
  const { summary, regimeComparison, usComparison, payFrequencyDetected, calculationExplanation, missedSavings, deductions, recommendations, disclaimer, countryMode } = analysis;
  const mode = countryMode || 'india';

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Pay Frequency Banner - US only */}
      {mode === 'us' && payFrequencyDetected && (
        <View className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-4 border border-blue-100 dark:border-blue-800">
          <View className="flex-row items-center mb-2">
            <Info size={16} color="#3b82f6" />
            <Text className="text-blue-700 dark:text-blue-300 font-semibold ml-2">
              Pay Frequency: {payFrequencyDetected}
            </Text>
          </View>
          {calculationExplanation && (
            <Text className="text-blue-600 dark:text-blue-400 text-sm">
              {calculationExplanation}
            </Text>
          )}
        </View>
      )}

      {/* Summary Cards */}
      <View className="mb-6">
        <Text className="text-gray-900 dark:text-white text-lg font-bold mb-3">
          Tax Summary
        </Text>
        <View className="flex-row flex-wrap gap-3">
          <SummaryCard
            title="Total Income"
            value={formatCurrency(summary.totalIncome, mode)}
            subtitle={mode === 'india' ? 'FY 2024-25' : '2024'}
          />
          <SummaryCard
            title="Current Tax"
            value={formatCurrency(summary.currentTaxLiability, mode)}
            trend="down"
          />
        </View>
        <View className="flex-row flex-wrap gap-3 mt-3">
          <SummaryCard
            title="Potential Savings"
            value={formatCurrency(summary.potentialSavings, mode)}
            subtitle="If optimized"
            trend="up"
            highlight
          />
          <SummaryCard
            title="Tax Rate"
            value={`${summary.effectiveTaxRate.toFixed(1)}%`}
            subtitle="Effective"
          />
        </View>
      </View>

      {/* Regime Comparison - India */}
      {regimeComparison && mode === 'india' && (
        <View className="mb-6">
          <Text className="text-gray-900 dark:text-white text-lg font-bold mb-3">
            Old vs New Regime Comparison
          </Text>
          <RegimeComparisonTable comparison={regimeComparison} mode={mode} />
        </View>
      )}

      {/* US Comparison */}
      {usComparison && mode === 'us' && (
        <View className="mb-6">
          <Text className="text-gray-900 dark:text-white text-lg font-bold mb-3">
            Current vs Optimized Analysis
          </Text>
          <USComparisonTable comparison={usComparison} />
        </View>
      )}

      {/* Missed Savings */}
      <MissedSavingsSection missedSavings={missedSavings} mode={mode} />

      {/* Deductions Table */}
      {deductions && deductions.length > 0 && (
        <View className="mb-6">
          <Text className="text-gray-900 dark:text-white text-lg font-bold mb-3">
            Deduction Details
          </Text>
          {deductions.map((item, index) => (
            <DeductionRow key={`${item.section}-${index}`} item={item} mode={mode} />
          ))}
        </View>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <View className="mb-6">
          <Text className="text-gray-900 dark:text-white text-lg font-bold mb-3">
            Action Items
          </Text>
          <View className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800">
            {recommendations.map((rec, index) => (
              <View key={index} className="flex-row items-start mb-2 last:mb-0">
                <CheckCircle
                  size={16}
                  color="#10b981"
                  style={{ marginTop: 2, marginRight: 8 }}
                />
                <Text className="text-gray-700 dark:text-gray-200 flex-1 text-sm">
                  {rec}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Disclaimer */}
      <View className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
        <View className="flex-row items-start">
          <AlertCircle
            size={16}
            color="#f59e0b"
            style={{ marginTop: 2, marginRight: 8 }}
          />
          <Text className="text-amber-700 dark:text-amber-300 flex-1 text-xs">
            {disclaimer}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
