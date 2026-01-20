import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation } from '@tanstack/react-query';
import { Camera, Shield, AlertTriangle, X, Clock, Zap, Wifi, WifiOff, Image as ImageIcon, Sparkles } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { cn } from '@/lib/cn';
import { analyzeImageWithVision, isValidImageFile } from '@/lib/image-analysis';
import type { TaxAnalysisResult } from '@/lib/tax-analysis';
import { TaxDashboard } from '@/components/TaxDashboard';
import { EmailGate, EmailSuccessModal } from '@/components/EmailGate';
import { useTaxStore, type CountryMode } from '@/lib/state/tax-store';
import { useTaxRules, FALLBACK_INDIA_RULES, FALLBACK_US_RULES } from '@/lib/useTaxRules';

type ProcessingStep = 'idle' | 'analyzing' | 'complete' | 'error';

interface ProcessingState {
  step: ProcessingStep;
  fileName?: string;
  analysis?: TaxAnalysisResult;
  error?: string;
}

function formatCurrency(amount: number, mode: CountryMode): string {
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

function CountryToggle({ mode, onChange }: { mode: CountryMode; onChange: (mode: CountryMode) => void }) {
  return (
    <View className="flex-row bg-white/20 rounded-full p-1">
      <Pressable
        onPress={() => onChange('india')}
        className={cn(
          'flex-row items-center px-4 py-2 rounded-full',
          mode === 'india' ? 'bg-white' : 'bg-transparent'
        )}
      >
        <Text className="text-lg mr-1">🇮🇳</Text>
        <Text className={cn(
          'font-semibold text-sm',
          mode === 'india' ? 'text-emerald-700' : 'text-white/80'
        )}>
          India
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('us')}
        className={cn(
          'flex-row items-center px-4 py-2 rounded-full',
          mode === 'us' ? 'bg-white' : 'bg-transparent'
        )}
      >
        <Text className="text-lg mr-1">🇺🇸</Text>
        <Text className={cn(
          'font-semibold text-sm',
          mode === 'us' ? 'text-blue-700' : 'text-white/80'
        )}>
          US
        </Text>
      </Pressable>
    </View>
  );
}

function RateLimitedMessage({ hoursRemaining }: { hoursRemaining: number }) {
  return (
    <View className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 border border-amber-100 dark:border-amber-800 items-center">
      <View className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mb-4">
        <Clock size={32} color="#f59e0b" />
      </View>
      <Text className="text-amber-800 dark:text-amber-300 text-lg font-bold text-center mb-2">
        Daily Limit Reached
      </Text>
      <Text className="text-amber-700 dark:text-amber-400 text-center mb-4">
        You have used your free daily quota. Please try again in {Math.ceil(hoursRemaining)} hours.
      </Text>
      <View className="bg-amber-100 dark:bg-amber-800/30 rounded-xl px-4 py-2">
        <Text className="text-amber-600 dark:text-amber-300 text-sm">
          Free Beta: 1 report per 24 hours
        </Text>
      </View>
    </View>
  );
}

function LiveStatusBadge({ isLive, isLoading }: { isLive: boolean; isLoading: boolean }) {
  if (isLoading) {
    return (
      <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5">
        <ActivityIndicator size="small" color="#6b7280" />
        <Text className="text-gray-500 dark:text-gray-400 text-xs ml-2">
          Loading rules...
        </Text>
      </View>
    );
  }

  return (
    <View className={cn(
      'flex-row items-center rounded-full px-3 py-1.5',
      isLive
        ? 'bg-emerald-100 dark:bg-emerald-900/30'
        : 'bg-amber-100 dark:bg-amber-900/30'
    )}>
      {isLive ? (
        <>
          <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
          <Wifi size={12} color="#10b981" />
          <Text className="text-emerald-700 dark:text-emerald-400 text-xs font-medium ml-1">
            Tax Rules: Live & Updated
          </Text>
        </>
      ) : (
        <>
          <WifiOff size={12} color="#f59e0b" />
          <Text className="text-amber-700 dark:text-amber-400 text-xs font-medium ml-1">
            Using Cached Rules
          </Text>
        </>
      )}
    </View>
  );
}

// Animated scanning indicator
function AnalyzingIndicator({ countryMode }: { countryMode: CountryMode }) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const primaryColor = countryMode === 'india' ? '#10b981' : '#3b82f6';

  return (
    <View className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 items-center">
      <Animated.View style={animatedStyle} className="mb-6">
        <View
          className="w-20 h-20 rounded-full items-center justify-center"
          style={{ backgroundColor: `${primaryColor}20` }}
        >
          <Sparkles size={40} color={primaryColor} />
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.delay(200)}
        className="text-gray-900 dark:text-white text-xl font-bold text-center mb-2"
      >
        Analyzing Document...
      </Animated.Text>

      <Animated.Text
        entering={FadeIn.delay(400)}
        className="text-gray-500 dark:text-gray-400 text-center mb-6"
      >
        Our AI is scanning your {countryMode === 'india' ? 'Form 16 / Salary Slip' : 'Paystub'}
      </Animated.Text>

      <View className="flex-row items-center bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-3">
        <Shield size={16} color="#10b981" />
        <Text className="text-emerald-700 dark:text-emerald-300 text-xs ml-2 flex-1">
          Privacy Protected: Names & IDs are never extracted
        </Text>
      </View>
    </View>
  );
}

// Image Scanner Touch Area Component
function ImageScannerArea({
  countryMode,
  onPress,
  isLoading,
}: {
  countryMode: CountryMode;
  onPress: () => void;
  isLoading: boolean;
}) {
  const primaryColor = countryMode === 'india' ? '#10b981' : '#3b82f6';
  const borderColor = countryMode === 'india' ? 'border-emerald-300' : 'border-blue-300';
  const bgColor = countryMode === 'india' ? 'bg-emerald-50' : 'bg-blue-50';
  const darkBgColor = countryMode === 'india' ? 'dark:bg-emerald-900/10' : 'dark:bg-blue-900/10';

  const documentLabel = countryMode === 'india' ? 'Form 16 / Salary Slip' : 'Paystub';

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <Pressable
        onPress={onPress}
        disabled={isLoading}
        className={cn(
          'rounded-3xl border-2 border-dashed overflow-hidden',
          isLoading ? 'opacity-50' : 'active:opacity-80',
          borderColor
        )}
      >
        <View className={cn('p-8 items-center', bgColor, darkBgColor)}>
          {/* Icon */}
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-6"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <Camera size={48} color={primaryColor} />
          </View>

          {/* Main Label */}
          <Text className="text-gray-900 dark:text-white text-xl font-bold text-center mb-2">
            📸 Scan {documentLabel}
          </Text>

          <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
            {Platform.OS === 'web'
              ? 'Click to upload an image (.png, .jpg, .webp)'
              : 'Tap to take a photo or choose from library'}
          </Text>

          {/* CTA Button */}
          <View
            className="flex-row items-center px-8 py-4 rounded-full"
            style={{ backgroundColor: primaryColor }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                {Platform.OS === 'web' ? (
                  <ImageIcon size={20} color="white" />
                ) : (
                  <Camera size={20} color="white" />
                )}
                <Text className="text-white font-semibold text-lg ml-2">
                  {Platform.OS === 'web' ? 'Select Image' : 'Scan Now'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Privacy Tip */}
        <View className="bg-white dark:bg-gray-800 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <View className="flex-row items-start">
            <Shield size={18} color="#10b981" style={{ marginTop: 2 }} />
            <View className="flex-1 ml-3">
              <Text className="text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">
                Privacy Tip
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-xs leading-5">
                Feel free to cover your Name or {countryMode === 'india' ? 'PAN' : 'SSN'} with your thumb or pen before snapping the photo.{' '}
                <Text className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Our AI looks ONLY at the numbers.
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function TaxOptimizerScreen() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ step: 'idle' });
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [showEmailSuccess, setShowEmailSuccess] = useState(false);
  const [emailUnlocked, setEmailUnlocked] = useState(false);

  // Store results separately for each country mode using refs
  const indiaResultsRef = useRef<ProcessingState | null>(null);
  const usResultsRef = useRef<ProcessingState | null>(null);
  const indiaEmailUnlockedRef = useRef(false);
  const usEmailUnlockedRef = useRef(false);
  const prevCountryModeRef = useRef<CountryMode | null>(null);

  // Fetch dynamic tax rules
  const taxRules = useTaxRules();

  // Store selectors
  const countryMode = useTaxStore((s) => s.countryMode);
  const setCountryMode = useTaxStore((s) => s.setCountryMode);
  const lastReportTimestamp = useTaxStore((s) => s.lastReportTimestamp);
  const setLastReportTimestamp = useTaxStore((s) => s.setLastReportTimestamp);
  const canGenerateReport = useTaxStore((s) => s.canGenerateReport);
  const addLead = useTaxStore((s) => s.addLead);

  // Handle country mode switching
  useEffect(() => {
    if (prevCountryModeRef.current === null) {
      prevCountryModeRef.current = countryMode;
      return;
    }

    if (prevCountryModeRef.current === countryMode) {
      return;
    }

    // Save current state before switching
    if (prevCountryModeRef.current === 'india') {
      indiaResultsRef.current = processing.step === 'complete' ? processing : indiaResultsRef.current;
      indiaEmailUnlockedRef.current = emailUnlocked;
    } else {
      usResultsRef.current = processing.step === 'complete' ? processing : usResultsRef.current;
      usEmailUnlockedRef.current = emailUnlocked;
    }

    // Restore state for new country mode
    if (countryMode === 'india') {
      if (indiaResultsRef.current) {
        setProcessing(indiaResultsRef.current);
        setEmailUnlocked(indiaEmailUnlockedRef.current);
      } else {
        setProcessing({ step: 'idle' });
        setEmailUnlocked(false);
      }
    } else {
      if (usResultsRef.current) {
        setProcessing(usResultsRef.current);
        setEmailUnlocked(usEmailUnlockedRef.current);
      } else {
        setProcessing({ step: 'idle' });
        setEmailUnlocked(false);
      }
    }

    setShowEmailGate(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    prevCountryModeRef.current = countryMode;
  }, [countryMode]);

  // Calculate hours remaining for rate limit
  const hoursRemaining = lastReportTimestamp
    ? Math.max(0, 24 - (Date.now() - lastReportTimestamp) / (1000 * 60 * 60))
    : 0;

  // Get the appropriate tax rules
  const getCurrentRules = useCallback(() => {
    if (countryMode === 'india') {
      return taxRules.indiaRules || FALLBACK_INDIA_RULES;
    }
    return taxRules.usRules || FALLBACK_US_RULES;
  }, [countryMode, taxRules.indiaRules, taxRules.usRules]);

  // Process image mutation
  const { mutate: processImage } = useMutation({
    mutationFn: async (imageUri: string) => {
      setProcessing({ step: 'analyzing' });

      const rules = getCurrentRules();
      const analysis = await analyzeImageWithVision({
        imageUri,
        countryMode,
        taxRules: rules,
      });

      return analysis;
    },
    onSuccess: (analysis) => {
      const completedState: ProcessingState = {
        step: 'complete',
        analysis,
      };
      setProcessing(completedState);

      // Save results for the current country mode
      if (countryMode === 'india') {
        indiaResultsRef.current = completedState;
      } else {
        usResultsRef.current = completedState;
      }

      // Show email gate
      setShowEmailGate(true);
    },
    onError: (error: Error) => {
      setProcessing({
        step: 'error',
        error: error.message,
      });
    },
  });

  // Handle image selection (mobile)
  const handleImagePick = useCallback(async () => {
    if (!canGenerateReport()) {
      return;
    }

    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        setProcessing({
          step: 'error',
          error: 'Permission to access photos is required.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      processImage(asset.uri);
    } catch (error) {
      setProcessing({
        step: 'error',
        error: 'Failed to pick image. Please try again.',
      });
    }
  }, [canGenerateReport, processImage]);

  // Handle camera capture (mobile)
  const handleCameraCapture = useCallback(async () => {
    if (!canGenerateReport()) {
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        setProcessing({
          step: 'error',
          error: 'Permission to access camera is required.',
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      processImage(asset.uri);
    } catch (error) {
      setProcessing({
        step: 'error',
        error: 'Failed to capture image. Please try again.',
      });
    }
  }, [canGenerateReport, processImage]);

  // Handle web file selection
  const handleWebFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!canGenerateReport()) {
        setProcessing({
          step: 'error',
          error: `You have used your free daily quota. Please try again in ${Math.ceil(hoursRemaining)} hours.`,
        });
        return;
      }

      if (!isValidImageFile(file.type, file.name)) {
        setProcessing({
          step: 'error',
          error: 'Please upload an image file (.png, .jpg, .jpeg, .webp)',
        });
        return;
      }

      // Create object URL for the file
      const imageUri = URL.createObjectURL(file);
      processImage(imageUri);
    },
    [canGenerateReport, hoursRemaining, processImage]
  );

  // Handle scan button press
  const handleScanPress = useCallback(() => {
    if (!canGenerateReport()) {
      return;
    }

    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      // On mobile, show action sheet with camera or library options
      // For simplicity, we'll default to library but also offer camera
      handleImagePick();
    }
  }, [canGenerateReport, handleImagePick]);

  const resetState = useCallback(() => {
    setProcessing({ step: 'idle' });
    setShowEmailGate(false);
    setEmailUnlocked(false);

    if (countryMode === 'india') {
      indiaResultsRef.current = null;
      indiaEmailUnlockedRef.current = false;
    } else {
      usResultsRef.current = null;
      usEmailUnlockedRef.current = false;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [countryMode]);

  const handleEmailSubmit = useCallback((email: string) => {
    if (processing.analysis) {
      addLead({
        email,
        date: new Date().toISOString(),
        mode: countryMode,
        estimatedSavings: processing.analysis.summary.potentialSavings,
      });
    }

    setLastReportTimestamp(Date.now());

    setShowEmailGate(false);
    setShowEmailSuccess(true);
    setTimeout(() => {
      setShowEmailSuccess(false);
      setEmailUnlocked(true);

      if (countryMode === 'india') {
        indiaEmailUnlockedRef.current = true;
      } else {
        usEmailUnlockedRef.current = true;
      }
    }, 1500);
  }, [processing.analysis, countryMode, addLead, setLastReportTimestamp]);

  const isRateLimited = !canGenerateReport();
  const documentLabel = countryMode === 'india' ? 'Form 16 / Salary Slip' : 'Paystub';
  const gradientColors = countryMode === 'india'
    ? ['#10b981', '#059669'] as const
    : ['#3b82f6', '#2563eb'] as const;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Hidden file input - web only */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          onChange={handleWebFileSelect}
          style={{ display: 'none' }}
        />
      )}

      {/* Email Gate Modal */}
      <EmailGate
        visible={showEmailGate}
        onSubmit={handleEmailSubmit}
        onClose={resetState}
        potentialSavings={processing.analysis
          ? formatCurrency(processing.analysis.summary.potentialSavings, countryMode)
          : undefined}
      />

      {/* Email Success Modal */}
      <EmailSuccessModal
        visible={showEmailSuccess}
        onClose={() => setShowEmailSuccess(false)}
      />

      {/* Header */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Zap size={24} color="white" style={{ marginRight: 8 }} />
            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>
              TaxSaver AI
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 8 }}>
              <Text style={{ color: 'white', fontSize: 10, fontWeight: '600' }}>FREE BETA</Text>
            </View>
          </View>
        </View>

        {/* Country Toggle */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <CountryToggle mode={countryMode} onChange={setCountryMode} />
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
          Stop Overpaying Taxes.
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', marginTop: 4 }}>
          Scan your {documentLabel} in 30 Seconds.
        </Text>
      </LinearGradient>

      <ScrollView className="flex-1 px-5 -mt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Security Badge */}
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 flex-row items-center shadow-sm border border-gray-100 dark:border-gray-700">
          <View className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center mr-3">
            <Shield size={20} color="#10b981" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 dark:text-white font-semibold">
              Privacy First
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-xs">
              AI extracts ONLY financial numbers - never names, addresses, or IDs
            </Text>
          </View>
        </View>

        {/* Rate Limited State */}
        {isRateLimited && processing.step === 'idle' && (
          <RateLimitedMessage hoursRemaining={hoursRemaining} />
        )}

        {/* Image Scanner Area */}
        {processing.step === 'idle' && !isRateLimited && (
          <ImageScannerArea
            countryMode={countryMode}
            onPress={handleScanPress}
            isLoading={taxRules.isLoading}
          />
        )}

        {/* Mobile: Camera Option */}
        {processing.step === 'idle' && !isRateLimited && Platform.OS !== 'web' && (
          <Animated.View entering={FadeInUp.delay(200).springify()}>
            <Pressable
              onPress={handleCameraCapture}
              className="mt-3 bg-white dark:bg-gray-800 rounded-2xl p-4 flex-row items-center justify-center border border-gray-200 dark:border-gray-700"
            >
              <Camera size={20} color={countryMode === 'india' ? '#10b981' : '#3b82f6'} />
              <Text className={cn(
                'font-semibold ml-2',
                countryMode === 'india' ? 'text-emerald-600' : 'text-blue-600'
              )}>
                Take Photo with Camera
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Analyzing State */}
        {processing.step === 'analyzing' && (
          <Animated.View entering={FadeInDown.springify()}>
            <AnalyzingIndicator countryMode={countryMode} />
          </Animated.View>
        )}

        {/* Error State */}
        {processing.step === 'error' && (
          <Animated.View entering={FadeIn}>
            <View className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 border border-red-100 dark:border-red-800">
              <View className="flex-row items-start">
                <AlertTriangle size={20} color="#ef4444" />
                <View className="flex-1 ml-3">
                  <Text className="text-red-700 dark:text-red-300 font-semibold">
                    Error
                  </Text>
                  <Text className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {processing.error}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={resetState}
                className="mt-4 bg-red-100 dark:bg-red-900/30 py-2 px-4 rounded-lg self-start"
              >
                <Text className="text-red-700 dark:text-red-300 font-medium">
                  Try Again
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Complete State - Show Dashboard */}
        {processing.step === 'complete' && processing.analysis && emailUnlocked && (
          <Animated.View entering={FadeIn} className="flex-1">
            {/* New Analysis Button */}
            <Pressable
              onPress={resetState}
              className="flex-row items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl py-3 mb-4"
            >
              <X size={18} color="#6b7280" />
              <Text className="text-gray-600 dark:text-gray-300 font-medium ml-2">
                Scan Another Document
              </Text>
            </Pressable>

            {/* Dashboard */}
            <TaxDashboard analysis={processing.analysis} />
          </Animated.View>
        )}

        {/* Blurred Preview when waiting for email */}
        {processing.step === 'complete' && processing.analysis && !emailUnlocked && !showEmailGate && (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#10b981" />
            <Text className="text-gray-500 dark:text-gray-400 mt-2">
              Preparing your report...
            </Text>
          </View>
        )}

        {/* Footer with Live Status Badge */}
        {processing.step === 'idle' && (
          <View className="mt-6 py-4 border-t border-gray-100 dark:border-gray-800 items-center">
            <LiveStatusBadge isLive={taxRules.isLive} isLoading={taxRules.isLoading} />
            <Text className="text-gray-400 dark:text-gray-500 text-xs text-center mt-3">
              AI-powered analysis • Your {countryMode === 'india' ? 'PAN/Aadhaar' : 'SSN'} is never stored
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
