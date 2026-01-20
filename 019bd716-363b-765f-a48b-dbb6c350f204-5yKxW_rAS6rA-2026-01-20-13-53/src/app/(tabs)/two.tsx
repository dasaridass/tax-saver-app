import { Text, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Info, Lock, Settings as SettingsIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTaxStore } from '@/lib/state/tax-store';

export default function SettingsScreen() {
  const [adminTapCount, setAdminTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countryMode = useTaxStore((s) => s.countryMode);

  // Navigate to admin when tap count reaches 5
  useEffect(() => {
    if (adminTapCount >= 5) {
      setAdminTapCount(0);
      router.push('/admin');
    }
  }, [adminTapCount]);

  const handleVersionTap = useCallback(() => {
    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    setAdminTapCount((prev) => prev + 1);

    // Reset tap count after 2 seconds of no tapping
    tapTimeoutRef.current = setTimeout(() => {
      setAdminTapCount(0);
    }, 2000);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      <ScrollView className="flex-1 px-5 pt-4">
        <View className="flex-row items-center mb-6">
          <SettingsIcon size={24} color="#6b7280" />
          <Text className="text-2xl font-bold text-gray-900 dark:text-white ml-2">
            Settings
          </Text>
        </View>

        {/* Privacy Section */}
        <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-700">
          <View className="flex-row items-center mb-3">
            <Shield size={20} color="#10b981" />
            <Text className="text-gray-900 dark:text-white font-semibold text-lg ml-2">
              Privacy & Security
            </Text>
          </View>

          <View className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 mb-3">
            <View className="flex-row items-start">
              <Lock size={16} color="#10b981" style={{ marginTop: 2 }} />
              <View className="flex-1 ml-3">
                <Text className="text-emerald-800 dark:text-emerald-300 font-medium">
                  Client-Side Processing
                </Text>
                <Text className="text-emerald-700 dark:text-emerald-400 text-sm mt-1">
                  All PDF text extraction and sensitive data redaction happens entirely in your browser. No raw document data is ever sent to any server.
                </Text>
              </View>
            </View>
          </View>

          <View className="space-y-2">
            <View className="flex-row items-start py-2">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 mr-3" />
              <Text className="text-gray-600 dark:text-gray-300 flex-1">
                {countryMode === 'india'
                  ? 'Indian PAN numbers are automatically redacted with [REDACTED_PAN]'
                  : 'US Social Security Numbers are automatically redacted with [REDACTED_SSN]'}
              </Text>
            </View>
            <View className="flex-row items-start py-2">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 mr-3" />
              <Text className="text-gray-600 dark:text-gray-300 flex-1">
                {countryMode === 'india'
                  ? 'Aadhaar numbers are also redacted for extra security'
                  : 'Only redacted text is sent for AI analysis'}
              </Text>
            </View>
            <View className="flex-row items-start py-2">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 mr-3" />
              <Text className="text-gray-600 dark:text-gray-300 flex-1">
                Your personal data never leaves your browser unprotected
              </Text>
            </View>
          </View>
        </View>

        {/* How It Works Section */}
        <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-700">
          <View className="flex-row items-center mb-3">
            <Info size={20} color="#6b7280" />
            <Text className="text-gray-900 dark:text-white font-semibold text-lg ml-2">
              How It Works
            </Text>
          </View>

          <View className="space-y-3">
            <View className="flex-row items-start">
              <View className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-3">
                <Text className="text-blue-600 dark:text-blue-400 text-xs font-bold">1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-800 dark:text-gray-200 font-medium">Upload Your Document</Text>
                <Text className="text-gray-500 dark:text-gray-400 text-sm">
                  {countryMode === 'india' ? 'Form 16 or Salary Slip PDF' : 'Your paystub PDF'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-3">
                <Text className="text-blue-600 dark:text-blue-400 text-xs font-bold">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-800 dark:text-gray-200 font-medium">Automatic Redaction</Text>
                <Text className="text-gray-500 dark:text-gray-400 text-sm">
                  Sensitive data is redacted locally in your browser
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-3">
                <Text className="text-blue-600 dark:text-blue-400 text-xs font-bold">3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-800 dark:text-gray-200 font-medium">AI Analysis</Text>
                <Text className="text-gray-500 dark:text-gray-400 text-sm">
                  {countryMode === 'india'
                    ? 'Old vs New regime comparison, 80C/80D gaps, NPS opportunities'
                    : 'W-4 withholding check, 401(k) match gaps, HSA contributions'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center mr-3">
                <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">4</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-800 dark:text-gray-200 font-medium">Get Your Report</Text>
                <Text className="text-gray-500 dark:text-gray-400 text-sm">
                  Personalized tax savings recommendations
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Disclaimer */}
        <View className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <Text className="text-gray-700 dark:text-gray-300 font-medium mb-2">
            Disclaimer
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm">
            This app provides general tax information for educational purposes only. It does not constitute professional tax, legal, or financial advice. Always consult with a qualified tax professional ({countryMode === 'india' ? 'CA' : 'CPA'}) for personalized advice.
          </Text>
        </View>

        {/* Version - Tap 5 times for admin */}
        <Pressable onPress={handleVersionTap} className="mt-6 py-4 items-center">
          <Text className="text-gray-400 dark:text-gray-500 text-xs">
            TaxSaver AI v1.0.0 (Beta)
          </Text>
          <Text className="text-gray-300 dark:text-gray-600 text-[10px] mt-1">
            Built with privacy in mind
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
