import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Modal } from 'react-native';
import { Mail, Lock, Unlock, Check, X } from 'lucide-react-native';
import { cn } from '@/lib/cn';
import { useTaxStore } from '@/lib/state/tax-store';
// Go up one level (..) to find leads-api in the src folder
import { saveLeadToSheet } from '../../leads-api';

// List of blocked disposable/temporary email domains
const BLOCKED_DOMAINS = [
  'tempmail.com',
  'throwaway.com',
  'mailinator.com',
  'guerrillamail.com',
  'fakeinbox.com',
  'temp-mail.org',
  'disposablemail.com',
  'yopmail.com',
  'sharklasers.com',
  'trashmail.com',
  '10minutemail.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'tempail.com',
  'mohmal.com',
  'emailondeck.com',
  'tempr.email',
  'discard.email',
  'spamgourmet.com',
];

// Common dummy email patterns to block
const DUMMY_PATTERNS = [
  /^test@/i,
  /^dummy@/i,
  /^fake@/i,
  /^asdf@/i,
  /^qwerty@/i,
  /^abc@/i,
  /^123@/i,
  /^sample@/i,
  /^example@/i,
  /^no@/i,
  /^none@/i,
  /^null@/i,
  /^admin@/i,
  /^user@/i,
  /^a{2,}@/i, // aa@, aaa@, etc.
  /^[a-z]@/i, // single letter emails
];

interface EmailGateProps {
  visible: boolean;
  onSubmit: (email: string) => void;
  onClose?: () => void;
  isLoading?: boolean;
  potentialSavings?: string;
}

export function EmailGate({ visible, onSubmit, onClose, isLoading, potentialSavings }: EmailGateProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isEmailUsedToday = useTaxStore((s) => s.isEmailUsedToday);

  const validateEmail = (emailInput: string): { valid: boolean; error?: string } => {
    const trimmedEmail = emailInput.trim().toLowerCase();

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    // Check minimum length for local part
    const [localPart, domain] = trimmedEmail.split('@');
    if (localPart.length < 2) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    // Check for blocked disposable domains
    if (BLOCKED_DOMAINS.some((blocked) => domain.includes(blocked))) {
      return { valid: false, error: 'Please use a permanent email address' };
    }

    // Check for dummy email patterns
    if (DUMMY_PATTERNS.some((pattern) => pattern.test(trimmedEmail))) {
      return { valid: false, error: 'Please enter your real email address' };
    }

    // Check if domain has valid TLD (at least 2 characters)
    const domainParts = domain.split('.');
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    // Check for duplicate email in last 24 hours
    if (isEmailUsedToday(trimmedEmail)) {
      return { valid: false, error: 'This email was already used today. Try again in 24 hours.' };
    }

    return { valid: true };
  };

const handleSubmit = () => {
    // 1. Validation
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // 2. Fire and Forget: Send to Google Sheet
    // We do NOT await this. We let it run in the background.
    saveLeadToSheet(
      email, 
      props.country || "Unknown", 
      props.savings || "Unknown"
    );

    // 3. THE MISSING PIECE: Unlock the report immediately
    // This removes the "Email Gate" and shows the user their data.
    props.onSubmit(); 
};
  // --- NEW CODE END ---

    const validation = validateEmail(email);
    if (!validation.valid) {
      setError(validation.error || 'Please enter a valid email address');
      return;
    }

    setError(null);
    onSubmit(email.trim().toLowerCase());
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/60">
        {/* Blurred background card */}
        <View className="bg-white dark:bg-gray-800 rounded-3xl p-6 mx-6 shadow-2xl max-w-sm w-full">
          {/* Close button */}
          {onClose && (
            <Pressable
              onPress={onClose}
              className="absolute top-4 right-4 w-8 h-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
            >
              <X size={16} color="#6b7280" />
            </Pressable>
          )}

          {/* Lock icon */}
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center">
              <Lock size={32} color="#10b981" />
            </View>
          </View>

          {/* Title */}
          <Text className="text-gray-900 dark:text-white text-xl font-bold text-center mb-2">
            Analysis Complete!
          </Text>

          {/* Subtitle */}
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">
            Enter your email to unlock your personalized Savings Report
          </Text>

          {/* Savings preview */}
          {potentialSavings && (
            <View className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 mb-4 items-center">
              <Text className="text-emerald-600 dark:text-emerald-400 text-sm mb-1">
                Potential Savings Identified
              </Text>
              <Text className="text-emerald-700 dark:text-emerald-300 text-2xl font-bold">
                {potentialSavings}
              </Text>
            </View>
          )}

          {/* Email input */}
          <View className="mb-4">
            <View className={cn(
              'flex-row items-center bg-gray-50 dark:bg-gray-700 rounded-xl px-4 border-2',
              error ? 'border-red-400' : 'border-transparent'
            )}>
              <Mail size={20} color="#6b7280" />
              <TextInput
                className="flex-1 py-4 px-3 text-gray-900 dark:text-white text-base"
                placeholder="your@email.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
            {error && (
              <Text className="text-red-500 text-sm mt-1 ml-1">{error}</Text>
            )}
          </View>

          {/* Submit button */}
          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            className={cn(
              'py-4 rounded-xl flex-row items-center justify-center',
              isLoading ? 'bg-emerald-400' : 'bg-emerald-500 active:bg-emerald-600'
            )}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Unlock size={20} color="white" />
                <Text className="text-white font-bold text-base ml-2">
                  Unlock My Report
                </Text>
              </>
            )}
          </Pressable>

          {/* Privacy note */}
          <Text className="text-gray-400 dark:text-gray-500 text-xs text-center mt-4">
            We respect your privacy. Your email will only be used to send your report.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Success modal shown after email submission
export function EmailSuccessModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 mx-6 items-center max-w-xs">
          <View className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center mb-4">
            <Check size={36} color="#10b981" />
          </View>
          <Text className="text-gray-900 dark:text-white text-xl font-bold text-center mb-2">
            Report Unlocked!
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center">
            Your personalized tax savings report is now available.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
