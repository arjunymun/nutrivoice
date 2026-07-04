import type { Session } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Chip, GhostButton, LabeledInput, Muted, PrimaryButton, SectionTitle } from '@/components/ui';
import { ACTIVITY_LABELS, GOAL_LABELS } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { syncAll, useSyncStore } from '@/lib/sync';
import { ActivityLevel, Goal, Sex } from '@/lib/types';
import { useLogStore } from '@/stores/useLogStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { colors, font, spacing } from '@/theme';

export default function ProfileScreen() {
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const setCustomTargets = useProfileStore((s) => s.setCustomTargets);
  const resetProfile = useProfileStore((s) => s.reset);
  const resetLog = useLogStore((s) => s.reset);
  const syncStatus = useSyncStore((s) => s.status);
  const syncError = useSyncStore((s) => s.errorMessage);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  const signIn = async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthBusy(false);
    if (error) setAuthMessage(error.message);
  };

  const signUp = async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setAuthBusy(false);
    if (error) setAuthMessage(error.message);
    else if (!data.session) setAuthMessage('Account created — check your email to confirm, then sign in.');
  };

  const doSync = async () => {
    const result = await syncAll();
    if (!result.ok) setAuthMessage(result.message);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Profile</Text>

        {profile && (
          <Card style={{ gap: spacing(2.5) }}>
            <View style={styles.rowBetween}>
              <SectionTitle>{profile.name}</SectionTitle>
              <Pressable onPress={() => setEditOpen(true)}>
                <Text style={styles.link}>Edit</Text>
              </Pressable>
            </View>
            <Muted>
              {profile.sex === 'male' ? 'Male' : 'Female'} · born {profile.birthYear} · {profile.heightCm} cm ·{' '}
              {profile.weightKg} kg
            </Muted>
            <Muted>
              {ACTIVITY_LABELS[profile.activityLevel]} · {GOAL_LABELS[profile.goal]}
            </Muted>
          </Card>
        )}

        {profile && (
          <Card style={{ gap: spacing(2.5) }}>
            <View style={styles.rowBetween}>
              <SectionTitle>Daily targets</SectionTitle>
              <Pressable onPress={() => setTargetsOpen(true)}>
                <Text style={styles.link}>{profile.customTargets ? 'Edit (custom)' : 'Override'}</Text>
              </Pressable>
            </View>
            <Text style={styles.kcalBig}>{profile.targetKcal} kcal</Text>
            <Muted>
              Protein {profile.targetProteinG} g · Carbs {profile.targetCarbsG} g · Fat {profile.targetFatG} g
            </Muted>
            <Muted style={{ fontSize: 12 }}>
              {profile.customTargets
                ? 'Custom targets — auto-calculation is off.'
                : 'Auto from Mifflin-St Jeor TDEE, protein 2 g/kg (bodybuilding default).'}
            </Muted>
          </Card>
        )}

        <Card style={{ gap: spacing(3) }}>
          <SectionTitle>Account & sync</SectionTitle>
          {session ? (
            <>
              <Muted>Signed in as {session.user.email}</Muted>
              <Muted style={{ fontSize: 12 }}>
                {syncStatus === 'syncing'
                  ? 'Syncing…'
                  : syncStatus === 'error'
                    ? `Sync error: ${syncError}`
                    : lastSyncedAt
                      ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
                      : 'Not synced yet'}
              </Muted>
              <PrimaryButton title="Sync now" onPress={doSync} loading={syncStatus === 'syncing'} />
              <GhostButton
                title="Sign out (local data stays)"
                onPress={() => supabase.auth.signOut()}
              />
            </>
          ) : (
            <>
              <Muted>
                Sign in to back up your log and sync across web, iOS and Android.
              </Muted>
              <LabeledInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
              <LabeledInput
                label="Password (min 6 chars)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <PrimaryButton
                title="Sign in"
                onPress={signIn}
                loading={authBusy}
                disabled={!emailValid || password.length < 6}
              />
              <GhostButton title="Create account" onPress={signUp} />
            </>
          )}
          {authMessage && <Text style={styles.authMessage}>{authMessage}</Text>}
        </Card>

        <Card style={{ gap: spacing(2) }}>
          <SectionTitle>About</SectionTitle>
          <Muted style={{ fontSize: 13 }}>
            NutriVoice — voice-first calorie tracker. Nutrition data compiled from USDA FoodData
            Central and IFCT reference values; packaged foods via Open Food Facts. Estimates, not
            medical advice.
          </Muted>
          <GhostButton title="Delete all local data" danger onPress={() => setConfirmReset(true)} />
        </Card>
      </ScrollView>

      {editOpen && profile && (
        <EditProfileModal
          onClose={() => setEditOpen(false)}
          profile={profile}
          updateProfile={updateProfile}
        />
      )}
      {targetsOpen && profile && (
        <TargetsModal
          onClose={() => setTargetsOpen(false)}
          profile={profile}
          setCustomTargets={setCustomTargets}
        />
      )}

      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <SectionTitle>Delete local data?</SectionTitle>
            <Muted>
              Removes your profile, food log, weights and custom foods from this device. Synced data
              on the server is not deleted.
            </Muted>
            <PrimaryButton
              title="Yes, delete local data"
              onPress={() => {
                resetLog();
                resetProfile();
                useSyncStore.getState().reset();
                setConfirmReset(false);
              }}
              style={{ backgroundColor: colors.danger }}
            />
            <GhostButton title="Cancel" onPress={() => setConfirmReset(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function EditProfileModal({
  profile,
  updateProfile,
  onClose,
}: {
  profile: NonNullable<ReturnType<typeof useProfileStore.getState>['profile']>;
  updateProfile: (p: any) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [birthYear, setBirthYear] = useState(String(profile.birthYear));
  const [heightCm, setHeightCm] = useState(String(profile.heightCm));
  const [weightKg, setWeightKg] = useState(String(profile.weightKg));
  const [activity, setActivity] = useState<ActivityLevel>(profile.activityLevel);
  const [goal, setGoal] = useState<Goal>(profile.goal);

  const year = Number(birthYear);
  const h = Number(heightCm);
  const w = Number(weightKg);
  const valid =
    Number.isInteger(year) && year >= 1920 && year <= new Date().getFullYear() - 10 &&
    h >= 100 && h <= 250 && w >= 25 && w <= 300;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing(5) }}>
          <View style={styles.sheet}>
            <SectionTitle>Edit profile</SectionTitle>
            <LabeledInput label="Name" value={name} onChangeText={setName} />
            <View style={styles.chipRow}>
              <Chip label="Male" active={sex === 'male'} onPress={() => setSex('male')} />
              <Chip label="Female" active={sex === 'female'} onPress={() => setSex('female')} />
            </View>
            <LabeledInput label="Birth year" value={birthYear} onChangeText={setBirthYear} keyboardType="numeric" />
            <LabeledInput label="Height (cm)" value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" />
            <LabeledInput label="Weight (kg)" value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" />
            <View style={styles.chipRow}>
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
                <Chip key={a} label={a.replace('_', ' ')} active={activity === a} onPress={() => setActivity(a)} />
              ))}
            </View>
            <View style={styles.chipRow}>
              {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                <Chip key={g} label={g} active={goal === g} onPress={() => setGoal(g)} />
              ))}
            </View>
            <PrimaryButton
              title="Save"
              disabled={!valid}
              onPress={() => {
                updateProfile({
                  name: name.trim() || profile.name,
                  sex,
                  birthYear: year,
                  heightCm: h,
                  weightKg: w,
                  activityLevel: activity,
                  goal,
                });
                onClose();
              }}
            />
            <GhostButton title="Cancel" onPress={onClose} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function TargetsModal({
  profile,
  setCustomTargets,
  onClose,
}: {
  profile: NonNullable<ReturnType<typeof useProfileStore.getState>['profile']>;
  setCustomTargets: (t: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null) => void;
  onClose: () => void;
}) {
  const [kcal, setKcal] = useState(String(profile.targetKcal));
  const [protein, setProtein] = useState(String(profile.targetProteinG));
  const [carbs, setCarbs] = useState(String(profile.targetCarbsG));
  const [fat, setFat] = useState(String(profile.targetFatG));

  const nums = [kcal, protein, carbs, fat].map(Number);
  const valid = nums.every((n) => Number.isFinite(n) && n >= 0) && nums[0] >= 800 && nums[0] <= 8000;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { margin: spacing(5) }]}>
          <SectionTitle>Custom targets</SectionTitle>
          <LabeledInput label="Calories (kcal)" value={kcal} onChangeText={setKcal} keyboardType="numeric" />
          <LabeledInput label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="numeric" />
          <LabeledInput label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
          <LabeledInput label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="numeric" />
          <PrimaryButton
            title="Save custom targets"
            disabled={!valid}
            onPress={() => {
              setCustomTargets({ kcal: nums[0], proteinG: nums[1], carbsG: nums[2], fatG: nums[3] });
              onClose();
            }}
          />
          <GhostButton
            title="Reset to automatic"
            onPress={() => {
              setCustomTargets(null);
              onClose();
            }}
          />
          <GhostButton title="Cancel" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing(4),
    gap: spacing(3.5),
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing(10),
  },
  title: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 24,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    color: colors.carbs,
    fontFamily: font.semibold,
    fontSize: 14,
  },
  kcalBig: {
    color: colors.accent,
    fontFamily: font.extrabold,
    fontSize: 28,
  },
  authMessage: {
    color: colors.fat,
    fontFamily: font.regular,
    fontSize: 13,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(5),
    gap: spacing(3.5),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
});
