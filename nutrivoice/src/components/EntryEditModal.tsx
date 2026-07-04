import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { getFoodById } from '../lib/foodSearch';
import { FoodLogEntry } from '../lib/types';
import { useLogStore } from '../stores/useLogStore';
import { colors, font, radius, spacing } from '../theme';
import { GhostButton, LabeledInput, PrimaryButton } from './ui';

export function EntryEditModal({
  entry,
  onClose,
}: {
  entry: FoodLogEntry | null;
  onClose: () => void;
}) {
  const updateEntryGrams = useLogStore((s) => s.updateEntryGrams);
  const removeEntry = useLogStore((s) => s.removeEntry);
  const customFoods = useLogStore((s) => s.customFoods);
  const [grams, setGrams] = useState('');

  useEffect(() => {
    if (entry) setGrams(String(entry.grams));
  }, [entry]);

  if (!entry) return null;

  const parsed = Number(grams);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 10000;

  const save = () => {
    if (!valid) return;
    const food = entry.foodId ? getFoodById(entry.foodId, customFoods) : undefined;
    updateEntryGrams(entry.id, parsed, food ?? null);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{entry.name}</Text>
            <Text style={styles.sub}>
              {Math.round(entry.kcal)} kcal · P {entry.proteinG} g · C {entry.carbsG} g · F {entry.fatG} g
            </Text>
            <LabeledInput
              label="Amount (grams)"
              value={grams}
              onChangeText={setGrams}
              keyboardType="numeric"
              autoFocus
            />
            {!valid && grams !== '' && (
              <Text style={styles.error}>Enter a weight between 1 and 10000 g.</Text>
            )}
            <PrimaryButton title="Save" onPress={save} disabled={!valid} />
            <GhostButton
              title="Delete entry"
              danger
              onPress={() => {
                removeEntry(entry.id);
                onClose();
              }}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing(6),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(5),
    gap: spacing(4),
  },
  title: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 18,
  },
  sub: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontFamily: font.regular,
    fontSize: 13,
  },
});
