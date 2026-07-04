import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, LabeledInput, PrimaryButton, GhostButton, Muted } from '@/components/ui';
import { ACTIVITY_LABELS, computeTargets, GOAL_LABELS } from '@/lib/nutrition';
import { ActivityLevel, Goal, Sex } from '@/lib/types';
import { useProfileStore } from '@/stores/useProfileStore';
import { colors, font, spacing } from '@/theme';

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];
const GOALS = Object.keys(GOAL_LABELS) as Goal[];
const CURRENT_YEAR = new Date().getFullYear();

export default function Onboarding() {
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [birthYear, setBirthYear] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<Goal>('maintain');

  const year = Number(birthYear);
  const height = Number(heightCm);
  const weight = Number(weightKg);

  const bodyValid =
    Number.isInteger(year) && year >= 1920 && year <= CURRENT_YEAR - 10 &&
    Number.isFinite(height) && height >= 100 && height <= 250 &&
    Number.isFinite(weight) && weight >= 25 && weight <= 300;

  const targets = useMemo(
    () =>
      bodyValid
        ? computeTargets({ sex, birthYear: year, heightCm: height, weightKg: weight, activityLevel, goal })
        : null,
    [bodyValid, sex, year, height, weight, activityLevel, goal],
  );

  const finish = () => {
    if (!bodyValid) return;
    completeOnboarding({
      name: name.trim() || 'You',
      sex,
      birthYear: year,
      heightCm: height,
      weightKg: weight,
      activityLevel,
      goal,
    });
    router.replace('/today');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View style={styles.stepWrap}>
              <Text style={styles.logo}>
                Nutri<Text style={{ color: colors.accent }}>Voice</Text>
              </Text>
              <Text style={styles.hero}>Track calories by talking.</Text>
              <Muted style={{ textAlign: 'center' }}>
                Say “200 grams of chicken breast with 200 grams of rice” and it’s logged.
                Voice, barcode and search — synced across web, iOS and Android.
              </Muted>
              <PrimaryButton title="Get started" onPress={() => setStep(1)} style={{ alignSelf: 'stretch' }} />
            </View>
          )}

          {step === 1 && (
            <View style={styles.formWrap}>
              <Text style={styles.title}>About you</Text>
              <Muted>Used to compute your calorie and macro targets — nothing else.</Muted>
              <LabeledInput label="Name (optional)" value={name} onChangeText={setName} placeholder="Arjun" />
              <View style={{ gap: spacing(1.5) }}>
                <Text style={styles.label}>Sex (for BMR formula)</Text>
                <View style={styles.chipRow}>
                  <Chip label="Male" active={sex === 'male'} onPress={() => setSex('male')} />
                  <Chip label="Female" active={sex === 'female'} onPress={() => setSex('female')} />
                </View>
              </View>
              <LabeledInput
                label="Birth year"
                value={birthYear}
                onChangeText={setBirthYear}
                keyboardType="numeric"
                placeholder="2004"
              />
              <LabeledInput
                label="Height (cm)"
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="numeric"
                placeholder="175"
              />
              <LabeledInput
                label="Weight (kg)"
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="numeric"
                placeholder="70"
              />
              <PrimaryButton title="Next" onPress={() => setStep(2)} disabled={!bodyValid} />
              {!bodyValid && (birthYear || heightCm || weightKg) ? (
                <Muted style={{ fontSize: 12 }}>
                  Enter a birth year ({1920}–{CURRENT_YEAR - 10}), height 100–250 cm, weight 25–300 kg.
                </Muted>
              ) : null}
              <GhostButton title="Back" onPress={() => setStep(0)} />
            </View>
          )}

          {step === 2 && (
            <View style={styles.formWrap}>
              <Text style={styles.title}>Activity & goal</Text>
              <View style={{ gap: spacing(1.5) }}>
                <Text style={styles.label}>Activity level</Text>
                <View style={styles.chipCol}>
                  {ACTIVITIES.map((a) => (
                    <Chip
                      key={a}
                      label={ACTIVITY_LABELS[a]}
                      active={activityLevel === a}
                      onPress={() => setActivityLevel(a)}
                    />
                  ))}
                </View>
              </View>
              <View style={{ gap: spacing(1.5) }}>
                <Text style={styles.label}>Goal</Text>
                <View style={styles.chipRow}>
                  {GOALS.map((g) => (
                    <Chip key={g} label={GOAL_LABELS[g]} active={goal === g} onPress={() => setGoal(g)} />
                  ))}
                </View>
              </View>

              {targets && (
                <View style={styles.targetsCard}>
                  <Text style={styles.targetsKcal}>{targets.kcal} kcal / day</Text>
                  <Muted>
                    Protein {targets.proteinG} g · Carbs {targets.carbsG} g · Fat {targets.fatG} g
                  </Muted>
                  <Muted style={{ fontSize: 12 }}>
                    Mifflin-St Jeor BMR × activity, protein at 2 g/kg. Adjustable later.
                  </Muted>
                </View>
              )}

              <PrimaryButton title="Start tracking" onPress={finish} disabled={!bodyValid} />
              <GhostButton title="Back" onPress={() => setStep(1)} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flexGrow: 1,
    padding: spacing(6),
    justifyContent: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  stepWrap: {
    alignItems: 'center',
    gap: spacing(5),
  },
  formWrap: {
    gap: spacing(4),
  },
  logo: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 34,
  },
  hero: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 22,
    textAlign: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 26,
  },
  label: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  chipCol: {
    gap: spacing(2),
  },
  targetsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing(4),
    gap: spacing(1.5),
  },
  targetsKcal: {
    color: colors.accent,
    fontFamily: font.extrabold,
    fontSize: 24,
  },
});
