import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Keyboard, TouchableWithoutFeedback, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    Keyboard.dismiss();

    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    if (isSignUp && !fullName.trim()) {
      Alert.alert('Missing info', 'What should people call you?');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      Alert.alert('Something went wrong', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
              <View style={styles.hero}>
                <View style={styles.mark} />
                <Text style={styles.brand}>GRASSROOTS</Text>
                <Text style={styles.tagline}>PLAY · CONNECT · BUILD COMMUNITY</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {isSignUp ? 'Create your account' : 'Welcome back'}
                </Text>
                <Text style={styles.cardSub}>
                  {isSignUp
                    ? 'Find pickup games near you'
                    : 'Pick up where you left off'}
                </Text>

                {isSignUp && (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={19} color={COLORS.mute} />
                    <TextInput
                      style={styles.input}
                      placeholder="Full name"
                      placeholderTextColor={COLORS.mute}
                      value={fullName}
                      onChangeText={setFullName}
                      returnKeyType="next"
                    />
                  </View>
                )}

                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={19} color={COLORS.mute} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={COLORS.mute}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={19} color={COLORS.mute} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={COLORS.mute}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleAuth}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleAuth}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.ink} />
                  ) : (
                    <Text style={styles.buttonText}>
                      {isSignUp ? 'Get started' : 'Log in'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toggle}
                  onPress={() => setIsSignUp(!isSignUp)}
                >
                  <Text style={styles.toggleText}>
                    {isSignUp ? 'Already have an account? ' : 'New here? '}
                    <Text style={styles.toggleLink}>
                      {isSignUp ? 'Log in' : 'Sign up'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ink },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  hero: { alignItems: 'center', marginBottom: 40 },
  mark: {
    width: 18, height: 18, backgroundColor: COLORS.primary,
    borderRadius: 4, transform: [{ rotate: '45deg' }], marginBottom: 22,
  },
  brand: {
    fontSize: 28, fontWeight: '900', color: COLORS.snow, letterSpacing: 3.5,
  },
  tagline: {
    fontSize: 9.5, fontWeight: '800', color: COLORS.primary,
    letterSpacing: 2, marginTop: 10,
  },

  card: {
    backgroundColor: COLORS.cardFill,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: COLORS.snow, letterSpacing: -0.5 },
  cardSub: { fontSize: 13.5, color: COLORS.mute, marginTop: 4, marginBottom: 22 },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: COLORS.inkRaised,
    borderRadius: 14, paddingHorizontal: 15, height: 52, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.line,
  },
  input: { flex: 1, fontSize: 15.5, color: COLORS.snow, height: '100%' },

  button: {
    backgroundColor: COLORS.primary, height: 54, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginTop: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.ink, fontSize: 16, fontWeight: '800' },

  toggle: { alignItems: 'center', marginTop: 20, paddingVertical: 6 },
  toggleText: { color: COLORS.mute, fontSize: 14 },
  toggleLink: { color: COLORS.primary, fontWeight: '700' },
});