import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { estimateTdee } from '../lib/adaptiveTdee';
import { ageFromBirthYear, bmr, targetsFromKcal, tdee } from '../lib/nutrition';
import { useLogStore } from '../stores/useLogStore';
import { useProfileStore } from '../stores/useProfileStore';
import { colors, font, spacing } from '../theme';
import { Card, Muted, PrimaryButton, SectionTitle } from './ui';

const GOAL_MULTIPLIER = { cut: 0.8, maintain: 1, bulk: 1.1 } as const;

/**
 * Adaptive TDEE (MacroFactor-style, free): shows the expenditure estimate
 * derived from real weight trend + food logs. Apply goes through
 * setCustomTargets so profile edits can't silently recompute over it.
 */
export function TdeeCard() {
  const profile = useProfileStore((s) => s.profile);
  const setCustomTargets = useProfileStore((s) => s.setCustomTargets);
  const entries = useLogStore((s) => s.entries);
  const weights = useLogStore((s) => s.weights);
  const [applied, setApplied] = useState(false);

  const est = useMemo(() => {
    if (!profile) return null;
    const age = ageFromBirthYear(profile.birthYear);
    return estimateTdee({
      entries,
      weights,
      targetKcal: profile.targetKcal,
      bmrKcal: bmr(profile.sex, profile.weightKg, profile.heightCm, age),
      priorTdeeKcal: tdee(profile.sex, profile.weightKg, profile.heightCm, age, profile.activityLevel),
    });
  }, [profile, entries, weights]);

  if (!profile || !est) return null;

  if (!est.available) {
    return (
      <Card style={{ gap: spacing(2) }}>
        <SectionTitle>Adaptive TDEE</SectionTitle>
        <Muted style={{ fontSize: 13 }}>
          Learns your REAL calorie burn from weight trend + food logs (the feature MacroFactor
          charges $72/yr for). {est.reason}
        </Muted>
      </Card>
    );
  }

  const suggestedTarget = targetsFromKcal(
    est.tdeeKcal * GOAL_MULTIPLIER[profile.goal],
    profile.weightKg,
  );
  const delta = suggestedTarget.kcal - profile.targetKcal;

  return (
    <Card style={{ gap: spacing(2.5) }}>
      <SectionTitle>Adaptive TDEE</SectionTitle>
      <Text style={styles.big}>{est.tdeeKcal} kcal/day</Text>
      <Muted style={{ fontSize: 13 }}>
        Measured from {est.foodDays} logged days + {est.weighIns} weigh-ins · trend{' '}
        {est.trendKgPerWeek > 0 ? '+' : ''}
        {est.trendKgPerWeek} kg/week · confidence {Math.round(est.confidence * 100)}%
      </Muted>
      {Math.abs(delta) >= 50 && !applied ? (
        <>
          <Muted style={{ fontSize: 13 }}>
            Suggested {profile.goal} target: {suggestedTarget.kcal} kcal ({delta > 0 ? '+' : ''}
            {delta} vs current) · P {suggestedTarget.proteinG} C {suggestedTarget.carbsG} F{' '}
            {suggestedTarget.fatG}
          </Muted>
          <PrimaryButton
            title={`Apply ${suggestedTarget.kcal} kcal as my targets`}
            onPress={() => {
              setCustomTargets({
                kcal: suggestedTarget.kcal,
                proteinG: suggestedTarget.proteinG,
                carbsG: suggestedTarget.carbsG,
                fatG: suggestedTarget.fatG,
              });
              setApplied(true);
            }}
          />
        </>
      ) : (
        <Muted style={{ fontSize: 12 }}>
          {applied ? 'Applied ✓ — targets updated.' : 'Your current targets already match.'}
        </Muted>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  big: {
    color: colors.accent,
    fontFamily: font.extrabold,
    fontSize: 28,
  },
});
