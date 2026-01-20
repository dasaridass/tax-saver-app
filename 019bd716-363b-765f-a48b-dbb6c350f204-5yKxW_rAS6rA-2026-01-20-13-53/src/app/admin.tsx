import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Lock, Unlock, Trash2, Users, TrendingUp, Calendar, Globe, ArrowLeft, RotateCcw, Download } from 'lucide-react-native';
import { useTaxStore, type Lead } from '@/lib/state/tax-store';

const ADMIN_PASSWORD = 'admin123';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number, mode: 'india' | 'us'): string {
  if (mode === 'india') {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  } else {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

function PasswordModal({
  visible,
  onSubmit,
  onClose,
  error,
}: {
  visible: boolean;
  onSubmit: (password: string) => void;
  onClose: () => void;
  error: string | null;
}) {
  const [password, setPassword] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/60">
        <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 mx-6 max-w-sm w-full">
          <View className="items-center mb-4">
            <View className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center">
              <Lock size={28} color="#f59e0b" />
            </View>
          </View>

          <Text className="text-gray-900 dark:text-white text-xl font-bold text-center mb-2">
            Admin Access
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">
            Enter the admin password to continue
          </Text>

          <TextInput
            className="bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-base mb-3"
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error && (
            <Text className="text-red-500 text-sm mb-3 text-center">{error}</Text>
          )}

          <View className="flex-row gap-3">
            <Pressable
              onPress={onClose}
              className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700"
            >
              <Text className="text-gray-600 dark:text-gray-300 font-medium text-center">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(password)}
              className="flex-1 py-3 rounded-xl bg-amber-500 active:bg-amber-600"
            >
              <Text className="text-white font-bold text-center">Login</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatsCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <View
        className="w-10 h-10 rounded-full items-center justify-center mb-2"
        style={{ backgroundColor: color + '20' }}
      >
        {icon}
      </View>
      <Text className="text-gray-500 dark:text-gray-400 text-xs uppercase">
        {label}
      </Text>
      <Text className="text-gray-900 dark:text-white text-xl font-bold">
        {value}
      </Text>
    </View>
  );
}

function LeadRow({ lead, onDelete }: { lead: Lead; onDelete: (id: string) => void }) {
  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-100 dark:border-gray-700">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-900 dark:text-white font-medium flex-1" numberOfLines={1}>
          {lead.email}
        </Text>
        <Pressable
          onPress={() => onDelete(lead.id)}
          className="w-8 h-8 items-center justify-center"
        >
          <Trash2 size={16} color="#ef4444" />
        </Pressable>
      </View>

      <View className="flex-row items-center gap-4">
        <View className="flex-row items-center">
          <Calendar size={12} color="#6b7280" />
          <Text className="text-gray-500 dark:text-gray-400 text-xs ml-1">
            {formatDate(lead.date)}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Globe size={12} color="#6b7280" />
          <Text className="text-gray-500 dark:text-gray-400 text-xs ml-1 uppercase">
            {lead.mode === 'india' ? '🇮🇳 India' : '🇺🇸 US'}
          </Text>
        </View>

        <View className="flex-row items-center">
          <TrendingUp size={12} color="#10b981" />
          <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-medium ml-1">
            {formatCurrency(lead.estimatedSavings, lead.mode)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const leads = useTaxStore((s) => s.leads);
  const clearLeads = useTaxStore((s) => s.clearLeads);
  const setLastReportTimestamp = useTaxStore((s) => s.setLastReportTimestamp);

  // Download leads as CSV
  const handleDownloadCSV = useCallback(() => {
    if (leads.length === 0 || Platform.OS !== 'web') return;

    // CSV Header
    const headers = ['Email', 'Date', 'Country', 'Estimated Savings', 'Currency'];

    // CSV Rows
    const rows = leads.map((lead) => {
      const date = new Date(lead.date).toISOString();
      const country = lead.mode === 'india' ? 'India' : 'US';
      const currency = lead.mode === 'india' ? 'INR' : 'USD';
      return [
        lead.email,
        date,
        country,
        lead.estimatedSavings.toString(),
        currency,
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `taxsaver_leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [leads]);

  const handlePasswordSubmit = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setPasswordError(null);
    } else {
      setPasswordError('Incorrect password');
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleDeleteLead = (id: string) => {
    // Since we don't have a deleteLead function, we'd need to add it
    // For now, this is a placeholder
    console.log('Delete lead:', id);
  };

  // Stats calculations
  const totalLeads = leads.length;
  const indiaLeads = leads.filter((l) => l.mode === 'india').length;
  const usLeads = leads.filter((l) => l.mode === 'us').length;
  const totalSavings = leads.reduce((sum, l) => sum + l.estimatedSavings, 0);

  if (!isAuthenticated) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PasswordModal
          visible={showPasswordModal}
          onSubmit={handlePasswordSubmit}
          onClose={handleClose}
          error={passwordError}
        />
        <View className="flex-1 bg-gray-50 dark:bg-gray-900" />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <Pressable
            onPress={handleClose}
            className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mr-3"
          >
            <ArrowLeft size={20} color="#6b7280" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-gray-900 dark:text-white text-xl font-bold">
              Admin Dashboard
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-sm">
              Lead Management
            </Text>
          </View>
          <View className="flex-row items-center bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-full">
            <Unlock size={14} color="#10b981" />
            <Text className="text-emerald-700 dark:text-emerald-400 text-xs font-medium ml-1">
              Authenticated
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-5 pt-4">
          {/* Stats Grid */}
          <View className="flex-row gap-3 mb-6">
            <StatsCard
              icon={<Users size={20} color="#3b82f6" />}
              label="Total Leads"
              value={totalLeads.toString()}
              color="#3b82f6"
            />
            <StatsCard
              icon={<TrendingUp size={20} color="#10b981" />}
              label="Avg Savings"
              value={totalLeads > 0 ? `$${Math.round(totalSavings / totalLeads)}` : '$0'}
              color="#10b981"
            />
          </View>

          <View className="flex-row gap-3 mb-6">
            <StatsCard
              icon={<Text style={{ fontSize: 18 }}>🇮🇳</Text>}
              label="India Leads"
              value={indiaLeads.toString()}
              color="#f97316"
            />
            <StatsCard
              icon={<Text style={{ fontSize: 18 }}>🇺🇸</Text>}
              label="US Leads"
              value={usLeads.toString()}
              color="#3b82f6"
            />
          </View>

          {/* Testing Tools */}
          <View className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6 border border-amber-100 dark:border-amber-800">
            <Text className="text-amber-800 dark:text-amber-300 font-medium mb-2">
              Testing Tools
            </Text>
            <Pressable
              onPress={() => setLastReportTimestamp(null)}
              className="flex-row items-center justify-center bg-amber-100 dark:bg-amber-800/50 py-2.5 px-4 rounded-lg"
            >
              <RotateCcw size={16} color="#d97706" />
              <Text className="text-amber-700 dark:text-amber-300 font-medium ml-2">
                Reset Rate Limit
              </Text>
            </Pressable>
          </View>

          {/* Leads List */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-900 dark:text-white text-lg font-bold">
              Captured Leads
            </Text>
            {leads.length > 0 && (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleDownloadCSV}
                  className="flex-row items-center bg-emerald-100 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg"
                >
                  <Download size={14} color="#10b981" />
                  <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-medium ml-1">
                    Export CSV
                  </Text>
                </Pressable>
                <Pressable
                  onPress={clearLeads}
                  className="flex-row items-center bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-lg"
                >
                  <Trash2 size={14} color="#ef4444" />
                  <Text className="text-red-600 dark:text-red-400 text-xs font-medium ml-1">
                    Clear All
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {leads.length === 0 ? (
            <View className="bg-white dark:bg-gray-800 rounded-xl p-8 items-center border border-gray-100 dark:border-gray-700">
              <Users size={40} color="#9ca3af" />
              <Text className="text-gray-500 dark:text-gray-400 text-center mt-3">
                No leads captured yet
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-sm text-center mt-1">
                Leads will appear here when users unlock reports
              </Text>
            </View>
          ) : (
            <View className="pb-8">
              {leads
                .slice()
                .reverse()
                .map((lead) => (
                  <LeadRow key={lead.id} lead={lead} onDelete={handleDeleteLead} />
                ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
