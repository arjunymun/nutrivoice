import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { scaleFood } from '../lib/nutrition';
import { ParsedItem } from '../lib/parser';
import { Food } from '../lib/types';
import { colors, font, radius, spacing } from '../theme';
import { Chip } from './ui';

/**
 * Review card shown after voice/text parsing, before anything is logged.
 * Users can fix grams, swap a low-confidence match, or drop an item.
 */
export function ParsedReview({
  items,
  onChange,
}: {
  items: ParsedItem[];
  onChange: (items: ParsedItem[]) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  // free-form text per row so users can type "12." or clear the field mid-edit
  const [gramsText, setGramsText] = useState<Record<number, string>>({});

  const update = (idx: number, patch: Partial<ParsedItem>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
    setGramsText({});
    setExpandedIdx(null);
  };

  const pickCandidate = (idx: number, food: Food) => {
    // keep the parsed grams — the user may have said "250 g of <thing we mismatched>"
    update(idx, { food, confidence: 1 });
    setExpandedIdx(null);
  };

  return (
    <View style={{ gap: spacing(2.5) }}>
      {items.map((item, idx) => {
        const macros = item.food ? scaleFood(item.food, item.grams) : null;
        const unmatched = !item.food;
        const uncertain = !unmatched && item.confidence < 0.75;
        return (
          <View key={`${item.raw}-${idx}`} style={[styles.card, unmatched && styles.cardUnmatched]}>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.food ? item.food.name : `"${item.raw}"`}
                </Text>
                <Text style={styles.qty}>
                  {unmatched ? 'No match found — pick below or remove' : item.qtyDescription}
                </Text>
              </View>
              {macros && <Text style={styles.kcal}>{macros.kcal} kcal</Text>}
              <Pressable onPress={() => remove(idx)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.textFaint} />
              </Pressable>
            </View>

            <View style={styles.controls}>
              <View style={styles.gramsBox}>
                <TextInput
                  style={styles.gramsInput}
                  value={gramsText[idx] ?? String(item.grams)}
                  keyboardType="numeric"
                  onChangeText={(t) => {
                    setGramsText((m) => ({ ...m, [idx]: t }));
                    const g = Number(t);
                    if (t !== '' && Number.isFinite(g) && g >= 0 && g <= 10000) {
                      update(idx, { grams: g });
                    } else if (t === '') {
                      update(idx, { grams: 0 });
                    }
                  }}
                />
                <Text style={styles.gramsUnit}>g</Text>
              </View>
              {(uncertain || unmatched) && item.candidates.length > 0 && (
                <Pressable onPress={() => setExpandedIdx(expandedIdx === idx ? null : idx)}>
                  <Text style={styles.swap}>
                    {expandedIdx === idx ? 'Hide options' : unmatched ? 'Pick food' : 'Not right?'}
                  </Text>
                </Pressable>
              )}
              {macros && (
                <Text style={styles.macros}>
                  P {macros.proteinG} · C {macros.carbsG} · F {macros.fatG}
                </Text>
              )}
            </View>

            {expandedIdx === idx && (
              <View style={styles.candidates}>
                {item.candidates.slice(0, 5).map((c) => (
                  <Chip key={c.id} label={c.name} onPress={() => pickCandidate(idx, c)} />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3.5),
    gap: spacing(2.5),
  },
  cardUnmatched: {
    borderColor: colors.danger,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
  },
  name: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  qty: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
    marginTop: 1,
  },
  kcal: {
    color: colors.accent,
    fontFamily: font.bold,
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  gramsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2.5),
  },
  gramsInput: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 14,
    paddingVertical: spacing(1.5),
    minWidth: 48,
    textAlign: 'center',
  },
  gramsUnit: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 13,
  },
  swap: {
    color: colors.carbs,
    fontFamily: font.semibold,
    fontSize: 13,
  },
  macros: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 12,
    marginLeft: 'auto',
  },
  candidates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
});
